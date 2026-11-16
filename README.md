# Eko Way

Design system and style guide for **Eko Way** — a Lagos danfo / BRT / keke route
search, live tracking and ticketing product.

## Open the style guide

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

Or just open `index.html` in a browser (fonts load from Google Fonts; everything
else is local).

## What's inside

| Path | What it is |
|---|---|
| `index.html` | The living style guide: brand, colour, type, space, shape, motion, icons, components, ten canonical screens, flows, voice, accessibility, handoff |
| `styles/tokens.css` | Design tokens — primitive ramps + semantic aliases, light and dark |
| `styles/components.css` | Component layer (buttons, inputs, chips, cards, tiles, lists, map, nav, sheet, feedback) |
| `styles/screens.css` | Screen-library styles, built only from tokens |
| `tokens.json` | The same tokens for Figma variables / React Native / native generation |
| `docs/DESIGN-SYSTEM.md` | The written spec: principles, contracts, contrast audit, component rules |

## The three rules

1. Components consume **semantic** tokens (`--bg-brand`), never raw ramp values (`--yellow-400`).
2. `tokens.css` and `tokens.json` are mirrors — change both or neither.
3. If an implementation disagrees with the screen library in `index.html`, the implementation is wrong.

---

*Eko Way Design System v1.0.0 · Lagos*
