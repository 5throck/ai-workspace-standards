---
status: Accepted
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

**Wiring**: The check is flag-gated in `scripts/audit.ts` as `--governance-check`, mirroring the ADR-0055 `--spec-check` pattern. Stage 1 is **burn-in only** — `bun scripts/audit.ts --governance-check` runs the validator, but `dev-sync.ts` does NOT yet call it (that's Stage 2).

**Exit semantics**:

- `verify-adr-governance.ts`: WARN-only → always exit 0 on findings, exit 1 only on operational failure.
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
