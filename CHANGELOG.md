# Changelog

Alle relevanten Änderungen an Nachschreiber werden in dieser Datei dokumentiert.

Das Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
die Versionierung folgt [Semantic Versioning](https://semver.org/lang/de/).

## [1.3.0] — 2026-04-23

### Hinzugefügt
- **Drag & Drop auf Raum-Tabs** — Schüler können per Drag & Drop direkt auf einen anderen Raum-Tab gezogen werden. Sie landen automatisch auf dem nächsten freien Platz im Zielraum, die aktive Ansicht wechselt mit.
- **Individuelle Raumnamen** — Raumbezeichnungen sind frei benennbar (z. B. „Bibliothek" statt „Raum A") und werden persistent gespeichert.
- **Versionsanzeige im Header** — Klick auf die Versionsnummer öffnet den Changelog.

### Geändert
- **Automatische Dauer-Anpassung** beim Verschieben in einen anderen Raum: Die Prüfungsdauer passt sich an die Kategorie des Zielraums an (A: 45 min, B: 50 min, C: 60 min).
- **Dauer-Eingabe** verwendet einen ±5 min Stepper statt der nativen Browser-Pfeile.

### UI-Politur
- Moderne Select-Chevrons, konsistente Focus-Rings, dünne Scrollbars.
- Mülleimer-Button mit neutralem Rahmen (passend zur Schere).

## [1.2.0] — 2026-04-22

### Hinzugefügt
- **Multi-Entry-Zwischenablage** — mehrere Schüler gleichzeitig ausschneiden und an Zielplätze ziehen.
- **Einzelnen Schüler löschen** — entfernt Stammdatensatz und alle zugehörigen Nachschreibe-Einträge (Kaskade).
- **Mülleimer-Button** direkt auf der Sitzkarte, neben der Schere.

### Geändert
- **Upload-Seite** im einheitlichen 3-Spalten-Layout mit editierbaren Fächer- und Lehrer-Listen.
- **Drag & Drop** für CSV-Upload-Boxen (Schüler, Lehrkräfte, Fächer).

### Behoben
- Custom Combobox für Fach/Lehrkraft öffnet das Dropdown auch bei bereits gefülltem Feld.
- Pointer-Down-Propagation an Schere-Buttons gestoppt, damit dnd-kit den Klick nicht abfängt.

## [1.1.0] — 2026-04-21

### Hinzugefügt
- **Lehrer- und Fächer-Upload** — optionale CSVs auf der Upload-Seite für Autocomplete im Formular.
- **API**: `GET /api/teachers`, `GET /api/subjects`, `POST /api/upload/teachers`, `POST /api/upload/subjects`.
- **Excel-Export als 2D-Sitzplan** (4×4 Tische, 32 Sitz-Zellen pro Raum) mit per-Zeilen-Typografie via CellRichText.
- **Print-Support** — Querformat, Schere-Button beim Druck ausgeblendet.

### Geändert
- `SessionData` um `teachers` und `subjects` erweitert.

## [1.0.0] — Initiales Release

### Hinzugefügt
- CSV-Import von Schülerstammdaten (`Nachname;Vorname;Klasse`).
- Live-Dashboard zum Eintragen von Nachschreibe-Einträgen.
- Automatische Raumzuweisung nach Prüfungsdauer (A ≤ 45 min, B 46–59 min, C ≥ 60 min).
- Sitzplatzvergabe 16 Tische × 2 Plätze (max. 32 Schüler pro Raum).
- Duplikatschutz (selber Schüler + selbes Fach).
- Export als Excel (.xlsx) und Word (.docx).
- Dark Mode.
- Deployment via Docker Compose auf Port 3002.
