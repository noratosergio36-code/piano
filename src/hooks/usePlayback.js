import { useEffect, useRef, useState, useCallback } from 'react';
import { useGameLoop } from './useGameLoop';

/** Tolerance in seconds: notes within this window are considered "at this beat" */
const BEAT_TOLERANCE = 0.08;

/**
 * Groups notes by their start time (quantized to BEAT_TOLERANCE).
 * Returns a sorted array of beat objects: [{ time, midis: Set<number> }]
 * @param {Array<{midi:number, time:number}>} notes
 * @returns {Array<{time:number, midis:Set<number>}>}
 */
function buildBeatMap(notes) {
  const beats = [];
  for (const note of notes) {
    const last = beats[beats.length - 1];
    if (last && Math.abs(note.time - last.time) <= BEAT_TOLERANCE) {
      last.midis.add(note.midi);
    } else {
      beats.push({ time: note.time, midis: new Set([note.midi]) });
    }
  }
  return beats;
}

/**
 * usePlayback — high-level playback hook.
 *
 * Wraps useGameLoop and adds:
 *  - **Wait Mode**: freezes time when the next beat arrives; resumes only when
 *    the user presses ALL expected notes on their MIDI keyboard.
 *  - **Follow Mode**: time advances freely; activeNotes are ignored for pacing.
 *  - **Free Play**: no song, time still runs (for exploration / practice).
 *
 * @param {{
 *   notes: Array<{midi:number, time:number, duration:number, track:number}>,
 *   activeNotes: Set<number>,
 *   mode: 'freeplay' | 'wait' | 'follow',
 *   onTick?: (t: number) => void,
 * }} options
 * @returns {{
 *   currentTime: number,
 *   isPlaying: boolean,
 *   isFrozen: boolean,
 *   expectedNotes: Set<number>,
 *   pressedExpected: Set<number>,
 *   play: () => void,
 *   pause: () => void,
 *   stop: () => void,
 *   seekTo: (t: number) => void,
 * }}
 */
export function usePlayback({ notes = [], activeNotes, mode, onTick }) {
  const { currentTime, isPlaying, isFrozen, play, pause, stop, seekTo, freeze, unfreeze } =
    useGameLoop({ onTick });

  // Current beat the loop is waiting on (Wait Mode)
  const [expectedNotes, setExpectedNotes] = useState(new Set());
  const [pressedExpected, setPressedExpected] = useState(new Set());

  const beatMapRef = useRef([]);
  const beatIndexRef = useRef(0);           // index of next beat to serve
  const waitingBeatRef = useRef(null);      // beat currently being waited on
  const pressedSetRef = useRef(new Set());  // tracks which expected notes were pressed

  // Rebuild beat map when notes change
  useEffect(() => {
    const sorted = [...notes].sort((a, b) => a.time - b.time);
    beatMapRef.current = buildBeatMap(sorted);
    beatIndexRef.current = 0;
    waitingBeatRef.current = null;
    pressedSetRef.current = new Set();
    setExpectedNotes(new Set());
    setPressedExpected(new Set());
  }, [notes]);

  // Reset beat index when user seeks or stops
  const wrappedStop = useCallback(() => {
    stop();
    beatIndexRef.current = 0;
    waitingBeatRef.current = null;
    pressedSetRef.current = new Set();
    setExpectedNotes(new Set());
    setPressedExpected(new Set());
  }, [stop]);

  const wrappedSeekTo = useCallback((t) => {
    seekTo(t);
    // Advance beatIndex past all beats before t
    const beats = beatMapRef.current;
    let idx = 0;
    while (idx < beats.length && beats[idx].time < t - BEAT_TOLERANCE) idx++;
    beatIndexRef.current = idx;
    waitingBeatRef.current = null;
    pressedSetRef.current = new Set();
    setExpectedNotes(new Set());
    setPressedExpected(new Set());
  }, [seekTo]);

  // ── Wait Mode: freeze when next beat arrives ─────────────────────────────
  useEffect(() => {
    if (mode !== 'wait' || !isPlaying) return;

    const beats = beatMapRef.current;
    const idx = beatIndexRef.current;
    if (idx >= beats.length) return;

    const nextBeat = beats[idx];

    // Has the playhead reached this beat?
    if (currentTime >= nextBeat.time - BEAT_TOLERANCE && !isFrozen) {
      waitingBeatRef.current = nextBeat;
      pressedSetRef.current = new Set();
      setExpectedNotes(new Set(nextBeat.midis));
      setPressedExpected(new Set());
      freeze();
    }
  }, [currentTime, mode, isPlaying, isFrozen, freeze]);

  // ── Wait Mode: check if user pressed all expected notes ──────────────────
  useEffect(() => {
    if (mode !== 'wait' || !isFrozen) return;
    const waiting = waitingBeatRef.current;
    if (!waiting) return;

    // Update pressed set with newly active notes that are expected
    let updated = false;
    for (const midi of activeNotes) {
      if (waiting.midis.has(midi) && !pressedSetRef.current.has(midi)) {
        pressedSetRef.current.add(midi);
        updated = true;
      }
    }

    if (updated) {
      setPressedExpected(new Set(pressedSetRef.current));
    }

    // All expected notes pressed → advance to next beat and unfreeze
    const allPressed = [...waiting.midis].every((m) => pressedSetRef.current.has(m));
    if (allPressed) {
      beatIndexRef.current += 1;
      waitingBeatRef.current = null;
      pressedSetRef.current = new Set();
      setExpectedNotes(new Set());
      setPressedExpected(new Set());
      unfreeze();
    }
  }, [activeNotes, mode, isFrozen, unfreeze]);

  // ── Follow / Free mode: clear any wait state ─────────────────────────────
  useEffect(() => {
    if (mode !== 'wait' && isFrozen) {
      unfreeze();
      setExpectedNotes(new Set());
      setPressedExpected(new Set());
    }
  }, [mode, isFrozen, unfreeze]);

  return {
    currentTime,
    isPlaying,
    isFrozen,
    expectedNotes,
    pressedExpected,
    play,
    pause,
    stop: wrappedStop,
    seekTo: wrappedSeekTo,
  };
}
