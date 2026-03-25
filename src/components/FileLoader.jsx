import { useRef, useState, useCallback } from 'react';
import { parseMidiFile } from '../utils/midiParser';
import { parseMusicXmlFile } from '../utils/xmlParser';
import './FileLoader.css';

const ACCEPTED_TYPES = '.mid,.midi,.xml,.musicxml';

/**
 * FileLoader component.
 * Supports click-to-browse and drag & drop for .mid / .xml files.
 * Calls onSongLoaded(parsedSong) when parsing succeeds.
 *
 * @param {{ onSongLoaded: (song: import('../utils/midiParser').ParsedSong) => void }} props
 */
export function FileLoader({ onSongLoaded }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'loading'|'error'|'ok', text: string }

  const processFile = useCallback(async (file) => {
    const name = file.name.toLowerCase();
    setStatus({ type: 'loading', text: `Cargando ${file.name}…` });

    try {
      let song;
      if (name.endsWith('.mid') || name.endsWith('.midi')) {
        song = await parseMidiFile(file);
      } else if (name.endsWith('.xml') || name.endsWith('.musicxml')) {
        song = await parseMusicXmlFile(file);
      } else {
        setStatus({ type: 'error', text: 'Formato no soportado. Usa .mid o .xml' });
        return;
      }

      const noteCount = song.notes.length;
      const duration = song.duration.toFixed(1);
      setStatus({
        type: 'ok',
        text: `${file.name} — ${noteCount} notas · ${duration}s · ${song.bpm.toFixed(0)} BPM`,
      });
      onSongLoaded(song);
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', text: `Error: ${err.message}` });
    }
  }, [onSongLoaded]);

  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = ''; // allow re-selecting the same file
  }, [processFile]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragging(true);
  }, []);

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
        aria-label="Cargar archivo MIDI o MusicXML"
      >
        <span className="drop-icon">🎵</span>
        <span className="drop-text">
          Arrastra un archivo <strong>.mid</strong> o <strong>.xml</strong>
          <br />
          <small>o haz clic para explorar</small>
        </span>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES}
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
