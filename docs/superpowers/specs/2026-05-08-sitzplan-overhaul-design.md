# Sitzplan-Überarbeitung — Design

**Datum:** 2026-05-08
**Status:** Spec
**Kontext:** Feedback aus dem Echteinsatz; bestehende Sprints 1–4 sind deployed.

## Motivation

Nach erstem Echteinsatz sind mehrere Punkte am Sitzplan aufgefallen, die Workflow und Lesbarkeit verbessern sollen — insbesondere die Tisch-Nummerierung muss der Konvention der Kollegen entsprechen, und die "Ausschneiden"-Mechanik hat sich als überflüssig erwiesen.

## Scope

Sechs gebündelte Änderungen am Sitzplan-Feature:

1. Tisch-Nummerierung umkehren: `Tisch 1` unten rechts, `Tisch 16` oben links
2. "Ausschneiden" / Clipboard komplett entfernen
3. 🗑️-Button: nur aus Sitzplan entfernen — Stammdaten bleiben erhalten
4. Raumnamen direkt im Sitzplan editierbar machen (Stift-Icon)
5. Default-Raumnamen: `Raum 1`, `Raum 2`, `Raum 3` statt `Raum A/B/C`
6. Aktiver Reiter rahmt das Raum-Panel optisch ein (klassisches Tab-Pattern)

Out of scope: Datenmodell-Migrationen, Veränderungen am Auto-Belegungs-Algorithmus, neue Routen, neue Features außerhalb dieser Liste.

## 1. Tisch-Nummerierung umkehren

### Konvention
Tisch 1 unten rechts, fortlaufend nach links bis Tisch 4. Eine Reihe darüber rechts beginnend mit Tisch 5 bis Tisch 8 links. Top-left ist Tisch 16.

```
T16  T15  T14  T13   ← Lehrpult-Seite (oben)
T12  T11  T10  T9
 T8   T7   T6   T5
 T4   T3   T2   T1   ← unten
```

### Datenmodell — keine Änderung
`Entry.desk: 1..16` bleibt unverändert. Die Bedeutung der Zahl ändert sich konzeptionell (Tisch 1 ist jetzt unten rechts statt oben links), aber Speicherung und Auto-Belegung bleiben byte-identisch.

### Auto-Belegung — keine Änderung
`next_free_seat()` iteriert weiterhin `desk: 1..16, seat: 1..2`. Konsequenz: erster automatisch zugewiesener Schüler landet jetzt unten rechts (Tisch 1). Das wurde explizit so gewählt — Auto-Belegung folgt der neuen Nummerierung.

### Rendering — Mapping (desk → grid-position)
Das einzige, was sich ändert, ist die Position im 4×4 Grid:

```
row = 3 - ((desk - 1) // 4)
col = 3 - ((desk - 1) % 4)
```

**Frontend (`SeatingGrid.tsx` → `RoomGrid`):** desks-Array umsortieren so dass Reading-Order durch das Grid die Reihenfolge `[16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]` ergibt.

**Excel-Export (`exporter.py` → `_render_room_grid`):** `desk_number` Berechnung anpassen:
```python
desk_number = (3 - row_idx) * 4 + (3 - desk_col) + 1
```

**Word-Export (`exporter.py` → `_add_room_table`):** Tabelle iteriert weiter `for desk in range(1, 17)` — die Tabelle ist eine Liste, ascending desk-Nummern bleibt am lesbarsten.

### Auswirkung auf bestehende Daten
Stored entries mit `desk=1` werden nach dem Update unten rechts angezeigt statt oben links. Die *physische* Sitzposition eines bereits eingetragenen Schülers ändert sich also visuell, sein Datensatz bleibt aber unverändert. Da die App noch frisch deployed ist und Sitzpläne pro Klausur neu erstellt werden, ist Migration unkritisch.

## 2. "Ausschneiden" / Clipboard komplett entfernen

Frontend-only. Kein Backend-Impact (Clipboard war reiner UI-State).

**`SeatingGrid.tsx`:**
- `ClipboardCard`, `ClipboardStrip` Komponenten löschen
- ✂️-Button im `SeatSlot` löschen
- Props raus: `clipboardEntries`, `onScissors`, `onRemoveFromClipboard`, `clipboardEntryIds`
- Logik für `isInClipboard` raus
- DnD-handler vereinfacht: nur noch `entry-…`-IDs (kein `clip-…` mehr)

**`DashboardPage.tsx`:**
- State `clipboardEntries` raus
- Handler `handleScissors`, `handleRemoveFromClipboard` raus
- Aus `handleDeleteEntry`, `handleDrop`, `handleMoveToRoom` jeweils die Clipboard-Cleanup-Zeilen entfernen

## 3. 🗑️-Button: nur aus Sitzplan entfernen

Aktuelles Verhalten: 🗑️ ruft `api.deleteStudent` → entfernt Schüler aus Stammdaten + cascade-löscht alle Einträge. Neues Verhalten: nur den jeweiligen Eintrag (Sitzplatz-Zuweisung) entfernen, Stammdaten und andere Einträge desselben Schülers bleiben erhalten.

**`SeatingGrid.tsx`:**
- Prop-Name umbenennen: `onDeleteStudent` → `onDeleteEntry` (oder ganz entfernen und den existierenden `onDeleteEntry` durchreichen)
- Button ruft `onDeleteEntry(assignment.entry.id)`
- aria-label / title: *"Aus Sitzplan entfernen"*

**`DashboardPage.tsx`:**
- `handleDeleteStudent` löschen
- Existierendes `handleDeleteEntry` bekommt einen Confirm-Dialog: *"X aus dem Sitzplan entfernen? Die Stammdaten bleiben erhalten."*

## 4. Inline Raumnamen-Edit per ✏️-Icon

Stift-Icon erscheint **nur auf dem aktiven Reiter**, rechts neben dem Namen.

**Verhalten:**
- Klick auf ✏️ → `<input>` ersetzt Namens-Span, gibt sich Fokus, markiert den Text
- Enter oder Blur → speichert via `api.putRoomLabels({ ...current, [letter]: newName })`
- Escape → bricht ab, alter Name bleibt
- `onClick`/`onPointerDown` mit `stopPropagation`, damit weder Tab-Wechsel noch Drop-Target getriggert werden

**Komponente (`SeatingGrid.tsx` → `RoomTab`):**
- Lokaler State `editing: boolean`, `draftName: string`
- Beim Speichern: ein Callback-Prop `onRenameRoom(letter: 'A'|'B'|'C', newName: string)` aufrufen
- Validierung: leerer Name → fällt auf Default zurück (folgt bestehender Logik in `misc.py:put_room_labels`)

**`DashboardPage.tsx`:**
- Neuer Handler `handleRenameRoom`: ruft `api.putRoomLabels` und `refresh()`

## 5. Default-Raumnamen

Defaults von `Raum A/B/C` → `Raum 1/2/3`.

**`backend/app/models.py`:**
```python
class RoomLabels(BaseModel):
    A: str = "Raum 1"
    B: str = "Raum 2"
    C: str = "Raum 3"
```

**`frontend/src/pages/UploadPage.tsx`:**
```ts
const DEFAULT_ROOM_LABELS: RoomLabels = { A: 'Raum 1', B: 'Raum 2', C: 'Raum 3' };
```

**`frontend/src/pages/DashboardPage.tsx`:**
`EMPTY_PLAN`-Felder `name` analog anpassen.

**Tests (`tests/`):** vorhandene Assertions auf "Raum A/B/C" auf neue Werte aktualisieren.

Bestehende Sessions: Werte in `data/session.json` überschreiben die Defaults, daher keine Migration nötig.

## 6. Tab+Rahmen-Look

Aktiver Reiter verschmilzt visuell mit dem Raum-Panel.

```
  ┌─────────┐ ┌─────────┐ ┌─────────┐
  │ Raum 1✏️│ │ Raum 2 │ │ Raum 3 │
─┘         └─┴─────────┴─┴─────────┴──────────┐
   Raum 1 · ≤ 45 min · 12 Schüler             │
   ┌──────────┐ ┌──────────┐ ...              │
   │ Tisch 16 │ │ Tisch 15 │ ...              │
   └──────────┘ └──────────┘                  │
   ...                                        │
└──────────────────────────────────────────────┘
```

**Strukturelle Änderung in `SeatingGrid.tsx`:**
- Tab-Strip + Caption + Grid in einen gemeinsamen Wrapper-Container
- Wrapper hat Border + Border-Radius (`0 0 8px 8px` an Bottom-Corners; oder rundherum mit Top-Border, die unter dem aktiven Tab "verschwindet")
- Tab-Strip: `border-bottom: 1px solid var(--c-border)`, Tabs sitzen auf der Border
- Aktiver Tab: gleiche Hintergrundfarbe wie Wrapper, Border-Bottom: `1px solid <bg>` (überdeckt die durchgehende Linie), `margin-bottom: -1px` zur Überlappung
- Inaktive Tabs: leicht gedämpfter Hintergrund (`var(--c-surface)`), eigene Border

**Drag-Verhalten bleibt:** isOver-Indikator auf Tabs (gestrichelte Border) funktioniert unverändert.

## Architektur / Komponenten-Inventar

Keine neuen Komponenten, keine neuen Routen, keine neuen API-Endpunkte. Alle Änderungen sind:
- **Backend:** `models.py` (Defaults), `exporter.py` (Render-Mapping)
- **Frontend:** `SeatingGrid.tsx` (Großteil), `DashboardPage.tsx` (Handler-Cleanup), `UploadPage.tsx` (Defaults)

## Tests

- **Bestehende pytest-Suite:** Defaults `Raum 1/2/3` adjusten. Auto-Belegung-Tests bleiben gültig (Logik unverändert).
- **Neue Tests:**
  - `_render_room_grid` setzt desk 1 in Excel-Zelle bottom-right (row 7, col 7-8)
  - `RoomLabels` Defaults sind `Raum 1/2/3`
- **Kein neuer Frontend-Test** — Änderungen sind primär kosmetisch / Refactor; manuelle Verifikation in beiden Browsern reicht.

## Risiken & Edge Cases

- **Tisch-Nummern in Word-Export:** Tabelle listet desk 1..16 ascending. Mit neuer Konvention bedeutet das: erste Tabellenzeile = unten rechts. Bei Bedarf später nach physischer Reihenfolge sortieren — bewusst out-of-scope.
- **Stift-Icon kollidiert mit Drag-Drop:** beim Druck auf ✏️ darf der Tab nicht gedroppt werden. Lösung: `onPointerDown` + `onClick` mit `stopPropagation`. Bewährt durch existierende Trash- und Schere-Buttons.
- **Inline-Edit beim Tab-Wechsel:** wenn Nutzer ein Tab editiert und auf einen anderen klickt, wird per Blur gespeichert. Akzeptabel.
- **Empty-Name beim Edit:** `put_room_labels` fällt bereits auf Default zurück, wenn ein Feld leer ist. ✓

## Acceptance Criteria

- [ ] Sitzplan zeigt `Tisch 1` unten rechts, `Tisch 16` oben links
- [ ] Excel- und Word-Export verwenden die neue Beschriftung konsistent
- [ ] Auto-Belegung legt ersten Schüler auf Tisch 1 (unten rechts)
- [ ] ✂️-Button und Clipboard-Strip sind nicht mehr sichtbar — keine Code-Reste
- [ ] 🗑️ entfernt nur den Sitzplan-Eintrag, Schüler bleibt in Stammdaten und behält andere Einträge
- [ ] Auf aktivem Reiter ist ✏️ sichtbar; Klick → Inline-Edit → Enter speichert; Escape bricht ab; Tab-Wechsel und Drag bleiben funktionsfähig
- [ ] Frische Sessions bekommen `Raum 1`, `Raum 2`, `Raum 3`
- [ ] Aktiver Reiter und Raum-Panel bilden visuell eine zusammenhängende Karte
- [ ] pytest-Suite ist grün
