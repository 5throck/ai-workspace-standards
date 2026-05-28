# Meeting Transcript
**Date**: 2026-05-28
**Topic**: audit.sh / audit.ps1 sync gap — intentional drift policy structural flaw and remediation
**Participants**: pm, architect, automation-engineer, docs-writer
**Rounds**: 2
**Orchestrator**: PM
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

**PM**: (Opening)

Called this meeting to address: when `check_command_parity()` was added to `audit.sh`, it was not reflected in `audit.ps1`. The user had to point this out. Both files are registered as `drift: intentional` in SCRIPTS.md, which excludes them from `verify-scripts.ts` L0/L1 comparison — but this policy also accidentally exempts the *horizontal* synchronization between the two files.

Round 1: Why does the `intentional drift` policy create this problem — design flaw diagnosis.
Round 2: What structure fixes it — `.sh`/`.ps1` pair synchronization mechanism design.

---

**Architect**: (Round 1)

This is a conceptual confusion in the design. `intentional drift` was designed for the L0→L1 vertical copy relationship — meaning "do not copy this file to templates." But `audit.sh` and `audit.ps1` are a completely different relationship: they are a **horizontal pair** implementing the same functionality for different platforms. Their features must always match.

The `drift` field in SCRIPTS.md does not distinguish these two relationships. When `drift: intentional` is set, **all synchronization checks** are waived — both vertical L0/L1 and horizontal `.sh`/`.ps1`. As a result, when a feature is added to `audit.sh`, `audit.ps1` falls behind with no warning.

`audit.sh` is 289 lines, `audit.ps1` is 243 lines — a 46-line gap with no tool to track when it appeared or what features are missing. There may be other undiscovered differences beyond the parity check.

The `drift` field is one-dimensional and cannot simultaneously express the L0/L1 vertical relationship and the `.sh`/`.ps1` horizontal relationship. The SCRIPTS.md schema needs extension.

---

**Automation-Engineer**: (Round 1)

Confirming at the implementation level: `verify-scripts.ts` pair check (around line 149) **only verifies file existence** — if `.sh` exists, does `.ps1` exist? Content synchronization is not checked at all. If a new section is added to `audit.sh`, `verify-scripts.ts` still outputs PASS.

For `drift: intentional` files, even the existence check is skipped. So `audit.sh` and `audit.ps1` currently escape:
1. L0/L1 vertical sync check → exempt (`drift: intentional`)
2. `.sh`/`.ps1` horizontal existence check → exempt (skipped in `drift: intentional` branch)
3. `.sh`/`.ps1` feature sync → no such check exists

Three layers of monitoring evasion.

Proposed solution: add a `pair: audit.ps1` field to SCRIPTS.md, and have `verify-scripts.ts` read this field to compare **section header lists**. Extracting sections delimited by `# ---` and comparing them can detect "sections present in A but absent in B."

---

**Docs-Writer**: (Round 1)

The `pair` field is the right direction. Two documentation points:

First, **redefine `drift: intentional`**. Current SCRIPTS.md column comment: `drift: intentional (L0/L1 divergence is expected, skip drift check)`. This definition has no "what kind of drift." Proposed redefinition:
- `drift: —` → L0/L1 pair must match (default, checked)
- `drift: intentional` → L0-only, no L1 copy needed (vertical relationship exempt)

Add new field:
- `pair: <script-name>` → script that must be functionally identical to this one (horizontal relationship — `.sh`/`.ps1` pair or platform equivalent)

Files with `pair` field receive horizontal sync checks even if `drift: intentional`. The two concepts are orthogonal.

Second, files requiring `pair` relationship: minimum 6 pairs — `audit.sh`/`audit.ps1`, `dev-sync.sh`/`dev-sync.ps1`, `new-project.sh`/`new-project.ps1`, `sync-md.sh`/`sync-md.ps1`, `install-bun.sh`/`install-bun.ps1`, `upgrade-project.sh`/`upgrade-project.ps1`. `pair` must apply independently of `drift` status.

---

**PM**: (Round 1 — Close)

**Core diagnosis**: `drift: intentional` is a one-dimensional policy that exempts both L0/L1 vertical sync and `.sh`/`.ps1` horizontal sync without distinction. There is no mechanism to signal that updating `audit.sh` requires updating `audit.ps1`.

**Latent risk**: the 46-line difference between `audit.sh` and `audit.ps1` may contain additional undiscovered feature gaps beyond the parity check.

Round 2: solution design. Question to automation-engineer: for implementing `pair` in `verify-scripts.ts`, is section-header comparison sufficient, or is a stronger check needed?

---

**Automation-Engineer**: (Round 2)

Section header comparison implementation: extract `# --- Section Name ---` patterns from both files and compare. Sections present in one but not the other → WARN. This is immediately applicable since both files use `# ---` as section delimiters.

However, this alone is **not sufficient**. Sections can exist with different internal logic. Therefore, **two-stage checking**:
1. **Section header comparison** (automated, `verify-scripts.ts`) — detects section absence immediately
2. **Version synchronization rule** (policy) — when one `pair` script's version increments, the other must increment to match. `verify-scripts.ts` compares versions of `pair`-linked scripts and WARNs on mismatch.

Version sync rule is simple to implement and serves as **intentional forcing** — it cannot catch logic differences completely, but ensures "if one is updated, the other must be too."

Question to docs-writer: for existing pairs with version mismatches like `dev-sync.sh v1.3.0` / `dev-sync.ps1 v1.4.0`, how should we handle them when introducing `pair`?

---

**Architect**: (Round 2)

Agree with two-stage checking. Design addition: **`pair` field uses one-directional declaration**. `.sh` files are the `pair` declarers (`.sh` = Unix baseline, `.ps1` = Windows equivalent). `verify-scripts.ts` finds `.sh` files with `pair` field and compares version + sections against the named `.ps1`.

Immediate prerequisite: the current 46-line gap between `audit.sh` and `audit.ps1` must be closed **before** introducing the `pair` mechanism — otherwise the new tool immediately floods warnings. Section-by-section diff to find and fill gaps is the prerequisite work.

---

**Docs-Writer**: (Round 2)

For existing version-mismatched pairs: recommend **"synchronize from this point forward, no retroactive alignment"**. Reasons: past version differences may have been intentional (`.ps1` may have received Windows-specific fixes first); forcing retroactive alignment corrupts change history.

When adding `pair` field to SCRIPTS.md: align both versions to the higher value (or bump both to a new version), then enforce the rule that from this point on, if one increments, the other must too. This is "baseline alignment + forward sync enforcement."

Also: SCRIPTS.md column comments must be updated — add `pair` column and separate the `drift` column description into vertical/horizontal relationship semantics. This document is the policy SSOT.

---

## Action Items

| # | Owner | Deliverable | Phase |
|---|-------|-------------|-------|
| A-01 | automation-engineer | Full section-by-section diff of `audit.sh` ↔ `audit.ps1` — find and sync all remaining feature gaps | Immediate |
| A-02 | automation-engineer | Add `pair` column to SCRIPTS.md for all 6 pairs, align version baselines | Immediate |
| A-03 | automation-engineer | Add `pair` check logic to `verify-scripts.ts` (section header comparison + version sync WARN) | Immediate |
| A-04 | docs-writer | Update SCRIPTS.md column comments — clarify `drift` (vertical) / `pair` (horizontal) semantics | Immediate |
| A-05 | architect | Add `.sh`/`.ps1` pair sync policy to `CONSTITUTION.md §6.5` | Immediate |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | `audit.sh` and `audit.ps1` have identical section headers | `verify-scripts.ts` outputs no section mismatch WARN |
| C-02 | All 6 `.sh`/`.ps1` pairs have `pair` field in SCRIPTS.md with aligned version baselines | Manual SCRIPTS.md review |
| C-03 | `verify-scripts.ts` WARNs when `pair` scripts have version mismatch or section gap | Test with intentionally mismatched version |
| C-04 | `SCRIPTS.md` column comments clearly distinguish `drift` (vertical) from `pair` (horizontal) | Manual doc review |
| C-05 | `CONSTITUTION.md §6.5` contains `.sh`/`.ps1` pair sync policy | Manual doc review |
