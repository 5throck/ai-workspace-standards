# co-deck Template VR Baselines Recapture — Design (Row 0)

- **Spec ID**: `2026-11-10-co-deck-vr-baselines-recapture-design`
- **Date**: 2026-11-10
- **Status**: implemented (2026-11-11, PM ticket sweep — see §6.1)
- **Author**: architect (PM-dispatched, Design Gate Row 0 — design only)
- **Tracking tickets**: T-20261110-011
- **Related**: U-20261105-004, U-20261110-001, workspace PR #1952 (CSS landing, merge `f7d06a11`), co-deck PR #217 (project recapture), T-20261110-009 / T-20261110-010 (`2026-11-10-delivery-gating-hardening-design`), ADR-0074

## 1. Problem statement

`templates/co-deck/docs/html-themes/baselines/**` holds 54 `slide-*.png` reference screenshots captured **before** the U-20261105-004 CSS fix landed (PR #1952). The tree also tracks 42 stale `diff-slide-*.png` artifacts (`git ls-files` count: 42 diff, 55 other).

The stale tree actively damages the fleet. Template baselines deliver through the TEMPLATE TREE SYNC pass as hash-gated `SYNC` files (`scripts/upgrade-project.ts:6151-6159`; default claim at `scripts/lib/upgrade-policy.ts:756,768`). `Projects/co-deck` recaptured its baselines at the fixed rendering, so its copies now differ from the delivered baseline. The disposition matrix sends "project evolved, template unchanged" to **EVOLVED (WARN) + deliver** (`scripts/lib/upgrade-policy.ts:1630-1637`). Every co-deck upgrade therefore overwrites fresh project baselines with pre-fix template PNGs.

Live proof, from `Projects/co-deck/.claude/last-upgrade-delivery.json` (template 0.30.0) classified with the live `classifyProjectState`:

| Count | State | Next-upgrade behavior today |
|---|---|---|
| 41 | `PROJECT_EVOLVED`, template unchanged | EVOLVED (WARN) — **re-staled** |
| 3 | `UNTOUCHED`, project == template | no-op |
| 11 | no manifest baseline, project == template | no-op |
| 42 | `diff-slide-*.png`, project deleted + tombstoned | `TOMBSTONED_SKIP` |
| 10 | project-only (5 `white-bubble` pairs) | not a template candidate |

The manifest also records 38 `EVOLVED/WARN` rows from the 2026-11-10 run. That is the observed "recapture ran twice" event.

## 2. Investigation findings (evidence)

**F1 — The suite is anchored to its own file location, not to `cwd`.** `theme-visual-regression.test.ts:36-38` computes `root = resolve(dirname(import.meta.path), '../../..')` and `baselinesRoot = join(root, 'docs/html-themes/baselines')`. The browser subprocess does the same from `__dirname` (`theme-visual-regression.browser.mjs:24-29`). The template copy of the suite therefore always reads and writes the **template** tree. No environment variable redirects the paths. A project-side run cannot be pointed at the template tree without a code change.

**F2 — The template is runnable as a package.** `templates/co-deck/package.json` defines `test:visual` and `test:visual:update` (`UPDATE_BASELINES=1`), and `templates/co-deck/node_modules/playwright` is installed. The capture scratch directory `templates/co-deck/presentations/_smoke_test/` is already ignored (root `.gitignore:155`).

**F3 — The template browser build does not match the project.** Template `playwright` resolves to **1.65.0**, which requires `chromium-1254`. That build is **not installed**. The shared cache `~/Library/Caches/ms-playwright/` holds only `chromium-1243`, the build of the project's `playwright` **1.63.0**. Both `package.json` files declare `^1.63.0`; the caret let the template drift. A root run today fails at `chromium.launch()`. Installing 1254 would capture on a different browser build than the project.

**F4 — Rendering inputs are byte-identical across the two trees.** `diff -rq` reports no difference for `scripts/co-deck/lib`, `scripts/co-deck/tests/fixtures`, `docs/html-themes/styles`, and `docs/html-themes/themes`. Captures are byte-stable where rendering is unchanged: 14 rels (11 + 3 above) are already byte-identical between independent template and project captures.

**F5 — The template suite still writes diff artifacts into the baseline tree.** Template `browser.mjs` is `@version 0.1.0` and writes `diff-slide-N.png` to `baselineDir` (`:356-358`). The project copy is `@version 0.2.0`: v0.1.1 moved diff copies to the transient `vr_fresh` directory, and v0.2.0 added retry-once-on-exceed for load jitter. The project fix was never ported. Deleting the 42 files without the port lets the next failing root run re-create them. `theme-visual-regression.test.ts` itself is byte-identical in both trees.

**F6 — Two pair matrices exist in one suite.** The test wrapper derives 27 pairs from `compatible_styles` (`test.ts:61-90`). The browser subprocess derives 32 pairs from "not partial, not incompatible" (`browser.mjs:102-144`). Capture mode therefore writes 32 pair directories (64 PNGs). The project already holds all 32; the template holds 27.

**F7 — The baselines README is stale.** It states "generated on Windows", omits the `outlook` theme and `zen/white-bubble`, and instructs editing a `FULLY_COMPATIBLE_PAIRS` array that v0.2.0 of the test derives automatically.

## 3. Goals / Non-goals

**Goals**
- Template baselines encode the fixed rendering, captured on the same browser build as the project.
- The 42 diff artifacts leave the tree, and the cause of their creation is removed.
- The next co-deck upgrade does not re-stale project baselines and loses no project content silently.

**Non-goals**
- No change to upgrade-engine semantics (see `2026-11-10-delivery-gating-hardening-design`).
- No unification of the 27-pair and 32-pair matrices (open question Q2).
- No change to `Projects/co-deck` baselines or scripts in this change. The project picks the result up through its next upgrade.

## 4. Design

### D1 — Port `browser.mjs` v0.2.0 into the template (prerequisite)
Copy `Projects/co-deck/scripts/co-deck/tests/theme-visual-regression.browser.mjs` byte-for-byte to `templates/co-deck/scripts/co-deck/tests/`. This is an adjudicated port of a project-originated fix (project commit `f77ee67`). `.mjs` files deliver through the VARIANT SCRIPTS pass, which is version-gated (`scripts/upgrade-project.ts:4180-4183,4205,4254-4256`). Equal versions and equal bytes yield `OK`, so the upgrade delivers nothing for this file. The port must precede the recapture, so that jitter retries apply and no diff artifact can land in `baselines/`.

### D2 — Pin the browser build (prerequisite)
Change `templates/co-deck/package.json` `devDependencies.playwright` from `^1.63.0` to exact `1.63.0`, then run `bun install` in `templates/co-deck`. The template then resolves `chromium-1243`, which is already installed. This is the decision that makes the recapture reproducible. The alternative — install `chromium-1254` and keep the caret — produces template PNGs that differ from every project capture and restarts the re-stale loop in CONFLICT form. Project `package.json` is project-owned, so the pin does not deliver to projects.

### D3 — Recapture procedure (run at workspace root, in the template package)
```bash
cd templates/co-deck
node -e "import('playwright').then(p=>console.log(p.chromium.executablePath()))"   # must print .../chromium-1243/...
bun run test:visual:update    # UPDATE_BASELINES=1 — capture mode, 32 pairs / 64 PNGs
bun run test:visual           # compare run 1
bun run test:visual           # compare run 2
```
Run on an idle machine. Capture mode exits non-zero if any pair fails to build (`test.ts:192-193`). A missing browser cannot pass silently: the wrapper asserts `result.total > 0`.

### D4 — Remove the diff artifacts
`git ls-files 'templates/co-deck/docs/html-themes/baselines' | grep 'diff-slide-' | xargs git rm`. Add the ignore rule `templates/co-deck/docs/html-themes/baselines/**/diff-slide-*.png` to the root `.gitignore`, next to the existing `_smoke_test` rule (`:155`). The rule is a guard; D1 is the fix.

### D5 — Refresh the baselines README
Update the environment note (macOS arm64, Playwright 1.63.0 / `chromium-1243`), the structure tree (`outlook`, all `white-bubble` pairs), and the "Adding New Baselines" steps (pairs derive from `theme.json`). State that diff copies are transient and never stored in `baselines/`.

### D6 — Commit location and project pickup
The recapture commits to the root repository (`templates/co-deck/**`) through the normal `/sync` PR. `Projects/co-deck` receives it on its next upgrade. The delivery is safe by the existing matrix:

| Project rel vs new template | Result |
|---|---|
| byte-equal (expected for most or all rels, per F4) | hash gate yields no candidate (`upgrade-project.ts:6157`); nothing is written |
| differs, has baseline (the 41 `PROJECT_EVOLVED` rels) | template changed → **CONFLICT (ERROR), SKIP**, project copy preserved (`upgrade-policy.ts:1649-1655`) |
| differs, no baseline (candidates: the 10 `white-bubble` rels, the 10 already-identical PNGs, and `README.md`) | delivers as ADOPT (INFO) — both sides are fixed-rendering captures; this is the T-20261110-009 path. `README.md` always takes this row after D5 |
| 42 diff rels | template-departed → tombstones and baselines prune themselves (`upgrade-project.ts:7742,7748`) |

If CONFLICT rows appear, the operator grants `--disposition adopt-template='docs/html-themes/baselines/**'` once, then runs the project `bun run test:visual`. After adoption, project == template == baseline, so the rels are `UNTOUCHED` on later upgrades. The EVOLVED-deliver loop closes in both branches.

## 5. Affected surfaces

| File | Action |
|---|---|
| `templates/co-deck/scripts/co-deck/tests/theme-visual-regression.browser.mjs` | replace with project v0.2.0 (D1) |
| `templates/co-deck/package.json` | pin `playwright` to `1.63.0` (D2) |
| `templates/co-deck/docs/html-themes/baselines/**/slide-*.png` | 54 recaptured + 10 new (D3) |
| `templates/co-deck/docs/html-themes/baselines/**/diff-slide-*.png` | 42 deleted (D4) |
| `templates/co-deck/docs/html-themes/baselines/README.md` | refresh (D5) |
| `.gitignore` (root) | one ignore rule (D4) |

This change touches more than 3 template files. It is **high-risk by the architect rule and requires explicit user confirmation**. The binary churn is 106 PNG paths.

**Platform impact**: Claude Code — none (no agent, skill, hook, or command file changes). Antigravity (`GEMINI.md`) — none; justification: the change is confined to co-deck test assets and one devDependency pin, which no platform instruction file references. `templates/common` — none; the VR suite is co-deck variant content.

## 6. Acceptance criteria

- [x] `cmp` reports the template and project `theme-visual-regression.browser.mjs` byte-identical, both `@version 0.2.0`.
- [x] In `templates/co-deck`, `chromium.executablePath()` contains `chromium-1243` and the file exists.
- [x] `bun run test:visual:update` exits 0 and reports 32/32 pairs captured.
- [x] `find templates/co-deck/docs/html-themes/baselines -name 'slide-*.png' | wc -l` prints 64.
- [x] `bun run test:visual` exits 0 on two consecutive runs, with `failed: 0` both times.
- [x] `git status --porcelain templates/co-deck/docs/html-themes/baselines` is empty after the second compare run (zero diffs, zero new files).
- [x] `git ls-files templates/co-deck/docs/html-themes/baselines | grep -c diff-slide-` prints 0.
- [x] `zen/white-bubble/slide-1.png` shows the opaque bubble card with navy type (visual check against the project copy).
- [x] `bun scripts/upgrade-project.ts Projects/co-deck --dry-run` shows **zero** `EVOLVED` rows under `docs/html-themes/baselines/`. Every baseline row is absent (parity), `CONFLICT`, or `ADOPT`.
- [x] The count of byte-identical `slide-*.png` pairs between the two trees (of 64) is recorded in the PR body. Every non-identical pair passes the project `bun run test:visual` threshold after adoption.

### 6.1 Execution record (2026-11-11)

- D1: project `theme-visual-regression.browser.mjs` v0.2.0 copied byte-identical. D2: `playwright` pinned to `1.63.0`; `chromium.executablePath()` resolves `chromium-1243` after `bun install` (the generated, untracked `bun.lock` was removed — the template does not track one).
- D3: `bun run test:visual:update` exit 0, 32/32 pairs captured, 64 `slide-*.png`. Two compare runs exit 0 (2 pass / 0 fail each). The second run left no new diffs.
- D4: the 42 tracked `diff-slide-*.png` were deleted from the working tree (the commit stages the deletions). **Deferred**: the root `.gitignore` guard rule. It is a root file, and CLAUDE.md §9 keeps root and template changes in separate tasks. A template-local `.gitignore` was rejected because it would deliver to projects. D1 removes the cause.
- D5: README refreshed (structure, macOS arm64 / Playwright 1.63.0 / chromium-1243, transient `vr_fresh`, derived pairs).
- Byte identity versus `Projects/co-deck`: 52 of 64 `slide-*.png` are identical. The 12 that differ are the 6 `white-bubble` pairs.
- `upgrade-project.ts Projects/co-deck --dry-run` (new engine): zero `EVOLVED` rows under `docs/html-themes/baselines/`. 10 `white-bubble` PNGs plus `README.md` UPDATE. The 2 `zen/white-bubble` PNGs are CONFLICT (ERROR), the expected D6 row. Grant `--disposition adopt-template='docs/html-themes/baselines/**'` at the co-deck upgrade, then run the project `bun run test:visual`. That last step is not verified here.

## 7. Rollback

Revert the single recapture commit. The revert restores the previous PNG set, the 42 diff artifacts, the v0.1.0 browser script, and the caret pin. No migration state exists: template baselines have no consumer except the delivery pass. If `Projects/co-deck` already adopted the new baselines, its copies stay valid, because they equal its own fixed-rendering captures.

## 8. Open questions (Design Gate)

- **Q1** — Should the recapture wait for T-20261110-009? Without it, up to 21 no-baseline rels can deliver as silent ADOPT (INFO). Recommendation: do not wait. The content on both sides is fixed-rendering, and each waiting day keeps the re-stale loop live for 41 rels.
- **Q2** — The suite compares 27 pairs through the wrapper but captures 32 through the subprocess (F6). Should a follow-up ticket align `discoverMatrix()` with `compatible_styles`?
- **Q3** — Ported v0.2.0 writes diff copies to `vr_fresh`, and the end-of-run cleanup deletes that directory (`browser.mjs:383-388` in the template numbering). A failing run therefore leaves no inspectable diff. Accept, or file a follow-up to retain diffs under `_smoke_test/`?
- **Q4** — Should the exact Playwright pin also be recommended project-side (`optionalDependencies` `^1.63.0`)? A project `bun update` would move the project to a new Chromium build and break byte parity with the template.
- **Q5** — Baselines are stored as UTF-8-decoded hashes in the manifest (`upgrade-project.ts:7686` reads PNG bytes as `utf8`). Decoding is lossy for binary content. Is a byte-exact baseline key for binary files wanted? This belongs to the gating-hardening design, not to this change.

## 9. Accessibility exemption note

This change modifies test fixtures (reference screenshots), one test script, one dependency pin, and one README. It introduces no user-facing UI, no theme or style change, and no content change. The rendering under test was already changed and reviewed in PR #1952. No accessibility review is required.
