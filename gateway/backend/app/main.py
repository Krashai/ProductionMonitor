import asyncio
import os
import time
import requests
from collections import defaultdict, deque
from datetime import timedelta, datetime, timezone
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from typing import Deque, Dict, List

from app.core.config import load_settings, save_settings
from app.core.models import PLCConfig, GlobalSettings, Token, LoginRequest, User, HallConfig, Tag
from app.core.security import (
    verify_password, get_password_hash, create_access_token, 
    SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
)
from app.plc.worker import PLCWorker
from app.api.websocket import manager as ws_manager
from app.db.session import SessionLocal, engine
from app.db.models import Hall, Line, MachineStatusHistory, ScrapEvent, Base

# Tworzenie tabel na starcie (jeśli nie istnieją)
Base.metadata.create_all(bind=engine)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Globalny stan
workers: List[PLCWorker] = []
# Lock chroniący mutacje listy `workers` przed wyścigiem między równolegle
# obsługiwanymi requestami (FastAPI obsługuje wiele coroutyn jednocześnie).
_workers_lock = asyncio.Lock()
# Maksymalny czas oczekiwania na zakończenie wątku PLCWorker po stop().
# Po tym czasie wątek jest porzucany — daemon=True więc nie blokuje shutdownu procesu.
_WORKER_JOIN_TIMEOUT = 10.0


async def _stop_and_join_worker(worker: PLCWorker) -> None:
    """
    Sygnalizuje workerowi stop i czeka na faktyczne wyjście z pętli.
    `threading.Thread.join()` jest blokujące, więc odbywa się w threadpoolu —
    bez tego pojedynczy live request (PUT/DELETE /plcs) mógłby zamrozić
    cały event loop FastAPI na maks _WORKER_JOIN_TIMEOUT sekund.
    """
    worker.stop()
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, worker.join, _WORKER_JOIN_TIMEOUT)

async def get_current_user(token: str = Depends(oauth2_scheme)):
    """Weryfikuje token JWT dla chronionych tras."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Błędne poświadczenia",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None: raise credentials_exception
        return User(username=username)
    except JWTError:
        raise credentials_exception

_NOTIFY_TOKEN = os.environ.get("NOTIFY_TOKEN", "")
_NOTIFY_URL = os.environ.get(
    "DASHBOARD_NOTIFY_URL", "http://dashboard-app:3000/api/notify"
)


def notify_dashboard(event_type: str = "REVALIDATE", line_id: str = None):
    """Informuje Dashboard o zmianie stanu linii lub konfiguracji."""
    try:
        payload = {"type": event_type}
        if line_id:
            payload["lineId"] = line_id

        # Dashboard wymaga x-notify-token; bez tego zwraca 401 i revalidacja
        # tagów Next.js (`halls-data`) nie wykonuje się — UI pokazuje dane
        # sprzed ostatniego odświeżenia ISR.
        headers = {}
        if _NOTIFY_TOKEN:
            headers["x-notify-token"] = _NOTIFY_TOKEN

        requests.post(_NOTIFY_URL, json=payload, headers=headers, timeout=1)
    except Exception:
        pass

@asynccontextmanager
async def lifespan(app: FastAPI):
    # STARTUP — używamy get_running_loop() bo lifespan wykonuje się
    # już wewnątrz event loopu. get_event_loop() jest deprecated od Pythona
    # 3.10 gdy nie ma jeszcze running loopu i nie powinno być używane wewnątrz
    # async kontekstu — w przyszłych wersjach rzuci DeprecationWarning -> Error.
    loop = asyncio.get_running_loop()
    settings = load_settings()
    
    # Inicjalizacja hasła admina (jeśli brak)
    if not settings.admin_password_hash:
        settings.admin_password_hash = get_password_hash("admin")
        save_settings(settings)
        print("Ustawiono domyślne hasło: admin/admin", flush=True)
        print(
            "WARNING: Default admin password is in use. Change it via the UI "
            "before exposing the gateway to any untrusted network.",
            flush=True,
        )
    elif verify_password("admin", settings.admin_password_hash):
        print(
            "WARNING: Admin password is still the default 'admin'. Change it "
            "via the UI before exposing the gateway to any untrusted network.",
            flush=True,
        )
    
    # Inicjalizacja workerów z bazy danych
    db = SessionLocal()
    try:
        db_lines = db.query(Line).all()
        for line in db_lines:
            # Konwersja modelu DB na PLCConfig dla workera
            plc_cfg = PLCConfig(
                id=line.plcId,
                name=line.name,
                hall_id=line.hallId,
                ip=line.ip,
                rack=line.rack,
                slot=line.slot,
                type=line.type,
                tags=line.tags if isinstance(line.tags, list) else [],
                online=line.isOnline
            )
            worker = PLCWorker(plc_cfg, loop, settings.poll_rate)
            worker.start()
            workers.append(worker)
        print(f"Zainicjalizowano {len(workers)} workerów PLC z bazy danych", flush=True)
    finally:
        db.close()

    yield # Running...

    # SHUTDOWN — sygnalizujemy stop wszystkim, potem czekamy na join każdego.
    # Bez join() proces FastAPI mógłby zakończyć się w trakcie aktywnego
    # snap7.db_read() i wywołać segfault z nieczyszczonego socketu.
    async with _workers_lock:
        snapshot = list(workers)
    for worker in snapshot:
        worker.stop()
    for worker in snapshot:
        worker.join(timeout=_WORKER_JOIN_TIMEOUT)

app = FastAPI(title="PLC Gateway S7", lifespan=lifespan)

# CORS — whitelist explicitly via env, falling back to local dev origins.
# Wildcard "*" allows any site on the operator's network to call the gateway,
# which combined with the JWT-only auth was a real foot-gun.
_default_origins = "http://localhost:3000,http://localhost:5173,http://dashboard-app:3000"
_cors_origins = [
    o.strip()
    for o in os.environ.get("PLC_GATEWAY_CORS_ORIGINS", _default_origins).split(",")
    if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# In-memory rate limiter for /login. Sliding-window per client IP.
# 5 attempts per 5 minutes is enough for a confused operator and well below
# what an online brute-force needs to be useful against bcrypt-hashed passwords.
_LOGIN_WINDOW_SECONDS = 5 * 60
_LOGIN_MAX_ATTEMPTS = 5
_LOGIN_SWEEP_EVERY = 100
_login_attempts: Dict[str, Deque[float]] = defaultdict(deque)
_login_attempts_lock = asyncio.Lock()
_login_sweep_counter = 0


async def _check_login_rate_limit(client_ip: str) -> None:
    now = time.monotonic()
    cutoff = now - _LOGIN_WINDOW_SECONDS
    async with _login_attempts_lock:
        # Okresowe sprzątanie: co _LOGIN_SWEEP_EVERY wywołań przeszukujemy
        # cały słownik i kasujemy buckety, których wszystkie timestampy są
        # już poza oknem. Bez tego defaultdict rósłby liniowo z liczbą
        # unikalnych IP, które kiedykolwiek dotknęły /login.
        global _login_sweep_counter
        _login_sweep_counter += 1
        if _login_sweep_counter >= _LOGIN_SWEEP_EVERY:
            _login_sweep_counter = 0
            stale = [
                ip for ip, b in _login_attempts.items()
                if not b or b[-1] < cutoff
            ]
            for ip in stale:
                del _login_attempts[ip]

        bucket = _login_attempts[client_ip]
        while bucket and bucket[0] < cutoff:
            bucket.popleft()
        if len(bucket) >= _LOGIN_MAX_ATTEMPTS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Zbyt wiele prób logowania. Spróbuj ponownie później.",
            )
        bucket.append(now)

_ADMIN_USERNAME = os.environ.get("PLC_GATEWAY_ADMIN_USERNAME", "admin")


@app.post("/login", response_model=Token)
async def login(req: LoginRequest, request: Request):
    client_ip = request.client.host if request.client else "unknown"
    await _check_login_rate_limit(client_ip)

    settings = load_settings()

    # Both branches do bcrypt verification (or equivalent work) to keep the
    # response time independent of whether the username exists, mitigating
    # username enumeration. The previous implementation ignored the username
    # field entirely.
    if req.username != _ADMIN_USERNAME:
        verify_password("dummy", settings.admin_password_hash or get_password_hash("dummy"))
        raise HTTPException(status_code=401, detail="Błędne poświadczenia")

    if not verify_password(req.password, settings.admin_password_hash):
        raise HTTPException(status_code=401, detail="Błędne poświadczenia")

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": req.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/halls", response_model=List[HallConfig])
async def get_halls(current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    try:
        halls = db.query(Hall).all()
        return [HallConfig(id=h.id, name=h.name) for h in halls]
    finally:
        db.close()

@app.post("/halls", status_code=201)
async def add_hall(hall: HallConfig, current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    try:
        db_hall = db.query(Hall).filter(Hall.id == hall.id).first()
        if db_hall:
            raise HTTPException(status_code=400, detail="Hala z tym ID już istnieje")
        
        new_hall = Hall(id=hall.id, name=hall.name)
        db.add(new_hall)
        db.commit()
        notify_dashboard()
        return {"message": "Dodano halę"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()

@app.delete("/halls/{hall_id}")
async def delete_hall(hall_id: str, current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    try:
        lines_count = db.query(Line).filter(Line.hallId == hall_id).count()
        if lines_count > 0:
             raise HTTPException(
                status_code=400, 
                detail=f"Nie można usunąć hali - posiada {lines_count} przypisanych linii."
            )

        db.query(Hall).filter(Hall.id == hall_id).delete()
        db.commit()
        notify_dashboard()
        return {"message": "Hala została usunięta"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()

@app.get("/plcs", response_model=List[PLCConfig])
async def get_plcs(current_user: User = Depends(get_current_user)):
    # Zwracamy aktualny stan workerów (który odzwierciedla bazę + stan online).
    # Snapshot pod lockiem żeby nie było wyścigu z rebuildem listy
    # w update_plc/delete_plc (`workers = [...]`).
    async with _workers_lock:
        return [w.config for w in workers]

@app.post("/plcs", status_code=201)
async def add_plc(config: PLCConfig, current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    try:
        db_line = db.query(Line).filter(Line.plcId == config.id).first()
        if db_line:
            raise HTTPException(status_code=400, detail="PLC z tym ID już istnieje")
        
        new_line = Line(
            plcId=config.id,
            name=config.name,
            hallId=config.hall_id,
            ip=config.ip,
            rack=config.rack,
            slot=config.slot,
            type=config.type,
            tags=[tag.model_dump() for tag in config.tags]
        )
        db.add(new_line)
        db.commit()
        
        # Start workera
        loop = asyncio.get_running_loop()
        settings = load_settings()
        worker = PLCWorker(config, loop, settings.poll_rate)
        worker.start()
        async with _workers_lock:
            workers.append(worker)

        notify_dashboard()
        return {"message": "Dodano sterownik"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()

@app.put("/plcs/{plc_id}")
async def update_plc(plc_id: str, config: PLCConfig, current_user: User = Depends(get_current_user)):
    global workers
    db = SessionLocal()
    try:
        db_line = db.query(Line).filter(Line.plcId == plc_id).first()
        if not db_line:
            raise HTTPException(status_code=404, detail="Nie znaleziono PLC")
        
        db_line.name = config.name
        db_line.hallId = config.hall_id
        db_line.ip = config.ip
        db_line.rack = config.rack
        db_line.slot = config.slot
        db_line.type = config.type
        db_line.tags = [tag.model_dump() for tag in config.tags]
        db_line.updatedAt = datetime.now(timezone.utc)

        db.commit()

        # Restart workera
        async with _workers_lock:
            target = next((w for w in workers if w.config.id == plc_id), None)
            if target:
                workers = [w for w in workers if w.config.id != plc_id]

        if target:
            await _stop_and_join_worker(target)

        loop = asyncio.get_running_loop()
        settings = load_settings()
        new_worker = PLCWorker(config, loop, settings.poll_rate)
        new_worker.start()
        async with _workers_lock:
            workers.append(new_worker)

        notify_dashboard()
        return {"message": "Zaktualizowano sterownik"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()

@app.delete("/plcs/{plc_id}")
async def delete_plc(plc_id: str, current_user: User = Depends(get_current_user)):
    global workers
    db = SessionLocal()
    try:
        db_line = db.query(Line).filter(Line.plcId == plc_id).first()
        if not db_line:
            raise HTTPException(status_code=404, detail="Nie znaleziono PLC")
            
        # 1. Zatrzymaj workera (poza commitem DB — sygnał + join)
        async with _workers_lock:
            target = next((w for w in workers if w.config.id == plc_id), None)
            if target:
                workers = [w for w in workers if w.config.id != plc_id]

        if target:
            await _stop_and_join_worker(target)

        # 2. Usuń historię i linię
        db.query(MachineStatusHistory).filter(MachineStatusHistory.lineId == db_line.id).delete()
        db.query(ScrapEvent).filter(ScrapEvent.lineId == db_line.id).delete()
        db.delete(db_line)
        db.commit()
        
        notify_dashboard()
        return {"message": "Usunięto sterownik"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await ws_manager.disconnect(websocket)
