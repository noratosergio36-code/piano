import { useRef, useState, useCallback, useEffect } from 'react';

/**
 * Game loop hook using requestAnimationFrame.
 *
 * Separates two concerns:
 *  - The RAF draw loop (always running while playing, keeps canvas alive)
 *  - Time advancement (can be frozen independently for Wait Mode)
 *
 * @param {{ onTick?: (currentTime: number) => void }} options
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
export function useGameLoop({ onTick } = {}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const rafRef = useRef(null);
  const startWallRef = useRef(null);
  const startGameRef = useRef(0);
  const frozenRef = useRef(false);   // readable in RAF without stale closure
  const onTickRef = useRef(onTick);

  useEffect(() => { onTickRef.current = onTick; }, [onTick]);

  const tick = useCallback(() => {
    if (!frozenRef.current) {
      const elapsed = (performance.now() - startWallRef.current) / 1000;
      const gameTime = startGameRef.current + elapsed;
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
