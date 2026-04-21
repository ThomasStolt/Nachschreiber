# backend/app/session.py
import os
from pathlib import Path
from .models import SessionData


def _data_path() -> Path:
    return Path(os.getenv("DATA_DIR", "/data")) / "session.json"


def load() -> SessionData:
    p = _data_path()
    if p.exists():
        try:
            return SessionData.model_validate_json(p.read_text(encoding="utf-8"))
        except Exception:
            return SessionData()
    return SessionData()


def save(session: SessionData) -> None:
    p = _data_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(".tmp")
    try:
        tmp.write_text(session.model_dump_json(indent=2), encoding="utf-8")
        tmp.replace(p)
    except Exception:
        tmp.unlink(missing_ok=True)
        raise
