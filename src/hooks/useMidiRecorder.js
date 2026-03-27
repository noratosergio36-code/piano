import { useRef, useCallback, useEffect } from 'react';
import { getNoteName } from '../constants/piano';

/**
 * @typedef {{
 *   midiNumber: number,
 *   noteName: string,
 *   startTime: number,
 *   duration: number,
 * }} RecordedNote
 */

/**
 * Records note events (Note On / Note Off) with precise timestamps.
 * Handles both Web MIDI hardware (via midiAccess) and virtual keyboard calls.
 *
 * @param {{
 *   midiAccess: MIDIAccess | null,
 *   isRecording: boolean,
 *   onNoteRecorded: (note: RecordedNote) => void,
 * }} options
 * @returns {{ noteOn: (midi: number) => void, noteOff: (midi: number) => void }}
 */
export function useMidiRecorder({ midiAccess, isRecording, onNoteRecorded }) {
  /** Map of midi → performance.now() at Note On */
  const pendingRef = useRef(/** @type {Map<number, number>} */ (new Map()));
  /** performance.now() when recording started (t=0 reference) */
  const recordingStartRef = useRef(0);

  // Keep mutable refs so stable callbacks can read latest values
  const isRecordingRef = useRef(isRecording);
  const onNoteRecordedRef = useRef(onNoteRecorded);
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);
  useEffect(() => { onNoteRecordedRef.current = onNoteRecorded; }, [onNoteRecorded]);

  // Reset reference clock and clear pending notes when recording starts
  useEffect(() => {
    if (isRecording) {
      recordingStartRef.current = performance.now();
      pendingRef.current.clear();
    }
  }, [isRecording]);

  /**
   * Register a Note On event. Safe to call for both MIDI hardware and virtual keyboard.
   * @param {number} midi
   */
  const noteOn = useCallback((midi) => {
    if (!isRecordingRef.current) return;
    pendingRef.current.set(midi, performance.now());
  }, []);

  /**
   * Register a Note Off event and emit the completed RecordedNote.
   * @param {number} midi
   */
  const noteOff = useCallback((midi) => {
    if (!isRecordingRef.current) return;
    const startMs = pendingRef.current.get(midi);
    if (startMs === undefined) return;
    const nowMs = performance.now();
    pendingRef.current.delete(midi);

    /** @type {RecordedNote} */
    const note = {
      midiNumber: midi,
      noteName: getNoteName(midi, 'american'),
      startTime: (startMs - recordingStartRef.current) / 1000,
      duration: Math.max(0.05, (nowMs - startMs) / 1000), // floor at 50ms
    };
    onNoteRecordedRef.current(note);
  }, []);

  // Attach a dedicated listener to each MIDI input port when midiAccess is available.
  // This listener coexists with useMidi.js's listener (Web MIDI allows multiple handlers).
  useEffect(() => {
    if (!midiAccess) return;

    /** @param {MIDIMessageEvent} event */
    const handleMessage = (event) => {
      const [status, note, velocity] = event.data;
      const cmd = status & 0xf0;
      if (cmd === 0x90 && velocity > 0) {
        noteOn(note);
      } else if (cmd === 0x80 || (cmd === 0x90 && velocity === 0)) {
        noteOff(note);
      }
    };

    const ports = [];
    midiAccess.inputs.forEach((input) => {
      input.addEventListener('midimessage', handleMessage);
      ports.push(input);
    });

    return () => {
      ports.forEach((input) => input.removeEventListener('midimessage', handleMessage));
    };
  }, [midiAccess, noteOn, noteOff]);

  return { noteOn, noteOff };
}
