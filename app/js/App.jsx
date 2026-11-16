import React, { useEffect, useMemo, useState, useCallback } from 'react';
import Icon from './icons.jsx';
import { useApp } from './store.jsx';
import { createIndex, plan, hubIdFor } from './planner.js';
import Home from './screens/Home.jsx';
import SearchPicker from './screens/SearchPicker.jsx';
import Results from './screens/Results.jsx';
import Journey from './screens/Journey.jsx';
import Data from './screens/Data.jsx';
import About from './screens/About.jsx';

export default function App() {
  const { state, dispatch, showToast } = useApp();
  const [graph, setGraph] = useState(null);
  const [error, setError] = useState(null);
  const [locating, setLocating] = useState(false);
  const [geoDenied, setGeoDenied] = useState(false);

  useEffect(() => {
    fetch('/data/graph.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setGraph)
      .catch((e) => setError(e.message));
  }, []);

  const index = useMemo(() => (graph ? createIndex(graph) : null), [graph]);

  const runPlan = useCallback(() => {
    if (!index) return;
    const fromHub = state.origin?.hub ?? hubIdFor(index, state.origin?.id);
    const toHub = state.destination?.hub ?? hubIdFor(index, state.destination?.id);
    dispatch({ type: 'planning' });
    // Deliberate short beat so the planning state is visible and honest.
    window.setTimeout(() => {
      const result = plan(
        index,
        {
          fromHub,
          toHub,
          objective: state.objective,
          allowProximity: state.allowProximity,
          limit: 4,
        },
        { researchMode: state.researchMode },
      );
      dispatch({ type: 'planned', plan: result });
    }, 420);
  }, [index, state.origin, state.destination, state.objective, state.allowProximity, state.researchMode, dispatch]);

  const useLocation = useCallback(() => {
    if (!index) return;
    if (!navigator.geolocation) {
      setGeoDenied(true);
      showToast('This device has no location service — search instead.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setGeoDenied(false);
        const { latitude: lat, longitude: lng } = pos.coords;
        // Snap to the nearest service hub — coverage is deliberately bounded.
        let best = null;
        let bestDist = Infinity;
        for (const hub of index.graph.hubs) {
          const d = Math.hypot(hub.lat - lat, (hub.lng - lng) * Math.cos((lat * Math.PI) / 180));
          if (d < bestDist) {
            bestDist = d;
            best = hub;
          }
        }
        const approxKm = bestDist * 111;
        if (approxKm > 25) {
          setGeoDenied(true);
          showToast(`You appear to be ~${Math.round(approxKm)} km from the supported area.`);
          return;
        }
        dispatch({
          type: 'selectPlace',
          mode: 'from',
          place: {
            kind: 'hub',
            id: best.id,
            name: best.name,
            hub: best.id,
            lat: best.lat,
            lng: best.lng,
            detail: `Nearest service area · ${approxKm < 1 ? 'you are inside it' : `${approxKm.toFixed(1)} km away`}`,
          },
        });
        showToast(`Using ${best.name} as your starting area.`);
      },
      () => {
        setLocating(false);
        setGeoDenied(true);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  }, [index, dispatch, showToast]);

  // Every screen gets its own scroll container; reset it on navigation so a new
  // screen never opens halfway down.
  const screen = state.screen;
  React.useEffect(() => {
    document.querySelectorAll('.screen__scroll').forEach((el) => {
      el.scrollTop = 0;
    });
  }, [screen]);

  // Browser back button maps to in-app back (FR: no dead ends).
  useEffect(() => {
    const onPop = () => dispatch({ type: 'back' });
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [dispatch]);

  if (error) {
    return (
      <div className="appframe">
        <div className="app">
          <div className="screen" style={{ justifyContent: 'center', padding: 24 }}>
            <div className="empty">
              <span className="empty__icon"><Icon.alert size={26} /></span>
              <h3>Could not load the route graph</h3>
              <p>{error}. Run <code>npm run data</code> to rebuild app/data/graph.json.</p>
              <button className="btn btn--primary" onClick={() => location.reload()}>Retry</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!graph) {
    return (
      <div className="appframe">
        <div className="app">
          <div className="screen" style={{ justifyContent: 'center', padding: 24 }}>
            <div className="planning" aria-live="polite">
              <div className="planning__row"><span className="spinner" /> Loading the historical route graph…</div>
              <div className="planning__bar" />
              <div className="planning__bar" style={{ width: '72%' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const showTabs = ['home', 'results', 'data', 'about'].includes(screen);

  return (
    <div className="appframe">
      {index && <DesktopAside index={index} />}
      <div className="app">
        {screen === 'home' && (
          <Home
            graph={graph}
            onPlan={runPlan}
            onUseLocation={useLocation}
            locating={locating}
            geoDenied={geoDenied}
          />
        )}
        {screen === 'search-picker' && (
          <SearchPicker index={index} onUseLocation={useLocation} locating={locating} />
        )}
        {screen === 'results' && (
          <Results
            index={index}
            onOpenJourney={(id) => dispatch({ type: 'openJourney', id })}
            onOpenData={() => dispatch({ type: 'go', screen: 'data' })}
          />
        )}
        {screen === 'journey' && <Journey index={index} />}
        {screen === 'data' && <Data index={index} />}
        {screen === 'about' && <About index={index} />}

        {showTabs && (
          <nav className="tabbar tabbar--app" aria-label="Main">
            <Tab active={screen === 'home'} icon="home" label="Home" onClick={() => dispatch({ type: 'go', screen: 'home' })} />
            <Tab
              active={screen === 'results'}
              icon="route"
              label="Journeys"
              onClick={() => {
                if (state.plan) dispatch({ type: 'go', screen: 'results' });
                else if (state.origin && state.destination) runPlan();
                else showToast('Choose a starting area and destination first.');
              }}
            />
            <Tab active={screen === 'data'} icon="database" label="Data" onClick={() => dispatch({ type: 'go', screen: 'data' })} />
            <Tab active={screen === 'about'} icon="user" label="About" onClick={() => dispatch({ type: 'go', screen: 'about' })} />
          </nav>
        )}

        {state.toast && <div className="toast" role="status">{state.toast}</div>}
      </div>
    </div>
  );
}

function Tab({ active, icon, label, onClick }) {
  const I = Icon[icon];
  return (
    <button className={`tabbar__item ${active ? 'tabbar__item--active' : ''}`} onClick={onClick} aria-current={active ? 'page' : undefined}>
      <I size={22} />
      {label}
    </button>
  );
}

/** Desktop-only context rail: explains the gate without shouting. */
function DesktopAside({ index }) {
  const stats = index.graph.meta.stats;
  return (
    <aside className="appframe__aside" aria-hidden="true">
      <div className="wordmark" style={{ marginBottom: 'var(--space-6)' }}>
        <span className="wordmark__mark"><Icon.bus size={22} /></span>
        <span className="wordmark__text">Eko <em>Way</em></span>
      </div>
      <p className="t-body-sm t-muted" style={{ maxWidth: '32ch' }}>
        A Lagos transit navigator that refuses to guess. Built on the historical Route Graph v1 and the
        Eko Way design system.
      </p>
      <hr className="divider" style={{ margin: 'var(--space-5) 0' }} />
      <div className="statgrid">
        <div className="statbox"><div className="statbox__value">{stats.ride_edges}</div><div className="statbox__label">Patterns</div></div>
        <div className="statbox"><div className="statbox__value">{stats.stops}</div><div className="statbox__label">Stops</div></div>
        <div className="statbox"><div className="statbox__value">{stats.routes}</div><div className="statbox__label">Route IDs</div></div>
        <div className="statbox statbox--alert"><div className="statbox__value">0</div><div className="statbox__label">Public</div></div>
      </div>
      <p className="footnote" style={{ marginTop: 'var(--space-5)' }}>
        Feed period {index.graph.meta.source_feed_period}. No route is publicly enabled. Research mode is
        available under Data &amp; Evidence.
      </p>
    </aside>
  );
}
