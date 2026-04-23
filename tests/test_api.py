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


# --- Seat move tests ---

def test_create_entry_stores_desk_seat(client):
    sid = _upload(client)
    r = client.post("/api/entries", json={"student_id": sid, "subject": "Mathe", "duration_minutes": 45, "teacher": "T"})
    assert r.status_code == 201
    data = r.json()
    assert data["desk"] == 1
    assert data["seat"] == 1


def test_second_entry_gets_next_seat(client):
    sid = _upload(client)
    students = client.get("/api/students").json()
    sid2 = students[1]["id"]
    client.post("/api/entries", json={"student_id": sid, "subject": "Mathe", "duration_minutes": 45, "teacher": "T"})
    r = client.post("/api/entries", json={"student_id": sid2, "subject": "Deutsch", "duration_minutes": 30, "teacher": "T"})
    assert r.json()["desk"] == 1
    assert r.json()["seat"] == 2


def test_move_entry_to_free_seat(client):
    sid = _upload(client)
    r = client.post("/api/entries", json={"student_id": sid, "subject": "Mathe", "duration_minutes": 45, "teacher": "T"})
    eid = r.json()["id"]
    r2 = client.patch(f"/api/entries/{eid}/seat", json={"desk": 5, "seat": 2, "room": "A"})
    assert r2.status_code == 200
    updated = r2.json()
    assert len(updated) == 1
    assert updated[0]["desk"] == 5
    assert updated[0]["seat"] == 2
    assert updated[0]["room"] == "A"


def test_swap_entries_within_room(client):
    sid = _upload(client)
    students = client.get("/api/students").json()
    sid2 = students[1]["id"]
    r1 = client.post("/api/entries", json={"student_id": sid, "subject": "Mathe", "duration_minutes": 45, "teacher": "T"})
    r2 = client.post("/api/entries", json={"student_id": sid2, "subject": "Deutsch", "duration_minutes": 30, "teacher": "T"})
    eid1, eid2 = r1.json()["id"], r2.json()["id"]
    # Move entry1 to entry2's seat → swap
    r = client.patch(f"/api/entries/{eid1}/seat", json={"desk": 1, "seat": 2, "room": "A"})
    assert r.status_code == 200
    updated = {e["id"]: e for e in r.json()}
    assert updated[eid1]["desk"] == 1 and updated[eid1]["seat"] == 2
    assert updated[eid2]["desk"] == 1 and updated[eid2]["seat"] == 1


def test_cross_room_move_to_free_seat(client):
    sid = _upload(client)
    r = client.post("/api/entries", json={"student_id": sid, "subject": "Mathe", "duration_minutes": 45, "teacher": "T"})
    eid = r.json()["id"]
    r2 = client.patch(f"/api/entries/{eid}/seat", json={"desk": 3, "seat": 1, "room": "C"})
    assert r2.status_code == 200
    assert r2.json()[0]["room"] == "C"
    assert r2.json()[0]["desk"] == 3


def test_cross_room_move_to_occupied_seat_rejected(client):
    sid = _upload(client)
    students = client.get("/api/students").json()
    sid2 = students[1]["id"]
    r1 = client.post("/api/entries", json={"student_id": sid, "subject": "Mathe", "duration_minutes": 45, "teacher": "T"})
    # Put sid2 in Room C desk 1 seat 1
    client.post("/api/entries", json={"student_id": sid2, "subject": "Bio", "duration_minutes": 90, "teacher": "T"})
    eid1 = r1.json()["id"]
    # Try to move room-A entry to room-C desk 1 seat 1 which is occupied
    r = client.patch(f"/api/entries/{eid1}/seat", json={"desk": 1, "seat": 1, "room": "C"})
    assert r.status_code == 409


TEACHERS_CSV = b"Lehrkraft\nFr. Schmidt\nHr. Mueller\n"
SUBJECTS_CSV = b"Fach\nMathematik\nDeutsch\n"


def test_upload_teachers(client):
    r = client.post("/api/upload/teachers", files={"file": ("l.csv", TEACHERS_CSV, "text/csv")})
    assert r.status_code == 200
    assert r.json()["teachers"] == 2


def test_upload_teachers_invalid_header(client):
    r = client.post("/api/upload/teachers", files={"file": ("l.csv", b"Name\nFoo\n", "text/csv")})
    assert r.status_code == 422
    assert "Erwartet: Lehrkraft" in r.json()["detail"]


def test_upload_subjects(client):
    r = client.post("/api/upload/subjects", files={"file": ("f.csv", SUBJECTS_CSV, "text/csv")})
    assert r.status_code == 200
    assert r.json()["subjects"] == 2


def test_upload_subjects_invalid_header(client):
    r = client.post("/api/upload/subjects", files={"file": ("f.csv", b"Subject\nMath\n", "text/csv")})
    assert r.status_code == 422


def test_get_teachers_empty(client):
    assert client.get("/api/teachers").json() == []


def test_get_subjects_empty(client):
    assert client.get("/api/subjects").json() == []


def test_get_teachers_after_upload(client):
    client.post("/api/upload/teachers", files={"file": ("l.csv", TEACHERS_CSV, "text/csv")})
    assert client.get("/api/teachers").json() == ["Fr. Schmidt", "Hr. Mueller"]


def test_get_subjects_after_upload(client):
    client.post("/api/upload/subjects", files={"file": ("f.csv", SUBJECTS_CSV, "text/csv")})
    assert client.get("/api/subjects").json() == ["Mathematik", "Deutsch"]


def test_upload_teachers_does_not_reset_students_or_entries(client):
    sid = _upload(client)
    client.post("/api/entries", json={"student_id": sid, "subject": "Mathe", "duration_minutes": 45, "teacher": "T"})
    client.post("/api/upload/teachers", files={"file": ("l.csv", TEACHERS_CSV, "text/csv")})
    assert len(client.get("/api/students").json()) == 2
    assert len(client.get("/api/entries").json()) == 1


def test_upload_subjects_does_not_reset_students_or_entries(client):
    sid = _upload(client)
    client.post("/api/entries", json={"student_id": sid, "subject": "Mathe", "duration_minutes": 45, "teacher": "T"})
    client.post("/api/upload/subjects", files={"file": ("f.csv", SUBJECTS_CSV, "text/csv")})
    assert len(client.get("/api/students").json()) == 2
    assert len(client.get("/api/entries").json()) == 1


def test_upload_teachers_overwrites_previous(client):
    client.post("/api/upload/teachers", files={"file": ("l.csv", TEACHERS_CSV, "text/csv")})
    newer = b"Lehrkraft\nFr. Weber\n"
    client.post("/api/upload/teachers", files={"file": ("l.csv", newer, "text/csv")})
    assert client.get("/api/teachers").json() == ["Fr. Weber"]


# --- PUT endpoints for inline editing ---

def test_put_teachers_replaces_list(client):
    r = client.put("/api/teachers", json=["Fr. A", "Hr. B"])
    assert r.status_code == 200
    assert r.json() == ["Fr. A", "Hr. B"]
    assert client.get("/api/teachers").json() == ["Fr. A", "Hr. B"]


def test_put_teachers_trims_and_dedupes(client):
    r = client.put("/api/teachers", json=["  Fr. A  ", "Fr. A", "Hr. B"])
    assert r.status_code == 200
    assert r.json() == ["Fr. A", "Hr. B"]


def test_put_teachers_skips_empty_entries(client):
    r = client.put("/api/teachers", json=["Fr. A", "", "   ", "Hr. B"])
    assert r.status_code == 200
    assert r.json() == ["Fr. A", "Hr. B"]


def test_put_teachers_empty_list_clears(client):
    client.put("/api/teachers", json=["Fr. A"])
    r = client.put("/api/teachers", json=[])
    assert r.status_code == 200
    assert client.get("/api/teachers").json() == []


def test_put_teachers_does_not_reset_students_or_entries(client):
    sid = _upload(client)
    client.post("/api/entries", json={"student_id": sid, "subject": "M", "duration_minutes": 45, "teacher": "T"})
    client.put("/api/teachers", json=["Fr. A"])
    assert len(client.get("/api/students").json()) == 2
    assert len(client.get("/api/entries").json()) == 1


def test_put_subjects_replaces_list(client):
    r = client.put("/api/subjects", json=["Mathe", "Deutsch"])
    assert r.status_code == 200
    assert r.json() == ["Mathe", "Deutsch"]


def test_put_subjects_trims_and_dedupes(client):
    r = client.put("/api/subjects", json=["  Mathe  ", "Mathe", "Deutsch"])
    assert r.status_code == 200
    assert r.json() == ["Mathe", "Deutsch"]


def test_put_subjects_empty_list_clears(client):
    client.put("/api/subjects", json=["Mathe"])
    r = client.put("/api/subjects", json=[])
    assert r.status_code == 200
    assert client.get("/api/subjects").json() == []


def test_put_subjects_does_not_reset_students_or_entries(client):
    sid = _upload(client)
    client.post("/api/entries", json={"student_id": sid, "subject": "M", "duration_minutes": 45, "teacher": "T"})
    client.put("/api/subjects", json=["Mathe"])
    assert len(client.get("/api/students").json()) == 2
    assert len(client.get("/api/entries").json()) == 1
