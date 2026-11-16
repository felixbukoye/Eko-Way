import React, { useMemo } from 'react';
import Icon from '../icons.jsx';
import { useApp } from '../store.jsx';
import { StatusBar, AppBar, Notice, Empty, ModeSequence, GateBadge } from '../ui.jsx';
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
 * Two modes, one screen:
 *  • public mode  → status no_verified_route: an honest no-route state.
 *  • research mode → candidate chains with warnings on every card.
 */
export default function Results({ index, onOpenJourney, onOpenData }) {
  const { state, dispatch } = useApp();
  const { origin, destination, objective, researchMode, allowProximity, plan: result } = state;

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
        title={fromHub && toHub ? `${fromHub} → ${toHub}` : 'Route results'}
        sub={researchMode ? 'Research candidates · historical' : 'Public mode · verification gate'}
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
                  { researchMode },
                );
                dispatch({ type: 'planned', plan: next });
              }}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div style={{ margin: 'var(--space-3) 0' }}>
          {researchMode ? (
            <Notice tone="ink" icon="database" title="Research mode.">
              Candidates below come from 2022–2023 observations. Boarding and alighting permissions were
              never recorded, so these are evidence, not directions.
            </Notice>
          ) : (
            <Notice icon="lock" title="No verified route available.">
              Eko Way only shows a journey when this direction, its stops, transfers and legality have
              been verified. None have — so here is the honest answer.
            </Notice>
          )}
        </div>

        <RouteMap
          graph={index.graph}
          journeys={ranked}
          selectedJourney={null}
          originStop={originStop}
          destinationStop={destinationStop}
          height={190}
        />

        {/* -------------------------------------------------- public mode ---- */}
        {!researchMode && (
          <>
            <div style={{ marginTop: 'var(--space-4)' }}>
              <Empty
                icon="alert"
                title="We do not have a verified route for this journey yet"
                action={
                  <div className="stack-2" style={{ width: '100%' }}>
                    <button className="btn btn--secondary btn--block" onClick={() => dispatch({ type: 'researchMode', value: true })}>
                      <Icon.database size={16} />
                      Inspect research candidates
                    </button>
                    <button className="btn btn--outline btn--block" onClick={() => dispatch({ type: 'back' })}>
                      Try another destination
                    </button>
                  </div>
                }
              >
                {fromHub} → {toHub} has {pairInfo(index, fromHub, toHub)} in the historical extract, but
                the corridor has not passed field verification. No historical or generated route will be
                shown as a travel instruction.
              </Empty>
            </div>

            <PairEvidence index={index} fromHub={fromHub} toHub={toHub} />

            <div className="section-title">
              <h2>What would unblock this</h2>
            </div>
            <div className="card" style={{ padding: 'var(--space-4)' }}>
              <ul className="t-body-sm t-muted stack-2" style={{ paddingLeft: '1.1em', listStyle: 'disc' }}>
                <li>Field-verify current operation of the corridor in this direction.</li>
                <li>Confirm a precise, passenger-usable boarding point and alighting point.</li>
                <li>Record boarding/alighting permissions instead of inferring them from traces.</li>
                <li>Confirm transfer safety, operating hours and legal status.</li>
                <li>Log a reviewer sign-off so the route leaves <em>historical</em> status.</li>
              </ul>
              <button className="btn btn--ghost btn--sm" style={{ marginTop: 'var(--space-3)' }} onClick={onOpenData}>
                See the evidence record <Icon.arrow size={14} />
              </button>
            </div>
          </>
        )}

        {/* ------------------------------------------------ research mode ---- */}
        {researchMode && (
          <>
            <div className="section-title">
              <h2>
                {ranked.length
                  ? `${ranked.length} candidate chain${ranked.length > 1 ? 's' : ''}`
                  : 'No candidate chain'}
              </h2>
              <span className="section-title__meta">
                {result?.message?.startsWith('Research') ? 'Ranked by ' + OBJECTIVES.find((o) => o.id === objective)?.label : ''}
              </span>
            </div>

            {ranked.length === 0 && (
              <Empty icon="route" title="No chain in this direction">
                {result?.message}
              </Empty>
            )}

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
                      {journey.proximity_transfers ? `${journey.proximity_transfers} unverified walk` : 'no walking transfer'}
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

                {journey.requires_regulatory_review && (
                  <div style={{ marginTop: 'var(--space-2)' }}>
                    <span className="pill-note pill-note--warn"><Icon.alert size={10} /> Regulatory review required</span>
                  </div>
                )}

                <div className="journey__foot">
                  <span className="journey__fare">
                    <Icon.wallet size={13} /> Fare not available
                  </span>
                  <span className="pill-note">Historical</span>
                </div>
              </button>
            ))}

            {ranked.length > 0 && (
              <div style={{ marginTop: 'var(--space-4)' }}>
                <Notice tone="quiet" icon="alert">
                  <strong>Do not travel on these.</strong> Sample sizes are small (often 2 trips per
                  pattern), durations are 2022–2023 medians, and fares were never recorded. Use them to
                  plan verification fieldwork.
                </Notice>
              </div>
            )}
          </>
        )}

        <p className="footnote" style={{ marginTop: 'var(--space-5)' }}>
          Source: {index.graph.meta.graph} · feed period {index.graph.meta.source_feed_period} ·{' '}
          {index.graph.meta.stats.publicly_enabled_edges} publicly enabled edges.
        </p>
      </div>
    </div>
  );
}

function PairEvidence({ index, fromHub, toHub }) {
  const row = index.graph.hubPairMatrix.find((r) => r.from === fromHub && r.to === toHub);
  if (!row) return null;
  return (
    <div className="card" style={{ padding: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
      <div className="row-between" style={{ marginBottom: 'var(--space-2)' }}>
        <span className="t-eyebrow">Directed pair evidence</span>
        <span className={`pill-note ${row.exact_paths ? 'pill-note--warn' : ''}`}>
          {row.exact_paths ? `${row.exact_paths} historical` : 'none'}
        </span>
      </div>
      <table className="kvtable">
        <tbody>
          <tr><td>Direction</td><td className="num">{row.from} → {row.to}</td></tr>
          <tr><td>Historical chains</td><td className="num">{row.exact_paths}</td></tr>
          {row.best_origin_stop && <tr><td>Best origin</td><td>{row.best_origin_stop}</td></tr>}
          {row.best_destination_stop && <tr><td>Best destination</td><td>{row.best_destination_stop}</td></tr>}
          {row.best_modes && <tr><td>Modes</td><td>{row.best_modes}</td></tr>}
          {row.best_duration_min != null && <tr><td>Median duration</td><td className="num">{row.best_duration_min} min</td></tr>}
          <tr><td>Proximity candidates</td><td className="num">{row.proximity_paths}{row.proximity_only ? ' (only option — walking unverified)' : ''}</td></tr>
          <tr><td>Public directions</td><td><span className="pill-note pill-note--gate"><Icon.lock size={9} /> Disabled</span></td></tr>
        </tbody>
      </table>
      <p className="footnote" style={{ marginTop: 'var(--space-2)' }}>Status: {row.status}</p>
    </div>
  );
}

function pairInfo(index, fromHub, toHub) {
  const row = index.graph.hubPairMatrix.find((r) => r.from === fromHub && r.to === toHub);
  if (!row) return 'no recorded pair';
  if (row.exact_paths) return `${row.exact_paths} historical candidate chain${row.exact_paths > 1 ? 's' : ''}`;
  if (row.proximity_only) return 'only proximity candidates';
  return 'no chain at all';
}

export function formatDuration(min) {
  if (min == null) return '—';
  const rounded = Math.round(min);
  if (rounded < 60) return `${rounded} min`;
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return `${h}h ${m ? `${m}m` : ''}`.trim();
}
