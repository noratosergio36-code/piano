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

  // Tracks the last status byte for MIDI running status support.
  // Some pianos omit the status byte on consecutive same-type messages.
  const lastStatusRef = useRef(0);

  const handleMidiMessage = useCallback((event) => {
    const data = event.data;
    let status, note, velocity;

    // Running status: if the first byte has the high bit clear it's a data byte,
    // meaning the status is inherited from the previous message.
    if (data[0] & 0x80) {
      status = data[0];
      lastStatusRef.current = status;
      note     = data[1];
      velocity = data[2];
    } else {
      status   = lastStatusRef.current;
      note     = data[0];
      velocity = data[1];
    }

    const command = status & 0xf0;

    if (command === 0x90 && velocity > 0) {
      // Note On
      setActiveNotes((prev) => {
        const next = new Set(prev);
        next.add(note);
        return next;
      });
    } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
      // Note Off (also handles Note On with velocity 0)
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
