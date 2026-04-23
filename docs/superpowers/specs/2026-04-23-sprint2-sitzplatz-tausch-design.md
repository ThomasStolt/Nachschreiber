# Sprint 2 — Sitzplatz-Tausch
_Erstellt: 2026-04-23_

## Überblick

Lehrkräfte können Schüler innerhalb eines Raumes per Drag & Drop umsetzen und mit einem Schere-Icon (✂️) in die Zwischenablage legen, um sie in einen beliebigen anderen Raum zu verschieben. Die Dauer bleibt bei einem Raumwechsel unverändert — die Lehrkraft überschreibt die automatische Raumzuweisung bewusst.

---

## Feature 1 — Drag & Drop (innerhalb eines Raumes)

- Jede belegte Sitzplatz-Karte (`DeskCard`) ist drag-fähig via `dnd-kit`
- Drop-Ziele: alle anderen Plätze im gleichen Raum
- **Belegter Zielplatz** → Tausch der `desk`/`seat`-Werte beider Entries
- **Freier Zielplatz** → Entry erhält die `desk`/`seat` des Zielplatzes
- Kein Drag zwischen Räumen möglich (nur Schere dafür)

## Feature 2 — Schere / Zwischenablage (beliebiger Raum)

### Scissors-Icon
Jeder belegte Sitzplatz zeigt ein ✂️-Icon (oben rechts in der Karte). Klick darauf:
- Entry wird in den `clipboardEntry`-State (in `DashboardPage`) gelegt
- Original-Platz wird amber-gestrichelt markiert ("✂️ leer")
- Amber-Leiste erscheint oben im rechten Panel: "📋 Zwischenablage: [Name] · [Klasse] · [Fach] · (war: Raum X, Tisch Y)" + "✕ Abbrechen"-Button

### Clipboard-Leiste
- Persistent beim Raumwechsel (State in `DashboardPage`, nicht in `SeatingGrid`)
- "✕ Abbrechen" setzt `clipboardEntry = null`, Entry kehrt zum ursprünglichen Platz zurück (kein API-Call nötig — der Entry wurde noch nicht verändert)

### Einsetzen (Paste)
Wenn Clipboard aktiv: alle Plätze in allen Räumen sind als Paste-Ziel markiert (amber-gestrichelt).

- **Klick auf leeren Platz** → Entry erhält neuen `room`, `desk`, `seat` (API: `PATCH /api/entries/{id}/seat`)
- **Klick auf belegten Platz (gleicher Raum)** → Tausch
- **Klick auf belegten Platz (anderer Raum)** → nicht erlaubt; Plätze in anderen Räumen sind als Paste-Ziel nur dann markiert wenn sie leer sind; belegte Plätze in anderen Räumen erhalten keine Paste-Markierung und sind nicht klickbar

---

## Backend-Änderungen

### `Entry` Modell (models.py)

Neue Felder:
```python
desk: int = Field(ge=1, le=16)
seat: int = Field(ge=1, le=2)
```

**Migration:** `deck`/`seat` sind in `Entry` required (`Field(ge=1, le=16)`). `load()` in `session.py` liest die JSON-Datei zunächst als rohen Dict und befüllt fehlende `desk`/`seat`-Werte sequential (pro Raum getrennt) bevor `SessionData.model_validate()` aufgerufen wird. Damit ist Rückwärtskompatibilität mit bestehenden Sessions garantiert.

### Sitzplan-Berechnung (seating.py)

`_build_room_plan` berechnet `desk`/`seat` nicht mehr dynamisch — es liest die gespeicherten Werte direkt aus jedem `Entry`. `SeatAssignment.desk` und `.seat` kommen jetzt aus `entry.desk` / `entry.seat`.

### Entries API (entries.py)

`create_entry`: berechnet den nächsten freien Platz im Raum sequential (wie bisher) und speichert `desk` und `seat` direkt im neuen `Entry`.

### Neuer Endpoint

```
PATCH /api/entries/{id}/seat
Body: { desk: int, seat: int, room: "A" | "B" | "C" }
Response: { updated: list[Entry] }  — alle geänderten Entries (1 oder 2 bei Tausch)
```

Logik:
1. Entry mit `id` laden
2. Zielplatz (`room`, `desk`, `seat`) auf Konflikte prüfen
3. Wenn Ziel belegt UND gleicher Raum → Tausch (beide Entries aktualisieren)
4. Wenn Ziel belegt UND anderer Raum → HTTP 409 ("Platz bereits belegt")
5. Wenn Ziel frei → Entry updaten (`room`, `desk`, `seat`)
6. Speichern, geänderte Entries zurückgeben

### Tests

- `test_api.py`: PATCH seat — move to free seat, swap within room, cross-room move to free seat, cross-room move to occupied seat (409)
- `test_seating.py`: `_build_room_plan` liest gespeicherte desk/seat korrekt

---

## Frontend-Änderungen

### Neue Dependencies
```
@dnd-kit/core
@dnd-kit/utilities
```

### State in `DashboardPage`
```typescript
const [clipboardEntry, setClipboardEntry] = useState<SeatAssignment | null>(null);
```

Wird an `SeatingGrid` weitergegeben. Persistiert beim Raumwechsel.

### `SeatingGrid` Props (neue)
```typescript
clipboardEntry: SeatAssignment | null;
onScissors: (assignment: SeatAssignment) => void;
onPaste: (targetDesk: number, targetSeat: number) => void;
onDrop: (sourceEntryId: string, targetDesk: number, targetSeat: number) => void;
```

### `DeskCard` — Änderungen
- Wrap in `dnd-kit` Draggable (nur wenn kein Clipboard aktiv)
- ✂️-Icon (oben rechts, sichtbar bei Hover oder immer) → ruft `onScissors` auf
- Wenn Clipboard aktiv: Paste-Highlight (amber Rand + 📋-Icon)

### Clipboard-Leiste
Neue Komponente `ClipboardStrip` zwischen Raumtabs und Grid:
```tsx
{clipboardEntry && (
  <div className="clipboard-strip">
    📋 {name} · {class} · {subject} (war: Raum {room}, Tisch {desk})
    <button onClick={() => setClipboardEntry(null)}>✕ Abbrechen</button>
  </div>
)}
```

---

## Nicht im Scope

- Mehr als einen Schüler gleichzeitig in die Zwischenablage
- Tausch zwischen zwei Räumen per Drag (nur Schere für Raumwechsel)
- Undo/Redo
