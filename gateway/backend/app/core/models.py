from pydantic import BaseModel, Field
from typing import List, Optional

class Tag(BaseModel):
    name: str
    db: int
    offset: int
    bit: int = Field(default=0, ge=0, le=7)
    type: str  # REAL, INT, BOOL, DINT, STRING
    value: Optional[float | int | bool | str] = None

class PLCConfig(BaseModel):
    id: str
    name: str
    ip: str
    rack: int = 0
    slot: int = 1
    type: str  # S7-300, S7-1200
    tags: List[Tag] = []
    online: bool = False

class GlobalSettings(BaseModel):
    plcs: List[PLCConfig] = []
    mqtt_broker: str = "localhost"
    mqtt_port: int = 1883
    poll_rate: float = 1.0  # seconds
    admin_password_hash: Optional[str] = None # Składowane hasło admina

class User(BaseModel):
    username: str

class Token(BaseModel):
    access_token: str
    token_type: str

class LoginRequest(BaseModel):
    username: str
    password: str
