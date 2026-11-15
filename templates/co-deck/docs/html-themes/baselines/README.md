# Visual Regression Baselines

Reference screenshots for theme×style combinations, used by the visual regression test suite to detect unintended visual changes.

## Structure

```
baselines/
├── outline/
│   ├── classic/          slide-1.png, slide-2.png
│   ├── minimal/
│   ├── premium-dark/
│   ├── academic/
│   └── visual-heavy/
├── pitch/
│   ├── classic/
│   ├── minimal/
│   └── premium-dark/
├── pitch-enhanced/
│   ├── classic/
│   ├── minimal/
│   ├── premium-dark/
│   └── academic/
├── vertical/
│   ├── classic/
│   ├── minimal/
│   ├── premium-dark/
│   ├── academic/
│   └── visual-heavy/
└── zen/
    ├── classic/
    ├── minimal/
    ├── premium-dark/
    └── academic/
```

Each `theme/style/` directory contains:
- `slide-1.png` — cover slide screenshot
- `slide-2.png` — standard content slide screenshot

Only **fully compatible** theme×style pairs have baselines. Partial and incompatible pairs are excluded.

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

If a comparison exceeds the threshold, the fresh screenshot is saved as `diff-slide-N.png` in the baseline directory.

### Screenshot Timing
After navigating to a slide, the test waits for `requestAnimationFrame` + 500ms before capturing, ensuring CSS transitions and layout have settled.

## Environment Notes

- Baselines are **environment-specific** — they depend on system fonts, rendering engine version (Chromium), and OS.
- Baselines were generated on Windows with Playwright's bundled Chromium.
- If baselines are regenerated on a different OS or with a different Chromium version, they will differ from the originals.
- For CI environments, generate baselines on the same platform used in CI to avoid false positives.

## Adding New Baselines

### For a new theme/style combination

1. Add the theme and style to the `FULLY_COMPATIBLE_PAIRS` array in
   `scripts/co-deck/tests/theme-visual-regression.test.ts`
2. Run `bun run test:visual:update` to capture baselines for the new pair
3. Commit the new PNG files

### For a new theme

1. Ensure the theme's `theme.json` declares `compatible_styles`
2. Add all fully compatible pairs to the test's pair list
3. Capture baselines with `bun run test:visual:update`
4. Commit

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| All tests fail | Chromium version changed | Run `bun run test:visual:update` to regenerate |
| Single pair fails | Intentional visual change | Review diff, then update: `bun run test:visual:update` |
| "Playwright not installed" | Missing optional dep | `bun add -d playwright && bunx playwright install chromium` |
| Baselines auto-created on first run | No existing baseline | Normal behavior — review and commit the generated files |
