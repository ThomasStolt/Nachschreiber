# Nachschreiber — Design Spec
_Erstellt: 2026-04-22_

## Überblick

**Nachschreiber** ist eine Web-App für die Verwaltung wöchentlicher Nachschreibetermine an einer Schule. Lehrkräfte laden Schülerstammdaten per CSV hoch, tragen Schüler mit Prüfungsdetails ein, und das System weist automatisch Räume und Sitzplätze zu. Der fertige Sitzplan wird als Excel- und Word-Datei exportiert.

## Scope

- **Nachschreiber** — die eigentliche App (dieses Repo)
- **Schulportal** — separates Repo, statische Landing Page auf Port 80 des Raspberry Pi

## Fachliche Anforderungen

### Kategorien & Räume

| Kategorie | Dauer | Raum |
|-----------|-------|------|
| A | ≤ 45 min | Raum A |
| B | 46–59 min | Raum B |
| C | ≥ 60 min | Raum C |

_Grenzwerte: Die Anforderung ist bei genau 45 und 60 min mehrdeutig. Festlegung: 45 min → A, 60 min → C._

Jeder Raum hat 16 Tische (4×4-Raster), je 2 Plätze → max. 32 Schüler pro Raum.

### Sitzzuweisung

Sequenziell: Tisch 1 Platz 1 → Tisch 1 Platz 2 → Tisch 2 Platz 1 → … → Tisch 16 Platz 2.

### Duplikat-Schutz

- Gleicher Schüler + gleiches Fach → blockiert (Fehlermeldung)
- Gleicher Schüler + anderes Fach → erlaubt (zwei Einträge, zwei Sitzplätze, ggf. in verschiedenen Räumen)

### Datenfelder je Eintrag

- Schüler (aus Stammdaten): Name, Vorname, Klasse
- Fach (Freitext)
- Dauer in Minuten (bestimmt Raum)
- Hilfsmittel (Freitext, optional)
- Verantwortliche Lehrkraft (Freitext)

## UX-Konzept: Live-Dashboard

### Seitenstruktur (2 Seiten)

**Seite 1 — CSV Upload**
Schülerstammdaten hochladen (Name, Vorname, Klasse). Identisch zum Upload-Flow von Kurswahl.

**Seite 2 — Dashboard (Hauptansicht)**
Geteilte Ansicht:
- **Linke Spalte (~38%):** Formular zum Eintragen eines Schülers (Klasse → Schüler → Fach, Dauer, Hilfsmittel, Lehrkraft) + „Schüler eintragen"-Button + Export-Buttons (Excel / Word) ganz unten
- **Rechte Spalte (~62%):** Tabs für Raum A / B / C mit Belegungszähler (z.B. „3/32"), darunter das 4×4-Sitzgitter. Belegte Plätze zeigen Name, Klasse, Fach, Dauer; freie Plätze sind gestrichelt/ausgegraut. Aktualisiert sich sofort nach jedem Eintrag.

„Neue Sitzung"-Button im Header setzt alle Einträge zurück (Stammdaten bleiben erhalten).

## Architektur

### Stack

Identisch zu Kurswahl:

| Schicht | Technologie |
|---------|-------------|
| Backend | Python 3.12, FastAPI, uvicorn |
| Daten | openpyxl (Excel), python-docx (Word) |
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS, gleiche Design-Tokens wie Kurswahl |
| Fonts | DM Sans (Body), Bricolage Grotesque (Headings) |
| Proxy | nginx (im Frontend-Container) |

### Datenhaltung

Atomare JSON-Persistenz nach Kurswahl-Muster (`/data/session.json` im Docker-Volume):

```json
{
  "students": [
    { "id": "...", "last_name": "Müller", "first_name": "Anna", "class": "10a" }
  ],
  "entries": [
    {
      "id": "...",
      "student_id": "...",
      "subject": "Mathematik",
      "duration_minutes": 45,
      "aids": "Taschenrechner",
      "teacher": "Fr. Schmidt",
      "room": "A",
      "desk": 1,
      "seat": 1
    }
  ]
}
```

### API-Routen

```
POST   /api/upload            CSV-Upload (Stammdaten)
GET    /api/classes           Klassenliste (sortiert)
GET    /api/students          Schüler, gefiltert: ?class=10a
GET    /api/entries           Alle Einträge
POST   /api/entries           Eintrag hinzufügen (mit Duplikat-Prüfung + Sitzzuweisung)
DELETE /api/entries/{id}      Eintrag löschen (Sitzplatz wird freigegeben)
GET    /api/seating           Sitzplan aller 3 Räume (für Live-Ansicht)
GET    /api/export/excel      Excel-Download
GET    /api/export/word       Word-Download
POST   /api/reset             Session zurücksetzen (Einträge löschen, Stammdaten behalten)
GET    /api/health            Health-Check
```

### Fehlerbehandlung

- Duplikat (gleicher Schüler + Fach): HTTP 409, Fehlermeldung im Formular
- Raum voll (> 32 Schüler): HTTP 422, Fehlermeldung mit Hinweis auf vollen Raum
- CSV-Fehler: HTTP 422 mit Zeilenangabe

## Deployment

### Docker

```
nachschreiber/
├── backend/
│   ├── app/
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   ├── Dockerfile
│   └── nginx.conf
└── docker-compose.yml
```

- Backend: intern Port 8000
- Frontend/nginx: extern Port **3002**
- Volume: `nachschreiber_data` → `/data/session.json`
- Restart: `unless-stopped`

### Raspberry Pi (192.168.2.54)

| Port | Dienst |
|------|--------|
| 80 | Schulportal (Landing Page) |
| 3001 | Kurswahl |
| 3002 | Nachschreiber |

### Schulportal (separates Repo)

Eigener nginx-Container, Port 80. Statische HTML-Seite mit Karten/Links zu allen verfügbaren Projekten. Neues Projekt hinzufügen = neue Karte + `docker compose restart`. Gleiche visuelle Sprache wie die Apps.

### GitHub

- `Nachschreiber` — öffentliches Repo (diese App)
- `Schulportal` — öffentliches Repo (Landing Page)

Deployment-Workflow: `git pull && docker compose up -d --build`

## Nicht im Scope

- Login / Authentifizierung
- Mehrere gleichzeitige Nutzer
- Persistenz über mehrere Wochen (jede Woche = neue Session)
- Drag-and-Drop Umsortierung der Sitzplätze
