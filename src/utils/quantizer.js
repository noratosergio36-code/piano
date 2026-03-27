/**
 * @typedef {{ midiNumber: number, startTime: number, duration: number }} RecordedNote
 * @typedef {{ vexDur: string, midiNumbers: number[], isRest: boolean }} VexEvent
 */

/** 4/4 time = 16 sixteenth-note slots per measure */
const SLOTS_PER_MEASURE = 16;

/**
 * Maps a slot count (in 16th notes) to the largest fitting VexFlow duration string.
 * Uses only standard (non-dotted) values to avoid VexFlow version compatibility issues.
 * Leftover slots become subsequent rests/notes handled by the calling loop.
 *
 * @param {number} slots
 * @returns {string} VexFlow duration string ('w'|'h'|'q'|'8'|'16')
 */
function slotsToVexDur(slots) {
  if (slots >= 16) return 'w';   // whole         = 16 slots
  if (slots >= 8)  return 'h';   // half          =  8 slots
  if (slots >= 4)  return 'q';   // quarter       =  4 slots
  if (slots >= 2)  return '8';   // eighth        =  2 slots
  return '16';                    // sixteenth     =  1 slot
}

/** Number of 16th-note slots consumed by a VexFlow duration string. */
const VEX_DUR_SLOTS = { w: 16, h: 8, q: 4, '8': 2, '16': 1 };

/**
 * Quantizes a set of recorded notes for ONE voice (treble or bass) to the nearest
 * 16th-note grid and returns an array of measures, each measure being an array of
 * VexFlow-compatible note events ready for StaveNote construction.
 *
 * Algorithm:
 *  1. Snap every note's startTime / duration to the nearest 16th-note slot.
 *  2. Group simultaneous notes (same snapped slot) into chords.
 *  3. Walk a cursor through the total timeline, inserting notes or rests.
 *  4. Split the timeline into SLOTS_PER_MEASURE-sized measures.
 *
 * @param {RecordedNote[]} notes   - notes for ONE voice (already filtered by clef)
 * @param {number}         bpm     - tempo used as quantization reference
 * @returns {VexEvent[][]}          - array of measures; each measure is an array of VexEvents
 */
export function quantizeVoice(notes, bpm) {
  if (!notes.length) return [];

  const secPerBeat = 60 / bpm;
  const secPer16th = secPerBeat / 4;

  // ── Step 1: snap to 16th-note grid ────────────────────────────────────────
  const qNotes = notes.map((n) => ({
    midiNumber: n.midiNumber,
    qStart: Math.round(n.startTime / secPer16th),
    qDur:   Math.max(1, Math.round(n.duration / secPer16th)),
  })).sort((a, b) => a.qStart - b.qStart);

  // ── Step 2: group chords (same qStart slot) ────────────────────────────────
  /** @type {Map<number, { midis: number[], qDur: number }>} */
  const slotMap = new Map();
  for (const n of qNotes) {
    const existing = slotMap.get(n.qStart);
    if (!existing) {
      slotMap.set(n.qStart, { midis: [n.midiNumber], qDur: n.qDur });
    } else {
      existing.midis.push(n.midiNumber);
      existing.qDur = Math.max(existing.qDur, n.qDur); // use longest duration in chord
    }
  }

  // ── Step 3: determine total measures ──────────────────────────────────────
  const lastEntry = qNotes[qNotes.length - 1];
  const lastSlot  = lastEntry.qStart + lastEntry.qDur;
  const totalMeasures = Math.max(1, Math.ceil(lastSlot / SLOTS_PER_MEASURE));

  // ── Step 4: fill measures with notes and rests ────────────────────────────
  const measures = [];
  let cursor = 0;

  for (let m = 0; m < totalMeasures; m++) {
    const measureEnd = (m + 1) * SLOTS_PER_MEASURE;
    /** @type {VexEvent[]} */
    const events = [];

    while (cursor < measureEnd) {
      if (slotMap.has(cursor)) {
        const { midis, qDur } = slotMap.get(cursor);
        // Clamp note so it doesn't overflow current measure
        const clampedSlots = Math.min(qDur, measureEnd - cursor);
        const vexDur = slotsToVexDur(clampedSlots);
        events.push({ vexDur, midiNumbers: midis, isRest: false });
        cursor += VEX_DUR_SLOTS[vexDur];
      } else {
        // Find next note slot at or after cursor within this measure
        let nextSlot = measureEnd;
        for (const [s] of slotMap) {
          if (s > cursor && s < nextSlot) nextSlot = s;
        }
        // Fill gap with the largest fitting rest(s)
        const restSlots = nextSlot - cursor;
        const vexDur = slotsToVexDur(restSlots);
        events.push({ vexDur, midiNumbers: [], isRest: true });
        cursor += VEX_DUR_SLOTS[vexDur];
      }
    }

    measures.push(events);
  }

  return measures;
}

/**
 * Convenience: returns a single empty measure of four quarter rests.
 * Used by SheetMusicView to pad voices of unequal length.
 * @returns {VexEvent[]}
 */
export function emptyMeasure() {
  return [
    { vexDur: 'q', midiNumbers: [], isRest: true },
    { vexDur: 'q', midiNumbers: [], isRest: true },
    { vexDur: 'q', midiNumbers: [], isRest: true },
    { vexDur: 'q', midiNumbers: [], isRest: true },
  ];
}
