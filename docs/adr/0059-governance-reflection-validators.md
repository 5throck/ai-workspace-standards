---
status: Accepted (Amended 2026-08-23)
date: 2026-08-23
author: PM + Automation Engineer
---

# ADR-0059: Governance Reflection Validators (Stage 1)

## Context

A 2026-08-23 governance review found **downward distribution automated** but **upward reflection manual** — a gap that let ADR-0057's country-profile mechanism land via PR #612 with **zero pointers from the constitution layer**. A manual follow-up PR (#616) was needed to wire the mechanism into the constitution hub (§4.3 Country ≠ Language, §6.8 Country-Scoped Skills, §7.3.5 Target Country Selection), `docs/governance/variant-contract.md`, and `templates/common/docs/context.md`.

The observed incident was not a one-off — it's a structural risk in the documentation stack:

- **Automated downward flows** (propagation-map, resolve-variants, upgrade-project) ensure changes in workspace-root files reach all templates.
- **No automated upward flow** ensures the governance layer (CONSTITUTION.md, docs/constitution/, docs/governance/) discovers new ADRs or mechanisms.

This ADR addresses the gap with a **WARN-only detection mechanism** — not auto-writing governance prose (which is judgment-heavy) — using the same ADR-0055 playbook that introduced `--spec-check`.

## Decision

### 1. Stage 1: ADR→Governance Linkage Check

A new validator script `scripts/verify-adr-governance.ts` enforces the **upward reflection** rule:

- **Rule**: All Accepted ADRs dated **ON OR AFTER 2026-08-23** must be referenced from at least one governance doc (CONSTITUTION.md, docs/constitution/, docs/governance/).
- **Detection**: An ADR is "linked" if its canonical form (`ADR-00NN`) or its literal filename appears in any governance corpus file.
- **WARN-only**: The script exits 0 on findings (prints `[WARN]` lines) and exits 1 only on operational failure (e.g., docs/adr missing).
- **Grandfathering**: ADRs dated **BEFORE 2026-08-23** are exempt (avoids ~50-file backfill noise). From the cutoff forward, new ADRs require frontmatter `status:` + `date:`.

**Wiring**: The check is flag-gated in `scripts/audit.ts` as `--governance-check`, mirroring the ADR-0055 `--spec-check` pattern. Since the Stage 2 amendment below (2026-08-23), `dev-sync.ts` step 3.97 invokes `verify-adr-governance.ts --strict` as a **blocking gate** on ADR-linkage findings; `audit.ts --governance-check` remains the non-blocking diagnostic.

**Exit semantics**:

- `verify-adr-governance.ts`: WARN-only by default (exit 0 on findings, exit 1 only on operational failure); with `--strict` (1.2.0, Stage 2), exit 1 on ADR-linkage findings — see the Amendment below. (marker-drift blocking added by Stage 2b — see the second Amendment below)
- `audit.ts`: Fails (exit 1) only if the spawned script exits non-zero (operational error) — findings themselves don't block audit.

### 2. Stage 1b: Intentional-Duplicate Marker Hashes (Follow-up PR)

The 9 `<!-- intentional-duplicate: workspace standards ... -->` markers in template **context.md** files (common §3 Git/PR Workflow; co-abap/co-design/co-develop/co-game/co-security/co-work §8 Coding Guidelines; `variant.context.template.md` ×2) mark sections maintained locally as duplicates of constitution sections — but carry no hash, so source drift is undetectable. Stage 1b (implemented in a follow-up PR to keep this PR bounded to the linkage validator) extends each marker with the sha256-8 hash of its source section (`docs/constitution/03-pr-workflow.md` for §3, `docs/constitution/08-coding-guidelines.md` for §8) and adds the drift check to `verify-adr-governance.ts` itself — WARN on source-hash mismatch, meaning "the constitution section changed after this duplicate was last reviewed". README body drift is a separate, already-solved problem (`verify-readme-sync.ts` v1.2.0, ADR-0013).

### 3. L0-Only Boundary (No Propagation)

Per ADR-0057's L0-leakage check and the L0→L1→L2 propagation rules, this machinery **never propagates to templates**:

- `verify-adr-governance.ts` is L0-only (no `propagation-map.json` entry).
- Templates inherit governance prose via downward flows (propagation-map, resolve-variants, upgrade-project), not via this validator.
- The validator enforces that new ADRs are **referenced** from governance docs, not that the governance prose itself is template-level code.

### 4. Rejected Alternatives

| Alternative | Why rejected |
|-------------|--------------|
| **ADR frontmatter retrofit + 58-file backfill** | Linkage only needs status+date **going forward**; backfill is high-effort, low-value (grandfathering cutoff instead). |
| **Constitution last-reviewed footers + 12-month staleness WARN** | The observed incident was **missing linkage**, not stale review — unverifiable ritual that wouldn't have caught ADR-0057's gap. |
| **Auto-generated ADR index** | Convenience feature, not gap-closure — an index doesn't ensure governance prose **discovers** or **references** new ADRs. |
| **Auto-writing governance prose** | Judgment-heavy — requires natural-language generation of constitutional text, which is error-prone and context-sensitive. Detection-only is safer. |
| **ERROR severity on day one** | ADR-0055's playbook: WARN-only in Stage 1 (burn-in), ungating into `dev-sync` as a hard gate in Stage 2 once clean. |

## Consequences

**Positive:**

- **Upward reflection is now detectable**: Accepted ADRs post-cutoff that lack governance pointers are flagged as WARNs.
- **No auto-writing**: Validator stays detection-only, avoiding the risks of auto-generated constitutional prose.
- **ADR-0055 playbook**: Flag-gated burn-in (Stage 1) → ungated hard gate (Stage 2) matches the proven `--spec-check` pattern.

**Negative / Trade-offs:**

- **Manual remediation**: Findings require manual edits to governance docs to add `ADR-00NN` references (by design — we chose detection over auto-writing).
- **Frontmatter burden**: New ADRs must include `status:` + `date:` fields (small cost, already ADR-0058 convention).

## Implementation

| File | Change |
|------|--------|
| `scripts/verify-adr-governance.ts` | New validator — checks post-cutoff Accepted ADRs for governance linkage |
| `scripts/audit.ts` | `--governance-check` flag + spawnSync block (mirrors `--spec-check` pattern) |
| `docs/adr/0059-governance-reflection-validators.md` | This ADR — documents the validator-first strategy |
| `scripts/SCRIPTS.md` | Row for `verify-adr-governance.ts` (L0, 1.0.0, active) + audit.ts version bump to 2.20.0 |

**References:**

- ADR-0055 - Spec registry enforcement (WARN-only Stage 1, ungated Stage 2 playbook)
- ADR-0058 - Country-scoped env keys (frontmatter `status:` + `date:` convention)
- ADR-0057 - Country profile mechanism (the incident that motivated this ADR)
- PR #612 - ADR-0057 implementation (landed with **zero governance pointers**)
- PR #616 - Manual remediation (added pointers post-facto)

## Stage 2 (Future Ungating)

Once the workspace is clean (0 WARN findings), `--governance-check` becomes a hard gate in `dev-sync.ts` — mirroring the ADR-0055 evolution from WARN-only to block-on-finding. The trigger is a separate design doc amendment to this ADR.

> **Update (2026-08-23)**: Stage 2 has shipped — see the Amendment section below.

## Amendment (2026-08-23): Stage 2 Ungating — ADR-Linkage Blocking

Stage 2 shipped the same day as Stage 1: the linkage check's only finding on first run (ADR-0059 itself, before its constitution pointer) was remediated immediately, so the "once the workspace is clean" trigger was met with zero burn-in days.

### Mechanism

- `verify-adr-governance.ts` **1.2.0** adds `--strict`: exit 1 on **ADR-linkage findings only** (plain invocation stays WARN-only; marker-hash drift never blocks under `--strict`) (superseded by Stage 2b below).
- `dev-sync.ts` **1.6.0** adds **step 3.97 — ADR governance linkage gate**, a FATAL step running `bun scripts/verify-adr-governance.ts --strict` between step 3.95 (QA pre-checks) and the step-4.9 audit gate. A blocked sync aborts **before branch creation and commit**; writes already made by earlier steps (memory log, MEMORY.md index, CHANGELOG) remain on disk — the same exposure the existing step-3 CHANGELOG fatal has. The step is guarded by `existsSync` and **skipped in scaffolded projects** (the validator is L0-only; generated projects have no `docs/adr/` corpus) — registered in `lifecycle-sync-audit.ts` Check X `INTENTIONAL_CROSS_REFS` (1.4.7), same pattern as `pre-commit:validate-templates`.

### Scope decision: linkage-only blocking

Intentional-duplicate marker-hash drift (Stage 1b) deliberately stays WARN. The Stage 1b hashes are whole-file sha256-8 digests of the source constitution file, so **any unrelated edit** to that file flips the hash and flags every duplicate marker of that section — a false-positive profile that has not been proven acceptable under fire (superseded by Stage 2b below — analysis resolved this; see the Stage 2b Amendment). Flipping drift to blocking is an explicit future option ("Stage 2b"), to be decided only after that false-positive rate is understood.

### Honesty note: first actual ungating; ADR-0055 is design lineage, not precedent-in-force

This is the workspace's **first actual ungating** of a WARN-only validator into a blocking dev-sync gate. ADR-0055's Stage 2 (`--spec-check` ungating) never shipped — that ADR is still `Proposed` and its ticket (`tickets/governance/T-20260816-001.yaml`) is still `waiting` — so the "ADR-0055 playbook" references in this ADR describe the pattern's design lineage, not a precedent in force. (superseded 2026-08-23: ADR-0055 Stage 2 has now shipped — this workspace's second ungating)

### L0-only boundary clarification (glob-copy)

§3's "L0-only" refers to the **check's scope** — the governance corpus and `docs/adr/` exist only at L0. The script file itself sits inside the `scripts` propagation domain's `*.ts` glob, but its registry row's `L0` layer value excludes it from the L0→L1 copy (`layer-filter.ts` `includeScriptInL1` — "Skip L0-only scripts"): no copy exists or is created under `templates/common/scripts/`, no propagation-map exclude was added (the registry layer column is the exclusion mechanism), and no L1 SCRIPTS.md row exists or is required.

### Unchanged

`audit.ts --governance-check` (2.20.1, comment-only bump) remains the **non-blocking diagnostic** — dev-sync step 3.97 calls the validator directly with `--strict` and forwards no flags through the audit path.

## Amendment (2026-08-23, later): Stage 2b — Marker-Drift Blocking

The Stage 2 scope decision deferred marker-drift blocking until the whole-file false-positive profile was understood. That analysis is complete and resolves the recorded precondition, so Stage 2b ships the deferral's other half: intentional-duplicate marker-hash drift now blocks under `--strict`.

### Precondition resolved: the whole-file false-positive profile

Constitution sources are one-section-per-file (§3 → `03-pr-workflow.md`, §8 → `08-coding-guidelines.md`), so the only unrelated-edit class that could flip a whole-file hash was the 2-line `>` preamble above the section heading — the sources carry no hub plumbing that the duplicates mirror. Template duplicates are transformed summaries, never verbatim copies: the hash is a source-side tripwire by design, so "section changed → review the duplicate" is the correct trip semantic at section granularity. With the digest scoped to the section, an edit that flips it is by definition an edit to the duplicated content, not collateral noise.

### Mechanism

- `verify-adr-governance.ts` **1.3.0** re-scopes `computeSectionHash` to the section slice — from the first level-3 (`###`) heading to EOF, CRLF-normalized sha256-8, with a whole-file fallback when the source has no such heading.
- The strict exit becomes `linkageFindings + markerFindings > 0`. All four marker WARN classes count: missing source/hash fields, missing source file, hash-compute failure, hash mismatch. The default mode is unchanged (WARN-only).
- A one-time re-seed of all 9 markers lands in the same PR as this stage — section hashes differ from the previous whole-file hashes, so every marker needed a fresh digest.
- New guard: `--strict` and `--update-marker-hashes` are mutually exclusive (gating vs. seeding) — combining them exits 1.

### Remedy workflow

A blocked step-3.97 sync points the operator at the remedy:

1. Review the duplicated section in the flagged template file.
2. Update it if stale.
3. Run `bun scripts/verify-adr-governance.ts --update-marker-hashes`.
4. Re-run `/sync`.

### dev-sync guidance

`dev-sync.ts` **1.6.2** extends the step 3.97 guidance string with the marker remedy (string-only change; the gate's placement and mechanics are unchanged from Stage 2).
