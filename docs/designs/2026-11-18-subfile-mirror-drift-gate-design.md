# Design: Subfile-Mirror Drift Gate — audit-time early signal for L1 skill subfile drift (T-20261118-002)

- **Spec ID**: `2026-11-18-subfile-mirror-drift-gate`
- **Date**: 2026-11-18
- **Author**: architect + automation-engineer hybrid (PM dispatch, ticket T-20261118-002)
- **Tickets**: T-20261118-002 (backlog → done on merge)
- **Root cause chain**: T-20261117-011 (stale `templates/common/skills/explain-me/references/PLATFORM_HARNESS.md`, repaired by manual byte-copy redeploy)
- **Status**: implemented (2026-11-18)

## 0. Conclusion

`audit.ts` gains one new check — an **L0↔L1 mirror parity early signal** — that calls the already-exported, already-unit-tested pure collector `collectMirrorParityFailures` from `scripts/qa-gate.ts` and reports every returned failure as an audit `[FAIL]` row (each message already names both the L0 and L1 paths). No extraction into `scripts/lib`, no new machinery, no verify-scripts involvement: the collector is a pure filesystem-read function with no exit paths, `qa-gate.ts` is itself mirrored to L1 alongside `audit.ts` (so the import cannot dangle in the L1 mirror — the exact failure class that killed the old `layer-filter.ts` import), and unit tests already import it (`tests/unit/qa-gate-crlf.test.ts`), proving dual consumption works today. The gate is scoped `IS_WORKSPACE_ROOT` (audit.ts convention, line 2760) and self-skips everywhere else, so L2/L3 audits are byte-identical to before. Effect: subfile drift between `skills/<skill>/**` and `templates/common/skills/<skill>/**` surfaces at every audit run instead of only at full `qa-gate` runs that survive step-1 short-circuiting.

## 1. Problem statement (the T-011 chain)

1. **No propagation path for skill subfiles.** `propagation-map.json`'s skills domain `include_pattern` is `*/SKILL.md`, and `globToRegExp` compiles a single `*` as segment-bound (never crosses `/`). Only `SKILL.md` itself has an automated L0→L1 propagation path. `references/`, `scripts/`, `templates/` and any other subfile under a skill directory has none.
2. **Sync-skills targets elsewhere.** `scripts/sync-skills.ts` mirrors skills into the five platform dirs (`.claude/skills`, `.gemini/skills`, `.codex/skills`, `.hermes/skills`, `.agents/skills`), not into `templates/common/skills/`.
3. **Silent staleness.** Subfile mirrors therefore update only on hand-synced `chore(templates): workspace sync` commits (last full sync of the explain-me references: 066f3959c). Root commit 57dcdc191 (Codex/Hermes prompt-only fallback sections) left `templates/common/skills/explain-me/references/PLATFORM_HARNESS.md` stale until T-20261117-011's manual byte-copy redeploy.
4. **Detection was qa-gate-only and short-circuit-masked.** `qa-gate.ts` step 4 (`collectMirrorParityFailures`, deepened by T-20260912-021) was the only detector — but step 1 runs `audit.ts` first and exits on its failure, so whenever any other audit failure was present the parity report never executed. T-011's masking history: multiple QA reports stated "explain-me FAIL confirmed gone" from short-circuit artifacts that never reached step 4.

## 2. Mechanism ruling (where the cheap check lives)

| Option | Pro | Con | Verdict |
|--------|-----|-----|---------|
| **A. `audit.ts` new check importing `collectMirrorParityFailures` from `scripts/qa-gate.ts` (ruled)** | Zero new code for the comparison; one self-skipping gate block (~25 lines) in audit.ts; early signal at every audit run; audit-time and qa-gate-time verdicts can never disagree (same collector, same content) | audit.ts gains a cross-script import | **Ruled — minimal-reuse option** |
| B. Same check but import from a new `scripts/lib/mirror-parity.ts` extraction | Cleaner lib placement | Pure churn: moves ~130 lines + 6 exports + existing test imports for zero behavior change; violates "no new machinery" | Rejected |
| C. New `verify-scripts.ts` check | Separates template checks from workspace audit | verify-scripts is script-focused (per its name and history); skills are not scripts; still needs the collector import, so it is strictly more wiring than A; does not run at audit time — the ticket's core requirement | Rejected |
| D. Standalone drift script run by dev-sync | Dev-sync runs on sync only, not on every audit | Does not break the short-circuit mask (audit failures still block sync before the script matters); adds a script to maintain | Rejected |

**Import-safety ruling for A** (the objection that killed importing `layer-filter.ts` into qa-gate): `templates/common/scripts/` contains both `audit.ts` and `qa-gate.ts` (both registered layer L0+L1 in SCRIPTS.md). An L0 `audit.ts` importing `qa-gate.ts` mirrors to an L1 `audit.ts` importing an L1 `qa-gate.ts` — the edge survives delivery in both layers. The import is inside the mirror contract in both directions.

## 3. Comparison semantics

Reused verbatim from `collectMirrorParityFailures` — the audit gate changes **where** the comparison runs, never **what** is compared:

- **Scope**: skills whose L0 `SKILL.md` frontmatter resolves to layer `L0+L1` via `skillLayerFromFrontmatter` (`scope: common` or unspecified; `scope: workspace`, `l2_propagate: false`, and variant-scoped skills are excluded — no L1 mirror by contract). L1-authored skills with no L0 counterpart are not flagged.
- **Coverage**: full recursive directory comparison per mirrored skill — one-sided files in either direction (missing from L1 / orphan at L1) **and** content comparison of files present in both trees. This subsumes the ticket's "non-SKILL.md files" scope: SKILL.md is compared too, which matches qa-gate semantics exactly and cannot disagree with it (SKILL.md parity is additionally covered by the existing propagation gates; flagging it here is harmless duplicate coverage of the same contract).
- **Normalization**: `sha256Normalized` — CRLF-tolerant and CONSTITUTION-ref-scrub tolerant (M5 semantics carried over; no false positives from line endings or template transforms).
- **Exclusion rules**: `_archive`, `local`, `external`, `_`-prefixed skill dirs are skipped — consistent with the existing qa-gate gate.
- **scripts/ subtree**: the collector also compares `scripts/` vs `templates/common/scripts/` (registry-scoped). The audit gate runs the collector as one unit — the scripts half is the same contract already gated by qa-gate; surfacing it at audit time is the same early-signal win.
- **Reporting**: each collector failure string is emitted as its own `[FAIL]` row via audit's `Fail()` helper (single increment — the v2.69.0 accounting rule); empty result emits one `[PASS]` row. Messages name both paths (e.g. `skills/demo/references/guide.md is missing from templates/common/skills/demo/`).

## 4. Platform Impact

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | None — runtime behavior unchanged; audit.ts is a repo script, not a platform surface | N/A |
| Antigravity (GEMINI.md) | None — no GEMINI.md section references audit checks individually; the gate is platform-neutral repo tooling | N/A (justification: the change adds an internal consistency gate to a repo script; no platform instruction file lists audit gates, so there is nothing to propagate) |
| templates/common | Propagation required — `scripts/audit.ts` is registered L0+L1 in SCRIPTS.md; the modified audit.ts must be mirrored to `templates/common/scripts/audit.ts` byte-identically (this PR's own gate will enforce it), with a SCRIPTS.md version bump | `scripts/audit.ts`, `templates/common/scripts/audit.ts`, `scripts/SCRIPTS.md` |

## 5. Test plan

New file `tests/unit/audit-mirror-parity-gate.test.ts` (scratch-tree style of `qa-gate-crlf.test.ts`), plus one integration assertion per the ticket:

1. **Drift detected** — seeded stale subfile: L1 copy of a mirrored skill subfile differs from L0 → collector returns a `differs from` failure naming both paths (this is the T-011 shape: `references/PLATFORM_HARNESS.md`).
2. **Missing subfile detected** — L1 subfile deleted → `is missing from` failure (T-20260912-021 coverage already pins this; re-pinned through the audit-gate wrapper).
3. **Parity passes** — identical trees → empty failures (mirrors the live tree, which passes after T-011's fix).
4. **Non-SKILL.md scope** — a SKILL.md-only difference is still surfaced by the collector (same contract as qa-gate; documents that the audit gate does not narrow the collector's scope), and non-mirrored subtrees (workspace-scoped skill) produce nothing.
5. **L0+L1 scope rule** — `scope: workspace` skill with no L1 mirror yields no failure; `scope: common` skill does.
6. **Gate scoping** — the collector is a pure function: empty failures on missing directories (L2/L3 contexts) — the audit-side `Skip` scoping is asserted by the IS_WORKSPACE_ROOT guard pattern (lint-level: no direct exit in the check).

Battery: new tests + `bun run test:unit` (full unit suite) + `bun run verify-scripts` + `bun scripts/audit.ts` (exit 0 on the live tree) + `bun run qa-gate` (expect full PASS).

## 6. Risks

- **R1 — audit runtime cost.** The collector walks `scripts/` and both skill trees (a few thousand stats + reads). Measured before landing; if it exceeds ~2 s the check moves behind a `--full-audit`-style flag (not expected: qa-gate step 4 already runs it after a full audit with no perceptible cost).
- **R2 — false positives on the live tree at L1.** The L1 mirror of audit.ts imports qa-gate.ts — both mirrored, so no dangling import (§2). The change itself produces identical collector output on both layers.
- **R3 — duplicate reporting with qa-gate.** Intentional: qa-gate step 4 remains the Phase-6 verdict; the audit gate is the early signal. Same collector means the two can never contradict.
- **R4 — import cycle.** qa-gate.ts imports only `lib/encoding-utils.ts`; audit.ts importing qa-gate.ts creates no cycle.
