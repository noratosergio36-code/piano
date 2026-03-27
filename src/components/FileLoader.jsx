import { useRef, useState, useCallback } from 'react';
import { parseMidiFile } from '../utils/midiParser';
import { parseMusicXmlFile } from '../utils/xmlParser';
import { parseLyricsFile } from '../utils/lyricsFormat';
import './FileLoader.css';

const ACCEPTED_TYPES = '.mid,.midi,.xml,.musicxml,.json';

/**
 * FileLoader — supports click-to-browse and drag & drop.
 * Accepts a MIDI/XML song file and an optional lyrics JSON in a single drop.
 *
 * @param {{
 *   onSongLoaded:   (song: import('../utils/midiParser').ParsedSong) => void,
 *   onLyricsLoaded?: (file: import('../utils/lyricsFormat').LyricsFile) => void,
 * }} props
 */
export function FileLoader({ onSongLoaded, onLyricsLoaded }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus]   = useState(null); // { type: 'loading'|'error'|'ok', text: string }

  /**
   * Process an array of files: each is handled by extension.
   * MIDI/XML → song, JSON → lyrics.
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
          const lyricsFile = await parseLyricsFile(file);
          onLyricsLoaded?.(lyricsFile);
          parts.push(`${file.name} — ${lyricsFile.lyrics.length} línea${lyricsFile.lyrics.length !== 1 ? 's' : ''}`);
        }
      }
      setStatus({ type: 'ok', text: parts.join('   ·   ') });
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', text: `Error: ${err.message}` });
    }
  }, [onSongLoaded, onLyricsLoaded]);

  const handleFileChange = useCallback((e) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) processFiles(files);
    e.target.value = ''; // allow re-selecting the same file(s)
  }, [processFiles]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) processFiles(files);
  }, [processFiles]);

  const handleDragOver  = useCallback((e) => { e.preventDefault(); setDragging(true); }, []);
  const handleDragLeave = useCallback(() => setDragging(false), []);

  return (
    <div className="file-loader">
      <div
        className={`drop-zone ${dragging ? 'dragging' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        aria-label="Cargar archivo MIDI, MusicXML o JSON de letras"
      >
        <span className="drop-icon">🎵</span>
        <span className="drop-text">
          Arrastra <strong>.mid</strong> / <strong>.xml</strong>
          {' '}+ <strong>.json</strong> letras
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

      {status && (
        <div className={`loader-status loader-status--${status.type}`}>
          {status.type === 'loading' && <span className="spinner" />}
          {status.text}
        </div>
      )}
    </div>
  );
}
