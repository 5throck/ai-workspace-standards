# Design: Validator Hardening — Shared-Key Semantic Drift Classification (`--check-drift`) + Grammar-Complete Intentional-Duplicate Parsing (Check D)

**Date**: 2026-09-12
**Status**: Draft (Row 0 Design Gate document per ADR-0074; evidence verified 2026-09-12 by direct code reading, live validator runs, and a whole-fleet classification simulation)
**Source**: PM-dispatched architect task covering governance tickets T-20260912-028 and T-20260912-029
**Spec ID**: 2026-09-12-validator-hardening-drift-marker-design
**Related**: [T-20260912-028](../../tickets/governance/T-20260912-028.yaml), [T-20260912-029](../../tickets/governance/T-20260912-029.yaml), T-20260912-016 (introduced `--check-drift --json`), [ADR-0074](../adr/0074-universal-design-gate.md) (Design Gate), [ADR-0059](../adr/0059-governance-reflection-validators.md) (intentional-duplicate markers), [ADR-0062](../adr/0062-marker-based-doc-propagation-domains.md) (shared parser requirement), [ADR-0031](../adr/0031-l1-l2-fork-model.md) (Fork Model), `docs/templates/common-contract.json` v1.6.0 (`platform_settings`), `scripts/propagate-to-templates.ts`, `scripts/lifecycle-sync-audit.ts`, `scripts/helpers/markers.ts`, `scripts/validate-templates.ts`

---

## Problem Statement

### Ticket T-20260912-028 — `--check-drift` tolerates `gemini-settings` drift wholesale, and exit semantics are inconsistent between modes

`runCheckDrift()` (`scripts/propagate-to-templates.ts:1531-1584`) classifies drift with `isToleratedDriftDomain()` (`:1527-1529`): `return domain.split(' ')[0] === 'gemini-settings'`. Any byte difference between `templates/common/.gemini/settings.json` (L1) and `templates/co-*/.gemini/settings.json` (L2) is therefore tolerated **by domain name alone** — including a tampered or drifted `hooks.SessionStart` hook, which is the one key the L1→L2 mirror (`propagation-map.json` `gemini-settings` domain, "Only ongoing L1→L2 mirror — shared MCP server and hook config must stay identical across all tiers") exists to keep identical.

Exit semantics are additionally inconsistent between output modes (verified live, 2026-09-12):

- **JSON mode** (T-20260912-016, `:1561-1573`): exit 0 = clean, 1 = only tolerated drift, 2 = unexpected drift — a stable CI contract.
- **Human mode** (`:1580-1583`): `process.exitCode = 1` for **ANY** out-of-sync result — tolerated and unexpected drift are conflated at the exit-code level.

A human or a wrapper script reading the human mode's exit code cannot distinguish "intentional overlay, reviewed" from "the shared hook diverged".

**Live drift census (2026-09-12, `bun scripts/propagate-to-templates.ts --check-drift --json`)**: 13 `gemini-settings (<variant>)` entries — 7 byte-identical, 6 drifted: co-abap, co-hr, co-price, co-news, co-safety, co-export. A whole-fleet simulation of the classification proposed below confirms all 6 drifts are additive variant-owned keys (co-abap: `enableAllProjectMcpServers`; co-export/co-hr/co-news/co-safety: `_comment`; co-price: two nested `mcpServers` entries) with the shared key `hooks.SessionStart` deep-equal in every pair — i.e. every current drift is a legitimate intentional overlay, and the check must stay green on the current tree after this change.

### Ticket T-20260912-029 — Check D's hand-rolled regex pollutes the intentional-duplicate registry with prose

`runCheckD()` (`scripts/lifecycle-sync-audit.ts:605`) scans all workspace `.md` files with an inline regex (`:607`):

```js
const PATTERN = /<!--\s*intentional-duplicate:\s*([^—\n]+)\s*—\s*([^;>\n]+)/g;
```

It (a) does **not** require a complete HTML comment (no `-->` anchor — the capture runs past the marker into surrounding prose) and (b) ignores the marker field grammar (`workspace standards §N` name, `source:`, `hash:` fields). Result: the informational registry currently holds **4 phantom entries** parsed out of prose that merely *mentions* the marker syntax (live `--json` run, 2026-09-12):

| Phantom entry | File | Why it matched |
|---|---|---|
| `<name>; source: <path>; hash: <sha256-8> -->…` | `CHANGELOG.md:332` | generic `<name>` placeholder text, then an em-dash later in the same prose line |
| `workspace standards §N -->…` | `CHANGELOG.md:341` | literal `§N` placeholder, then a later em-dash |
| `workspace standards §N — maintained locally ...` | `docs/designs/2026-09-10-marker-engine-remediation-design.md:13` | quoted grammar example inside backticks |
| `workspace standards ... -->…` | `docs/adr/0059-governance-reflection-validators.md:40` | marker mention, then a later em-dash |

The two **real** markers — `templates/common/docs/context.md:403` and `templates/common/docs/variant.context.template.md:151` (both `workspace standards §3 — maintained locally for AI context proximity; source: docs/constitution/03-pr-workflow.md; hash: 18ad2842`) — are drowned out.

This also violates the spirit of ADR-0062, which created the shared parser (`scripts/helpers/markers.ts`) precisely so that "rewrite engine and strict gate agree on marker syntax". The scanner `scanIntentionalDuplicateMarkers()` (`markers.ts:254-302`) already requires the complete one-line comment form (`:280`) plus the `§<digits>` grammar — Check D is the third consumer hand-rolling its own, looser regex.

---

## Goals / Non-Goals

### Goals

- G1 (T-028) — Replace whole-domain `gemini-settings` tolerance with **shared-key semantic validation** driven by `docs/templates/common-contract.json` → `platform_settings`.
- G2 (T-028) — **Unify exit semantics**: one classification pass feeds both human and JSON output; exit 0/1/2 identical in both modes.
- G3 (T-028) — Keep the check **green on the current tree** (all 6 current drifts classify as tolerated overlays; verified by simulation, see Problem Statement).
- G4 (T-029) — Export a pure, grammar-complete `parseIntentionalDuplicateLine()` from the shared parser and refactor `scanIntentionalDuplicateMarkers()` onto it with **no behavior change**.
- G5 (T-029) — Rewire Check D onto the shared parser, dropping the registry from 4 phantom entries to the **2 real markers**, with severity and walk behavior unchanged.
- G6 (both) — Version bumps + SCRIPTS.md registry rows (L0 ×3, L1 ×1) so Checks A/B stay clean; L1 mirror of `lifecycle-sync-audit.ts` refreshed in lockstep.

### Non-Goals

- NG1 — No change to `templates/*/.gemini/settings.json` content themselves (validators only; the 6 overlays stay as they are).
- NG2 — No new CLI flags on either script (SCRIPTS.md flag columns unchanged).
- NG3 — No change to Check D's informational severity (it never becomes an error/warning) and no new registry consumers.
- NG4 — No change to `verify-adr-governance.ts` or the `--marker-rewrite` engine; the markers.ts refactor must be behavior-neutral for them (gates confirm).
- NG5 — **Pre-existing defect, out of scope**: `applyDiffs()` (`propagate-to-templates.ts:645-669`) and `runL0L1Sync()` (`:1587-1628`) never consult `DRY_RUN`, so `--apply --dry-run` executes the scrub-only rewrite path and *writes* L1 files (byte-identical no-ops today — git confirmed clean after a live run on 2026-09-12, but the write-in-dry-run hazard is real). Recommended as a separate hardening ticket; not fixed here because it is unrelated to check-drift classification and fixing it inside this change would blur the audit trail.
- NG6 — No reconciliation of the stale L0-only rows in `templates/common/scripts/SCRIPTS.md` (`helpers/markers.ts` 1.0.0 at `:123`, `propagate-to-templates.ts` 2.12.0 at `:199` — cosmetic; Check B skips L0-only rows at `lifecycle-sync-audit.ts:445-447`).

---

## Semantic-Validation Contract (T-028, normative)

### Source of truth

`docs/templates/common-contract.json` v1.6.0 → `platform_settings`:

| Contract slice | Current content | Role in classification |
|---|---|---|
| `shared.keys` | exactly one key: `hooks.SessionStart` (`validation: "array"`) | must be **present and deep-equal** in both L1 and L2 for drift to be tolerated |
| `claude_only.keys` | 15 keys (`permissions`, `env`, `teammateMode`, `hooks.PreToolUse`, `hooks.PostToolUse`, `hooks.TeammateIdle`, `hooks.TaskCreated`, `hooks.TaskCompleted`, `hooks.PreCompact`, `hooks.WorktreeCreate`, `hooks.UserPromptSubmit`, `hooks.Stop`, `statusLine`, `subagentStatusLine`, `footerLinksRegexes`) | must **not appear** in either `.gemini` settings file (both sides of the pair are `.gemini` files) |
| `gemini_only.keys` | 3 keys | not checked by this domain (both sides are `.gemini` files — presence is correct) |

The contract is **parsed and passed in** by the caller, not read inside the classifier — the classifier stays pure and unit-testable, and the SSOT stays where T-20260912-016's sibling check (`validate-templates.ts` VA-04 `checkPlatformSettingsParity`, `:2912`) already reads it.

### Algorithm

New exported, pure function in `scripts/propagate-to-templates.ts` (top level, **outside** the `if (import.meta.main)` guard at `:1477-1629`, like the existing exports at `:294/:505/:513/:643`):

```ts
export interface SettingsDriftDetail {
  mismatchedSharedKeys: string[];   // shared keys missing on either side or not deep-equal
  leakedClaudeOnlyKeys: string[];   // claude_only keys present in either .gemini file
  parseError: 'L1' | 'L2' | null;   // which side failed JSON.parse
  variantOwnedKeys: string[];       // informational: top-level keys present on one side only
  reasons: string[];                // one human-readable finding per problem
}
export interface SettingsDriftClassification extends SettingsDriftDetail {
  classification: 'tolerated' | 'unexpected';
}
export function classifySettingsDrift(
  l1Raw: string,      // raw text of templates/common/.gemini/settings.json
  l2Raw: string,      // raw text of templates/co-*/.gemini/settings.json
  contract: PlatformSettingsContract | null
): SettingsDriftClassification;
```

Per drifted L1→L2 pair (the pair's paths come from the existing `FileDiff` `sourcePath`/`targetPath`, `:158-164`):

1. Parse both files with `JSON.parse`. Failure on either side → **unexpected** (`parseError` names the side). *Fail-closed.*
2. `sharedKeys` is read from `contract.platform_settings.shared.keys` (nullish coalescing to an empty object when any level is absent). **If the contract is absent, `platform_settings` is missing, or `shared.keys` is empty → unexpected.** Explicit fail-closed rule: an empty/absent shared-key contract cannot prove that a byte difference is an intentional overlay, so every drift becomes unexpected until the contract declares at least one shared key.
3. For each shared key `K`: `v1 = getNestedKey(l1, K)`, `v2 = getNestedKey(l2, K)` (dotted-path helper replicated locally in `propagate-to-templates.ts` — same semantics as `validate-templates.ts:2902-2910`; **not imported across**, a checker importing from another heavyweight checker entry module inverts the dependency direction). If `v1` or `v2` is `undefined` (missing) → **unexpected**. If not deep-equal → **unexpected**.
4. Deep-equal = canonical-JSON comparison (recursively key-sorted `JSON.stringify` on both values). Arrays are **order-sensitive** — hook array order is execution order, so `[A, B]` vs `[B, A]` is a mismatch.
5. For each `claude_only` key `K`: present (via `getNestedKey`) in either file → **unexpected** (claude-only key leaked into a `.gemini` settings file).
6. Only if steps 1-5 all pass → **tolerated**: the residual byte difference is variant-owned overlay space (`_comment`, `mcpServers`, `enableAllProjectMcpServers`, key ordering, nested additions).
7. Domain generalization: drift in any **non**-`gemini-settings` domain has no classifier and is **unexpected** (identical to today's `isToleratedDriftDomain()` fallback for non-gemini domains — fail-closed for future domains). `isToleratedDriftDomain()` (`:1527-1529`) is deleted; it has no other callers (`:1558-1559` only).

### Why contract-driven

Hard-coding `hooks.SessionStart` in `propagate-to-templates.ts` would fork the SSOT: `common-contract.json` already arbitrates platform-settings parity for the variant validator (VA-04), documents *why* each key is shared/excluded, and is the file a future key addition (e.g. a new cross-platform hook) would extend. Reading the key set from the contract makes the drift check and the parity check converge on the same truth, and the fail-closed empty-contract rule guarantees the check degrades to *strict*, never *blind*, if the contract is gutted or the file is missing.

---

## Exit Semantics (T-028)

One classification pass (`runCheckDrift`) produces `classified: Array<FileDiff & { classification?: 'tolerated' | 'unexpected', detail?: SettingsDriftDetail }>`; human and JSON renderers are two views over it.

| Tree state | JSON mode before (T-016) | Human mode before | JSON mode after | Human mode after |
|---|---|---|---|---|
| No drift | 0 | 0 | 0 | 0 |
| Only tolerated drift | 1 | 1 | 1 | 1 |
| Any unexpected drift | 2 | **1 (conflated)** | 2 | **2 (unified)** |

Human output distinguishes the two classes per drifted pair (after the table):

```text
⚠️  gemini-settings (co-hr): intentional overlay — shared keys verified; variant-owned keys differ: _comment
✖  gemini-settings (co-x):   semantic drift — shared key mismatch: hooks.SessionStart
```

plus a summary line (`Total checked / in sync / tolerated overlay / unexpected`). The JSON mode's exit-code contract is unchanged from T-20260912-016 (0/1/2 as before); the **human** mode's exit code intentionally changes for the unexpected case (1 → 2) — that is the point of G2. Consumers needing stable machine exit codes were already directed to `--json` (T-20260912-016); this is documented in the header flag docs as part of the version bump.

### JSON contract (backward-compatible, additive only)

Base shape from T-20260912-016 (`:1564-1572`) is preserved verbatim — `results[].{domain, file, status}` and `summary{total, inSync, toleratedDrift, unexpectedDrift}` keep their names, types, and semantics (`toleratedDrift`/`unexpectedDrift` are now **computed from the classification pass** instead of `isToleratedDriftDomain()`; on the current tree the numbers are identical: 6 / 0). Drifted entries gain additive fields; `in-sync` entries gain none:

```json
{
  "results": [
    {
      "domain": "gemini-settings (co-hr)",
      "file": "settings.json",
      "status": "differs",
      "classification": "tolerated",
      "detail": {
        "mismatchedSharedKeys": [],
        "leakedClaudeOnlyKeys": [],
        "parseError": null,
        "variantOwnedKeys": ["_comment"],
        "reasons": []
      }
    }
  ],
  "summary": { "total": 13, "inSync": 7, "toleratedDrift": 6, "unexpectedDrift": 0 }
}
```

Consumers keying on `status`/`summary` (the T-20260912-016 contract) are unaffected; `variantOwnedKeys` is best-effort informational (top-level key-name set difference — empty for nested-only drift such as co-price's `mcpServers.*` additions).

---

## Check D Hardening (T-029, normative)

### New shared parser function — `scripts/helpers/markers.ts`

```ts
export interface IntentionalDuplicateLine {
  name: string | null;    // text before " — " (or the whole pre-';' segment when no em-dash)
  reason: string | null;  // text after " — " up to the first ';'
  section: string;        // constitution section digits — non-null whenever the object is returned
  source: string | null;  // parseMarkerFields().source
  hash: string | null;    // parseMarkerFields().hash
}
export function parseIntentionalDuplicateLine(line: string): IntentionalDuplicateLine | null;
```

1. **Complete-comment anchor**: body must match `/<!--\s*intentional-duplicate:\s*([^>]+?)-->/` — the marker must close on the same line. A line that merely opens a comment, or prose containing a partial marker, returns `null`.
2. **Field grammar via existing helpers**: `parseSectionNumber()` (`markers.ts:172-175`) must return non-null (`workspace standards §<digits>`) or the result is `null`; `source`/`hash` come from `parseMarkerFields()` (`markers.ts:181-196`). The section-number requirement is the second decisive filter — it is what kills all four phantoms (two carry the literal placeholder `§N`, one carries `<name>`, one carries `workspace standards ...`).
3. **Name/reason split**: the body up to the first `;` is split on the em-dash separator ` — ` (U+2014 with single surrounding spaces). No em-dash → `name` = whole segment, `reason` = `null`. This leniency is deliberate so the refactored scanner's behavior is unchanged (it previously accepted section-bearing markers without an em-dash); Check D's registry falls back to `name` for a missing `reason` (below).
4. CRLF-tolerant: a trailing `\r` after `-->` does not affect the match.
5. Behavior per line is "first match only" (`line.match`, non-global), matching the scanner it feeds.

`scanIntentionalDuplicateMarkers()` (`markers.ts:254-302`) is refactored to call the parser per line (null → skip) while retaining its own body match for the existing `text` field — **no behavior change**: complete-form + section-number were already its exact acceptance conditions (`:280-287`). Its consumers (`verify-adr-governance.ts --strict`, `--marker-rewrite`) are untouched (NG4) and pinned by existing tests (`tests/marker-rewrite.test.ts`, `tests/unit/markers-splice.test.ts`). Header version 1.1.0 → **1.2.0** with a version-history note referencing T-20260912-029, and the header's marker-grammar comment (`:12`) updated to show the full `name — reason; source; hash` grammar.

`helpers/markers.ts` is L0-only (SCRIPTS.md row) — no L1 mirror of the file exists (verified: `templates/common/scripts/helpers/markers.ts` does not exist).

### `runCheckD()` rewiring — `scripts/lifecycle-sync-audit.ts`

- **Kept unchanged**: the workspace-wide `.md` walk and all exclusions — `node_modules`, `.git`, `_archive`, `memory`, dotfiles (`:621`), symlinks (`:622`), generated project dirs containing `AGENTS.md` or `variant.json` (`:628`), `CONSTITUTION.md` (`:634`), depth bound 8 (`:612`) — and the informational severity (never errors/warnings).
- **Replaced**: the inline `PATTERN` (`:607`) with per-line calls to the shared `parseIntentionalDuplicateLine()` (file content split on `\n`; lines scanned in order so `file` stays a whole-file registry of marker lines).
- **Registry entry mapping** (`DuplicateEntry`, `:80-84`): `file` → relative path (existing logic, `:646`); `source` → parsed `source`, falling back to parsed `name` when absent; `reason` → parsed `reason`, falling back to `name`.
- **Expected effect on the current tree**: registry drops from 4 phantom entries to exactly the 2 real markers (`templates/common/docs/context.md:403`, `templates/common/docs/variant.context.template.md:151`).
- Header version 1.8.0 → **1.9.0** with a version-history note referencing T-20260912-029; the Check D JSDoc (`:601-604`) rewritten to describe the shared-parser contract. The file-top doc block does not describe the old regex (it lists Checks A/B/C/E only), so no other header edit is needed beyond the version note.

### Mirror propagation (L0 → L1)

`lifecycle-sync-audit.ts` is **L0+L1** (SCRIPTS.md Layer column) — `templates/common/scripts/lifecycle-sync-audit.ts` must be refreshed so L0↔L1 stay in sync. The only permitted transform is the existing `scrubConstitutionRefs` scrub (`scripts/lib/constitution-scrub.ts`), which the propagator applies automatically.

Mechanism: run `bun scripts/propagate-to-templates.ts --domain scripts --dry-run` first and confirm the out-of-sync list contains **only** `lifecycle-sync-audit.ts`; then `--apply --domain scripts`. Baseline measured 2026-09-12 (pre-implementation): the `scripts` domain reports 56/56 in sync, so after the version bump + Check D change the drift list must contain exactly one file. If other files would be swept in, leave the mirror update to a scoped manual copy and say so in the PR body instead.

> ⚠️ Do **not** use the `--apply … --dry-run` combination as the confirmation step: `applyDiffs()` ignores `DRY_RUN` (NG5), so that combination runs the scrub-only rewrite path and writes L1 files (byte-identical no-ops today, verified: `git status` clean after a live run on 2026-09-12). The plain `--dry-run` form (no `--apply`) is genuinely read-only for the drift list.

### SCRIPTS.md registry updates (Checks A/B)

| File | Row | Change |
|---|---|---|
| `scripts/SCRIPTS.md` | `helpers/markers.ts` (`:112`) | version 1.1.0 → **1.2.0** |
| `scripts/SCRIPTS.md` | `lifecycle-sync-audit.ts` (`:178`) | version 1.8.0 → **1.9.0** |
| `scripts/SCRIPTS.md` | `propagate-to-templates.ts` (`:186`) | version 2.13.0 → **2.14.0**; flags column unchanged (no new flags — NG2) |
| `templates/common/scripts/SCRIPTS.md` | `lifecycle-sync-audit.ts` (`:191`) | version 1.8.0 → **1.9.0** (Check B lockstep: the only bumped script with an L1 file) |

`propagate-to-templates.ts` is L0-only — no L1 mirror and no L1 file row obligation for it or `helpers/markers.ts` (their existing L1-registry rows are informational and stale; NG6).

### Version/header bookkeeping summary

| File | Version | Header edits |
|---|---|---|
| `scripts/propagate-to-templates.ts` | 2.13.0 → 2.14.0 | v2.14.0 history note (T-20260912-028); `--check-drift`/`--json` flag docs (`:39-44`) rewritten: semantic shared-key classification, unified 0/1/2 in both modes, additive JSON fields |
| `scripts/helpers/markers.ts` | 1.1.0 → 1.2.0 | v1.2.0 history note (T-20260912-029); marker-grammar comment updated |
| `scripts/lifecycle-sync-audit.ts` | 1.8.0 → 1.9.0 | v1.9.0 history note (T-20260912-029); Check D JSDoc updated |

---

## Proposed Changes

| # | File | Action | Change |
|---|------|--------|--------|
| 1 | `scripts/propagate-to-templates.ts` | Modify | `classifySettingsDrift()` + local `getNestedKey()`/deep-equal (exported, outside `import.meta.main`); delete `isToleratedDriftDomain()`; `runCheckDrift()` single classification pass; unified exit codes; JSON additive fields; version 2.14.0 + header docs |
| 2 | `scripts/helpers/markers.ts` | Modify | `parseIntentionalDuplicateLine()` export; `scanIntentionalDuplicateMarkers()` refactor (behavior-neutral); version 1.2.0 + grammar comment |
| 3 | `scripts/lifecycle-sync-audit.ts` | Modify | `runCheckD()` per-line shared-parser wiring; registry mapping; version 1.9.0 + Check D JSDoc |
| 4 | `templates/common/scripts/lifecycle-sync-audit.ts` | Modify | L1 mirror refresh via `--apply --domain scripts` (scrub-only transform) |
| 5 | `scripts/SCRIPTS.md` | Modify | Version cells: markers 1.2.0, lifecycle-sync-audit 1.9.0, propagate-to-templates 2.14.0 (no flag changes) |
| 6 | `templates/common/scripts/SCRIPTS.md` | Modify | Version cell: lifecycle-sync-audit 1.9.0 (Check B lockstep) |
| 7 | `tests/unit/check-drift-classification.test.ts` | Create | Pure-function tests for `classifySettingsDrift()` (see Test plan) |
| 8 | `tests/unit/intentional-duplicate-parser.test.ts` | Create | Parser tests incl. the 4 real prose lines → `null` (see Test plan) |
| 9 | `CHANGELOG.md` | Modify | One `[Unreleased]` entry covering both tickets |

Execution order: rows 1-3 are independent of each other; row 4 after row 3; rows 5-6 after rows 1-3; rows 7-8 alongside rows 1-2 (tests import the new exports); row 9 at PR time via `/changelog`. Single PR (CONSTITUTION §3.3 sequential-branch rule).

---

## Test Plan

Both scripts are import-safe: side-effectful dispatch sits under `if (import.meta.main)` (`propagate-to-templates.ts:1477-1629`; `lifecycle-sync-audit.ts` since v1.8.0), and the new functions are top-level exports like the existing `collectDiffsL1L2` (`:513`). Tests use `bun:test` with `../../scripts/...` imports (convention of `tests/unit/lifecycle-sync-checks.test.ts`, `tests/unit/markers-splice.test.ts`).

### `tests/unit/check-drift-classification.test.ts` (new)

| Case | Fixture (inline strings) | Expected |
|---|---|---|
| Shared key equal + extra variant keys | L1 = `{hooks:{SessionStart:[X]}}, mcpServers:{a}`; L2 = same SessionStart + `_comment`, `mcpServers:{a,b}` | `tolerated`; `variantOwnedKeys` lists the extras |
| Shared key value differs | SessionStart array differs between sides | `unexpected`; `mismatchedSharedKeys = ["hooks.SessionStart"]` |
| Shared key missing in L2 | L2 lacks `hooks.SessionStart` | `unexpected`; key listed as mismatched |
| Invalid JSON in L2 | L2 = `{ not json` | `unexpected`; `parseError = "L2"` |
| Empty shared keys in contract | `shared.keys = {}` (and contract `null` / `platform_settings` absent variants) | `unexpected` — **fail-closed rule stated explicitly in the test name/assertion** |
| claude_only leak | `permissions` present in either side | `unexpected`; `leakedClaudeOnlyKeys` populated |
| Array order sensitivity | SessionStart `[A,B]` vs `[B,A]` | `unexpected` (order is execution order) |

### `tests/unit/intentional-duplicate-parser.test.ts` (new)

| Case | Fixture | Expected |
|---|---|---|
| Real marker parses | exact line from `templates/common/docs/context.md:403` | `{ name: "workspace standards §3", reason: "maintained locally for AI context proximity", section: "3", source: "docs/constitution/03-pr-workflow.md", hash: "18ad2842" }` |
| Prose mentions → null | the actual lines `CHANGELOG.md:332`, `CHANGELOG.md:341`, `docs/designs/2026-09-10-marker-engine-remediation-design.md:13`, `docs/adr/0059-governance-reflection-validators.md:40` (copied verbatim into the test) | `null` for all four |
| Missing closing `-->` | `<!-- intentional-duplicate: workspace standards §3 — reason; source: p; hash: 18ad2842` (unterminated) | `null` |
| CRLF tolerance | real marker line with trailing `\r` | parses identically |
| Scanner parity | run `scanIntentionalDuplicateMarkers()` over the repo `templates/` tree | exactly 2 markers, at the two known file:line locations (pins the no-behavior-change refactor) |

---

## Validation Plan (gates after implementation)

1. `bun test` (root tests only) — new tests + existing green (`tests/unit/markers-splice.test.ts`, `tests/unit/lifecycle-sync-checks.test.ts`, `tests/unit/propagate-to-templates.test.ts`, `tests/marker-rewrite.test.ts` cover the regression surface).
2. `bun scripts/audit.ts` — full QA gate.
3. `bun scripts/validate-templates.ts` — template-tree checks unaffected.
4. `bun scripts/verify-scripts.ts --verify` — Check A/B registry consistency after the version bumps.
5. `bun scripts/propagate-to-templates.ts --check-drift --json` — exit **0**; `summary` = `{total: 13, inSync: 7, toleratedDrift: 6, unexpectedDrift: 0}`; all 6 drifted entries carry `classification: "tolerated"`.
6. `bun scripts/propagate-to-templates.ts --check-drift` (human) — exit **0**, `⚠️ intentional overlay` lines for the 6 overlays (parity with JSON mode).
7. `bun scripts/lifecycle-sync-audit.ts --json` — 0 errors; Check D registry = exactly the 2 real markers.
8. `bun scripts/propagate-to-templates.ts --domain scripts --dry-run` — out-of-sync list contains **only** `lifecycle-sync-audit.ts`; then `--apply --domain scripts` refreshes the L1 mirror.
9. Optional negative proof (manual, with immediate revert): perturb `hooks.SessionStart` in one variant settings copy → `--check-drift --json` exits **2** with the key listed as mismatched; restore.

---

## Platform Impact (MANDATORY)

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | None | No `.claude/` commands, skills, hooks, or settings change; both scripts are platform-neutral validators |
| Antigravity (GEMINI.md) | None — justification: the change only alters how validators **read** `.gemini/settings.json` files; no `.gemini/` content, command, skill, or agent file is created or modified, and generated-project behavior is unchanged | N/A |
| templates/common | changes required | `templates/common/scripts/lifecycle-sync-audit.ts` (L1 mirror refresh, scrub-only transform), `templates/common/scripts/SCRIPTS.md` (lifecycle-sync-audit row) |

---

## Risks / Trade-offs

- **Contract coupling cuts both ways**: if `platform_settings.shared.keys` is ever emptied or the contract file removed, check-drift flips all 6 current overlays to `unexpected` (exit 2). This is intentional fail-closed behavior (an empty contract means nothing proves overlay intent), and the dedicated test case pins it so the semantics can't silently regress.
- **Stricter shared-key equality creates a new failure mode**: a legitimate one-sided change to `hooks.SessionStart` now exits 2 (both modes) until L1/L2 are aligned. That is exactly the drift the only L1→L2 mirror exists to prevent — the check working as designed, but it converts a previously silent state into a gate failure. The 2026-09-12 fleet simulation shows zero current exposure.
- **Human-mode exit-code change** (unexpected drift: 1 → 2): any wrapper keying on the human mode's exit code and treating 1 as "unexpected" would misread tolerated-only runs as clean. Mitigation: `--json` remains the CI contract (T-20260912-016); the flag docs and CHANGELOG call out the unification.
- **Phantom-kill relies on the `workspace standards §<digits>` grammar**: a future intentional-duplicate marker citing a non-constitution source would be invisible to Check D's registry. Accepted: the marker grammar is defined by ADR-0059 around constitution sections, and Check D is informational only; `verify-adr-governance.ts` owns governance enforcement.
- **`applyIntentionalDuplicateRewrites` / `--marker-rewrite` untouched** (NG4): the markers.ts refactor is provably behavior-neutral (complete-form + section-number were already the scanner's conditions) and pinned by the scanner-parity test.
- **Registry count change is observable**: anything tracking "Check D registry size = 4" sees 2. Expected improvement; no known consumer.
- **Performance**: classification reads 13 small JSON files once per run — negligible against the existing diff walk.

## Accessibility

**Explicit exemption** (required for non-UI work per AGENTS.md §5.1 Design Gate): this is backend validator hardening with no user-facing UI, CLI visual surface beyond plain-text terminal lines, or generated-document interaction. No keyboard, screen-reader, contrast, motion, or target-size impact; no accessibility verification method applies beyond the existing terminal-output conventions.

## Governance

- **Tickets**: T-20260912-028 (`--check-drift` shared-key semantic validation + unified exit semantics), T-20260912-029 (Check D grammar-complete parsing via shared parser).
- **Spec ID**: `2026-09-12-validator-hardening-drift-marker-design` (registered via `scripts/spec-register.ts --source manual --status implemented`).
- **Design Gate**: Row 0 document per ADR-0074 (Universal Design Gate); dispatched by PM; implementation to be executed by automation-engineer under PM verification (`bun scripts/audit.ts` per phase-4 loop).
- **Boundary note**: touches L0 scripts + their L1 mirrors + registry/test files — the standard propagation surface, not a templates-boundary exception.

## Open Questions

- None blocking implementation. For the record: the `--apply --dry-run` write-path defect (NG5) is deliberately deferred to a future ticket — fixing it here would expand the blast radius of a validator-hardening change into the propagator's apply/dry-run contract.
