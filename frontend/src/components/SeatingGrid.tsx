// frontend/src/components/SeatingGrid.tsx
import { DndContext, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { SeatingPlan, RoomPlan, SeatAssignment } from '../types';

interface Props {
  plan: SeatingPlan;
  activeRoom: 'room_a' | 'room_b' | 'room_c';
  onActiveRoomChange: (room: 'room_a' | 'room_b' | 'room_c') => void;
  onDeleteEntry?: (entryId: string) => void;
  onDeleteStudent?: (assignment: SeatAssignment) => void;
  clipboardEntries: SeatAssignment[];
  onScissors: (assignment: SeatAssignment) => void;
  onRemoveFromClipboard: (entryId: string) => void;
  onDrop: (sourceEntryId: string, targetDesk: number, targetSeat: number) => void;
}

// ── Seat Slot ─────────────────────────────────────────────────────────────
interface SeatSlotProps {
  desk: number;
  seat: number;
  assignment: SeatAssignment | null;
  clipboardEntryIds: Set<string>;
  onScissors: (a: SeatAssignment) => void;
  onDeleteStudent?: (a: SeatAssignment) => void;
}

function SeatSlot({ desk, seat, assignment, clipboardEntryIds, onScissors, onDeleteStudent }: SeatSlotProps) {
  const dropId = `${desk}-${seat}`;
  // dnd-kit requires non-empty id even when disabled
  const dragId = assignment ? `entry-${assignment.entry.id}` : `empty-${desk}-${seat}`;

  // Only true when THIS slot's entry is in the clipboard (fixes empty-slot bug)
  const isInClipboard = assignment ? clipboardEntryIds.has(assignment.entry.id) : false;

  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: dropId });
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({
    id: dragId,
    // Don't allow dragging the ghost source or empty slots
    disabled: !assignment || isInClipboard,
  });

  const dragStyle = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  const slotStyle: React.CSSProperties = {
    flex: 1,
    borderRadius: '4px',
    padding: '3px 4px',
    minHeight: '2.25rem',
    position: 'relative',
    cursor: assignment && !isInClipboard ? 'grab' : 'default',
    background: isInClipboard
      ? 'rgba(245,158,11,0.08)'
      : assignment
        ? 'var(--c-bg)'
        : undefined,
    border: isOver
      ? '1.5px solid var(--c-accent)'
      : isInClipboard
        ? '1px dashed var(--c-accent)'
        : assignment
          ? undefined
          : '1px dashed var(--c-border)',
    opacity: isDragging ? 0.4 : 1,
    boxShadow: isOver ? '0 0 0 1px var(--c-accent)' : undefined,
  };

  return (
    <div ref={setDropRef} style={{ flex: 1 }}>
      <div
        ref={assignment && !isInClipboard ? setDragRef : null}
        style={{ ...slotStyle, ...dragStyle }}
        {...(assignment && !isInClipboard ? { ...attributes, ...listeners } : {})}
      >
        {assignment && !isInClipboard ? (
          <>
            <p className="font-semibold truncate" style={{ fontSize: '0.7rem', paddingRight: onDeleteStudent ? '44px' : '22px' }}>
              {assignment.student.last_name}, {assignment.student.first_name}
            </p>
            <p className="truncate" style={{ fontSize: '0.65rem', color: 'var(--c-text-secondary)' }}>
              {assignment.student.class_name} · {assignment.entry.subject} · {assignment.entry.duration_minutes} min
            </p>
            <button
              type="button"
              className="no-print"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onScissors(assignment); }}
              aria-label="Ausschneiden"
              title="Ausschneiden"
              style={{
                position: 'absolute', top: '0', right: '0',
                background: 'var(--c-surface)', border: '1px solid var(--c-border)',
                borderRadius: '4px', cursor: 'pointer',
                fontSize: '0.8rem', padding: '1px 4px', lineHeight: 1,
              }}
            >
              ✂️
            </button>
            {onDeleteStudent && (
              <button
                type="button"
                className="no-print"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onDeleteStudent(assignment); }}
                aria-label="Schüler löschen"
                title="Schüler aus Stammdaten löschen"
                style={{
                  position: 'absolute', top: '0', right: '24px',
                  background: 'var(--c-surface)', border: '1px solid var(--c-border)',
                  borderRadius: '4px', cursor: 'pointer',
                  fontSize: '0.8rem', padding: '1px 4px', lineHeight: 1,
                }}
              >
                🗑️
              </button>
            )}
          </>
        ) : isInClipboard ? (
          <p style={{ fontSize: '0.65rem', color: 'var(--c-accent)', textAlign: 'center', paddingTop: '0.4rem' }}>
            ✂️ ausgeschnitten
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
  clipboardEntryIds: Set<string>;
  onScissors: (a: SeatAssignment) => void;
  onDeleteStudent?: (a: SeatAssignment) => void;
}

function DeskCard({ desk, slots, clipboardEntryIds, onScissors, onDeleteStudent }: DeskCardProps) {
  const hasOccupied = slots.some(a => a && !clipboardEntryIds.has(a.entry.id));
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
            clipboardEntryIds={clipboardEntryIds}
            onScissors={onScissors}
            onDeleteStudent={onDeleteStudent}
          />
        ))}
      </div>
    </div>
  );
}

// ── Room Grid ─────────────────────────────────────────────────────────────
export function RoomGrid({
  room_plan,
  clipboardEntryIds,
  onScissors,
  onDeleteStudent,
}: {
  room_plan: RoomPlan;
  clipboardEntryIds?: Set<string>;
  onScissors?: (a: SeatAssignment) => void;
  onDeleteStudent?: (a: SeatAssignment) => void;
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

  const ids = clipboardEntryIds ?? new Set<string>();
  const scissors = onScissors ?? (() => {});

  return (
    <div className="grid grid-cols-4 gap-2">
      {desks.map(({ desk, slots }) => (
        <DeskCard
          key={desk}
          desk={desk}
          slots={slots}
          clipboardEntryIds={ids}
          onScissors={scissors}
          onDeleteStudent={onDeleteStudent}
        />
      ))}
    </div>
  );
}

// ── Clipboard Card (draggable) ────────────────────────────────────────────
function ClipboardCard({
  assignment,
  onRemove,
}: {
  assignment: SeatAssignment;
  onRemove: (entryId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `clip-${assignment.entry.id}`,
  });
  const style: React.CSSProperties = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0.4 : 1,
    background: 'var(--c-surface)',
    border: '1px solid var(--c-accent)',
    borderRadius: '6px',
    padding: '4px 28px 4px 8px',
    fontSize: '0.75rem',
    cursor: 'grab',
    position: 'relative',
    display: 'inline-flex',
    flexDirection: 'column',
    gap: '1px',
    minWidth: '160px',
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <span style={{ fontWeight: 600, color: 'var(--c-text)' }}>
        {assignment.student.last_name}, {assignment.student.first_name}
      </span>
      <span style={{ color: 'var(--c-text-secondary)', fontSize: '0.7rem' }}>
        {assignment.student.class_name} · {assignment.entry.subject} · {assignment.entry.duration_minutes} min
      </span>
      <span style={{ color: 'var(--c-muted)', fontSize: '0.65rem' }}>
        war: Raum {assignment.entry.room}, Tisch {assignment.desk}
      </span>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onRemove(assignment.entry.id); }}
        aria-label="Aus Zwischenablage entfernen"
        title="Aus Zwischenablage entfernen"
        style={{
          position: 'absolute', top: '2px', right: '2px',
          background: 'var(--c-bg)', border: '1px solid var(--c-border)',
          borderRadius: '4px', cursor: 'pointer',
          fontSize: '0.7rem', padding: '0px 5px', lineHeight: 1.2,
          color: 'var(--c-text-secondary)',
        }}
      >
        ✕
      </button>
    </div>
  );
}

function ClipboardStrip({
  entries,
  onRemove,
}: {
  entries: SeatAssignment[];
  onRemove: (entryId: string) => void;
}) {
  return (
    <div
      className="px-4 py-2 no-print"
      style={{
        background: 'rgba(245,158,11,0.12)',
        borderBottom: '1px solid rgba(245,158,11,0.3)',
        display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
      }}
    >
      <span style={{ fontSize: '0.85rem' }}>
        📋 <strong style={{ color: 'var(--c-accent)' }}>Zwischenablage ({entries.length}):</strong>
      </span>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', flex: 1 }}>
        {entries.map(a => (
          <ClipboardCard key={a.entry.id} assignment={a} onRemove={onRemove} />
        ))}
      </div>
      <span style={{ fontSize: '0.7rem', color: 'var(--c-text-secondary)', fontStyle: 'italic' }}>
        Karten auf Zielplatz ziehen
      </span>
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
  plan, activeRoom, onActiveRoomChange,
  clipboardEntries, onScissors, onRemoveFromClipboard, onDrop,
  onDeleteStudent,
}: Props) {
  const active = plan[activeRoom];
  const clipboardEntryIds = new Set(clipboardEntries.map(e => e.entry.id));

  // Small activation distance so clicks on scissors / ✕ buttons don't become drags
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    const parts = overId.split('-');
    const desk = Number(parts[0]);
    const seat = Number(parts[1]);
    if (isNaN(desk) || isNaN(seat)) return;

    let entryId: string | null = null;
    if (activeId.startsWith('entry-')) entryId = activeId.substring('entry-'.length);
    else if (activeId.startsWith('clip-')) entryId = activeId.substring('clip-'.length);

    if (entryId) onDrop(entryId, desk, seat);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex flex-col h-full">
        {clipboardEntries.length > 0 && (
          <ClipboardStrip entries={clipboardEntries} onRemove={onRemoveFromClipboard} />
        )}

        <div className="flex gap-2 p-4 pb-2 no-print">
          {ROOMS.map(({ key, label }) => {
            const count = plan[key].assignments.filter(a => !clipboardEntryIds.has(a.entry.id)).length;
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
          {active.label} · {active.assignments.filter(a => !clipboardEntryIds.has(a.entry.id)).length} Schüler
        </p>

        <div className="overflow-y-auto flex-1 px-4 pb-4">
          <RoomGrid
            room_plan={active}
            clipboardEntryIds={clipboardEntryIds}
            onScissors={onScissors}
            onDeleteStudent={onDeleteStudent}
          />
        </div>
      </div>
    </DndContext>
  );
}
