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
npm test        # 19 planner + dataset tests
npm run build   # production build to dist/
```

## The idea in one paragraph

The supplied route graph is historical research data (2022–2023) with **every
ride edge disabled for public directions**. Rather than paper over that, the app
is built around it: search and ranking are real, the map is drawn from our own
captured geometries, and the results screen answers honestly —
*“we do not have a verified route for this journey yet”* — with the evidence for
that direction and what would unblock it. Research mode is an explicit opt-in that
shows historical candidate chains, each one labelled as unverified evidence with
its source period and sample size. The journey screen's call to action is
disabled and says so.

## What's in the box

```
app/                     the product
  js/planner.js          gate, graph search, ranking, search  ← the important file
  js/RouteMap.jsx        SVG map of recorded geometry (no third-party tiles)
  js/screens/            Home · SearchPicker · Results · Journey · Data · About
  css/app.css            app shell, built only from design-system tokens
  public/data/graph.json generated payload (344 KB)
data/raw/                untouched Route Graph v1 research pack
scripts/build_graph.py   validation + normalisation + trace downsampling
design-system/           tokens.css · components.css · screens.css (shared with the guide)
docs/DESIGN-SYSTEM.md    the design system spec
docs/APP-BUILD.md        PRD → implementation record, requirement by requirement
tests/planner.test.js    the safety gate, locked down
index.html               the design-system style guide
```

## The gate

`plan()` in `app/js/planner.js` short-circuits to `no_verified_route` unless the
caller explicitly passes `{ researchMode: true }`, and even then it returns
`public_directions_allowed: false`. `tests/planner.test.js` asserts this holds for
all 30 directed hub pairs. Do not “fix” it without verification records.

## Honest limitations

Historical feed only (24 Nov 2022 – 31 Dec 2023). No Keke data. No fares. No live
arrivals. Eight FLM corridor names with no stops or geometry. Proximity
candidates are a review queue, not walk paths. Data rights for public or
commercial redistribution are unresolved.

---

*Eko Way v1.0.0 · Design system v1.0 · Lagos*
