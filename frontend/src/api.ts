import type { Student, Entry, EntryCreate, SeatingPlan } from './types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...init });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.detail ?? `HTTP ${r.status}`);
  }
  return r.json() as Promise<T>;
}

export const api = {
  uploadCsv: async (file: File): Promise<{ students: number }> => {
    const form = new FormData();
    form.append('file', file);
    const r = await fetch('/api/upload', { method: 'POST', body: form });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      throw new Error(body.detail ?? `HTTP ${r.status}`);
    }
    return r.json();
  },

  getClasses: () => request<string[]>('/api/classes'),
  getStudents: (className?: string) =>
    request<Student[]>(className ? `/api/students?class_name=${encodeURIComponent(className)}` : '/api/students'),
  getEntries: () => request<Entry[]>('/api/entries'),
  createEntry: (body: EntryCreate) =>
    request<Entry>('/api/entries', { method: 'POST', body: JSON.stringify(body) }),
  deleteEntry: async (id: string): Promise<void> => {
    const r = await fetch(`/api/entries/${id}`, { method: 'DELETE' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
  },
  getSeating: () => request<SeatingPlan>('/api/seating'),
  reset: () => request<{ entries: number }>('/api/reset', { method: 'POST' }),
  exportUrl: (format: 'excel' | 'word') => `/api/export/${format}`,
};
