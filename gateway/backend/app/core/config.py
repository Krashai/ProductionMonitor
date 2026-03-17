import json
import os
from pathlib import Path
from app.core.models import GlobalSettings

# Spójna ścieżka z wolumenem w docker-compose
DEFAULT_CONFIG_PATH = "/app/backend/config/settings.json"
CONFIG_PATH = Path(os.getenv("CONFIG_PATH", DEFAULT_CONFIG_PATH))

def load_settings() -> GlobalSettings:
    """Wczytuje ustawienia z pliku JSON lub zwraca domyślne."""
    path = Path(CONFIG_PATH)
    
    settings = GlobalSettings()
    if path.exists():
        try:
            with open(path, "r") as f:
                data = json.load(f)
                settings = GlobalSettings(**data)
        except Exception as e:
            print(f"Błąd podczas wczytywania ustawień: {e}")
    else:
        # Próbujemy stworzyć folder jeśli nie istnieje
        path.parent.mkdir(parents=True, exist_ok=True)

    # Nadpisujemy zmiennymi środowiskowymi jeśli obecne
    env_broker = os.getenv("MQTT_BROKER")
    if env_broker:
        settings.mqtt_broker = env_broker
    
    env_port = os.getenv("MQTT_PORT")
    if env_port:
        try:
            settings.mqtt_port = int(env_port)
        except ValueError:
            pass

    return settings

def save_settings(settings: GlobalSettings):
    """Zapisuje aktualne ustawienia do pliku JSON."""
    path = Path(CONFIG_PATH)
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w") as f:
            json.dump(settings.model_dump(), f, indent=4)
        print(f"Zapisano ustawienia do {path}")
    except PermissionError:
        print(f"BLAD KRYTYCZNY: Brak uprawnien do zapisu w {path}. Zmiany nie zostana utrwalone!")
    except Exception as e:
        print(f"Blad podczas zapisu ustawień: {e}")
