import { useCallback, useState, useMemo } from 'react';
import { AppProvider } from './context/AppContext';
import { PianoKeyboard } from './components/PianoKeyboard';
import { WaterfallCanvas } from './components/WaterfallCanvas';
import { FileLoader } from './components/FileLoader';
import { ModeSelector } from './components/ModeSelector';
import { LyricsPanel } from './components/LyricsPanel';
import { useMidi } from './hooks/useMidi';
import { usePlayback } from './hooks/usePlayback';
import { useAudioSynth } from './hooks/useAudioSynth';
import { useAppContext } from './context/AppContext';
import { buildKeyLayout } from './utils/keyLayout';
import './App.css';

const DEMO_NOTES = [
  { midi: 60, time: 1,   duration: 0.4, track: 0 },
  { midi: 62, time: 1.5, duration: 0.4, track: 0 },
  { midi: 64, time: 2,   duration: 0.4, track: 0 },
  { midi: 65, time: 2.5, duration: 0.4, track: 0 },
  { midi: 67, time: 3,   duration: 0.8, track: 0 },
  { midi: 67, time: 3,   duration: 0.4, track: 1 },
  { midi: 64, time: 4,   duration: 0.4, track: 0 },
  { midi: 65, time: 4.5, duration: 0.4, track: 0 },
  { midi: 64, time: 5,   duration: 0.8, track: 0 },
];

function PianoApp() {
  // MIDI physical keyboard notes
  const { activeNotes: midiNotes, isSupported, error: midiError } = useMidi();
  const { state, dispatch } = useAppContext();
  const { noteOn, noteOff } = useAudioSynth();

  // Mouse/touch clicked notes — tracked separately so Wait Mode can react to them
  const [mouseNotes, setMouseNotes] = useState(new Set());

  const handleNoteOn = useCallback((midi) => {
    noteOn(midi);
    setMouseNotes((prev) => { const s = new Set(prev); s.add(midi); return s; });
  }, [noteOn]);

  const handleNoteOff = useCallback((midi) => {
    noteOff(midi);
    setMouseNotes((prev) => { const s = new Set(prev); s.delete(midi); return s; });
  }, [noteOff]);

  // Combined active notes: MIDI + mouse — used everywhere (canvas highlight, wait mode, keyboard)
  const activeNotes = useMemo(() => {
    if (mouseNotes.size === 0) return midiNotes;
    const combined = new Set(midiNotes);
    mouseNotes.forEach((m) => combined.add(m));
    return combined;
  }, [midiNotes, mouseNotes]);

  const notes = state.loadedSong?.notes ?? DEMO_NOTES;

  // Keyboard pixel width — used to size the piano-stage so canvas and keyboard share the same width
  const keyboardWidth = useMemo(
    () => buildKeyLayout(state.keyRange.start, state.keyRange.end).totalWidth,
    [state.keyRange]
  );

  const handleTick = useCallback((t) => {
    dispatch({ type: 'SET_TIME', payload: t });
  }, [dispatch]);

  const {
    currentTime,
    isPlaying,
    isFrozen,
    expectedNotes,
    pressedExpected,
    play,
    pause,
    stop,
  } = usePlayback({
    notes,
    activeNotes,   // now includes both MIDI and mouse notes
    mode: state.mode,
    onTick: handleTick,
  });

  const handleSongLoaded = useCallback((song) => {
    dispatch({ type: 'LOAD_SONG', payload: song });
    stop();
  }, [dispatch, stop]);

  const handleLyricsLoaded = useCallback((lyrics) => {
    dispatch({ type: 'SET_LYRICS', payload: lyrics });
  }, [dispatch]);

  const handleModeChange = useCallback((mode) => {
    dispatch({ type: 'SET_MODE', payload: mode });
  }, [dispatch]);

  return (
    <div className="app-layout">
      <header className="app-header">
        <h1>Piano Maestro</h1>

        <FileLoader onSongLoaded={handleSongLoaded} />

        <div className="transport-controls">
          <button
            className="btn-transport"
            onClick={isPlaying ? pause : play}
            title={isPlaying ? 'Pausar' : 'Reproducir'}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button className="btn-transport" onClick={stop} title="Detener">⏹</button>
          <span className={`time-display ${isFrozen ? 'time-frozen' : ''}`}>
            {currentTime.toFixed(2)}s
          </span>
        </div>

        <ModeSelector mode={state.mode} onChange={handleModeChange} />

        <div className="notation-toggle">
          <button
            className={`btn-notation ${state.notation === 'american' ? 'active' : ''}`}
            onClick={() => dispatch({ type: 'SET_NOTATION', payload: 'american' })}
          >ABC</button>
          <button
            className={`btn-notation ${state.notation === 'solfeo' ? 'active' : ''}`}
            onClick={() => dispatch({ type: 'SET_NOTATION', payload: 'solfeo' })}
          >Do Re Mi</button>
        </div>

        {state.mode === 'follow' && (
          <LyricsPanel
            lyrics={state.lyrics}
            currentTime={currentTime}
            onLyricsLoaded={handleLyricsLoaded}
          />
        )}

        {state.loadedSong && (
          <div className="song-info">
            {state.loadedSong.tracks.length} pista{state.loadedSong.tracks.length !== 1 ? 's' : ''}
            {' · '}{state.loadedSong.bpm.toFixed(0)} BPM
            {' · '}{state.loadedSong.duration.toFixed(1)}s
          </div>
        )}

        {!isSupported && (
          <div className="midi-warning">Web MIDI no soportado. Usa Chrome/Edge.</div>
        )}
        {midiError && <div className="midi-error">{midiError}</div>}
      </header>

      <main className="app-main">
        {/*
          piano-stage is exactly keyboardWidth px wide, centered with margin:auto.
          The canvas fills this div — so note blocks and piano keys share
          the same coordinate space with no offset needed.
        */}
        <div className="piano-stage" style={{ width: keyboardWidth }}>
          <WaterfallCanvas
            notes={notes}
            currentTime={currentTime}
            activeNotes={activeNotes}
            expectedNotes={expectedNotes}
            pressedExpected={pressedExpected}
            isFrozen={isFrozen}
            range={state.keyRange}
            lyrics={state.lyrics}
          />
        </div>
      </main>

      <footer className="app-footer">
        <PianoKeyboard
          activeNotes={activeNotes}
          range={state.keyRange}
          notation={state.notation}
          onNoteOn={handleNoteOn}
          onNoteOff={handleNoteOff}
        />
      </footer>
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <PianoApp />
    </AppProvider>
  );
}

export default App;
