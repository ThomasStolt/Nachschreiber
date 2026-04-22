// frontend/src/components/SeatingGrid.tsx
import { useState } from 'react';
import type { SeatingPlan, RoomPlan, SeatAssignment } from '../types';

interface Props {
  plan: SeatingPlan;
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

function RoomGrid({ room_plan }: { room_plan: RoomPlan }) {
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

export default function SeatingGrid({ plan, onDeleteEntry: _onDeleteEntry }: Props) {
  const [activeRoom, setActiveRoom] = useState<'room_a' | 'room_b' | 'room_c'>('room_a');

  const rooms: { key: 'room_a' | 'room_b' | 'room_c'; label: string }[] = [
    { key: 'room_a', label: 'Raum A' },
    { key: 'room_b', label: 'Raum B' },
    { key: 'room_c', label: 'Raum C' },
  ];

  const active = plan[activeRoom];

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex gap-2">
        {rooms.map(({ key, label }) => {
          const count = plan[key].assignments.length;
          const isActive = activeRoom === key;
          return (
            <button
              key={key}
              onClick={() => setActiveRoom(key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: isActive ? 'var(--c-accent)' : 'var(--c-surface)',
                color: isActive ? 'white' : 'var(--c-text-secondary)',
                border: isActive ? 'none' : '1px solid var(--c-border)',
              }}
            >
              {label}
              <span
                className="text-xs px-1.5 py-0.5 rounded-full"
                style={{ background: isActive ? 'rgba(255,255,255,0.2)' : 'var(--c-bg)' }}
              >
                {count}/32
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-xs" style={{ color: 'var(--c-text-secondary)' }}>
        {active.label} · {active.assignments.length} Schüler
      </p>

      <div className="overflow-y-auto flex-1">
        <RoomGrid room_plan={active} />
      </div>
    </div>
  );
}
