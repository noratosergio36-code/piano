import { useEffect, useRef } from 'react';
import {
  Renderer,
  Stave,
  StaveNote,
  Voice,
  Formatter,
  Accidental,
  StaveConnector,
  Dot,
} from 'vexflow';
import { useAppContext } from '../context/AppContext';
import { quantizeVoice, emptyMeasure } from '../utils/quantizer';
import './SheetMusicView.css';

// ── MIDI → VexFlow key helpers ──────────────────────────────────────────────

/** VexFlow note name for each semitone 0-11 (sharps only) */
const VEX_NAMES = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
/** '#' when note needs an accidental, null otherwise */
const VEX_ACC   = [null, '#', null, '#', null, null, '#', null, '#', null, '#', null];

/**
 * @param {number} midi
 * @returns {string}  e.g. 'c/4', 'f#/5'
 */
function midiToKey(midi) {
  const octave = Math.floor(midi / 12) - 1;
  return `${VEX_NAMES[midi % 12]}/${octave}`;
}

/**
 * @param {number} midi
 * @returns {string | null}
 */
function midiAccidental(midi) {
  return VEX_ACC[midi % 12];
}

// ── Layout constants ─────────────────────────────────────────────────────────

const MEASURES_PER_ROW   = 4;
const FIRST_STAVE_WIDTH  = 260;  // extra room for clef + time sig
const STAVE_WIDTH        = 200;
const X_START            = 20;
const TREBLE_Y_OFFSET    = 40;
const BASS_Y_OFFSET      = 150;
const ROW_HEIGHT         = 280;
const PADDING_BOTTOM     = 40;

/** Middle C (MIDI 60) is the split point: ≥60 → treble, <60 → bass */
const TREBLE_CUTOFF = 60;

// ── VexFlow rendering ────────────────────────────────────────────────────────

/**
 * Builds a StaveNote from a VexEvent.
 *
 * @param {import('../utils/quantizer').VexEvent} event
 * @param {'treble'|'bass'} clef
 * @returns {StaveNote}
 */
function buildStaveNote(event, clef) {
  const { vexDur, midiNumbers, isRest } = event;

  let keys;
  if (isRest) {
    // Conventional rest-glyph anchor position per clef
    keys = clef === 'treble' ? ['b/4'] : ['d/3'];
  } else {
    keys = midiNumbers.map(midiToKey);
  }

  const duration = isRest ? `${vexDur}r` : vexDur;
  const note = new StaveNote({ keys, duration, clef });

  if (!isRest) {
    midiNumbers.forEach((midi, i) => {
      const acc = midiAccidental(midi);
      if (acc) note.addModifier(new Accidental(acc), i);
    });
  }

  return note;
}

/**
 * Renders the full Grand Staff score into `container`.
 *
 * @param {HTMLElement}                                container
 * @param {import('../utils/quantizer').VexEvent[][]}  trebleMeasures
 * @param {import('../utils/quantizer').VexEvent[][]}  bassMeasures
 * @param {number}                                     totalMeasures
 */
function renderScore(container, trebleMeasures, bassMeasures, totalMeasures) {
  container.innerHTML = '';

  const rows        = Math.ceil(totalMeasures / MEASURES_PER_ROW);
  const canvasWidth = X_START + FIRST_STAVE_WIDTH + (MEASURES_PER_ROW - 1) * STAVE_WIDTH + 30;
  const canvasHeight = rows * ROW_HEIGHT + PADDING_BOTTOM;

  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(canvasWidth, canvasHeight);
  const ctx = renderer.getContext();

  for (let row = 0; row < rows; row++) {
    const rowMeasureStart = row * MEASURES_PER_ROW;
    const measuresInRow   = Math.min(MEASURES_PER_ROW, totalMeasures - rowMeasureStart);
    const rowY            = row * ROW_HEIGHT;

    for (let col = 0; col < measuresInRow; col++) {
      const measureIdx = rowMeasureStart + col;
      const isFirst    = col === 0;
      const staveX     = X_START + (isFirst ? 0 : FIRST_STAVE_WIDTH + (col - 1) * STAVE_WIDTH);
      const staveW     = isFirst ? FIRST_STAVE_WIDTH : STAVE_WIDTH;
      const trebleY    = rowY + TREBLE_Y_OFFSET;
      const bassY      = rowY + BASS_Y_OFFSET;

      // ── Draw staves ────────────────────────────────────────────────────────
      const trebleStave = new Stave(staveX, trebleY, staveW);
      const bassStave   = new Stave(staveX, bassY,   staveW);

      if (isFirst) {
        trebleStave.addClef('treble').addTimeSignature('4/4');
        bassStave.addClef('bass').addTimeSignature('4/4');
      }

      trebleStave.setContext(ctx).draw();
      bassStave.setContext(ctx).draw();

      // ── Connectors ─────────────────────────────────────────────────────────
      if (isFirst) {
        new StaveConnector(trebleStave, bassStave)
          .setType(StaveConnector.type.BRACE)
          .setContext(ctx).draw();
        new StaveConnector(trebleStave, bassStave)
          .setType(StaveConnector.type.SINGLE_LEFT)
          .setContext(ctx).draw();
      }
      if (col === measuresInRow - 1) {
        new StaveConnector(trebleStave, bassStave)
          .setType(StaveConnector.type.SINGLE_RIGHT)
          .setContext(ctx).draw();
      }

      // ── Build StaveNotes ───────────────────────────────────────────────────
      const tEvents = trebleMeasures[measureIdx] ?? emptyMeasure();
      const bEvents = bassMeasures[measureIdx]   ?? emptyMeasure();

      const trebleNotes = tEvents.map((e) => buildStaveNote(e, 'treble'));
      const bassNotes   = bEvents.map((e) => buildStaveNote(e, 'bass'));

      // ── Voices (strict: false tolerates quantization imprecision) ──────────
      const trebleVoice = new Voice({ num_beats: 4, beat_value: 4 }).setStrict(false);
      trebleVoice.addTickables(trebleNotes);
      const bassVoice = new Voice({ num_beats: 4, beat_value: 4 }).setStrict(false);
      bassVoice.addTickables(bassNotes);

      // Format both voices together so noteheads align across both staves
      new Formatter()
        .joinVoices([trebleVoice])
        .joinVoices([bassVoice])
        .format([trebleVoice, bassVoice], staveW - 20);

      trebleVoice.draw(ctx, trebleStave);
      bassVoice.draw(ctx, bassStave);
    }
  }
}

// ── Component ────────────────────────────────────────────────────────────────

/**
 * SheetMusicView — renders a Grand Staff (treble + bass clef) using VexFlow.
 * Re-renders whenever recordedNotes or composerBpm change in AppContext.
 */
export function SheetMusicView() {
  const containerRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const { state } = useAppContext();
  const { recordedNotes, composerBpm } = state;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    try {
      const trebleNotes = recordedNotes.filter((n) => n.midiNumber >= TREBLE_CUTOFF);
      const bassNotes   = recordedNotes.filter((n) => n.midiNumber <  TREBLE_CUTOFF);

      const trebleMeasures = quantizeVoice(trebleNotes, composerBpm);
      const bassMeasures   = quantizeVoice(bassNotes,   composerBpm);

      const totalMeasures = Math.max(
        trebleMeasures.length,
        bassMeasures.length,
        1, // always show at least one empty measure
      );

      renderScore(el, trebleMeasures, bassMeasures, totalMeasures);
    } catch (err) {
      console.error('[SheetMusicView] VexFlow render error:', err);
      el.innerHTML = `<p class="sheet-error">Error al renderizar partitura: ${err.message}</p>`;
    }
  }, [recordedNotes, composerBpm]);

  return (
    <div className="sheet-music-wrapper">
      {recordedNotes.length === 0 && (
        <p className="sheet-hint">
          Pulsa <strong>Grabar</strong> y toca en el teclado para ver la partitura aquí.
        </p>
      )}
      <div ref={containerRef} className="sheet-music-container" />
    </div>
  );
}
