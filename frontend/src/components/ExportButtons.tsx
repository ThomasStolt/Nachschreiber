// frontend/src/components/ExportButtons.tsx
import { api } from '../api';

// TODO: Task 2 replaces this file entirely — activeRoom will be required and used for print buttons
export default function ExportButtons(_props: { activeRoom?: 'room_a' | 'room_b' | 'room_c' }) {
  function download(format: 'excel' | 'word') {
    window.open(api.exportUrl(format), '_blank');
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => download('excel')}
        className="flex-1 text-sm py-2 px-3 rounded-lg border font-medium transition-colors"
        style={{ borderColor: 'var(--c-border)', background: 'var(--c-surface)', color: 'var(--c-text)' }}
      >
        📄 Excel
      </button>
      <button
        onClick={() => download('word')}
        className="flex-1 text-sm py-2 px-3 rounded-lg border font-medium transition-colors"
        style={{ borderColor: 'var(--c-border)', background: 'var(--c-surface)', color: 'var(--c-text)' }}
      >
        📝 Word
      </button>
    </div>
  );
}
