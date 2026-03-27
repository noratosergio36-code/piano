import { useEffect, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import './ScoreOverlay.css';

/**
 * Renders floating score popups over the piano-stage canvas.
 * Each popup auto-removes itself after its CSS animation ends (1 s).
 */
export function ScoreOverlay() {
  const { state, dispatch } = useAppContext();
  const { activePopups } = state;

  const removePopup = useCallback((id) => {
    dispatch({ type: 'REMOVE_POPUP', payload: id });
  }, [dispatch]);

  return (
    <div className="score-overlay" aria-hidden="true">
      {activePopups.map((popup) => (
        <PopupItem key={popup.id} popup={popup} onDone={removePopup} />
      ))}
    </div>
  );
}

function PopupItem({ popup, onDone }) {
  useEffect(() => {
    const timer = setTimeout(() => onDone(popup.id), 1000);
    return () => clearTimeout(timer);
  }, [popup.id, onDone]);

  return (
    <div
      className={`score-popup score-popup--${popup.popupType}`}
      style={{ left: `${popup.x}%` }}
    >
      {popup.text}
    </div>
  );
}
