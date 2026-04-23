# tests/test_session.py
import uuid
from app.models import SessionData, Student
from app.session import load, save


def test_roundtrip(tmp_path, monkeypatch):
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    session = SessionData(students=[
        Student(id=str(uuid.uuid4()), last_name="Meier", first_name="Hans", class_name="10a")
    ])
    save(session)
    loaded = load()
    assert len(loaded.students) == 1
    assert loaded.students[0].last_name == "Meier"


def test_load_empty(tmp_path, monkeypatch):
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    result = load()
    assert result.students == []
    assert result.entries == []


# --- Migration tests ---
import json

def test_migrate_assigns_desk_seat_to_legacy_entries(tmp_path, monkeypatch):
    """Legacy entries without desk/seat get sequential assignment."""
    import app.session as s
    s_path = tmp_path / "session.json"
    # Write a legacy session file (entries without desk/seat)
    legacy = {
        "students": [],
        "entries": [
            {"id": "e1", "student_id": "s1", "subject": "Mathe", "duration_minutes": 45,
             "aids": "", "teacher": "T", "room": "A"},
            {"id": "e2", "student_id": "s2", "subject": "Deutsch", "duration_minutes": 30,
             "aids": "", "teacher": "T", "room": "A"},
        ]
    }
    s_path.write_text(json.dumps(legacy), encoding="utf-8")
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    session = s.load()
    desks = {e.id: (e.desk, e.seat) for e in session.entries}
    assert desks["e1"] == (1, 1)
    assert desks["e2"] == (1, 2)


def test_migrate_does_not_reassign_existing_seats(tmp_path, monkeypatch):
    """Entries that already have desk/seat are not changed."""
    import app.session as s
    s_path = tmp_path / "session.json"
    data = {
        "students": [],
        "entries": [
            {"id": "e1", "student_id": "s1", "subject": "Mathe", "duration_minutes": 45,
             "aids": "", "teacher": "T", "room": "A", "desk": 5, "seat": 2},
        ]
    }
    s_path.write_text(json.dumps(data), encoding="utf-8")
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    session = s.load()
    assert session.entries[0].desk == 5
    assert session.entries[0].seat == 2


def test_migrate_mixed_entries_no_collision(tmp_path, monkeypatch):
    """Mix of legacy and pre-assigned entries: legacy gets non-colliding slot."""
    import app.session as s
    s_path = tmp_path / "session.json"
    data = {
        "students": [],
        "entries": [
            # Pre-assigned to (1,1)
            {"id": "e1", "student_id": "s1", "subject": "Mathe", "duration_minutes": 45,
             "aids": "", "teacher": "T", "room": "A", "desk": 1, "seat": 1},
            # Legacy — should get (1,2) since (1,1) is taken
            {"id": "e2", "student_id": "s2", "subject": "Deutsch", "duration_minutes": 30,
             "aids": "", "teacher": "T", "room": "A"},
        ]
    }
    s_path.write_text(json.dumps(data), encoding="utf-8")
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    session = s.load()
    desks = {e.id: (e.desk, e.seat) for e in session.entries}
    assert desks["e1"] == (1, 1)
    assert desks["e2"] == (1, 2)
