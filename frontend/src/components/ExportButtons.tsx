// frontend/src/components/ExportButtons.tsx
import { api } from '../api';

export default function ExportButtons() {
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
