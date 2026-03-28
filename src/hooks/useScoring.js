import { useEffect, useRef, useCallback } from 'react';

/**
 * Scoring hook for Follow and Wait modes.
 *
 * Follow Mode:
 *  - New key press matches a note in the tolerance window → +10, +combo, PERFECTO
 *  - New key press with no matching note (but notes ARE active) → -1, reset combo, UPS
 *  - Note passes without being pressed → -1, reset combo, UPS (one popup per miss cluster)
 *
 * Wait Mode:
 *  - Correct note pressed while frozen:
 *      → +10, +combo, PERFECTO
 *      → If within 2 s of freeze: +5 extra, SÚPER RÁPIDO
 *  - Wrong note pressed while frozen → -1, reset combo, CASI
 *
 * @param {{
 *   notes:           Array<{midi:number, time:number, duration:number, hand:'left'|'right'}>,
 *   activeNotes:     Set<number>,
 *   currentTime:     number,
 *   mode:            string,
 *   toleranceSec:    number,
 *   isFrozen:        boolean,
 *   expectedNotes:   Set<number>,
 *   practicingHands: ('left'|'right')[],
 *   keyRange:        { start:number, end:number },
 *   dispatch:        (action: {type:string, payload?:unknown}) => void,
 *   isPlaying:       boolean,
 *   onSuccess?:      () => void,
 *   onError?:        () => void,
 *   onComboBonus?:   () => void,
 * }} options
 */
export function useScoring({
  notes,
  activeNotes,
  currentTime,
  mode,
  toleranceSec,
  isFrozen,
  expectedNotes,
  practicingHands,
  keyRange,
  dispatch,
  isPlaying,
  onSuccess   = null,
  onError     = null,
  onComboBonus = null,
}) {
  // ── Refs (never trigger re-renders) ─────────────────────────────────────────
  const processedRef    = useRef(new Set()); // note indices already hit or missed
  const prevActiveRef   = useRef(new Set()); // previous activeNotes snapshot
  const freezeWallRef   = useRef(null);      // performance.now() when freeze started
  const lastMissTimeRef = useRef(-1);        // wall time of last miss popup (throttle)
  const localComboRef   = useRef(0);         // local combo counter (mirrors AppContext.combo)
  const dispatchRef     = useRef(dispatch);
  useEffect(() => { dispatchRef.current = dispatch; }, [dispatch]);

  // Keep SFX callbacks fresh without restarting effects
  const onSuccessRef    = useRef(onSuccess);
  const onErrorRef      = useRef(onError);
  const onComboBonusRef = useRef(onComboBonus);
  useEffect(() => { onSuccessRef.current    = onSuccess;    }, [onSuccess]);
  useEffect(() => { onErrorRef.current      = onError;      }, [onError]);
  useEffect(() => { onComboBonusRef.current = onComboBonus; }, [onComboBonus]);

  // ── Helper: build popup ──────────────────────────────────────────────────────
  const addPopup = useCallback((text, popupType, midi) => {
    const range = keyRange.end - keyRange.start;
    const xPct  = range > 0
      ? Math.max(5, Math.min(92, ((midi - keyRange.start) / range) * 100))
      : 50;
    dispatchRef.current({
      type: 'ADD_POPUP',
      payload: { id: crypto.randomUUID(), text, popupType, x: xPct },
    });
  }, [keyRange]);

  // ── Helpers: record hit / error with SFX ────────────────────────────────────
  const registerHit = useCallback(() => {
    localComboRef.current += 1;
    dispatchRef.current({ type: 'INCREMENT_COMBO' });
    if (localComboRef.current % 10 === 0) {
      onComboBonusRef.current?.();
    } else {
      onSuccessRef.current?.();
    }
  }, []);

  const registerError = useCallback(() => {
    localComboRef.current = 0;
    dispatchRef.current({ type: 'RESET_COMBO' });
    onErrorRef.current?.();
  }, []);

  // ── Reset when song or mode changes ─────────────────────────────────────────
  useEffect(() => {
    processedRef.current    = new Set();
    prevActiveRef.current   = new Set();
    lastMissTimeRef.current = -1;
    localComboRef.current   = 0;
    dispatchRef.current({ type: 'RESET_SCORE' });
  }, [notes, mode]);

  // ── Track freeze timestamp for SÚPER RÁPIDO bonus ───────────────────────────
  useEffect(() => {
    if (isFrozen) {
      freezeWallRef.current = performance.now();
    }
  }, [isFrozen]);

  // ── Detect newly pressed keys ────────────────────────────────────────────────
  useEffect(() => {
    const isScored = mode === 'follow' || mode === 'wait';
    if (!isScored || !isPlaying) {
      prevActiveRef.current = activeNotes;
      return;
    }

    const prev = prevActiveRef.current;
    const newlyPressed = [];
    for (const midi of activeNotes) {
      if (!prev.has(midi)) newlyPressed.push(midi);
    }
    prevActiveRef.current = activeNotes;

    if (newlyPressed.length === 0) return;

    // ── FOLLOW MODE ────────────────────────────────────────────────────────────
    if (mode === 'follow') {
      for (const midi of newlyPressed) {
        // Find a matching unprocessed note within tolerance window
        let hitIdx = -1;
        for (let i = 0; i < notes.length; i++) {
          const n = notes[i];
          if (n.midi !== midi) continue;
          if (processedRef.current.has(i)) continue;
          if (!practicingHands.includes(n.hand ?? 'right')) continue;
          const winStart = n.time - toleranceSec;
          const winEnd   = n.time + n.duration + toleranceSec;
          if (currentTime >= winStart && currentTime <= winEnd) {
            hitIdx = i;
            break;
          }
        }

        if (hitIdx >= 0) {
          processedRef.current.add(hitIdx);
          dispatchRef.current({ type: 'ADD_SCORE', payload: 10 });
          registerHit();
          addPopup('¡PERFECTO!', 'perfect', midi);
        } else {
          // Only penalize if there are practice notes active right now (not during rests)
          const noteActive = notes.some((n, i) =>
            !processedRef.current.has(i) &&
            practicingHands.includes(n.hand ?? 'right') &&
            currentTime >= n.time - toleranceSec &&
            currentTime <= n.time + n.duration + toleranceSec
          );
          if (noteActive) {
            dispatchRef.current({ type: 'ADD_SCORE', payload: -1 });
            registerError();
            addPopup('¡UPS!', 'miss', midi);
          }
        }
      }
    }

    // ── WAIT MODE ──────────────────────────────────────────────────────────────
    if (mode === 'wait' && isFrozen) {
      for (const midi of newlyPressed) {
        if (expectedNotes.has(midi)) {
          const elapsed = performance.now() - (freezeWallRef.current ?? performance.now());
          dispatchRef.current({ type: 'ADD_SCORE', payload: 10 });
          registerHit();
          if (elapsed < 2000) {
            dispatchRef.current({ type: 'ADD_SCORE', payload: 5 });
            addPopup('¡SÚPER RÁPIDO!', 'super', midi);
          } else {
            addPopup('¡PERFECTO!', 'perfect', midi);
          }
        } else {
          dispatchRef.current({ type: 'ADD_SCORE', payload: -1 });
          registerError();
          addPopup('¡CASI!', 'wrong', midi);
        }
      }
    }
  }, [activeNotes, mode, isFrozen, isPlaying, notes, currentTime, toleranceSec,
      practicingHands, expectedNotes, addPopup, registerHit, registerError]);

  // ── FOLLOW MODE: detect missed notes ─────────────────────────────────────────
  // Throttled: one popup per 800 ms to avoid UPS spam on multi-note passages.
  useEffect(() => {
    if (mode !== 'follow' || !isPlaying) return;

    let missCount = 0;
    let missMidi  = 60;

    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      if (processedRef.current.has(i)) continue;
      if (!practicingHands.includes(n.hand ?? 'right')) continue;
      if (n.time + n.duration + toleranceSec < currentTime - toleranceSec) {
        processedRef.current.add(i);
        missCount++;
        missMidi = n.midi;
        dispatchRef.current({ type: 'ADD_SCORE', payload: -1 });
        localComboRef.current = 0;
        dispatchRef.current({ type: 'RESET_COMBO' });
      }
    }

    if (missCount > 0) {
      // SFX + popup once per batch of misses (throttled)
      registerError();
      const now = performance.now();
      if (now - lastMissTimeRef.current > 800) {
        lastMissTimeRef.current = now;
        addPopup('¡UPS!', 'miss', missMidi);
      }
    }
  }, [currentTime, mode, isPlaying, notes, toleranceSec, practicingHands, addPopup, registerError]);
}
