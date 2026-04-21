# tests/test_seating.py
import pytest
from app.seating import assign_room, compute_seating
from app.models import Student, Entry, SessionData
import uuid


def make_entry(room: str, subject: str = "Mathe", duration: int = 45) -> Entry:
    return Entry(
        id=str(uuid.uuid4()),
        student_id="s1",
        subject=subject,
        duration_minutes=duration,
        teacher="Fr. Test",
        room=room,  # type: ignore
    )


def make_student() -> Student:
    return Student(id="s1", last_name="Müller", first_name="Anna", class_name="10a")


class TestAssignRoom:
    def test_room_a_boundary(self):
        assert assign_room(1) == "A"
        assert assign_room(45) == "A"

    def test_room_b_boundary(self):
        assert assign_room(46) == "B"
        assert assign_room(59) == "B"

    def test_room_c_boundary(self):
        assert assign_room(60) == "C"
        assert assign_room(120) == "C"


class TestComputeSeating:
    def test_empty_session(self):
        plan = compute_seating(SessionData())
        assert plan.room_a.assignments == []
        assert plan.room_b.assignments == []
        assert plan.room_c.assignments == []

    def test_sequential_seats_same_desk(self):
        student = make_student()
        entries = [make_entry("A", "Mathe"), make_entry("A", "Deutsch")]
        session = SessionData(students=[student], entries=entries)
        plan = compute_seating(session)
        a = plan.room_a.assignments
        assert a[0].desk == 1 and a[0].seat == 1
        assert a[1].desk == 1 and a[1].seat == 2

    def test_sequential_seats_next_desk(self):
        student = make_student()
        entries = [make_entry("A", f"Fach{i}") for i in range(3)]
        session = SessionData(students=[student], entries=entries)
        plan = compute_seating(session)
        a = plan.room_a.assignments
        assert a[2].desk == 2 and a[2].seat == 1

    def test_room_capacity_label(self):
        plan = compute_seating(SessionData())
        assert plan.room_a.label == "≤ 45 min"
        assert plan.room_b.label == "46–59 min"
        assert plan.room_c.label == "≥ 60 min"

    def test_count_matches_entries(self):
        student = make_student()
        entries = [make_entry("A", f"F{i}") for i in range(5)]
        session = SessionData(students=[student], entries=entries)
        plan = compute_seating(session)
        assert len(plan.room_a.assignments) == 5
