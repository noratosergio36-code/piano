/**
 * MusicXML parser using the browser's built-in DOMParser.
 * Supports both uncompressed .xml and the plain-text MusicXML format.
 * (Compressed .mxl requires unzipping — handled separately via JSZip if needed.)
 *
 * MusicXML time model:
 *   - <divisions> = number of ticks per quarter note
 *   - <duration>  = note duration in ticks
 *   - <tempo>     = BPM from <sound tempo="X"> or <metronome>
 */

/** Standard MIDI note number for a given step + octave */
const STEP_TO_SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/**
 * Convert a MusicXML <pitch> element to a MIDI note number.
 * @param {Element} pitchEl
 * @returns {number}
 */
function pitchToMidi(pitchEl) {
  const step = pitchEl.querySelector('step')?.textContent ?? 'C';
  const octave = parseInt(pitchEl.querySelector('octave')?.textContent ?? '4', 10);
  const alter = parseFloat(pitchEl.querySelector('alter')?.textContent ?? '0');
  return 12 * (octave + 1) + (STEP_TO_SEMITONE[step] ?? 0) + Math.round(alter);
}

/**
 * Parse a MusicXML string (from a .xml file).
 * Returns a ParsedSong compatible with WaterfallCanvas.
 *
 * @param {string} xmlText
 * @returns {import('./midiParser').ParsedSong}
 */
export function parseMusicXml(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error(`MusicXML parse error: ${parseError.textContent}`);
  }

  const parts = Array.from(doc.querySelectorAll('part'));
  const notes = [];

  // Extract part names from <part-list>
  const partNames = {};
  doc.querySelectorAll('score-part').forEach((sp) => {
    const id = sp.getAttribute('id');
    const name = sp.querySelector('part-name')?.textContent ?? id;
    partNames[id] = name;
  });

  let globalBpm = 120;

  parts.forEach((part, trackIndex) => {
    const partId = part.getAttribute('id');
    const measures = Array.from(part.querySelectorAll('measure'));

    let divisions = 1;      // ticks per quarter note
    let bpm = 120;          // current tempo
    let currentTick = 0;    // absolute tick position

    measures.forEach((measure) => {
      // Update divisions if present in this measure's attributes
      const divsEl = measure.querySelector('attributes > divisions');
      if (divsEl) divisions = parseInt(divsEl.textContent, 10);

      // Update tempo from <sound> or <metronome>
      const soundEl = measure.querySelector('sound[tempo]');
      if (soundEl) bpm = parseFloat(soundEl.getAttribute('tempo'));

      if (trackIndex === 0) globalBpm = bpm;

      const secondsPerTick = 60 / (bpm * divisions);

      // Cursor within this measure (reset each measure; backup/forward handled below)
      let measureOffset = 0;

      Array.from(measure.children).forEach((el) => {
        if (el.tagName === 'note') {
          const durationTicks = parseInt(el.querySelector('duration')?.textContent ?? '0', 10);
          const isChord = !!el.querySelector('chord');
          const isRest = !!el.querySelector('rest');
          const grace = !!el.querySelector('grace');

          // Chord notes share the same start time as the previous note
          if (isChord) {
            // rewind cursor by last note's duration — handled via chordOffset below
          }

          if (!isRest && !grace) {
            const pitchEl = el.querySelector('pitch');
            if (pitchEl) {
              const absTick = currentTick + (isChord ? measureOffset - durationTicks : measureOffset);
              notes.push({
                midi: pitchToMidi(pitchEl),
                time: absTick * secondsPerTick,
                duration: Math.max(0.05, durationTicks * secondsPerTick),
                track: trackIndex,
                velocity: 0.75,
              });
            }
          }

          if (!isChord) measureOffset += durationTicks;

        } else if (el.tagName === 'backup') {
          const ticks = parseInt(el.querySelector('duration')?.textContent ?? '0', 10);
          measureOffset -= ticks;
        } else if (el.tagName === 'forward') {
          const ticks = parseInt(el.querySelector('duration')?.textContent ?? '0', 10);
          measureOffset += ticks;
        }
      });

      // Advance global tick by the measure's actual duration
      // Use the maximum forward movement in the measure
      const measureDivisions = measure.querySelectorAll('note:not([chord]) duration');
      let measureTicks = 0;
      measureDivisions.forEach((d) => {
        measureTicks += parseInt(d.textContent, 10);
      });
      currentTick += measureTicks;
    });
  });

  notes.sort((a, b) => a.time - b.time);

  const duration = notes.length > 0
    ? Math.max(...notes.map((n) => n.time + n.duration))
    : 0;

  const tracks = parts.map((p, i) => ({
    index: i,
    name: partNames[p.getAttribute('id')] ?? `Part ${i + 1}`,
    channel: i,
    instrument: 'piano',
  }));

  return { notes, duration, bpm: globalBpm, tracks, source: 'xml' };
}

/**
 * Load and parse a MusicXML File object from an <input type="file">.
 * @param {File} file
 * @returns {Promise<import('./midiParser').ParsedSong>}
 */
export async function parseMusicXmlFile(file) {
  const text = await file.text();
  return parseMusicXml(text);
}
