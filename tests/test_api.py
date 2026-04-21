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


# helper — upload sample CSV and return first student's id
def _upload(client):
    client.post("/api/upload", files={"file": ("s.csv", SAMPLE_CSV, "text/csv")})
    students = client.get("/api/students").json()
    return students[0]["id"]


def test_create_entry(client):
    sid = _upload(client)
    r = client.post("/api/entries", json={
        "student_id": sid,
        "subject": "Mathematik",
        "duration_minutes": 45,
        "aids": "Taschenrechner",
        "teacher": "Fr. Schmidt",
    })
    assert r.status_code == 201
    data = r.json()
    assert data["room"] == "A"
    assert data["subject"] == "Mathematik"


def test_duplicate_entry_rejected(client):
    sid = _upload(client)
    payload = {"student_id": sid, "subject": "Mathe", "duration_minutes": 45, "teacher": "T"}
    client.post("/api/entries", json=payload)
    r = client.post("/api/entries", json=payload)
    assert r.status_code == 409


def test_different_subject_same_student_allowed(client):
    sid = _upload(client)
    client.post("/api/entries", json={"student_id": sid, "subject": "Mathe", "duration_minutes": 45, "teacher": "T"})
    r = client.post("/api/entries", json={"student_id": sid, "subject": "Deutsch", "duration_minutes": 30, "teacher": "T"})
    assert r.status_code == 201


def test_delete_entry(client):
    sid = _upload(client)
    r = client.post("/api/entries", json={"student_id": sid, "subject": "Bio", "duration_minutes": 90, "teacher": "T"})
    eid = r.json()["id"]
    r2 = client.delete(f"/api/entries/{eid}")
    assert r2.status_code == 204
    entries = client.get("/api/entries").json()
    assert all(e["id"] != eid for e in entries)


def test_room_c_for_60_minutes(client):
    sid = _upload(client)
    r = client.post("/api/entries", json={"student_id": sid, "subject": "Physik", "duration_minutes": 60, "teacher": "T"})
    assert r.json()["room"] == "C"


def test_room_b_for_59_minutes(client):
    sid = _upload(client)
    r = client.post("/api/entries", json={"student_id": sid, "subject": "Chemie", "duration_minutes": 59, "teacher": "T"})
    assert r.json()["room"] == "B"


def test_get_classes(client):
    client.post("/api/upload", files={"file": ("s.csv", SAMPLE_CSV, "text/csv")})
    r = client.get("/api/classes")
    assert r.status_code == 200
    assert "10a" in r.json()
    assert "9b" in r.json()


def test_get_students_filtered(client):
    client.post("/api/upload", files={"file": ("s.csv", SAMPLE_CSV, "text/csv")})
    r = client.get("/api/students?class_name=10a")
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["class_name"] == "10a"


def test_seating_plan(client):
    sid = _upload(client)
    client.post("/api/entries", json={"student_id": sid, "subject": "Mathe", "duration_minutes": 45, "teacher": "T"})
    r = client.get("/api/seating")
    assert r.status_code == 200
    plan = r.json()
    assert len(plan["room_a"]["assignments"]) == 1
    assert plan["room_a"]["assignments"][0]["desk"] == 1
    assert plan["room_a"]["assignments"][0]["seat"] == 1


def test_reset(client):
    sid = _upload(client)
    client.post("/api/entries", json={"student_id": sid, "subject": "Mathe", "duration_minutes": 45, "teacher": "T"})
    r = client.post("/api/reset")
    assert r.status_code == 200
    assert client.get("/api/entries").json() == []
    assert len(client.get("/api/students").json()) == 2
