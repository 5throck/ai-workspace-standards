# co-design — Component Playground

A minimal Vite dev-server playground wired to the compiled design tokens, for live visual preview during design phases. `design-lead` and `prototype-engineer` use it to verify token-driven styling while iterating on `tokens.json` or component designs; `visual-designer` uses it as the reference rendering of the current palette.

## Quickstart

```bash
cd playground
bun install
bun run dev
```

`bun run dev` recompiles tokens first (`predev` hook), then starts Vite at `http://localhost:5173`.

## How the wiring works

```
../tokens.json              (SSOT — the only file you edit)
      │
      ▼
../../scripts/compile-tokens.ts
      │
      ├──▶ src/generated/tokens.css   :root { --color-primary: ... }
      └──▶ src/generated/tokens.ts    export const tokens / CSS_VARS

src/main.ts  → renders every token group (colors, typography, spacing, radii, shadows)
               from the typed constants; swatches are styled via CSS_VARS so the
               page demonstrates actual var() consumption, not hardcoded values.
```

- Generated outputs are **gitignored** — never commit `src/generated/tokens.{css,ts}`; regenerate with `bun run tokens`.
- The demo page is structure-driven: add a new token group to `tokens.json`, recompile, and a new section renders automatically.
- Theme presets compile to `[data-theme="..."]` blocks after `:root`. To preview a preset, set the attribute on the root element (`<html data-theme="dark">` or `document.documentElement.dataset.theme = "dark"`) — values never change per-component.

## Where it runs

The script paths (`../tokens.json`, `../../scripts/compile-tokens.ts`) assume the **scaffolded project layout**, where this playground sits at `<project>/playground/`, the SSOT at `<project>/tokens.json`, and the compiler (inherited from `templates/common`) at `<project>/scripts/compile-tokens.ts`. Inside the template repository itself the relative depth differs — run the playground in a scaffolded co-design project.

## Extending

- Add component demos (one file per primitive from `docs/component-primitives.md`) under `src/demos/` and mount them from `src/main.ts`.
- Keep every demo styled via `CSS_VARS` or the custom properties from `tokens.css` — hardcoded hex/px values defeat the SSOT and will be flagged by the token-usage lint discipline.
- Production build (`bun run build`) is for static review snapshots only; the playground is a design-time tool, not a deliverable pipeline.

## Related

- `../tokens.json` — token SSOT
- `../../docs/component-primitives.md` — the primitive catalog the playground previews
- `scripts/compile-tokens.ts` (workspace root / `templates/common`) — the compiler
