import { useRef, useState, useCallback } from 'react';
import { parseLyricsFile, buildExampleLyrics, getActiveLyric } from '../utils/lyricsFormat';
import './LyricsPanel.css';

/**
 * LyricsPanel — displays the current lyric and lets the user:
 *  1. Import a lyrics JSON file
 *  2. Edit lyrics inline (simple textarea → JSON)
 *  3. Download an example template
 *
 * @param {{
 *   lyrics: Array<{time:number, text:string}>,
 *   currentTime: number,
 *   onLyricsLoaded: (lyrics: Array<{time:number, text:string}>) => void,
 * }} props
 */
export function LyricsPanel({ lyrics = [], currentTime = 0, onLyricsLoaded }) {
  const fileInputRef = useRef(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorText, setEditorText] = useState('');
  const [editorError, setEditorError] = useState(null);
  const [importStatus, setImportStatus] = useState(null);

  const activeLyric = getActiveLyric(lyrics, currentTime);

  // ── File import ─────────────────────────────────────────────────────────
  const handleFileChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const parsed = await parseLyricsFile(file);
      onLyricsLoaded(parsed.lyrics);
      setImportStatus({ type: 'ok', text: `${parsed.lyrics.length} entradas cargadas` });
    } catch (err) {
      setImportStatus({ type: 'error', text: err.message });
    }
  }, [onLyricsLoaded]);

  // ── Inline editor ────────────────────────────────────────────────────────
  const openEditor = useCallback(() => {
    const current = lyrics.length > 0
      ? JSON.stringify({ lyrics }, null, 2)
      : buildExampleLyrics();
    setEditorText(current);
    setEditorError(null);
    setEditorOpen(true);
  }, [lyrics]);

  const applyEditor = useCallback(() => {
    try {
      const raw = JSON.parse(editorText);
      const arr = Array.isArray(raw) ? raw : raw.lyrics;
      if (!Array.isArray(arr)) throw new Error('"lyrics" debe ser un array.');
      arr.forEach((e, i) => {
        if (typeof e.time !== 'number') throw new Error(`Entrada ${i}: "time" debe ser número.`);
        if (typeof e.text !== 'string') throw new Error(`Entrada ${i}: "text" debe ser string.`);
      });
      const sorted = [...arr].sort((a, b) => a.time - b.time);
      onLyricsLoaded(sorted);
      setEditorOpen(false);
      setImportStatus({ type: 'ok', text: `${sorted.length} entradas guardadas` });
    } catch (err) {
      setEditorError(err.message);
    }
  }, [editorText, onLyricsLoaded]);

  const downloadTemplate = useCallback(() => {
    const blob = new Blob([buildExampleLyrics()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lyrics-template.json';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <div className="lyrics-panel">
      {/* Active lyric display */}
      <div className="lyrics-display" aria-live="polite">
        {activeLyric
          ? <span className="lyrics-text">{activeLyric.text}</span>
          : <span className="lyrics-empty">{lyrics.length > 0 ? '…' : 'Sin letra'}</span>
        }
      </div>

      {/* Controls */}
      <div className="lyrics-controls">
        <button className="btn-lyrics" onClick={() => fileInputRef.current?.click()} title="Importar JSON de letras">
          ↑ Importar
        </button>
        <button className="btn-lyrics" onClick={openEditor} title="Editar letras en línea">
          ✎ Editar
        </button>
        <button className="btn-lyrics" onClick={downloadTemplate} title="Descargar plantilla">
          ↓ Plantilla
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      </div>

      {importStatus && (
        <div className={`lyrics-status lyrics-status--${importStatus.type}`}>
          {importStatus.text}
        </div>
      )}

      {/* Inline JSON editor modal */}
      {editorOpen && (
        <div className="lyrics-editor-overlay" onClick={(e) => e.target === e.currentTarget && setEditorOpen(false)}>
          <div className="lyrics-editor-modal">
            <div className="editor-header">
              <span>Editor de letras (JSON)</span>
              <button className="btn-close" onClick={() => setEditorOpen(false)}>✕</button>
            </div>
            <p className="editor-hint">
              Array de <code>{`{ "time": segundos, "text": "sílaba" }`}</code>
            </p>
            <textarea
              className="editor-textarea"
              value={editorText}
              onChange={(e) => setEditorText(e.target.value)}
              spellCheck={false}
            />
            {editorError && <div className="editor-error">{editorError}</div>}
            <div className="editor-actions">
              <button className="btn-apply" onClick={applyEditor}>Aplicar</button>
              <button className="btn-cancel" onClick={() => setEditorOpen(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
