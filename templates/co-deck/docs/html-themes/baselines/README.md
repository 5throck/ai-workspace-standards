# Visual Regression Baselines

Reference screenshots for theme×style combinations, used by the visual regression test suite to detect unintended visual changes.

## Structure

```
baselines/
├── outline/         academic, classic, minimal, premium-dark, visual-heavy, white-bubble
├── outlook/         academic, classic, minimal, premium-dark, visual-heavy, white-bubble
├── pitch/           classic, minimal, premium-dark, white-bubble
├── pitch-enhanced/  academic, classic, minimal, premium-dark, white-bubble
├── vertical/        academic, classic, minimal, premium-dark, visual-heavy, white-bubble
└── zen/             academic, classic, minimal, premium-dark, white-bubble
```

32 theme×style pairs, 64 PNGs. Each `theme/style/` directory contains:
- `slide-1.png` — cover slide screenshot
- `slide-2.png` — standard content slide screenshot

Pairs are derived automatically from each theme's `theme.json` (partial and incompatible pairs are excluded). Only `slide-*.png` files belong here.

## Running Tests

```bash
# Compare screenshots against baselines
bun run test:visual

# Update/overwrite all baselines with fresh captures
bun run test:visual:update

# Or equivalently (environment variable approach):
UPDATE_BASELINES=1 bun test scripts/co-deck/tests/theme-visual-regression.test.ts
```

## Configuration

### Viewport
1280×720 pixels (canonical presentation resolution).

### Animations
Disabled via injected CSS (`animation-duration: 0s`, `transition-duration: 0s`) to ensure deterministic captures.

### Fonts
System default fonts are used (no custom font download). This keeps baselines portable across machines with the same OS family.

### Threshold
Default: **0.5%** of total bytes. Configurable via environment variable:

```bash
VISUAL_THRESHOLD=0.01 bun run test:visual
```

If a comparison exceeds the threshold, the pair is re-captured once (load-jitter retry, browser script v0.2.0). A fresh screenshot that still exceeds the threshold is saved under the transient `presentations/_smoke_test/vr_fresh/<theme>/<style>/` directory. Diff copies are never stored in `baselines/`.

### Screenshot Timing
After navigating to a slide, the test waits for `requestAnimationFrame` + 500ms before capturing, ensuring CSS transitions and layout have settled.

## Environment Notes

- Baselines are **environment-specific** — they depend on system fonts, rendering engine version (Chromium), and OS.
- Baselines were regenerated on 2026-11-11 on macOS arm64 with Playwright **1.63.0** (`chromium-1243`) — the template pins `playwright` to the exact version so template and project captures use the same browser build.
- If baselines are regenerated on a different OS or with a different Chromium version, they will differ from the originals.
- For CI environments, generate baselines on the same platform used in CI to avoid false positives.

## Adding New Baselines

1. Declare the pairing in the theme's `theme.json` (`compatible_styles`); pairs are derived from it automatically.
2. Run `bun run test:visual:update` to capture baselines for the new pair.
3. Run `bun run test:visual` twice; both runs must report zero failures.
4. Commit the new `slide-*.png` files.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| All tests fail | Chromium version changed | Run `bun run test:visual:update` to regenerate |
| Single pair fails | Intentional visual change | Review diff, then update: `bun run test:visual:update` |
| "Playwright not installed" | Missing optional dep | `bun add -d playwright && bunx playwright install chromium` |
| Baselines auto-created on first run | No existing baseline | Normal behavior — review and commit the generated files |
