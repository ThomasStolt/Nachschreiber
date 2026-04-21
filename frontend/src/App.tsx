import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import UploadPage from './pages/UploadPage';
import DashboardPage from './pages/DashboardPage';

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
    <header className="border-b px-6 py-3 flex items-center justify-between" style={{ borderColor: 'var(--c-border)', background: 'var(--c-surface)' }}>
      <button onClick={() => navigate('/')} className="text-lg font-bold" style={{ fontFamily: "'Bricolage Grotesque', sans-serif", color: 'var(--c-text)' }}>
        Nachschreiber
      </button>
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
