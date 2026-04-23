// frontend/src/pages/DashboardPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { SeatingPlan, SeatAssignment } from '../types';
import StudentForm from '../components/StudentForm';
import SeatingGrid, { RoomGrid } from '../components/SeatingGrid';
import ExportButtons from '../components/ExportButtons';

const EMPTY_PLAN: SeatingPlan = {
  room_a: { room: 'A', label: '≤ 45 min', capacity: 32, assignments: [] },
  room_b: { room: 'B', label: '46–59 min', capacity: 32, assignments: [] },
  room_c: { room: 'C', label: '≥ 60 min', capacity: 32, assignments: [] },
};

const ROOM_LABEL: Record<'room_a' | 'room_b' | 'room_c', string> = {
  room_a: 'Raum A', room_b: 'Raum B', room_c: 'Raum C',
};

const ROOM_LETTER: Record<'room_a' | 'room_b' | 'room_c', 'A' | 'B' | 'C'> = {
  room_a: 'A', room_b: 'B', room_c: 'C',
};

const PRINT_ROOMS = [
  { key: 'room_a' as const, label: 'Raum A' },
  { key: 'room_b' as const, label: 'Raum B' },
  { key: 'room_c' as const, label: 'Raum C' },
];

export default function DashboardPage() {
  const [plan, setPlan] = useState<SeatingPlan>(EMPTY_PLAN);
  const [activeRoom, setActiveRoom] = useState<'room_a' | 'room_b' | 'room_c'>('room_a');
  const [clipboardEntry, setClipboardEntry] = useState<SeatAssignment | null>(null);
  const navigate = useNavigate();

  const refresh = useCallback(async () => {
    try { setPlan(await api.getSeating()); } catch { /* empty on first load */ }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function handleReset() {
    if (!confirm('Alle Einträge löschen? Die Stammdaten bleiben erhalten.')) return;
    await api.reset();
    setClipboardEntry(null);
    await refresh();
  }

  async function handleDeleteEntry(entryId: string) {
    await api.deleteEntry(entryId);
    if (clipboardEntry?.entry.id === entryId) setClipboardEntry(null);
    await refresh();
  }

  async function handleDrop(sourceEntryId: string, targetDesk: number, targetSeat: number) {
    await api.moveEntry(sourceEntryId, {
      desk: targetDesk,
      seat: targetSeat,
      room: ROOM_LETTER[activeRoom],
    });
    await refresh();
  }

  async function handlePaste(targetDesk: number, targetSeat: number) {
    if (!clipboardEntry) return;
    await api.moveEntry(clipboardEntry.entry.id, {
      desk: targetDesk,
      seat: targetSeat,
      room: ROOM_LETTER[activeRoom],
    });
    setClipboardEntry(null);
    await refresh();
  }

  const today = new Date().toLocaleDateString('de-DE');

  return (
    <>
      <div className="flex h-[calc(100vh-57px)]">
        <div
          className="w-80 shrink-0 flex flex-col p-4 gap-4 border-r overflow-y-auto no-print"
          style={{ borderColor: 'var(--c-border)', background: 'var(--c-surface)' }}
        >
          <StudentForm onEntryAdded={refresh} plan={plan} />
          <div className="border-t pt-4 space-y-2" style={{ borderColor: 'var(--c-border)' }}>
            <ExportButtons activeRoom={activeRoom} />
            <button onClick={handleReset} className="w-full text-sm py-1.5 rounded-lg border transition-colors" style={{ borderColor: 'var(--c-border)', color: 'var(--c-text-secondary)' }}>
              Neue Sitzung
            </button>
            <button onClick={() => navigate('/')} className="w-full text-sm py-1.5 rounded-lg border transition-colors" style={{ borderColor: 'var(--c-border)', color: 'var(--c-text-secondary)' }}>
              ← Neue CSV hochladen
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden print-active-room flex flex-col">
          <div className="print-single-heading p-4 pb-0" style={{ display: 'none' }}>
            <h2 style={{ fontSize: '1.25rem', fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700 }}>
              {ROOM_LABEL[activeRoom]} — {plan[activeRoom].label} · {plan[activeRoom].assignments.length} Schüler
            </h2>
            <p style={{ fontSize: '0.75rem', color: '#78716c', marginTop: '0.25rem' }}>Nachschreiber — {today}</p>
          </div>
          <SeatingGrid
            plan={plan}
            activeRoom={activeRoom}
            onActiveRoomChange={setActiveRoom}
            onDeleteEntry={handleDeleteEntry}
            clipboardEntry={clipboardEntry}
            onScissors={setClipboardEntry}
            onCancelClipboard={() => setClipboardEntry(null)}
            onPaste={handlePaste}
            onDrop={handleDrop}
          />
        </div>
      </div>

      <div className="print-all-rooms">
        {PRINT_ROOMS.map(({ key, label }) => (
          <div key={key} className="print-room-section">
            <div style={{ marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700 }}>
                {label} — {plan[key].label} · {plan[key].assignments.length} Schüler
              </h2>
              <p style={{ fontSize: '0.75rem', color: '#78716c', marginTop: '0.25rem' }}>Nachschreiber — {today}</p>
            </div>
            <RoomGrid room_plan={plan[key]} />
          </div>
        ))}
      </div>
    </>
  );
}
