# Sprint 1 — Doppeleintrag-Warnung + Drucken
_Erstellt: 2026-04-23_

## Überblick

Zwei unabhängige Frontend-Features ohne Backend-Änderungen:
1. **Doppeleintrag-Warnung mit Bestätigung** — Hinweis wenn ein Schüler bereits eingetragen ist
2. **Drucken mit Light Mode** — Sitzplan direkt aus dem Browser drucken, zwei Modi

---

## Feature 1 — Doppeleintrag-Warnung

### Verhalten

Wenn im `StudentForm` ein Schüler aus der Dropdown ausgewählt wird, werden die bereits geladenen Entries des Dashboards geprüft:

- **Kein bestehender Eintrag** → normaler Submit-Button "✚ Schüler eintragen"
- **Mindestens ein bestehender Eintrag** → gelbe Warnbox + geänderter Button

### Warnbox (erscheint zwischen Student-Dropdown und Fach-Feld)

```
⚠️ Bereits eingetragen:
• Mathematik — Raum A, Tisch 2
• Biologie — Raum C, Tisch 1
```

Amber-Hintergrund (`rgba(245,158,11,0.12)`), amber Border.

### Submit-Button im Warnzustand

Text: `⚠️ Trotzdem eintragen`  
Style: amber Border + amber Text (statt gefülltem Accent-Button)

Das Eintragen bleibt vollständig möglich. Der bestehende Hard-Block (409) für exakt gleichen Schüler + gleiches Fach bleibt erhalten.

### Implementierung

- `DashboardPage` übergibt `entries: Entry[]` als Prop an `StudentForm`
- `StudentForm` filtert on-the-fly: `entries.filter(e => e.student_id === form.student_id)`
- Keine neuen API-Calls, keine Backend-Änderungen
- Tisch-Nummer wird aus dem `SeatAssignment` des aktuellen Seating Plans berechnet — `DashboardPage` übergibt auch `plan: SeatingPlan` an `StudentForm`

### Tisch-Anzeige in der Warnung

Aus `plan.room_x.assignments` wird die passende `SeatAssignment` per `entry.id` gesucht → `assignment.desk` anzeigen.

---

## Feature 2 — Drucken mit Light Mode

### State-Änderung: aktiver Raum

`activeRoom` (`'room_a' | 'room_b' | 'room_c'`) wird aus `SeatingGrid` in `DashboardPage` hochgezogen (lifted state). `DashboardPage` übergibt `activeRoom` + `setActiveRoom` als Props an `SeatingGrid`, und `activeRoom` an `ExportButtons`.

### Neue Buttons

In `ExportButtons.tsx` werden zwei neue Print-Buttons ergänzt (unterhalb der Excel/Word-Buttons):

```
[ 🖨️ Aktueller Raum ]  [ 🖨️ Alle Räume ]
```

Beide Buttons setzen vor `window.print()` eine CSS-Klasse am `<body>`:
- `print-single` → druckt nur den aktiven Raum
- `print-all` → druckt alle 3 Räume

Nach dem `window.print()`-Dialog wird die Klasse wieder entfernt.

### DashboardPage — Print-only Sektion

Eine neue `<div className="print-all-rooms">` Sektion in `DashboardPage`, die:
- Im Normalbetrieb: `display: none`
- Im Druck mit Klasse `print-all`: `display: block`
- Alle 3 `RoomGrid`-Komponenten untereinander rendert
- Jeder Raum hat einen `page-break-after: always`-Wrapper

Die aktive `SeatingGrid`-Komponente (Tab-Ansicht) wird beim "Alle Räume"-Druck ausgeblendet.

### Print-Layout (CSS `@media print`)

```css
@media print {
  /* Light Mode erzwingen */
  :root { --c-bg: #fff; --c-surface: #fff; --c-text: #1c1917; ... }

  /* Linkes Panel, Header, Buttons ausblenden */
  .no-print { display: none !important; }

  /* Footer mit Datum */
  .print-room::after { content: attr(data-label); ... }
}
```

Jeder gedruckte Raum zeigt:
- **Heading:** "Raum A — ≤ 45 min · N Schüler"
- **Footer:** "Nachschreiber — DD.MM.YYYY" + Seitenzahl via CSS counter
- **Grid:** 4×4 Tische, je 2 Plätze nebeneinander, belegte Plätze mit amber Hintergrund

### Print-Modi

| Klasse | Verhalten |
|--------|-----------|
| `print-single` | Nur aktiver Raum sichtbar, alle anderen ausgeblendet |
| `print-all` | Alle 3 Räume, jeder auf eigener Seite |

---

## Nicht im Scope

- Backend-Änderungen
- Änderungen am bestehenden Excel/Word-Export
- Drucken über andere Seiten als das Dashboard
