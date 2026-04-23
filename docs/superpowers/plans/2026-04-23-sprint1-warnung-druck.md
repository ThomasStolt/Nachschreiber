# Sprint 1 — Doppeleintrag-Warnung + Drucken

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a duplicate-entry warning with confirmation in the student form, and two print buttons that produce a light-mode seating plan (single room or all three rooms).

**Architecture:** Pure frontend changes — no backend modifications. `activeRoom` state is lifted from `SeatingGrid` into `DashboardPage` so print buttons can reference it. CSS `@media print` forces light colors and hides UI chrome; a hidden `print-all-rooms` section renders all three room grids for the "all rooms" print mode.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, CSS `@media print`, `window.onafterprint`

---

## File Map

```
frontend/src/
├── index.css                          — add @media print block
├── components/
│   ├── SeatingGrid.tsx                — export RoomGrid, lift activeRoom to props
│   ├── ExportButtons.tsx              — add print buttons, activeRoom prop
│   └── StudentForm.tsx                — add plan prop, duplicate warning UI
├── pages/
│   └── DashboardPage.tsx              — manage activeRoom, print-all section, pass props
└── App.tsx                            — add no-print to <header>
```

---

## Task 1: CSS Print Foundation + Lift `activeRoom` State

**Files:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/components/SeatingGrid.tsx`
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Add `@media print` block to `frontend/src/index.css`**

Append after the closing `}` of `@layer base`:

```css
@media print {
  /* Force light mode regardless of dark/light setting */
  :root,
  .dark {
    --c-bg: #ffffff;
    --c-surface: #ffffff;
    --c-border: #e5e0d8;
    --c-text: #1c1917;
    --c-text-secondary: #78716c;
    --c-accent: #d97706;
    --c-muted: #a8a29e;
  }

  /* General print utilities */
  .no-print { display: none !important; }
  .overflow-y-auto { overflow: visible !important; }

  /* Print heading for single-room mode — hidden on screen */
  .print-single-heading { display: block !important; }

  /* Print-all section — hidden on screen */
  .print-all-rooms { display: none; }

  /* In all-rooms print mode: show all-rooms section, hide single-room view */
  body[data-print-mode="all"] .print-all-rooms { display: block; }
  body[data-print-mode="all"] .print-active-room { display: none !important; }

  /* Each room on its own page */
  .print-room-section { page-break-after: always; }
  .print-room-section:last-child { page-break-after: avoid; }

  @page { margin: 1.5cm; }
}
```

- [ ] **Step 2: Export `RoomGrid` and lift `activeRoom` in `SeatingGrid.tsx`**

Replace the entire file with:

```tsx
// frontend/src/components/SeatingGrid.tsx
import type { SeatingPlan, RoomPlan, SeatAssignment } from '../types';

interface Props {
  plan: SeatingPlan;
  activeRoom: 'room_a' | 'room_b' | 'room_c';
  onActiveRoomChange: (room: 'room_a' | 'room_b' | 'room_c') => void;
  onDeleteEntry: (entryId: string) => void;
}

function DeskCard({ desk, assignments }: { desk: number; assignments: (SeatAssignment | null)[] }) {
  const hasOccupied = assignments.some(Boolean);
  return (
    <div
      className="rounded-lg p-2 text-xs"
      style={{
        background: 'var(--c-surface)',
        border: `1px ${hasOccupied ? 'solid' : 'dashed'} ${hasOccupied ? 'var(--c-accent)' : 'var(--c-border)'}`,
      }}
    >
      <p className="font-semibold mb-1 uppercase tracking-wide" style={{ color: 'var(--c-text-secondary)', fontSize: '0.65rem' }}>
        Tisch {desk}
      </p>
      <div className="flex gap-1">
        {assignments.map((a, i) => (
          <div
            key={i}
            className="rounded px-1.5 py-1 flex-1"
            style={{
              background: a ? 'var(--c-bg)' : undefined,
              border: a ? undefined : '1px dashed var(--c-border)',
              color: a ? 'var(--c-text)' : 'var(--c-muted)',
              minHeight: '2rem',
            }}
          >
            {a ? (
              <>
                <p className="font-semibold truncate" style={{ fontSize: '0.7rem' }}>{a.student.last_name}, {a.student.first_name}</p>
                <p className="truncate" style={{ fontSize: '0.65rem', color: 'var(--c-text-secondary)' }}>
                  {a.student.class_name} · {a.entry.subject} · {a.entry.duration_minutes} min
                </p>
              </>
            ) : (
              <p className="text-center" style={{ fontSize: '0.65rem' }}>frei</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function RoomGrid({ room_plan }: { room_plan: RoomPlan }) {
  const assignmentMap = new Map<string, SeatAssignment>();
  for (const a of room_plan.assignments) {
    assignmentMap.set(`${a.desk}-${a.seat}`, a);
  }
  const desks = Array.from({ length: 16 }, (_, i) => {
    const desk = i + 1;
    return {
      desk,
      seats: [
        assignmentMap.get(`${desk}-1`) ?? null,
        assignmentMap.get(`${desk}-2`) ?? null,
      ],
    };
  });
  return (
    <div className="grid grid-cols-4 gap-2">
      {desks.map(({ desk, seats }) => (
        <DeskCard key={desk} desk={desk} assignments={seats} />
      ))}
    </div>
  );
}

const ROOMS = [
  { key: 'room_a' as const, label: 'Raum A' },
  { key: 'room_b' as const, label: 'Raum B' },
  { key: 'room_c' as const, label: 'Raum C' },
];

export default function SeatingGrid({ plan, activeRoom, onActiveRoomChange, onDeleteEntry: _onDeleteEntry }: Props) {
  const active = plan[activeRoom];
  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex gap-2 no-print">
        {ROOMS.map(({ key, label }) => {
          const count = plan[key].assignments.length;
          const isActive = activeRoom === key;
          return (
            <button
              key={key}
              onClick={() => onActiveRoomChange(key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: isActive ? 'var(--c-accent)' : 'var(--c-surface)',
                color: isActive ? 'white' : 'var(--c-text-secondary)',
                border: isActive ? 'none' : '1px solid var(--c-border)',
              }}
            >
              {label}
              <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: isActive ? 'rgba(255,255,255,0.2)' : 'var(--c-bg)' }}>
                {count}/32
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-xs no-print" style={{ color: 'var(--c-text-secondary)' }}>
        {active.label} · {active.assignments.length} Schüler
      </p>
      <div className="overflow-y-auto flex-1">
        <RoomGrid room_plan={active} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add `no-print` to `<header>` in `frontend/src/App.tsx`**

Change line:
```tsx
<header className="border-b px-6 py-3 flex items-center justify-between" style={...}>
```
to:
```tsx
<header className="border-b px-6 py-3 flex items-center justify-between no-print" style={{ borderColor: 'var(--c-border)', background: 'var(--c-surface)' }}>
```

- [ ] **Step 4: Lift `activeRoom` into `DashboardPage.tsx`**

Replace the entire file with:

```tsx
// frontend/src/pages/DashboardPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { SeatingPlan, RoomPlan } from '../types';
import StudentForm from '../components/StudentForm';
import SeatingGrid, { RoomGrid } from '../components/SeatingGrid';
import ExportButtons from '../components/ExportButtons';

const EMPTY_PLAN: SeatingPlan = {
  room_a: { room: 'A', label: '≤ 45 min', capacity: 32, assignments: [] },
  room_b: { room: 'B', label: '46–59 min', capacity: 32, assignments: [] },
  room_c: { room: 'C', label: '≥ 60 min', capacity: 32, assignments: [] },
};

const ROOM_LABEL: Record<'room_a' | 'room_b' | 'room_c', string> = {
  room_a: 'Raum A',
  room_b: 'Raum B',
  room_c: 'Raum C',
};

export default function DashboardPage() {
  const [plan, setPlan] = useState<SeatingPlan>(EMPTY_PLAN);
  const [activeRoom, setActiveRoom] = useState<'room_a' | 'room_b' | 'room_c'>('room_a');
  const navigate = useNavigate();

  const refresh = useCallback(async () => {
    try {
      setPlan(await api.getSeating());
    } catch {
      // session might be empty on first load
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function handleReset() {
    if (!confirm('Alle Einträge löschen? Die Stammdaten bleiben erhalten.')) return;
    await api.reset();
    await refresh();
  }

  async function handleDeleteEntry(entryId: string) {
    await api.deleteEntry(entryId);
    await refresh();
  }

  return (
    <>
      <div className="flex h-[calc(100vh-57px)]">
        {/* Left panel */}
        <div
          className="w-80 shrink-0 flex flex-col p-4 gap-4 border-r overflow-y-auto no-print"
          style={{ borderColor: 'var(--c-border)', background: 'var(--c-surface)' }}
        >
          <StudentForm onEntryAdded={refresh} plan={plan} />

          <div className="border-t pt-4 space-y-2" style={{ borderColor: 'var(--c-border)' }}>
            <ExportButtons activeRoom={activeRoom} />
            <button
              onClick={handleReset}
              className="w-full text-sm py-1.5 rounded-lg border transition-colors"
              style={{ borderColor: 'var(--c-border)', color: 'var(--c-text-secondary)' }}
            >
              Neue Sitzung
            </button>
            <button
              onClick={() => navigate('/')}
              className="w-full text-sm py-1.5 rounded-lg border transition-colors"
              style={{ borderColor: 'var(--c-border)', color: 'var(--c-text-secondary)' }}
            >
              ← Neue CSV hochladen
            </button>
          </div>
        </div>

        {/* Right panel */}
        <div className="flex-1 p-4 overflow-hidden print-active-room">
          {/* Print-only heading for single-room mode */}
          <div className="print-single-heading" style={{ display: 'none', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700 }}>
              {ROOM_LABEL[activeRoom]} — {plan[activeRoom].label} · {plan[activeRoom].assignments.length} Schüler
            </h2>
            <p style={{ fontSize: '0.75rem', color: '#78716c', marginTop: '0.25rem' }}>
              Nachschreiber — {new Date().toLocaleDateString('de-DE')}
            </p>
          </div>
          <SeatingGrid
            plan={plan}
            activeRoom={activeRoom}
            onActiveRoomChange={setActiveRoom}
            onDeleteEntry={handleDeleteEntry}
          />
        </div>
      </div>

      {/* Print-all section — hidden on screen, visible via @media print + data-print-mode="all" */}
      <PrintAllRooms plan={plan} />
    </>
  );
}

function PrintAllRooms({ plan }: { plan: SeatingPlan }) {
  const rooms = [
    { key: 'room_a' as const, label: 'Raum A' },
    { key: 'room_b' as const, label: 'Raum B' },
    { key: 'room_c' as const, label: 'Raum C' },
  ];
  const today = new Date().toLocaleDateString('de-DE');
  return (
    <div className="print-all-rooms">
      {rooms.map(({ key, label }) => (
        <div key={key} className="print-room-section">
          <div style={{ marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700 }}>
              {label} — {plan[key].label} · {plan[key].assignments.length} Schüler
            </h2>
            <p style={{ fontSize: '0.75rem', color: '#78716c', marginTop: '0.25rem' }}>
              Nachschreiber — {today}
            </p>
          </div>
          <RoomGrid room_plan={plan[key]} />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Verify build succeeds**

```bash
cd "/Users/tstolt/Library/CloudStorage/OneDrive-Persönlich/Documents/Github/Nachschreiber/frontend"
npm run build
```

Expected: `✓ built in Xs` — no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
cd ..
git add frontend/src/index.css frontend/src/components/SeatingGrid.tsx frontend/src/pages/DashboardPage.tsx frontend/src/App.tsx
git commit -m "feat: CSS print foundation, lift activeRoom state, export RoomGrid"
```

---

## Task 2: Print Buttons in ExportButtons

**Files:**
- Modify: `frontend/src/components/ExportButtons.tsx`

- [ ] **Step 1: Replace `ExportButtons.tsx` with print-button version**

```tsx
// frontend/src/components/ExportButtons.tsx
import { api } from '../api';

interface Props {
  activeRoom: 'room_a' | 'room_b' | 'room_c';
}

const ROOM_NAME: Record<'room_a' | 'room_b' | 'room_c', string> = {
  room_a: 'Raum A',
  room_b: 'Raum B',
  room_c: 'Raum C',
};

export default function ExportButtons({ activeRoom }: Props) {
  function download(format: 'excel' | 'word') {
    window.open(api.exportUrl(format), '_blank');
  }

  function doPrint(mode: 'single' | 'all') {
    document.body.setAttribute('data-print-mode', mode);
    window.onafterprint = () => document.body.removeAttribute('data-print-mode');
    window.print();
  }

  const downloadBtnStyle = {
    borderColor: 'var(--c-border)',
    background: 'var(--c-surface)',
    color: 'var(--c-text)',
  };
  const printBtnStyle = {
    borderColor: 'var(--c-accent)',
    background: 'transparent',
    color: 'var(--c-accent)',
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button onClick={() => download('excel')} className="flex-1 text-sm py-2 px-3 rounded-lg border font-medium" style={downloadBtnStyle}>
          📄 Excel
        </button>
        <button onClick={() => download('word')} className="flex-1 text-sm py-2 px-3 rounded-lg border font-medium" style={downloadBtnStyle}>
          📝 Word
        </button>
      </div>
      <div className="flex gap-2">
        <button onClick={() => doPrint('single')} className="flex-1 text-sm py-2 px-3 rounded-lg border font-medium" style={printBtnStyle}>
          🖨️ {ROOM_NAME[activeRoom]}
        </button>
        <button onClick={() => doPrint('all')} className="flex-1 text-sm py-2 px-3 rounded-lg border font-medium" style={printBtnStyle}>
          🖨️ Alle Räume
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build succeeds**

```bash
cd "/Users/tstolt/Library/CloudStorage/OneDrive-Persönlich/Documents/Github/Nachschreiber/frontend"
npm run build
```

Expected: `✓ built in Xs` — no TypeScript errors.

- [ ] **Step 3: Manual print test**

Start dev server:
```bash
# Terminal 1 — backend
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload

# Terminal 2 — frontend
cd frontend && npm run dev
```

1. Upload `beispiel_schueler.csv`, add a few entries
2. Click "🖨️ Raum A" → browser print dialog opens, preview shows light mode + active room grid, left panel + header are hidden
3. Click "🖨️ Alle Räume" → preview shows all 3 rooms, each on its own page

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ExportButtons.tsx
git commit -m "feat: print buttons for single room and all rooms"
```

---

## Task 3: Duplicate Warning in StudentForm

**Files:**
- Modify: `frontend/src/components/StudentForm.tsx`

- [ ] **Step 1: Replace `StudentForm.tsx` with warning version**

```tsx
// frontend/src/components/StudentForm.tsx
import { useState, useEffect } from 'react';
import { api } from '../api';
import type { Student, EntryCreate, SeatingPlan } from '../types';

interface Props {
  onEntryAdded: () => void;
  plan: SeatingPlan;
}

export default function StudentForm({ onEntryAdded, plan }: Props) {
  const [classes, setClasses] = useState<string[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [form, setForm] = useState<EntryCreate>({
    student_id: '', subject: '', duration_minutes: 45, aids: '', teacher: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { api.getClasses().then(setClasses); }, []);

  useEffect(() => {
    if (selectedClass) {
      api.getStudents(selectedClass).then(setStudents);
      setForm(f => ({ ...f, student_id: '' }));
    }
  }, [selectedClass]);

  function set<K extends keyof EntryCreate>(key: K, value: EntryCreate[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.createEntry(form);
      setForm(f => ({ ...f, student_id: '', subject: '', aids: '' }));
      onEntryAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  }

  // Derive existing assignments for the currently selected student from the live plan
  const existingAssignments = form.student_id
    ? [
        ...plan.room_a.assignments,
        ...plan.room_b.assignments,
        ...plan.room_c.assignments,
      ].filter(a => a.entry.student_id === form.student_id)
    : [];

  const hasWarning = existingAssignments.length > 0;

  const inputStyle = {
    background: 'var(--c-bg)',
    border: '1px solid var(--c-border)',
    color: 'var(--c-text)',
    borderRadius: '6px',
    padding: '6px 10px',
    width: '100%',
    fontSize: '0.875rem',
  } as const;

  const labelStyle = {
    fontSize: '0.75rem',
    color: 'var(--c-text-secondary)',
    marginBottom: '3px',
    display: 'block',
  } as const;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 h-full">
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--c-text-secondary)' }}>
        Schüler hinzufügen
      </p>

      <div>
        <label style={labelStyle}>Klasse</label>
        <select style={inputStyle} value={selectedClass} onChange={e => setSelectedClass(e.target.value)} required>
          <option value="">— Klasse wählen —</option>
          {classes.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div>
        <label style={labelStyle}>Schüler</label>
        <select style={inputStyle} value={form.student_id} onChange={e => set('student_id', e.target.value)} required disabled={!selectedClass}>
          <option value="">— Schüler wählen —</option>
          {students.map(s => (
            <option key={s.id} value={s.id}>{s.last_name}, {s.first_name}</option>
          ))}
        </select>
      </div>

      {/* Duplicate warning */}
      {hasWarning && (
        <div style={{
          background: 'rgba(245,158,11,0.12)',
          border: '1px solid rgba(245,158,11,0.4)',
          borderRadius: '6px',
          padding: '8px 10px',
        }}>
          <p style={{ fontWeight: 700, color: 'var(--c-accent)', fontSize: '0.8rem', marginBottom: '4px' }}>
            ⚠️ Bereits eingetragen:
          </p>
          {existingAssignments.map(a => (
            <p key={a.entry.id} style={{ fontSize: '0.75rem', color: 'var(--c-text-secondary)' }}>
              • {a.entry.subject} — Raum {a.entry.room}, Tisch {a.desk}
            </p>
          ))}
        </div>
      )}

      <div>
        <label style={labelStyle}>Fach</label>
        <input style={inputStyle} value={form.subject} onChange={e => set('subject', e.target.value)} placeholder="z.B. Mathematik" required />
      </div>

      <div>
        <label style={labelStyle}>Dauer (Minuten)</label>
        <input style={inputStyle} type="number" min={1} max={300} value={form.duration_minutes} onChange={e => set('duration_minutes', Number(e.target.value))} required />
        <p className="text-xs mt-1" style={{ color: 'var(--c-text-secondary)' }}>
          ≤45 → Raum A · 46–59 → Raum B · ≥60 → Raum C
        </p>
      </div>

      <div>
        <label style={labelStyle}>Hilfsmittel</label>
        <input style={inputStyle} value={form.aids} onChange={e => set('aids', e.target.value)} placeholder="z.B. Taschenrechner" />
      </div>

      <div>
        <label style={labelStyle}>Verantw. Lehrkraft</label>
        <input style={inputStyle} value={form.teacher} onChange={e => set('teacher', e.target.value)} placeholder="z.B. Fr. Schmidt" required />
      </div>

      {error && (
        <div className="text-xs rounded p-2" style={{ background: 'rgba(220,38,38,0.1)', color: 'var(--c-error)' }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-auto py-2 px-4 rounded-lg font-semibold text-sm transition-opacity disabled:opacity-50"
        style={hasWarning
          ? { background: 'transparent', border: '1.5px solid var(--c-accent)', color: 'var(--c-accent)' }
          : { background: 'var(--c-accent)', color: 'white' }
        }
      >
        {loading
          ? 'Wird eingetragen…'
          : hasWarning
            ? '⚠️ Trotzdem eintragen'
            : '+ Schüler eintragen'}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Verify build succeeds**

```bash
cd "/Users/tstolt/Library/CloudStorage/OneDrive-Persönlich/Documents/Github/Nachschreiber/frontend"
npm run build
```

Expected: `✓ built in Xs` — no TypeScript errors.

- [ ] **Step 3: Manual warning test**

With dev server running:
1. Upload CSV, add "Mueller, Anna" for "Mathematik, 45 min"
2. In the form, select the same class → select "Mueller, Anna" again
3. Expected: yellow warning box appears below the student dropdown showing "• Mathematik — Raum A, Tisch 1"
4. Expected: submit button shows "⚠️ Trotzdem eintragen" with amber outline style
5. Enter a different subject (e.g. "Biologie") → click "⚠️ Trotzdem eintragen"
6. Expected: second entry added successfully, warning now shows both entries
7. Enter the same subject "Mathematik" → click submit
8. Expected: red error "Mueller, Anna ist bereits für 'Mathematik' eingetragen" (409 from backend)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/StudentForm.tsx
git commit -m "feat: duplicate entry warning with confirmation in student form"
```

---

## Task 4: Deploy to Raspberry Pi

- [ ] **Step 1: Run full build locally**

```bash
cd "/Users/tstolt/Library/CloudStorage/OneDrive-Persönlich/Documents/Github/Nachschreiber/frontend"
npm run build
```

Expected: clean build, no errors.

- [ ] **Step 2: Push to GitHub**

```bash
cd ..
git push
```

- [ ] **Step 3: Deploy on Pi**

```bash
ssh pi@192.168.2.54 "cd Nachschreiber && git pull && docker compose up -d --build"
```

Expected: both containers rebuilt and running.

- [ ] **Step 4: Smoke test on Pi**

Open http://192.168.2.54:3002, upload `beispiel_schueler.csv`, test print and warning.
