# Nachschreiber

Web-App zur Verwaltung von Nachschreibeterminen. Lehrkräfte importieren Schülerstammdaten per CSV, tragen Schüler mit Prüfungsdetails ein und erhalten automatisch einen fertigen Sitzplan – exportierbar als Excel- oder Word-Datei.

## Funktionen

- **CSV-Import** – Schülerstammdaten (Nachname, Vorname, Klasse) einmalig hochladen
- **Live-Dashboard** – Schüler eintragen, Sitzplan aktualisiert sich sofort
- **Automatische Raumzuweisung** nach Prüfungsdauer:
  - Raum A: ≤ 45 min
  - Raum B: 46–59 min
  - Raum C: ≥ 60 min
- **Sitzplatzvergabe** – 16 Tische × 2 Plätze (max. 32 Schüler pro Raum)
- **Duplikatschutz** – selber Schüler + selbes Fach wird abgelehnt
- **Export** als Excel (.xlsx) und Word (.docx)
- **Dark Mode**

## Technologie

| Schicht | Stack |
|---------|-------|
| Backend | Python 3.12, FastAPI, uvicorn |
| Daten | openpyxl (Excel), python-docx (Word) |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Deployment | Docker Compose, nginx |

## Schnellstart

### Voraussetzungen

- Docker & Docker Compose

### Starten

```bash
git clone https://github.com/ThomasStolt/Nachschreiber.git
cd Nachschreiber
docker compose up -d --build
```

Die App ist anschließend unter **http://localhost:3002** erreichbar.

### CSV-Format

Die Importdatei muss semikolongetrennt sein (wie Excel-Export):

```
Nachname;Vorname;Klasse
Müller;Anna;10a
Schmidt;Max;9b
```

## Entwicklung

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload   # http://localhost:8000

# Frontend (separates Terminal)
cd frontend
npm install
npm run dev                     # http://localhost:5173

# Tests
cd backend
pytest ../tests/ -v
```

## Deployment auf dem Raspberry Pi

```bash
# Auf dem Pi (192.168.2.54)
git clone https://github.com/ThomasStolt/Nachschreiber.git
cd Nachschreiber
docker compose up -d --build
# Erreichbar auf http://192.168.2.54:3002
```

Zum Aktualisieren:

```bash
git pull
docker compose up -d --build
```

## Projektstruktur

```
Nachschreiber/
├── backend/
│   ├── app/
│   │   ├── main.py        # FastAPI-App
│   │   ├── models.py      # Pydantic-Modelle
│   │   ├── session.py     # JSON-Persistenz
│   │   ├── seating.py     # Raum- und Sitzplatzvergabe
│   │   ├── exporter.py    # Excel- und Word-Export
│   │   └── routers/       # API-Endpunkte
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/         # UploadPage, DashboardPage
│   │   └── components/    # StudentForm, SeatingGrid, ExportButtons
│   └── Dockerfile
├── tests/                 # pytest-Testsuite
└── docker-compose.yml
```
