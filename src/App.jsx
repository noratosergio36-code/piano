import { useCallback, useState, useMemo } from 'react';
import { AppProvider } from './context/AppContext';
import { PianoKeyboard } from './components/PianoKeyboard';
import { WaterfallCanvas } from './components/WaterfallCanvas';
import { FileLoader } from './components/FileLoader';
import { ModeSelector } from './components/ModeSelector';
import { LyricsPanel } from './components/LyricsPanel';
import { ComposerControls } from './components/ComposerControls';
import { SheetMusicView } from './components/SheetMusicView';
import { HandSelector } from './components/HandSelector';
import { SpeedControl } from './components/SpeedControl';
import { ScoreOverlay } from './components/ScoreOverlay';
import { ScoreBoard } from './components/ScoreBoard';
import { InstrumentSelector } from './components/InstrumentSelector';
import { useScoring } from './hooks/useScoring';
import { useSFX } from './hooks/useSFX';
import { useMidi } from './hooks/useMidi';
import { useMidiRecorder } from './hooks/useMidiRecorder';
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
  const { activeNotes: midiNotes, midiAccess, isSupported, error: midiError } = useMidi();
  const { state, dispatch } = useAppContext();
  const { noteOn, noteOff } = useAudioSynth(state.currentInstrument);
  const autoNoteOn  = noteOn;
  const autoNoteOff = noteOff;
  const { playSuccess, playComboBonus, playError } = useSFX();

  // ── Composer Mode: recorder ────────────────────────────────────────────────
  const handleNoteRecorded = useCallback((note) => {
    dispatch({ type: 'ADD_RECORDED_NOTE', payload: note });
  }, [dispatch]);

  const { noteOn: recorderNoteOn, noteOff: recorderNoteOff } = useMidiRecorder({
    midiAccess,
    isRecording: state.isRecording,
    onNoteRecorded: handleNoteRecorded,
  });

  // Mouse/touch clicked notes — tracked separately so Wait Mode can react to them
  const [mouseNotes, setMouseNotes] = useState(new Set());

  const handleNoteOn = useCallback((midi) => {
    noteOn(midi);
    recorderNoteOn(midi); // no-op when not recording
    setMouseNotes((prev) => { const s = new Set(prev); s.add(midi); return s; });
  }, [noteOn, recorderNoteOn]);

  const handleNoteOff = useCallback((midi) => {
    noteOff(midi);
    recorderNoteOff(midi); // no-op when not recording
    setMouseNotes((prev) => { const s = new Set(prev); s.delete(midi); return s; });
  }, [noteOff, recorderNoteOff]);

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
    toleranceSec: state.toleranceMs / 1000,  // configurable hit window
    dispatch,                                 // sync freeze state to AppContext
    practicingHands: state.practicingHands,
    onAutoNoteOn:  autoNoteOn,
    onAutoNoteOff: autoNoteOff,
    playbackRate: state.playbackRate,
  });

  useScoring({
    notes,
    activeNotes,
    currentTime,
    mode: state.mode,
    toleranceSec: state.toleranceMs / 1000,
    isFrozen,
    expectedNotes,
    practicingHands: state.practicingHands,
    keyRange: state.keyRange,
    dispatch,
    isPlaying,
    onSuccess:    playSuccess,
    onError:      playError,
    onComboBonus: playComboBonus,
  });

  const handleSongLoaded = useCallback((song) => {
    dispatch({ type: 'LOAD_SONG', payload: song });
    dispatch({ type: 'RESET_SCORE' });
    stop();
  }, [dispatch, stop]);

  const handleClear = useCallback(() => {
    stop();
    dispatch({ type: 'LOAD_SONG', payload: null });
    dispatch({ type: 'CLEAR_LYRICS' });
    dispatch({ type: 'RESET_SCORE' });
  }, [dispatch, stop]);

  const handleLyricsLoaded = useCallback((lyricsFile) => {
    dispatch({ type: 'LOAD_LYRICS', payload: lyricsFile });
  }, [dispatch]);

  const handleModeChange = useCallback((mode) => {
    dispatch({ type: 'SET_MODE', payload: mode });
    // Stop game loop when entering composer; stop recording when leaving it
    if (mode === 'composer') {
      stop();
    } else if (state.isRecording) {
      dispatch({ type: 'STOP_RECORDING' });
    }
  }, [dispatch, stop, state.isRecording]);

  const isComposer = state.mode === 'composer';

  return (
    <div className="app-layout">
      <header className="app-header">
        <h1>Piano Maestro</h1>

        {/* Playback tools — hidden in Composer Mode */}
        {!isComposer && (
          <FileLoader
            onSongLoaded={handleSongLoaded}
            onLyricsLoaded={handleLyricsLoaded}
            onClear={handleClear}
          />
        )}

        {!isComposer && (
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
        )}

        {/* Tolerance control — only relevant in Wait Mode */}
        {state.mode === 'wait' && (
          <label className="tolerance-label" title="Ventana de tolerancia para presionar la nota (ms)">
            <span>Tolerancia</span>
            <input
              type="range"
              className="tolerance-slider"
              min={30}
              max={300}
              step={10}
              value={state.toleranceMs}
              onChange={(e) =>
                dispatch({ type: 'SET_TOLERANCE', payload: Number(e.target.value) })
              }
            />
            <span className="tolerance-value">{state.toleranceMs}ms</span>
          </label>
        )}

        {/* Composer Mode controls */}
        {isComposer && <ComposerControls />}

        {/* Hand selector — hidden in Composer Mode */}
        {!isComposer && <HandSelector />}

        {/* Playback speed — hidden in Composer Mode */}
        {!isComposer && <SpeedControl />}

        {/* Instrument selector */}
        {!isComposer && <InstrumentSelector />}

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

        {!isComposer && state.loadedSong && (
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
        {isComposer ? (
          /* ── Composer Mode: Grand Staff sheet music view ─────────────────── */
          <SheetMusicView />
        ) : (
          /* ── Playback Modes: Waterfall canvas ────────────────────────────── */
          <div className="piano-stage" style={{ width: keyboardWidth }}>
            <WaterfallCanvas
              notes={notes}
              currentTime={currentTime}
              activeNotes={activeNotes}
              expectedNotes={expectedNotes}
              pressedExpected={pressedExpected}
              isFrozen={isFrozen}
              range={state.keyRange}
              practicingHands={state.practicingHands}
            />
            {/* Score popups + board — visible in Follow and Wait modes */}
            {(state.mode === 'follow' || state.mode === 'wait') && (
              <>
                <ScoreOverlay />
                <ScoreBoard />
              </>
            )}
            {/* Karaoke overlay — visible in Follow and Wait modes when lyrics are loaded */}
            {(state.mode === 'follow' || state.mode === 'wait') && (
              <LyricsPanel />
            )}
          </div>
        )}
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
