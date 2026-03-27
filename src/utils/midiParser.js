import { Midi } from '@tonejs/midi';

/**
 * Canonical note object consumed by WaterfallCanvas and game modes.
 * @typedef {{
 *   midi:     number,
 *   time:     number,
 *   duration: number,
 *   track:    number,
 *   velocity: number,
 *   hand:     'left' | 'right',
 * }} NoteEvent
 */

/**
 * Parsed song structure returned by all parsers.
 * @typedef {{
 *   notes:    NoteEvent[],
 *   duration: number,
 *   bpm:      number,
 *   tracks:   Array<{index:number, name:string, channel:number}>,
 *   source:   'midi' | 'xml',
 * }} ParsedSong
 */

/**
 * Assign 'left' / 'right' hand to each note in-place.
 *
 * Strategy:
 *  • Multiple tracks with notes → compare average MIDI pitch per track.
 *    Track(s) with the highest average pitch → 'right'; others → 'left'.
 *    (Typical piano MIDI: treble staff is the highest-pitched track.)
 *  • Single track → split at Middle C (MIDI 60):
 *    midi ≥ 60 → 'right',  midi < 60 → 'left'.
 *
 * This function mutates the notes array in-place and returns void.
 *
 * @param {NoteEvent[]} notes
 */
export function assignHands(notes) {
  if (notes.length === 0) return;

  // Compute per-track stats
  /** @type {Map<number, {count:number, midiSum:number}>} */
  const stats = new Map();
  for (const n of notes) {
    const s = stats.get(n.track) ?? { count: 0, midiSum: 0 };
    s.count++;
    s.midiSum += n.midi;
    stats.set(n.track, s);
  }

  // Tracks that actually have notes, sorted by average pitch descending
  const ranked = [...stats.entries()]
    .filter(([, v]) => v.count > 0)
    .map(([track, v]) => ({ track, avg: v.midiSum / v.count }))
    .sort((a, b) => b.avg - a.avg); // highest average first

  if (ranked.length <= 1) {
    // Single-track file: split at Middle C
    for (const n of notes) {
      n.hand = n.midi >= 60 ? 'right' : 'left';
    }
  } else {
    // Multi-track: highest-avg track → right, all others → left
    /** @type {Map<number, 'left'|'right'>} */
    const handMap = new Map();
    ranked.forEach(({ track }, i) => {
      handMap.set(track, i === 0 ? 'right' : 'left');
    });
    for (const n of notes) {
      n.hand = handMap.get(n.track) ?? 'right';
    }
  }
}

/**
 * Parse a MIDI file (ArrayBuffer or Uint8Array) using @tonejs/midi.
 * Returns a ParsedSong with all notes sorted by start time,
 * each note annotated with a 'hand' property ('left' | 'right').
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

  /** @type {NoteEvent[]} */
  const notes = [];

  midi.tracks.forEach((track, trackIndex) => {
    for (const note of track.notes) {
      notes.push({
        midi:     note.midi,
        time:     note.time,
        duration: note.duration,
        track:    trackIndex,
        velocity: note.velocity,
        hand:     'right', // placeholder — overwritten by assignHands below
      });
    }
  });

  // Classify notes into left / right hand before sorting
  assignHands(notes);

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
