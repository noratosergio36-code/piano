import { createContext, useContext, useReducer } from 'react';
import { PIANO_CONFIG } from '../constants/piano';

const initialState = {
  mode: 'freeplay', // 'freeplay' | 'wait' | 'follow' | 'composer'
  notation: 'american', // 'american' | 'solfeo'
  keyRange: PIANO_CONFIG.defaultRange,
  loadedSong: null, // parsed MIDI/XML data
  isPlaying: false,
  currentTime: 0,
  lyrics: [], // legacy flat format — kept for internal compat
  currentLyrics: null, // LyricsFile v2: { songId?, title?, lyrics: LyricLine[] }
  // Wait Mode state — mirrored from usePlayback for global visibility
  isFrozen: false,
  expectedNotes: [],  // midi numbers the player must press to unfreeze
  toleranceMs: 80,    // configurable hit window (ms); smaller = stricter timing
  // Composer Mode state
  recordedNotes: [],  // Array<{ midiNumber, noteName, startTime, duration }>
  isRecording: false,
  composerBpm: 120,
  // Hand practice
  practicingHands: ['left', 'right'], // which hands the player must press
  // Playback speed
  playbackRate: 1.0,
  // Instrument
  currentInstrument: 'piano',
  // A/B loop
  loopStart: 0,    // seconds — Point A
  loopEnd: null,   // seconds — Point B (null = song end)
  isLooping: false,
  // Scoring
  score: 0,
  combo: 0,
  activePopups: [], // [{ id, text, popupType, x }]
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_MODE': return { ...state, mode: action.payload };
    case 'SET_NOTATION': return { ...state, notation: action.payload };
    case 'SET_KEY_RANGE': return { ...state, keyRange: action.payload };
    case 'LOAD_SONG': return { ...state, loadedSong: action.payload };
    case 'SET_PLAYING': return { ...state, isPlaying: action.payload };
    case 'SET_TIME': return { ...state, currentTime: action.payload };
    case 'SET_LYRICS':  return { ...state, lyrics: action.payload };
    case 'LOAD_LYRICS': return { ...state, currentLyrics: action.payload };
    case 'CLEAR_LYRICS': return { ...state, currentLyrics: null };
    // Wait Mode actions
    case 'FREEZE_TIME':        return { ...state, isFrozen: true };
    case 'UNFREEZE_TIME':      return { ...state, isFrozen: false };
    case 'SET_EXPECTED_NOTES': return { ...state, expectedNotes: action.payload };
    case 'SET_TOLERANCE':      return { ...state, toleranceMs: action.payload };
    // Composer Mode actions
    case 'START_RECORDING':   return { ...state, isRecording: true, recordedNotes: [] };
    case 'STOP_RECORDING':    return { ...state, isRecording: false };
    case 'ADD_RECORDED_NOTE': return { ...state, recordedNotes: [...state.recordedNotes, action.payload] };
    case 'CLEAR_RECORDING':   return { ...state, recordedNotes: [], isRecording: false };
    case 'SET_COMPOSER_BPM':      return { ...state, composerBpm: action.payload };
    case 'SET_PRACTICING_HANDS':  return { ...state, practicingHands: action.payload };
    case 'SET_PLAYBACK_RATE':    return { ...state, playbackRate: action.payload };
    case 'SET_INSTRUMENT':       return { ...state, currentInstrument: action.payload };
    // A/B loop
    case 'SET_LOOP_START':  return { ...state, loopStart: Math.max(0, action.payload) };
    case 'SET_LOOP_END':    return { ...state, loopEnd: action.payload };
    case 'TOGGLE_LOOPING':  return { ...state, isLooping: !state.isLooping };
    // Scoring
    case 'ADD_SCORE':      return { ...state, score: Math.max(0, state.score + action.payload) };
    case 'INCREMENT_COMBO':return { ...state, combo: state.combo + 1 };
    case 'RESET_COMBO':    return { ...state, combo: 0 };
    case 'ADD_POPUP':      return { ...state, activePopups: [...state.activePopups, action.payload] };
    case 'REMOVE_POPUP':   return { ...state, activePopups: state.activePopups.filter((p) => p.id !== action.payload) };
    case 'RESET_SCORE':    return { ...state, score: 0, combo: 0, activePopups: [] };
    default: return state;
  }
}

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}
