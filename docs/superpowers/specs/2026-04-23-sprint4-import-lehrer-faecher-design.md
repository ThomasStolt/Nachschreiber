# Sprint 4 — Import Lehrkräfte + Fächer

## Ziel

Beim Anlegen eines Nachschreibers werden die Felder **Fach** und **Lehrkraft** aktuell als Freitext eingetippt — fehleranfällig (Tippfehler, inkonsistente Schreibweisen) und mühsam. Gewünscht sind **CSV-Importe** für Lehrer- und Fächerlisten plus **Dropdown-Vorschläge mit Freitext-Fallback** im Formular.

## Scope

- CSV-Upload für Lehrkräfte (getrennt vom Schüler-Upload)
- CSV-Upload für Fächer (getrennt)
- Persistenz der beiden Listen in `SessionData`
- Frontend: zwei zusätzliche Upload-Buttons auf der UploadPage
- Frontend: Datalist-basierte Autocomplete für Fach und Lehrkraft im StudentForm
- Upload-Reset-Verhalten: Überschreibt nur die jeweilige Liste, löscht nichts anderes

## CSV-Formate

Beide Dateien: UTF-8 (mit oder ohne BOM), eine Spalte, Header-Zeile erforderlich, eine Zeile pro Eintrag.

**`lehrer.csv`:**
```
Lehrkraft
Fr. Schmidt
Hr. Müller
Fr. Dr. Weber
Hr. Becker
```

**`faecher.csv`:**
```
Fach
Mathematik
Deutsch
Englisch
Biologie
```

### Parser-Regeln

- Header muss exakt `Lehrkraft` bzw. `Fach` sein (case-insensitive). Andere Header → HTTP 422 "Ungültiger Header, erwartet: ..."
- Leere Zeilen werden ignoriert
- Whitespace wird getrimmt
- Duplikate (nach Trim) werden dedupliziert, Reihenfolge bleibt (erstes Vorkommen gewinnt)
- Mindestens ein Wert erforderlich → leere Listen führen zu HTTP 422
- Parser liegen in `backend/app/parser.py` neben dem bestehenden `parse_students`: `parse_teachers`, `parse_subjects`. Beide geben `list[str]` zurück.

## Backend

### Models (`backend/app/models.py`)

`SessionData` bekommt zwei Listen:

```python
class SessionData(BaseModel):
    students: list[Student] = []
    entries: list[Entry] = []
    teachers: list[str] = []     # NEU
    subjects: list[str] = []     # NEU
```

Bestehende Sessions ohne diese Felder laden weiterhin korrekt (Defaults greifen über Pydantic).

### Session-Migration

Keine explizite Migration nötig — Pydantic-Defaults füllen die Felder bei Load. `session.py::_migrate` bleibt wie gehabt (betrifft nur Entry-desk/seat).

### Neue Endpoints (`backend/app/routers/upload.py`)

- `POST /api/upload/teachers` — `UploadFile` CSV; parsed via `parse_teachers`; setzt `session.teachers = parsed` und persistiert. Response: `{"teachers": <count>}`. Entries und Students bleiben unverändert.
- `POST /api/upload/subjects` — analog: `{"subjects": <count>}`.
- Bestehender `POST /api/upload` bleibt wie gehabt (Schüler-Upload resettet Entries).

### Neue Endpoints (`backend/app/routers/misc.py`)

- `GET /api/teachers` → `list[str]`
- `GET /api/subjects` → `list[str]`

Beide geben die aktuellen Listen aus der Session zurück (ggf. leer).

### Fehlerbehandlung

- Ungültiger Header → 422 mit beschreibender Fehlermeldung
- Leere Datei / nur Header → 422 "Keine Einträge gefunden"
- Parse-Fehler (z.B. binäre Daten) → 422 mit generischer Meldung

## Frontend

### `api.ts`

Neue Methoden:

```typescript
uploadTeachers(file: File): Promise<{ teachers: number }>
uploadSubjects(file: File): Promise<{ subjects: number }>
getTeachers(): Promise<string[]>
getSubjects(): Promise<string[]>
```

### UploadPage (`frontend/src/pages/UploadPage.tsx`)

Zwei zusätzliche Upload-Sektionen unter dem Schüler-Upload:

- Titel z.B. "Lehrkräfte-Liste importieren (optional)"
- File-Picker + Submit-Button
- Success-Feedback ("12 Lehrkräfte importiert")
- Beide Sektionen funktionieren unabhängig vom Schüler-Upload — der Button leitet NICHT automatisch zum Dashboard weiter (der User lädt ggf. beide Dateien nacheinander hoch)
- Nach Klick auf "Weiter zum Dashboard" (bestehender Button) geht es wie bisher zum Dashboard

### StudentForm (`frontend/src/components/StudentForm.tsx`)

Zustand-Erweiterung:

```typescript
const [teachers, setTeachers] = useState<string[]>([]);
const [subjects, setSubjects] = useState<string[]>([]);

useEffect(() => {
  api.getTeachers().then(setTeachers);
  api.getSubjects().then(setSubjects);
}, []);
```

Die Inputs für "Fach" und "Verantw. Lehrkraft" werden mit HTML-`<datalist>` verknüpft:

```tsx
<input list="subject-list" value={form.subject} ... />
<datalist id="subject-list">
  {subjects.map(s => <option key={s} value={s} />)}
</datalist>
```

**Verhalten:**
- Wenn die jeweilige Liste leer ist: Input verhält sich wie bisher (reiner Freitext)
- Wenn die Liste Einträge hat: Browser zeigt Dropdown mit Vorschlägen beim Fokussieren/Tippen
- Freie Eingabe bleibt jederzeit möglich (z.B. "Vertretung Fr. X")

### DashboardPage

Keine Änderung.

## Tests

### `tests/test_parser.py` (neu oder erweitert)

- `parse_teachers`: happy path, Header-Validierung, Trim, Dedupe, Whitespace-Zeilen, BOM, leere Datei → Fehler
- `parse_subjects`: analoge Suite

### `tests/test_upload.py` (erweitert)

- `POST /api/upload/teachers` mit gültiger CSV → 200, `session.teachers` gesetzt
- `POST /api/upload/teachers` mit ungültigem Header → 422
- `POST /api/upload/teachers` resettet NICHT `students` oder `entries`
- Analog für `POST /api/upload/subjects`

### `tests/test_misc.py` (oder neu)

- `GET /api/teachers` liefert die aktuelle Liste
- `GET /api/subjects` liefert die aktuelle Liste

## Edge Cases

- **Sehr lange Listen (>500 Einträge):** kein Problem für Datalist — Browser handhabt das nativ
- **Sonderzeichen im Namen (Dr., ., äöü):** keine spezielle Behandlung, landet 1:1 in der Liste
- **Upload überschreibt bestehende Liste:** bewusst — so kann der User bei Änderungen eine neue Datei hochladen
- **Leere Datei → 422** (keine stille Leerliste)
- **User tippt Lehrkraft, die nicht in der Liste ist:** wird trotzdem akzeptiert und im Entry gespeichert — keine Validierung gegen die Liste im Entry-Create

## Beispieldateien

Ich lege zwei Beispiel-CSVs ins Repo-Root (`beispiel_lehrer.csv`, `beispiel_faecher.csv`), analog zur bestehenden `beispiel_schueler.csv`.

## Out of Scope

- Lehrer-Kürzel / Lehrer-Fach-Zuordnung
- Verwaltung der Listen über die UI (nur per Re-Upload)
- Strenge Validierung (Entry-Create gegen Whitelist)
- Löschen einzelner Einträge aus den Listen
- Kombination mit Schüler-CSV in einer Datei
- Multi-Fächer pro Lehrer
