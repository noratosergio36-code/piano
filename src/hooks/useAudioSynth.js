import { useRef, useCallback, useEffect } from 'react';
import * as Tone from 'tone';

/**
 * Piano-like polyphonic synth using Tone.js.
 * Lazy-initializes on first note to respect browser autoplay policy.
 *
 * @returns {{
 *   noteOn:  (midi: number, velocity?: number) => void,
 *   noteOff: (midi: number) => void,
 * }}
 */
export function useAudioSynth() {
  const synthRef = useRef(null);
  const activeRef = useRef(new Map()); // midi → Tone note string

  // Build the synth lazily
  const getSynth = useCallback(() => {
    if (synthRef.current) return synthRef.current;

    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: 'triangle8',  // rich but soft timbre
      },
      envelope: {
        attack:  0.008,
        decay:   0.6,
        sustain: 0.25,
        release: 1.4,
      },
      volume: -6,           // dB
    }).toDestination();

    // Add a tiny reverb for depth
    const reverb = new Tone.Reverb({ decay: 1.2, wet: 0.2 }).toDestination();
    synth.connect(reverb);

    synthRef.current = synth;
    return synth;
  }, []);

  const noteOn = useCallback(async (midi, velocity = 0.8) => {
    await Tone.start(); // unlock AudioContext on first gesture
    const synth = getSynth();
    const noteName = Tone.Frequency(midi, 'midi').toNote();
    activeRef.current.set(midi, noteName);
    synth.triggerAttack(noteName, Tone.now(), velocity);
  }, [getSynth]);

  const noteOff = useCallback((midi) => {
    if (!synthRef.current) return;
    const noteName = activeRef.current.get(midi);
    if (!noteName) return;
    synthRef.current.triggerRelease(noteName, Tone.now());
    activeRef.current.delete(midi);
  }, []);

  // Release all notes on unmount
  useEffect(() => {
    return () => {
      if (synthRef.current) {
        synthRef.current.releaseAll();
        synthRef.current.dispose();
        synthRef.current = null;
      }
    };
  }, []);

  return { noteOn, noteOff };
}
