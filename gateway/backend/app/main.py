import asyncio
from datetime import timedelta
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from typing import List

from app.core.config import load_settings, save_settings
from app.core.models import PLCConfig, GlobalSettings, Token, LoginRequest, User, HallConfig
from app.core.security import (
    verify_password, get_password_hash, create_access_token, 
    SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
)
from app.plc.worker import PLCWorker
from app.api.websocket import manager as ws_manager
from app.db.session import SessionLocal
from app.db.models import Hall, Line, MachineStatusHistory, ScrapEvent

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Globalny stan
workers: List[PLCWorker] = []

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

def sync_database_structure(settings: GlobalSettings):
    """Synchronizuje strukturę hal i linii z bazy danych z ustawieniami lokalnymi."""
    from datetime import datetime
    now = datetime.utcnow()
    
    print(f"DEBUG SYNC: Starting sync for {len(settings.halls)} halls and {len(settings.plcs)} plcs", flush=True)
    db = SessionLocal()
    try:
        # 1. Synchronizacja Hal
        for h_cfg in settings.halls:
            db_hall = db.query(Hall).filter(Hall.id == h_cfg.id).first()
            if not db_hall:
                print(f"DEBUG SYNC: Creating missing hall {h_cfg.id}", flush=True)
                new_hall = Hall(
                    id=h_cfg.id, 
                    name=h_cfg.name,
                    createdAt=now,
                    updatedAt=now
                )
                db.add(new_hall)
        
        db.commit()

        # 2. Synchronizacja Linii
        for p_cfg in settings.plcs:
            db_line = db.query(Line).filter(Line.plcId == p_cfg.id).first()
            if not db_line:
                if not p_cfg.hall_id:
                    continue
                
                print(f"DEBUG SYNC: Creating missing line {p_cfg.id} in hall {p_cfg.hall_id}", flush=True)
                new_line = Line(
                    plcId=p_cfg.id,
                    name=p_cfg.name,
                    hallId=p_cfg.hall_id,
                    createdAt=now,
                    updatedAt=now
                )
                db.add(new_line)
            else:
                # Update name or hall if changed
                db_line.name = p_cfg.name
                if p_cfg.hall_id:
                    db_line.hallId = p_cfg.hall_id
                db_line.updatedAt = now
        
        db.commit()
        print("DEBUG SYNC: Finished successfully", flush=True)
    except Exception as e:
        print(f"DATABASE SYNC ERROR: {e}", flush=True)
        db.rollback()
    finally:
        db.close()

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
    
    # Synchronizacja bazy danych na starcie
    sync_database_structure(settings)

    for plc_cfg in settings.plcs:
        worker = PLCWorker(plc_cfg, loop, settings.poll_rate)
        worker.start()
        workers.append(worker)

    yield # Running...
    
    # SHUTDOWN
    for worker in workers:
        worker.stop()

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
    settings = load_settings()
    return settings.halls

@app.post("/halls", status_code=201)
async def add_hall(hall: HallConfig, current_user: User = Depends(get_current_user)):
    settings = load_settings()
    if any(h.id == hall.id for h in settings.halls):
        raise HTTPException(status_code=400, detail="Hala z tym ID już istnieje")
    settings.halls.append(hall)
    save_settings(settings)
    sync_database_structure(settings)
    return {"message": "Dodano halę"}

@app.delete("/halls/{hall_id}")
async def delete_hall(hall_id: str, current_user: User = Depends(get_current_user)):
    settings = load_settings()
    
    # 1. Sprawdź czy do hali są przypisane jakieś PLC w ustawieniach
    if any(p.hall_id == hall_id for p in settings.plcs):
        raise HTTPException(
            status_code=400, 
            detail="Nie można usunąć hali, do której są przypisane sterowniki PLC w Gatewayu."
        )
    
    # 2. Usuń z ustawień lokalnych
    original_halls_count = len(settings.halls)
    settings.halls = [h for h in settings.halls if h.id != hall_id]
    if len(settings.halls) < original_halls_count:
        save_settings(settings)
    
    # 3. Usuń z bazy danych
    db = SessionLocal()
    try:
        lines_count = db.query(Line).filter(Line.hallId == hall_id).count()
        if lines_count > 0:
             raise HTTPException(
                status_code=400, 
                detail=f"Nie można usunąć hali z bazy danych - posiada {lines_count} przypisanych linii."
            )

        db.query(Hall).filter(Hall.id == hall_id).delete()
        db.commit()
        # Powiadom Dashboard o zmianie
        try: requests.post("http://dashboard-app:3000/api/revalidate", json={"path": "/"})
        except: pass
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"DATABASE DELETE HALL ERROR: {e}", flush=True)
    finally:
        db.close()
        
    return {"message": "Hala została usunięta"}

@app.get("/plcs", response_model=List[PLCConfig])
async def get_plcs(current_user: User = Depends(get_current_user)):
    return [w.config for w in workers]

@app.post("/plcs", status_code=201)
async def add_plc(config: PLCConfig, current_user: User = Depends(get_current_user)):
    settings = load_settings()
    if any(p.id == config.id for p in settings.plcs):
        raise HTTPException(status_code=400, detail="PLC z tym ID już istnieje")
    
    settings.plcs.append(config)
    save_settings(settings)
    sync_database_structure(settings)
    
    loop = asyncio.get_event_loop()
    worker = PLCWorker(config, loop, settings.poll_rate)
    worker.start()
    workers.append(worker)
    return {"message": "Dodano sterownik"}

@app.put("/plcs/{plc_id}")
async def update_plc(plc_id: str, config: PLCConfig, current_user: User = Depends(get_current_user)):
    global workers
    settings = load_settings()
    
    found = False
    for i, p in enumerate(settings.plcs):
        if p.id == plc_id:
            settings.plcs[i] = config
            found = True
            break
    
    if not found:
        raise HTTPException(status_code=404, detail="Nie znaleziono PLC")
    
    save_settings(settings)
    sync_database_structure(settings)
    
    # Restart worker
    target = next((w for w in workers if w.config.id == plc_id), None)
    if target:
        target.stop()
        workers = [w for w in workers if w.config.id != plc_id]
    
    loop = asyncio.get_event_loop()
    new_worker = PLCWorker(config, loop, settings.poll_rate)
    new_worker.start()
    workers.append(new_worker)
    
    return {"message": "Zaktualizowano sterownik"}

@app.delete("/plcs/{plc_id}")
async def delete_plc(plc_id: str, current_user: User = Depends(get_current_user)):
    global workers
    settings = load_settings()
    
    # 1. Zatrzymaj workera
    target = next((w for w in workers if w.config.id == plc_id), None)
    if target:
        target.stop()
        workers = [w for w in workers if w.config.id != plc_id]
    
    # 2. Usuń z ustawień
    original_plcs_count = len(settings.plcs)
    settings.plcs = [p for p in settings.plcs if p.id != plc_id]
    if len(settings.plcs) < original_plcs_count:
        save_settings(settings)
    
    # 3. Usuń z bazy danych
    db = SessionLocal()
    try:
        line = db.query(Line).filter(Line.plcId == plc_id).first()
        if line:
            db.query(MachineStatusHistory).filter(MachineStatusHistory.lineId == line.id).delete()
            db.query(ScrapEvent).filter(ScrapEvent.lineId == line.id).delete()
            db.query(Line).filter(Line.id == line.id).delete()
            db.commit()
    except Exception as e:
        db.rollback()
        print(f"DATABASE DELETE PLC ERROR: {e}", flush=True)
    finally:
        db.close()

    return {"message": "Usunięto sterownik"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
