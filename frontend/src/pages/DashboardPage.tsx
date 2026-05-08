// frontend/src/pages/DashboardPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { SeatingPlan, SeatAssignment } from '../types';
import StudentForm from '../components/StudentForm';
import SeatingGrid, { RoomGrid } from '../components/SeatingGrid';
import ExportButtons from '../components/ExportButtons';

const EMPTY_PLAN: SeatingPlan = {
  room_a: { room: 'A', name: 'Raum 1', label: '≤ 45 min', capacity: 32, assignments: [] },
  room_b: { room: 'B', name: 'Raum 2', label: '46–59 min', capacity: 32, assignments: [] },
  room_c: { room: 'C', name: 'Raum 3', label: '≥ 60 min', capacity: 32, assignments: [] },
};

const ROOM_LETTER: Record<'room_a' | 'room_b' | 'room_c', 'A' | 'B' | 'C'> = {
  room_a: 'A', room_b: 'B', room_c: 'C',
};

const ROOM_KEY: Record<'A' | 'B' | 'C', 'room_a' | 'room_b' | 'room_c'> = {
  A: 'room_a', B: 'room_b', C: 'room_c',
};

function findNextFreeSeat(plan: SeatingPlan, room: 'A' | 'B' | 'C'): { desk: number; seat: number } | null {
  const occupied = new Set(
    plan[ROOM_KEY[room]].assignments.map(a => `${a.desk}-${a.seat}`)
  );
  for (let i = 0; i < 32; i++) {
    const desk = Math.floor(i / 2) + 1;
    const seat = (i % 2) + 1;
    if (!occupied.has(`${desk}-${seat}`)) return { desk, seat };
  }
  return null;
}

const PRINT_ROOM_KEYS = ['room_a', 'room_b', 'room_c'] as const;

export default function DashboardPage() {
  const [plan, setPlan] = useState<SeatingPlan>(EMPTY_PLAN);
  const [activeRoom, setActiveRoom] = useState<'room_a' | 'room_b' | 'room_c'>('room_a');
  const navigate = useNavigate();

  const refresh = useCallback(async () => {
    try { setPlan(await api.getSeating()); } catch { /* empty on first load */ }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function handleReset() {
    if (!confirm('Alle Einträge löschen? Die Stammdaten bleiben erhalten.')) return;
    await api.reset();
    await refresh();
  }

  async function handleDeleteEntry(entryId: string, assignment: SeatAssignment) {
    const name = `${assignment.student.last_name}, ${assignment.student.first_name}`;
    if (!confirm(`${name} aus dem Sitzplan entfernen?\n\nDie Stammdaten bleiben erhalten.`)) return;
    await api.deleteEntry(entryId);
    await refresh();
  }

  // Drop handler: seat-to-seat move within a room
  async function handleDrop(sourceEntryId: string, targetDesk: number, targetSeat: number) {
    try {
      await api.moveEntry(sourceEntryId, {
        desk: targetDesk,
        seat: targetSeat,
        room: ROOM_LETTER[activeRoom],
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler beim Verschieben');
    }
    await refresh();
  }

  // Drop on room tab: move to next free seat in that room
  async function handleMoveToRoom(sourceEntryId: string, targetRoom: 'A' | 'B' | 'C') {
    const allAssignments = [
      ...plan.room_a.assignments,
      ...plan.room_b.assignments,
      ...plan.room_c.assignments,
    ];
    const source = allAssignments.find(a => a.entry.id === sourceEntryId);
    if (source && source.entry.room === targetRoom) return;

    const free = findNextFreeSeat(plan, targetRoom);
    if (!free) {
      alert(`${plan[ROOM_KEY[targetRoom]].name} ist voll (32/32 Plätze belegt).`);
      return;
    }
    try {
      await api.moveEntry(sourceEntryId, { desk: free.desk, seat: free.seat, room: targetRoom });
      setActiveRoom(ROOM_KEY[targetRoom]);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler beim Verschieben');
    }
    await refresh();
  }

  async function handleRenameRoom(letter: 'A' | 'B' | 'C', newName: string) {
    const trimmed = newName.trim();
    // empty → backend collapses to default; we still pass it through
    const labels = {
      A: plan.room_a.name,
      B: plan.room_b.name,
      C: plan.room_c.name,
      [letter]: trimmed,
    };
    try {
      await api.putRoomLabels(labels);
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Umbenennen fehlgeschlagen');
    }
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
            <ExportButtons activeRoomName={plan[activeRoom].name} />
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
              {plan[activeRoom].name} — {plan[activeRoom].label} · {plan[activeRoom].assignments.length} Schüler
            </h2>
            <p style={{ fontSize: '0.75rem', color: '#78716c', marginTop: '0.25rem' }}>Nachschreiber — {today}</p>
          </div>
          <SeatingGrid
            plan={plan}
            activeRoom={activeRoom}
            onActiveRoomChange={setActiveRoom}
            onDeleteEntry={handleDeleteEntry}
            onDrop={handleDrop}
            onMoveToRoom={handleMoveToRoom}
            onRenameRoom={handleRenameRoom}
          />
        </div>
      </div>

      <div className="print-all-rooms">
        {PRINT_ROOM_KEYS.map((key) => (
          <div key={key} className="print-room-section">
            <div style={{ marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700 }}>
                {plan[key].name} — {plan[key].label} · {plan[key].assignments.length} Schüler
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
