# tests/test_api.py
SAMPLE_CSV = b"Nachname;Vorname;Klasse\nMueller;Anna;10a\nSchmidt;Max;9b\n"


def test_upload_csv(client):
    r = client.post("/api/upload", files={"file": ("students.csv", SAMPLE_CSV, "text/csv")})
    assert r.status_code == 200
    assert r.json()["students"] == 2


def test_upload_invalid_csv(client):
    # CSV with data rows but wrong column names
    r = client.post("/api/upload", files={"file": ("bad.csv", b"Name;Klasse\nMueller;10a\n", "text/csv")})
    assert r.status_code == 422
    assert "Erwartet: Nachname;Vorname;Klasse" in r.json()["detail"]
