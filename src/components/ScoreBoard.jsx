import { memo } from 'react';
import { useAppContext } from '../context/AppContext';
import './ScoreBoard.css';

/**
 * Displays the current score and combo in the top-right corner of the piano-stage.
 * Pulses when combo > 5.
 */
export const ScoreBoard = memo(function ScoreBoard() {
  const { state } = useAppContext();
  const { score, combo } = state;

  if (score === 0 && combo === 0) return null;

  return (
    <div className="scoreboard" aria-label="Puntuación">
      <div className="scoreboard__score">{score.toLocaleString()}</div>
      {combo > 0 && (
        <div className={`scoreboard__combo ${combo > 5 ? 'scoreboard__combo--hot' : ''}`}>
          ×{combo}
        </div>
      )}
    </div>
  );
});
