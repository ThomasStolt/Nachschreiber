# backend/app/seating.py
from typing import Literal
from .models import SessionData, RoomPlan, SeatAssignment, SeatingPlan, Entry, Student


def assign_room(duration_minutes: int) -> Literal["A", "B", "C"]:
    if duration_minutes <= 45:
        return "A"
    elif duration_minutes <= 59:
        return "B"
    else:
        return "C"


def _build_room_plan(
    room: Literal["A", "B", "C"],
    label: str,
    entries: list[Entry],
    students_map: dict[str, Student],
) -> RoomPlan:
    room_entries = [e for e in entries if e.room == room]
    assignments = [
        SeatAssignment(
            desk=(i // 2) + 1,
            seat=(i % 2) + 1,
            entry=entry,
            student=students_map[entry.student_id],
        )
        for i, entry in enumerate(room_entries)
    ]
    return RoomPlan(room=room, label=label, assignments=assignments)


def compute_seating(session: SessionData) -> SeatingPlan:
    students_map = {s.id: s for s in session.students}
    return SeatingPlan(
        room_a=_build_room_plan("A", "≤ 45 min", session.entries, students_map),
        room_b=_build_room_plan("B", "46–59 min", session.entries, students_map),
        room_c=_build_room_plan("C", "≥ 60 min", session.entries, students_map),
    )
