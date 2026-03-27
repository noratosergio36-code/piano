/**
 * Lyrics format v2 for Piano Maestro — syllable-level karaoke.
 *
 * JSON shape (v2):
 * {
 *   "songId":  "optional-id",
 *   "title":   "Song Title",
 *   "lyrics": [
 *     {
 *       "lineId":    "line-1",
 *       "startTime": 1.0,
 *       "endTime":   4.0,
 *       "syllables": [
 *         { "text": "Hel-", "time": 1.0, "duration": 0.3 },
 *         { "text": "lo ",  "time": 1.3, "duration": 0.4 },
 *         { "text": "World","time": 2.0, "duration": 0.6 }
 *       ]
 *     }
 *   ]
 * }
 *
 * Legacy format (v1) — also accepted and auto-converted:
 * { "title": "...", "lyrics": [{ "time": 0.5, "text": "syllable" }] }
 */

// ── Type definitions ────────────────────────────────────────────────────────

/**
 * @typedef {{ text: string, time: number, duration: number }} Syllable
 * @typedef {{ lineId?: string, startTime: number, endTime: number, syllables: Syllable[] }} LyricLine
 * @typedef {{ songId?: string, title?: string, lyrics: LyricLine[] }} LyricsFile
 */

// ── Format detection & conversion ────────────────────────────────────────────

/**
 * Returns true if the raw object looks like the legacy flat format.
 * @param {unknown} raw
 * @returns {boolean}
 */
function isLegacyFormat(raw) {
  return (
    Array.isArray(raw?.lyrics) &&
    raw.lyrics.length > 0 &&
    typeof raw.lyrics[0].text === 'string' &&
    !Array.isArray(raw.lyrics[0].syllables)
  );
}

/**
 * Converts the legacy flat format `[{ time, text }]` into a LyricsFile v2.
 * Each flat entry becomes a single-syllable line; `endTime` is the next
 * entry's `startTime` (or +2 s for the last entry).
 *
 * @param {{ title?: string, lyrics: Array<{time:number, text:string}> }} raw
 * @returns {LyricsFile}
 */
function convertLegacy(raw) {
  const flat = [...raw.lyrics].sort((a, b) => a.time - b.time);
  const lines = flat.map((entry, i) => {
    const next = flat[i + 1];
    const dur = next ? next.time - entry.time : 2.0;
    return {
      lineId: `line-${i}`,
      startTime: entry.time,
      endTime: next ? next.time : entry.time + dur,
      syllables: [{ text: entry.text, time: entry.time, duration: dur }],
    };
  });
  return { title: raw.title, lyrics: lines };
}

// ── Validation ───────────────────────────────────────────────────────────────

/**
 * Validates a v2 LyricsFile shape; throws a descriptive Error on failure.
 * @param {unknown} raw
 * @returns {LyricsFile}
 */
function validateV2(raw) {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Lyrics JSON must be an object.');
  }
  if (!Array.isArray(raw.lyrics)) {
    throw new Error('"lyrics" debe ser un array.');
  }

  const lines = raw.lyrics.map((line, li) => {
    if (typeof line.startTime !== 'number') {
      throw new Error(`Línea ${li}: "startTime" debe ser número.`);
    }
    if (typeof line.endTime !== 'number') {
      throw new Error(`Línea ${li}: "endTime" debe ser número.`);
    }
    if (!Array.isArray(line.syllables) || line.syllables.length === 0) {
      throw new Error(`Línea ${li}: "syllables" debe ser un array no vacío.`);
    }

    const syllables = line.syllables.map((syl, si) => {
      if (typeof syl.text !== 'string') {
        throw new Error(`Línea ${li}, sílaba ${si}: "text" debe ser string.`);
      }
      if (typeof syl.time !== 'number') {
        throw new Error(`Línea ${li}, sílaba ${si}: "time" debe ser número.`);
      }
      if (typeof syl.duration !== 'number') {
        throw new Error(`Línea ${li}, sílaba ${si}: "duration" debe ser número.`);
      }
      return { text: syl.text, time: syl.time, duration: syl.duration };
    });

    return {
      lineId:    line.lineId ?? `line-${li}`,
      startTime: line.startTime,
      endTime:   line.endTime,
      syllables,
    };
  });

  // Sort lines by startTime
  lines.sort((a, b) => a.startTime - b.startTime);

  return { songId: raw.songId, title: raw.title, lyrics: lines };
}

// ── Public parse API ─────────────────────────────────────────────────────────

/**
 * Parse and validate a raw JSON object into a normalized LyricsFile v2.
 * Accepts both v2 format and legacy flat format (auto-converts).
 *
 * @param {unknown} raw
 * @returns {LyricsFile}
 */
export function parseLyricsJson(raw) {
  if (isLegacyFormat(raw)) {
    return convertLegacy(raw);
  }
  return validateV2(raw);
}

/**
 * Load and parse a lyrics JSON File object from <input type="file">.
 * @param {File} file
 * @returns {Promise<LyricsFile>}
 */
export async function parseLyricsFile(file) {
  const text = await file.text();
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error(`JSON inválido en: ${file.name}`);
  }
  return parseLyricsJson(raw);
}

// ── Karaoke runtime helpers ──────────────────────────────────────────────────

/**
 * Returns the LyricLine that contains `currentTime`
 * (i.e. `startTime ≤ t < endTime`), or null if none.
 *
 * Lines must be sorted ascending by startTime.
 *
 * @param {LyricLine[]} lines
 * @param {number} currentTime
 * @returns {LyricLine | null}
 */
export function getActiveLine(lines, currentTime) {
  for (const line of lines) {
    if (line.startTime > currentTime) break; // lines are sorted, no need to look further
    if (currentTime < line.endTime) return line;
  }
  return null;
}

/**
 * Returns the first LyricLine whose startTime is strictly after `currentTime`.
 *
 * @param {LyricLine[]} lines
 * @param {number} currentTime
 * @returns {LyricLine | null}
 */
export function getNextLine(lines, currentTime) {
  for (const line of lines) {
    if (line.startTime > currentTime) return line;
  }
  return null;
}

/**
 * Within a line, returns the last Syllable whose `time ≤ currentTime`.
 * Returns null before the first syllable starts.
 *
 * @param {Syllable[]} syllables  - already sorted ascending by time
 * @param {number} currentTime
 * @returns {Syllable | null}
 */
export function getActiveSyllable(syllables, currentTime) {
  let active = null;
  for (const syl of syllables) {
    if (syl.time <= currentTime) active = syl;
    else break;
  }
  return active;
}

// ── Legacy helper (used only internally / for backward compat) ───────────────

/**
 * @deprecated Use getActiveLine + getActiveSyllable instead.
 * Returns the last flat entry whose time ≤ currentTime.
 * @param {Array<{time:number, text:string}>} lyrics
 * @param {number} currentTime
 * @returns {{ time:number, text:string } | null}
 */
export function getActiveLyric(lyrics, currentTime) {
  let active = null;
  for (const entry of lyrics) {
    if (entry.time <= currentTime) active = entry;
    else break;
  }
  return active;
}

// ── Example template ─────────────────────────────────────────────────────────

/**
 * Returns a formatted JSON string showing the v2 lyrics format.
 * Useful as a download template for users.
 * @returns {string}
 */
export function buildExampleLyrics() {
  /** @type {LyricsFile} */
  const example = {
    title: 'Mi Canción (ejemplo)',
    lyrics: [
      {
        lineId: 'line-1',
        startTime: 0.5,
        endTime: 3.2,
        syllables: [
          { text: 'Do ',  time: 0.5, duration: 0.45 },
          { text: 'Re ',  time: 1.0, duration: 0.45 },
          { text: 'Mi ',  time: 1.5, duration: 0.45 },
          { text: 'Fa ',  time: 2.0, duration: 0.45 },
          { text: 'Sol',  time: 2.5, duration: 0.45 },
        ],
      },
      {
        lineId: 'line-2',
        startTime: 3.5,
        endTime: 6.5,
        syllables: [
          { text: 'La ',  time: 3.5, duration: 0.45 },
          { text: 'Si ',  time: 4.0, duration: 0.45 },
          { text: 'Do ',  time: 4.5, duration: 0.8  },
        ],
      },
    ],
  };
  return JSON.stringify(example, null, 2);
}
