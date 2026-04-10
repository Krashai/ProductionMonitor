import os
import requests
import time
import threading
import asyncio
import snap7
from app.core.models import PLCConfig
from app.plc.utils import decode_tag_value
from app.api.websocket import manager as ws_manager
from app.db.session import SessionLocal
from app.db.models import Line, MachineStatusHistory, ScrapEvent

NOTIFY_TOKEN = os.getenv("NOTIFY_TOKEN")

# Pomocnicza funkcja do powiadomień
def notify_dashboard(event_type: str, line_id: str):
    try:
        headers = {}
        if NOTIFY_TOKEN:
            headers["X-Notify-Token"] = NOTIFY_TOKEN
        requests.post(
            "http://dashboard-app:3000/api/notify",
            json={"type": event_type, "lineId": line_id},
            headers=headers,
            timeout=0.5,
        )
    except Exception:
        pass

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
        """Główna pętla odczytu PLC."""
        while self.running:
            start_time = time.time()
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
                    self.config.online = False
                    self.client.disconnect()
            
            if has_db_line:
                self.update_online_status()
            
            # Broadcast tylko gdy online lub przy zmianie statusu
            if is_connected or self.config.online != self.last_db_online_status:
                self.broadcast_update()
            
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
            
            new_speed = current_cycle.get('Speed') or current_cycle.get('speed')
            if new_speed is not None:
                new_speed = float(new_speed)

            # Pobieramy poprzednie wartości z cache
            old_status = self.last_values.get('status_cache')
            old_speed = self.last_values.get('speed_cache')

            # Jeśli coś się zmieniło, zapisujemy historyczny wpis
            status_changed = (new_status is not None and new_status != old_status)
            speed_changed = (new_speed is not None and new_speed != old_speed)

            if status_changed or speed_changed:
                final_status = new_status if new_status is not None else (old_status or False)
                final_speed = new_speed if new_speed is not None else (old_speed or 0.0)
                
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
            # print(f"DB CYCLE WRITE ERROR for {self.config.id}: {e}", flush=True)
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
