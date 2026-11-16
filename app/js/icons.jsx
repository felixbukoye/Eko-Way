/**
 * Icon set — same 24px grid, 1.8–2px stroke and round caps as the design
 * system sprite (see index.html). Kept as components so they can take
 * `currentColor` and be sized by CSS.
 */

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
};

const Svg = ({ size = 24, children, ...rest }) => (
  <svg width={size} height={size} {...base} {...rest}>{children}</svg>
);

export const Icon = {
  home: (p) => <Svg {...p}><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></Svg>,
  map: (p) => <Svg {...p}><path d="M9 4 3 6.5v14L9 18l6 2.5 6-2.5v-14L15 6.5 9 4zM9 4v14M15 6.5v14" /></Svg>,
  ticket: (p) => <Svg {...p}><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z" /><path d="M12 8v8" strokeDasharray="2 2" /></Svg>,
  user: (p) => <Svg {...p}><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20c1.2-3.6 4-5.4 7.5-5.4s6.3 1.8 7.5 5.4" /></Svg>,
  search: (p) => <Svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" strokeWidth="1.9" /></Svg>,
  mic: (p) => <Svg {...p}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" /></Svg>,
  swap: (p) => <Svg {...p}><path d="M4 8h13l-3-3M20 16H7l3 3" strokeWidth="1.9" /></Svg>,
  pin: (p) => <Svg {...p}><path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11z" /><circle cx="12" cy="10" r="2.6" /></Svg>,
  bus: (p) => <Svg {...p}><rect x="4" y="3.5" width="16" height="13" rx="2.5" /><path d="M4 10h16M8 7h8" /><path d="M7 16.5V20M17 16.5V20" strokeWidth="1.9" /><circle cx="8" cy="13" r="1" fill="currentColor" stroke="none" /><circle cx="16" cy="13" r="1" fill="currentColor" stroke="none" /></Svg>,
  car: (p) => <Svg {...p}><path d="M4 15v-3l2-5h12l2 5v3" /><rect x="3" y="14.5" width="18" height="4" rx="1.6" /><circle cx="7.5" cy="18.5" r="1.2" fill="currentColor" stroke="none" /><circle cx="16.5" cy="18.5" r="1.2" fill="currentColor" stroke="none" /></Svg>,
  clock: (p) => <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Svg>,
  chev: (p) => <Svg {...p} strokeWidth={2}><path d="m9 5 7 7-7 7" /></Svg>,
  chevDown: (p) => <Svg {...p} strokeWidth={2}><path d="m5 9 7 7 7-7" /></Svg>,
  close: (p) => <Svg {...p} strokeWidth={2}><path d="m6 6 12 12M18 6 6 18" /></Svg>,
  plus: (p) => <Svg {...p} strokeWidth={2.1}><path d="M12 5v14M5 12h14" /></Svg>,
  crosshair: (p) => <Svg {...p}><circle cx="12" cy="12" r="7" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" /></Svg>,
  bell: (p) => <Svg {...p}><path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 13 6 9z" /><path d="M10 18.5a2 2 0 0 0 4 0" /></Svg>,
  star: (p) => <Svg {...p}><path d="m12 3.5 2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.9l6.1-.8z" fill="currentColor" stroke="none" /></Svg>,
  route: (p) => <Svg {...p}><circle cx="6" cy="6" r="2.6" /><circle cx="18" cy="18" r="2.6" /><path d="M8.6 6H15a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h6.4" strokeDasharray="3 3" /></Svg>,
  wallet: (p) => <Svg {...p}><rect x="3" y="6" width="18" height="13" rx="3" /><path d="M3 10h18" /><circle cx="17" cy="14.5" r="1.2" fill="currentColor" stroke="none" /></Svg>,
  shield: (p) => <Svg {...p}><path d="M12 3l7 2.5v6c0 4.5-3 7.6-7 9.5-4-1.9-7-5-7-9.5v-6z" /><path d="m9 12 2.2 2.2L15.5 10" strokeWidth="1.9" /></Svg>,
  info: (p) => <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5" /><circle cx="12" cy="7.8" r="1" fill="currentColor" stroke="none" /></Svg>,
  alert: (p) => <Svg {...p}><path d="M12 3.5 21 20H3z" /><path d="M12 9v5" /><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" /></Svg>,
  check: (p) => <Svg {...p} strokeWidth={2.2}><path d="m5 12.5 4.5 4.5L19 7" /></Svg>,
  arrow: (p) => <Svg {...p} strokeWidth={2}><path d="M4 12h15M13 6l6 6-6 6" /></Svg>,
  arrowUp: (p) => <Svg {...p} strokeWidth={2}><path d="M12 20V4M6 10l6-6 6 6" /></Svg>,
  walk: (p) => <Svg {...p}><circle cx="13.5" cy="4.5" r="2" /><path d="m11 21 1.6-5.4-2.4-2.2.8-4.2 3 2.4 2.4 1" /><path d="m9.5 9.4-2 3.2M14.6 13.4 16 21" /></Svg>,
  database: (p) => <Svg {...p}><ellipse cx="12" cy="6" rx="7.5" ry="3" /><path d="M4.5 6v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6" /><path d="M4.5 12v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6" /></Svg>,
  layers: (p) => <Svg {...p}><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5" /></Svg>,
  lock: (p) => <Svg {...p}><rect x="4.5" y="10" width="15" height="10.5" rx="2.5" /><path d="M8 10V7.5a4 4 0 0 1 8 0V10" /></Svg>,
  sliders: (p) => <Svg {...p}><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2.1" /><circle cx="10" cy="17" r="2.1" /></Svg>,
  share: (p) => <Svg {...p}><path d="M12 15V4M8 8l4-4 4 4" /><path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" /></Svg>,
  refresh: (p) => <Svg {...p}><path d="M20 12a8 8 0 1 1-2.6-5.9" /><path d="M20 4v5h-5" /></Svg>,
  signal: (p) => <Svg {...p} strokeWidth={2.2}><path d="M4 18v-3M9 18v-6M14 18v-9M19 18V6" /></Svg>,
  wifi: (p) => <Svg {...p}><path d="M2.5 8.5a15 15 0 0 1 19 0M6 12.5a10 10 0 0 1 12 0M9.5 16.4a4.6 4.6 0 0 1 5 0" /><circle cx="12" cy="19.5" r="1.2" fill="currentColor" stroke="none" /></Svg>,
  battery: (p) => <Svg {...p}><rect x="2" y="7.5" width="17" height="9" rx="2.5" opacity=".45" /><rect x="3.6" y="9.1" width="12" height="5.8" rx="1.3" fill="currentColor" stroke="none" /><path d="M21 11v2" opacity=".45" /></Svg>,
  swap_h: (p) => <Svg {...p}><path d="M7 4v13M4 14l3 3 3-3M17 20V7M14 10l3-3 3 3" /></Svg>,
  terminal: (p) => <Svg {...p}><rect x="3.5" y="4" width="17" height="12" rx="2.5" /><path d="M8 20h8M12 16v4" /><path d="m7.5 8 2 2-2 2M12.5 12h4" /></Svg>,
};

export default Icon;
