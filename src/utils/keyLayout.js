import { isBlackKey } from '../constants/piano';

export const WHITE_KEY_WIDTH = 36; // px
export const BLACK_KEY_WIDTH = 22; // px
export const KEY_HEIGHT = 180;     // px
export const BLACK_KEY_HEIGHT = 110; // px

/**
 * Calculate pixel x-positions for all keys in a MIDI range.
 * Exported so WaterfallCanvas can align note blocks to exact key positions.
 *
 * @param {number} startMidi
 * @param {number} endMidi
 * @returns {{ keys: Array<{midi:number, isBlack:boolean, x:number, width:number, height:number}>, totalWidth:number }}
 */
export function buildKeyLayout(startMidi, endMidi) {
  const keys = [];
  let currentWhite = 0;

  // First pass: white keys (left-to-right, sequential)
  for (let midi = startMidi; midi <= endMidi; midi++) {
    if (!isBlackKey(midi)) {
      keys.push({
        midi,
        isBlack: false,
        x: currentWhite * WHITE_KEY_WIDTH,
        width: WHITE_KEY_WIDTH,
        height: KEY_HEIGHT,
      });
      currentWhite++;
    }
  }

  // Second pass: black keys (positioned between neighboring white keys)
  let wIdx = 0;
  for (let midi = startMidi; midi <= endMidi; midi++) {
    if (!isBlackKey(midi)) {
      wIdx++;
      continue;
    }
    keys.push({
      midi,
      isBlack: true,
      x: wIdx * WHITE_KEY_WIDTH - BLACK_KEY_WIDTH / 2,
      width: BLACK_KEY_WIDTH,
      height: BLACK_KEY_HEIGHT,
    });
  }

  const totalWidth = currentWhite * WHITE_KEY_WIDTH;
  return { keys, totalWidth };
}

/**
 * Build a lookup map: midiNote -> {x, width, isBlack}
 * @param {number} startMidi
 * @param {number} endMidi
 * @returns {Map<number, {x:number, width:number, isBlack:boolean}>}
 */
export function buildKeyMap(startMidi, endMidi) {
  const { keys } = buildKeyLayout(startMidi, endMidi);
  const map = new Map();
  keys.forEach((k) => map.set(k.midi, { x: k.x, width: k.width, isBlack: k.isBlack }));
  return map;
}
