import { useMemo, useCallback } from 'react';
import { getNoteName, PIANO_CONFIG } from '../constants/piano';
import { buildKeyLayout, KEY_HEIGHT } from '../utils/keyLayout';
import './PianoKeyboard.css';

/**
 * PianoKeyboard component
 * @param {{
 *   activeNotes: Set<number>,
 *   range: {start: number, end: number},
 *   notation: 'solfeo'|'american',
 *   onNoteOn?:  (midi: number) => void,
 *   onNoteOff?: (midi: number) => void,
 * }} props
 */
export function PianoKeyboard({
  activeNotes = new Set(),
  range = PIANO_CONFIG.defaultRange,
  notation = 'american',
  onNoteOn,
  onNoteOff,
}) {
  const { keys, totalWidth } = useMemo(
    () => buildKeyLayout(range.start, range.end),
    [range]
  );

  const keyData = useMemo(
    () =>
      keys.map((k) => ({
        ...k,
        name: getNoteName(k.midi, notation),
        active: activeNotes.has(k.midi),
      })),
    [keys, activeNotes, notation]
  );

  // Pointer-capture approach: works for mouse AND touch, handles drag-off correctly
  const handlePointerDown = useCallback((midi, e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    onNoteOn?.(midi);
  }, [onNoteOn]);

  const handlePointerUp = useCallback((midi, e) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    onNoteOff?.(midi);
  }, [onNoteOff]);

  const handlePointerLeave = useCallback((midi, e) => {
    // Only fire note-off if the pointer button is still held (dragged off key)
    if (e.buttons > 0) onNoteOff?.(midi);
  }, [onNoteOff]);

  return (
    <div className="piano-keyboard" style={{ overflowX: 'auto' }}>
      <div
        className="piano-keys-container"
        style={{ width: totalWidth, height: KEY_HEIGHT, position: 'relative' }}
      >
        {keyData.map((key) => (
          <div
            key={key.midi}
            className={`piano-key ${key.isBlack ? 'black-key' : 'white-key'} ${key.active ? 'active' : ''}`}
            style={{
              position: 'absolute',
              left: key.x,
              width: key.width,
              height: key.height,
              zIndex: key.isBlack ? 2 : 1,
              touchAction: 'none',
            }}
            data-midi={key.midi}
            aria-label={key.name}
            aria-pressed={key.active}
            onPointerDown={(e) => handlePointerDown(key.midi, e)}
            onPointerUp={(e) => handlePointerUp(key.midi, e)}
            onPointerLeave={(e) => handlePointerLeave(key.midi, e)}
          >
            {!key.isBlack && (
              <span className="key-label">{key.name}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
