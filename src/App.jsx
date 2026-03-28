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
import { InstrumentSelector } from './components/InstrumentSelector';
import { SectionLoopControl } from './components/SectionLoopControl';
import { useMidi } from './hooks/useMidi';
import { useMidiRecorder } from './hooks/useMidiRecorder';
import { usePlayback } from './hooks/usePlayback';
import { useAudioSynth } from './hooks/useAudioSynth';
import { useScoring } from './hooks/useScoring';
import { useSFX } from './hooks/useSFX';
import { useAppContext } from './context/AppContext';
import { buildKeyLayout } from './utils/keyLayout';
import './App.css';

const DEMO_NOTES = [
  { midi: 60, time: 1,   duration: 0.4, track: 0, hand: 'right' },
  { midi: 62, time: 1.5, duration: 0.4, track: 0, hand: 'right' },
  { midi: 64, time: 2,   duration: 0.4, track: 0, hand: 'right' },
  { midi: 65, time: 2.5, duration: 0.4, track: 0, hand: 'right' },
  { midi: 67, time: 3,   duration: 0.8, track: 0, hand: 'right' },
  { midi: 64, time: 4,   duration: 0.4, track: 0, hand: 'right' },
  { midi: 65, time: 4.5, duration: 0.4, track: 0, hand: 'right' },
  { midi: 64, time: 5,   duration: 0.8, track: 0, hand: 'right' },
];

function PianoApp() {
  const { activeNotes: midiNotes, midiAccess, isSupported, error: midiError } = useMidi();
  const { state, dispatch } = useAppContext();
  const { noteOn, noteOff } = useAudioSynth(state.currentInstrument);
  const autoNoteOn  = noteOn;
  const autoNoteOff = noteOff;
  const { playSuccess, playComboBonus, playError } = useSFX();

  const [settingsOpen, setSettingsOpen] = useState(false);

  // ── Composer Mode recorder ─────────────────────────────────────────────────
  const handleNoteRecorded = useCallback((note) => {
    dispatch({ type: 'ADD_RECORDED_NOTE', payload: note });
  }, [dispatch]);

  const { noteOn: recorderNoteOn, noteOff: recorderNoteOff } = useMidiRecorder({
    midiAccess,
    isRecording: state.isRecording,
    onNoteRecorded: handleNoteRecorded,
  });

  const [mouseNotes, setMouseNotes] = useState(new Set());

  const handleNoteOn = useCallback((midi) => {
    noteOn(midi);
    recorderNoteOn(midi);
    setMouseNotes((prev) => { const s = new Set(prev); s.add(midi); return s; });
  }, [noteOn, recorderNoteOn]);

  const handleNoteOff = useCallback((midi) => {
    noteOff(midi);
    recorderNoteOff(midi);
    setMouseNotes((prev) => { const s = new Set(prev); s.delete(midi); return s; });
  }, [noteOff, recorderNoteOff]);

  const activeNotes = useMemo(() => {
    if (mouseNotes.size === 0) return midiNotes;
    const combined = new Set(midiNotes);
    mouseNotes.forEach((m) => combined.add(m));
    return combined;
  }, [midiNotes, mouseNotes]);

  const notes = state.loadedSong?.notes ?? DEMO_NOTES;

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
    activeNotes,
    mode: state.mode,
    onTick: handleTick,
    toleranceSec: state.toleranceMs / 1000,
    dispatch,
    practicingHands: state.practicingHands,
    onAutoNoteOn:  autoNoteOn,
    onAutoNoteOff: autoNoteOff,
    playbackRate: state.playbackRate,
    loopStart: state.loopStart,
    loopEnd:   state.loopEnd,
    isLooping: state.isLooping,
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
    if (mode === 'composer') {
      stop();
    } else if (state.isRecording) {
      dispatch({ type: 'STOP_RECORDING' });
    }
  }, [dispatch, stop, state.isRecording]);

  const isComposer   = state.mode === 'composer';
  const isScoredMode = state.mode === 'follow' || state.mode === 'wait';

  return (
    <div className="app-layout">

      {/* ── Floating control bar ──────────────────────────────────────────── */}
      <header className="control-bar">

        {/* LEFT: logo + transport */}
        <div className="cb-left">
          <span className="cb-logo">🎹 Piano Maestro</span>

          {isComposer ? (
            <ComposerControls />
          ) : (
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
        </div>

        {/* CENTER: speed + mode */}
        <div className="cb-center">
          {!isComposer && <SpeedControl />}
          <ModeSelector mode={state.mode} onChange={handleModeChange} />
        </div>

        {/* RIGHT: score + settings */}
        <div className="cb-right">
          {isScoredMode && (state.score > 0 || state.combo > 0) && (
            <div className="cb-score">
              <span className="cb-score__pts">{state.score.toLocaleString()}</span>
              {state.combo > 0 && (
                <span className={`cb-score__combo ${state.combo > 5 ? 'hot' : ''}`}>
                  ×{state.combo}
                </span>
              )}
            </div>
          )}

          <button
            className={`btn-settings ${settingsOpen ? 'active' : ''}`}
            onClick={() => setSettingsOpen((o) => !o)}
            title="Ajustes"
          >
            ⚙️
          </button>
        </div>

        {/* Settings dropdown */}
        {settingsOpen && (
          <>
            <div className="settings-backdrop" onClick={() => setSettingsOpen(false)} />
            <div className="settings-panel">

              {/* File loader */}
              {!isComposer && (
                <FileLoader
                  onSongLoaded={handleSongLoaded}
                  onLyricsLoaded={handleLyricsLoaded}
                  onClear={handleClear}
                />
              )}

              {/* Instrument + hands */}
              {!isComposer && (
                <div className="settings-row">
                  <InstrumentSelector />
                  <HandSelector />
                </div>
              )}

              {/* Notation + tolerance */}
              <div className="settings-row">
                <div className="notation-toggle">
                  <span className="settings-label">Notación</span>
                  <button
                    className={`btn-notation ${state.notation === 'american' ? 'active' : ''}`}
                    onClick={() => dispatch({ type: 'SET_NOTATION', payload: 'american' })}
                  >ABC</button>
                  <button
                    className={`btn-notation ${state.notation === 'solfeo' ? 'active' : ''}`}
                    onClick={() => dispatch({ type: 'SET_NOTATION', payload: 'solfeo' })}
                  >Do Re Mi</button>
                </div>

                {state.mode === 'wait' && (
                  <label className="tolerance-label" title="Ventana de tolerancia (ms)">
                    <span>Tolerancia</span>
                    <input
                      type="range"
                      className="tolerance-slider"
                      min={30} max={300} step={10}
                      value={state.toleranceMs}
                      onChange={(e) =>
                        dispatch({ type: 'SET_TOLERANCE', payload: Number(e.target.value) })
                      }
                    />
                    <span className="tolerance-value">{state.toleranceMs}ms</span>
                  </label>
                )}
              </div>

              {/* A/B loop — only when a song is loaded */}
              {!isComposer && state.loadedSong && (
                <>
                  <div className="settings-divider" />
                  <SectionLoopControl />
                </>
              )}

              {/* Song info + warnings */}
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
            </div>
          </>
        )}
      </header>

      {/* ── Main: canvas fills full height (bar is overlay) ──────────────── */}
      <main className="app-main">
        {isComposer ? (
          <SheetMusicView />
        ) : (
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
              loopStart={state.loopStart}
              loopEnd={state.loopEnd}
              isLooping={state.isLooping}
            />
            {/* Score popups + karaoke */}
            {isScoredMode && <ScoreOverlay />}
            {isScoredMode && <LyricsPanel />}
          </div>
        )}
      </main>

      {/* ── Piano keyboard ───────────────────────────────────────────────── */}
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
