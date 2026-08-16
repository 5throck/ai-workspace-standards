---
status: "Accepted"
---

# ADR-0050: Variant Script Inheritance Pattern and Golden-Reference SSOT

**Status**: Accepted
**Date**: 2026-08-09
**Author**: architect
**Decision Type**: Pipeline Governance / Architecture
**Related ADRs**: [ADR-0042](0042-l2-variant-pipeline-wave15-golden-reference.md) (Wave 1.5 — Golden Reference + Phase 4.5 BLOCKING), [ADR-0046](0046-l2-pipeline-preflight-checks.md) (Phase 1.6 + 3.5 pre-flight checks), [ADR-0039] (L0→L1→L2 hierarchy and extends — referenced by ADR-0047)
**Related design doc**: `docs/designs/l2-pipeline-governance-fixes-2026-08-09-design.md`

---

## Context

### Problem Statement

Commit 20e039d (2026-08-09, "fix(templates): co-export variant cleanup and script version bumps") established that **variant scripts must inherit from `templates/common/`, never duplicate it** — the same fork-avoidance principle ADR-0039 already applies to `agents/pm.md` and ADR-0047 enforces by deleting redundant pm.md bodies. This principle currently governs real code (script files under `templates/co-*/scripts/`, if any exist per-variant) but has never been written down as an ADR. Without a recorded decision, future variant promotions have no citable rule to follow or reference when reviewing whether a variant-local script copy is legitimate or drift.

Separately, the same day's audit (see the paired design doc, Issue A.5) found a live instance of exactly the failure mode this pattern is meant to prevent, but in the *golden-reference* system rather than scripts: `VariantPlugin.goldenReference()` is implemented identically-in-shape but divergently-in-content across all 7 `scripts/helpers/plugins/*-plugin.ts` files, and has drifted out of sync with the actually-enforced structure in `scripts/helpers/golden-reference-loader.ts` + `scripts/helpers/registries/validation-policy.ts`. This is the same class of problem — a duplicated, per-variant/per-plugin copy of data that should have one source of truth — and this ADR is the right place to record both decisions together, since they are the same architectural principle applied to two different subsystems (scripts vs. golden-reference data).

### Decision Drivers

1. **One inheritance direction, everywhere**: `templates/common/` (L1) is the SSOT for shared script/agent/doc logic; `templates/co-*/` (L2) directories may only override, never duplicate. This mirrors the L0→L1→L2 `extends:` chain ADR-0039 defined for `agents/pm.md`, generalized to scripts.
2. **Dead-but-diverged code is worse than no code**: `goldenReference()` was never actually wired up, yet its 7 copies had already drifted from the real enforcement path (`golden-reference-loader.ts`). An unused duplicate is a latent trap — the next engineer who *does* wire it up inherits stale requirements.
3. **A single registry-backed enforcement path already exists and works**: `validation-policy.ts` + dynamic per-variant section scanning (`golden-reference-loader.ts`) is real, actively used by Phase 4.5, and self-updates from live variant content. It is the correct SSOT going forward.
4. **Prefer deletion over reconciliation when the duplicate has no live callers**: reconciling 7 divergent copies against a moving target (the real required-sections list) is strictly more work and more risk than removing code nothing calls.

---

## Decision

### Part 1 — Variant Scripts Inherit From `templates/common/`, Never Duplicate

Codifying the pattern established by commit 20e039d:

- Any script needed by more than one variant lives in `templates/common/scripts/` (or `scripts/` at workspace root, for L0-only tooling) and is referenced by variants via the existing propagation/generation pipeline (`generate-variant.ts`, `propagate-to-templates.ts`) — never copy-pasted into a `templates/co-*/scripts/` directory as a variant-local file.
- A variant-local script is only legitimate when its logic is genuinely variant-specific (e.g., co-deck's theme-rendering scripts, which have no analog in other variant types). Even then, it must not re-implement logic that already exists in `templates/common/scripts/` — it composes/calls common logic where overlap exists.
- `scripts/audit.ts` (root) and `templates/common/scripts/audit.ts` are the enforcement mechanism: variant-local script files that duplicate a `templates/common/scripts/` file by name and >50% content similarity should be flagged as drift (see Consequences — this is a proposed follow-up check, not yet implemented).
- This extends the same rule ADR-0039/ADR-0047 apply to `agents/pm.md` (frontmatter-only L2 files, body inherited via `extends:`) to the scripts domain, where there is no `extends:` mechanism — inheritance is enforced by *not creating the duplicate file* in the first place, backed by the propagation pipeline as the only sanctioned path for common logic to reach variants.

### Part 2 — Golden-Reference Structure: `validation-policy.ts` + Dynamic Scan is the SSOT; `VariantPlugin.goldenReference()` is Deleted

- The authoritative source for "what sections must an agent/skill file in variant type X contain" is, and remains: `scripts/helpers/golden-reference-loader.ts`'s `AGENT_LAYER1_SECTIONS`/`SKILL_LAYER1_SECTIONS` (Layer 1, universal) + `scripts/helpers/registries/validation-policy.ts`'s `optionalAgentSections`/`optionalSkillSections` (Layer 2, per-type, registry-backed) + the dynamic majority-vote scan of existing variant files (`loadDynamicLayer2Agents`/`loadDynamicLayer2Skills`).
- `VariantPlugin.goldenReference()` (interface method in `scripts/helpers/plugins/variant-plugin.ts`, implemented by all 7 plugins) is removed. It was never called outside its own JSDoc examples, and its content had already drifted from the real required-sections list (confirmed for `consulting`: 3 declared-required sections vs. 7 actually enforced).
- Future changes to per-type golden-reference requirements go through `validation-policy.ts`, not through plugin classes. If a future need arises for genuinely per-variant-instance (not per-type) structural rules, that is a new, explicit extension point — not a resurrection of `goldenReference()`.

---

## Consequences

### Positive

- Script duplication across variants now has a citable rule (previously tribal knowledge from 20e039d's commit message only).
- Golden-reference enforcement has exactly one code path instead of two (one live, one dead-and-wrong), eliminating the risk of a future engineer wiring up the stale path by mistake.
- 7 files shrink (plugin `goldenReference()` methods removed); no behavior change since nothing called them.

### Negative / Trade-offs

- Part 1 is a norm, not (yet) an automated gate — nothing currently fails CI if a variant-local script duplicates `templates/common/scripts/`. A drift-detection check in `audit.ts` is proposed as follow-up work, not included in this ADR's immediate implementation scope (tracked in the paired design doc's Task 5 area as a candidate for a future audit rule; not required for the 2026-08-09 fix set).
- Deleting `VariantPlugin.goldenReference()` removes a public interface method. If any external/future code depended on it existing (even unused), this is a breaking change to the `VariantPlugin` contract. Mitigated by: confirmed zero real call sites at time of writing, and `VariantPlugin` is an internal (non-published) interface used only within `scripts/helpers/plugins/`.

### Open Questions

1. Should the script-duplication check in Consequence #1 be implemented as part of this fix set or deferred? Recommendation: defer — it requires a similarity-detection heuristic that deserves its own small design pass, and is not blocking the 2026-08-09 fix set's immediate goals (Issues A/B/C in the paired design doc).
2. If a future variant type needs structural rules that can't be expressed as a static section list (e.g., conditional requirements based on another file's content), where does that logic live? Not yet decided — `validation-policy.ts`'s `hasSpecialHandling` flag already signals "plugin has custom validation," suggesting the plugin's *validation hooks* (not `goldenReference()`) are the intended extension point for exactly this case. No change needed now; noted for future reference.

---

## Implementation

See `docs/designs/l2-pipeline-governance-fixes-2026-08-09-design.md` for the full task breakdown (Tasks 1–6). This ADR's Part 2 corresponds to Task 4 (delete `goldenReference()`); Part 1 is a documentation-only codification of existing 20e039d behavior, with the `propagate-to-templates.ts` source/target guard in Task 5 as a related but separately-motivated defensive fix (Issue B, not Part 1 of this ADR).

### Implementation Status (2026-08-16)

- **Part 2 — done and verified.** `VariantPlugin.goldenReference()` has been removed from all `scripts/helpers/plugins/*.ts` files; zero references remain repo-wide.
- **Part 1's audit.ts follow-up — now specified, implementation pending.** The drift-detection check proposed in this ADR's Consequences section (a `templates/co-*/scripts/` file that duplicates a `templates/common/scripts/` file by name and >50% content similarity) is fully designed in `docs/designs/2026-08-16-august-regression-coverage-design.md` (§2), including the similarity heuristic, FAIL/WARN decision (WARN, initially), and acceptance criteria. The `audit.ts` code itself is implementation work for the next PR, not included in this status update.
- Status flipped from "Proposed" to "Accepted" on 2026-08-16: both parts of the ADR's *decision* are settled and Part 2 is fully executed; Part 1's own follow-up check was always scoped as optional, deferred work in the original Consequences section, not a precondition for acceptance.
