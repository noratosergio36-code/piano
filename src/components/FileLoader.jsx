import { useRef, useState, useCallback } from 'react';
import { parseMidiFile } from '../utils/midiParser';
import { parseMusicXmlFile } from '../utils/xmlParser';
import { parseLyricsFile } from '../utils/lyricsFormat';
import { parseJsonSongFile, isJsonSong } from '../utils/jsonSongParser';
import './FileLoader.css';

const ACCEPTED_TYPES = '.mid,.midi,.xml,.musicxml,.json';

/**
 * FileLoader — supports click-to-browse and drag & drop.
 * Accepts a MIDI/XML/JSON song file and an optional lyrics JSON in a single drop.
 *
 * @param {{
 *   onSongLoaded:    (song: import('../utils/midiParser').ParsedSong) => void,
 *   onLyricsLoaded?: (file: import('../utils/lyricsFormat').LyricsFile) => void,
 *   onClear?:        () => void,
 * }} props
 */
export function FileLoader({ onSongLoaded, onLyricsLoaded, onClear }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus]   = useState(null); // { type: 'loading'|'error'|'ok', text: string }
  const [hasFiles, setHasFiles] = useState(false);

  /**
   * Process an array of files: each is handled by extension + content detection.
   * MIDI/XML → song, JSON song → song, JSON lyrics → lyrics.
   * @param {File[]} files
   */
  const processFiles = useCallback(async (files) => {
    const known = files.filter((f) =>
      /\.(mid|midi|xml|musicxml|json)$/i.test(f.name)
    );

    if (known.length === 0) {
      setStatus({ type: 'error', text: 'Formato no soportado. Usa .mid, .xml o .json' });
      return;
    }

    setStatus({ type: 'loading', text: 'Cargando…' });

    const parts = [];
    try {
      for (const file of known) {
        const name = file.name.toLowerCase();

        if (name.endsWith('.mid') || name.endsWith('.midi')) {
          const song = await parseMidiFile(file);
          onSongLoaded(song);
          parts.push(`${file.name} — ${song.notes.length} notas · ${song.bpm.toFixed(0)} BPM`);

        } else if (name.endsWith('.xml') || name.endsWith('.musicxml')) {
          const song = await parseMusicXmlFile(file);
          onSongLoaded(song);
          parts.push(`${file.name} — ${song.notes.length} notas`);

        } else if (name.endsWith('.json')) {
          // Detect: song JSON vs lyrics JSON by peeking at content
          const text = await file.text();
          let raw;
          try {
            raw = JSON.parse(text);
          } catch {
            throw new Error(`JSON inválido en: ${file.name}`);
          }

          if (isJsonSong(raw)) {
            const { parseJsonSong } = await import('../utils/jsonSongParser');
            const song = parseJsonSong(raw);
            onSongLoaded(song);
            parts.push(`${file.name} — ${song.notes.length} notas · ${song.bpm.toFixed(0)} BPM`);
          } else {
            const { parseLyricsJson } = await import('../utils/lyricsFormat');
            const lyricsFile = parseLyricsJson(raw);
            onLyricsLoaded?.(lyricsFile);
            parts.push(`${file.name} — ${lyricsFile.lyrics.length} línea${lyricsFile.lyrics.length !== 1 ? 's' : ''}`);
          }
        }
      }
      setStatus({ type: 'ok', text: parts.join('   ·   ') });
      setHasFiles(true);
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', text: `Error: ${err.message}` });
    }
  }, [onSongLoaded, onLyricsLoaded]);

  const handleFileChange = useCallback((e) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) processFiles(files);
    e.target.value = '';
  }, [processFiles]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) processFiles(files);
  }, [processFiles]);

  const handleDragOver  = useCallback((e) => { e.preventDefault(); setDragging(true); }, []);
  const handleDragLeave = useCallback(() => setDragging(false), []);

  const handleClear = useCallback(() => {
    setStatus(null);
    setHasFiles(false);
    onClear?.();
  }, [onClear]);

  return (
    <div className="file-loader">
      <div className="file-loader__row">
        <div
          className={`drop-zone ${dragging ? 'dragging' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
          aria-label="Cargar archivo MIDI, MusicXML o JSON de canción/letras"
        >
          <span className="drop-icon">🎵</span>
          <span className="drop-text">
            Arrastra <strong>.mid</strong> / <strong>.xml</strong> / <strong>.json</strong>
            <br />
            <small>o haz clic para explorar</small>
          </span>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            multiple
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </div>

        {hasFiles && (
          <button
            className="btn-clear"
            onClick={handleClear}
            title="Limpiar archivos cargados"
          >
            ✕
          </button>
        )}
      </div>

      {status && (
        <div className={`loader-status loader-status--${status.type}`}>
          {status.type === 'loading' && <span className="spinner" />}
          {status.text}
        </div>
      )}
    </div>
  );
}
