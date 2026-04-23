import { useEffect, useMemo, useRef, useState } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  required?: boolean;
  style?: React.CSSProperties;
}

export default function Combobox({ value, onChange, options, placeholder, required, style }: Props) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // If the current value exactly matches an option (user picked already),
  // show the full list so they can easily switch. Otherwise filter by substring.
  const filtered = useMemo(() => {
    if (!value) return options;
    if (options.includes(value)) return options;
    const q = value.toLowerCase();
    return options.filter(o => o.toLowerCase().includes(q));
  }, [value, options]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { setHighlight(-1); }, [value, open]);

  function commit(opt: string) {
    onChange(opt);
    setOpen(false);
  }

  const dropdownStyle: React.CSSProperties = {
    position: 'absolute',
    top: 'calc(100% + 2px)',
    left: 0,
    right: 0,
    zIndex: 20,
    background: 'var(--c-bg)',
    border: '1px solid var(--c-border)',
    borderRadius: '6px',
    maxHeight: '220px',
    overflowY: 'auto',
    boxShadow: '0 6px 20px rgba(0,0,0,0.15)',
    listStyle: 'none',
    margin: 0,
    padding: '4px 0',
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        style={style}
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => { if (options.length > 0) setOpen(true); }}
        onClick={() => { if (options.length > 0) setOpen(true); }}
        onKeyDown={e => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            if (options.length > 0) { setOpen(true); e.preventDefault(); }
            return;
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlight(h => Math.min(h + 1, filtered.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight(h => Math.max(h - 1, 0));
          } else if (e.key === 'Enter' && open && highlight >= 0 && filtered[highlight]) {
            e.preventDefault();
            commit(filtered[highlight]);
          } else if (e.key === 'Escape') {
            setOpen(false);
          } else if (e.key === 'Tab') {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul style={dropdownStyle}>
          {filtered.map((opt, i) => (
            <li
              key={opt}
              onMouseDown={e => { e.preventDefault(); commit(opt); }}
              onMouseEnter={() => setHighlight(i)}
              style={{
                padding: '6px 10px',
                fontSize: '0.875rem',
                cursor: 'pointer',
                background: i === highlight ? 'rgba(217,119,6,0.12)' : 'transparent',
                color: 'var(--c-text)',
              }}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
