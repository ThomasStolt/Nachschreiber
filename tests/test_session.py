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
