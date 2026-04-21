# backend/app/routers/seating_router.py
from fastapi import APIRouter
from ..models import SeatingPlan
from ..session import load
from ..seating import compute_seating

router = APIRouter(prefix="/api", tags=["seating"])


@router.get("/seating")
def get_seating() -> SeatingPlan:
    return compute_seating(load())
