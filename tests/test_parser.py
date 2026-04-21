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
