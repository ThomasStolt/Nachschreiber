# backend/app/session.py
import json
import os
from pathlib import Path
from .models import SessionData


def _data_path() -> Path:
    return Path(os.getenv("DATA_DIR", "/data")) / "session.json"


def _migrate(raw: dict) -> dict:
    """Assign desk/seat to legacy entries that lack them."""
    entries = raw.get("entries", [])
    occupied: dict[str, set] = {"A": set(), "B": set(), "C": set()}
    for e in entries:
        if e.get("desk") and e.get("seat"):
            occupied[e.get("room", "A")].add((e["desk"], e["seat"]))
    for e in entries:
        if not e.get("desk") or not e.get("seat"):
            room = e.get("room", "A")
            for i in range(32):
                d, s = (i // 2) + 1, (i % 2) + 1
                if (d, s) not in occupied[room]:
                    e["desk"], e["seat"] = d, s
                    occupied[room].add((d, s))
                    break
    raw["entries"] = entries
    return raw


def load() -> SessionData:
    p = _data_path()
    if not p.exists():
        return SessionData()
    try:
        raw = json.loads(p.read_text(encoding="utf-8"))
        return SessionData.model_validate(_migrate(raw))
    except Exception:
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
