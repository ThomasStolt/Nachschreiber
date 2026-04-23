# Sprint 3 — Excel-Export als visueller 2D-Tischplan

## Ziel

Der aktuelle Excel-Export liefert pro Raum ein Tabellenblatt mit einer zeilenbasierten Liste (Tisch, Platz, Name, …). Für die Aufsicht während der Nachschreiber wird ein **visueller Tischplan** gewünscht, der die physische Raumanordnung (4×4 Tische, 2 Sitze pro Tisch) abbildet — so ist auf einen Blick erkennbar, wer wo sitzt.

## Scope

- Neuer Excel-Export pro Raum: 2D-Raster, physische Anordnung
- Word-Export bleibt unverändert (dient als Listen-Dokumentation)
- Keine Änderung an Sitzplatz-Zuweisungslogik, Models oder API

## Raum-Layout

Jeder Raum hat 16 Tische in einem 4×4-Grid; jeder Tisch hat 2 Sitzplätze (links/rechts). Tische und Sitze sind laut `backend/app/seating.py` fortlaufend durchnummeriert:

```
desk = (i // 2) + 1   # 1..16
seat = (i %  2) + 1   # 1..2
```

Physische Anordnung (von oben gesehen, Lehrpult an der Stirnseite):

```
          [ LEHRPULT ]
  ┌─────────┬─────────┬─────────┬─────────┐
  │  T1 S1/S2  │  T2 S1/S2  │  T3 S1/S2  │  T4 S1/S2  │
  ├─────────┼─────────┼─────────┼─────────┤
  │  T5 S1/S2  │  T6 S1/S2  │  T7 S1/S2  │  T8 S1/S2  │
  ├─────────┼─────────┼─────────┼─────────┤
  │  T9 S1/S2  │ T10 S1/S2  │ T11 S1/S2  │ T12 S1/S2  │
  ├─────────┼─────────┼─────────┼─────────┤
  │ T13 S1/S2  │ T14 S1/S2  │ T15 S1/S2  │ T16 S1/S2  │
  └─────────┴─────────┴─────────┴─────────┘
```

## Excel-Struktur (pro Raum-Tabellenblatt)

- **Zeile 1:** Titel "Raum A — Nachschreiber" (merged über alle 8 Spalten), Hintergrund orange (`#D97706`), weiß/fett.
- **Zeile 2:** "Lehrpult" (merged über alle 8 Spalten), hellgrau, zentriert.
- **Zeile 3:** Leerzeile (dünn, als Abstand zum Pult).
- **Zeilen 4–7:** Vier Tischreihen, je Tischreihe eine Zeile mit 8 Spalten:
  - Spalten A+B → Tisch in Spalte 1 (Sitz 1, Sitz 2)
  - Spalten C+D → Tisch in Spalte 2
  - Spalten E+F → Tisch in Spalte 3
  - Spalten G+H → Tisch in Spalte 4
- Zwischen den Tischpaaren (also nach Spalten B, D, F) **dicker vertikaler Border** → klare Tisch-Trennung.
- Zwischen Tischreihen dicker horizontaler Border.
- Innerhalb eines Tisches (zwischen Sitz 1 und Sitz 2): dünner Border.

### Sitzzellen-Inhalt

Jede Sitzzelle ist eine einzelne Excel-Zelle mit mehrzeiligem Inhalt (`\n`-getrennt, `wrap_text=True`, vertikale Zentrierung, `row_height` ausreichend groß):

**Besetzte Zelle:**
```
T<desk>.S<seat>
Nachname, Vorname
Klasse
Fach · <Dauer> min
<Lehrkraft>
[<Hilfsmittel>]                   ← nur wenn gefüllt
```

- Erste Zeile klein und grau (z.B. 8pt, #888): `T3.S2`
- Name fett, 11pt
- Rest 9pt
- Hilfsmittel kursiv, nur wenn nicht leer

**Leere Zelle:**
```
T<desk>.S<seat>
```
(nur die Platznummer, klein/grau, sonst leer — dient als Referenz für die Aufsicht)

### Spaltenbreiten / Zeilenhöhen

- Alle 8 Sitzspalten: gleiche Breite (ca. 20 Zeichen)
- Tischreihen-Zeilen (4–7): Höhe so, dass 5–6 Zeilen Text hineinpassen (~85 pt)
- Titel- und Lehrpultzeilen: Standardhöhe

### Sheet-Namen & Druckbereich

- Sheet-Namen bleiben: `Raum A`, `Raum B`, `Raum C`
- `ws.page_setup.orientation = 'landscape'`
- `ws.page_setup.fitToWidth = 1`, `fitToHeight = 1`
- `ws.print_options.horizontalCentered = True`

## Leere Räume

Wenn ein Raum keine Einträge hat, wird das Sheet trotzdem erzeugt, alle 32 Sitzzellen sind leer (nur mit `T<desk>.S<seat>`-Label). Das ist bewusst — der Druck aller drei Räume bleibt konsistent.

## Komponenten & Code-Organisation

`backend/app/exporter.py` wird in zwei Bereiche unterteilt:

- `build_word(plan)` → bleibt unverändert (zeilenbasierte Liste)
- `build_excel(plan)` → komplett neue Implementierung mit Grid-Layout

Neue interne Helper in `exporter.py`:

- `_style_title_row(ws, text, cols=8)` — Titelzeile styling
- `_style_pult_row(ws, cols=8)` — Lehrpult-Zeile styling
- `_seat_cell_content(assignment | None, desk, seat)` → `str` mit `\n`
- `_style_seat_cell(cell, filled: bool)` — Font, Alignment, Borders
- `_render_room_grid(ws, room_plan)` — orchestriert das gesamte Raum-Layout

Die öffentliche API (`build_excel(plan: SeatingPlan) -> bytes`) und die Route `GET /api/export/excel` bleiben unverändert.

## Tests

Erweiterung von `tests/test_export.py`:

- `build_excel` liefert weiterhin `bytes` mit gültigem xlsx-Header (`PK`)
- Nach `openpyxl.load_workbook(BytesIO(bytes))`:
  - 3 Sheets mit Namen `Raum A`, `Raum B`, `Raum C`
  - Zeile 1 enthält "Raum A — Nachschreiber" (merged)
  - Zeile 2 enthält "Lehrpult" (merged)
  - Zeilen 4–7 enthalten je 8 Zellen (insgesamt 32 Sitzzellen pro Sheet)
  - Bei gegebenem Plan mit bekannten Einträgen: Sitz (1,1) enthält den Namen des ersten Eintrags
  - Leere Sitze enthalten nur das `T<desk>.S<seat>`-Label
  - `page_setup.orientation == "landscape"`

Bestehende Word-Export-Tests bleiben unverändert.

## Edge Cases

- **Voller Raum (32 Einträge):** alle 32 Zellen gefüllt, keine Layout-Brüche
- **Leerer Raum:** alle 32 Zellen zeigen nur `T<desk>.S<seat>` — Sheet wird trotzdem erzeugt
- **Lange Namen / Fächer:** `wrap_text=True`; wenn doch zu lang, wird abgeschnitten (kein Abfangen — Raumhöhe ist großzügig dimensioniert)
- **Fehlende Hilfsmittel (`aids == ""`):** Zeile wird weggelassen
- **Mehrzeilige Hilfsmittel (Umbruch im Feld):** bleibt so wie eingegeben, wrap übernimmt

## Out of Scope

- Änderung am Word-Export
- Konfigurierbare Raumgröße
- Farbkodierung nach Kategorie/Fach
- Export als PDF
- Tischplan-Export für den Browser (UI hat eigene Grid-Ansicht)
