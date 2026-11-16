# Eko Way

**A Lagos public-transport navigator that refuses to guess.**

Built from the *Lagos Transit Navigator Comprehensive PRD v2.0* and the
*Route Graph v1* research dataset, on the Eko Way design system.

| | |
|---|---|
| **App** | Vite + React 19, mobile-first, no account, no backend |
| **Data** | 81 directed route patterns · 194 stops · 11 interchanges · 81 captured traces |
| **Public routes enabled** | **0** — by design, per the PRD's route-data rule |
| **Design system** | `design-system/` · living guide at `index.html` |

## Run it

```bash
npm install
npm run data    # rebuild app/public/data/graph.json from data/raw/ (optional)
npm run dev     # app  → http://localhost:5173
npm run guide   # style guide → http://localhost:8123
npm test        # 22 planner + dataset tests
npm run build   # production build to dist/
```

## The idea in one paragraph

The supplied route graph is recorded Lagos trips from 2022–2023. For this MVP
the app routes on that graph directly: search, ranking, the SVG map and the
step-by-step itinerary all work off the recorded data. Fares are not in the
dataset, so every screen shows “Fare not available” rather than a number; ride
times are medians of recorded trips. A direction with no recorded connection
gets an explicit no-route state instead of a guessed line.

## What's in the box

```
app/                     the product
  js/planner.js          routing switch, graph search, ranking, place search
  js/RouteMap.jsx        SVG map of recorded geometry (no third-party tiles)
  js/screens/            Home · SearchPicker · Results · Journey · Data · About
  css/app.css            app shell, built only from design-system tokens
  public/data/graph.json generated payload (344 KB)
data/raw/                untouched Route Graph v1 research pack
scripts/build_graph.py   validation + normalisation + trace downsampling
design-system/           tokens.css · components.css · screens.css (shared with the guide)
docs/DESIGN-SYSTEM.md    the design system spec
docs/APP-BUILD.md        PRD → implementation record, requirement by requirement
tests/planner.test.js    routing, fare policy and modelling rules, locked down
index.html               the design-system style guide
```

## The routing switch

`MVP.unverifiedRouting` in `app/js/planner.js` is the single decision point.
It is `true` for the MVP, so `plan()` returns journeys from the recorded graph.
Flip it to `false` and `plan()` short-circuits to `no_verified_route` for every
query, exactly as the PRD specifies — no other code change needed.
`plan(index, query, { strictGate: true })` does the same for one call, which is
how `tests/planner.test.js` keeps the strict path covered.

## Known limitations

Recorded feed only (24 Nov 2022 – 31 Dec 2023), so ride times reflect that
period's traffic. No Keke data. No fares. No live arrivals. Eight FLM corridor
names with no stops or geometry. Walks between nearby stops are opt-in and use
straight-line distance. Data rights for public or commercial redistribution are
unresolved.

---

*Eko Way v1.0.0 · Design system v1.0 · Lagos*
