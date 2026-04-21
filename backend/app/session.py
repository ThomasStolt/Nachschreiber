# backend/app/session.py
import os
from pathlib import Path
from .models import SessionData

DATA_PATH = Path(os.getenv("DATA_DIR", "/data")) / "session.json"


def load() -> SessionData:
    if DATA_PATH.exists():
        return SessionData.model_validate_json(DATA_PATH.read_text())
    return SessionData()


def save(session: SessionData) -> None:
    DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = DATA_PATH.with_suffix(".tmp")
    tmp.write_text(session.model_dump_json(indent=2))
    tmp.replace(DATA_PATH)
