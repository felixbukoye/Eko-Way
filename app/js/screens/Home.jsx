import React from 'react';
import Icon from '../icons.jsx';
import { useApp } from '../store.jsx';
import { StatusBar, Notice, GateBadge } from '../ui.jsx';
import RouteMap from '../RouteMap.jsx';

/**
 * Home / Search (PRD §8 screen 1).
 * From and To, Use my location, swap, recent searches, service-area note.
 * States covered: empty, selected, permission denied, location unavailable.
 */
export default function Home({ graph, onPlan, onUseLocation, locating, geoDenied }) {
  const { state, dispatch, showToast } = useApp();
  const { origin, destination, recents, researchMode } = state;

  const canPlan = Boolean(origin && destination && origin.id !== destination.id);
  const hubs = graph.hubs;

  return (
    <div className="screen">
      <div className="hero">
        <StatusBar />
        <div className="appbar" style={{ padding: '0 0 14px', minHeight: 0 }}>
          <span className="wordmark__mark" style={{ width: 34, height: 34, boxShadow: '2px 2px 0 var(--ink-900)', borderRadius: 'var(--radius-sm)' }}>
            <Icon.bus size={19} />
          </span>
          <div style={{ flex: 1 }}>
            <div className="appbar__title" style={{ fontSize: 'var(--text-16)' }}>Eko Way</div>
            <div className="appbar__sub" style={{ color: 'rgba(11,11,10,.62)' }}>Lagos transport navigator</div>
          </div>
          <GateBadge>Gate closed</GateBadge>
        </div>

        <h1 className="hero__title">Where are you<br />going today?</h1>
        <p className="t-body-sm" style={{ color: 'rgba(11,11,10,.68)', marginTop: 6 }}>
          Six service areas · Danfo, Korope and LT Bus corridors
        </p>
      </div>

      <div className="screen__scroll" style={{ marginTop: -22 }}>
        <div className="place-picker" style={{ position: 'relative', zIndex: 2 }}>
          <button className="place-row" onClick={() => dispatch({ type: 'openPicker', mode: 'from' })}>
            <span className="place-row__rail">
              <span className="place-row__dot place-row__dot--from" />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="place-row__label">From</span>
              <span className={`place-row__value ${origin ? '' : 'place-row__value--empty'}`} style={{ display: 'block' }}>
                {origin ? origin.name : 'Choose a starting area'}
              </span>
              {origin && <span className="place-row__meta">{origin.detail}</span>}
            </span>
            <Icon.chev size={16} style={{ color: 'var(--text-tertiary)' }} />
          </button>

          <div className="place-picker__divider" />

          <button className="place-row" onClick={() => dispatch({ type: 'openPicker', mode: 'to' })}>
            <span className="place-row__rail">
              <span className="place-row__dot place-row__dot--to" />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="place-row__label">To</span>
              <span className={`place-row__value ${destination ? '' : 'place-row__value--empty'}`} style={{ display: 'block' }}>
                {destination ? destination.name : 'Choose a destination'}
              </span>
              {destination && <span className="place-row__meta">{destination.detail}</span>}
            </span>
            <Icon.chev size={16} style={{ color: 'var(--text-tertiary)' }} />
          </button>

          <button
            className="place-row__swap"
            style={{ position: 'absolute', right: 14, top: '50%', translate: '0 -50%' }}
            onClick={() => dispatch({ type: 'swap' })}
            aria-label="Swap origin and destination"
            disabled={!origin && !destination}
          >
            <Icon.swap size={17} />
          </button>
        </div>

        <div className="row" style={{ gap: 'var(--space-2)', marginTop: 'var(--space-3)', flexWrap: 'wrap' }}>
          <button className="btn btn--outline btn--sm" onClick={onUseLocation} disabled={locating}>
            <Icon.crosshair size={14} />
            {locating ? 'Locating…' : 'Use my location'}
          </button>
          {hubs.slice(0, 3).map((h) => (
            <button
              key={h.id}
              className="chip chip--outline"
              onClick={() => dispatch({ type: 'selectPlace', mode: 'to', place: hubToPlace(h) })}
            >
              {h.name}
            </button>
          ))}
        </div>

        {geoDenied && (
          <div style={{ marginTop: 'var(--space-3)' }}>
            <Notice tone="quiet" icon="info" title="Location unavailable.">
              That is fine — search by area, stop or landmark instead. Location is optional.
            </Notice>
          </div>
        )}

        <button
          className="btn btn--primary btn--block btn--lg"
          style={{ marginTop: 'var(--space-4)' }}
          disabled={!canPlan}
          onClick={onPlan}
        >
          <Icon.route size={18} />
          {canPlan ? 'Find routes' : 'Choose two areas'}
        </button>

        <div style={{ marginTop: 'var(--space-4)' }}>
          {researchMode ? (
            <Notice tone="ink" icon="database" title="Research mode is on.">
              Candidate chains from the 2022–2023 historical graph are shown with warnings. They are
              evidence for review, not travel instructions.
            </Notice>
          ) : (
            <Notice icon="lock" title="No verified route is published yet.">
              Every route in the current dataset is historical observation. Eko Way will tell you that
              honestly instead of inventing directions. Turn on research mode in Data &amp; Evidence to
              inspect candidates.
            </Notice>
          )}
        </div>

        <div className="section-title">
          <h2>Service areas</h2>
          <span className="section-title__meta">{hubs.length} in scope</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
          {hubs.map((h) => (
            <button
              key={h.id}
              className="card"
              style={{ padding: 'var(--space-3)', textAlign: 'left', cursor: 'pointer', border: '1px solid var(--border-subtle)' }}
              onClick={() => dispatch({ type: 'selectPlace', mode: 'from', place: hubToPlace(h) })}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon.pin size={14} style={{ color: 'var(--text-tertiary)' }} />
                <span style={{ fontSize: 'var(--text-13)', fontWeight: 600 }}>{h.name}</span>
              </div>
              <div className="footnote" style={{ marginTop: 4 }}>
                {h.stop_count} stops · {h.interchange_count} interchanges
              </div>
            </button>
          ))}
        </div>

        {recents.length > 0 && (
          <>
            <div className="section-title">
              <h2>Recent</h2>
              <span className="section-title__meta">On this device</span>
            </div>
            <div className="resultlist">
              {recents.map((r) => (
                <button
                  key={r.id}
                  className="resultrow"
                  onClick={() => dispatch({ type: 'selectPlace', mode: 'to', place: r })}
                >
                  <span className="resultrow__plate resultrow__plate--stop">
                    <Icon.clock size={16} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="resultrow__name">{r.name}</span>
                    <span className="resultrow__detail">{r.detail}</span>
                  </span>
                  <Icon.chev size={14} style={{ color: 'var(--text-tertiary)' }} />
                </button>
              ))}
            </div>
          </>
        )}

        <div className="section-title">
          <h2>Network at a glance</h2>
          <span className="section-title__meta">Historical extract</span>
        </div>
        <RouteMap graph={graph} height={200} showAllTraces />
        <p className="footnote" style={{ marginTop: 8 }}>
          {graph.meta.stats.stops} recorded stop nodes · {graph.meta.stats.ride_edges} directed route
          patterns · {graph.meta.stats.edges_with_trace} captured traces. Nothing here is enabled for
          public routing.
        </p>
      </div>
    </div>
  );
}

export function hubToPlace(hub) {
  return {
    kind: 'hub',
    id: hub.id,
    name: hub.name,
    hub: hub.id,
    lat: hub.lat,
    lng: hub.lng,
    detail: `Service area · ${hub.stop_count} stops`,
  };
}
