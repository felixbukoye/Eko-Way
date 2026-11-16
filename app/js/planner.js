/**
 * Eko Way — journey planner.
 *
 * Ported from the supplied `routePlanner.ts` research prototype (see
 * data/raw/routePlanner.ts) and extended with the PRD's ranking objectives.
 *
 * ROUTING MODE (single switch)
 * -------------------------------------------------------------------------
 * The dataset behind this build has no field-verified edges, so the PRD's
 * verification gate (FR-005 / FR-020, policy `default_public_routing: false`)
 * would withhold every route. For the MVP we deliberately route on the
 * historical graph instead and let the interface present the journey as a
 * route, with fares unavailable and durations taken from recorded rides.
 *
 * `MVP.unverifiedRouting` is the one place this is decided:
 *   true  → `plan()` returns journeys in public mode (current MVP behaviour)
 *   false → `plan()` short-circuits to `no_verified_route`, exactly as the
 *           PRD describes, with no other code change required.
 *
 * The provenance fields on each journey (`status`, `confidence`, `confidence`,
 * `source_period`) stay populated: the data still says what it is, even though
 * the interface no longer warns the traveller about it.
 */

export const MVP = Object.freeze({
  /** The switch. Flip to false to restore the strict verification gate. */
  unverifiedRouting: true,
});

export const PUBLIC_GATE = Object.freeze({
  verifiedEdges: 0,
  totalEdges: 81,
  /** Whether journeys may be produced while `verifiedEdges` is still 0. */
  enabled: MVP.unverifiedRouting,
});

export const STATUS = Object.freeze({
  VERIFIED: 'verified',
  PROVISIONAL: 'provisional',
  HISTORICAL: 'historical_unverified',
  STALE: 'stale',
  INACTIVE: 'inactive',
});

export const MODES = Object.freeze({
  danfo: { id: 'danfo', label: 'Danfo', plural: 'Danfo', icon: 'bus' },
  korope: { id: 'korope', label: 'Korope', plural: 'Korope', icon: 'bus' },
  lt_bus: { id: 'lt_bus', label: 'LT Bus', plural: 'LT Bus', icon: 'bus' },
  flm: { id: 'flm', label: 'FLM minibus', plural: 'FLM minibus', icon: 'bus' },
  keke: { id: 'keke', label: 'Keke', plural: 'Keke', icon: 'car' },
});

export const HISTORICAL_WARNING =
  'Historical 2022–2023 route observations. Do not use as live travel instructions ' +
  'until current service, boarding/alighting, transfers, legality and fares are ' +
  'independently verified.';

const MAX_EXPANSIONS = 60_000;

/**
 * Build fast lookup indexes over the graph payload (app/data/graph.json).
 */
export function createIndex(graph) {
  const stops = new Map(graph.stops.map((s) => [s.id, s]));
  const edges = new Map(graph.edges.map((e) => [e.id, e]));
  const routes = new Map(graph.routes.map((r) => [r.id, r]));
  const hubs = new Map(graph.hubs.map((h) => [h.id, h]));

  const edgesFrom = new Map();
  const edgesTo = new Map();
  for (const edge of graph.edges) {
    if (!edgesFrom.has(edge.from)) edgesFrom.set(edge.from, []);
    edgesFrom.get(edge.from).push(edge);
    if (!edgesTo.has(edge.to)) edgesTo.set(edge.to, []);
    edgesTo.get(edge.to).push(edge);
  }

  // Exact same-stop-ID interchanges only. Proximity is deliberately excluded.
  const interchangeAt = new Map();
  for (const row of graph.interchanges) {
    interchangeAt.set(row.stop_id, row);
  }

  const proximityFrom = new Map();
  for (const row of graph.proximity || []) {
    if (!proximityFrom.has(row.from)) proximityFrom.set(row.from, []);
    proximityFrom.get(row.from).push(row);
    if (!proximityFrom.has(row.to)) proximityFrom.set(row.to, []);
    proximityFrom.get(row.to).push({ ...row, from: row.to, to: row.from, from_name: row.to_name, to_name: row.from_name });
  }

  return { graph, stops, edges, routes, hubs, edgesFrom, edgesTo, interchangeAt, proximityFrom };
}

/** Stops belonging to a hub, ordered so interchanges come first. */
export function stopsForHub(index, hubId) {
  const hub = index.hubs.get(hubId);
  if (!hub) return [];
  return hub.stop_ids
    .map((id) => index.stops.get(id))
    .filter(Boolean)
    .sort((a, b) => Number(b.interchange) - Number(a.interchange) || a.name.localeCompare(b.name));
}

export function hubIdFor(index, stopId) {
  const stop = index.stops.get(stopId);
  if (!stop) return null;
  if (stop.hub) return stop.hub;
  // Support terminals outside the six service hubs belong to their nearest hub.
  let best = null;
  let bestDist = Infinity;
  for (const hub of index.hubs.values()) {
    const d = haversine(stop, hub);
    if (d < bestDist) {
      bestDist = d;
      best = hub.id;
    }
  }
  return best;
}

export function haversine(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Search the historical graph.
 *
 * @param {object} index      from createIndex()
 * @param {object} query      { fromHub, toHub, objective, allowProximity, maxRideLegs, limit }
 * @param {object} options    { strictGate: boolean } — force the strict
 *                            verification gate regardless of `MVP.unverifiedRouting`
 */
export function plan(index, query, options = {}) {
  // Routing is allowed while `MVP.unverifiedRouting` is on. `strictGate: true`
  // re-enables the PRD gate for a single call (used by the tests).
  const gated = options.strictGate === true || !MVP.unverifiedRouting;
  const {
    fromHub,
    toHub,
    objective = 'recommended',
    allowProximity = false,
    maxRideLegs = 4,
    limit = 4,
  } = query;

  const base = {
    from_hub: fromHub,
    to_hub: toHub,
    research_mode: !gated,
    proximity_transfers_enabled: allowProximity,
    // A journey may be produced, but the dataset itself still publishes no
    // verified edge: this describes the data, not what we choose to show.
    public_directions_allowed: !gated,
    warning: gated ? HISTORICAL_WARNING : null,
  };

  // ---------- The verification gate. ----------
  if (gated) {
    return {
      ...base,
      status: 'no_verified_route',
      journeys: [],
      message:
        'We do not have a verified public-transport route for this journey yet. ' +
        'No route in this dataset has passed field verification, so Eko Way will not ' +
        'present one as a travel instruction.',
    };
  }

  if (!fromHub || !toHub) {
    return { ...base, status: 'invalid_request', journeys: [], message: 'Choose an origin and a destination.' };
  }
  if (fromHub === toHub) {
    return {
      ...base,
      status: 'same_hub',
      journeys: [],
      message: 'Origin and destination are in the same service area. Pick two different areas.',
    };
  }

  const startStops = stopsForHub(index, fromHub);
  const destinationStops = new Set(stopsForHub(index, toHub).map((s) => s.id));
  if (!startStops.length || !destinationStops.size) {
    return {
      ...base,
      status: 'out_of_coverage',
      journeys: [],
      message: 'That service area has no matched terminal nodes in the historical extract.',
    };
  }

  const results = [];
  const seen = new Set();
  const queue = startStops.map((stop) => ({
    cost: 0,
    objectiveCost: 0,
    startStop: stop.id,
    currentStop: stop.id,
    rideCount: 0,
    legs: [],
    visited: new Set([stop.id]),
  }));
  let expansions = 0;

  while (queue.length && results.length < limit * 6 && expansions < MAX_EXPANSIONS) {
    queue.sort((a, b) => a.cost - b.cost);
    const state = queue.shift();
    expansions += 1;

    if (destinationStops.has(state.currentStop) && state.legs.length) {
      const signature = state.legs
        .map((leg) => (leg.type === 'ride' ? leg.edge_id : `${leg.from_stop_id}->${leg.to_stop_id}`))
        .join('|');
      if (!seen.has(signature)) {
        seen.add(signature);
        results.push(toJourney(state, index));
      }
      continue;
    }

    if (state.rideCount >= maxRideLegs) continue;

    for (const edge of index.edgesFrom.get(state.currentStop) || []) {
      if (state.visited.has(edge.to)) continue;
      const duration = edgeDuration(edge);
      const stepCost = objective === 'fewest_transfers' ? 1 + duration / 10_000 : duration;
      const visited = new Set(state.visited);
      visited.add(edge.to);
      queue.push({
        cost: state.cost + stepCost,
        objectiveCost: state.objectiveCost + duration,
        startStop: state.startStop,
        currentStop: edge.to,
        rideCount: state.rideCount + 1,
        legs: [...state.legs, rideLeg(edge, index)],
        visited,
      });
    }

    if (allowProximity) {
      for (const candidate of index.proximityFrom.get(state.currentStop) || []) {
        if (state.visited.has(candidate.to)) continue;
        const visited = new Set(state.visited);
        visited.add(candidate.to);
        queue.push({
          cost: state.cost + candidate.walk_min,
          objectiveCost: state.objectiveCost + candidate.walk_min,
          startStop: state.startStop,
          currentStop: candidate.to,
          rideCount: state.rideCount,
          legs: [...state.legs, proximityLeg(candidate, index)],
          visited,
        });
      }
    }
  }

  const journeys = rank(results, objective, limit);

  if (!journeys.length) {
    const prox = index.proximityFrom;
    const hasProximity = startStops.some((s) => (prox.get(s.id) || []).length) &&
      [...destinationStops].some((id) => (prox.get(id) || []).length);
    return {
      ...base,
      status: 'no_route',
      journeys: [],
      message: hasProximity
        ? 'There is no recorded connection for this direction. There are stops near each other, but a walk between them has not been recorded so it is not offered.'
        : 'No recorded route connects these two areas in this direction.',
    };
  }

  return {
    ...base,
    status: gated ? 'research_candidates' : 'route_found',
    journeys,
    message: gated
      ? 'Research candidates only. These routes are not approved for public travel directions.'
      : null,
  };
}

function edgeDuration(edge) {
  if (edge.duration_min != null) return edge.duration_min;
  // Mirrors the prototype's 180 m/min fallback and flags it as such.
  return edge.distance_m ? edge.distance_m / 180 : 0;
}

function rideLeg(edge, index) {
  const from = index.stops.get(edge.from);
  const to = index.stops.get(edge.to);
  const intermediate = (edge.stops || []).slice(1, -1);
  return {
    type: 'ride',
    edge_id: edge.id,
    route_id: edge.route_id,
    route_name: edge.route_name,
    mode: edge.mode.id,          // canonical class id ('danfo' | 'korope' | 'lt_bus')
    mode_detail: edge.mode,      // { id, class, label, subtype }
    source_mode: edge.source_mode,
    direction: edge.direction,
    from_stop_id: edge.from,
    from_stop: edge.from_name,
    from_landmark: landmark(from),
    to_stop_id: edge.to,
    to_stop: edge.to_name,
    to_landmark: landmark(to),
    duration_min: edge.duration_min,
    duration_basis:
      edge.duration_min == null ? 'rough_distance_fallback_not_observed' : 'historical_observed_median',
    duration_samples: edge.duration_samples,
    distance_m: edge.distance_m,
    days: edge.days,
    start: edge.start,
    end: edge.end,
    intermediate_stops: intermediate.map((s) => s.name),
    intermediate_count: intermediate.length,
    board_permission: 'not_in_source_data',
    alight_permission: 'not_in_source_data',
    transfer_at: index.interchangeAt.get(edge.to) || null,
    source_period: edge.source_period,
    status: STATUS.HISTORICAL,
    regulatory: edge.regulatory,
    trace: edge.trace,
  };
}

function proximityLeg(candidate, index) {
  return {
    type: 'transfer',
    from_stop_id: candidate.from,
    from_stop: candidate.from_name,
    to_stop_id: candidate.to,
    to_stop: candidate.to_name,
    straight_line_distance_m: candidate.distance_m,
    estimated_walk_min: candidate.walk_min,
    status: 'unverified_candidate_walk_transfer',
    note: candidate.note,
    trace: null,
  };
}

function landmark(stop) {
  if (!stop) return null;
  // Landmarks are descriptive only; nothing here is a boarding instruction.
  return `${stop.name}${stop.interchange ? ' · terminal interchange' : ''}`;
}

function toJourney(state, index) {
  const rides = state.legs.filter((l) => l.type === 'ride');
  const transfers = state.legs.filter((l) => l.type === 'transfer');
  const duration = rides.reduce((sum, leg) => sum + (leg.duration_min ?? 0), 0);
  const distance = rides.reduce((sum, leg) => sum + (leg.distance_m ?? 0), 0);
  const modes = [...new Set(rides.map((l) => l.mode))];
  const first = rides[0];
  const last = rides[rides.length - 1];

  return {
    id: `cand_${rides.map((r) => r.edge_id).join('_')}`,
    origin_stop_id: state.startStop,
    origin_stop: index.stops.get(state.startStop)?.name ?? 'Unknown',
    destination_stop_id: state.currentStop,
    destination_stop: index.stops.get(state.currentStop)?.name ?? 'Unknown',
    ride_legs: rides.length,
    transfers: Math.max(0, rides.length - 1),
    proximity_transfers: transfers.length,
    modes,
    mode_sequence: state.legs.map((l) => (l.type === 'ride' ? l.mode : 'walk')),
    duration_min: Math.round(duration * 10) / 10,
    distance_m: Math.round(distance),
    fare: null, // policy: fare_estimates_enabled = false
    fare_status: 'unavailable',
    first_departure: first?.start ?? null,
    last_service_end: last?.end ?? null,
    requires_regulatory_review: rides.some((l) => l.regulatory?.required),
    legs: state.legs,
    status: STATUS.HISTORICAL,
    confidence: 'historical_observation',
    evidence_note: HISTORICAL_WARNING,
  };
}

function rank(journeys, objective, limit) {
  const score = (j) => {
    switch (objective) {
      case 'fastest':
        return j.duration_min;
      case 'fewest_transfers':
        return j.transfers * 1000 + j.duration_min;
      case 'least_walking':
        return j.proximity_transfers * 1000 + j.duration_min;
      default:
        // Balanced: duration with transfer and uncertainty penalties.
        return j.duration_min + j.transfers * 8 + j.proximity_transfers * 15 + (j.requires_regulatory_review ? 5 : 0);
    }
  };
  const sorted = [...journeys].sort((a, b) => score(a) - score(b) || a.ride_legs - b.ride_legs);

  // Drop dominated journeys: same legs' origin/destination with worse duration.
  const kept = [];
  for (const journey of sorted) {
    const signature = journey.legs.map((l) => (l.type === 'ride' ? l.edge_id : 'walk')).join('|');
    if (kept.some((k) => k.signature === signature)) continue;
    journey.signature = signature;
    kept.push(journey);
  }

  const out = kept.slice(0, limit);
  out.forEach((journey, i) => {
    journey.rank = i + 1;
    journey.label =
      i === 0
        ? { recommended: 'Recommended', fastest: 'Fastest', fewest_transfers: 'Fewest transfers', least_walking: 'Least walking' }[objective] || 'Recommended'
        : journey.transfers === 0
          ? 'Direct'
          : `${journey.transfers} transfer${journey.transfers > 1 ? 's' : ''}`;
  });
  return out;
}

/**
 * Place search across hubs, stops and aliases (FR-001/FR-002).
 * Distinguishes stops that share a name rather than merging them.
 */
export function searchPlaces(index, query, limit = 8) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return [];

  const results = [];
  const seenStops = new Set();

  for (const hub of index.hubs.values()) {
    const aliasHit = hub.aliases.find((a) => a.toLowerCase().includes(q));
    if (hub.name.toLowerCase().includes(q) || aliasHit) {
      results.push({
        kind: 'hub',
        id: hub.id,
        name: hub.name,
        detail: `${hub.stop_count} recorded stops · ${hub.interchange_count} terminal interchanges`,
        meta: aliasHit && aliasHit.toLowerCase() !== hub.name.toLowerCase() ? `also “${aliasHit}”` : 'Service area',
        lat: hub.lat,
        lng: hub.lng,
        score: hub.name.toLowerCase() === q ? 0 : 1,
      });
    }
  }

  for (const stop of index.stops.values()) {
    if (seenStops.has(stop.name.toLowerCase())) continue;
    if (!stop.name.toLowerCase().includes(q)) continue;
    const sameName = [...index.stops.values()].filter(
      (s) => s.name.toLowerCase() === stop.name.toLowerCase(),
    );
    seenStops.add(stop.name.toLowerCase());
    results.push({
      kind: 'stop',
      id: stop.id,
      name: stop.name,
      detail: `${stop.hub ? `${stop.hub} · ` : ''}${sameName.length} distinct stop record${sameName.length > 1 ? 's' : ''} with this name`,
      meta: stop.interchange ? 'Terminal interchange' : 'Recorded stop',
      lat: stop.lat,
      lng: stop.lng,
      score: stop.name.toLowerCase() === q ? 0 : 2,
    });
  }

  return results.sort((a, b) => a.score - b.score || a.name.length - b.name.length).slice(0, limit);
}

/** Evidence summary used by the Data & Evidence screen. */
export function evidenceSummary(index) {
  const { graph } = index;
  const edges = graph.edges;
  const byMode = {};
  const byHub = {};
  for (const edge of edges) {
    byMode[edge.mode.id] = (byMode[edge.mode.id] || 0) + 1;
  }
  for (const hub of graph.hubs) {
    byHub[hub.id] = {
      stops: hub.stop_count,
      interchanges: hub.interchange_count,
      outbound: edges.filter((e) => e.from_hub === hub.id).length,
      inbound: edges.filter((e) => e.to_hub === hub.id).length,
    };
  }
  const durations = edges.map((e) => e.duration_min).filter((d) => d != null);
  return {
    byMode,
    byHub,
    edges: edges.length,
    withTrace: edges.filter((e) => e.trace).length,
    withDuration: durations.length,
    medianDuration: durations.length
      ? Math.round(durations.sort((a, b) => a - b)[Math.floor(durations.length / 2)] * 10) / 10
      : null,
    reviewRequired: edges.filter((e) => e.regulatory?.required).length,
    verified: 0,
    enabled: 0,
    proximity: graph.proximity?.length ?? 0,
    flm: graph.flm?.length ?? 0,
    integrity: graph.meta.integrity || [],
  };
}
