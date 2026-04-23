// frontend/src/components/SeatingGrid.tsx
import { DndContext, useDraggable, useDroppable } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { SeatingPlan, RoomPlan, SeatAssignment } from '../types';

interface Props {
  plan: SeatingPlan;
  activeRoom: 'room_a' | 'room_b' | 'room_c';
  onActiveRoomChange: (room: 'room_a' | 'room_b' | 'room_c') => void;
  onDeleteEntry: (entryId: string) => void;
  clipboardEntry: SeatAssignment | null;
  onScissors: (assignment: SeatAssignment) => void;
  onCancelClipboard: () => void;
  onPaste: (desk: number, seat: number) => void;
  onDrop: (sourceEntryId: string, targetDesk: number, targetSeat: number) => void;
}

// ── Seat Slot ─────────────────────────────────────────────────────────────
interface SeatSlotProps {
  desk: number;
  seat: number;
  assignment: SeatAssignment | null;
  clipboardEntry: SeatAssignment | null;
  activeRoomLetter: 'A' | 'B' | 'C';
  onScissors: (a: SeatAssignment) => void;
  onPaste: (desk: number, seat: number) => void;
}

function SeatSlot({ desk, seat, assignment, clipboardEntry, activeRoomLetter, onScissors, onPaste }: SeatSlotProps) {
  const dropId = `${desk}-${seat}`;
  // dnd-kit requires non-empty id even when disabled
  const dragId = assignment ? `entry-${assignment.entry.id}` : `empty-${desk}-${seat}`;

  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: dropId });
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({
    id: dragId,
    disabled: !assignment || clipboardEntry !== null,
  });

  const dragStyle = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  // Paste target: empty slot always; occupied slot only in same room (for swap)
  const isPasteTarget = clipboardEntry !== null && (
    !assignment || activeRoomLetter === clipboardEntry.entry.room
  );

  const isClipboardSource = clipboardEntry?.entry.id === assignment?.entry.id;

  const slotStyle: React.CSSProperties = {
    flex: 1,
    borderRadius: '4px',
    padding: '3px 4px',
    minHeight: '2.25rem',
    position: 'relative',
    cursor: isPasteTarget ? 'pointer' : assignment && !clipboardEntry ? 'grab' : 'default',
    background: isClipboardSource
      ? 'rgba(245,158,11,0.08)'
      : assignment
        ? 'var(--c-bg)'
        : undefined,
    border: isPasteTarget
      ? '1.5px dashed var(--c-accent)'
      : isClipboardSource
        ? '1px dashed var(--c-accent)'
        : assignment
          ? undefined
          : '1px dashed var(--c-border)',
    opacity: isDragging ? 0.4 : 1,
    boxShadow: isOver && !isPasteTarget ? '0 0 0 2px var(--c-accent)' : undefined,
  };

  return (
    <div ref={setDropRef} style={{ flex: 1 }}>
      <div
        ref={assignment && !clipboardEntry ? setDragRef : null}
        style={{ ...slotStyle, ...dragStyle }}
        onClick={isPasteTarget ? () => onPaste(desk, seat) : undefined}
        {...(assignment && !clipboardEntry ? { ...attributes, ...listeners } : {})}
      >
        {assignment && !isClipboardSource ? (
          <>
            <p className="font-semibold truncate" style={{ fontSize: '0.7rem', paddingRight: '18px' }}>
              {assignment.student.last_name}, {assignment.student.first_name}
            </p>
            <p className="truncate" style={{ fontSize: '0.65rem', color: 'var(--c-text-secondary)' }}>
              {assignment.student.class_name} · {assignment.entry.subject} · {assignment.entry.duration_minutes} min
            </p>
            <button
              onClick={(e) => { e.stopPropagation(); onScissors(assignment); }}
              style={{
                position: 'absolute', top: '2px', right: '2px',
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '0.7rem', opacity: 0.5, padding: '1px', lineHeight: 1,
              }}
              title="Ausschneiden"
            >
              ✂️
            </button>
          </>
        ) : isClipboardSource ? (
          <p style={{ fontSize: '0.65rem', color: 'var(--c-accent)', textAlign: 'center', paddingTop: '0.4rem' }}>
            ✂️ ausgeschnitten
          </p>
        ) : isPasteTarget ? (
          <p style={{ fontSize: '0.65rem', color: 'var(--c-accent)', textAlign: 'center', paddingTop: '0.4rem' }}>
            📋 einsetzen
          </p>
        ) : (
          <p style={{ fontSize: '0.65rem', color: 'var(--c-muted)', textAlign: 'center', paddingTop: '0.4rem' }}>
            frei
          </p>
        )}
      </div>
    </div>
  );
}

// ── Desk Card ─────────────────────────────────────────────────────────────
interface DeskCardProps {
  desk: number;
  slots: [SeatAssignment | null, SeatAssignment | null];
  clipboardEntry: SeatAssignment | null;
  activeRoomLetter: 'A' | 'B' | 'C';
  onScissors: (a: SeatAssignment) => void;
  onPaste: (desk: number, seat: number) => void;
}

function DeskCard({ desk, slots, clipboardEntry, activeRoomLetter, onScissors, onPaste }: DeskCardProps) {
  const hasOccupied = slots.some(Boolean);
  return (
    <div
      className="rounded-lg p-2 text-xs"
      style={{
        background: 'var(--c-surface)',
        border: `1px ${hasOccupied ? 'solid' : 'dashed'} ${hasOccupied ? 'var(--c-accent)' : clipboardEntry ? 'rgba(245,158,11,0.4)' : 'var(--c-border)'}`,
      }}
    >
      <p className="font-semibold mb-1 uppercase tracking-wide" style={{ color: 'var(--c-text-secondary)', fontSize: '0.65rem' }}>
        Tisch {desk}
      </p>
      <div className="flex gap-1">
        {slots.map((a, i) => (
          <SeatSlot
            key={i}
            desk={desk}
            seat={i + 1}
            assignment={a}
            clipboardEntry={clipboardEntry}
            activeRoomLetter={activeRoomLetter}
            onScissors={onScissors}
            onPaste={onPaste}
          />
        ))}
      </div>
    </div>
  );
}

// ── Room Grid ─────────────────────────────────────────────────────────────
export function RoomGrid({
  room_plan,
  clipboardEntry = null,
  onScissors,
  onPaste,
  onDrop,
}: {
  room_plan: RoomPlan;
  clipboardEntry?: SeatAssignment | null;
  onScissors?: (a: SeatAssignment) => void;
  onPaste?: (desk: number, seat: number) => void;
  onDrop?: (sourceEntryId: string, targetDesk: number, targetSeat: number) => void;
}) {
  const assignmentMap = new Map<string, SeatAssignment>();
  for (const a of room_plan.assignments) {
    assignmentMap.set(`${a.desk}-${a.seat}`, a);
  }

  const desks = Array.from({ length: 16 }, (_, i) => {
    const desk = i + 1;
    return {
      desk,
      slots: [
        assignmentMap.get(`${desk}-1`) ?? null,
        assignmentMap.get(`${desk}-2`) ?? null,
      ] as [SeatAssignment | null, SeatAssignment | null],
    };
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || !onDrop) return;
    const entryId = (active.id as string).replace('entry-', '');
    const parts = (over.id as string).split('-');
    const desk = Number(parts[0]);
    const seat = Number(parts[1]);
    if (!isNaN(desk) && !isNaN(seat)) {
      onDrop(entryId, desk, seat);
    }
  }

  const noop = () => {};

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-4 gap-2">
        {desks.map(({ desk, slots }) => (
          <DeskCard
            key={desk}
            desk={desk}
            slots={slots}
            clipboardEntry={clipboardEntry}
            activeRoomLetter={room_plan.room}
            onScissors={onScissors ?? noop}
            onPaste={onPaste ?? noop}
          />
        ))}
      </div>
    </DndContext>
  );
}

// ── Clipboard Strip ───────────────────────────────────────────────────────
function ClipboardStrip({ assignment, onCancel }: { assignment: SeatAssignment; onCancel: () => void }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-2 text-sm no-print"
      style={{
        background: 'rgba(245,158,11,0.12)',
        borderBottom: '1px solid rgba(245,158,11,0.3)',
      }}
    >
      <span>📋</span>
      <span style={{ flex: 1 }}>
        <strong style={{ color: 'var(--c-accent)' }}>Zwischenablage:</strong>{' '}
        <span style={{ color: 'var(--c-text)' }}>
          {assignment.student.last_name}, {assignment.student.first_name}
        </span>{' '}
        <span style={{ color: 'var(--c-text-secondary)' }}>
          · {assignment.student.class_name} · {assignment.entry.subject} · {assignment.entry.duration_minutes} min
          {' '}(war: Raum {assignment.entry.room}, Tisch {assignment.desk})
        </span>
      </span>
      <button
        onClick={onCancel}
        className="text-sm px-2 py-0.5 rounded border"
        style={{ borderColor: 'var(--c-border)', color: 'var(--c-text-secondary)' }}
      >
        ✕ Abbrechen
      </button>
    </div>
  );
}

// ── SeatingGrid (main export) ─────────────────────────────────────────────
const ROOMS = [
  { key: 'room_a' as const, label: 'Raum A' },
  { key: 'room_b' as const, label: 'Raum B' },
  { key: 'room_c' as const, label: 'Raum C' },
];

export default function SeatingGrid({
  plan, activeRoom, onActiveRoomChange, onDeleteEntry: _onDeleteEntry,
  clipboardEntry, onScissors, onCancelClipboard, onPaste, onDrop,
}: Props) {
  const active = plan[activeRoom];

  return (
    <div className="flex flex-col h-full">
      {clipboardEntry && (
        <ClipboardStrip assignment={clipboardEntry} onCancel={onCancelClipboard} />
      )}

      <div className="flex gap-2 p-4 pb-2 no-print">
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

      <p className="px-4 text-xs pb-2 no-print" style={{ color: 'var(--c-text-secondary)' }}>
        {active.label} · {active.assignments.length} Schüler
        {clipboardEntry && <span style={{ color: 'var(--c-accent)' }}> · Zielplatz wählen oder Raum wechseln</span>}
      </p>

      <div className="overflow-y-auto flex-1 px-4 pb-4">
        <RoomGrid
          room_plan={active}
          clipboardEntry={clipboardEntry}
          onScissors={onScissors}
          onPaste={onPaste}
          onDrop={onDrop}
        />
      </div>
    </div>
  );
}
