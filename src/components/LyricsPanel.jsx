import { memo, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import {
  getActiveLine,
  getNextLine,
  getActiveSyllable,
} from '../utils/lyricsFormat';
import './LyricsPanel.css';

/**
 * LyricsPanel — syllable-level karaoke overlay.
 *
 * Reads `currentLyrics` and `currentTime` directly from AppContext.
 * Intended to be placed inside the `.piano-stage` div (position: absolute).
 *
 * Wrapped in React.memo so the parent doesn't trigger extra renders;
 * the component re-renders on its own whenever AppContext updates.
 */
export const LyricsPanel = memo(function LyricsPanel() {
  const { state, dispatch } = useAppContext();
  const { currentLyrics, currentTime } = state;

  const handleClear = useCallback(() => {
    dispatch({ type: 'CLEAR_LYRICS' });
  }, [dispatch]);

  if (!currentLyrics) return null;

  const lines         = currentLyrics.lyrics;
  const activeLine    = getActiveLine(lines, currentTime);
  const nextLine      = getNextLine(lines, currentTime);

  // Index of the active syllable in the active line (-1 = none yet)
  const activeSyl   = activeLine ? getActiveSyllable(activeLine.syllables, currentTime) : null;
  const activeIdx   = activeLine ? activeLine.syllables.indexOf(activeSyl) : -1;

  return (
    <div className="karaoke-overlay" aria-live="polite" aria-label="Letras de la canción">

      {/* ── Dismiss button ───────────────────────────────────────────────── */}
      <button
        className="karaoke-clear"
        onClick={handleClear}
        title="Quitar letras"
        aria-label="Quitar letras"
      >
        ✕
      </button>

      {/* ── Active line ──────────────────────────────────────────────────── */}
      {activeLine ? (
        <div className="karaoke-line karaoke-line--active">
          {activeLine.syllables.map((syl, i) => (
            <span
              key={i}
              className={
                'karaoke-syllable' +
                (i === activeIdx ? ' syllable--active' : '') +
                (activeIdx >= 0 && i < activeIdx ? ' syllable--past' : '')
              }
            >
              {syl.text}
            </span>
          ))}
        </div>
      ) : (
        /* Show title or a neutral line while between lines */
        <div className="karaoke-line karaoke-line--idle">
          <span className="karaoke-title">
            {currentLyrics.title ?? '♪'}
          </span>
        </div>
      )}

      {/* ── Next line (anticipation) ─────────────────────────────────────── */}
      {nextLine && (
        <div className="karaoke-line karaoke-line--next" aria-hidden="true">
          {nextLine.syllables.map((syl, i) => (
            <span key={i} className="karaoke-syllable">
              {syl.text}
            </span>
          ))}
        </div>
      )}
    </div>
  );
});
