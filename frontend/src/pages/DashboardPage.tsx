// frontend/src/pages/DashboardPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { SeatingPlan } from '../types';
import StudentForm from '../components/StudentForm';
import SeatingGrid from '../components/SeatingGrid';
import ExportButtons from '../components/ExportButtons';

const EMPTY_PLAN: SeatingPlan = {
  room_a: { room: 'A', label: '≤ 45 min', capacity: 32, assignments: [] },
  room_b: { room: 'B', label: '46–59 min', capacity: 32, assignments: [] },
  room_c: { room: 'C', label: '≥ 60 min', capacity: 32, assignments: [] },
};

export default function DashboardPage() {
  const [plan, setPlan] = useState<SeatingPlan>(EMPTY_PLAN);
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
    <div className="flex h-[calc(100vh-57px)]">
      {/* Left panel */}
      <div
        className="w-80 shrink-0 flex flex-col p-4 gap-4 border-r overflow-y-auto"
        style={{ borderColor: 'var(--c-border)', background: 'var(--c-surface)' }}
      >
        <StudentForm onEntryAdded={refresh} />

        <div className="border-t pt-4 space-y-2" style={{ borderColor: 'var(--c-border)' }}>
          <ExportButtons />
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
      <div className="flex-1 p-4 overflow-hidden">
        <SeatingGrid plan={plan} onDeleteEntry={handleDeleteEntry} />
      </div>
    </div>
  );
}
