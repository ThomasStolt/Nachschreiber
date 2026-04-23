# tests/test_seating.py
import pytest
from app.seating import assign_room, compute_seating
from app.models import Student, Entry, SessionData
import uuid


def make_entry(
    room: str,
    subject: str = "Mathe",
    duration: int = 45,
    desk: int = 1,
    seat: int = 1,
) -> Entry:
    return Entry(
        id=str(uuid.uuid4()),
        student_id="s1",
        subject=subject,
        duration_minutes=duration,
        teacher="Fr. Test",
        room=room,  # type: ignore
        desk=desk,
        seat=seat,
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

    def test_reads_stored_desk_seat(self):
        student = make_student()
        entries = [
            make_entry("A", "Mathe", desk=1, seat=1),
            make_entry("A", "Deutsch", desk=1, seat=2),
        ]
        session = SessionData(students=[student], entries=entries)
        plan = compute_seating(session)
        a = plan.room_a.assignments
        assert a[0].desk == 1 and a[0].seat == 1
        assert a[1].desk == 1 and a[1].seat == 2

    def test_reads_non_sequential_desk_seat(self):
        student = make_student()
        entries = [
            make_entry("A", "Mathe", desk=5, seat=2),
            make_entry("A", "Deutsch", desk=3, seat=1),
        ]
        session = SessionData(students=[student], entries=entries)
        plan = compute_seating(session)
        subjects = {a.entry.subject: (a.desk, a.seat) for a in plan.room_a.assignments}
        assert subjects["Mathe"] == (5, 2)
        assert subjects["Deutsch"] == (3, 1)

    def test_room_capacity_label(self):
        plan = compute_seating(SessionData())
        assert plan.room_a.label == "≤ 45 min"
        assert plan.room_b.label == "46–59 min"
        assert plan.room_c.label == "≥ 60 min"

    def test_count_matches_entries(self):
        student = make_student()
        entries = [make_entry("A", f"F{i}", desk=(i // 2) + 1, seat=(i % 2) + 1) for i in range(5)]
        session = SessionData(students=[student], entries=entries)
        plan = compute_seating(session)
        assert len(plan.room_a.assignments) == 5

    def test_entries_stay_in_correct_room(self):
        student = make_student()
        entry_a = make_entry("A", "Mathe", duration=45, desk=1, seat=1)
        entry_b = make_entry("B", "Deutsch", duration=50, desk=1, seat=1)
        entry_c = make_entry("C", "Physik", duration=90, desk=1, seat=1)
        session = SessionData(students=[student], entries=[entry_a, entry_b, entry_c])
        plan = compute_seating(session)
        assert len(plan.room_a.assignments) == 1
        assert len(plan.room_b.assignments) == 1
        assert len(plan.room_c.assignments) == 1
        assert plan.room_a.assignments[0].entry.subject == "Mathe"
