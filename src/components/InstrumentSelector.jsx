import { useAppContext } from '../context/AppContext';
import './InstrumentSelector.css';

const INSTRUMENTS = [
  { id: 'piano',    label: 'Piano',   icon: '🎹' },
  { id: 'organ',    label: 'Órgano',  icon: '🎸' },
  { id: 'chiptune', label: '8-bit',   icon: '👾' },
  { id: 'marimba',  label: 'Marimba', icon: '🥁' },
];

/**
 * Dropdown selector for the main synthesizer instrument.
 * Dispatches SET_INSTRUMENT to AppContext.
 */
export function InstrumentSelector() {
  const { state, dispatch } = useAppContext();
  const { currentInstrument } = state;

  return (
    <div className="instrument-selector">
      <span className="instrument-selector__label">Instrumento</span>
      <select
        className="instrument-select"
        value={currentInstrument}
        onChange={(e) => dispatch({ type: 'SET_INSTRUMENT', payload: e.target.value })}
        title="Cambiar instrumento"
      >
        {INSTRUMENTS.map(({ id, label, icon }) => (
          <option key={id} value={id}>
            {icon} {label}
          </option>
        ))}
      </select>
    </div>
  );
}
