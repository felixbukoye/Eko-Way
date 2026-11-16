import React, { useMemo } from 'react';
import Icon from '../icons.jsx';
import { useApp } from '../store.jsx';
import { StatusBar, AppBar, Notice, ModeSequence, MODE_LABEL } from '../ui.jsx';
import RouteMap from '../RouteMap.jsx';
import { formatDuration } from './Results.jsx';

/**
 * Journey detail (PRD §8 screen 4, §8.2 instruction pattern, FR-018 map sync).
 *
 * Selecting a leg highlights the same geometry on the map and vice versa; the
 * step list is text-first so the itinerary is usable without the map.
 */
export default function Journey({ index }) {
  const { state, dispatch } = useApp();
  const { plan, selectedJourneyId, selectedLegId } = state;
  const journey = plan?.journeys?.find((j) => j.id === selectedJourneyId) ?? plan?.journeys?.[0];
  const selectedLeg = journey?.legs.find((l) => legId(l) === selectedLegId) ?? null;

  const originStop = journey ? index.stops.get(journey.origin_stop_id) : null;
  const destinationStop = journey ? index.stops.get(journey.destination_stop_id) : null;

  const warnings = useMemo(() => {
    if (!journey) return [];
    const out = [];
    if (journey.requires_regulatory_review) {
      out.push('At least one leg touches a corridor flagged for regulatory review (Korope / Lekki-Epe reform). It must not be published without authority confirmation.');
    }
    if (journey.proximity_transfers) {
      out.push('This candidate uses a proximity walking transfer between two different stop IDs. Straight-line distance does not prove a safe, walkable crossing.');
    }
    if (journey.legs.some((l) => l.duration_basis === 'rough_distance_fallback_not_observed')) {
      out.push('One or more legs have no observed duration; the figure falls back to a distance-based estimate and is labelled as such.');
    }
    return out;
  }, [journey]);

  if (!journey) {
    return (
      <div className="screen">
        <StatusBar />
        <AppBar title="Journey" onBack={() => dispatch({ type: 'back' })} />
        <div className="screen__scroll">
          <Notice icon="alert">No journey selected.</Notice>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <StatusBar />
      <AppBar
        title={`${journey.origin_stop} → ${journey.destination_stop}`}
        sub={`Candidate ${journey.rank} · historical evidence`}
        onBack={() => dispatch({ type: 'back' })}
        action={
          <button
            className="appbar__action"
            aria-label="Share journey"
            onClick={() => dispatch({ type: 'toast', message: 'Sharing is disabled until routes are verified.' })}
          >
            <Icon.share size={17} />
          </button>
        }
      />

      <div className="screen__scroll screen__scroll--flush">
        <RouteMap
          className="map-hero"
          graph={index.graph}
          journeys={plan.journeys}
          selectedJourney={journey}
          selectedLeg={selectedLeg}
          originStop={originStop}
          destinationStop={destinationStop}
          height={215}
        />

        <div style={{ padding: 'var(--space-4)' }}>
          <div className="row-between" style={{ alignItems: 'flex-start' }}>
            <div>
              <div className="journey__time">
                {formatDuration(journey.duration_min)}
                <small>{journey.ride_legs} ride{journey.ride_legs > 1 ? 's' : ''}</small>
              </div>
              <div className="journey__legs">
                {journey.transfers} transfer{journey.transfers === 1 ? '' : 's'} · {Math.round(journey.distance_m / 1000 * 10) / 10} km recorded
              </div>
            </div>
            <span className="pill-note pill-note--warn">Unverified</span>
          </div>

          <ModeSequence sequence={journey.mode_sequence} />

          <div style={{ marginTop: 'var(--space-3)' }}>
            <Notice tone="ink" icon="alert" title="Not travel instructions.">
              These legs are 2022–2023 observations. Boarding and alighting permissions were never
              recorded; sample sizes are small; fares are unavailable.
            </Notice>
          </div>

          <div className="section-title">
            <h2>Step by step</h2>
            <span className="section-title__meta">{journey.legs.length} steps</span>
          </div>

          <div className="legs">
            {journey.legs.map((leg) => (
              <Leg
                key={legId(leg)}
                leg={leg}
                open={selectedLegId === legId(leg)}
                onToggle={() => dispatch({ type: 'selectLeg', id: legId(leg) })}
                index={index}
              />
            ))}
          </div>

          {warnings.length > 0 && (
            <>
              <div className="section-title"><h2>Warnings</h2></div>
              <div className="stack-2">
                {warnings.map((w, i) => (
                  <Notice key={i} icon="alert" tone="quiet">{w}</Notice>
                ))}
              </div>
            </>
          )}

          <div className="section-title"><h2>Evidence</h2></div>
          <table className="kvtable" style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: 0 }}>
            <tbody>
              <tr><td>Status</td><td><span className="pill-note pill-note--gate"><Icon.lock size={9} /> historical_unverified</span></td></tr>
              <tr><td>Source period</td><td className="num">{index.graph.meta.source_feed_period}</td></tr>
              <tr><td>Fare</td><td>Unavailable — fare evidence not enabled for this dataset</td></tr>
              <tr><td>Duration basis</td><td>Observed median per leg (sample sizes shown per step)</td></tr>
              <tr><td>Geometry</td><td>Captured trip trace, linked by edge ID</td></tr>
              <tr><td>Public routing</td><td><span className="pill-note pill-note--gate">Disabled</span></td></tr>
            </tbody>
          </table>

          <div style={{ marginTop: 'var(--space-4)' }}>
            <Notice tone="quiet" icon="info" title="Was this useful?">
              Feedback in the MVP is recorded as a signal only; it never edits a transport record.
            </Notice>
            <div className="actionrow" style={{ marginTop: 'var(--space-2)' }}>
              <button className="btn btn--outline btn--sm" onClick={() => dispatch({ type: 'toast', message: 'Thanks — feedback noted (signal only).' })}>
                <Icon.check size={14} /> Useful
              </button>
              <button className="btn btn--outline btn--sm" onClick={() => dispatch({ type: 'toast', message: 'Thanks — this will be reviewed against evidence.' })}>
                <Icon.close size={14} /> Not right
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="screen__dock">
        <button
          className="btn btn--primary btn--block"
          onClick={() =>
            dispatch({
              type: 'toast',
              message: 'Directions stay disabled until this corridor is verified and approved.',
            })
          }
        >
          <Icon.lock size={16} /> Start guidance (disabled)
        </button>
      </div>
    </div>
  );
}

function legId(leg) {
  return leg.type === 'ride' ? leg.edge_id : `${leg.from_stop_id}_${leg.to_stop_id}`;
}

function Leg({ leg, open, onToggle, index }) {
  if (leg.type === 'transfer') {
    return (
      <div className="leg leg--transfer">
        <div className="leg__rail"><span className="leg__dot"><Icon.walk size={14} /></span></div>
        <div className="leg__card">
          <button className="leg__head" onClick={onToggle} aria-expanded={open}>
            <div style={{ flex: 1 }}>
              <div className="leg__title">Walk between stops</div>
              <div className="leg__sub">
                {leg.from_stop} → {leg.to_stop} · {Math.round(leg.straight_line_distance_m)} m straight line
              </div>
            </div>
            <Icon.chev size={15} className={`leg__chev ${open ? 'leg__chev--open' : ''}`} />
          </button>
          {open && (
            <div className="leg__body">
              <p className="leg__instruction">
                Unverified pedestrian link. The {Math.round(leg.straight_line_distance_m)} m figure is
                straight-line distance only — it does not prove a safe or walkable path, and no road
                crossing has been recorded.
              </p>
              <div className="leg__grid">
                <div className="leg__kv"><dt>Est. walk</dt><dd>{leg.estimated_walk_min} min @ 4 km/h</dd></div>
                <div className="leg__kv"><dt>Status</dt><dd>unverified candidate</dd></div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const modeLabel = MODE_LABEL[leg.mode] ?? leg.mode;
  return (
    <div className="leg leg--ride">
      <div className="leg__rail"><span className="leg__dot"><Icon.bus size={14} /></span></div>
      <div className="leg__card">
        <button className="leg__head" onClick={onToggle} aria-expanded={open}>
          <div style={{ flex: 1 }}>
            <div className="leg__title">
              {modeLabel} to {leg.to_stop}
            </div>
            <div className="leg__sub">
              {leg.from_stop} → {leg.to_stop} · {formatDuration(leg.duration_min)}
            </div>
          </div>
          <Icon.chev size={15} className={`leg__chev ${open ? 'leg__chev--open' : ''}`} />
        </button>

        {open && (
          <div className="leg__body">
            <p className="leg__instruction">
              Recorded pattern: board at <b>{leg.from_stop}</b>, ride {modeLabel} towards{' '}
              <b>{leg.to_stop}</b>, and get down at <b>{leg.to_stop}</b>. This instruction is a
              description of an observed 2022–2023 trip — <b>not</b> a verified boarding instruction.
            </p>

            <div className="leg__grid">
              <div className="leg__kv"><dt>Route label</dt><dd>{leg.route_name}</dd></div>
              <div className="leg__kv"><dt>Direction</dt><dd>{leg.direction}</dd></div>
              <div className="leg__kv"><dt>Recorded duration</dt><dd>{formatDuration(leg.duration_min)}</dd></div>
              <div className="leg__kv"><dt>Samples</dt><dd>{leg.duration_samples ?? '—'} trips</dd></div>
              <div className="leg__kv"><dt>Observed days</dt><dd>{leg.days}</dd></div>
              <div className="leg__kv"><dt>Observed window</dt><dd>{leg.start?.slice(0, 5)}–{leg.end?.slice(0, 5)}</dd></div>
              <div className="leg__kv"><dt>Distance</dt><dd>{leg.distance_m ? `${(leg.distance_m / 1000).toFixed(1)} km` : '—'}</dd></div>
              <div className="leg__kv"><dt>Fare</dt><dd>Unavailable</dd></div>
            </div>

            <div className="leg__stops">
              <span className="leg__stopchip">{leg.from_stop} · board (unverified)</span>
              {leg.intermediate_stops.map((name, i) => (
                <span key={i} className="leg__stopchip leg__stopchip--off" title="Intermediate stop: not boardable or alightable in the source data">
                  {name}
                </span>
              ))}
              <span className="leg__stopchip">{leg.to_stop} · alight (unverified)</span>
            </div>

            <p className="footnote" style={{ marginTop: 'var(--space-2)' }}>
              Struck-through stops are intermediate trace points. The source provides no pickup or
              drop-off permission for them, so Eko Way never offers them as boarding points.
            </p>

            {leg.transfer_at && (
              <div style={{ marginTop: 'var(--space-2)' }}>
                <span className="pill-note pill-note--ok">
                  <Icon.terminal size={10} /> Same stop ID interchange
                </span>
              </div>
            )}

            {leg.regulatory?.required && (
              <div style={{ marginTop: 'var(--space-2)' }}>
                <Notice icon="alert" tone="quiet">{leg.regulatory.note}</Notice>
              </div>
            )}

            <div className="leg__kv" style={{ marginTop: 'var(--space-3)' }}>
              <dt>Edge</dt>
              <dd className="mono-sm">{leg.edge_id} · {leg.source_period}</dd>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
