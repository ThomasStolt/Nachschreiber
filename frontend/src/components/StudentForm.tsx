// frontend/src/components/StudentForm.tsx
import { useState, useEffect } from 'react';
import { api } from '../api';
import type { Student, EntryCreate } from '../types';

import type { SeatingPlan } from '../types';

interface Props {
  onEntryAdded: () => void;
  plan?: SeatingPlan; // TODO: Task 3 replaces this file — plan will be required and used for duplicate warning
}

export default function StudentForm({ onEntryAdded }: Props) {
  const [classes, setClasses] = useState<string[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [form, setForm] = useState<EntryCreate>({
    student_id: '', subject: '', duration_minutes: 45, aids: '', teacher: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { api.getClasses().then(setClasses); }, []);

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

  const inputStyle = {
    background: 'var(--c-bg)',
    border: '1px solid var(--c-border)',
    color: 'var(--c-text)',
    borderRadius: '6px',
    padding: '6px 10px',
    width: '100%',
    fontSize: '0.875rem',
  } as const;

  const labelStyle = { fontSize: '0.75rem', color: 'var(--c-text-secondary)', marginBottom: '3px', display: 'block' } as const;

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
        <select style={inputStyle} value={form.student_id} onChange={e => set('student_id', e.target.value)} required disabled={!selectedClass}>
          <option value="">— Schüler wählen —</option>
          {students.map(s => (
            <option key={s.id} value={s.id}>{s.last_name}, {s.first_name}</option>
          ))}
        </select>
      </div>

      <div>
        <label style={labelStyle}>Fach</label>
        <input style={inputStyle} value={form.subject} onChange={e => set('subject', e.target.value)} placeholder="z.B. Mathematik" required />
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
        <input style={inputStyle} value={form.teacher} onChange={e => set('teacher', e.target.value)} placeholder="z.B. Fr. Schmidt" required />
      </div>

      {error && (
        <div className="text-xs rounded p-2" style={{ background: 'rgba(220,38,38,0.1)', color: 'var(--c-error)' }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-auto py-2 px-4 rounded-lg font-semibold text-sm text-white transition-opacity disabled:opacity-50"
        style={{ background: 'var(--c-accent)' }}
      >
        {loading ? 'Wird eingetragen…' : '+ Schüler eintragen'}
      </button>
    </form>
  );
}
