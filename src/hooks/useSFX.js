import { useRef, useCallback, useEffect } from 'react';
import * as Tone from 'tone';

/**
 * Sound effects engine — separate from the main instrument synth.
 * All SFX synths are routed to Tone.Destination at a lower volume (-12 dB).
 *
 * @returns {{
 *   playSuccess:    () => void,
 *   playComboBonus: () => void,
 *   playError:      () => void,
 * }}
 */
export function useSFX() {
  const successSynthRef   = useRef(null);
  const arpSynthRef       = useRef(null);
  const errorSynthRef     = useRef(null);
  // Throttle timestamps — prevent re-triggering within cooldown window
  const lastSuccessRef    = useRef(0);
  const lastErrorRef      = useRef(0);

  // ── Lazy initializers ──────────────────────────────────────────────────────

  const getSuccessSynth = useCallback(() => {
    if (successSynthRef.current) return successSynthRef.current;
    successSynthRef.current = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.08, sustain: 0.0, release: 0.1 },
      volume: -12,
    }).toDestination();
    return successSynthRef.current;
  }, []);

  const getArpSynth = useCallback(() => {
    if (arpSynthRef.current) return arpSynthRef.current;
    arpSynthRef.current = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.001, decay: 0.1, sustain: 0.0, release: 0.12 },
      volume: -12,
    }).toDestination();
    return arpSynthRef.current;
  }, []);

  const getErrorSynth = useCallback(() => {
    if (errorSynthRef.current) return errorSynthRef.current;
    // Brown noise burst — warm, non-harsh thud
    errorSynthRef.current = new Tone.NoiseSynth({
      noise: { type: 'brown' },
      envelope: { attack: 0.001, decay: 0.12, sustain: 0.0, release: 0.08 },
      volume: -18,
    }).toDestination();
    return errorSynthRef.current;
  }, []);

  // ── Public SFX API ─────────────────────────────────────────────────────────

  /** Bright "coin" ping — played on every correct note hit. */
  const playSuccess = useCallback(async () => {
    const now = performance.now();
    if (now - lastSuccessRef.current < 80) return; // min 80 ms between hits
    lastSuccessRef.current = now;
    await Tone.start();
    getSuccessSynth().triggerAttackRelease('E6', '32n', Tone.now() + 0.002);
  }, [getSuccessSynth]);

  /** Ascending arpegio C6→E6→G6 — played on every combo ×10 milestone. */
  const playComboBonus = useCallback(async () => {
    await Tone.start();
    const synth = getArpSynth();
    const now   = Tone.now();
    synth.triggerAttackRelease('C6', '32n', now);
    synth.triggerAttackRelease('E6', '32n', now + 0.07);
    synth.triggerAttackRelease('G6', '32n', now + 0.14);
  }, [getArpSynth]);

  /** Soft brown-noise thud — played on wrong notes and misses. */
  const playError = useCallback(async () => {
    const now = performance.now();
    if (now - lastErrorRef.current < 200) return; // min 200 ms between errors
    lastErrorRef.current = now;
    await Tone.start();
    // Schedule slightly in the future so rapid calls don't clash
    getErrorSynth().triggerAttackRelease('8n', Tone.now() + 0.005);
  }, [getErrorSynth]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      successSynthRef.current?.dispose();
      arpSynthRef.current?.dispose();
      errorSynthRef.current?.dispose();
    };
  }, []);

  return { playSuccess, playComboBonus, playError };
}
