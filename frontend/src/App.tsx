import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import UploadPage from './pages/UploadPage';
import DashboardPage from './pages/DashboardPage';

function SunIcon() {
  return (
    <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="10" cy="10" r="3.5" />
      <path d="M10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2M4.1 4.1l1.4 1.4M14.5 14.5l1.4 1.4M4.1 15.9l1.4-1.4M14.5 5.5l1.4-1.4" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.5 10.5A7.5 7.5 0 1 1 9.5 2.5a5.5 5.5 0 0 0 8 8z" />
    </svg>
  )
}

function NavBar({ dark, toggleDark }: { dark: boolean; toggleDark: () => void }) {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-surface/80 backdrop-blur-xl transition-colors duration-200 no-print">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-4">

        <NavLink to="/" className="flex items-center gap-2 group flex-shrink-0">
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
            <span className="font-display font-bold text-xs text-surface">NS</span>
          </div>
          <span className="font-display font-semibold text-t1 text-sm group-hover:text-accent transition-colors duration-150 hidden sm:block">
            Nachschreiber
          </span>
          <span className="text-[10px] font-mono text-t3 bg-elevated border border-border px-1.5 py-0.5 rounded-md hidden sm:block">
            v{__APP_VERSION__}
          </span>
        </NavLink>

        <button
          onClick={toggleDark}
          className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-t2 hover:text-accent hover:border-accent/40 transition-all duration-200"
          aria-label="Erscheinungsbild wechseln"
        >
          {dark ? <SunIcon /> : <MoonIcon />}
        </button>

      </div>
    </header>
  );
}

export default function App() {
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem('theme')
    if (stored) return stored === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  function toggleDark() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--c-bg)' }}>
        <NavBar dark={dark} toggleDark={toggleDark} />
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
