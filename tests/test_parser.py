# tests/test_parser.py
import pytest
from app.parser import parse_students


def test_parse_valid_csv():
    csv = b"Nachname;Vorname;Klasse\nMueller;Anna;10a\nSchmidt;Max;9b\n"
    students = parse_students(csv)
    assert len(students) == 2
    assert students[0].last_name == "Mueller"
    assert students[0].first_name == "Anna"
    assert students[0].class_name == "10a"
    assert students[1].last_name == "Schmidt"


def test_parse_bom_csv():
    # Excel on Windows adds UTF-8 BOM
    csv = b"\xef\xbb\xbfNachname;Vorname;Klasse\nMueller;Anna;10a\n"
    students = parse_students(csv)
    assert len(students) == 1


def test_parse_empty_raises():
    csv = b"Nachname;Vorname;Klasse\n"
    with pytest.raises(ValueError, match="keine Schüler"):
        parse_students(csv)


def test_parse_missing_column_raises():
    csv = b"Name;Klasse\nMueller;10a\n"
    with pytest.raises(ValueError, match="Erwartet: Nachname;Vorname;Klasse"):
        parse_students(csv)


def test_parse_strips_whitespace():
    csv = b"Nachname;Vorname;Klasse\n  Mueller ;  Anna ;  10a  \n"
    students = parse_students(csv)
    assert students[0].last_name == "Mueller"
    assert students[0].class_name == "10a"


from app.parser import parse_teachers, parse_subjects


# --- parse_teachers ---

def test_parse_teachers_valid():
    csv = b"Lehrkraft\nFr. Schmidt\nHr. Mueller\n"
    result = parse_teachers(csv)
    assert result == ["Fr. Schmidt", "Hr. Mueller"]


def test_parse_teachers_bom():
    csv = b"\xef\xbb\xbfLehrkraft\nFr. Schmidt\n"
    assert parse_teachers(csv) == ["Fr. Schmidt"]


def test_parse_teachers_trims_whitespace():
    csv = b"Lehrkraft\n  Fr. Schmidt  \n"
    assert parse_teachers(csv) == ["Fr. Schmidt"]


def test_parse_teachers_dedupes_preserving_order():
    csv = b"Lehrkraft\nFr. Schmidt\nHr. Mueller\nFr. Schmidt\n"
    assert parse_teachers(csv) == ["Fr. Schmidt", "Hr. Mueller"]


def test_parse_teachers_skips_blank_lines():
    csv = b"Lehrkraft\nFr. Schmidt\n\n   \nHr. Mueller\n"
    assert parse_teachers(csv) == ["Fr. Schmidt", "Hr. Mueller"]


def test_parse_teachers_empty_raises():
    with pytest.raises(ValueError, match="keine Lehrkräfte"):
        parse_teachers(b"Lehrkraft\n")


def test_parse_teachers_wrong_header_raises():
    with pytest.raises(ValueError, match="Erwartet: Lehrkraft"):
        parse_teachers(b"Name\nFr. Schmidt\n")


def test_parse_teachers_header_case_insensitive():
    csv = b"lehrkraft\nFr. Schmidt\n"
    assert parse_teachers(csv) == ["Fr. Schmidt"]


# --- parse_subjects ---

def test_parse_subjects_valid():
    csv = b"Fach\nMathematik\nDeutsch\n"
    assert parse_subjects(csv) == ["Mathematik", "Deutsch"]


def test_parse_subjects_bom():
    csv = b"\xef\xbb\xbfFach\nMathematik\n"
    assert parse_subjects(csv) == ["Mathematik"]


def test_parse_subjects_trims_and_dedupes():
    csv = b"Fach\n  Mathematik  \nDeutsch\nMathematik\n"
    assert parse_subjects(csv) == ["Mathematik", "Deutsch"]


def test_parse_subjects_empty_raises():
    with pytest.raises(ValueError, match="keine Fächer"):
        parse_subjects(b"Fach\n")


def test_parse_subjects_wrong_header_raises():
    with pytest.raises(ValueError, match="Erwartet: Fach"):
        parse_subjects(b"Subject\nMath\n")
