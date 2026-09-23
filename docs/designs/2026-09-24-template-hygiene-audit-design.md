# Design: Template-Tree Artifact Hygiene Audit Check

**Author**: architect
**Date**: 2026-09-24
**Status**: Implemented (2026-09-24 — delivered with the audit.ts hygiene check in the same change set; see Amendment history)
**Related**: ADR-0074 (Universal Design Gate), ADR-0065 (accessibility sections), ADR-0070 (preview verification), ADR-0079 (ASD-STE100 instruction standard), `scripts/audit.ts`, `scripts/new-project.ts`, `scripts/create-l3-scaffold.ts`, `scripts/helpers/scaffold-markers.ts`

## Summary

On 2026-09-24 an 18 MB `node_modules/` tree (a `vite` dev dependency) plus a `dist/` directory were found and deleted inside `templates/co-design/playground/`. No audit check flags artifact accumulation in the `templates/` tree, so the artifacts sat invisibly (gitignored, 0 tracked files) until manual cleanup. This design adds one read-only check to `scripts/audit.ts`: scan `templates/` for known artifact **directories** and `Warn` on each finding. The check is Warn-only, never deletes, and no-ops in variant projects that have no `templates/` directory, preserving the core-script byte-identity rule (AGENTS.md, "Pluggable Variant Audit Hooks").

> **Amendment 1 (2026-09-24, post-implementation feedback)**: the original design also flagged artifact FILES (`bun.lock`, `bun.lockb`, `package-lock.json`, `propagation-map.json`) by name. Implementation falsified that half — all four basenames occur in `templates/` as git-TRACKED template assets (see Decision 1), producing 6 permanent false-positive Warns from day one. The file half is dropped; the check flags the five artifact directories only. See [Amendment history](#amendment-history).

---

## Background (live observation, 2026-09-24)

- `templates/co-design/playground/node_modules/` (18 MB, `vite` dev dependency) and `templates/co-design/playground/dist/` existed as local-only artifacts. Both were gitignored (root `.gitignore` line 52 plus the playground's own `.gitignore`; `git ls-files` showed 0 tracked files under them). They were deleted on 2026-09-24; the `templates/` tree is now clean (verified: 0 matching directories).
- Cause: someone ran `bun install` inside the template's playground during template development. Nothing records or flags this at the source; the artifacts only matter because of what ships downstream.
- Downstream defenses already exist (defense-in-depth at the delivery points):
  - `scripts/new-project.ts` copyDir skips `NEW_PROJECT_COPY_SKIP_ENTRIES` = `['node_modules', '.gateguard-state']` at every level (`scripts/helpers/scaffold-markers.ts` line 240), and a purge step at the propagation point (new-project.ts ~line 758, SKIP set `node_modules/.git/.venv/.bun/dist/build`, depth cap 8) removes them from the scaffold.
  - `scripts/create-l3-scaffold.ts` overlay exclude (~line 243, `L3_COMMON_OVERLAY_EXCLUDE`, scaffold-markers.ts line 233) additionally lists `bun.lock`, `propagation-map.json`, `.DS_Store`, `.gateguard-state`, and `package.json` as workspace-only.
  - `scripts/audit.ts` sweeps `templates/` recursively for **Windows device-name files only** (SWEEP_SKIP_DIRS at audit.ts:2219, sweep at audit.ts:2221; depth cap 8). It does not look at dependency or build artifact directories.
- **The gap**: nothing at the SOURCE (the `templates/` tree) flags artifact accumulation. Re-running `bun install` inside any template playground re-creates the 2026-09-24 condition silently. Detection currently requires a human noticing disk growth.

## Goals

1. Detect dependency/build artifact accumulation in `templates/` at every audit run.
2. Keep the check read-only, Warn-only, and zero-noise on a clean tree.
3. Preserve `scripts/audit.ts` byte-identity across L0 and all L2/L3 variant projects.

## Non-goals

1. No deletion or mutation of any file — auto-delete is rejected (Decision 2).
2. No changes to `new-project.ts`, `create-l3-scaffold.ts`, or `scaffold-markers.ts` — downstream behavior is unchanged.
3. No enforcement of parity between this check's artifact list and the downstream exclusion lists (drift there is a separate future concern).
4. No scanning outside `templates/` — the workspace root already has a stray-artifact check.

## Requirements

(ASD-STE100 per ADR-0079: one instruction per sentence, imperative, present tense.)

- **R1** — Run the scan only when `templates/` exists.
- **R2** — Scan every directory and file under `templates/`.
- **R3** — Flag each artifact directory at its topmost occurrence.
- **R4** — *(Removed — Amendment 1. Originally: flag artifact files by exact name at any depth. Tracked template assets falsified name-based file flagging.)*
- **R5** — Report one `Warn` per flagged artifact directory. Include the full path and a remediation hint.
- **R6** — Report one `Pass` when the scan finds no artifacts.
- **R7** — Do not descend into a flagged artifact directory.
- **R8** — Apply a recursion depth cap of 8.
- **R9** — Perform read-only operations only. Never delete or modify any file.
- **R10** — Emit no output when `templates/` does not exist.

## Design decisions

### Decision 1 — Artifact flag set

**Picked (as amended)** — directories only: `node_modules`, `dist`, `build`, `.venv`, `.bun`. No artifact-file names are flagged (Amendment 1). `package.json` and all lockfiles stay allowed.

Every picked entry is a directory excluded by at least one downstream delivery path, so presence in `templates/` is always a hygiene regression, never a tracked asset:

| Entry | Downstream evidence | Picked? |
|---|---|---|
| `node_modules/` | new-project copyDir skip (every level) + purge SKIP + L3 overlay exclude | Yes |
| `dist/`, `build/` | new-project purge SKIP (`node_modules/.git/.venv/.bun/dist/build`) | Yes |
| `.venv/`, `.bun/` | new-project purge SKIP | Yes |
| `package.json` | Hand-authored, git-tracked, template content | **Allowed** |

**Falsified by the tracked tree (Amendment 1, verified 2026-09-24)** — the original design also flagged artifact FILES (`bun.lock`, `bun.lockb`, `package-lock.json`, `propagation-map.json`) by exact name at any depth. Implementation proved all four basenames occur in `templates/` as git-TRACKED template content, so name-based file flagging yields 6 permanent Warns on a clean tree and violates Goal 2 (zero-noise):

| Tracked path | Evidence |
|---|---|
| `templates/co-game/projects/{pacman,portal,bubble-bobble,donkey-kong}/bun.lock` | Template content, commit `d551e96a` (verified via `git ls-files`) |
| `templates/common/bun.lock` | Deliberately maintained, dependabot sync commit `7df3b437` |
| `templates/common/scripts/propagation-map.json` | Actively maintained, PM-03 commit `60686c8f` |

The same basenames are also tracked at the workspace root (`bun.lock`, `scripts/propagation-map.json`), confirming that in this workspace a file NAME is not a reliable artifact signal. Zero-noise file flagging would require git-awareness (per-finding `git ls-files` checks) — complexity that buys nothing, because the directory check already covers the real leak vector: any stray `bun install` produces `node_modules/`, which the dir check flags. A residual lockfile with no `node_modules/` remains a hypothetical.

The original L3 overlay-exclude evidence for `bun.lock`/`propagation-map.json` was about TOP-LEVEL entries of `templates/common/` only (`readdirSync` of the overlay root), while the tracked occurrences are nested (`templates/common/bun.lock` is top-level and deliberate; `scripts/propagation-map.json` is nested). Name-at-any-depth flagging over-matched tracked content in both cases.

**Trade-offs considered**

| Option | Pro | Con | Decision |
|---|---|---|---|
| 5 artifact directories only | Every entry has delivery-path evidence; zero Warns on the current tree (AC4 satisfiable); covers the observed leak vector (2026-09-24 was a directory; installs always produce `node_modules/`) | Misses hypothetical stray lockfiles without `node_modules/` | **Picked (Amendment 1)** |
| Original: dirs + 4 artifact files | Wider net on paper | 6 tracked template assets are false positives from day one; zero-noise needs git-awareness per finding | **Falsified — dropped** |
| Union with sweep skip list (`+ .next`, `coverage`) | Wider net | No delivery path excludes them; speculative entries decay into noise | Rejected |
| Import `NEW_PROJECT_COPY_SKIP_ENTRIES` from scaffold-markers.ts | Single constant | Different semantics (delivery exclusion vs source hygiene); the audit set is informed by three lists; one consumer today does not justify a new contract constant | Rejected — use a local `Set` with a comment cross-referencing all three downstream lists (scaffold-markers.ts:233/240/243, new-project.ts:~758) AND this amendment's tracked-asset evidence, so future readers can re-derive both consistency and the file-half falsification |

### Decision 2 — Severity: Warn-only, never auto-delete

**Picked** — `Warn` per finding, no deletion. `Pass` when clean.

- Downstream purge (new-project.ts ~line 758) already prevents user-facing breakage, so presence at source is a hygiene regression signal, not an outage. A Warn informs without blocking template-development iteration — the 2026-09-24 artifacts appeared precisely while someone was legitimately working inside a template playground; a hard Fail would have blocked `/sync` and the audit pipeline mid-task.
- Auto-delete risks corrupting a future template that legitimately tracks a build output: `rm` cannot distinguish "untracked `dist/` residue" from "tracked `dist/` the template ships". The tracked/untracked distinction is invisible to a directory name.
- **Precedent distinction**: the device-name sweep uses Warn **with** auto-delete (audit.ts:2221 region), but only because `nul`/`con` files are normally un-deletable on Windows and carry zero legitimate content. That rationale does not transfer to `node_modules/`, which any script can delete and which can shadow tracked content.
- Promotion path: revisit `Fail` promotion after one soak period if recurrence is observed. Documented as a TODO comment in the check (mirrors the august-regression-coverage design's promotion criteria pattern).

**Trade-offs considered**

| Option | Pro | Con | Decision |
|---|---|---|---|
| Warn-only, read-only | Zero destructive risk; starts clean; surfaces at every audit run | Does not self-heal | **Picked** |
| Fail | Forces immediate cleanup | Blocks audits during legitimate playground iteration; no false-positive mode today but no self-healing either | Rejected for initial rollout |
| Warn + auto-delete | Self-healing | rm on a name-based match can destroy tracked content in a future template | Rejected |

### Decision 3 — Placement and conventions

**Picked** — a new self-contained check block in `scripts/audit.ts`, placed immediately after the `> nul` redirect lint check (the stray-artifact region, ~lines 2190–2290), inside its own `if (!LIFECYCLE_ONLY)` guard (`LIFECYCLE_ONLY` defined at audit.ts:129).

Conventions to follow (all already established in this file):

- Report via the existing `Pass`/`Warn`/`Fail` helpers only.
- Artifact directory set as a `Set` constant (mirrors `SWEEP_SKIP_DIRS`, audit.ts:2219).
- Depth cap 8 (mirrors the sweep guard, audit.ts:2221, and new-project.ts's purge).
- Comments state WHY, cite live observations with dates (mirrors the 2026-08-17 `templates/co-deck/nul` comment and this design's 2026-09-24 observation).

**Trade-offs**: inside the existing sweep function (rejected — different artifact semantics and different remediation, and the sweep's loop currently targets files only); separate top-level function like `checkShellInjectionPatterns()` (viable, but the stray-artifact region is this check's natural home and its guards are already `if (!LIFECYCLE_ONLY)` blocks, not functions — follow the local pattern).

### Decision 4 — Core-script standardization constraint (CRITICAL)

`scripts/audit.ts` must remain byte-identical across the L0 workspace root and all L2/L3 variant projects (AGENTS.md, "Pluggable Variant Audit Hooks and Integrity Protection"; modified core scripts fail L3→variant reconciliation). Variant projects have **no** `templates/` directory.

**Picked** — the check guards with `fs.existsSync(TEMPLATES_DIR)` and emits nothing when absent (R1/R10), mirroring the existing existence guards in audit.ts. The scan is read-only, so it is equally safe in any checkout. Propagation is automatic: the implementation lands only in L0 `scripts/audit.ts`; the standard L0→L1 dev-sync pipeline publishes it to `templates/common/scripts/audit.ts`. No manual copy — manual edits would break byte-identity.

### Decision 5 — Recursion scope

**Picked** — full recursive walk of `templates/` (all `templates/co-*` variants plus `templates/common`, and any future entry — iterate directory entries, never hardcode variant names), depth cap 8, skip descending into flagged directories (R7 — `node_modules/` alone can hold 10k+ entries; flag once at topmost occurrence, then `continue`, exactly mirroring the sweep's `SWEEP_SKIP_DIRS` behavior at audit.ts:2221). Swallow unreadable directories with a `try/catch` return (mirrors the sweep).

## Files to change (automation-engineer, follow-up PR)

| File | Action | Description |
|---|---|---|
| `scripts/audit.ts` | modify | Add the template-artifact hygiene check block per Decisions 1–5 |
| `templates/common/scripts/audit.ts` | modify (via pipeline only) | Published by dev-sync L0→L1 propagation — never hand-edit |
| `docs/designs/2026-09-24-template-hygiene-audit-design.md` | create | This document |
| Spec registry (`docs/specs/registry.json`) | modify | Registered via `spec-register.ts` (done at design time) |

## Platform Impact (MANDATORY)

| Platform | Impact | Files Affected |
|---|---|---|
| Claude Code | None | N/A — no `.claude/` surface changes |
| Antigravity (GEMINI.md) | None | N/A — no `.agents/` surface changes; the check is platform-neutral TypeScript run by `bun scripts/audit.ts` in every platform's audit path |
| templates/common | Propagation required | `templates/common/scripts/audit.ts` — via dev-sync L0→L1 publishing only; byte-identical with L0 is enforced by reconciliation |

## Acceptance criteria

(ASD-STE100 per ADR-0079. Use a scratch template variant; remove every scratch artifact after each step.)

- [ ] **AC1** — Create an empty `templates/<any-variant>/node_modules/` directory. Run `bun scripts/audit.ts`. Verify exactly one `Warn` names that path. Remove the directory. *(Verified working by automation-engineer, 2026-09-24.)*
- [ ] **AC2** — Run the audit on the unmodified tree. Verify no `Warn` names `templates/common/bun.lock`, `templates/co-game/projects/*/bun.lock`, or `templates/common/scripts/propagation-map.json`. *(Amendment 1 — tracked template assets must not warn.)*
- [ ] **AC3** — Create `templates/<any-variant>/node_modules/deep/nested/x.js`. Run the audit. Verify one `Warn` for the `node_modules` path and no per-file warnings inside it. *(Verified working by automation-engineer, 2026-09-24.)*
- [ ] **AC4** — Run `bun scripts/audit.ts` on the unmodified tree. Verify the check emits one `Pass` and zero `Warn`s. *(Satisfiable again after Amendment 1 — the original file half made this unsatisfiable with 6 permanent false-positive Warns.)*
- [ ] **AC5** — Temporarily rename `templates/`. Run the audit. Verify no output and no error from this check. Restore `templates/`.
- [ ] **AC6** — Re-run the audit with a scratch `node_modules/` present. Verify the directory still exists after the run.
- [ ] **AC7** — Run the sync pipeline. Verify `scripts/audit.ts` and `templates/common/scripts/audit.ts` are byte-identical.

## Accessibility exemption (ADR-0065)

This design covers a backend audit-script check with no user-facing interface. Per ADR-0065, non-UI work is exempt from the Accessibility section requirement. Exemption applies to all deliverables in this spec: no WCAG targets, interaction areas, or verification methods are defined.

## Preview-verification exemption (ADR-0070)

This design produces no rendered UI. Per ADR-0070, non-UI work is exempt from the preview-verification requirement. Verification is by the command-line acceptance criteria above (AC1–AC7); no breakpoint or interaction evidence applies.

## Open questions

None. All decisions are resolved in this document; implementation proceeds without further design input.

## Amendment history

### Amendment 1 — 2026-09-24 (post-implementation feedback; drop the artifact-file half)

**Trigger**: automation-engineer's implementation verification. The DIRECTORY half of Decision 1 passed all probes (one Warn at topmost occurrence, no descend, read-only confirmed, no-op guard confirmed). The FILE half was falsified by the tracked tree: `git ls-files` shows `bun.lock` tracked as template content under `templates/co-game/projects/{pacman,portal,bubble-bobble,donkey-kong}/` (commit `d551e96a`) and at `templates/common/bun.lock` (dependabot sync `7df3b437`), and `propagation-map.json` tracked at `templates/common/scripts/propagation-map.json` (PM-03 `60686c8f`). With the original file set, AC4 was unsatisfiable: 6 permanent Warns from day one, violating Goal 2. The original claim "zero false positives on current tree" was false for the file half; this amendment restores it for the directory half.

**Decision (architect, concurring with PM recommendation)**: narrow the artifact set to the five directories (`node_modules`, `dist`, `build`, `.venv`, `.bun`) and drop the artifact-file Set entirely.

1. The observed leak vector (2026-09-24) was a directory. Any stray `bun install` also produces `node_modules/`, so the dir check already catches installs; a residual lockfile without `node_modules/` is a hypothetical.
2. This workspace legitimately tracks `bun.lock` as a template asset in two locations, so name-based file flagging cannot be zero-noise without git-awareness (per-finding `git ls-files` checks) — complexity that covers a case the dir check already handles.

**Doc changes**: Summary note added; R4 removed (numbering kept stable); Decision 1 rewritten (files moved to a falsified-evidence subsection); Decision 3 wording (one Set constant); AC2 replaced with a tracked-asset non-flagging test; AC4 reworded (satisfiable again). **Spec status**: remains `proposed`; automation-engineer aligns the implementation (remove the file half) and moves the spec to `implemented` after re-verification. The uncommitted `audit.ts` edit stays in place; no downstream files change.
