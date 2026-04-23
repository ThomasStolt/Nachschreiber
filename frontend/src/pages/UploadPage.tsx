import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

type OptionalStatus = { kind: 'idle' } | { kind: 'loading' } | { kind: 'ok'; msg: string } | { kind: 'err'; msg: string };

function OptionalUpload({
  title,
  hint,
  accept,
  onUpload,
}: {
  title: string;
  hint: string;
  accept: string;
  onUpload: (file: File) => Promise<string>;
}) {
  const [status, setStatus] = useState<OptionalStatus>({ kind: 'idle' });
  const inputRef = useRef<HTMLInputElement>(null);

  async function handle(file: File) {
    setStatus({ kind: 'loading' });
    try {
      const msg = await onUpload(file);
      setStatus({ kind: 'ok', msg });
    } catch (e) {
      setStatus({ kind: 'err', msg: e instanceof Error ? e.message : 'Fehler' });
    }
  }

  return (
    <div className="rounded-lg p-4" style={{ border: '1px solid var(--c-border)', background: 'var(--c-surface)' }}>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-medium">{title}</p>
          <p className="text-xs" style={{ color: 'var(--c-text-secondary)' }}>{hint}</p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium"
          style={{ background: 'var(--c-accent)', color: 'white' }}
        >
          CSV wählen
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f); e.target.value = ''; }}
        />
      </div>
      {status.kind === 'loading' && (
        <p className="mt-2 text-xs" style={{ color: 'var(--c-text-secondary)' }}>Wird hochgeladen…</p>
      )}
      {status.kind === 'ok' && (
        <p className="mt-2 text-xs" style={{ color: 'var(--c-accent)' }}>✓ {status.msg}</p>
      )}
      {status.kind === 'err' && (
        <p className="mt-2 text-xs" style={{ color: 'var(--c-error)' }}>{status.msg}</p>
      )}
    </div>
  );
}

export default function UploadPage() {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [studentsOk, setStudentsOk] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  async function handleFile(file: File) {
    setLoading(true);
    setError(null);
    try {
      const r = await api.uploadCsv(file);
      setStudentsOk(true);
      // Do not auto-navigate — user may also upload teachers/subjects now.
      return r;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="w-full max-w-lg space-y-6">
        <div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
            Schülerdaten importieren
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--c-text-secondary)' }}>
            CSV-Datei mit den Spalten <code>Nachname;Vorname;Klasse</code> (Semikolon-getrennt)
          </p>
        </div>

        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
          className="cursor-pointer rounded-xl border-2 border-dashed p-12 text-center transition-colors"
          style={{
            borderColor: dragging ? 'var(--c-accent)' : 'var(--c-border)',
            background: dragging ? 'rgba(217,119,6,0.05)' : 'var(--c-surface)',
          }}
        >
          <p className="text-4xl mb-3">📂</p>
          <p className="font-medium">CSV-Datei hier ablegen</p>
          <p className="text-sm mt-1" style={{ color: 'var(--c-text-secondary)' }}>oder klicken zum Auswählen</p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>

        {loading && <p className="text-center text-sm" style={{ color: 'var(--c-text-secondary)' }}>Wird hochgeladen…</p>}
        {studentsOk && (
          <p className="text-center text-sm" style={{ color: 'var(--c-accent)' }}>✓ Schülerliste importiert</p>
        )}
        {error && (
          <div className="rounded-lg p-3 text-sm" style={{ background: 'rgba(220,38,38,0.1)', color: 'var(--c-error)' }}>
            {error}
          </div>
        )}

        <div className="space-y-3 pt-2">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--c-text-secondary)' }}>
            Optionale Listen
          </p>
          <OptionalUpload
            title="Lehrkräfte-Liste"
            hint="CSV mit Spalte »Lehrkraft« — für Autocomplete im Formular"
            accept=".csv"
            onUpload={async (f) => {
              const r = await api.uploadTeachers(f);
              return `${r.teachers} Lehrkräfte importiert`;
            }}
          />
          <OptionalUpload
            title="Fächer-Liste"
            hint="CSV mit Spalte »Fach« — für Autocomplete im Formular"
            accept=".csv"
            onUpload={async (f) => {
              const r = await api.uploadSubjects(f);
              return `${r.subjects} Fächer importiert`;
            }}
          />
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
