import './ModeSelector.css';

const MODES = [
  { id: 'freeplay',  label: 'Libre',      icon: '🎹', title: 'Toca libremente sin guía' },
  { id: 'wait',      label: 'Espera',     icon: '⏳', title: 'La canción pausa hasta que presiones la tecla correcta' },
  { id: 'follow',    label: 'Seguir',     icon: '🎵', title: 'La canción avanza al ritmo; sigue la melodía y las letras' },
  { id: 'composer',  label: 'Compositor', icon: '🎼', title: 'Graba tu interpretación y visualízala como partitura' },
];

/**
 * ModeSelector — three-button pill to switch between playback modes.
 * @param {{ mode: string, onChange: (mode: string) => void }} props
 */
export function ModeSelector({ mode, onChange }) {
  return (
    <div className="mode-selector" role="group" aria-label="Modo de reproducción">
      {MODES.map((m) => (
        <button
          key={m.id}
          className={`mode-btn ${mode === m.id ? 'active' : ''}`}
          onClick={() => onChange(m.id)}
          title={m.title}
          aria-pressed={mode === m.id}
        >
          <span className="mode-icon">{m.icon}</span>
          <span className="mode-label">{m.label}</span>
        </button>
      ))}
    </div>
  );
}
