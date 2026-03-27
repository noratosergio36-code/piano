import { useAppContext } from '../context/AppContext';
import './HandSelector.css';

const HANDS = [
  { id: 'left',  label: 'Izq', title: 'Mano izquierda' },
  { id: 'right', label: 'Der', title: 'Mano derecha' },
];

/**
 * Toggle buttons to select which hand(s) the player practices.
 * Both selected = practice both; one selected = practice that hand,
 * autoplay the other.
 */
export function HandSelector() {
  const { state, dispatch } = useAppContext();
  const { practicingHands } = state;

  function toggle(handId) {
    const current = practicingHands;
    let next;
    if (current.includes(handId)) {
      // Prevent deselecting the last hand
      if (current.length === 1) return;
      next = current.filter((h) => h !== handId);
    } else {
      next = [...current, handId];
    }
    dispatch({ type: 'SET_PRACTICING_HANDS', payload: next });
  }

  return (
    <div className="hand-selector" title="Selecciona qué mano practicar">
      <span className="hand-selector__label">Manos</span>
      {HANDS.map(({ id, label, title }) => (
        <button
          key={id}
          className={`hand-btn hand-btn--${id} ${practicingHands.includes(id) ? 'active' : ''}`}
          onClick={() => toggle(id)}
          title={title}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
