import json
import os
import tempfile
from pathlib import Path
from app.core.models import GlobalSettings

# Spójna ścieżka z wolumenem w docker-compose
DEFAULT_CONFIG_PATH = "/app/config/settings.json"
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

    return settings

def save_settings(settings: GlobalSettings):
    """
    Atomowy zapis ustawień: zapis do pliku tymczasowego w tym samym katalogu,
    fsync, a następnie os.replace() — bez tego crash w trakcie write()
    zostawiał uszkodzony settings.json (zer-bajtowy / niedopisany), co
    blokowało start gateway przy następnym uruchomieniu.
    """
    path = Path(CONFIG_PATH)
    try:
        path.parent.mkdir(parents=True, exist_ok=True)

        fd, tmp_path = tempfile.mkstemp(
            prefix=".settings.", suffix=".json.tmp", dir=str(path.parent)
        )
        try:
            with os.fdopen(fd, "w") as f:
                json.dump(settings.model_dump(), f, indent=4)
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp_path, path)
        except Exception:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
            raise

        print(f"Zapisano ustawienia do {path}")
    except PermissionError:
        print(f"BLAD KRYTYCZNY: Brak uprawnien do zapisu w {path}. Zmiany nie zostana utrwalone!")
    except Exception as e:
        print(f"Blad podczas zapisu ustawień: {e}")
