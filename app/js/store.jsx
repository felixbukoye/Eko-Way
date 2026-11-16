/**
 * App state. No account, no server: PRD §5.4 keeps the MVP account-free and
 * keeps recent searches on-device only (FR-022). Everything lives in memory
 * plus a small localStorage key.
 */

import React, { createContext, useContext, useMemo, useReducer, useCallback } from 'react';

const RECENTS_KEY = 'ekoway.recents.v1';

const initialState = {
  screen: 'home', // home | search-picker | results | journey | data | about
  pickerMode: null, // 'from' | 'to'
  origin: null, // { kind, id, name, hub, lat, lng, detail }
  destination: null,
  objective: 'recommended', // recommended | fastest | fewest_transfers | least_walking
  researchMode: false, // the gate: false = public mode
  allowProximity: false,
  plan: null,
  planning: false,
  selectedJourneyId: null,
  selectedLegId: null,
  history: [],
  recents: loadRecents(),
  toast: null,
};

function loadRecents() {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecents(recents) {
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(recents.slice(0, 5)));
  } catch {
    /* storage may be unavailable — recents are optional */
  }
}

function reducer(state, action) {
  switch (action.type) {
    case 'go':
      return { ...state, history: [...state.history, state.screen], screen: action.screen };
    case 'back': {
      const history = [...state.history];
      const prev = history.pop() ?? 'home';
      return { ...state, history, screen: prev };
    }
    case 'openPicker':
      return { ...state, screen: 'search-picker', pickerMode: action.mode, history: [...state.history, state.screen] };
    case 'selectPlace': {
      const patch = {};
      if (action.mode === 'from') patch.origin = action.place;
      else patch.destination = action.place;
      const recents = [action.place, ...state.recents.filter((r) => r.id !== action.place.id)].slice(0, 5);
      saveRecents(recents);
      return { ...state, ...patch, recents, screen: 'home', history: state.history.filter((h) => h !== 'search-picker') };
    }
    case 'swap':
      return { ...state, origin: state.destination, destination: state.origin };
    case 'clearPlace':
      return { ...state, [action.field]: null };
    case 'objective':
      return { ...state, objective: action.objective };
    case 'researchMode':
      return { ...state, researchMode: action.value, plan: null, selectedJourneyId: null, selectedLegId: null };
    case 'proximity':
      return { ...state, allowProximity: action.value, plan: null, selectedJourneyId: null };
    case 'planning':
      return { ...state, planning: true };
    case 'planned':
      return {
        ...state,
        planning: false,
        plan: action.plan,
        screen: 'results',
        history: state.screen === 'results' ? state.history : [...state.history, state.screen],
        selectedJourneyId: action.plan?.journeys?.[0]?.id ?? null,
        selectedLegId: null,
      };
    case 'openJourney':
      return { ...state, screen: 'journey', selectedJourneyId: action.id, selectedLegId: null, history: [...state.history, state.screen] };
    case 'selectJourney':
      return { ...state, selectedJourneyId: action.id };
    case 'selectLeg':
      return { ...state, selectedLegId: state.selectedLegId === action.id ? null : action.id };
    case 'toast':
      return { ...state, toast: action.message };
    case 'clearToast':
      return { ...state, toast: null };
    case 'clearRecents':
      saveRecents([]);
      return { ...state, recents: [] };
    case 'reset':
      return { ...state, screen: 'home', plan: null, selectedJourneyId: null, selectedLegId: null, history: [] };
    default:
      return state;
  }
}

const StoreContext = createContext(null);

export function StoreProvider({ children, initial }) {
  // `initial` exists so tests and the smoke renderer can mount a screen in a
  // known state without driving the UI.
  const [state, dispatch] = useReducer(reducer, initial ? { ...initialState, ...initial } : initialState);

  const showToast = useCallback(
    (message) => {
      dispatch({ type: 'toast', message });
      window.clearTimeout(showToast._t);
      showToast._t = window.setTimeout(() => dispatch({ type: 'clearToast' }), 3200);
    },
    [dispatch],
  );

  const value = useMemo(() => ({ state, dispatch, showToast }), [state, dispatch, showToast]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useApp() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useApp must be used inside <StoreProvider>');
  return ctx;
}
