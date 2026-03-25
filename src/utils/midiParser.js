import { Midi } from '@tonejs/midi';

/**
 * Canonical note object consumed by WaterfallCanvas and game modes.
 * @typedef {{ midi: number, time: number, duration: number, track: number, velocity: number }} NoteEvent
 */

/**
 * Parsed song structure returned by all parsers.
 * @typedef {{
 *   notes: NoteEvent[],
 *   duration: number,
 *   bpm: number,
 *   tracks: Array<{index: number, name: string, channel: number}>,
 *   source: 'midi' | 'xml',
 * }} ParsedSong
 */

/**
 * Parse a MIDI file (ArrayBuffer or Uint8Array) using @tonejs/midi.
 * Returns a ParsedSong with all notes sorted by start time.
 *
 * @param {ArrayBuffer | Uint8Array} buffer
 * @returns {ParsedSong}
 */
export function parseMidi(buffer) {
  const midi = new Midi(buffer);

  const bpm = midi.header.tempos.length > 0
    ? midi.header.tempos[0].bpm
    : 120;

  const tracks = midi.tracks.map((track, index) => ({
    index,
    name: track.name || `Track ${index + 1}`,
    channel: track.channel ?? 0,
    instrument: track.instrument?.name ?? 'unknown',
  }));

  const notes = [];

  midi.tracks.forEach((track, trackIndex) => {
    for (const note of track.notes) {
      notes.push({
        midi: note.midi,
        time: note.time,           // seconds from @tonejs/midi
        duration: note.duration,   // seconds
        track: trackIndex,
        velocity: note.velocity,   // 0–1
      });
    }
  });

  // Sort by start time for efficient rendering
  notes.sort((a, b) => a.time - b.time);

  const duration = notes.length > 0
    ? Math.max(...notes.map((n) => n.time + n.duration))
    : 0;

  return { notes, duration, bpm, tracks, source: 'midi' };
}

/**
 * Load a MIDI File object from an <input type="file"> and parse it.
 * @param {File} file
 * @returns {Promise<ParsedSong>}
 */
export async function parseMidiFile(file) {
  const buffer = await file.arrayBuffer();
  return parseMidi(buffer);
}
