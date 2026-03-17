import asyncio
from datetime import timedelta
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
import paho.mqtt.client as mqtt
from typing import List

from app.core.config import load_settings, save_settings
from app.core.models import PLCConfig, GlobalSettings, Token, LoginRequest, User
from app.core.security import (
    verify_password, get_password_hash, create_access_token, 
    SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
)
from app.plc.worker import PLCWorker
from app.api.websocket import manager as ws_manager

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Globalny stan
workers: List[PLCWorker] = []
mqtt_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)

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

@asynccontextmanager
async def lifespan(app: FastAPI):
    # STARTUP
    loop = asyncio.get_event_loop()
    settings = load_settings()
    
    # Inicjalizacja hasła admina (jeśli brak)
    if not settings.admin_password_hash:
        settings.admin_password_hash = get_password_hash("admin")
        save_settings(settings)
        print("Ustawiono domyślne hasło: admin/admin")
    
    try:
        mqtt_client.connect(settings.mqtt_broker, settings.mqtt_port, 60)
        mqtt_client.loop_start()
    except Exception as e:
        print(f"Błąd MQTT: {e}")

    for plc_cfg in settings.plcs:
        worker = PLCWorker(plc_cfg, mqtt_client, loop, settings.poll_rate)
        worker.start()
        workers.append(worker)

    yield # Running...
    
    # SHUTDOWN
    for worker in workers:
        worker.stop()
    mqtt_client.loop_stop()
    mqtt_client.disconnect()

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
    
    loop = asyncio.get_event_loop()
    worker = PLCWorker(config, mqtt_client, loop, settings.poll_rate)
    worker.start()
    workers.append(worker)
    return {"message": "Dodano sterownik"}

@app.put("/plcs/{plc_id}")
async def update_plc(plc_id: str, config: PLCConfig, current_user: User = Depends(get_current_user)):
    global workers
    settings = load_settings()
    
    # 1. Find and update in settings
    found = False
    for i, p in enumerate(settings.plcs):
        if p.id == plc_id:
            settings.plcs[i] = config
            found = True
            break
    
    if not found:
        raise HTTPException(status_code=404, detail="Nie znaleziono PLC")
    
    save_settings(settings)
    
    # 2. Restart worker
    target = next((w for w in workers if w.config.id == plc_id), None)
    if target:
        target.stop()
        workers = [w for w in workers if w.config.id != plc_id]
    
    loop = asyncio.get_event_loop()
    new_worker = PLCWorker(config, mqtt_client, loop, settings.poll_rate)
    new_worker.start()
    workers.append(new_worker)
    
    return {"message": "Zaktualizowano sterownik"}

@app.delete("/plcs/{plc_id}")
async def delete_plc(plc_id: str, current_user: User = Depends(get_current_user)):
    global workers
    target = next((w for w in workers if w.config.id == plc_id), None)
    if not target: raise HTTPException(status_code=404, detail="Nie znaleziono PLC")
    
    target.stop()
    workers = [w for w in workers if w.config.id != plc_id]
    
    settings = load_settings()
    settings.plcs = [p for p in settings.plcs if p.id != plc_id]
    save_settings(settings)
    return {"message": "Usunięto sterownik"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
