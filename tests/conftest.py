# tests/conftest.py
import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    return TestClient(app)


SAMPLE_CSV = b"Nachname;Vorname;Klasse\nMueller;Anna;10a\nSchmidt;Max;9b\n"
