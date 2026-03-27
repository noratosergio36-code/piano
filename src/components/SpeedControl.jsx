import { useAppContext } from '../context/AppContext';
import './SpeedControl.css';

const RATES = [0.5, 0.75, 1.0, 1.25, 1.5];

/**
 * Preset buttons to set the playback speed multiplier.
 * Dispatches SET_PLAYBACK_RATE to AppContext.
 */
export function SpeedControl() {
  const { state, dispatch } = useAppContext();
  const { playbackRate } = state;

  return (
    <div className="speed-control" title="Velocidad de reproducción">
      <span className="speed-control__label">Vel.</span>
      {RATES.map((rate) => (
        <button
          key={rate}
          className={`speed-btn ${playbackRate === rate ? 'active' : ''}`}
          onClick={() => dispatch({ type: 'SET_PLAYBACK_RATE', payload: rate })}
        >
          {rate === 1.0 ? '1×' : `${rate}×`}
        </button>
      ))}
    </div>
  );
}
