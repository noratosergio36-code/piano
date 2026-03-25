import { createContext, useContext, useReducer } from 'react';
import { PIANO_CONFIG } from '../constants/piano';

const initialState = {
  mode: 'freeplay', // 'freeplay' | 'wait' | 'follow'
  notation: 'american', // 'american' | 'solfeo'
  keyRange: PIANO_CONFIG.defaultRange,
  loadedSong: null, // parsed MIDI/XML data
  isPlaying: false,
  currentTime: 0,
  lyrics: [], // [{ time, text }]
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_MODE': return { ...state, mode: action.payload };
    case 'SET_NOTATION': return { ...state, notation: action.payload };
    case 'SET_KEY_RANGE': return { ...state, keyRange: action.payload };
    case 'LOAD_SONG': return { ...state, loadedSong: action.payload };
    case 'SET_PLAYING': return { ...state, isPlaying: action.payload };
    case 'SET_TIME': return { ...state, currentTime: action.payload };
    case 'SET_LYRICS': return { ...state, lyrics: action.payload };
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
