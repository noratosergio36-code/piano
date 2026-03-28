import { useRef, useState, useCallback, useEffect } from 'react';

/**
 * Game loop hook using requestAnimationFrame.
 *
 * Separates two concerns:
 *  - The RAF draw loop (always running while playing, keeps canvas alive)
 *  - Time advancement (can be frozen independently for Wait Mode)
 *
 * @param {{ onTick?: (currentTime: number) => void, playbackRate?: number }} options
 * @returns {{
 *   currentTime: number,
 *   isPlaying: boolean,
 *   isFrozen: boolean,
 *   play: () => void,
 *   pause: () => void,
 *   stop: () => void,
 *   seekTo: (time: number) => void,
 *   freeze: () => void,
 *   unfreeze: () => void,
 * }}
 */
export function useGameLoop({
  onTick,
  playbackRate = 1.0,
  loopStart    = 0,
  loopEnd      = null,
  isLooping    = false,
  onLoop       = null,   // called with (loopStart) when a loop jump occurs
} = {}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const rafRef = useRef(null);
  const startWallRef = useRef(null);
  const startGameRef = useRef(0);
  const frozenRef = useRef(false);
  const onTickRef = useRef(onTick);
  const playbackRateRef = useRef(playbackRate);
  // Loop config refs — always fresh inside the RAF callback
  const loopStartRef  = useRef(loopStart);
  const loopEndRef    = useRef(loopEnd);
  const isLoopingRef  = useRef(isLooping);
  const onLoopRef     = useRef(onLoop);

  useEffect(() => { onTickRef.current  = onTick;    }, [onTick]);
  useEffect(() => { loopStartRef.current  = loopStart;  }, [loopStart]);
  useEffect(() => { loopEndRef.current    = loopEnd;    }, [loopEnd]);
  useEffect(() => { isLoopingRef.current  = isLooping;  }, [isLooping]);
  useEffect(() => { onLoopRef.current     = onLoop;     }, [onLoop]);

  // When playbackRate changes mid-playback: snapshot the current game time
  // and reset the wall-clock origin so elapsed resets to 0 at the new rate.
  // Without this, the game time would jump because the old elapsed * new rate ≠ expected time.
  useEffect(() => {
    playbackRateRef.current = playbackRate;
    if (rafRef.current && !frozenRef.current) {
      // Re-anchor: treat current game time as the new startGameRef
      setCurrentTime((t) => {
        startGameRef.current = t;
        startWallRef.current = performance.now();
        return t;
      });
    }
  }, [playbackRate]);

  const tick = useCallback(() => {
    if (!frozenRef.current) {
      const wallElapsed = (performance.now() - startWallRef.current) / 1000;
      let gameTime = startGameRef.current + wallElapsed * playbackRateRef.current;

      // ── A/B loop logic ──────────────────────────────────────────────────
      const end      = loopEndRef.current;
      const start    = loopStartRef.current;
      const looping  = isLoopingRef.current;

      if (end !== null && gameTime >= end) {
        if (looping) {
          // Loop: jump back to Point A — re-anchor wall clock
          gameTime = start;
          startGameRef.current = start;
          startWallRef.current = performance.now();
          onLoopRef.current?.(start);   // notify usePlayback to reset indices
        } else {
          // One-shot: stop at Point B
          startGameRef.current = end;
          setCurrentTime(end);
          setIsPlaying(false);
          rafRef.current = null;
          onTickRef.current?.(end);
          return; // do NOT schedule next frame
        }
      }
      // ────────────────────────────────────────────────────────────────────

      setCurrentTime(gameTime);
      onTickRef.current?.(gameTime);
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const play = useCallback(() => {
    if (rafRef.current) return;
    frozenRef.current = false;
    startWallRef.current = performance.now();
    setIsFrozen(false);
    setIsPlaying(true);
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const pause = useCallback(() => {
    if (!rafRef.current) return;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setCurrentTime((t) => { startGameRef.current = t; return t; });
    setIsPlaying(false);
    setIsFrozen(false);
    frozenRef.current = false;
  }, []);

  const stop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    startGameRef.current = 0;
    frozenRef.current = false;
    setCurrentTime(0);
    setIsPlaying(false);
    setIsFrozen(false);
  }, []);

  const seekTo = useCallback((time) => {
    startGameRef.current = time;
    startWallRef.current = performance.now();
    setCurrentTime(time);
  }, []);

  /**
   * Freeze time: RAF keeps running (canvas draws) but currentTime stops advancing.
   * Used in Wait Mode to hold the waterfall while expecting a key press.
   */
  const freeze = useCallback(() => {
    if (frozenRef.current) return;
    // Snapshot current game time so unfreeze resumes from here
    setCurrentTime((t) => { startGameRef.current = t; return t; });
    frozenRef.current = true;
    setIsFrozen(true);
  }, []);

  /**
   * Unfreeze: resume time advancement from the frozen position.
   */
  const unfreeze = useCallback(() => {
    if (!frozenRef.current) return;
    startWallRef.current = performance.now();
    frozenRef.current = false;
    setIsFrozen(false);
  }, []);

  useEffect(() => {
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  return { currentTime, isPlaying, isFrozen, play, pause, stop, seekTo, freeze, unfreeze };
}
