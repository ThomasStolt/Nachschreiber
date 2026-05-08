// frontend/src/components/SeatingGrid.tsx
import { useState, useEffect } from 'react';
import { DndContext, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { SeatingPlan, RoomPlan, SeatAssignment } from '../types';

interface Props {
  plan: SeatingPlan;
  activeRoom: 'room_a' | 'room_b' | 'room_c';
  onActiveRoomChange: (room: 'room_a' | 'room_b' | 'room_c') => void;
  onDeleteEntry: (entryId: string, assignment: SeatAssignment) => void;
  onDrop: (sourceEntryId: string, targetDesk: number, targetSeat: number) => void;
  onMoveToRoom: (sourceEntryId: string, targetRoom: 'A' | 'B' | 'C') => void;
  onRenameRoom: (letter: 'A' | 'B' | 'C', newName: string) => void;
}

// ── Seat Slot ─────────────────────────────────────────────────────────────
interface SeatSlotProps {
  desk: number;
  seat: number;
  assignment: SeatAssignment | null;
  onDeleteEntry: (entryId: string, assignment: SeatAssignment) => void;
}

function SeatSlot({ desk, seat, assignment, onDeleteEntry }: SeatSlotProps) {
  const dropId = `${desk}-${seat}`;
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
    disabled: !assignment,
  });

  const dragStyle = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  const slotStyle: React.CSSProperties = {
    flex: 1,
    borderRadius: '4px',
    padding: '3px 4px',
    minHeight: '2.25rem',
    position: 'relative',
    cursor: assignment ? 'grab' : 'default',
    background: assignment ? 'var(--c-bg)' : undefined,
    border: isOver
      ? '1.5px solid var(--c-accent)'
      : assignment
        ? undefined
        : '1px dashed var(--c-border)',
    opacity: isDragging ? 0.4 : 1,
    boxShadow: isOver ? '0 0 0 1px var(--c-accent)' : undefined,
  };

  return (
    <div ref={setDropRef} style={{ flex: 1 }}>
      <div
        ref={assignment ? setDragRef : null}
        style={{ ...slotStyle, ...dragStyle }}
        {...(assignment ? { ...attributes, ...listeners } : {})}
      >
        {assignment ? (
          <>
            <p className="font-semibold truncate" style={{ fontSize: '0.7rem', paddingRight: '22px' }}>
              {assignment.student.last_name}, {assignment.student.first_name}
            </p>
            <p className="truncate" style={{ fontSize: '0.65rem', color: 'var(--c-text-secondary)' }}>
              {assignment.student.class_name} · {assignment.entry.subject} · {assignment.entry.duration_minutes} min
            </p>
            <button
              type="button"
              className="no-print"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onDeleteEntry(assignment.entry.id, assignment); }}
              aria-label="Aus Sitzplan entfernen"
              title="Aus Sitzplan entfernen"
              style={{
                position: 'absolute', top: '0', right: '0',
                background: 'var(--c-surface)', border: '1px solid var(--c-border)',
                borderRadius: '4px', cursor: 'pointer',
                fontSize: '0.8rem', padding: '1px 4px', lineHeight: 1,
              }}
            >
              🗑️
            </button>
          </>
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
  onDeleteEntry: (entryId: string, assignment: SeatAssignment) => void;
}

function DeskCard({ desk, slots, onDeleteEntry }: DeskCardProps) {
  const hasOccupied = slots.some(a => a !== null);
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
        {slots.map((a, i) => (
          <SeatSlot
            key={i}
            desk={desk}
            seat={i + 1}
            assignment={a}
            onDeleteEntry={onDeleteEntry}
          />
        ))}
      </div>
    </div>
  );
}

// ── Room Grid ─────────────────────────────────────────────────────────────
export function RoomGrid({
  room_plan,
  onDeleteEntry,
}: {
  room_plan: RoomPlan;
  onDeleteEntry?: (entryId: string, assignment: SeatAssignment) => void;
}) {
  const assignmentMap = new Map<string, SeatAssignment>();
  for (const a of room_plan.assignments) {
    assignmentMap.set(`${a.desk}-${a.seat}`, a);
  }

  // Tisch 1 unten rechts, Tisch 16 oben links.
  // Reading-Order durch das Grid (links→rechts, oben→unten) erzeugt die Reihenfolge:
  // 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1
  const desks = Array.from({ length: 16 }, (_, i) => {
    const row = Math.floor(i / 4);
    const col = i % 4;
    const desk = (3 - row) * 4 + (3 - col) + 1;
    return {
      desk,
      slots: [
        assignmentMap.get(`${desk}-1`) ?? null,
        assignmentMap.get(`${desk}-2`) ?? null,
      ] as [SeatAssignment | null, SeatAssignment | null],
    };
  });

  const noopDelete = onDeleteEntry ?? (() => {});

  return (
    <div className="grid grid-cols-4 gap-2">
      {desks.map(({ desk, slots }) => (
        <DeskCard
          key={desk}
          desk={desk}
          slots={slots}
          onDeleteEntry={noopDelete}
        />
      ))}
    </div>
  );
}

// ── Room Tab (droppable) ──────────────────────────────────────────────────
function RoomTab({
  roomKey, roomLetter, name, count, isActive, onClick, onRename,
}: {
  roomKey: 'room_a' | 'room_b' | 'room_c';
  roomLetter: 'A' | 'B' | 'C';
  name: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
  onRename: (letter: 'A' | 'B' | 'C', newName: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `room-${roomLetter}` });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  // Sync draft when external name changes (e.g. after refresh)
  useEffect(() => { setDraft(name); }, [name]);

  function commit() {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed === name) {
      return;
    }
    // empty → backend collapses to default
    onRename(roomLetter, trimmed);
  }

  function cancel() {
    setEditing(false);
    setDraft(name);
  }

  return (
    <button
      ref={setNodeRef}
      onClick={editing ? undefined : onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors"
      style={{
        background: isActive ? 'var(--c-bg)' : 'var(--c-surface)',
        color: isActive ? 'var(--c-text)' : 'var(--c-text-secondary)',
        border: isOver
          ? '2px dashed var(--c-accent)'
          : `1px solid var(--c-border)`,
        borderBottom: isActive ? '1px solid var(--c-bg)' : '1px solid var(--c-border)',
        borderTopLeftRadius: '8px',
        borderTopRightRadius: '8px',
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        boxShadow: isOver ? '0 0 0 2px rgba(245,158,11,0.3)' : undefined,
        cursor: editing ? 'text' : 'pointer',
        marginBottom: 0,
        position: 'relative',
        fontWeight: isActive ? 600 : 500,
      }}
      data-room-key={roomKey}
    >
      {editing ? (
        <input
          type="text"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={(e) => e.target.select()}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
            else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
          }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            background: 'var(--c-surface)',
            color: 'var(--c-text)',
            border: '1px solid var(--c-border)',
            borderRadius: '4px',
            padding: '0px 4px',
            fontSize: '0.875rem',
            fontWeight: 500,
            width: `${Math.max(draft.length, 6) + 1}ch`,
            outline: 'none',
          }}
        />
      ) : (
        <>
          <span>{name}</span>
          {isActive && (
            <span
              role="button"
              tabIndex={0}
              className="no-print"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setDraft(name); setEditing(true); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  setDraft(name);
                  setEditing(true);
                }
              }}
              aria-label={`Raum ${name} umbenennen`}
              title="Raum umbenennen"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.75rem',
                padding: '0 2px',
                lineHeight: 1,
                color: 'inherit',
                opacity: 0.85,
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              ✏️
            </span>
          )}
        </>
      )}
      <span className="text-xs px-1.5 py-0.5 rounded-full" style={{
        background: isActive ? 'var(--c-surface)' : 'var(--c-bg)',
        color: 'var(--c-text-secondary)',
      }}>
        {count}/32
      </span>
    </button>
  );
}

// ── SeatingGrid (main export) ─────────────────────────────────────────────
const ROOM_KEYS = ['room_a', 'room_b', 'room_c'] as const;
const ROOM_LETTER_BY_KEY: Record<'room_a' | 'room_b' | 'room_c', 'A' | 'B' | 'C'> = {
  room_a: 'A', room_b: 'B', room_c: 'C',
};

export default function SeatingGrid({
  plan, activeRoom, onActiveRoomChange,
  onDeleteEntry, onDrop, onMoveToRoom, onRenameRoom,
}: Props) {
  const active = plan[activeRoom];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;

    if (!activeId.startsWith('entry-')) return;
    const entryId = activeId.substring('entry-'.length);

    if (overId.startsWith('room-')) {
      const letter = overId.substring('room-'.length) as 'A' | 'B' | 'C';
      onMoveToRoom(entryId, letter);
      return;
    }

    const parts = overId.split('-');
    const desk = Number(parts[0]);
    const seat = Number(parts[1]);
    if (isNaN(desk) || isNaN(seat)) return;
    onDrop(entryId, desk, seat);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex flex-col h-full p-4">
        <div
          className="flex gap-1 no-print"
          style={{
            paddingLeft: '0.5rem',
            marginBottom: '-1px',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {ROOM_KEYS.map((key) => {
            const count = plan[key].assignments.length;
            return (
              <RoomTab
                key={key}
                roomKey={key}
                roomLetter={ROOM_LETTER_BY_KEY[key]}
                name={plan[key].name}
                count={count}
                isActive={activeRoom === key}
                onClick={() => onActiveRoomChange(key)}
                onRename={onRenameRoom}
              />
            );
          })}
        </div>

        <div
          className="flex-1 flex flex-col overflow-hidden"
          style={{
            background: 'var(--c-bg)',
            border: '1px solid var(--c-border)',
            borderRadius: '0 0 8px 8px',
            padding: '0.75rem',
          }}
        >
          <p className="text-xs pb-2 no-print" style={{ color: 'var(--c-text-secondary)' }}>
            {active.label} · {active.assignments.length} Schüler
          </p>

          <div className="overflow-y-auto flex-1">
            <RoomGrid
              room_plan={active}
              onDeleteEntry={onDeleteEntry}
            />
          </div>
        </div>
      </div>
    </DndContext>
  );
}
