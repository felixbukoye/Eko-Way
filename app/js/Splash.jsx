import React from 'react';
import Icon from './icons.jsx';

/**
 * Splash on first load: the mark and the wordmark, nothing else.
 *
 * It does real work rather than only decorating the wait — the route graph is
 * fetched while it is on screen, and the app does not appear underneath a
 * splash that is still fading. `MIN_VISIBLE_MS` keeps it from flashing when the
 * payload is warm in cache; the hold is capped inside App so a slow network
 * cannot trap anyone behind it.
 *
 * Motion is skipped entirely under `prefers-reduced-motion`.
 */
export const MIN_VISIBLE_MS = 1200;
export const MAX_HOLD_MS = 4200;

export default function Splash({ leaving = false }) {
  return (
    <div
      className={`splash ${leaving ? 'splash--leaving' : ''}`}
      role="status"
      aria-live="polite"
    >
      <div className="splash__lockup">
        <span className="splash__mark wordmark__mark">
          <Icon.bus size={54} />
        </span>
        <h1 className="splash__word">
          Eko <em>Way</em>
        </h1>
      </div>
      <span className="splash__sr">Loading Eko Way</span>
    </div>
  );
}
