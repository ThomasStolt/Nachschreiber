# tests/test_session.py
from app.models import SessionData, Student
import uuid


def test_roundtrip(tmp_path, monkeypatch):
    import app.session as s
    s.DATA_PATH = tmp_path / "session.json"

    session = SessionData(students=[
        Student(id=str(uuid.uuid4()), last_name="Meier", first_name="Hans", class_name="10a")
    ])
    s.save(session)
    loaded = s.load()
    assert len(loaded.students) == 1
    assert loaded.students[0].last_name == "Meier"


def test_load_empty(tmp_path, monkeypatch):
    import app.session as s
    s.DATA_PATH = tmp_path / "session.json"
    result = s.load()
    assert result.students == []
    assert result.entries == []
