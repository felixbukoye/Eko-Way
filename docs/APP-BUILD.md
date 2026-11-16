# Eko Way — Mobile App Build Notes

Implementation record for the app: what was built, which PRD requirements each
part serves, and exactly where the route-publication gate lives in code.

- **PRD:** *Lagos Transit Navigator — Comprehensive PRD v2.0* (26 pp.)
- **Data:** Route Graph v1 research pack (`data/raw/`)
- **Design system:** `design-system/` + `index.html` (v1.0)
- **App:** `app/` (Vite + React 19, no backend)
- **Live:** `npm run dev` → http://localhost:5173
- **Guide:** `npm run guide` → http://localhost:8123

---

## 1. The one rule everything is built around

> PRD p.2 — **CRITICAL ROUTE-DATA RULE**: *“No route from the graph may appear as
> a live passenger instruction until the route, direction, boarding/alighting
> points, transfers, current operating status, legal status and relevant
> estimates have been independently verified and approved.”*

Route Graph v1 ships **81 directed patterns, 194 stops, 11 interchanges,
56 proximity candidates, 8 FLM names — and 0 publicly enabled edges**.

So the app is built as a **verification-aware navigator**:

1. Public mode always returns `status: 'no_verified_route'` with an honest,
   useful explanation plus the evidence for that direction.
2. Research mode (explicit opt-in, warned on every card) shows historical
   candidate chains so the team can plan fieldwork.
3. Nothing in the UI ever renders a candidate as an instruction. The journey
   screen's primary action is literally disabled and labelled
   *“Start guidance (disabled)”*.

This is enforced in one place — `app/js/planner.js`, `plan()` — and locked by
tests: `tests/planner.test.js` iterates all 30 directed hub pairs in public mode
and asserts zero journeys.

---

## 2. Data pipeline

```
data/raw/*                     untouched source pack (README, CSVs, JSON, GeoJSON-derived CSV,
                               prototype planners, PostGIS schema)
scripts/build_graph.py         validation + normalisation + downsample traces
app/public/data/graph.json     344 KB app payload (served static, no network calls)
```

`npm run data` rebuilds the payload. What the build does **not** do:

- it never sets `public_routing_enabled: true`;
- it never merges two stops by name;
- it never assigns a boarding/alighting permission that isn't in the source;
- it never promotes a proximity candidate to a transfer edge;
- it never invents a Keke mode (the source has none).

Modelling decisions carried through from the pack README:

| Source fact | App treatment |
|---|---|
| Node = source `stop_id` | `stops[].id` is the source ID, preserved |
| Edge = deduplicated directed pattern | `edges[]`, one per pattern, direction kept |
| Full stop sequence retained | `edges[].stops[]` with `role` + `permission: not_in_source_data` |
| No intermediate permissions | rendered struck-through, never offered for boarding |
| 11 exact same-stop-ID interchanges | `interchanges[]`, used as the only transfer mechanism |
| 56 proximity candidates < 100 m | review queue in Data → Review queue, off by default |
| 8 LAMATA FLM names | separate list, “no stop IDs, no geometry, service unconfirmed” |
| Fares absent | `fare: null`, UI shows “Fare not available”; cheapest ranking suppressed |
| Durations 2022–23 medians | shown with sample size and labelled *historical observed median* |

The supplied `route trace geometries.csv` is malformed (each row wrapped in a
single pair of quotes, header collapsed to one field), so `build_graph.py` parses
it positionally, keeps one representative trace per edge, and downsamples to ≤64
points. All 81 edges get geometry. Coordinates stay EPSG:4326 `[lng, lat]`.

---

## 3. PRD requirement coverage

### Screens (§8)

| PRD screen | Implementation | Notes |
|---|---|---|
| 1. Home / Search | `screens/Home.jsx` | From/To, use-my-location, swap, recents, service-area note; empty/selected/denied states |
| 2. Location results | `screens/SearchPicker.jsx` | Hubs, stops, aliases; same-name stops listed separately with counts; no-result state |
| 3. Route results | `screens/Results.jsx` | Recommended/Fastest/Fewest transfers/Fewest walks; public gate vs research list |
| 4. Journey detail | `screens/Journey.jsx` | Map + steps synchronised, expandable legs, warnings, evidence table, feedback |
| 5. Map / correction | `RouteMap.jsx` | Own-geometry map, pins, stop selection; no third-party tiles |
| 6. No route / coverage | `Results.jsx` empty state | Distinguishes “no chain”, “proximity only”, “out of coverage” |
| 7. Internal admin | `screens/Data.jsx` (read-only) | Gate, freshness dimensions, review queue, hub pairs; writes are server-side only |
| 8. Data import / QA | `Data.jsx` → integrity + provenance | Import action explains it is an authenticated server operation |

### Functional requirements

| ID | Requirement | Where |
|---|---|---|
| FR-001/002 | Origin & destination selection (search, stop, landmark) | `SearchPicker`, `searchPlaces()` |
| FR-003 | Optional geolocation, denial never blocks | `App.useLocation()` + quiet notice |
| FR-004 | Lagos coverage gate | nearest-hub snap with 25 km cutoff |
| FR-005 | Only verified, enabled variants produce routes | `plan()` gate (tests) |
| FR-006 | Directional handling | edges searched only from `edgesFrom` |
| FR-007 | Mode separation | `MODE_MAP` in the builder; `mode` vs `source_mode` kept on every edge |
| FR-008/009 | Board/alight points per leg | leg card names both stops and marks permissions unverified |
| FR-010 | Transfers only via validated interchange | exact same-stop-ID only; proximity opt-in and labelled |
| FR-011 | Intermediate stops not boardable | struck-through chips + caption |
| FR-012 | Non-dominated alternatives | `rank()` de-duplicates by leg signature |
| FR-013/014/015 | Fastest / fewest transfers / cheapest | objectives live; cheapest suppressed (no fares) |
| FR-016 | Fare ranges or unavailable | “Fare not available” everywhere |
| FR-017 | Separate observed vs estimated duration | `duration_basis` per leg |
| FR-018 | Map sync with itinerary | selecting a leg highlights its trace; selecting a stop shows context |
| FR-019 | Freshness metadata | evidence tables, source period, sample counts |
| FR-020 | No invented routes | gate + no LLM/geocoder fallback |
| FR-022 | Local recent-search history | `localStorage` `ekoway.recents.v1`, clearable |
| FR-023 | “Was this useful?” signal only | Journey footer buttons, explicitly non-editing |
| FR-026 | Provenance retained | `source_period`, `edge_id`, `source_mode`, `meta.policy` |
| FR-027 | Legal eligibility | regulatory flags surfaced on cards and legs |

### Non-functional (§19)

- **Mobile-first**, one-handed: primary CTA in the bottom third, 44–48 px targets.
- **Accessibility**: semantic headings, `aria-expanded` on legs, `role="switch"`
  toggles, visible focus rings, text itinerary independent of the map, contrast
  from the design system's audited pairs.
- **Privacy**: location only on tap, snapped to a hub, never stored; recents
  device-local only.
- **Reliability**: no provider dependency — map is drawn from our own geometry,
  so a vendor outage cannot blank the itinerary.
- **Performance**: 344 KB payload, no tile requests, one static fetch.

---

## 4. Design-system conformance

The app consumes `design-system/tokens.css` and `components.css` directly — the
same files the style guide renders. Additions are additive only and built from
existing tokens:

| New class | Built from |
|---|---|
| `.journey`, `.leg`, `.place-picker`, `.statbox`, `.matrix` | existing card/chip/list/typography tokens |
| `.map-canvas` | `--map-*` tokens (same palette as the guide's map language) |
| `.sheet-panel`, `.toast` | `--shadow-sheet`, `--radius-2xl`, `--z-*` |
| `.mode-pill--danfo/korope/lt_bus` | `--yellow-100`, `--blue-100`, `--green-100` |

One token was **not** invented: an early 15px step was replaced with the existing
`--text-16`. `npm run build` is the check — any hard-coded colour would show up in
review.

---

## 5. Testing

```
npm test        19 planner/dataset tests
npm run build   production build
```

Coverage highlights:

- gate holds for all 30 directed pairs in public mode;
- every edge is `public_routing_enabled: false`;
- intermediate stops are never boardable;
- no Keke mode exists; Danfo/Korope/LT Bus never merge;
- same-name stops stay distinct;
- proximity requires opt-in and still never goes public;
- hub-pair matrix reproduces the research summary (23 / 4 / 3);
- all trace coordinates fall inside Lagos bounds;
- objectives rank deterministically.

Screens were additionally rendered headlessly through `react-dom/server` in each
state (public gate, research list, research empty, proximity-flagged, journey
detail with an open leg) to catch runtime errors without a browser.

---

## 6. What is deliberately not built

| Item | Why |
|---|---|
| Live arrival predictions | `current_arrival_predictions_enabled: false` |
| Fare estimates | `fare_estimates_enabled: false` |
| Keke routing | Not in the dataset; needs separate acquisition + legal review |
| FLM routing | Corridor names only — no stop IDs or geometry |
| Community submissions | Out of MVP scope (§5.4) |
| Authenticated admin writes | Belongs to the Next.js/PostGIS service, not the client |
| Third-party map tiles | Data-rights and provider-dependence risk (§17, §22) |

## 7. Path to enabling real routes

1. Field-verify one corridor in one direction (the app's hub-pair matrix and
   evidence tables are the worklist).
2. Record `board_allowed` / `alight_allowed` per stop, transfer walk geometry,
   operating windows, legal note and a reviewer sign-off.
3. Publish those records server-side; the client already renders
   `verified` status, freshness dates and a working “Start guidance” path once
   `plan()` stops short-circuiting.
4. Flip the gate for that corridor only — the planner's eligibility filter is the
   single switch.
