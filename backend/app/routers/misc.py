# backend/app/routers/misc.py
from fastapi import APIRouter
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
