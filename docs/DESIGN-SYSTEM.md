# Eko Way — Design System v1.0

**Consolidated style guide for the Eko Way product.**
Lagos · danfo · BRT · keke · live route search, fares and offline ticketing.

| | |
|---|---|
| Version | 1.0.0 (16 Nov 2026) |
| Canvas | 390 × 844 (iPhone 14/15 logical), Android-first |
| Baseline | WCAG 2.2 AA |
| Sources consolidated | Oja Danfo home/splash, Swayam “Find a Ride”, Fluxi ride-hailing case study, App Store taxi concept board |
| Living guide | `index.html` (open in a browser) |
| Tokens | `styles/tokens.css` (web) · `tokens.json` (Figma / RN / native) |

---

## 1. How this system is built

```
index.html              the living style guide — every token, component and screen
styles/tokens.css       primitive + semantic tokens (CSS custom properties)
styles/components.css   component layer, consumes semantic tokens only
styles/screens.css      screen-library styles (still token-only)
tokens.json             same tokens for Figma variables / React Native / native
docs/DESIGN-SYSTEM.md   this file — rules, rationale, contracts
```

Three rules hold the system together:

1. **Components never touch raw values.** They consume semantic aliases
   (`--bg-brand`, not `--yellow-400`). This is what makes dark mode a token swap
   rather than a redesign.
2. **One source, many outputs.** `tokens.css` and `tokens.json` are mirrors. If a
   value changes, it changes in both.
3. **The guide is the reference.** If an implementation disagrees with the screen
   library in `index.html`, the implementation is wrong.

---

## 2. Brand foundation

### The promise
*Know your way before you move.* Every screen answers one of three questions:
**where is it**, **what does it cost**, **am I on time**.

### Positioning
Eko Way is the passenger's instrument for a transport system that is loud, informal
and constantly rerouting. The interface answers with one high-confidence colour,
hard edges and type that reads in glare and traffic.

### Audience & environment
Daily commuters, students and traders who already read the street. They need speed
and certainty, not hand-holding. Android-first, mid-range devices, patchy data,
bright sun, one thumb, fifteen seconds of attention at a bus stop.

### Six principles

| # | Principle | In practice |
|---|---|---|
| 01 | **Legible in sunlight** | 16px minimum body; every text pairing measured at ≥4.5:1 |
| 02 | **One decision per screen** | A route, a fare, a driver. A second decision becomes a sheet |
| 03 | **Yellow means act** | Brand yellow marks tappable, live or in-motion — never wallpaper |
| 04 | **Numbers are the interface** | Fares, ETAs, stops use tabular display figures so columns align |
| 05 | **Works with no signal** | Cached routes, offline tickets, explicit stale states, no dead ends |
| 06 | **Street, not Silicon Valley** | Painted-signage references, hard shadows, real place names; no glassmorphism |

### Logo
Mark = front-on danfo ticket with a route line, in a rounded square. Lockup =
mark + `Eko Way` in Space Grotesk Bold, −3% tracking.
Clear space 24px (half the mark height) on all sides. Minimum lockup width 120px,
mark alone 24px. Never rotate, re-colour, outline, or place over map/photo.
Inverse lockup for ink surfaces.

---

## 3. Colour

### Ramps
| Ramp | Core | Purpose |
|---|---|---|
| **Eko Yellow** | `#FFD100` | Primary brand, CTAs, active states |
| **Ink** | `#0B0B0A` | Type, inverse surfaces, borders, sticker shadow |
| **Paper** | `#F6F6F2` | Warm surfaces; canvas and cards |
| **Accents** | green / red / orange / blue | Map + status meaning only |

Full ramps (50–900) live in `styles/tokens.css`. Yellow is warm-shifted by hand so
the mid-steps stay in the same family; in. Ink is warm (not pure black) so it sits
with yellow instead of fighting it.

### Semantic mapping (use these, not the ramps)

| Token | Resolves to | Used for |
|---|---|---|
| `--bg-canvas` | paper-200 | App background behind cards |
| `--bg-surface` | paper-50 | Cards, sheets, inputs |
| `--bg-brand` | yellow-400 | Primary CTA fill, brand screens, active tab |
| `--bg-brand-soft` | yellow-100 | Selected fare row, icon plates |
| `--bg-inverse` | ink-900 | Splash, confirmation screen, sticker shadow |
| `--text-primary` | ink-900 | Headings and body |
| `--text-secondary` | ink-500 | Supporting copy, labels, meta |
| `--text-tertiary` | `#6A6A64` | Placeholders and hints — the readable floor |
| `--text-brand` | `#7A6200` | Brand-coloured **text** |
| `--border-control` | ink-350 | Input outlines that must clear 3:1 |
| `--border-strong` | ink-900 | Sticker tiles, outlined buttons, selected fare |

### Contrast — measured, not assumed

| Pairing | Ratio | Verdict |
|---|---|---|
| Ink 900 on Yellow 400 | **13.48** | AAA |
| Ink 900 on Paper 50 | **19.69** | AAA |
| Ink 500 on Paper 50 | **7.50** | AAA |
| `#6A6A64` on Paper 50 (tertiary) | **5.44** | AA |
| `#7A6200` on Paper 50 (brand text) | **5.87** | AA |
| Ink 500 on Yellow 400 (placeholder) | **5.14** | AA |
| Ink 350 on Paper 50 (control edge, non-text) | **3.66** | AA non-text |
| Ink 400 on Paper 50 | **4.32** | Large text only |
| Yellow 600 on Paper 50 | **2.13** | Fails — never text |
| White on Yellow 400 | **1.46** | Fails — never |

**The three hard rules**
1. Ink on yellow. White text on yellow is forbidden.
2. Yellow 400 is never text. Use `--text-brand` (`#7A6200`) for brand-coloured words.
3. One yellow surface per screen, reserved for the thing you want tapped.

### Map palette
Deliberately near-grey (`--map-land #F4F4EF`, `--map-water #CFE4F2`,
`--map-park #DCEDD6`, roads white with `#E7E7E0` casing) so the only saturated
things on screen are the yellow stop pin, live vehicles and the blue user dot.

### Dark theme
Tokens already exist under `[data-theme="dark"]`: canvas `#0B0B0A`, surface
`#141413`, text `#FAFAF7` / `#B4B4AC`, and the sticker shadow flips to brand
yellow. Shipping it is a v1.1 milestone, not a redesign.

---

## 4. Typography

Two families, one voice.

- **Space Grotesk** — display, screen titles, all numerals. Squared terminals echo
  painted signage and read at a glance.
- **Inter** — everything you read rather than scan.
- **JetBrains Mono** — references, plate numbers, ticket IDs.

| Style | Size / line / tracking | Weight | Use |
|---|---|---|---|
| display | 48 / 1.08 / −3% | 700 | Marketing, guide hero |
| hero | 38 / 1.08 / −3% | 700 | Screen hero lines |
| h1 | 30 / 1.24 / −1.5% | 700 | Page titles |
| h2 | 24 / 1.24 | 700 | Screen titles |
| h3 | 20 / 1.24 | 600 | Section titles |
| h4 | 18 / 1.24 | 600 | Card titles |
| body | 16 / 1.45 | 400 | Body copy, inputs |
| body-sm | 14 / 1.45 | 400 | Dense rows, secondary |
| caption | 12 / 1.45 | 400 | Meta, hints |
| eyebrow | 11 / 1.45 / +8% caps | 700 | Labels above values |
| mono | 14 | 400 | Plates, references |
| numeric | inherits | 700 | **Always tabular** |

Rules: 16px minimum for readable text; lines under 70 characters;
`text-wrap: balance` on headlines; no faux bold; no all-caps sentences;
never proportional figures in a column of fares.

---

## 5. Space & layout

4pt grid. Related items ≤8px apart; groups 16px; sections ≥32px. If a gap isn't a
token, it isn't a gap.

| Token | px | Typical use |
|---|---|---|
| `--space-1` | 4 | icon ↔ label |
| `--space-2` | 8 | inside chips, tight stacks |
| `--space-3` | 12 | list-row internals |
| `--space-4` | 16 | screen gutter, card padding |
| `--space-5` | 20 | button horizontal padding |
| `--space-6` | 24 | between field groups |
| `--space-8` | 32 | between sections |

**App shell vertical rhythm**

```
54px   status bar        content never sits inside it
64px   header            greeting + location chip (sticky)
 —     body              scrolls, 16px side gutter
 —     sheet / CTA       pinned above tab bar, 24px bottom inset
78px   tab bar           + safe-area inset
```

**Responsive rules**: ≤360px → gutter 12px, tiles 1-up · 390–430px → reference
layout · ≥768px → the 390px frame is centred on a neutral canvas (product screens
do not fluidly re-flow) · map is always full-bleed, sheets overlay it.

---

## 6. Shape & elevation

| Token | Value | Use |
|---|---|---|
| `--radius-xs` | 6 | Tags, plates |
| `--radius-sm` | 10 | Media plates, small cards |
| `--radius-md` | 14 | Inputs, fare rows, tiles |
| `--radius-lg` | 20 | Cards, route block, map |
| `--radius-2xl` | 36 | Bottom sheets (top corners) |
| `--radius-pill` | 999 | Buttons, chips, search bar |

Shadows are soft and warm-tinted: `xs` card at rest, `md` map pins and popovers,
`lg` floating search card, `sheet` for bottom sheets and the tab bar.

**The sticker shadow** — `4px 4px 0 #0B0B0A` — is the one hard edge in the system.
Hero service tiles only, at most twice per screen. Never on buttons, inputs, sheets
or scrolling content. On dark surfaces it flips to brand yellow.

---

## 7. Motion

Short and decisive, like a bus pulling in. Nothing over 380ms in-product.

| Token | Value | Use |
|---|---|---|
| `--duration-instant` | 90ms | Press feedback |
| `--duration-fast` | 160ms | Colour, opacity, tab cross-fade |
| `--duration-base` | 220ms | Default transitions |
| `--duration-slow` | 320ms | Map recentre, confirmations |
| `--duration-sheet` | 380ms | Bottom sheet entry |

| Easing | Value | Use |
|---|---|---|
| `--ease-standard` | cubic-bezier(.2,0,0,1) | Default |
| `--ease-out` | cubic-bezier(.16,1,.3,1) | Entrances, camera moves |
| `--ease-spring` | cubic-bezier(.34,1.4,.64,1) | Confirmations **only** |

Press feedback = `translateY(1px)` + `scale(.995)` — tactile, never colour-only.
Under `prefers-reduced-motion: reduce` all durations resolve to 0ms via the tokens.

---

## 8. Iconography

One open-stroke family on a 24px grid, 1.8–2px strokes, round caps and joins.
Fill only where a state needs weight (active tab, stop pin, rating star).
Sizes: 16 in chips and meta, 20 in rows, 24 in nav and headers, 34 on service
tiles. Icons are decorative unless they are the *only* label — then they carry an
accessible name. The sprite lives at the top of `index.html` (24 symbols).

---

## 9. Components

Every component is documented and rendered live in `index.html`. Summary of the
contracts:

| Component | Class | Contract |
|---|---|---|
| Button | `.btn--primary / secondary / outline / ghost / danger` | Pills, min 48px, one primary per screen |
| Search bar | `.searchbar` | Yellow pill, ink text; placeholder is ink 62% (5.14:1) |
| Route block | `.route` | Pickup dot (yellow + halo) → dashed rail → drop dot (ink); trailing add/swap 44px |
| Chips | `.chip--outline / --selected / --brand` | 36px tall, interactive filters |
| Tags | `.tag--success / danger / warning / info / neutral / brand` | Read-only facts |
| Cards | `.card`, `.card--ink`, `.card--flat` | Containers: 1.5px edge, 20px radius, soft shadow |
| Tiles | `.tile`, `.tile--ghost` | Actions: yellow, 2px ink border, sticker shadow |
| List rows | `.list__row` | 64px min, 40px media plate, 2-line label, trailing value |
| Fare tiers | `.fare`, `.fare--selected` | Whole row is the target; selection = border **and** tint |
| Map | `.map`, `.map__pin`, `.map__car` | Low-chroma base, saturated markers only |
| Tab bar | `.tabbar` | 4 fixed tabs; active = ink + 18×3px yellow underline |
| Sheet | `.sheet` | 36px top radius, handle, holds the decision |
| Alerts | `.alert--success / danger / warning / info` | Left rule in the status colour |
| Feedback | `.skeleton`, `.spinner`, `.live` | Four states per screen: loading, empty, error, offline |

**Cards hold information; tiles take you somewhere.** That distinction is the
quickest way to tell whether a new element is right.

---

## 10. Screen library (canonical)

All ten screens are rebuilt from tokens in `index.html` → *Screen library*.

| # | Screen | Notes |
|---|---|---|
| 01 | Splash | Brand field, mark only. Max 1.2s, skip on cache hit |
| 02 | Onboarding | 3 panels max, one idea each, Skip always visible |
| 03 | Home | Yellow hero holds greeting + search only; everything below is paper |
| 04 | Live tracking | Full-bleed map, floating search card, decision in the sheet |
| 05 | Route detail | Stops as a timeline; boarding stop filled ink; fare + duration together |
| 06 | Choose fare | Fare first, seat second; unavailable seats dim to 40%, never hidden |
| 07 | Payment | Itemised costs before the CTA; cash is a first-class method |
| 08 | Ticket | Real ticket: perforation, notch cut-outs, QR, works offline |
| 09 | Profile | Grouped settings on paper cards; toggles ink-on-yellow |
| 10 | Confirmation | Ink screen, one badge, one fact. The only loud spring easing |

### Core flows

**A · Catch the next danfo** (primary, 5 taps, target 45s)
Home → search or Nearby stop → map with live vehicles → tap vehicle → sheet with
ETA/fare/seats → Book this seat → choose fare → pay → ticket saved offline.
Failure path: cash reserve, no card required.

**B · Plan a journey**
Route block (from → to) → compare modes via chips → stop-by-stop timeline with
traffic → select seats → same checkout. Fare and duration are never shown apart.

**C · Travel with no data** (critical)
Offline banner states cache time → saved routes resolve from cache → tickets open
from local storage with QR rendering offline → queued bookings explain themselves.
No dead ends.

---

## 11. Content & voice

A well-informed friend who knows the road — not a company. Short sentences, real
place names, no exclamation marks.

- **Clear** — one idea per sentence, plain words over jargon.
- **Local** — danfo, keke, conductor, stand, along. Use the words people use.
- **Calm** — a delay is stated, not dramatised.
- **Honest** — if a number is an estimate, say “approx.”.

**Formats**: `₦650` (symbol, no decimals, tabular) · `08:42` · `6 min`, never
`0h 6m`.

| Pattern | Rule |
|---|---|
| Button | Verb + object: “Book this seat” |
| Empty | State + next step: “No tickets yet — book a seat…” |
| Error | What happened + what to do: “Payment failed. Try another method.” |

**Say / don't say**

| ✓ | ✕ |
|---|---|
| “Danfo leaves when it fills.” | “Vehicle departure is demand-based.” |
| “You're offline. Showing routes saved at 08:12.” | “Network error (E_NET_004).” |
| “4 seats left” | “Hurry! Only a few spots!!” |

---

## 12. Accessibility (WCAG 2.2 AA floor)

- **Colour** — body ≥4.5:1, large ≥3:1, controls/focus ≥3:1. State is never
  colour-only: pair with label, icon, border or weight.
- **Touch** — 44×44 minimum (48 preferred), 8px between targets, primary CTA in
  the bottom third, no gesture-only actions.
- **Type** — 16px minimum on mobile, survives 200% zoom without clipping, no text
  inside images.
- **Motion** — reduced-motion zeroes durations; the live pulse stops on stale data;
  nothing flashes more than 3×/second.
- **Screen readers** — tabs announce `aria-selected`, sheets trap focus and close on
  Escape, fare/ETA updates announce politely.
- **Environment** — contrasts hold at full brightness in sun; offline states never
  pretend to be live; no blur above 6px, no continuous map animation on low-end
  devices.

---

## 13. Handoff

```
tokens.css  → CSS custom properties   (web)
tokens.json → Figma variables, RN theme, iOS/Android resource generation
```

Naming contract:

```
--{category}-{role}-{step}
--yellow-400     raw ramp        (never in components)
--bg-brand       semantic alias  (use this)
--text-secondary
--space-4
--radius-lg
--duration-base
```

**Definition of done for any new component or screen**
1. No hard-coded hex, colour px or font size.
2. All four states designed: default, loading, empty, error.
3. Contrast verified, focus visible, targets ≥44px.
4. Reduced motion and 200% zoom checked.
5. Copy reviewed against the voice rules.

### Out of scope for v1
Dark mode (tokens staged) · driver app · tablet/desktop layouts · illustration
system · admin data-viz · Yoruba/Pidgin localisation.

---

*Eko Way Design System v1.0.0 · 16 November 2026 · Lagos*
