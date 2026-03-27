import { assignHands } from './midiParser';

/**
 * Returns true if the raw object looks like a JSON song file
 * (has a `notes` array whose items have numeric `midiNumber`).
 * @param {unknown} raw
 * @returns {boolean}
 */
export function isJsonSong(raw) {
  return (
    typeof raw === 'object' &&
    raw !== null &&
    Array.isArray(raw.notes) &&
    raw.notes.length > 0 &&
    typeof raw.notes[0].midiNumber === 'number'
  );
}

/**
 * Parse a Piano Maestro JSON song file into a ParsedSong.
 *
 * Expected note shape:
 *   { midiNumber, tiempoInicio, duracion, mano?, nombre?, velocity? }
 *
 * @param {unknown} raw  — already JSON.parse'd object
 * @returns {import('./midiParser').ParsedSong}
 */
export function parseJsonSong(raw) {
  if (!isJsonSong(raw)) {
    throw new Error('El JSON no tiene el formato de canción esperado (falta "notes[].midiNumber").');
  }

  const bpm = typeof raw.bpm === 'number' ? raw.bpm : 120;

  const notes = raw.notes.map((n, i) => {
    if (typeof n.midiNumber !== 'number') {
      throw new Error(`Nota ${i}: "midiNumber" debe ser número.`);
    }
    if (typeof n.tiempoInicio !== 'number') {
      throw new Error(`Nota ${i}: "tiempoInicio" debe ser número.`);
    }
    if (typeof n.duracion !== 'number') {
      throw new Error(`Nota ${i}: "duracion" debe ser número.`);
    }
    return {
      midi:     n.midiNumber,
      time:     n.tiempoInicio,
      duration: n.duracion,
      track:    n.track ?? 0,
      velocity: typeof n.velocity === 'number' ? n.velocity : 0.75,
      hand:     n.mano === 'left' ? 'left' : (n.mano === 'right' ? 'right' : 'right'),
    };
  });

  // If the JSON already has explicit hand assignments, respect them;
  // otherwise run assignHands to auto-detect.
  const hasExplicitHands = raw.notes.every((n) => n.mano === 'left' || n.mano === 'right');
  if (!hasExplicitHands) {
    assignHands(notes);
  }

  notes.sort((a, b) => a.time - b.time);

  const duration =
    typeof raw.duracionTotal === 'number'
      ? raw.duracionTotal
      : notes.length > 0
        ? Math.max(...notes.map((n) => n.time + n.duration))
        : 0;

  // Build a single synthetic track
  const tracks = [{ index: 0, name: raw.nombre ?? 'Canción', channel: 0, instrument: 'piano' }];

  return { notes, duration, bpm, tracks, source: 'json' };
}

/**
 * Load and parse a JSON song File object.
 * @param {File} file
 * @returns {Promise<import('./midiParser').ParsedSong>}
 */
export async function parseJsonSongFile(file) {
  const text = await file.text();
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error(`JSON inválido en: ${file.name}`);
  }
  return parseJsonSong(raw);
}
