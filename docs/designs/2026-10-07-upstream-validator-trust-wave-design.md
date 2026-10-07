# Upstream Validator-Trust Wave Design (U-20261006-001..004)

- **Date**: 2026-10-07
- **Status**: Implemented (2026-10-07 — four fixes, tests, and registry rows landed in one wave)
- **Owner**: Automation Engineer (design + implementation); defects diagnosed and PM-confirmed via the co-develop upstream-ticket review (U-20261006-001..004)
- **Spec id**: `2026-10-07-upstream-validator-trust-wave-design` (registry: `docs/specs/registry.json`, source: `manual`)
- **Related ADRs**: ADR-0074 (Universal Design Gate), ADR-0036 (TypeScript-only scripts), ADR-0031 (prune conservatism)

---

## 1. Summary

Four PM-confirmed upstream defects share one root cause class: L0/L1 tooling either trusts stale generated state or reports a skipped gate as a passing one. This wave fixes all four at the L0 source (and the L1 mirror where propagated): (1) `scripts-snapshot.json` becomes regenerated post-upgrade state; (2) `verify-skills.ts` never rewrites a curated `SKILLS.md` and gains a `--check` drift gate; (3) `design-lint.ts`'s fonts check skips `<value>` template placeholders; (4) `audit.ts` gains a distinct `[SKIP]` verdict so "All checks passed" can no longer coexist with silently skipped gates.

## 2. Background

**U-20261006-001 — scripts-snapshot.json never refreshed post-upgrade.** `scripts/lib/upgrade-policy.ts` classified `scripts-snapshot.json` as PROJECT_STATE, so upgrades preserved it forever. The snapshot is written only at scaffold/adopt (`new-project.ts` §5.5c, `adopt-project.ts` §15 via `helpers/write-scripts-snapshot.ts`). `upgrade-project.ts`'s Script version comparison therefore re-reported the same scaffold-era drift on every upgrade — stale evidence the operator cannot act on.

**U-20261006-002 — verify-skills.ts overwrites curated SKILLS.md.** The legacy-index test was a prefix match (`startsWith("# Skills Index")`), so a curated variant index titled `# Skills Index - co-security` matched and was clobbered by the auto-generated index on every run. There was also no way to detect drift between a curated index and the generated content.

**U-20261006-003 — design-lint.ts fonts check flags template placeholders.** The font-fallback-contract check evaluated every `--font-*` declaration, including `*.template.*` token files whose values are `<value>` placeholders — not real font stacks — producing guaranteed false failures (co-develop carried a proven LOCAL-PATCH; this wave promotes it upstream).

**U-20261006-004 — audit.ts battery self-skips read as passes.** Gates that determine they do not apply (verify-memory outside L0, design-lint without a lint script or scan roots, typecheck without a baseline) printed `[PASS]`-equivalent lines or stayed silent while the run ended "All checks passed" — skipped evidence presented as green evidence.

## 3. Design

### 3.1 U-20261006-001: scripts-snapshot.json is REGENERATED

- `upgrade-policy.ts`: the path moves from `PROJECT_STATE_FILES` to `REGENERATED_FILES` (v1.22.0). Delivery passes filter by pass identity, so the `(regenerated in place)` claim is never delivered; the PRUNE pass only walks `scripts/`, `agents/`, `skills/`, so the root-level file is prune-safe.
- `upgrade-project.ts` (v1.65.0): a post-upgrade block next to the VERSION_MANIFEST regeneration runs `helpers/write-scripts-snapshot.ts <project-dir> <today> <variant> <commonDir>/scripts` with `cwd = workspace root` (the helper reads `<cwd>/scripts/SCRIPTS.md`), exactly mirroring the scaffold/adopt call sites. Missing helper or non-zero exit warns and continues — never an upgrade crash.

### 3.2 U-20261006-002: exact-stub detection + `--check` (verify-skills.ts v1.5.0)

- Regenerable means: file missing, OR first line is exactly `# Skills Index` (`trimEnd`-normalized; CRLF tolerated). A first line that merely starts with the prefix is curated — never rewritten in any mode.
- Content building is factored into a pure `buildSkillsIndexContent(checks)`; the writer (`generateSkillsIndex`) is a thin wrapper.
- `--check`: build the index in memory. Missing/exact-stub file → regenerate, exit 0 (not drift). Curated file differing from generated content → print the path plus the first differing line number and exit 1, writing nothing. Non-check mode keeps the current UX (auto-regenerate exact stubs only; curated files untouched; regeneration never affects the exit code).

### 3.3 U-20261006-003: fonts placeholder guard (design-lint.ts v2.1.0)

First statement of the fonts check loop: skip a declaration whose file matches `/\.template\./` or whose value contains `<`/`>` (the co-develop LOCAL-PATCH, promoted verbatim minus the LOCAL-PATCH prefix). All other sub-checks unchanged.

### 3.4 U-20261006-004: Skip verdict (audit.ts v2.51.0, typecheck.ts v1.2.0)

- New `Skip(msg)` helper (cyan `[SKIP]`, `skippedChecks` counter) beside Pass/Fail/Warn; the summary prints the skipped count when non-zero, so skipped is distinct from passed.
- verify-memory gate fires when `scripts/verify-memory.ts` exists, `!SKIP_MEMORY`, and a memory target exists — `CONSTITUTION.md` (L0) **or** `memory/MEMORY.md` (scaffolded projects). No memory target at all → `Skip`, not silence or Pass; `--skip-memory` now emits `Skip` too.
- The design-lint gate's two self-skip branches (lint script absent; no configured scan roots) emit `Skip` with unchanged messages.
- The typecheck context skip lives in `scripts/typecheck.ts` (audit.ts has no typecheck caller — the skip now self-labels `[SKIP]` at the source so any battery output shows it); exit code unchanged.

## 4. Affected paths

- `scripts/lib/upgrade-policy.ts` (mirrored to `templates/common/scripts/lib/upgrade-policy.ts`, byte-identical)
- `scripts/upgrade-project.ts` (L0-only, not propagated)
- `scripts/verify-skills.ts`, `scripts/design-lint.ts` (mirrored byte-identical)
- `scripts/audit.ts` (mirrored via the propagation pipeline's CONSTITUTION-scrub convention — the pair is intentionally NOT byte-identical; `propagate-to-templates --dry-run` reports `in sync`)
- `scripts/typecheck.ts` (mirrored byte-identical)
- `scripts/SCRIPTS.md`, `templates/common/scripts/SCRIPTS.md` (registry rows for the five version-bumped scripts only)

## 5. Test plan

- Unit (`tests/unit/`): upgrade-policy classification of `scripts-snapshot.json` as REGENERATED; verify-skills exact-stub vs curated first-line detection and `--check` drift exit via subprocess on temp fixtures; design-lint fonts skip on template/placeholder declarations via subprocess `--json`.
- Smoke: `/tmp` fixture with a curated `# Skills Index - test` first line — non-check mode must not modify the file; `--check` on a stale curated file must exit 1.
- Standard suites: `bun run test:unit`, `bun scripts/audit.ts`, and the three mirror diffs.

## 6. Rollout

Fixes land at L0/L1 in this change set; scaffolded projects converge on their next upgrade (the snapshot regeneration rides upgrade-project v1.65.0; verify-skills/design-lint/audit/typecheck ride the scripts propagation domain). After upgrading, co-develop and co-security can drop their local design-lint LOCAL-PATCH guards — the upstream guard supersedes them. No migration steps are required; behavior changes are strictly additive (new flag, new verdict class, one reclassified path).

## 7. Ticket references

U-20261006-001 (snapshot staleness), U-20261006-002 (SKILLS.md clobber), U-20261006-003 (fonts placeholder false positives), U-20261006-004 (skip-as-pass reporting). Related follow-up: T-20261006-007 (L1 SCRIPTS.md tail — pre-existing stale rows outside this wave's scope were not touched except for the scripts changed here).

## 8. Follow-up port (T-20261007-002, same day)

U-20261006-001 had two root causes; this wave's PR #1446 fixed only the refresh
timing (snapshot never regenerated). The parallel fleet PR #1441 — closed as
superseded because its core-script changes conflicted with this wave — carried
the CONTENT half and is ported here verbatim from its branch:

- `scripts/helpers/write-scripts-snapshot.ts` 1.0.1 → 1.1.0: inventory from the
  delivered registry (`<cwd>/<l1-source>/SCRIPTS.md`, falling back to the L0
  root registry) plus the variant overlay registry — not the L0 root registry,
  which lists workspace-only tools the project never receives and omits
  delivered scripts; 8-column row-shape parsing replaces the `## Registry`
  lazy-lookahead capture (which stopped at the first `###` subsection);
  `parseScriptRegistry` exported behind an import guard for tests; the 4-arg
  CLI signature is unchanged and all three call sites (new-project §5.5c,
  adopt-project §15, upgrade-project post-upgrade v1.65.0) verified compatible.
- `scripts/helpers/ticket-schema.ts` 1.5.1 → 1.6.0: `running` joins the ready
  branch of the triage↔status invariant (store-mediated claim of a
  triaged-ready upstream ticket is a legitimate tool-written state).
- `scripts/helpers/ticket-store.ts` 1.10.1 → 1.11.0: `moveTicketUnlocked`
  validates the mutated ticket before the atomic write (invariants were
  read-path-only; a move could write a state no command could then read).
- Tests ported: `tests/unit/write-scripts-snapshot.test.ts`,
  `tests/unit/ticket-upstream-triage.test.ts` updates.

The helpers are L0-only (no template mirrors). Registry rows updated for all
three. Re-verification was mandatory: the source branch never went green on CI.
