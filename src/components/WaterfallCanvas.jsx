import { useRef, useEffect, useMemo } from 'react';
import { buildKeyMap } from '../utils/keyLayout';
import { PIANO_CONFIG } from '../constants/piano';

const PIXELS_PER_SECOND = 200;
const LOOKAHEAD_SECONDS = 2;
const NOTE_RADIUS = 4;

// Hand-based color palette: right = cyan, left = purple
const HAND_COLORS = {
  right: ['#4fc3f7', '#0288d1'], // [white-key, black-key]
  left:  ['#ce93d8', '#9c27b0'],
};

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
 *   notes: Array<{midi:number, time:number, duration:number, track?:number, hand?:'left'|'right'}>,
 *   currentTime: number,
 *   activeNotes: Set<number>,
 *   expectedNotes: Set<number>,
 *   pressedExpected: Set<number>,
 *   isFrozen: boolean,
 *   range: {start:number, end:number},
 *   practicingHands: ('left'|'right')[],
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
  practicingHands = ['left', 'right'],
  loopStart = 0,
  loopEnd   = null,
  isLooping = false,
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
  const practicingHandsRef = useRef(practicingHands);
  const loopStartRef  = useRef(loopStart);
  const loopEndRef    = useRef(loopEnd);
  const isLoopingRef  = useRef(isLooping);

  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);
  useEffect(() => { notesRef.current = notes; }, [notes]);
  useEffect(() => { activeNotesRef.current = activeNotes; }, [activeNotes]);
  useEffect(() => { expectedNotesRef.current = expectedNotes; }, [expectedNotes]);
  useEffect(() => { pressedExpectedRef.current = pressedExpected; }, [pressedExpected]);
  useEffect(() => { isFrozenRef.current = isFrozen; }, [isFrozen]);
  useEffect(() => { practicingHandsRef.current = practicingHands; }, [practicingHands]);
  useEffect(() => { loopStartRef.current  = loopStart;  }, [loopStart]);
  useEffect(() => { loopEndRef.current    = loopEnd;    }, [loopEnd]);
  useEffect(() => { isLoopingRef.current  = isLooping;  }, [isLooping]);

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

      const practicingHands = practicingHandsRef.current;

      for (const note of notesRef.current) {
        if (note.time > visibleEnd) continue;
        if (note.time + note.duration < visibleStart) continue;

        const key = keyMap.get(note.midi);
        if (!key) continue;

        const hand = note.hand ?? 'right';
        const [colorWhite, colorBlack] = HAND_COLORS[hand] ?? HAND_COLORS.right;
        const baseColor = key.isBlack ? colorBlack : colorWhite;
        const isAutoplay = !practicingHands.includes(hand);

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
          ctx.globalAlpha = isAutoplay ? 0.42 : 0.92;
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

      // ── A/B loop markers ──────────────────────────────────────────────
      const loopA   = loopStartRef.current;
      const loopB   = loopEndRef.current;
      const looping = isLoopingRef.current;

      if (loopB !== null) {
        // Shaded region between A and B
        const yA = H - (loopA - t) * PIXELS_PER_SECOND;
        const yB = H - (loopB - t) * PIXELS_PER_SECOND;
        const rTop    = Math.min(yA, yB);
        const rBottom = Math.max(yA, yB);
        if (rBottom > 0 && rTop < H) {
          ctx.fillStyle = looping
            ? 'rgba(96,179,255,0.06)'
            : 'rgba(245,158,11,0.05)';
          ctx.fillRect(0, Math.max(0, rTop), W, Math.min(H, rBottom) - Math.max(0, rTop));
        }

        // Point A line (cyan)
        if (yA >= 0 && yA <= H) {
          ctx.strokeStyle = 'rgba(96,179,255,0.75)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.moveTo(0, yA); ctx.lineTo(W, yA);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.font = 'bold 10px "Segoe UI", sans-serif';
          ctx.fillStyle = '#60b3ff';
          ctx.fillText('A', 4, yA - 3);
        }

        // Point B line (amber)
        if (yB >= 0 && yB <= H) {
          ctx.strokeStyle = 'rgba(245,158,11,0.75)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.moveTo(0, yB); ctx.lineTo(W, yB);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.font = 'bold 10px "Segoe UI", sans-serif';
          ctx.fillStyle = '#f59e0b';
          ctx.fillText('B', 4, yB - 3);
        }
      }
      // ──────────────────────────────────────────────────────────────────

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
