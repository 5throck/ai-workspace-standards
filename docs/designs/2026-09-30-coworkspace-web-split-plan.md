# co-workspace web/index.html View-Module Split Plan

- **Date**: 2026-09-30
- **Status**: planned (execute at the next feature wave that touches the web app)
- **Spec id**: `2026-09-30-coworkspace-web-split-plan`
- **Owner**: automation-engineer (T-20260928-015; plan-only ticket)
- **Related**: T-20260928-013/T-20260928-007 (server split already landed: server.ts 1466 → 164 lines + `src/routes/*`), T-20260928-012 (pure helpers extracted: donut math, session grouping)

## R1 — Current state

- `src/server.ts` is 164 lines: the router half of the ticket's split already
  happened ( eight `src/routes/*.ts` modules, each 9–246 lines, dispatched from a
  thin `server.ts` loop). No further server split is needed.
- `web/index.html` is 1,184 lines: one file carrying the CSS, the DOM skeleton,
  and ~37 inline functions (SSE stream handling, session list rendering, donut
  chart, tenant forms, auth/keys UX). The file is served verbatim by
  `src/pages.ts` — no build step, which is a deliberate constraint to preserve.

## R2 — Target shape (next feature wave)

Split by VIEW concern into ES modules served as static assets (keep the
no-build-step constraint — plain `<script type="module">` with relative imports;
`src/pages.ts` gains a second static route):

```
web/
  index.html          # DOM skeleton + <script type="module" src="./app.js">
  app.js              # boot: state init, module wiring, ~50 lines
  api.js              # fetch wrappers (auth header, error shape, SSE connect)
  views/
    sessions.js       # session list + grouping (imports the extracted pure helpers)
    chat.js           # message stream + SSE frame handling + heartbeat rendering
    donut.js          # usage donut (imports the extracted pure math)
    tenant-admin.js   # create/delete forms, keys, variant picker
  styles.css          # the tokenized CSS (already CSS-var driven since T-20260928-008)
```

Rules:
1. **One module per view concern, no framework, no bundler.** Browser-native ESM
   keeps `pages.ts` a static-file server and keeps the diff reviewable.
2. **Move code verbatim first, refactor second.** The split commit must not
   change behavior; the follow-up (dedupe, event delegation) lands separately.
3. **Pure helpers stay in `src/`-tested land.** Anything unit-testable that is
   currently inline (frame parsing especially — the T-20260930-010 comment-frame
   handling) moves to a tested `src/web-*.ts` module and gets imported, not
   duplicated.
4. **CSP note:** splitting into `.js` files requires the page's
   `content-security-policy` (if one is added later) to allow `self` scripts —
   none exists today; no change needed for the split itself.

## R3 — Execution checklist (for the feature wave)

- [ ] Add the static route for `web/` assets in `src/pages.ts` (mime map: .js/.css).
- [ ] Move CSS → `styles.css`; assert zero `<style>` remains.
- [ ] Extract `api.js` (all `fetch`/`EventSource` call sites) — one sweep.
- [ ] Extract the four view modules; `index.html` keeps only DOM + boot script tag.
- [ ] Frame-parsing logic → `src/web-frames.ts` with unit tests (comment frames,
      `data:` frames, [DONE], error frames — mirrors the T-20260930-010 wire).
- [ ] Manual smoke in process mode + docker mode (T-20260930-009 operator pass).
- [ ] Size gate: no module over ~300 lines; `index.html` under ~200.

## R4 — Why not now

The file is stable (no open UX tickets touch it), every behavior is currently
covered by server-side tests, and a behavior-neutral move is best done in a wave
with manual verification capacity (the T-20260930-009 operator pass) rather than
bundled into this ticket batch.
