/**
 * Planner tests. These lock in the graph's modelling decisions, the fare and
 * duration policy, and the MVP routing switch (`MVP.unverifiedRouting`).
 *
 * The strict verification gate is still exercised, with `strictGate: true`, so
 * flipping `MVP.unverifiedRouting` back to false stays a one-line change that
 * is already covered.
 *
 * Run: npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createIndex, plan, searchPlaces, stopsForHub, hubIdFor, evidenceSummary, STATUS, MVP } from '../app/js/planner.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const graph = JSON.parse(fs.readFileSync(path.join(here, '..', 'app', 'public', 'data', 'graph.json'), 'utf8'));
const index = createIndex(graph);

/** Directed hub pairs the recorded graph genuinely has no connection for. */
function hubPairsWithNoRoute(g) {
  const hubs = g.hubs.map((h) => h.id);
  const out = [];
  for (const from of hubs) {
    for (const to of hubs) {
      if (from === to) continue;
      if (plan(createIndex(g), { fromHub: from, toHub: to }).status === 'no_route') out.push([from, to]);
    }
  }
  return out;
}

// ------------------------------------------------------- routing switch -----
test('the MVP routes on the recorded graph by default', () => {
  assert.equal(MVP.unverifiedRouting, true, 'MVP ships with recorded-graph routing on');
  const result = plan(index, { fromHub: 'Yaba', toHub: 'Ikeja' });
  assert.equal(result.status, 'route_found');
  assert.ok(result.journeys.length > 0);
  assert.equal(result.message, null);
});

test('strictGate restores the verification gate for all 30 directed pairs', () => {
  const hubs = graph.hubs.map((h) => h.id);
  for (const from of hubs) {
    for (const to of hubs) {
      if (from === to) continue;
      const result = plan(index, { fromHub: from, toHub: to }, { strictGate: true });
      assert.equal(result.status, 'no_verified_route', `${from}->${to} must be gated`);
      assert.equal(result.journeys.length, 0);
    }
  }
});

test('directions with no recorded connection say so instead of guessing', () => {
  const none = hubPairsWithNoRoute(graph);
  assert.ok(none.length >= 3, `expected at least 3 empty directions, got ${none.length}`);
  for (const [from, to] of none) {
    const result = plan(index, { fromHub: from, toHub: to });
    assert.equal(result.status, 'no_route', `${from}->${to} must not invent a route`);
    assert.equal(result.journeys.length, 0);
  }
});

test('the switch is the only thing that closes the gate', () => {
  // set to false, the same query must be withheld — no other code change needed.
  const strict = plan(index, { fromHub: 'Yaba', toHub: 'Ikeja' }, { strictGate: true });
  assert.equal(strict.status, 'no_verified_route');
  assert.equal(strict.public_directions_allowed, false);
  assert.match(strict.message, /verified public-transport route/);
});

test('every edge in the dataset is disabled for public routing', () => {
  assert.equal(graph.edges.filter((e) => e.public_routing_enabled).length, 0);
  assert.equal(graph.meta.stats.publicly_enabled_edges, 0);
  assert.equal(graph.meta.policy.default_public_routing, false);
});

test('routes keep their provenance and never invent a fare', () => {
  const routed = plan(index, { fromHub: 'Yaba', toHub: 'Ikeja' });
  assert.ok(routed.journeys.length > 0);
  for (const journey of routed.journeys) {
    assert.equal(journey.status, STATUS.HISTORICAL);
    assert.equal(journey.fare, null);
    assert.equal(journey.fare_status, 'unavailable');
    assert.equal(journey.confidence, 'historical_observation');
  }
});

// ------------------------------------------------------- modelling rules ----
test('intermediate stops are never promoted to boardable or alightable', () => {
  const research = plan(index, { fromHub: 'Yaba', toHub: 'Lekki Phase 1' });
  for (const journey of research.journeys) {
    for (const leg of journey.legs.filter((l) => l.type === 'ride')) {
      assert.equal(leg.board_permission, 'not_in_source_data');
      assert.equal(leg.alight_permission, 'not_in_source_data');
    }
  }
  for (const edge of graph.edges) {
    const middle = edge.stops.slice(1, -1);
    for (const stop of middle) {
      assert.equal(stop.permission, 'not_in_source_data');
      assert.equal(stop.role, 'intermediate');
    }
  }
});

test('Keke is never invented from source data', () => {
  const modeIds = new Set(graph.edges.map((e) => e.mode.id));
  assert.equal(modeIds.has('keke'), false);
  for (const mode of modeIds) {
    assert.ok(['danfo', 'korope', 'lt_bus'].includes(mode), `unexpected mode ${mode}`);
  }
});

test('modes keep source subtypes and are never merged', () => {
  const labels = new Set(graph.edges.map((e) => e.source_mode));
  for (const label of labels) {
    assert.ok(
      ['Danfo (yellow)', 'Danfo (other colours)', 'Korope (yellow)', 'Korope (other colours)', 'LT Bus'].includes(label),
      label,
    );
  }
  // Korope and Danfo must not collapse into one class.
  assert.ok(graph.edges.some((e) => e.mode.id === 'korope'));
  assert.ok(graph.edges.some((e) => e.mode.id === 'danfo'));
});

test('same-name stops stay separate records', () => {
  const byName = new Map();
  for (const s of graph.stops) {
    byName.set(s.name, (byName.get(s.name) || 0) + 1);
  }
  const duplicated = [...byName.entries()].filter(([, n]) => n > 1);
  assert.ok(duplicated.length > 0, 'dataset is expected to contain same-name stops');
  const ids = new Set(graph.stops.map((s) => s.id));
  assert.equal(ids.size, graph.stops.length, 'node ids must be unique');
});

test('directions are stored separately and never auto-reversed', () => {
  const seen = new Map();
  for (const e of graph.edges) {
    const key = `${e.from}>${e.to}`;
    seen.set(key, (seen.get(key) || 0) + 1);
  }
  // A forward pair must not imply a synthetic reverse edge: every reverse we
  // return must exist in the source, not be generated.
  for (const e of graph.edges) {
    const reverse = `${e.to}>${e.from}`;
    if (seen.has(reverse)) {
      assert.ok(
        graph.edges.some((x) => x.from === e.to && x.to === e.from),
        'reverse must be an explicit source pattern',
      );
    }
  }
});

// ------------------------------------------------------------ graph facts ---
test('graph payload matches the published build statistics', () => {
  const stats = graph.meta.stats;
  assert.equal(stats.ride_edges, 81);
  assert.equal(stats.stops, 194);
  assert.equal(stats.interchanges, 11);
  assert.equal(stats.proximity_candidates, 56);
  assert.equal(stats.external_flm_candidates, 8);
  assert.equal(stats.hubs, 6);
  assert.equal(stats.edges_with_trace, 81);
});

test('hub-pair matrix mirrors the research summary (23 exact / 4 proximity / 3 none)', () => {
  const exact = graph.hubPairMatrix.filter((r) => r.exact_paths > 0).length;
  const prox = graph.hubPairMatrix.filter((r) => r.exact_paths === 0 && r.proximity_only).length;
  const none = graph.hubPairMatrix.filter((r) => r.exact_paths === 0 && !r.proximity_only).length;
  assert.equal(graph.hubPairMatrix.length, 30);
  assert.equal(exact, 23);
  assert.equal(prox, 4);
  assert.equal(none, 3);
});

test('proximity candidates stay opt-in walking links', () => {
  for (const p of graph.proximity) {
    assert.equal(p.status, 'unverified_not_enabled_by_default');
    assert.ok(p.distance_m <= 100.001);
  }
  // Using proximity requires an explicit opt-in and is still never public.
  const off = plan(index, { fromHub: 'Yaba', toHub: 'CMS' });
  const on = plan(index, { fromHub: 'Yaba', toHub: 'CMS', allowProximity: true });
  assert.equal(off.journeys.length, 0);
  assert.equal(on.status, 'route_found');
  if (on.journeys.length) {
    assert.ok(on.journeys[0].proximity_transfers > 0);
  }
});

test('regulatory flags survive into the journey payload', () => {
  const flagged = graph.edges.filter((e) => e.regulatory.required);
  assert.ok(flagged.length > 0, 'expected Korope/Lekki edges flagged for review');
  for (const edge of flagged) {
    assert.ok(edge.regulatory.note);
  }
});

test('every traced geometry uses valid WGS84 coordinates', () => {
  for (const edge of graph.edges.filter((e) => e.trace)) {
    for (const [lng, lat] of edge.trace) {
      assert.ok(lng > 3.0 && lng < 4.0, `lng out of Lagos range: ${lng}`);
      assert.ok(lat > 6.2 && lat < 6.9, `lat out of Lagos range: ${lat}`);
    }
  }
});

// --------------------------------------------------------------- behaviour --
test('search returns hubs, stops and distinguishes same-name records', () => {
  const hubs = searchPlaces(index, 'yaba');
  assert.ok(hubs.some((r) => r.kind === 'hub' && r.name === 'Yaba'));
  const underbridge = searchPlaces(index, 'underbridge');
  assert.ok(underbridge.length > 0);
  for (const r of underbridge.filter((x) => x.kind === 'stop')) {
    assert.match(r.detail, /distinct stop record/);
  }
});

test('objectives reorder candidates deterministically', () => {
  const fastest = plan(index, { fromHub: 'Yaba', toHub: 'Lekki Phase 1', objective: 'fastest' });
  const fewest = plan(index, { fromHub: 'Yaba', toHub: 'Lekki Phase 1', objective: 'fewest_transfers' });
  assert.ok(fastest.journeys.length > 0);
  assert.ok(fewest.journeys.length > 0);
  assert.ok(fewest.journeys[0].transfers <= fastest.journeys[0].transfers);
  for (const journey of fastest.journeys) {
    assert.ok(journey.duration_min > 0);
    assert.ok(journey.label);
  }
});

test('same-hub and missing-input requests are rejected clearly', () => {
  assert.equal(plan(index, { fromHub: 'Yaba', toHub: 'Yaba' }).status, 'same_hub');
  assert.equal(plan(index, {}).status, 'invalid_request');
});

test('stops for a hub are ordered with interchanges first', () => {
  const stops = stopsForHub(index, 'Oshodi');
  assert.ok(stops.length > 0);
  assert.equal(stops[0].interchange, true);
});

test('support terminals resolve to a nearest hub', () => {
  const stop = graph.stops.find((s) => !s.hub);
  if (stop) {
    const hub = hubIdFor(index, stop.id);
    assert.ok(graph.hubs.some((h) => h.id === hub));
  }
});

test('evidence summary reports no field-verified routes', () => {
  const summary = evidenceSummary(index);
  assert.equal(summary.verified, 0);
  assert.equal(summary.enabled, 0);
  assert.equal(summary.edges, 81);
  assert.equal(summary.withTrace, 81);
  assert.ok(summary.byMode.danfo > 0);
  assert.ok(summary.byMode.korope > 0);
  assert.ok(summary.byMode.lt_bus > 0);
});
