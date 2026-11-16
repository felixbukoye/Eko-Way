/**
 * RouteMap — a self-contained SVG map.
 *
 * Deliberately NOT a tile-backed map: the PRD (risks: provider dependence,
 * data rights) says map providers are an adapter behind an interface and that
 * public OSM tiles are not assumed to be a free production service. This view
 * renders the recorded geometries, stops and interchanges from our own dataset,
 * so it works offline and carries no third-party attribution obligation.
 *
 * Coordinates are EPSG:4326 [lng, lat]; the projection is a local equirectangular
 * fit, which is accurate enough at Lagos scale (~40 km across).
 */

import React, { useMemo, useEffect, useRef, useState } from 'react';

const PAD = 10;

function makeProjection(points, width, height) {
  const lngs = points.map((p) => p[0]);
  const lats = points.map((p) => p[1]);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);

  const spanLng = Math.max(maxLng - minLng, 0.004);
  const spanLat = Math.max(maxLat - minLat, 0.004);
  // Keep aspect roughly correct: scale lng by cos(lat).
  const cos = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));
  const scale = Math.min((width - PAD * 2) / (spanLng * cos), (height - PAD * 2) / spanLat);
  const offsetX = (width - spanLng * cos * scale) / 2;
  const offsetY = (height - spanLat * scale) / 2;

  return ([lng, lat]) => [
    offsetX + (lng - minLng) * cos * scale,
    height - (offsetY + (lat - minLat) * scale),
  ];
}

function pathFor(points, project) {
  if (!points?.length) return '';
  return points
    .map((p, i) => {
      const [x, y] = project(p);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

export default function RouteMap({
  graph,
  journeys = [],
  selectedJourney,
  selectedLeg,
  originStop,
  destinationStop,
  height = 240,
  onSelectStop,
  showAllTraces = true,
  className = '',
}) {
  const ref = useRef(null);
  const [width, setWidth] = useState(360);

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width;
      if (w) setWidth(w);
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const { project, all, highlighted, stops, pins } = useMemo(() => {
    const traceEdges = graph.edges.filter((e) => e.trace?.length);
    const allPts = [];
    for (const e of traceEdges) allPts.push(...e.trace);
    for (const s of graph.stops) allPts.push([s.lng, s.lat]);
    if (!allPts.length) allPts.push([3.39, 6.5]);
    const project = makeProjection(allPts, width, height);

    const edges = selectedJourney
      ? selectedJourney.legs.filter((l) => l.type === 'ride').map((l) => l.edge_id)
      : journeys.flatMap((j) => j.legs.filter((l) => l.type === 'ride').map((l) => l.edge_id));

    const legEdge = selectedLeg?.type === 'ride' ? selectedLeg.edge_id : null;
    const highlighted = graph.edges
      .filter((e) => legEdge === e.id)
      .map((e) => ({ edge: e, d: pathFor(e.trace, project) }));
    const focus = graph.edges
      .filter((e) => edges.includes(e.id) && e.id !== legEdge)
      .map((e) => ({ edge: e, d: pathFor(e.trace, project) }));

    const relevantStops = new Set();
    for (const j of selectedJourney ? [selectedJourney] : journeys) {
      for (const leg of j.legs) {
        if (leg.from_stop_id) relevantStops.add(leg.from_stop_id);
        if (leg.to_stop_id) relevantStops.add(leg.to_stop_id);
      }
    }
    const stops = graph.stops
      .filter((s) => s.interchange || relevantStops.has(s.id) || s.id === originStop?.id || s.id === destinationStop?.id)
      .map((s) => ({ stop: s, ...toXY(project([s.lng, s.lat])) }));

    const pins = [
      originStop && { kind: 'origin', stop: originStop, ...toXY(project([originStop.lng, originStop.lat])) },
      destinationStop && { kind: 'destination', stop: destinationStop, ...toXY(project([destinationStop.lng, destinationStop.lat])) },
    ].filter(Boolean);

    return {
      project,
      all: traceEdges.map((e) => ({ edge: e, d: pathFor(e.trace, project) })),
      highlighted: [...focus, ...highlighted],
      stops,
      pins,
    };
  }, [graph, journeys, selectedJourney, selectedLeg, originStop, destinationStop, width, height]);

  return (
    <div ref={ref} className={`map-canvas ${className}`} style={{ height }}>
      <svg width="100%" height={height} role="img" aria-label="Recorded route geometry map">
        <defs>
          <pattern id="mapgrid" width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M28 0H0V28" fill="none" stroke="var(--map-road-casing)" strokeWidth="1" />
          </pattern>
          <filter id="pinShadow" x="-60%" y="-60%" width="220%" height="220%">
            <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodOpacity="0.28" />
          </filter>
        </defs>
        <rect width="100%" height="100%" fill="var(--map-land)" />
        <rect width="100%" height="100%" fill="url(#mapgrid)" />
        {/* river hint: Lagos lagoon sits south-west of the recorded network */}
        <path d="M0 100 Q 60 88 120 96 T 260 92 L 260 140 L 0 140 Z" fill="var(--map-water)" opacity="0.55" />

        {showAllTraces &&
          all.map(({ edge, d }) => (
            <path key={edge.id} d={d} fill="none" stroke="var(--ink-200)" strokeWidth="1.1" opacity="0.55" />
          ))}

        {highlighted.map(({ edge, d }, i) => (
          <path
            key={`hl-${edge.id}`}
            d={d}
            fill="none"
            stroke="var(--ink-900)"
            strokeWidth={selectedLeg?.edge_id === edge.id ? 3.4 : 2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.92}
            style={{ mixBlendMode: 'normal' }}
          />
        ))}

        {stops.map(({ stop, x, y }) => (
          <g key={stop.id} onClick={() => onSelectStop?.(stop)} style={{ cursor: onSelectStop ? 'pointer' : 'default' }}>
            <circle cx={x} cy={y} r={stop.interchange ? 4.2 : 3} fill={stop.interchange ? 'var(--ink-900)' : 'var(--paper-50)'} stroke="var(--ink-900)" strokeWidth={1.4} />
          </g>
        ))}

        {pins.map(({ kind, stop, x, y }) => (
          <g key={kind} filter="url(#pinShadow)">
            <circle cx={x} cy={y} r={11} fill={kind === 'origin' ? 'var(--yellow-400)' : 'var(--ink-900)'} stroke="var(--ink-900)" strokeWidth={2.2} />
            <circle cx={x} cy={y} r={3.4} fill={kind === 'origin' ? 'var(--ink-900)' : 'var(--yellow-400)'} />
          </g>
        ))}
      </svg>
      <span className="map-canvas__stamp">Recorded geometry · EPSG:4326</span>
    </div>
  );
}

function toXY([x, y]) {
  return { x, y };
}

/** Small sparkline of a single edge, used in route rows and leg cards. */
export function MiniTrace({ edge, width = 84, height = 40 }) {
  const d = useMemo(() => {
    if (!edge?.trace?.length) return '';
    const project = makeProjection(edge.trace, width, height);
    return pathFor(edge.trace, project);
  }, [edge, width, height]);
  if (!d) return <div className="mini-trace mini-trace--empty" style={{ width, height }} />;
  return (
    <svg className="mini-trace" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={d} fill="none" stroke="var(--ink-900)" strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}
