import { useRef, useEffect, useMemo } from 'react';
import { buildKeyMap } from '../utils/keyLayout';
import { PIANO_CONFIG } from '../constants/piano';

const PIXELS_PER_SECOND = 200;
const LOOKAHEAD_SECONDS = 2;
const NOTE_RADIUS = 4;

const TRACK_COLORS = [
  ['#4fc3f7', '#0288d1'],
  ['#ef9a9a', '#c62828'],
  ['#a5d6a7', '#2e7d32'],
  ['#fff176', '#f9a825'],
  ['#ce93d8', '#6a1b9a'],
];

function roundRect(ctx, x, y, w, h, r) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * WaterfallCanvas
 *
 * @param {{
 *   notes: Array<{midi:number, time:number, duration:number, track?:number}>,
 *   currentTime: number,
 *   activeNotes: Set<number>,
 *   expectedNotes: Set<number>,
 *   pressedExpected: Set<number>,
 *   isFrozen: boolean,
 *   range: {start:number, end:number},
 * }} props
 */
export function WaterfallCanvas({
  notes = [],
  currentTime = 0,
  activeNotes = new Set(),
  expectedNotes = new Set(),
  pressedExpected = new Set(),
  isFrozen = false,
  range = PIANO_CONFIG.defaultRange,
}) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  // Mutable refs so the draw loop always reads fresh values without restart
  const currentTimeRef = useRef(currentTime);
  const notesRef = useRef(notes);
  const activeNotesRef = useRef(activeNotes);
  const expectedNotesRef = useRef(expectedNotes);
  const pressedExpectedRef = useRef(pressedExpected);
  const isFrozenRef = useRef(isFrozen);

  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);
  useEffect(() => { notesRef.current = notes; }, [notes]);
  useEffect(() => { activeNotesRef.current = activeNotes; }, [activeNotes]);
  useEffect(() => { expectedNotesRef.current = expectedNotes; }, [expectedNotes]);
  useEffect(() => { pressedExpectedRef.current = pressedExpected; }, [pressedExpected]);
  useEffect(() => { isFrozenRef.current = isFrozen; }, [isFrozen]);

  const keyMap = useMemo(() => buildKeyMap(range.start, range.end), [range]);

  // Draw loop — restarts only when keyMap / range changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const ctx = canvas.getContext('2d');
      const W = canvas.width;
      const H = canvas.height;
      const t = currentTimeRef.current;
      const frozen = isFrozenRef.current;
      const expected = expectedNotesRef.current;
      const pressed = pressedExpectedRef.current;
      const pulse = frozen ? (Math.sin(performance.now() / 200) * 0.5 + 0.5) : 0;

      ctx.clearRect(0, 0, W, H);

      // Background
      ctx.fillStyle = '#0d0d1a';
      ctx.fillRect(0, 0, W, H);

      // Highlight lanes for expected notes (Wait Mode)
      if (frozen && expected.size > 0) {
        expected.forEach((midi) => {
          const key = keyMap.get(midi);
          if (!key) return;
          const isPressedAlready = pressed.has(midi);
          ctx.fillStyle = isPressedAlready
            ? `rgba(110,231,183,${0.12 + pulse * 0.08})`
            : `rgba(96,179,255,${0.08 + pulse * 0.12})`;
          ctx.fillRect(key.x, 0, key.width, H);
        });
      }

      // Lane guides
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      for (let m = range.start; m <= range.end; m++) {
        const key = keyMap.get(m);
        if (!key || key.isBlack) continue;
        ctx.beginPath();
        ctx.moveTo(key.x + key.width, 0);
        ctx.lineTo(key.x + key.width, H);
        ctx.stroke();
      }

      // Note blocks
      const visibleStart = t - 0.1;
      const visibleEnd = t + LOOKAHEAD_SECONDS + H / PIXELS_PER_SECOND;

      for (const note of notesRef.current) {
        if (note.time > visibleEnd) continue;
        if (note.time + note.duration < visibleStart) continue;

        const key = keyMap.get(note.midi);
        if (!key) continue;

        const trackIdx = (note.track ?? 0) % TRACK_COLORS.length;
        const [colorWhite, colorBlack] = TRACK_COLORS[trackIdx];
        const baseColor = key.isBlack ? colorBlack : colorWhite;

        const distanceFromBottom = (note.time - t) * PIXELS_PER_SECOND;
        const blockHeight = Math.max(4, note.duration * PIXELS_PER_SECOND);
        const x = key.x + 1;
        const w = key.width - 2;
        const y = H - distanceFromBottom - blockHeight;

        if (y + blockHeight < 0) continue;

        const isActive = activeNotesRef.current.has(note.midi);
        const isExpected = expected.has(note.midi);
        const isPressedAlready = pressed.has(note.midi);

        if (isActive) {
          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = 1;
        } else if (frozen && isExpected && !isPressedAlready) {
          // Pulsing highlight for notes the user still needs to press
          ctx.fillStyle = `hsl(210,100%,${65 + pulse * 20}%)`;
          ctx.globalAlpha = 0.9 + pulse * 0.1;
        } else if (frozen && isExpected && isPressedAlready) {
          // Already pressed — show as green
          ctx.fillStyle = '#6ee7b7';
          ctx.globalAlpha = 0.95;
        } else {
          ctx.fillStyle = baseColor;
          ctx.globalAlpha = 0.92;
        }

        roundRect(ctx, x, y, w, blockHeight, NOTE_RADIUS);
        ctx.fill();

        // Inner shine
        if (!isActive) {
          ctx.fillStyle = 'rgba(255,255,255,0.15)';
          roundRect(ctx, x + 2, y + 2, w - 4, Math.min(blockHeight - 4, 12), NOTE_RADIUS);
          ctx.fill();
        }

        ctx.globalAlpha = 1;
      }

      // Wait Mode frozen indicator
      if (frozen) {
        ctx.font = `bold ${14 + pulse * 2}px "Segoe UI", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = `rgba(96,179,255,${0.6 + pulse * 0.4})`;
        ctx.fillText('⏳  Presiona las teclas resaltadas', W / 2, 28);
      }

      // Scan line
      ctx.strokeStyle = 'rgba(96,179,255,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, H);
      ctx.lineTo(W, H);
      ctx.stroke();

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [keyMap, range]);

  // Resize canvas via ResizeObserver
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(([entry]) => {
      canvas.width = entry.contentRect.width;
      canvas.height = entry.contentRect.height;
    });
    observer.observe(canvas.parentElement);
    return () => observer.disconnect();
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height: '100%' }}
      aria-label="Note waterfall"
    />
  );
}
