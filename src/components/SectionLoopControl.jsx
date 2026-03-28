import { useAppContext } from '../context/AppContext';
import './SectionLoopControl.css';

/** Format seconds → "M:SS.s" */
function fmt(secs) {
  const m  = Math.floor(secs / 60);
  const s  = (secs % 60).toFixed(1);
  return `${m}:${s.padStart(4, '0')}`;
}

/**
 * A/B Section Loop control.
 * Allows setting loop start/end via sliders or "Set A / Set B" quick buttons.
 */
export function SectionLoopControl() {
  const { state, dispatch } = useAppContext();
  const { loopStart, loopEnd, isLooping, currentTime, loadedSong } = state;

  const duration   = loadedSong?.duration ?? 60;
  const effectiveB = loopEnd ?? duration;

  const setA = (val) => {
    const clamped = Math.max(0, Math.min(val, effectiveB - 0.1));
    dispatch({ type: 'SET_LOOP_START', payload: +clamped.toFixed(2) });
  };

  const setB = (val) => {
    const clamped = Math.max(loopStart + 0.1, Math.min(val, duration));
    dispatch({ type: 'SET_LOOP_END', payload: +clamped.toFixed(2) });
  };

  const reset = () => {
    dispatch({ type: 'SET_LOOP_START', payload: 0 });
    dispatch({ type: 'SET_LOOP_END',   payload: null });
  };

  return (
    <div className="loop-ctrl">
      {/* Header row */}
      <div className="loop-ctrl__header">
        <span className="settings-label">Bucle A/B</span>

        <button
          className={`btn-loop-toggle ${isLooping ? 'active' : ''}`}
          onClick={() => dispatch({ type: 'TOGGLE_LOOPING' })}
          title={isLooping ? 'Desactivar bucle' : 'Activar bucle'}
        >
          🔁 {isLooping ? 'ON' : 'OFF'}
        </button>

        <button className="btn-loop-reset" onClick={reset} title="Restablecer puntos">
          ↺
        </button>
      </div>

      {/* Point A */}
      <div className="loop-ctrl__row">
        <button
          className="btn-set-point"
          onClick={() => setA(currentTime)}
          title="Marcar inicio aquí (tiempo actual)"
        >A</button>
        <input
          type="range"
          className="loop-slider"
          min={0}
          max={duration}
          step={0.1}
          value={loopStart}
          onChange={(e) => setA(Number(e.target.value))}
        />
        <span className="loop-time">{fmt(loopStart)}</span>
      </div>

      {/* Point B */}
      <div className="loop-ctrl__row">
        <button
          className="btn-set-point btn-set-point--b"
          onClick={() => setB(currentTime)}
          title="Marcar fin aquí (tiempo actual)"
        >B</button>
        <input
          type="range"
          className="loop-slider"
          min={0}
          max={duration}
          step={0.1}
          value={effectiveB}
          onChange={(e) => setB(Number(e.target.value))}
        />
        <span className="loop-time">{fmt(effectiveB)}</span>
      </div>

      {/* Range summary */}
      <div className="loop-ctrl__summary">
        <span className="loop-summary__label">Sección:</span>
        <span className="loop-summary__range">
          {fmt(loopStart)} – {fmt(effectiveB)}
          <em> ({(effectiveB - loopStart).toFixed(1)}s)</em>
        </span>
      </div>
    </div>
  );
}
