import { useEffect, useRef, useState, useCallback } from 'react';
import { useGameLoop } from './useGameLoop';

/**
 * Fixed tolerance for grouping simultaneous notes into chords (80 ms).
 * This is separate from the user-configurable hit-window tolerance and
 * should not be changed — it reflects typical MIDI recording imprecision.
 */
const CHORD_GROUP_TOLERANCE = 0.08;

/**
 * Groups notes by their start time (quantized to CHORD_GROUP_TOLERANCE).
 * Returns a sorted array of beat objects: [{ time, midis: Set<number> }]
 * @param {Array<{midi:number, time:number}>} notes
 * @returns {Array<{time:number, midis:Set<number>}>}
 */
function buildBeatMap(notes) {
  const beats = [];
  for (const note of notes) {
    const last = beats[beats.length - 1];
    if (last && Math.abs(note.time - last.time) <= CHORD_GROUP_TOLERANCE) {
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
 *  - **Wait Mode**: freezes time when the next beat arrives within the hit
 *    window; resumes only when the user presses ALL expected notes.
 *  - **Follow Mode**: time advances freely.
 *  - **Free Play**: no song, time still runs.
 *  - **Hand practice**: filters the beat map to `practicingHands` notes;
 *    auto-fires `onAutoNoteOn`/`onAutoNoteOff` for the non-practiced hand.
 *
 * @param {{
 *   notes:           Array<{midi:number, time:number, duration:number, track:number, hand:'left'|'right'}>,
 *   activeNotes:     Set<number>,
 *   mode:            'freeplay' | 'wait' | 'follow' | 'composer',
 *   onTick?:         (t: number) => void,
 *   toleranceSec?:   number,
 *   dispatch?:       (action: {type:string, payload?:unknown}) => void,
 *   practicingHands?: ('left'|'right')[],
 *   onAutoNoteOn?:   (midi: number) => void,
 *   onAutoNoteOff?:  (midi: number) => void,
 * }} options
 * @returns {{
 *   currentTime:    number,
 *   isPlaying:      boolean,
 *   isFrozen:       boolean,
 *   expectedNotes:  Set<number>,
 *   pressedExpected: Set<number>,
 *   play:   () => void,
 *   pause:  () => void,
 *   stop:   () => void,
 *   seekTo: (t: number) => void,
 * }}
 */
export function usePlayback({
  notes = [],
  activeNotes,
  mode,
  onTick,
  toleranceSec = 0.08,
  dispatch = null,
  practicingHands = ['left', 'right'],
  onAutoNoteOn = null,
  onAutoNoteOff = null,
  playbackRate = 1.0,
  loopStart = 0,
  loopEnd   = null,
  isLooping = false,
}) {
  // Indirection ref: handleLoop is wired in after it's defined (below)
  const handleLoopRef    = useRef(null);
  const onLoopStable     = useCallback((t) => { handleLoopRef.current?.(t); }, []);

  // Keep the caller's onTick in a ref so wrappedOnTick stays stable
  const onTickInnerRef = useRef(onTick);
  useEffect(() => { onTickInnerRef.current = onTick; }, [onTick]);

  // Track isPlaying in a ref so processAutoplay can check it without
  // re-creating the callback (avoids restarts in useGameLoop)
  const isPlayingRef = useRef(false);

  // processAutoplay: fires noteOn/noteOff for non-practiced-hand notes.
  // Uses only refs → safe to call synchronously from the RAF callback
  // (i.e. inside wrappedOnTick) so it always sees the post-loop index.
  const processAutoplay = useCallback((t) => {
    if (!isPlayingRef.current) return;
    const sched = autoScheduleRef.current;
    while (autoIndexRef.current < sched.length) {
      const note = sched[autoIndexRef.current];
      if (note.time > t) break;
      onAutoNoteOnRef.current?.(note.midi);
      autoActiveRef.current.set(note.midi, note.time + note.duration);
      autoIndexRef.current += 1;
    }
    autoActiveRef.current.forEach((endTime, midi) => {
      if (t >= endTime) {
        onAutoNoteOffRef.current?.(midi);
        autoActiveRef.current.delete(midi);
      }
    });
  }, []);

  // wrappedOnTick: passed to useGameLoop so autoplay runs synchronously
  // in the same RAF frame as the loop-jump, eliminating the race condition.
  const wrappedOnTick = useCallback((t) => {
    processAutoplay(t);
    onTickInnerRef.current?.(t);
  }, [processAutoplay]);

  const { currentTime, isPlaying, isFrozen, play, pause, stop, seekTo, freeze, unfreeze } =
    useGameLoop({ onTick: wrappedOnTick, playbackRate, loopStart, loopEnd, isLooping, onLoop: onLoopStable });

  // Sync isPlayingRef after useGameLoop provides isPlaying
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  // ── Tolerance ref — updated without triggering effect re-runs ────────────
  // This lets the hit-window change take effect on the very next RAF tick
  // without restarting any hooks.
  const toleranceRef = useRef(toleranceSec);
  useEffect(() => { toleranceRef.current = toleranceSec; }, [toleranceSec]);

  // ── Local Wait Mode state ────────────────────────────────────────────────
  const [expectedNotes, setExpectedNotes]   = useState(new Set());
  const [pressedExpected, setPressedExpected] = useState(new Set());

  const beatMapRef      = useRef([]);
  const beatIndexRef    = useRef(0);
  const waitingBeatRef  = useRef(null);
  const pressedSetRef   = useRef(new Set());

  // Keep dispatch in a ref so effects don't restart when it changes identity
  const dispatchRef = useRef(dispatch);
  useEffect(() => { dispatchRef.current = dispatch; }, [dispatch]);

  // ── Autoplay refs — updated without restarting any hooks ─────────────────
  const onAutoNoteOnRef  = useRef(onAutoNoteOn);
  const onAutoNoteOffRef = useRef(onAutoNoteOff);
  useEffect(() => { onAutoNoteOnRef.current  = onAutoNoteOn;  }, [onAutoNoteOn]);
  useEffect(() => { onAutoNoteOffRef.current = onAutoNoteOff; }, [onAutoNoteOff]);

  const practicingHandsRef = useRef(practicingHands);
  useEffect(() => { practicingHandsRef.current = practicingHands; }, [practicingHands]);

  // Autoplay schedule: sorted array of { time, midi, duration } for non-practiced hand
  const autoScheduleRef = useRef([]);
  const autoIndexRef    = useRef(0);
  // Track which autoplay notes are currently sounding so we can send noteOff
  const autoActiveRef   = useRef(new Map()); // midi → endTime

  // ── Helpers for syncing to AppContext ────────────────────────────────────
  const syncFreeze = useCallback((midis) => {
    freeze();
    dispatchRef.current?.({ type: 'FREEZE_TIME' });
    dispatchRef.current?.({ type: 'SET_EXPECTED_NOTES', payload: midis });
  }, [freeze]);

  const syncUnfreeze = useCallback(() => {
    unfreeze();
    dispatchRef.current?.({ type: 'UNFREEZE_TIME' });
    dispatchRef.current?.({ type: 'SET_EXPECTED_NOTES', payload: [] });
  }, [unfreeze]);

  // ── Rebuild beat map + autoplay schedule when notes or practicingHands change
  useEffect(() => {
    const sorted = [...notes].sort((a, b) => a.time - b.time);
    const hands  = practicingHandsRef.current;

    // Beat map uses only notes the player must press
    const practiceNotes = sorted.filter((n) =>
      hands.includes(n.hand ?? 'right')
    );
    beatMapRef.current   = buildBeatMap(practiceNotes);
    beatIndexRef.current = 0;
    waitingBeatRef.current = null;
    pressedSetRef.current  = new Set();
    setExpectedNotes(new Set());
    setPressedExpected(new Set());

    // Autoplay schedule: notes NOT in practicingHands
    autoScheduleRef.current = sorted.filter((n) =>
      !hands.includes(n.hand ?? 'right')
    );
    autoIndexRef.current  = 0;
    autoActiveRef.current = new Map();
  }, [notes, practicingHands]);

  // ── Helpers to silence all currently-sounding autoplay notes ─────────────
  const silenceAutoplay = useCallback(() => {
    autoActiveRef.current.forEach((_, midi) => {
      onAutoNoteOffRef.current?.(midi);
    });
    autoActiveRef.current = new Map();
  }, []);

  // ── Loop jump handler: called by useGameLoop when Point B is reached ──────
  const handleLoop = useCallback((t) => {
    // Reposition beat index
    const beats = beatMapRef.current;
    let idx = 0;
    while (idx < beats.length && beats[idx].time < t - CHORD_GROUP_TOLERANCE) idx++;
    beatIndexRef.current   = idx;
    waitingBeatRef.current = null;
    pressedSetRef.current  = new Set();
    setExpectedNotes(new Set());
    setPressedExpected(new Set());
    // Reposition autoplay index
    const sched = autoScheduleRef.current;
    let ai = 0;
    while (ai < sched.length && sched[ai].time < t) ai++;
    autoIndexRef.current = ai;
    silenceAutoplay();
  }, [silenceAutoplay]);

  // Wire handleLoop to the indirection ref (stable onLoopStable is already passed to useGameLoop)
  useEffect(() => { handleLoopRef.current = handleLoop; }, [handleLoop]);

  // ── Wrapped stop/seek — reset beat tracking ──────────────────────────────
  const wrappedStop = useCallback(() => {
    stop();
    beatIndexRef.current = 0;
    waitingBeatRef.current = null;
    pressedSetRef.current = new Set();
    setExpectedNotes(new Set());
    setPressedExpected(new Set());
    dispatchRef.current?.({ type: 'UNFREEZE_TIME' });
    dispatchRef.current?.({ type: 'SET_EXPECTED_NOTES', payload: [] });
    autoIndexRef.current = 0;
    silenceAutoplay();
  }, [stop, silenceAutoplay]);

  const wrappedSeekTo = useCallback((t) => {
    seekTo(t);
    const beats = beatMapRef.current;
    let idx = 0;
    while (idx < beats.length && beats[idx].time < t - CHORD_GROUP_TOLERANCE) idx++;
    beatIndexRef.current = idx;
    waitingBeatRef.current = null;
    pressedSetRef.current = new Set();
    setExpectedNotes(new Set());
    setPressedExpected(new Set());
    // Reset autoplay to the correct position
    const sched = autoScheduleRef.current;
    let ai = 0;
    while (ai < sched.length && sched[ai].time < t) ai++;
    autoIndexRef.current = ai;
    silenceAutoplay();
  }, [seekTo, silenceAutoplay]);

  // ── Wait Mode: freeze when playhead enters the hit window ────────────────
  //
  // Uses toleranceRef.current (not toleranceSec) so a changed tolerance takes
  // effect immediately without restarting this effect.
  useEffect(() => {
    if (mode !== 'wait' || !isPlaying) return;

    const beats = beatMapRef.current;
    const idx   = beatIndexRef.current;
    if (idx >= beats.length) return;

    const nextBeat = beats[idx];

    // Freeze when the playhead is within the configurable hit window
    if (currentTime >= nextBeat.time - toleranceRef.current && !isFrozen) {
      waitingBeatRef.current = nextBeat;
      pressedSetRef.current  = new Set();
      setExpectedNotes(new Set(nextBeat.midis));
      setPressedExpected(new Set());
      syncFreeze([...nextBeat.midis]);
    }
  }, [currentTime, mode, isPlaying, isFrozen, syncFreeze]);

  // ── Wait Mode: validate key presses against expected notes ───────────────
  //
  // Runs whenever activeNotes changes (i.e. any key press/release).
  // All math is done on refs — no state reads → zero React overhead.
  useEffect(() => {
    if (mode !== 'wait' || !isFrozen) return;
    const waiting = waitingBeatRef.current;
    if (!waiting) return;

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

    // All required notes pressed → advance beat index and unfreeze
    const allPressed = [...waiting.midis].every((m) => pressedSetRef.current.has(m));
    if (allPressed) {
      beatIndexRef.current += 1;
      waitingBeatRef.current = null;
      pressedSetRef.current  = new Set();
      setExpectedNotes(new Set());
      setPressedExpected(new Set());
      syncUnfreeze();
    }
  }, [activeNotes, mode, isFrozen, syncUnfreeze]);

  // ── Follow / Free mode: clear wait state if somehow frozen ───────────────
  useEffect(() => {
    if (mode !== 'wait' && isFrozen) {
      setExpectedNotes(new Set());
      setPressedExpected(new Set());
      syncUnfreeze();
    }
  }, [mode, isFrozen, syncUnfreeze]);

  return {
    currentTime,
    isPlaying,
    isFrozen,
    expectedNotes,
    pressedExpected,
    play,
    pause,
    stop:   wrappedStop,
    seekTo: wrappedSeekTo,
  };
}
