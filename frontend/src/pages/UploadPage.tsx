import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { RoomLabels } from '../types';

const ROOM_DURATION_LABEL: Record<'A' | 'B' | 'C', string> = {
  A: '≤ 45 min',
  B: '46–59 min',
  C: '≥ 60 min',
};

const DEFAULT_ROOM_LABELS: RoomLabels = { A: 'Raum A', B: 'Raum B', C: 'Raum C' };

type Status = { kind: 'idle' } | { kind: 'loading' } | { kind: 'ok'; msg: string } | { kind: 'err'; msg: string };

function DropZone({ onFile, busy }: { onFile: (f: File) => void; busy?: boolean }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files[0];
        if (f) onFile(f);
      }}
      className="cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors"
      style={{
        borderColor: dragging ? 'var(--c-accent)' : 'var(--c-border)',
        background: dragging ? 'rgba(217,119,6,0.05)' : 'var(--c-surface)',
        opacity: busy ? 0.6 : 1,
      }}
    >
      <p className="text-4xl mb-2">📂</p>
      <p className="font-medium text-sm">CSV-Datei hier ablegen</p>
      <p className="text-xs mt-1" style={{ color: 'var(--c-text-secondary)' }}>
        oder klicken zum Auswählen
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }}
      />
    </div>
  );
}

function StatusLine({ status }: { status: Status }) {
  if (status.kind === 'idle') return null;
  if (status.kind === 'loading') {
    return <p className="text-xs" style={{ color: 'var(--c-text-secondary)' }}>Wird hochgeladen…</p>;
  }
  if (status.kind === 'ok') {
    return <p className="text-xs" style={{ color: 'var(--c-accent)' }}>✓ {status.msg}</p>;
  }
  return <p className="text-xs" style={{ color: 'var(--c-error)' }}>{status.msg}</p>;
}

function EditableList({
  items,
  onSave,
  placeholder,
}: {
  items: string[];
  onSave: (next: string[]) => Promise<void>;
  placeholder: string;
}) {
  const [newItem, setNewItem] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function save(next: string[]) {
    setError(null);
    try {
      await onSave(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler');
    }
  }

  function add() {
    const v = newItem.trim();
    if (!v) return;
    if (items.includes(v)) { setNewItem(''); return; }
    void save([...items, v]);
    setNewItem('');
  }

  function remove(i: number) {
    void save(items.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 min-h-[1.5rem]">
        {items.length === 0 && (
          <p className="text-xs italic" style={{ color: 'var(--c-text-secondary)' }}>— leer —</p>
        )}
        {items.map((item, i) => (
          <span
            key={item}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs"
            style={{
              background: 'rgba(217,119,6,0.12)',
              border: '1px solid rgba(217,119,6,0.3)',
              color: 'var(--c-text)',
            }}
          >
            {item}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); remove(i); }}
              aria-label={`${item} entfernen`}
              className="leading-none text-sm font-bold"
              style={{ color: 'var(--c-text-secondary)', cursor: 'pointer' }}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="flex-1"
          style={{
            background: 'var(--c-bg)',
            border: '1px solid var(--c-border)',
            color: 'var(--c-text)',
            borderRadius: '6px',
            padding: '4px 8px',
            fontSize: '0.75rem',
          }}
        />
        <button
          type="button"
          onClick={add}
          disabled={!newItem.trim()}
          className="rounded-md px-2.5 py-1 text-xs font-medium disabled:opacity-40"
          style={{ background: 'var(--c-accent)', color: 'white' }}
        >
          +
        </button>
      </div>
      {error && (
        <p className="text-xs" style={{ color: 'var(--c-error)' }}>{error}</p>
      )}
    </div>
  );
}

export default function UploadPage() {
  const [studentsOk, setStudentsOk] = useState(false);
  const [studentStatus, setStudentStatus] = useState<Status>({ kind: 'idle' });
  const [teacherStatus, setTeacherStatus] = useState<Status>({ kind: 'idle' });
  const [subjectStatus, setSubjectStatus] = useState<Status>({ kind: 'idle' });
  const [teachers, setTeachers] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [roomLabels, setRoomLabels] = useState<RoomLabels>(DEFAULT_ROOM_LABELS);
  const navigate = useNavigate();

  useEffect(() => {
    api.getTeachers().then(setTeachers).catch(() => {});
    api.getSubjects().then(setSubjects).catch(() => {});
    api.getRoomLabels().then(setRoomLabels).catch(() => {});
  }, []);

  async function commitRoomLabel(room: 'A' | 'B' | 'C', value: string) {
    const next: RoomLabels = { ...roomLabels, [room]: value };
    setRoomLabels(next);
    try {
      const saved = await api.putRoomLabels(next);
      setRoomLabels(saved);
    } catch { /* silent — default fallback applies server-side */ }
  }

  async function uploadStudents(file: File) {
    setStudentStatus({ kind: 'loading' });
    try {
      const r = await api.uploadCsv(file);
      setStudentsOk(true);
      setStudentStatus({ kind: 'ok', msg: `${r.students} Schüler importiert` });
    } catch (e) {
      setStudentStatus({ kind: 'err', msg: e instanceof Error ? e.message : 'Fehler' });
    }
  }

  async function uploadTeachers(file: File) {
    setTeacherStatus({ kind: 'loading' });
    try {
      const r = await api.uploadTeachers(file);
      const latest = await api.getTeachers();
      setTeachers(latest);
      setTeacherStatus({ kind: 'ok', msg: `${r.teachers} Lehrkräfte importiert` });
    } catch (e) {
      setTeacherStatus({ kind: 'err', msg: e instanceof Error ? e.message : 'Fehler' });
    }
  }

  async function uploadSubjects(file: File) {
    setSubjectStatus({ kind: 'loading' });
    try {
      const r = await api.uploadSubjects(file);
      const latest = await api.getSubjects();
      setSubjects(latest);
      setSubjectStatus({ kind: 'ok', msg: `${r.subjects} Fächer importiert` });
    } catch (e) {
      setSubjectStatus({ kind: 'err', msg: e instanceof Error ? e.message : 'Fehler' });
    }
  }

  const columnHeading = "text-base font-semibold";
  const columnHint = { color: 'var(--c-text-secondary)', fontSize: '0.75rem' } as const;

  return (
    <div className="flex-1 p-8">
      <div className="w-full max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
            Daten importieren
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--c-text-secondary)' }}>
            CSV-Dateien hochladen oder Listen manuell pflegen.
          </p>
        </div>

        <div className="rounded-lg p-4" style={{ border: '1px solid var(--c-border)', background: 'var(--c-surface)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--c-text-secondary)' }}>
            Raumbezeichnungen
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(['A', 'B', 'C'] as const).map((room) => (
              <label key={room} className="flex flex-col gap-1">
                <span className="text-xs" style={{ color: 'var(--c-text-secondary)' }}>
                  Raum {room} ({ROOM_DURATION_LABEL[room]})
                </span>
                <input
                  type="text"
                  value={roomLabels[room]}
                  onChange={(e) => setRoomLabels({ ...roomLabels, [room]: e.target.value })}
                  onBlur={(e) => commitRoomLabel(room, e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
                  placeholder={DEFAULT_ROOM_LABELS[room]}
                  style={{
                    background: 'var(--c-bg)',
                    border: '1px solid var(--c-border)',
                    color: 'var(--c-text)',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    fontSize: '0.875rem',
                  }}
                />
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Schüler */}
          <div className="space-y-3">
            <div>
              <h2 className={columnHeading}>Schüler</h2>
              <p style={columnHint}>
                Spalten: <code>Nachname;Vorname;Klasse</code>
              </p>
            </div>
            <DropZone onFile={uploadStudents} busy={studentStatus.kind === 'loading'} />
            <StatusLine status={studentStatus} />
          </div>

          {/* Lehrkräfte */}
          <div className="space-y-3">
            <div>
              <h2 className={columnHeading}>Lehrkräfte</h2>
              <p style={columnHint}>
                Spalte: <code>Lehrkraft</code>
              </p>
            </div>
            <DropZone onFile={uploadTeachers} busy={teacherStatus.kind === 'loading'} />
            <StatusLine status={teacherStatus} />
            <EditableList
              items={teachers}
              onSave={async (next) => {
                const latest = await api.putTeachers(next);
                setTeachers(latest);
              }}
              placeholder="neue Lehrkraft…"
            />
          </div>

          {/* Fächer */}
          <div className="space-y-3">
            <div>
              <h2 className={columnHeading}>Fächer</h2>
              <p style={columnHint}>
                Spalte: <code>Fach</code>
              </p>
            </div>
            <DropZone onFile={uploadSubjects} busy={subjectStatus.kind === 'loading'} />
            <StatusLine status={subjectStatus} />
            <EditableList
              items={subjects}
              onSave={async (next) => {
                const latest = await api.putSubjects(next);
                setSubjects(latest);
              }}
              placeholder="neues Fach…"
            />
          </div>
        </div>

        {studentsOk && (
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="w-full rounded-lg py-2 px-4 font-semibold text-sm"
            style={{ background: 'var(--c-accent)', color: 'white' }}
          >
            Weiter zum Dashboard →
          </button>
        )}
      </div>
    </div>
  );
}
