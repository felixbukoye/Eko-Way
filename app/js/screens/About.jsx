import React from 'react';
import Icon from '../icons.jsx';
import { useApp } from '../store.jsx';
import { StatusBar, AppBar, Notice } from '../ui.jsx';

/**
 * Profile / About. There is no account (PRD §5.4); this screen holds the
 * privacy statement, the honest status of the product, and the principles the
 * app is built to.
 */
export default function About({ index }) {
  const { state, dispatch } = useApp();
  const { recents } = state;
  const stats = index.graph.meta.stats;

  return (
    <div className="screen">
      <StatusBar />
      <AppBar title="About Eko Way" onBack={() => dispatch({ type: 'back' })} />

      <div className="screen__scroll">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 'var(--space-4) 0 var(--space-2)' }}>
          <span className="wordmark__mark" style={{ width: 60, height: 60, borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sticker)' }}>
            <Icon.bus size={30} />
          </span>
          <div className="t-h3" style={{ marginTop: 4 }}>Eko Way</div>
          <div className="footnote">Lagos transport navigator · no account needed</div>
        </div>

        <div className="statgrid" style={{ marginTop: 'var(--space-3)' }}>
          <div className="statbox"><div className="statbox__value">{stats.ride_edges}</div><div className="statbox__label">Directed patterns</div></div>
          <div className="statbox"><div className="statbox__value">{stats.stops}</div><div className="statbox__label">Stop nodes</div></div>
          <div className="statbox"><div className="statbox__value">{stats.interchanges}</div><div className="statbox__label">Interchanges</div></div>
          <div className="statbox"><div className="statbox__value">{index.graph.routes.length}</div><div className="statbox__label">Route IDs</div></div>
        </div>

        <div style={{ marginTop: 'var(--space-4)' }}>
          <Notice tone="ink" icon="shield" title="About the data.">
            Eko Way is a pilot. Routes are built from trips recorded across Lagos between{' '}
            {stats.feed_period || index.graph.meta.source_feed_period}, so ride times reflect the traffic of
            that period. Fares are not part of the dataset yet.
          </Notice>
        </div>

        <div className="section-title"><h2>How it behaves</h2></div>
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          {[
            ['Never invents a route', 'No route is generated from search results, an LLM or an old guide.'],
            ['Respects direction', 'A → B never implies B → A.'],
            ['Keeps modes apart', 'Danfo, Korope and LT Bus are distinct; Keke is not manufactured.'],
            ['No same-name merging', 'Two stops with the same name stay separate records.'],
            ['No inferred permissions', 'Intermediate stops are trace points, not boarding points.'],
            ['Shows its age', 'Ride times are recorded medians, not promises about today.'],
          ].map(([title, body]) => (
            <div key={title} style={{ display: 'flex', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <Icon.check size={15} style={{ color: 'var(--green-700)', flex: '0 0 auto', marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 'var(--text-12)', fontWeight: 600 }}>{title}</div>
                <div className="footnote">{body}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="section-title"><h2>Privacy</h2></div>
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <ul className="t-body-sm t-muted stack-2" style={{ paddingLeft: '1.1em', listStyle: 'disc' }}>
            <li>Location is optional and only used when you tap “Use my location”.</li>
            <li>No precise location history is stored. No account, no profile.</li>
            <li>Recent searches live on this device only ({recents.length} saved) and can be cleared.</li>
          </ul>
          <button
            className="btn btn--ghost btn--sm"
            style={{ marginTop: 'var(--space-3)' }}
            onClick={() => {
              dispatch({ type: 'clearRecents' });
              dispatch({ type: 'toast', message: 'Recent searches cleared from this device.' });
            }}
          >
            <Icon.close size={14} /> Clear recent searches
          </button>
        </div>

        <div className="section-title"><h2>Sources</h2></div>
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <p className="t-body-sm t-muted">
            Route geometry and stop records derive from the supplied Lagos GeoPackage via the MVP Phase 2
            candidate stop-event extract, covering 24 Nov 2022 – 31 Dec 2023. LAMATA FLM corridor names are
            held separately as official external candidates.
          </p>
          <p className="footnote" style={{ marginTop: 'var(--space-2)' }}>
            Maps are drawn from the recorded trip geometry in this dataset, not from a third-party tile
            service.
          </p>
        </div>

        <p className="footnote" style={{ textAlign: 'center', marginTop: 'var(--space-5)' }}>
          Eko Way v1.0.0 · Design system v1.0 · Made in Lagos
        </p>
      </div>
    </div>
  );
}
