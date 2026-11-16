import React, { useMemo, useState } from 'react';
import Icon from '../icons.jsx';
import { useApp } from '../store.jsx';
import { StatusBar, AppBar, Notice } from '../ui.jsx';
import { evidenceSummary } from '../planner.js';
import { MiniTrace } from '../RouteMap.jsx';

/**
 * Data & Evidence (PRD §8 screens 7–8, FR-019/026/027–028).
 * Read-only in the app: where the route data comes from, how fresh each
 * dimension is, the nearby-stop queue and the area-pair matrix. Admin editing
 * lives behind the authenticated service, not in this client.
 */
const TABS = [
  { id: 'gate', label: 'Source' },
  { id: 'network', label: 'Network' },
  { id: 'queue', label: 'Review queue' },
  { id: 'pairs', label: 'Hub pairs' },
];

export default function Data({ index }) {
  const { state, dispatch, showToast } = useApp();
  const [tab, setTab] = useState('gate');
  const summary = useMemo(() => evidenceSummary(index), [index]);
  const { allowProximity } = state;
  const meta = index.graph.meta;

  return (
    <div className="screen">
      <StatusBar />
      <AppBar
        title="Data & evidence"
        sub="Route Graph v1 · historical extract"
        onBack={() => dispatch({ type: 'back' })}
      />

      <div className="screen__scroll">
        <div className="statgrid">
          <div className="statbox">
            <div className="statbox__value">{summary.verified}</div>
            <div className="statbox__label">Field-verified edges</div>
          </div>
          <div className="statbox">
            <div className="statbox__value">{summary.edges}</div>
            <div className="statbox__label">Directed patterns</div>
          </div>
          <div className="statbox">
            <div className="statbox__value">{summary.withTrace}</div>
            <div className="statbox__label">Captured traces</div>
          </div>
          <div className="statbox">
            <div className="statbox__value">{summary.proximity}</div>
            <div className="statbox__label">Proximity candidates</div>
          </div>
        </div>

        <div className="chipbar" style={{ marginTop: 'var(--space-4)' }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`chip ${tab === t.id ? 'chip--selected' : 'chip--outline'}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'gate' && (
          <>
            <div className="section-title"><h2>Route data</h2></div>
            <div className="card" style={{ padding: 'var(--space-4)' }}>
              <div className="row-between" style={{ marginBottom: 'var(--space-2)' }}>
                <span className="t-eyebrow">Source policy</span>
                <span className="pill-note">Recorded observations</span>
              </div>
              <table className="kvtable">
                {Object.entries(meta.policy).map(([key, value]) => (
                  <tr key={key}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>{key}</td>
                    <td className="num">
                      <span className={`pill-note ${value ? (key.includes('historical') || key.includes('review') ? 'pill-note--warn' : '') : 'pill-note--ok'}`}>
                        {String(value)}
                      </span>
                    </td>
                  </tr>
                ))}
              </table>
            </div>

            <div className="section-title"><h2>Routing options</h2></div>
            <div className="card" style={{ padding: 'var(--space-4)' }}>
              <Toggle
                label="Include short walks between stops"
                hint="Off by default. Some journeys need a walk between two nearby stops; walking paths were not recorded, so distances are straight-line."
                checked={allowProximity}
                onChange={(v) => dispatch({ type: 'proximity', value: v })}
              />
            </div>

            <div className="section-title"><h2>Integrity checks</h2></div>
            <div className="card" style={{ padding: 'var(--space-4)' }}>
              {meta.integrity.map((t) => (
                <div key={t.test} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: t.passed ? 'var(--green-700)' : 'var(--red-700)', marginTop: 1 }}>
                    {t.passed ? <Icon.check size={15} /> : <Icon.alert size={15} />}
                  </span>
                  <div>
                    <div style={{ fontSize: 'var(--text-12)', fontWeight: 600 }}>{t.test}</div>
                    <div className="footnote">{t.detail}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 'var(--space-4)' }}>
              <Notice icon="info" title="Source.">
                {meta.source_dataset}. Recorded {meta.source_feed_period}. Coordinates {meta.coordinate_system}.
              </Notice>
            </div>

            <div className="section-title"><h2>Freshness dimensions</h2></div>
            <p className="footnote" style={{ marginTop: -6, marginBottom: 8 }}>
              Each dimension of a route is tracked separately, so an out-of-date figure never hides
              behind a current one.
            </p>
            <div className="card" style={{ padding: 'var(--space-4)' }}>
              <table className="kvtable">
                <thead><tr><th>Dimension</th><th>Observed</th><th>Missing</th></tr></thead>
                <tbody>
                  {[
                    ['Service existence', '2022–23', 'current field check'],
                    ['Direction', 'recorded', 'confirm headsign'],
                    ['Boarding point', 'origin only', 'pickup point'],
                    ['Alighting point', 'destination only', 'drop-off point'],
                    ['Intermediate stops', 'pass-through only', 'not offered'],
                    ['Transfers', 'same stop ID', 'walking links'],
                    ['Legal status', 'not recorded', 'corridor note'],
                    ['Fare', 'not available', 'fare source'],
                    ['Duration', 'observed median', 'current sample'],
                  ].map(([a, b, c]) => (
                    <tr key={a}><td>{a}</td><td className="num">{b}</td><td className="footnote">{c}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'network' && (
          <>
            <div className="section-title"><h2>Modes</h2><span className="section-title__meta">Never merged</span></div>
            <div className="card" style={{ padding: 'var(--space-4)' }}>
              <table className="kvtable">
                <thead><tr><th>Class</th><th>Patterns</th><th>Source labels</th></tr></thead>
                <tbody>
                  <tr><td>Danfo</td><td className="num">{summary.byMode.danfo ?? 0}</td><td className="footnote">Danfo (yellow), Danfo (other colours)</td></tr>
                  <tr><td>Korope</td><td className="num">{summary.byMode.korope ?? 0}</td><td className="footnote">Korope (yellow), Korope (other colours)</td></tr>
                  <tr><td>LT Bus</td><td className="num">{summary.byMode.lt_bus ?? 0}</td><td className="footnote">LT Bus</td></tr>
                  <tr><td>Keke</td><td className="num">0</td><td className="footnote">Not in source — must not be invented</td></tr>
                  <tr><td>FLM minibus</td><td className="num">0</td><td className="footnote">{summary.flm} external corridor names only</td></tr>
                </tbody>
              </table>
            </div>

            <div className="section-title"><h2>Coverage by area</h2></div>
            <div className="card" style={{ padding: 'var(--space-4)' }}>
              <table className="kvtable">
                <thead><tr><th>Area</th><th>Stops</th><th>Interchanges</th><th>Out / In</th></tr></thead>
                <tbody>
                  {index.graph.hubs.map((h) => (
                    <tr key={h.id}>
                      <td>{h.id}</td>
                      <td className="num">{summary.byHub[h.id].stops}</td>
                      <td className="num">{summary.byHub[h.id].interchanges}</td>
                      <td className="num">{summary.byHub[h.id].outbound} / {summary.byHub[h.id].inbound}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="section-title"><h2>Route patterns</h2><span className="section-title__meta">{index.graph.routes.length} route IDs</span></div>
            <div className="stack-2">
              {index.graph.routes.slice(0, 12).map((route) => {
                const edges = index.graph.edges.filter((e) => e.route_id === route.id);
                return (
                  <div key={route.id} className="card" style={{ padding: 'var(--space-3)' }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <MiniTrace edge={edges[0]} width={64} height={38} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 'var(--text-12)', fontWeight: 600 }}>{route.name}</div>
                        <div className="footnote">
                          {route.mode.label}{route.mode.subtype ? ` (${route.mode.subtype})` : ''} · {route.directions} direction{route.directions > 1 ? 's' : ''} · {edges.length} pattern{edges.length > 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="footnote" style={{ marginTop: 8 }}>Showing first 12 of {index.graph.routes.length}.</p>
          </>
        )}

        {tab === 'queue' && (
          <>
            <div className="section-title"><h2>Proximity review queue</h2><span className="section-title__meta">{index.graph.proximity.length}</span></div>
            <Notice tone="quiet" icon="info" title="Nearby stops.">
              Different stop IDs within 100 m of each other. Routes only use these as walking links when
              you switch on “Include short walks between stops”.
            </Notice>
            <div className="stack-2" style={{ marginTop: 'var(--space-3)' }}>
              {index.graph.proximity.slice(0, 14).map((p) => (
                <div key={p.id} className="card" style={{ padding: 'var(--space-3)' }}>
                  <div className="row-between">
                    <div style={{ fontSize: 'var(--text-12)', fontWeight: 600 }}>{p.from_name} ↔ {p.to_name}</div>
                    <span className="mono-sm">{Math.round(p.distance_m)} m</span>
                  </div>
                  <div className="footnote">{p.note || 'Straight-line distance between the two stops.'}</div>
                </div>
              ))}
            </div>
            <p className="footnote" style={{ marginTop: 8 }}>Showing 14 of {index.graph.proximity.length}.</p>

            <div className="section-title"><h2>External FLM corridors</h2><span className="section-title__meta">{index.graph.flm.length}</span></div>
            <div className="stack-2">
              {index.graph.flm.map((f) => (
                <div key={f.id} className="card" style={{ padding: 'var(--space-3)' }}>
                  <div className="row-between">
                    <div style={{ fontSize: 'var(--text-12)', fontWeight: 600 }}>{f.from} → {f.to}</div>
                    <span className="pill-note">External</span>
                  </div>
                  <div className="footnote">
                    {f.vehicle} · {f.source} · corridor name only, no stop records yet.
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'pairs' && (
          <>
            <div className="section-title"><h2>Area pairs</h2><span className="section-title__meta">30 directions</span></div>
            <p className="footnote" style={{ marginTop: -6, marginBottom: 8 }}>
              What the recorded graph contains for each direction between two service areas.
            </p>
            <div className="card" style={{ padding: 'var(--space-2)' }}>
              <div className="matrix">
                {index.graph.hubPairMatrix.map((r) => (
                  <div key={`${r.from}-${r.to}`} className="matrix__row">
                    <span className="matrix__pair">{r.from} → {r.to}</span>
                    <span className="matrix__count">
                      {r.exact_paths ? `${r.exact_paths} chain${r.exact_paths > 1 ? 's' : ''}` : r.proximity_only ? 'proximity only' : 'none'}
                    </span>
                    <span className={`pill-note ${r.exact_paths ? '' : r.proximity_only ? 'pill-note--warn' : 'pill-note--gate'}`}>
                      {r.exact_paths ? 'hist.' : r.proximity_only ? 'prox.' : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <p className="footnote" style={{ marginTop: 8 }}>
              23 of 30 directions have a recorded route; 4 only have nearby stops; 3 have nothing recorded.
            </p>
          </>
        )}

        <div style={{ marginTop: 'var(--space-5)' }}>
          <button className="btn btn--outline btn--block" onClick={() => showToast('Dataset imports run server-side, behind authentication.')}>
            <Icon.database size={16} /> Import a new dataset
          </button>
          <p className="footnote" style={{ marginTop: 8 }}>
            Dataset imports are an authenticated server action with an audit trail.
          </p>
        </div>
      </div>
    </div>
  );
}

function Toggle({ label, hint, checked, onChange, disabled }) {
  return (
    <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start', opacity: disabled ? 0.5 : 1 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 'var(--text-13)', fontWeight: 600 }}>{label}</div>
        <div className="footnote" style={{ marginTop: 2 }}>{hint}</div>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`switch ${checked ? '' : 'switch--off'}`}
        style={{ border: 0, cursor: disabled ? 'not-allowed' : 'pointer' }}
      />
    </div>
  );
}
