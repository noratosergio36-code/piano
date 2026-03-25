// Piano configuration constants
export const PIANO_CONFIG = {
  totalKeys: 88,
  startNote: 21, // A0 (MIDI note number)
  endNote: 108,  // C8
  defaultRange: { start: 36, end: 96 }, // C2 to C7 (61 keys)
};

export const NOTE_NAMES_SOLFEO = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
export const NOTE_NAMES_AMERICAN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const BLACK_KEY_POSITIONS = [1, 3, 6, 8, 10]; // semitone offsets within octave

/**
 * Returns true if the MIDI note number is a black key
 * @param {number} midiNote
 * @returns {boolean}
 */
export function isBlackKey(midiNote) {
  return BLACK_KEY_POSITIONS.includes(midiNote % 12);
}

/**
 * Get note name from MIDI note number
 * @param {number} midiNote
 * @param {'solfeo'|'american'} notation
 * @returns {string}
 */
export function getNoteName(midiNote, notation = 'american') {
  const names = notation === 'solfeo' ? NOTE_NAMES_SOLFEO : NOTE_NAMES_AMERICAN;
  const octave = Math.floor(midiNote / 12) - 1;
  return `${names[midiNote % 12]}${octave}`;
}
