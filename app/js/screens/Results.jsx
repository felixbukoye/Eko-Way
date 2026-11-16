import React, { useMemo } from 'react';
import Icon from '../icons.jsx';
import { useApp } from '../store.jsx';
import { StatusBar, AppBar, Notice, Empty, ModeSequence } from '../ui.jsx';
import RouteMap, { MiniTrace } from '../RouteMap.jsx';
import { plan, hubIdFor } from '../planner.js';

const OBJECTIVES = [
  { id: 'recommended', label: 'Recommended' },
  { id: 'fastest', label: 'Fastest' },
  { id: 'fewest_transfers', label: 'Fewest transfers' },
  { id: 'least_walking', label: 'Fewest walks' },
];

/**
 * Route results (PRD §8 screen 3 + §13.3 ranking).
 *
 * One mode in the MVP: journeys ranked from the recorded graph. A pair with no
 * recorded connection gets an explicit no-route state instead of a guess.
 */
export default function Results({ index, onOpenJourney, onOpenData }) {
  const { state, dispatch } = useApp();
  const { origin, destination, objective, allowProximity, plan: result } = state;

  const fromHub = origin?.hub ?? hubIdFor(index, origin?.id);
  const toHub = destination?.hub ?? hubIdFor(index, destination?.id);

  const ranked = useMemo(() => {
    if (!result?.journeys?.length) return [];
    return result.journeys;
  }, [result]);

  const originStop = origin && index.stops.get(origin.id);
  const destinationStop = destination && index.stops.get(destination.id);

  return (
    <div className="screen">
      <StatusBar />
      <AppBar
        title={fromHub && toHub ? `${fromHub} → ${toHub}` : 'Routes'}
        sub={origin?.name && destination?.name ? `${origin.name} to ${destination.name}` : 'Recorded routes'}
        onBack={() => dispatch({ type: 'back' })}
        action={
          <button className="appbar__action" onClick={() => dispatch({ type: 'openPicker', mode: 'to' })} aria-label="Change destination">
            <Icon.sliders size={18} />
          </button>
        }
      />

      <div className="screen__scroll">
        <div className="chipbar" style={{ paddingTop: 4 }}>
          {OBJECTIVES.map((o) => (
            <button
              key={o.id}
              className={`chip ${objective === o.id ? 'chip--selected' : 'chip--outline'}`}
              onClick={() => {
                dispatch({ type: 'objective', objective: o.id });
                const next = plan(
                  index,
                  { fromHub, toHub, objective: o.id, allowProximity, limit: 4 },
                );
                dispatch({ type: 'planned', plan: next });
              }}
            >
              {o.label}
            </button>
          ))}
        </div>

        <RouteMap
          graph={index.graph}
          journeys={ranked}
          selectedJourney={null}
          originStop={originStop}
          destinationStop={destinationStop}
          height={190}
        />

        {ranked.length === 0 ? (
          <>
            <div style={{ marginTop: 'var(--space-4)' }}>
              <Empty
                icon="route"
                title="No route for this direction"
                action={
                  <div className="stack-2" style={{ width: '100%' }}>
                    <button className="btn btn--secondary btn--block" onClick={() => dispatch({ type: 'openPicker', mode: 'to' })}>
                      <Icon.pin size={16} />
                      Choose another destination
                    </button>
                    <button className="btn btn--outline btn--block" onClick={() => dispatch({ type: 'swap' })}>
                      <Icon.swap size={16} />
                      Try {toHub} → {fromHub}
                    </button>
                  </div>
                }
              >
                Nothing is recorded from {fromHub} to {toHub}. Routes are only shown when a recorded trip
                connects the two areas in that direction — we would rather say so than draw a line.
              </Empty>
            </div>

            <div className="section-title">
              <h2>What is recorded</h2>
            </div>
            <PairEvidence index={index} fromHub={fromHub} toHub={toHub} />
          </>
        ) : (
          <>
            <div className="section-title">
              <h2>
                {ranked.length} route{ranked.length > 1 ? 's' : ''}
              </h2>
              <span className="section-title__meta">
                {OBJECTIVES.find((o) => o.id === objective)?.label}
              </span>
            </div>

            {ranked.map((journey) => (
              <button
                key={journey.id}
                className={`journey ${journey.rank === 1 ? 'journey--primary' : ''}`}
                onClick={() => onOpenJourney(journey.id)}
              >
                <div className="journey__top">
                  <div>
                    <div className="journey__time">
                      {formatDuration(journey.duration_min)}
                      <small>{journey.transfers === 0 ? 'direct' : `${journey.transfers} transfer${journey.transfers > 1 ? 's' : ''}`}</small>
                    </div>
                    <div className="journey__legs">
                      {journey.ride_legs} ride {journey.ride_legs === 1 ? 'leg' : 'legs'} ·{' '}
                      {journey.proximity_transfers ? `${journey.proximity_transfers} walk` : 'no walking transfer'}
                    </div>
                  </div>
                  <MiniTrace edge={index.edges.get(journey.legs.find((l) => l.type === 'ride')?.edge_id)} width={72} height={40} />
                </div>

                <div className="journey__flow">
                  <span className="journey__stop">{journey.origin_stop}</span>
                  <span className="journey__arrow"><Icon.chev size={13} /></span>
                  <span className="journey__stop">{journey.destination_stop}</span>
                </div>

                <ModeSequence sequence={journey.mode_sequence} />

                <div className="journey__foot">
                  <span className="journey__fare">
                    <Icon.wallet size={13} /> Fare not available
                  </span>
                  <span className="pill-note">{journey.label}</span>
                </div>
              </button>
            ))}

            <div style={{ marginTop: 'var(--space-4)' }}>
              <Notice tone="quiet" icon="info">
                Ride times are medians of trips recorded between {index.graph.meta.source_feed_period}.
                Traffic changes, so treat them as a guide rather than a promise.
              </Notice>
            </div>
          </>
        )}

        <p className="footnote" style={{ marginTop: 'var(--space-5)' }}>
          {index.graph.meta.stats.ride_edges} recorded route patterns · feed period{' '}
          {index.graph.meta.source_feed_period} ·{' '}
          <button className="linklike" onClick={onOpenData} style={{ font: 'inherit', padding: 0, border: 0, background: 'none', color: 'var(--text-link, inherit)', textDecoration: 'underline', cursor: 'pointer' }}>
            see the data
          </button>
        </p>
      </div>
    </div>
  );
}

function PairEvidence({ index, fromHub, toHub }) {
  const row = index.graph.hubPairMatrix.find((r) => r.from === fromHub && r.to === toHub);
  if (!row) return null;
  return (
    <div className="card" style={{ padding: 'var(--space-4)' }}>
      <div className="row-between" style={{ marginBottom: 'var(--space-2)' }}>
        <span className="t-eyebrow">This direction</span>
        <span className="pill-note">{row.status}</span>
      </div>
      <table className="kvtable">
        <tbody>
          <tr><td>Direction</td><td className="num">{row.from} → {row.to}</td></tr>
          <tr><td>Recorded routes</td><td className="num">{row.exact_paths}</td></tr>
          {row.best_origin_stop && <tr><td>Best origin</td><td>{row.best_origin_stop}</td></tr>}
          {row.best_destination_stop && <tr><td>Best destination</td><td>{row.best_destination_stop}</td></tr>}
          {row.best_modes && <tr><td>Modes</td><td>{row.best_modes}</td></tr>}
          {row.best_duration_min != null && <tr><td>Median duration</td><td className="num">{row.best_duration_min} min</td></tr>}
          <tr><td>Nearby stops</td><td className="num">{row.proximity_paths}</td></tr>
          <tr><td>Reverse direction</td><td>{index.graph.hubPairMatrix.some((r) => r.from === toHub && r.to === fromHub && r.exact_paths) ? 'has its own recorded routes' : 'not recorded'}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

export function formatDuration(min) {
  if (min == null) return '—';
  const rounded = Math.round(min);
  if (rounded < 60) return `${rounded} min`;
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return `${h}h ${m ? `${m}m` : ''}`.trim();
}
