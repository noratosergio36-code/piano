import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Custom hook for Web MIDI API integration
 * @returns {{ activeNotes: Set<number>, midiAccess: MIDIAccess|null, isSupported: boolean, error: string|null }}
 */
export function useMidi() {
  const [activeNotes, setActiveNotes] = useState(new Set());
  const [midiAccess, setMidiAccess] = useState(null);
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState(null);
  const listenersRef = useRef([]);

  const handleMidiMessage = useCallback((event) => {
    const [status, note, velocity] = event.data;
    const command = status & 0xf0;

    if (command === 0x90 && velocity > 0) {
      // Note On
      setActiveNotes((prev) => {
        const next = new Set(prev);
        next.add(note);
        return next;
      });
    } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
      // Note Off
      setActiveNotes((prev) => {
        const next = new Set(prev);
        next.delete(note);
        return next;
      });
    }
  }, []);

  useEffect(() => {
    if (!navigator.requestMIDIAccess) {
      setIsSupported(false);
      setError('Web MIDI API not supported in this browser.');
      return;
    }

    setIsSupported(true);

    navigator.requestMIDIAccess().then((access) => {
      setMidiAccess(access);

      const attachListeners = () => {
        // Detach old listeners
        listenersRef.current.forEach(({ port, handler }) => {
          port.removeEventListener('midimessage', handler);
        });
        listenersRef.current = [];

        // Attach new listeners
        access.inputs.forEach((input) => {
          input.addEventListener('midimessage', handleMidiMessage);
          listenersRef.current.push({ port: input, handler: handleMidiMessage });
        });
      };

      attachListeners();
      access.onstatechange = attachListeners;
    }).catch((err) => {
      setError(`MIDI access denied: ${err.message}`);
    });

    return () => {
      listenersRef.current.forEach(({ port, handler }) => {
        port.removeEventListener('midimessage', handler);
      });
    };
  }, [handleMidiMessage]);

  return { activeNotes, midiAccess, isSupported, error };
}
