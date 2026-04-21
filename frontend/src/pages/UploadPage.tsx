import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function UploadPage() {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  async function handleFile(file: File) {
    setLoading(true);
    setError(null);
    try {
      await api.uploadCsv(file);
      navigate('/dashboard');
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
        {error && (
          <div className="rounded-lg p-3 text-sm" style={{ background: 'rgba(220,38,38,0.1)', color: 'var(--c-error)' }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
