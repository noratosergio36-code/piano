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
  // Composer Mode state
  recordedNotes: [],  // Array<{ midiNumber, noteName, startTime, duration }>
  isRecording: false,
  composerBpm: 120,
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
    // Composer Mode actions
    case 'START_RECORDING':   return { ...state, isRecording: true, recordedNotes: [] };
    case 'STOP_RECORDING':    return { ...state, isRecording: false };
    case 'ADD_RECORDED_NOTE': return { ...state, recordedNotes: [...state.recordedNotes, action.payload] };
    case 'CLEAR_RECORDING':   return { ...state, recordedNotes: [], isRecording: false };
    case 'SET_COMPOSER_BPM':  return { ...state, composerBpm: action.payload };
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
