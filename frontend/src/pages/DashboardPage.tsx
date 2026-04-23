// frontend/src/pages/DashboardPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { SeatingPlan } from '../types';
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

const PRINT_ROOMS = [
  { key: 'room_a' as const, label: 'Raum A' },
  { key: 'room_b' as const, label: 'Raum B' },
  { key: 'room_c' as const, label: 'Raum C' },
];

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

  const today = new Date().toLocaleDateString('de-DE');

  return (
    <>
      <div className="flex h-[calc(100vh-57px)]">
        {/* Left panel — hidden in print */}
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

        {/* Right panel — shown in single-room print mode */}
        <div className="flex-1 p-4 overflow-hidden print-active-room">
          {/* Print-only heading, hidden on screen */}
          <div className="print-single-heading" style={{ display: 'none', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700 }}>
              {ROOM_LABEL[activeRoom]} — {plan[activeRoom].label} · {plan[activeRoom].assignments.length} Schüler
            </h2>
            <p style={{ fontSize: '0.75rem', color: '#78716c', marginTop: '0.25rem' }}>
              Nachschreiber — {today}
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

      {/* Print-all section — hidden on screen, visible in @media print with data-print-mode="all" */}
      <div className="print-all-rooms">
        {PRINT_ROOMS.map(({ key, label }) => (
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
    </>
  );
}
