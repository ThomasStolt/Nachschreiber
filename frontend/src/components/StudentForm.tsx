// frontend/src/components/StudentForm.tsx
import { useState, useEffect } from 'react';
import { api } from '../api';
import type { Student, EntryCreate, SeatingPlan } from '../types';
import Combobox from './Combobox';

interface Props {
  onEntryAdded: () => void;
  plan: SeatingPlan;
}

function countEntriesForStudent(plan: SeatingPlan, studentId: string): number {
  return [
    ...plan.room_a.assignments,
    ...plan.room_b.assignments,
    ...plan.room_c.assignments,
  ].filter(a => a.entry.student_id === studentId).length;
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
  const [teachers, setTeachers] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);

  useEffect(() => {
    api.getClasses().then(setClasses);
    api.getTeachers().then(setTeachers);
    api.getSubjects().then(setSubjects);
  }, []);

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

  async function handleDeleteStudent() {
    const selected = students.find(s => s.id === form.student_id);
    if (!selected) return;
    const entryCount = countEntriesForStudent(plan, selected.id);
    const msg = entryCount > 0
      ? `${selected.last_name}, ${selected.first_name} aus den Stammdaten löschen?\n\n${entryCount} Nachschreib-Eintrag/Einträge werden ebenfalls entfernt.`
      : `${selected.last_name}, ${selected.first_name} aus den Stammdaten löschen?`;
    if (!confirm(msg)) return;
    setError(null);
    try {
      await api.deleteStudent(selected.id);
      setForm(f => ({ ...f, student_id: '' }));
      const [updatedStudents, updatedClasses] = await Promise.all([
        selectedClass ? api.getStudents(selectedClass) : Promise.resolve([] as Student[]),
        api.getClasses(),
      ]);
      setStudents(updatedStudents);
      setClasses(updatedClasses);
      if (selectedClass && !updatedClasses.includes(selectedClass)) {
        setSelectedClass('');
      }
      onEntryAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Löschen fehlgeschlagen');
    }
  }

  // Derive existing seat assignments for the selected student from the live plan
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
        <div className="flex gap-1.5">
          <select
            style={{ ...inputStyle, flex: 1 }}
            value={form.student_id}
            onChange={e => set('student_id', e.target.value)}
            required
            disabled={!selectedClass}
          >
            <option value="">— Schüler wählen —</option>
            {students.map(s => (
              <option key={s.id} value={s.id}>{s.last_name}, {s.first_name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleDeleteStudent}
            disabled={!form.student_id}
            title="Schüler aus Stammdaten löschen"
            aria-label="Schüler aus Stammdaten löschen"
            className="shrink-0 rounded-md px-2.5 text-sm disabled:opacity-30"
            style={{
              background: 'rgba(220,38,38,0.08)',
              color: 'var(--c-error)',
              border: '1px solid rgba(220,38,38,0.3)',
              cursor: form.student_id ? 'pointer' : 'not-allowed',
            }}
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Duplicate warning — shown when selected student already has entries */}
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
        <Combobox
          style={inputStyle}
          value={form.subject}
          onChange={v => set('subject', v)}
          options={subjects}
          placeholder="z.B. Mathematik"
          required
        />
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
        <Combobox
          style={inputStyle}
          value={form.teacher}
          onChange={v => set('teacher', v)}
          options={teachers}
          placeholder="z.B. Fr. Schmidt"
          required
        />
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
