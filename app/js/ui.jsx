/**
 * Shared UI pieces used across screens. All of them are thin wrappers over the
 * design-system component classes so there is exactly one implementation of
 * each pattern.
 */

import React from 'react';
import Icon from './icons.jsx';

export function StatusBar({ inverse = false }) {
  const now = new Date();
  const time = `${now.getHours() % 12 || 12}:${String(now.getMinutes()).padStart(2, '0')}`;
  return (
    <div className="appbar-status" style={inverse ? { color: '#fff' } : undefined} aria-hidden="true">
      <span>{time}</span>
      <span className="appbar-status__icons">
        <Icon.signal size={14} />
        <Icon.wifi size={14} />
        <Icon.battery size={19} />
      </span>
    </div>
  );
}

export function AppBar({ title, sub, onBack, action, tone = 'flat' }) {
  const cls = { flat: 'appbar appbar--flat', brand: 'appbar appbar--brand', surface: 'appbar appbar--surface' }[tone];
  return (
    <header className={cls}>
      {onBack && (
        <button className="appbar__back" onClick={onBack} aria-label="Go back">
          <Icon.chev size={20} style={{ transform: 'rotate(180deg)' }} />
        </button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="appbar__title" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
        {sub && <div className="appbar__sub">{sub}</div>}
      </div>
      {action}
    </header>
  );
}

export function ModePill({ mode, label }) {
  const icon = mode === 'walk' ? <Icon.walk size={13} /> : mode === 'keke' ? <Icon.car size={13} /> : <Icon.bus size={13} />;
  return (
    <span className={`mode-pill mode-pill--${mode}`}>
      {icon}
      {label}
    </span>
  );
}

const MODE_LABEL = { danfo: 'Danfo', korope: 'Korope', lt_bus: 'LT Bus', flm: 'FLM', keke: 'Keke', walk: 'Walk' };

export function ModeSequence({ sequence }) {
  return (
    <div className="journey__modes">
      {sequence.map((m, i) => (
        <ModePill key={`${m}-${i}`} mode={m} label={MODE_LABEL[m] ?? m} />
      ))}
    </div>
  );
}

export function Notice({ tone = 'warn', icon = 'info', title, children }) {
  const cls = tone === 'ink' ? 'notice notice--ink' : tone === 'quiet' ? 'notice notice--quiet' : 'notice';
  const I = Icon[icon] ?? Icon.info;
  return (
    <div className={cls} role="note">
      <span className="notice__icon"><I size={16} /></span>
      <div>
        {title && <strong>{title} </strong>}
        {children}
      </div>
    </div>
  );
}

export function Empty({ icon = 'route', title, children, action }) {
  const I = Icon[icon] ?? Icon.route;
  return (
    <div className="empty">
      <span className="empty__icon"><I size={26} /></span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}

export function Sheet({ onClose, labelledBy, children }) {
  React.useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div
        className="sheet-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet__handle" />
        {children}
      </div>
    </div>
  );
}

export function GateBadge({ children = 'Public directions disabled' }) {
  return <span className="pill-note pill-note--gate"><Icon.lock size={11} /> {children}</span>;
}

export { MODE_LABEL };
