import { useRef, useCallback, useEffect } from 'react';
import * as Tone from 'tone';

/**
 * Build a Tone.js PolySynth + optional effects chain for the given instrument.
 * Returns { synth, effectsChain: [] } — caller must dispose both on cleanup.
 *
 * @param {'piano'|'organ'|'chiptune'|'marimba'} instrument
 * @returns {{ synth: Tone.PolySynth, effects: Tone.ToneAudioNode[] }}
 */
function buildInstrument(instrument) {
  const effects = [];

  switch (instrument) {

    case 'organ': {
      const synth = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 1,
        modulationIndex: 0.5,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.01, decay: 0.01, sustain: 1.0, release: 0.3 },
        modulation: { type: 'sine' },
        modulationEnvelope: { attack: 0.5, decay: 0.01, sustain: 1.0, release: 0.5 },
        volume: -6,
      });
      const chorus = new Tone.Chorus(3, 2.5, 0.4).toDestination().start();
      synth.connect(chorus);
      effects.push(chorus);
      return { synth, effects };
    }

    case 'chiptune': {
      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'square' },
        envelope: { attack: 0.01, decay: 0.0, sustain: 1.0, release: 0.05 },
        volume: -8,
      }).toDestination();
      return { synth, effects };
    }

    case 'marimba': {
      const synth = new Tone.PolySynth(Tone.AMSynth, {
        harmonicity: 0.5,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.001, decay: 0.4, sustain: 0.0, release: 0.5 },
        modulation: { type: 'square' },
        modulationEnvelope: { attack: 0.001, decay: 0.2, sustain: 0.0, release: 0.2 },
        volume: -4,
      }).toDestination();
      const reverb = new Tone.Reverb({ decay: 0.8, wet: 0.15 }).toDestination();
      synth.connect(reverb);
      effects.push(reverb);
      return { synth, effects };
    }

    case 'piano':
    default: {
      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle8' },
        envelope: { attack: 0.008, decay: 0.6, sustain: 0.25, release: 1.4 },
        volume: -6,
      }).toDestination();
      const reverb = new Tone.Reverb({ decay: 1.2, wet: 0.2 }).toDestination();
      synth.connect(reverb);
      effects.push(reverb);
      return { synth, effects };
    }
  }
}

/**
 * Piano-like polyphonic synth using Tone.js.
 * The active instrument is determined by the `instrument` parameter.
 * Switching instruments disposes the old synth and creates a fresh one.
 *
 * @param {'piano'|'organ'|'chiptune'|'marimba'} instrument
 * @returns {{
 *   noteOn:  (midi: number, velocity?: number) => void,
 *   noteOff: (midi: number) => void,
 * }}
 */
export function useAudioSynth(instrument = 'piano') {
  const synthRef    = useRef(null);
  const effectsRef  = useRef([]);
  const activeRef   = useRef(new Map()); // midi → Tone note string

  // ── Rebuild synth when instrument changes ─────────────────────────────────
  useEffect(() => {
    // Dispose previous synth + effects
    if (synthRef.current) {
      synthRef.current.releaseAll();
      synthRef.current.dispose();
      synthRef.current = null;
    }
    effectsRef.current.forEach((fx) => fx.dispose());
    effectsRef.current = [];
    activeRef.current.clear();

    const { synth, effects } = buildInstrument(instrument);
    synthRef.current   = synth;
    effectsRef.current = effects;
  }, [instrument]);

  const noteOn = useCallback(async (midi, velocity = 0.8) => {
    await Tone.start();
    if (!synthRef.current) return;
    const noteName = Tone.Frequency(midi, 'midi').toNote();
    activeRef.current.set(midi, noteName);
    synthRef.current.triggerAttack(noteName, Tone.now(), velocity);
  }, []);

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
      effectsRef.current.forEach((fx) => fx.dispose());
      effectsRef.current = [];
    };
  }, []);

  return { noteOn, noteOff };
}
