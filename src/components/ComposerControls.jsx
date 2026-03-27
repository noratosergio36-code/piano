import { useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import './ComposerControls.css';

/**
 * ComposerControls — Record / Stop / Clear toolbar + BPM input for Composer Mode.
 * Reads and writes directly to AppContext; no props required.
 */
export function ComposerControls() {
  const { state, dispatch } = useAppContext();
  const { isRecording, composerBpm, recordedNotes } = state;

  const handleToggleRecord = useCallback(() => {
    dispatch({ type: isRecording ? 'STOP_RECORDING' : 'START_RECORDING' });
  }, [dispatch, isRecording]);

  const handleClear = useCallback(() => {
    dispatch({ type: 'CLEAR_RECORDING' });
  }, [dispatch]);

  const handleBpmChange = useCallback(
    /** @param {React.ChangeEvent<HTMLInputElement>} e */
    (e) => {
      const val = Number(e.target.value);
      if (val >= 20 && val <= 300) {
        dispatch({ type: 'SET_COMPOSER_BPM', payload: val });
      }
    },
    [dispatch],
  );

  return (
    <div className="composer-controls" role="toolbar" aria-label="Controles del compositor">
      {/* Record / Stop toggle */}
      <button
        className={`composer-btn record-btn${isRecording ? ' recording' : ''}`}
        onClick={handleToggleRecord}
        title={isRecording ? 'Detener grabación' : 'Iniciar grabación'}
        aria-pressed={isRecording}
      >
        <span className="composer-btn-icon" aria-hidden="true">
          {isRecording ? '■' : '●'}
        </span>
        <span>{isRecording ? 'Detener' : 'Grabar'}</span>
      </button>

      {/* Clear */}
      <button
        className="composer-btn clear-btn"
        onClick={handleClear}
        disabled={recordedNotes.length === 0 && !isRecording}
        title="Borrar toda la grabación"
      >
        <span className="composer-btn-icon" aria-hidden="true">✕</span>
        <span>Limpiar</span>
      </button>

      {/* BPM input */}
      <label className="bpm-label" title="BPM base para cuantización">
        <span className="bpm-text">BPM</span>
        <input
          type="number"
          className="bpm-input"
          value={composerBpm}
          min={20}
          max={300}
          step={1}
          onChange={handleBpmChange}
          disabled={isRecording}
          aria-label="Tempo en BPM"
        />
      </label>

      {/* Note count badge */}
      {recordedNotes.length > 0 && (
        <span className="note-count" aria-live="polite">
          {recordedNotes.length} nota{recordedNotes.length !== 1 ? 's' : ''}
        </span>
      )}

      {/* Blinking REC indicator */}
      {isRecording && (
        <span className="rec-indicator" aria-label="Grabando">REC</span>
      )}
    </div>
  );
}
