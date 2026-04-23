# backend/app/routers/misc.py
from fastapi import APIRouter
from ..models import RoomLabels
from ..session import load, save

router = APIRouter(prefix="/api", tags=["misc"])


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}


@router.post("/reset")
def reset() -> dict:
    session = load()
    session.entries = []
    save(session)
    return {"entries": 0}


@router.get("/teachers")
def get_teachers() -> list[str]:
    return load().teachers


@router.get("/subjects")
def get_subjects() -> list[str]:
    return load().subjects


def _clean_list(items: list[str]) -> list[str]:
    clean: list[str] = []
    seen: set[str] = set()
    for v in items:
        s = (v or "").strip()
        if not s or s in seen:
            continue
        seen.add(s)
        clean.append(s)
    return clean


@router.put("/teachers")
def put_teachers(teachers: list[str]) -> list[str]:
    session = load()
    session.teachers = _clean_list(teachers)
    save(session)
    return session.teachers


@router.put("/subjects")
def put_subjects(subjects: list[str]) -> list[str]:
    session = load()
    session.subjects = _clean_list(subjects)
    save(session)
    return session.subjects


@router.get("/room-labels")
def get_room_labels() -> RoomLabels:
    return load().room_labels


@router.put("/room-labels")
def put_room_labels(labels: RoomLabels) -> RoomLabels:
    session = load()
    # Collapse empty / whitespace-only values back to the default name
    defaults = RoomLabels()
    cleaned = RoomLabels(
        A=(labels.A.strip() or defaults.A),
        B=(labels.B.strip() or defaults.B),
        C=(labels.C.strip() or defaults.C),
    )
    session.room_labels = cleaned
    save(session)
    return cleaned
