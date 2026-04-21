# tests/conftest.py
import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    import app.session as session_module
    session_module.DATA_PATH = tmp_path / "session.json"
    from app.main import app
    return TestClient(app)


SAMPLE_CSV = b"Nachname;Vorname;Klasse\nMueller;Anna;10a\nSchmidt;Max;9b\n"
