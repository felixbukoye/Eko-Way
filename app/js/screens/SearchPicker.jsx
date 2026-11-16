import React, { useMemo, useState } from 'react';
import Icon from '../icons.jsx';
import { useApp } from '../store.jsx';
import { StatusBar, AppBar, Empty } from '../ui.jsx';
import { searchPlaces, stopsForHub } from '../planner.js';
import { hubToPlace } from './Home.jsx';

/**
 * Location results (PRD §8 screen 2).
 * Places, areas, landmarks and exact terminal aliases with distinguishing
 * context. Same-name stops are listed separately, never merged (README rule 1).
 */
export default function SearchPicker({ index, onUseLocation, locating }) {
  const { state, dispatch } = useApp();
  const [q, setQ] = useState('');
  const mode = state.pickerMode ?? 'to';

  const results = useMemo(() => searchPlaces(index, q, 10), [index, q]);
  const hubs = index.graph.hubs;
  const showingDefault = q.trim().length === 0;

  const pick = (place) => dispatch({ type: 'selectPlace', mode, place });

  return (
    <div className="screen">
      <StatusBar />
      <AppBar
        title={mode === 'from' ? 'Starting point' : 'Destination'}
        sub="Search by area, stop or landmark"
        onBack={() => dispatch({ type: 'back' })}
      />
      <div className="searchbox">
        <label className="searchbox__field">
          <Icon.search size={18} style={{ color: 'var(--text-tertiary)' }} />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={mode === 'from' ? 'Where are you starting?' : 'Where are you going?'}
            aria-label="Search places and stops"
          />
          {q && (
            <button style={{ border: 0, background: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center' }} onClick={() => setQ('')} aria-label="Clear search">
              <Icon.close size={16} style={{ color: 'var(--text-tertiary)' }} />
            </button>
          )}
        </label>
      </div>

      <div className="screen__scroll">
        {showingDefault && (
          <>
            <button className="resultrow" onClick={onUseLocation} disabled={locating}>
              <span className="resultrow__plate" style={{ background: 'var(--yellow-100)' }}>
                <Icon.crosshair size={18} />
              </span>
              <span style={{ flex: 1 }}>
                <span className="resultrow__name">{locating ? 'Getting location…' : 'Use my current location'}</span>
                <span className="resultrow__detail">Optional · you can always type instead</span>
              </span>
            </button>

            <div className="section-title"><h2>Service areas</h2><span className="section-title__meta">Six in scope</span></div>
            <div className="resultlist">
              {hubs.map((h) => (
                <button key={h.id} className="resultrow" onClick={() => pick(hubToPlace(h))}>
                  <span className="resultrow__plate">{h.name.slice(0, 3).toUpperCase()}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="resultrow__name">{h.name}</span>
                    <span className="resultrow__detail">
                      {h.stop_count} recorded stops · {h.interchange_count} terminal interchanges
                    </span>
                  </span>
                  <Icon.chev size={14} style={{ color: 'var(--text-tertiary)' }} />
                </button>
              ))}
            </div>

            <div className="section-title"><h2>Terminal stops</h2><span className="section-title__meta">Pick an exact stop</span></div>
            <div className="resultlist">
              {index.graph.interchanges.slice(0, 8).map((row) => {
                const stop = index.stops.get(row.stop_id);
                if (!stop) return null;
                return (
                  <button
                    key={row.stop_id}
                    className="resultrow"
                    onClick={() =>
                      pick({
                        kind: 'stop',
                        id: stop.id,
                        name: stop.name,
                        hub: stop.hub,
                        lat: stop.lat,
                        lng: stop.lng,
                        detail: `${stop.hub ?? 'Support terminal'} · exact terminal interchange`,
                      })
                    }
                  >
                    <span className="resultrow__plate resultrow__plate--stop"><Icon.terminal size={17} /></span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="resultrow__name">{stop.name}</span>
                      <span className="resultrow__detail">
                        {row.incoming.length} in · {row.outgoing.length} out · same stop ID
                      </span>
                    </span>
                    <Icon.chev size={14} style={{ color: 'var(--text-tertiary)' }} />
                  </button>
                );
              })}
            </div>
          </>
        )}

        {!showingDefault && results.length === 0 && (
          <Empty icon="search" title="Nothing matched">
            No stop, area or landmark in the historical extract matches “{q}”. Try “Yaba”, “Oshodi”,
            “Obalende” or “Lekki”.
          </Empty>
        )}

        {!showingDefault && results.length > 0 && (
          <div className="resultlist">
            {results.map((r) => (
              <button
                key={`${r.kind}-${r.id}`}
                className="resultrow"
                onClick={() =>
                  pick({
                    kind: r.kind,
                    id: r.id,
                    name: r.name,
                    hub: r.kind === 'hub' ? r.id : index.stops.get(r.id)?.hub,
                    lat: r.lat,
                    lng: r.lng,
                    detail: r.detail,
                  })
                }
              >
                <span className={`resultrow__plate ${r.kind === 'stop' ? 'resultrow__plate--stop' : ''}`}>
                  {r.kind === 'hub' ? r.name.slice(0, 3).toUpperCase() : <Icon.pin size={16} />}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="resultrow__name">{r.name}</span>
                  <span className="resultrow__detail">{r.detail}</span>
                  <span className="footnote" style={{ display: 'block', marginTop: 2 }}>{r.meta}</span>
                </span>
                <Icon.chev size={14} style={{ color: 'var(--text-tertiary)' }} />
              </button>
            ))}
          </div>
        )}

        <p className="footnote" style={{ marginTop: 'var(--space-5)' }}>
          Stops with the same name are separate records with different source IDs. Eko Way never merges
          them by name.
        </p>
      </div>
    </div>
  );
}
