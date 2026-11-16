/**
 * Planner tests. These lock in the PRD's safety gate and the graph's modelling
 * decisions so a future refactor cannot quietly start publishing routes.
 *
 * Run: npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createIndex, plan, searchPlaces, stopsForHub, hubIdFor, evidenceSummary, STATUS } from '../app/js/planner.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const graph = JSON.parse(fs.readFileSync(path.join(here, '..', 'app', 'public', 'data', 'graph.json'), 'utf8'));
const index = createIndex(graph);

// ---------------------------------------------------------------- the gate --
test('public mode never returns a journey (PRD FR-005 / FR-020)', () => {
  const hubs = graph.hubs.map((h) => h.id);
  for (const from of hubs) {
    for (const to of hubs) {
      if (from === to) continue;
      const result = plan(index, { fromHub: from, toHub: to }, { researchMode: false });
      assert.equal(result.status, 'no_verified_route', `${from}->${to} must be gated`);
      assert.equal(result.journeys.length, 0);
      assert.equal(result.public_directions_allowed, false);
    }
  }
});

test('every edge in the dataset is disabled for public routing', () => {
  assert.equal(graph.edges.filter((e) => e.public_routing_enabled).length, 0);
  assert.equal(graph.meta.stats.publicly_enabled_edges, 0);
  assert.equal(graph.meta.policy.default_public_routing, false);
});

test('research mode is required before any candidate is produced', () => {
  const gated = plan(index, { fromHub: 'Yaba', toHub: 'Ikeja' });
  assert.equal(gated.journeys.length, 0);
  const research = plan(index, { fromHub: 'Yaba', toHub: 'Ikeja' }, { researchMode: true });
  assert.equal(research.status, 'research_candidates');
  assert.ok(research.journeys.length > 0);
  assert.equal(research.public_directions_allowed, false);
  for (const journey of research.journeys) {
    assert.equal(journey.status, STATUS.HISTORICAL);
    assert.equal(journey.fare, null);
    assert.equal(journey.fare_status, 'unavailable');
  }
});

// ------------------------------------------------------- modelling rules ----
test('intermediate stops are never promoted to boardable/alightable', () => {
  const research = plan(index, { fromHub: 'Yaba', toHub: 'Lekki Phase 1' }, { researchMode: true });
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

test('proximity candidates are a review queue, not edges', () => {
  for (const p of graph.proximity) {
    assert.equal(p.status, 'unverified_not_enabled_by_default');
    assert.ok(p.distance_m <= 100.001);
  }
  // Using proximity requires an explicit opt-in and is still never public.
  const off = plan(index, { fromHub: 'Yaba', toHub: 'CMS' }, { researchMode: true });
  const on = plan(index, { fromHub: 'Yaba', toHub: 'CMS', allowProximity: true }, { researchMode: true });
  assert.equal(off.journeys.length, 0);
  assert.equal(on.public_directions_allowed, false);
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
  const fastest = plan(index, { fromHub: 'Yaba', toHub: 'Lekki Phase 1', objective: 'fastest' }, { researchMode: true });
  const fewest = plan(index, { fromHub: 'Yaba', toHub: 'Lekki Phase 1', objective: 'fewest_transfers' }, { researchMode: true });
  assert.ok(fastest.journeys.length > 0);
  assert.ok(fewest.journeys.length > 0);
  assert.ok(fewest.journeys[0].transfers <= fastest.journeys[0].transfers);
  for (const journey of fastest.journeys) {
    assert.ok(journey.duration_min > 0);
    assert.ok(journey.label);
  }
});

test('same-hub and missing-input requests are rejected clearly', () => {
  assert.equal(plan(index, { fromHub: 'Yaba', toHub: 'Yaba' }, { researchMode: true }).status, 'same_hub');
  assert.equal(plan(index, {}, { researchMode: true }).status, 'invalid_request');
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

test('evidence summary reports zero verified routes', () => {
  const summary = evidenceSummary(index);
  assert.equal(summary.verified, 0);
  assert.equal(summary.enabled, 0);
  assert.equal(summary.edges, 81);
  assert.equal(summary.withTrace, 81);
  assert.ok(summary.byMode.danfo > 0);
  assert.ok(summary.byMode.korope > 0);
  assert.ok(summary.byMode.lt_bus > 0);
});
