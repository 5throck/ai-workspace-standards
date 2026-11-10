# co-deck root tooling: injector defaults, snapshot self-references, rebuild-order precedence, U-20261105-004 CSS landing — Design

- **Spec ID**: 2026-11-10-co-deck-root-tooling-design
- **Date**: 2026-11-10
- **Status**: implemented (spec registered via spec-register at implementation; Design Gate ruling DEC-20261110-03)
- **Author**: architect (high tier, PM-dispatched)
- **Tracking tickets**: T-20261110-005 (injector `--slidedata` CWD default + local-injector warning), T-20261110-006 (snapshot restore command), U-20261110-001 (template CSS landing, status: review), U-20261110-002 (upstream doc request, status: review — its resolution cites this PR; same changeset)
- **Related**: ADR-0002, ADR-0036, U-20261029-005, U-20261105-007, `docs/designs/2026-10-09-co-deck-injector-promotion-design.md`

## Problem statement

1. **T-005**: `inject-video-players.ts` defaults `--slidedata` to `'slidedata.json'`, resolved against CWD. Run from the repo root (`bun scripts/co-deck/inject-video-players.ts presentations/<name>/lecture_vN.html`) it ENOENTs, because `slidedata.json` lives beside the deck HTML in the deck project dir. `build-theme-deck.ts` is unaffected (it passes `--slidedata` explicitly, build-theme-deck.ts:208); the defect bites every manual re-run. Separately, decks that ship a project-local injector (`inject_video_players.py` with project-specific video-slide styling, e.g. the consumer-goods deck's hidden text card + slim title bar) get the generic cdk player applied with no warning, silently diverging from the project's documented rebuild order.
2. **T-006**: Finding — the workspace-managed template copy `templates/co-deck/scripts/co-deck/snapshot.ts` is **already correct** at all 7 self-referential sites (lines 61, 92, 143, 174, 175, 200, 274–281 emit `bun scripts/co-deck/snapshot.ts`, fixed at TS-conversion commit `bdffd2d36`). The **stale copy** is `Projects/co-deck/scripts/co-deck/snapshot.ts` (emits `bun scripts/snapshot.ts`, breaks every emitted restore command; `presentations/*/VERSIONS.md` confirms live breakage). Both declare `@version 1.0.0` — same version, divergent content, and `fleet-script-parity.ts` covers only `templates/common/scripts/`, so the drift is invisible to every existing check.
3. **U-002**: `agents/html-build.md` → "Canonical rebuild order (U-20261105-007)" never tells agents to check project-local rebuild documentation, and does not state that a project-documented order (project VERSIONS.md rebuild note + injector docstring `REBUILD ORDER:` line) overrides the canonical default.
4. **U-001**: workspace PR #1864 (merged 2026-11-06) never actually committed the U-20261105-004 CSS fix — the co-deck session's worktree modifications were dropped by scoped staging (`memory/2026-11-06.md:608`) while `CHANGELOG.md:71`, `docs/specs/registry.json:2960` (status: implemented) and `tickets/governance/U-20261105-004.yaml` (`resolution.outcome=fixed`) all falsely record it as landed. Template `base.css:213` still carries the pre-fix flex `.bullet-item`; the 0.30.0 delivery then legitimately overwrote the project's local patch with the still-pre-fix template CSS (project restore commit `4edaa8b`, U-20261110-001).

## Goals / Non-goals

**Goals**: (1) injector default anchors to the deck's own directory; clear failure when slidedata is missing; warning when a local injector is detected. (2) Workspace-side pin against snapshot self-reference drift + documented project-side repair path. (3) Append-only amendment of the canonical rebuild order giving project docs precedence. (4) Land the missing U-20261105-004 CSS fix in the template, preserving project-only Pretendard parity content, so future deliveries stop stripping it.

**Non-goals**: no change to injection markup or idempotency contract; no hard-fail on local injectors (warn-only — decided); no `fleet-script-parity` extension in this PR (follow-up ticket, filed separately); VERSIONS.md history left as-is (decided); no hand-editing of the closed U-20261105-004 upstream.* fields (governance rule — corrections ride the PR body / CHANGELOG / resolution notes instead).

## Design

Canonical edit targets are the **template copies** under `templates/co-deck/` (SSOT; `Projects/co-deck` is a separate git repo, gitignored in ai_workspace — its copies update via variant sync after merge).

### (a) inject-video-players.ts — v1.1.0 → v1.2.0

- **Default resolution**: line 46 becomes `const slidedataPath = argValue('--slidedata') ?? join(deckDir, 'slidedata.json');` — anchored to `dirname(resolve(htmlPath))`. Decision: the HTML's **own directory**, not a wider "project root" walk. Rationale: in the co-deck layout `presentations/<project>/lecture_vN.html` and `presentations/<project>/slidedata.json` are siblings (verified across project decks), so deckDir *is* the deck project dir; it matches the `--assets-dir` precedent (already deckDir-anchored, line 48). Explicit `--slidedata` values keep CWD semantics (standard CLI behavior; existing test passes absolute paths — unchanged).
- **Missing-file guard**: before line 50, `if (!existsSync(slidedataPath))` → `console.error('inject-video-players: slidedata not found at <path> (default resolves beside the deck HTML; pass --slidedata <path> to override)')`, `process.exit(1)` before any write. Replaces the raw ENOENT stack with a named-path remedy.
- **Local-injector warning**: after loading the deck, scan `deckDir` (non-recursive, `readdirSync`) for `/^inject_.*players?\.(py|js|mjs|ts)$/i` (catches the known `inject_video_players.py`). On hit, WARN to stderr, e.g.: `WARNING: project-local injector(s) found: inject_video_players.py — its video-slide styling is NOT reproduced by this generic injector; follow the project's documented rebuild order (local injector docstring REBUILD ORDER / project VERSIONS.md) instead.` Warn-only; exit code and output file unchanged; also notes the double-marker hazard (`project-video-players` + `cdk-video-players` can coexist on one rebuild).
- Tests: extend `tests/inject-video-players.test.ts` (v1.1.0 → v1.2.0) — runs from repo root without `--slidedata` succeed; missing slidedata exits 1 with deck unmodified; fixture dir containing `inject_video_players.py` produces the WARN line on stderr and status 0.

### (b) snapshot.ts — template already correct; pin + repair

- **No template change, no version bump.** Workspace-side deliverable: new pin test `scripts/co-deck/tests/snapshot-self-reference.test.ts` (v1.0.0, new SCRIPTS.md row): reads `snapshot.ts` source and asserts zero occurrences of `bun scripts/` whose target is not `scripts/co-deck/snapshot.ts` (equivalent greppable check: `grep "bun scripts/" snapshot.ts | grep -v "scripts/co-deck/"` → empty).
- **Project-side (separate repo, documented in the PR body, not in this diff)**: re-sync `Projects/co-deck/scripts/co-deck/snapshot.ts` from the template (also delivers the template's skipped-file `exitCode=1` hardening the project lacks) and backfill broken `bun scripts/snapshot.ts --restore` lines in existing `presentations/*/VERSIONS.md`.

### (c) agents/html-build.md — v1.3.3 → v1.4.0, append-only

Two surgical insertions into "Canonical rebuild order (U-20261105-007)" (title and U-20261105-007 lineage untouched; existing steps/notes unchanged):

1. Append to the section's intro paragraph:
   > BEFORE rebuilding, check the project's own rebuild documentation: the project's VERSIONS.md rebuild-order note and any project-local injector script headers (a `REBUILD ORDER:` line in e.g. `inject_video_players.py`). A project-documented rebuild order overrides this canonical default.
2. Append to the end of the Notes list:
   > - **Project-local rebuild order takes precedence.** If the deck's project ships its own injector (e.g. `presentations/<name>/inject_video_players.py`) or documents a different rebuild order, follow THAT order — the project injector may apply project-specific video-slide styling (e.g. hidden text card, slim title bar) that the generic injector does not reproduce. Following this section literally on such a deck silently loses the project styling.

Also: frontmatter `version`/`last_updated`; append a phase-history line to `templates/co-deck/docs/lifecycle/agents/html-build.md`; sync project mirrors (`Projects/co-deck/agents/html-build.md`, `.claude/agents/html-build.md`) post-merge. Registry (SCRIPTS.md): update injector row + both test rows + Last Updated footer; snapshot row unchanged. U-20261110-002 moves `review → done` citing this design/PR.

### (d) U-20261105-004 CSS landing — base.css + white-bubble/style.css (v1.1.0 → v1.2.0 each)

Land the CSS fix that PR #1864 intended but never committed. Sources (verified 2026-11-10):

- **Fix content**: design `docs/designs/2026-11-06-co-deck-html-pipeline-remediation-design.md` §1 (bullet layout root fix + white-bubble parity); co-deck commit `4edaa8b` (current restored state, merge `a3defb4`) and `7f7c011` (original LOCAL-PATCH).
- `templates/co-deck/docs/html-themes/styles/base.css`: replace the flex `.bullet-item` block (lines 213–223) with the `4edaa8b` version — `display: block; padding-left: var(--bullet-indent); text-indent: calc(var(--bullet-indent) * -1); text-align: left;` and `::before { display: inline-block; width: var(--bullet-indent); text-indent: 0; }`, carrying the LOCAL-PATCH comment block citing workspace PR #1864 / U-20261105-004.
- `templates/co-deck/docs/html-themes/styles/white-bubble/style.css`: apply the `4edaa8b` zen-block restorations (header note; card selector widened to `[data-theme="zen"] .slide .slide-content` incl. `max-height`/`overflow` cap; `strong` accent via `var(--accent-color)`; navy serif cover styling; punchline/contact card styling).
- **Preserve project-only content**: the Pretendard font-parity block (project `white-bubble/style.css:201–212`, `LOCAL-PATCH (design: 2026-11-10-pretendard-font-parity)` — two `@font-face` rules + `:root` font-family override) is NOT part of the upstream fix but MUST be included in the template so future adopt-template deliveries stop stripping it. Safe to land: `font-display: swap` degrades gracefully while the template font pool is empty (verified — `presentations/assets/fonts/` absent in template); the font files themselves remain project assets.
- **Upgrade sequencing warning** (record in PR body + co-deck resolution notes): co-deck must NOT run another adopt-template upgrade before this PR lands. After it lands, the project's `white-bubble/style.css` flips to project-evolved + template-changed **CONFLICT(ERROR)** needing `--disposition adopt-template` — safe only once the template carries BOTH the fix and the Pretendard block (adopting the fixed template then reproduces the project state); `base.css` is NO_BASELINE and will overwrite cleanly to the fixed template.
- **Record corrections**: the false "implemented/fixed" records (CHANGELOG.md:71, registry.json:2960, closed U-20261105-004 upstream fields) are corrected via this PR body + CHANGELOG erratum + this PR's ticket resolution notes only — closed upstream tickets are never hand-edited.
- **Spec registration**: this PR's design-doc registration (`spec-register.ts`) covers the CSS landing too — scope note in the PR body.

## Affected surfaces

| File | Action |
|------|--------|
| `templates/co-deck/scripts/co-deck/inject-video-players.ts` | modify (v1.2.0: default anchor, missing-file guard, local-injector warning) |
| `templates/co-deck/scripts/co-deck/tests/inject-video-players.test.ts` | modify (v1.2.0: three new cases) |
| `templates/co-deck/scripts/co-deck/tests/snapshot-self-reference.test.ts` | create (v1.0.0 pin) |
| `templates/co-deck/scripts/co-deck/SCRIPTS.md` | modify (rows + footer) |
| `templates/co-deck/agents/html-build.md` | modify (v1.4.0 append-only section amendment) |
| `templates/co-deck/docs/lifecycle/agents/html-build.md` | modify (phase-history line) |
| `templates/co-deck/docs/html-themes/styles/base.css` | modify (U-001: `.bullet-item` block+text-indent fix from `4edaa8b`) |
| `templates/co-deck/docs/html-themes/styles/white-bubble/style.css` | modify (U-001: zen-block restorations + Pretendard parity block) |
| `Projects/co-deck/**` | post-merge variant sync (separate repo) |

**Platform Impact**: Claude Code — none (bun CLI + variant agent file, platform-neutral). Antigravity — none: `html-build.md` is a variant agent definition dispatched by PM on every platform; no platform hooks touched. `templates/common` — none: co-deck-only, no common propagation (`@l2-propagate` N/A).

## Acceptance criteria

1. From a fixture deck dir with `slidedata.json` beside `deck.html`, run the injector **from an unrelated CWD** without `--slidedata` → exit 0, marker block injected (no ENOENT).
2. Same run with no slidedata file anywhere → exit 1, stderr names the attempted path and the `--slidedata` remedy; `deck.html` byte-identical to before.
3. Fixture deck dir containing `inject_video_players.py` → stderr WARN lists it; exit status still 0; fixture without it → no WARN.
4. `bun test scripts/co-deck/tests/` green, including the three new injector cases and `snapshot-self-reference.test.ts`; `grep "bun scripts/" templates/co-deck/scripts/co-deck/snapshot.ts | grep -v "scripts/co-deck/"` → empty.
5. `templates/co-deck/agents/html-build.md` canonical section contains both quoted sentences; `git diff` on the section shows append-only edits; frontmatter at 1.4.0.
6. Script header `@version` strings match their SCRIPTS.md rows.
7. Template `base.css` `.bullet-item` matches the `4edaa8b` block version (no `display: flex` / `gap` / `flex-shrink` remnants); `grep -c "LOCAL-PATCH" templates/co-deck/docs/html-themes/styles/white-bubble/style.css` ≥ 5 and the Pretendard block (`@font-face` × 2 + `:root` font-family override) is present.
8. `grep -rn " Pretendard\|font-parity" templates/co-deck/docs/html-themes/styles/white-bubble/style.css` shows the parity block attributed to its project design so a future adopt-template delivery reproduces it rather than stripping it.
9. PR body contains the upgrade-sequencing warning (no co-deck upgrade until landing; post-landing CONFLICT(ERROR) disposition guidance) and the CHANGELOG/registry erratum for the false U-20261105-004 "implemented" records.

## Rollback

Single-PR revert. Injector changes are additive (default anchor + stderr warning) — revert restores v1.1.0 CWD behavior. `html-build.md` amendment is append-only — revert restores v1.3.3. Pin test is inert on revert. CSS revert restores the pre-fix template (re-arms the upgrade-sequencing warning: co-deck upgrades stay blocked until re-landed). Project-side syncs are independent and reversible per-project.

## Decisions (Design Gate defaults adopted per PM ruling 2026-11-10)

1. **Warn-only injector guard** — the injector warns when it detects a local injector or a foreign player marker; it never hard-refuses or no-ops. Double-player risk is handled by the warning text, not by exit-code changes.
2. **`fleet-script-parity` extension for variant script sets** → follow-up ticket, filed separately, NOT in this PR. (This PR's `snapshot-self-reference.test.ts` pins the specific T-006 string class only.)
3. **VERSIONS.md historical backfill → left as-is.** Restore accepts unique-ID substrings, so old broken lines remain reconstructable; only future entries (post-sync) emit correct commands.
4. **Glob detection (chosen)** — `/^inject_.*players?\.(py|js|mjs|ts)$/i` over a strict known-name list; a false-positive warning on a like-named helper is harmless, a miss would be silent.

Residual open item (non-blocking, for the implementer): confirm whether the template should also ship the Pretendard TTFs in `presentations/assets/fonts/` or rely on graceful fallback (design assumes fallback; files remain project assets).

## Accessibility exemption note

Scope (a)–(c) are backend CLI tooling and agent-instruction-file text — no UI or interactive surfaces, **exempt**. Scope (d) touches deck theme CSS (visual presentation of generated HTML decks), not product UI; the `.bullet-item` block-flow fix corrects text layout (prevents column-split and card overflow) and is readability-positive. Treated as **exempt** from the accessibility-audit pipeline (static theme assets, no interactive components); the CSS change rides normal template verification.
