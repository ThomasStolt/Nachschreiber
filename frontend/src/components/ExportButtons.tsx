// frontend/src/components/ExportButtons.tsx
import { api } from '../api';

interface Props {
  activeRoom: 'room_a' | 'room_b' | 'room_c';
}

const ROOM_NAME: Record<'room_a' | 'room_b' | 'room_c', string> = {
  room_a: 'Raum A',
  room_b: 'Raum B',
  room_c: 'Raum C',
};

export default function ExportButtons({ activeRoom }: Props) {
  function download(format: 'excel' | 'word') {
    window.open(api.exportUrl(format), '_blank');
  }

  function doPrint(mode: 'single' | 'all') {
    document.body.setAttribute('data-print-mode', mode);
    window.onafterprint = () => document.body.removeAttribute('data-print-mode');
    window.print();
  }

  const downloadBtnStyle = {
    borderColor: 'var(--c-border)',
    background: 'var(--c-surface)',
    color: 'var(--c-text)',
  };
  const printBtnStyle = {
    borderColor: 'var(--c-accent)',
    background: 'transparent',
    color: 'var(--c-accent)',
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button onClick={() => download('excel')} className="flex-1 text-sm py-2 px-3 rounded-lg border font-medium" style={downloadBtnStyle}>
          📄 Excel
        </button>
        <button onClick={() => download('word')} className="flex-1 text-sm py-2 px-3 rounded-lg border font-medium" style={downloadBtnStyle}>
          📝 Word
        </button>
      </div>
      <div className="flex gap-2">
        <button onClick={() => doPrint('single')} className="flex-1 text-sm py-2 px-3 rounded-lg border font-medium" style={printBtnStyle}>
          🖨️ {ROOM_NAME[activeRoom]}
        </button>
        <button onClick={() => doPrint('all')} className="flex-1 text-sm py-2 px-3 rounded-lg border font-medium" style={printBtnStyle}>
          🖨️ Alle Räume
        </button>
      </div>
    </div>
  );
}
