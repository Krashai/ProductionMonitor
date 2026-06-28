import os
import requests
import time
import threading
import asyncio
import traceback
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import snap7
from app.core.models import PLCConfig
from app.plc.utils import decode_tag_value
from app.api.websocket import manager as ws_manager
from app.db.session import SessionLocal
from app.db.models import Line, MachineStatusHistory, ScrapEvent

NOTIFY_TOKEN = os.getenv("NOTIFY_TOKEN")
NOTIFY_URL = "http://dashboard-app:3000/api/notify"
SPEED_MAX_SILENCE_S = 60  # max przerwa między zapisami prędkości, niezależnie od deadband

# Fire-and-forget pool dla notify: HTTP POST nie może blokować pętli PLC.
# Wcześniej synchroniczny request z timeout=0.5s mógł zatrzymać poll na 2-4s
# przy wolnym dashboardzie — całkowicie podkopując poll_rate=1s.
# max_workers=4 wystarczy na nasz wolumen eventów (publish-on-change, nie poll).
_NOTIFY_POOL = ThreadPoolExecutor(max_workers=4, thread_name_prefix="notify")

def _send_notify(payload: dict, headers: dict):
    """Wykonuje POST z retry tylko dla 5xx/network errors. 4xx wychodzi natychmiast
    (401/400 nie naprawi retry). Każdy fail logowany — operator dowie się o ciszy."""
    for attempt in (1, 2):
        try:
            resp = requests.post(NOTIFY_URL, json=payload, headers=headers, timeout=1.0)
            if 500 <= resp.status_code < 600:
                # transient — spróbuj drugi raz
                if attempt == 2:
                    print(
                        f"notify {payload.get('type')} line={payload.get('lineId')} HTTP {resp.status_code} after retry",
                        flush=True,
                    )
                continue
            if resp.status_code >= 400:
                # 4xx — nie naprawi się przez retry (np. 401 brak tokenu)
                print(
                    f"notify {payload.get('type')} line={payload.get('lineId')} HTTP {resp.status_code}: {resp.text[:200]}",
                    flush=True,
                )
                return
            return  # 2xx/3xx success
        except requests.exceptions.RequestException as e:
            if attempt == 2:
                print(
                    f"notify {payload.get('type')} line={payload.get('lineId')} FAILED after retry: {e}",
                    flush=True,
                )

def notify_dashboard(event_type: str, line_id: str):
    """Submit notify do background pool — wraca natychmiast, nie blokuje workera."""
    headers = {"Content-Type": "application/json"}
    if NOTIFY_TOKEN:
        headers["X-Notify-Token"] = NOTIFY_TOKEN
    payload = {"type": event_type, "lineId": line_id}
    try:
        _NOTIFY_POOL.submit(_send_notify, payload, headers)
    except RuntimeError:
        # Pool został zamknięty (shutdown w trakcie) — log i kontynuuj.
        print(f"notify {event_type} line={line_id}: executor shut down", flush=True)

class PLCWorker(threading.Thread):
    def __init__(self, config: PLCConfig, loop: asyncio.AbstractEventLoop, poll_rate: float = 1.0):
        super().__init__(daemon=True)
        self.config = config
        self.loop = loop
        self.poll_rate = poll_rate
        self.running = True
        self.client = snap7.client.Client()
        self.last_values = {}  # Cache dla mechanizmu publish-on-change
        self.line_internal_id = None
        self.last_db_online_status = None
        # Throttle dla touch_last_seen — heartbeat zapisujemy max raz na 10s,
        # żeby nie spamować bazą przy poll_rate=1s.
        self._last_seen_written_at = 0.0
        self._last_speed_written_at: float = 0.0

    def connect(self):
        """Próba połączenia ze sterownikiem PLC."""
        if not self.client.get_connected():
            try:
                if self.config.ip == "127.0.0.1":
                    self.client.set_param(snap7.types.RemotePort, 1102)
                else:
                    self.client.set_param(snap7.types.RemotePort, 102)
                
                self.client.connect(self.config.ip, self.config.rack, self.config.slot)
                self.config.online = True
            except Exception as e:
                self.config.online = False
                return False
        return True

    def find_line_id(self):
        """Pobiera wewnętrzne ID linii z bazy danych na podstawie plcId."""
        if self.line_internal_id:
            return True
        
        db = SessionLocal()
        try:
            line = db.query(Line).filter(Line.plcId == self.config.id).first()
            if line:
                self.line_internal_id = line.id
                return True
            return False
        finally:
            db.close()

    def touch_last_seen(self):
        """Zapisuje "linia żyje TERAZ" w lines.lastSeenAt.

        Dashboard porównuje to z bieżącym czasem żeby wykryć "gateway down" —
        jeśli proces zginął, lastSeenAt zamarznie i UI pokaże offline po progu.
        Throttle 10s żeby nie generować ruchu w DB przy poll_rate=1s.
        """
        if not self.line_internal_id:
            return
        now = time.time()
        if now - self._last_seen_written_at < 10.0:
            return
        db = SessionLocal()
        try:
            db.query(Line).filter(Line.id == self.line_internal_id).update(
                {"lastSeenAt": datetime.now(timezone.utc)}
            )
            db.commit()
            self._last_seen_written_at = now
        except Exception as e:
            print(f"LAST_SEEN UPDATE ERROR for {self.config.id}: {e}", flush=True)
            db.rollback()
        finally:
            db.close()

    def update_online_status(self):
        """Aktualizuje status isOnline w bazie danych, jeśli się zmienił."""
        if not self.line_internal_id:
            return

        if self.config.online != self.last_db_online_status:
            db = SessionLocal()
            try:
                db.query(Line).filter(Line.id == self.line_internal_id).update({"isOnline": self.config.online})
                db.commit()
                self.last_db_online_status = self.config.online
            except Exception as e:
                print(f"DB STATUS UPDATE ERROR for {self.config.id}: {e}", flush=True)
                db.rollback()
            finally:
                db.close()

    def run(self):
        """Główna pętla odczytu PLC.

        Outer try/except chroni wątek przed cichą śmiercią: wcześniej wyjątek
        w find_line_id/update_online_status/broadcast_update zabijał daemon-thread
        bez logu, a linia "zamarzała" w UI z ostatnim znanym stanem online=True.
        """
        while self.running:
            start_time = time.time()
            is_connected = False
            has_db_line = False
            try:
                has_db_line = self.find_line_id()
                is_connected = self.connect()

                if is_connected:
                    try:
                        current_cycle_values = {}
                        dbs = {}
                        for tag in self.config.tags:
                            if tag.db not in dbs: dbs[tag.db] = []
                            dbs[tag.db].append(tag)

                        for db_num, tags in dbs.items():
                            max_offset = max(t.offset for t in tags) + 4
                            if any(t.type.upper() == "STRING" for t in tags):
                                max_offset = max(max_offset, 256 + max(t.offset for t in tags if t.type.upper() == "STRING"))

                            raw_data = self.client.db_read(db_num, 0, max_offset)

                            for tag in tags:
                                bit_val = getattr(tag, 'bit', 0)
                                val = decode_tag_value(raw_data, tag.offset, tag.type, bit_val)
                                if val is not None:
                                    tag.value = val
                                    current_cycle_values[tag.name] = val

                        if has_db_line:
                            self.sync_cycle_to_db(current_cycle_values)

                        self.config.online = True
                    except Exception as e:
                        print(f"PLC READ ERROR for {self.config.id}: {e}", flush=True)
                        self.config.online = False
                        try:
                            self.client.disconnect()
                        except Exception:
                            pass

                if has_db_line:
                    self.update_online_status()
                    # Heartbeat dla dashboardu: zapisujemy "linia żyje TERAZ".
                    # Bez tego dashboard nie odróżni martwego gateway od stojącej linii.
                    self.touch_last_seen()

                # Broadcast tylko gdy online lub przy zmianie statusu
                if is_connected or self.config.online != self.last_db_online_status:
                    self.broadcast_update()
            except MemoryError:
                # OOM jest realny na Raspberry Pi — wątek nie powinien
                # kontynuować w nieznanym stanie pamięci. Pozwalamy propagować.
                raise
            except Exception as e:
                # Nadrzędny safety net — daemon-thread nie może umrzeć po cichu.
                print(
                    f"PLCWorker {self.config.id} LOOP ERROR (recovering): {e}",
                    flush=True,
                )
                traceback.print_exc()

            elapsed = time.time() - start_time
            # Jeśli brak połączenia, czekaj dłużej (5s zamiast 1s)
            dynamic_poll = self.poll_rate if is_connected else 5.0
            sleep_time = max(0.1, dynamic_poll - elapsed)
            time.sleep(sleep_time)

    def sync_cycle_to_db(self, current_cycle):
        """Atomowe zapisywanie stanu z całego cyklu odczytu."""
        db = SessionLocal()
        try:
            # 1. Sprawdzenie Statusu i Prędkości
            new_status = None
            for name in ['Status', 'status', 'state', 'state2']:
                if name in current_cycle:
                    new_status = str(current_cycle[name]).lower() in ['true', '1']
                    break
            
            _speed_raw = current_cycle.get('Speed')
            new_speed = _speed_raw if _speed_raw is not None else current_cycle.get('speed')
            if new_speed is not None:
                new_speed = float(new_speed)

            # Pobieramy poprzednie wartości z cache
            old_status = self.last_values.get('status_cache')
            old_speed = self.last_values.get('speed_cache')

            # Jeśli coś się zmieniło, zapisujemy historyczny wpis
            status_changed = (new_status is not None and new_status != old_status)
            
            # Dodajemy deadband dla prędkości (np. 0.5 jednostki), aby uniknąć zapisu szumu
            speed_changed = False
            if new_speed is not None:
                if old_speed is None:
                    speed_changed = True
                elif abs(new_speed - old_speed) >= 0.5:
                    speed_changed = True
                elif time.time() - self._last_speed_written_at > SPEED_MAX_SILENCE_S:
                    speed_changed = True  # periodic flush — zapobiega "zamrożeniu" prędkości w DB

            if status_changed or speed_changed:
                final_status = new_status if new_status is not None else (old_status or False)
                final_speed = new_speed if new_speed is not None else (old_speed or 0.0)
                
                print(f"SYNCING to DB for {self.config.id}: status={final_status}, speed={final_speed}", flush=True)
                
                history_entry = MachineStatusHistory(
                    lineId=self.line_internal_id,
                    status=final_status,
                    speed=final_speed
                )
                db.add(history_entry)
                db.commit() # Commit tutaj, aby dashboard mógł od razu odczytać nowe dane
                
                notify_dashboard("LINE_UPDATE", str(self.line_internal_id))
                
                self.last_values['status_cache'] = final_status
                self.last_values['speed_cache'] = final_speed
                if speed_changed:
                    self._last_speed_written_at = time.time()

            # 2. Obsługa Scrap (Edge Detection)
            scrap_added = False
            for tag_name, val in current_cycle.items():
                if tag_name.lower() in ['scrap', 'scrap_pulse']:
                    is_pulse = str(val).lower() in ['true', '1']
                    cache_key = f"scrap_last_{tag_name}"
                    last_pulse = self.last_values.get(cache_key, False)
                    
                    # Zbocze narastające i maszyna musi pracować
                    if is_pulse and not last_pulse and self.last_values.get('status_cache', False):
                        scrap_event = ScrapEvent(lineId=self.line_internal_id)
                        db.add(scrap_event)
                        scrap_added = True
                    
                    self.last_values[cache_key] = is_pulse

            if scrap_added:
                db.commit()
                notify_dashboard("LINE_UPDATE", str(self.line_internal_id))
            else:
                db.commit()
        except Exception as e:
            print(f"DB CYCLE WRITE ERROR for {self.config.id}: {e}", flush=True)
            traceback.print_exc()
            db.rollback()
        finally:
            db.close()

    def broadcast_update(self):
        """Wysyła stan sterownika przez WebSockets."""
        data = {
            "type": "PLC_UPDATE",
            "payload": self.config.model_dump()
        }
        asyncio.run_coroutine_threadsafe(ws_manager.broadcast(data), self.loop)

    def stop(self):
        self.running = False
        if self.client.get_connected():
            self.client.disconnect()
