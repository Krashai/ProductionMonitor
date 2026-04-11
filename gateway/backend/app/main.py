import asyncio
import requests
from datetime import timedelta, datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from typing import List

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

def notify_dashboard(event_type: str = "REVALIDATE", line_id: str = None):
    """Informuje Dashboard o zmianie stanu linii lub konfiguracji."""
    try:
        # Próbujemy uderzyć w nowy endpoint notify
        payload = {"type": event_type}
        if line_id:
            payload["lineId"] = line_id
            
        requests.post("http://dashboard-app:3000/api/notify", json=payload, timeout=1)
    except Exception as e:
        # print(f"NOTIFICATION ERROR: {e}")
        pass

@asynccontextmanager
async def lifespan(app: FastAPI):
    # STARTUP
    loop = asyncio.get_event_loop()
    settings = load_settings()
    
    # Inicjalizacja hasła admina (jeśli brak)
    if not settings.admin_password_hash:
        settings.admin_password_hash = get_password_hash("admin")
        save_settings(settings)
        print("Ustawiono domyślne hasło: admin/admin", flush=True)
    
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/login", response_model=Token)
async def login(req: LoginRequest):
    settings = load_settings()
    if not verify_password(req.password, settings.admin_password_hash):
        raise HTTPException(status_code=401, detail="Błędne hasło")
    
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
    # Zwracamy aktualny stan workerów (który odzwierciedla bazę + stan online)
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
        loop = asyncio.get_event_loop()
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
        db_line.updatedAt = datetime.utcnow()
        
        db.commit()
        
        # Restart workera
        async with _workers_lock:
            target = next((w for w in workers if w.config.id == plc_id), None)
            if target:
                workers = [w for w in workers if w.config.id != plc_id]

        if target:
            target.stop()
            target.join(timeout=_WORKER_JOIN_TIMEOUT)

        loop = asyncio.get_event_loop()
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
            target.stop()
            target.join(timeout=_WORKER_JOIN_TIMEOUT)

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
