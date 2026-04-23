import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import UploadPage from './pages/UploadPage';
import DashboardPage from './pages/DashboardPage';
import pkg from '../package.json';

const VERSION = pkg.version;

function Header() {
  const navigate = useNavigate();
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));

  function toggleDark() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  }

  return (
    <header className="border-b px-6 py-3 flex items-center justify-between no-print" style={{ borderColor: 'var(--c-border)', background: 'var(--c-surface)' }}>
      <div className="flex items-baseline gap-2">
        <button onClick={() => navigate('/')} className="text-lg font-bold" style={{ fontFamily: "'Bricolage Grotesque', sans-serif", color: 'var(--c-text)' }}>
          Nachschreiber
        </button>
        <a
          href="https://github.com/ThomasStolt/Nachschreiber/blob/main/CHANGELOG.md"
          target="_blank"
          rel="noopener noreferrer"
          title="Changelog öffnen"
          style={{
            fontSize: '0.7rem',
            color: 'var(--c-text-secondary)',
            textDecoration: 'none',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            padding: '1px 6px',
            borderRadius: '4px',
            border: '1px solid var(--c-border)',
            background: 'var(--c-bg)',
          }}
        >
          v{VERSION}
        </a>
      </div>
      <button onClick={toggleDark} className="text-sm px-3 py-1 rounded-md border" style={{ borderColor: 'var(--c-border)', color: 'var(--c-text-secondary)' }}>
        {dark ? '☀️' : '🌙'}
      </button>
    </header>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--c-bg)' }}>
        <Header />
        <main className="flex-1 flex flex-col">
          <Routes>
            <Route path="/" element={<UploadPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
