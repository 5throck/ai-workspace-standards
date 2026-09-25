---
status: Accepted
date: 2026-09-26
author: PM
---

# ADR-0090: AGENTS.md as a Thin Dispatcher — Pointer/Reference Model Across L0–L2

## Context

Every AGENTS.md in the ecosystem exceeds Hermes Agent's default 20,000-char context-file cap (L0 57.0k / L1 49.2k / L2 27.9k–82.1k), silently truncating the governance body for context-file-based consumers (ADR-0088 Addendum 1). The duplication audit (`docs/analysis/2026-09-25-agents-md-duplication-audit.md`, F1–F8) further showed the weight is dual-maintenance liability: the COMMON-AGENTS zone's ADR summaries duplicate owned §3 (tok 0.89–0.97), PM Gateway is double-registered (AGENTS §3 ↔ CONSTITUTION §5.5), §1↔§2 roster restatement is HIGH in all 13 variants, and the context.md `## Agents` sync rule is unenforced and unmet 13/13. A six-role design review (meeting `memory/meeting-2026-09-26-agents-md-thinning-plan-review.md`) amended the approach (amendments A–H); the user selected full restructure (Option 1).

## Decision

1. **AGENTS.md becomes a thin dispatcher at every layer (≤15,000 chars)**: pointer table + load contract (first screen), §6 Skills skeleton (resolution priority + VERSION_MANIFEST pointer; the §6→§7 span required by audit check #29 is preserved), §7 short baseline, generated roster summary, slimmed COMMON-AGENTS zone, and — L0 only — the L0-only §3.7.5 governance-backlog block.
2. **COMMON-AGENTS zone reuse, no new zone** (amendment A): the zone carries the pointer table/index; both the COMMON-CONTEXT and AGENTS delivery paths stay on proven machinery.
3. **Operational detail moves to `docs/governance/*.md`** (`pm-gateway-workflow.md`, `execution-plan-templates.md`), not into CONSTITUTION (amendment B). CONSTITUTION remains the rules SSOT (MUST-level policy; its deference anchors retarget to the governance files). §3.7.5 (L0-only backlog dispatch) never ships fleet-wide.
4. **Validators precede restructuring (amendment C)**: `agents-md-size-budget` (WARN, FAIL promotion at W4) and `agents-md-pointer-integrity` (cross-file anchors) land before W1; dev-sync Phase B-AGENTS gains a die-guard; a mechanical preservation gate (normalized text-coverage diff against git history) verifies relocation-only.
5. **Fleet delivery combines a one-time restructure step with standing MERGE** (amendments D+A): upgrade-project gains an AGENTS_RESTRUCTURE step (CONTEXT_COMMONIZATION pattern, snapshot-guarded) that performs the per-project conversion once; thereafter the COMMON-AGENTS zone delivers pointer/index updates on every upgrade via the existing MERGE pass. context.md delivery is unchanged (CONTEXT PRESERVE + splice + commonization already cover it).
6. **Mirror twins keep full content and gain the pointer table** (amendment E): CLAUDE/GEMINI/CODEX.md serve cap-less harnesses; platform-parity checks are updated to the new AGENTS shape rather than forcing twin slimming.
7. **Security additions** (amendment F): governance reference-file hash manifest verified at upgrade+audit; MERGE divergence WARN before zone overwrite; roster-generation output escaping; a non-overridable inline security floor (write restrictions, §7 security boundaries).
8. **Rollout is wave-gated with machine-checkable acceptance** (amendments C/H): W0 validators → W1 L0 → W2 propagation/anchors → W3 variant sweep (sub-waves, per-edition dispositions recorded in the design Addendum) → W4 12-project conversion + live Hermes re-verification (no truncation warning at default config). Rollout order minimizes 4-harness context loss: CLAUDE/GEMINI/CODEX twins keep full bodies throughout.

## Consequences

- **Positive**: truncation solved structurally at the default config (not just per-user config); AGENTS.md becomes single-homed per section with pointers — the F1/F2 dual-maintenance liabilities close; roster generation ends hand-maintained roster drift; the load contract gives every harness an explicit, first-screen reading obligation.
- **Cost**: 4 of 5 harnesses auto-load less governance verbatim than today (pointer-following becomes the reading path) — accepted by user decision with the mirror-twin mitigation; 14-file adjudication sweep is the bulk of the effort; new drift classes (overrides contradicting canonical, load-contract wording drift) require the W0/W2 standing checks.
- **Neutral**: CONSTITUTION.md stays 62.7k — it is a tool-read target, not an auto-loaded context file; size budget is enforced WARN-first, FAIL only after W4.

## References

- Design: `docs/designs/2026-09-25-agents-md-size-reduction-design.md` (§1.1/§1.2 amendments, waves, acceptance criteria)
- Analysis: `docs/analysis/2026-09-25-agents-md-size-analysis.md`, `docs/analysis/2026-09-25-agents-md-duplication-audit.md`
- Meeting: `memory/meeting-2026-09-26-agents-md-thinning-plan-review.md` (A–H amendments, verbatim red-team dissent, user decision)
- ADR-0088 (+Addendum 1 — truncation origin), ADR-0035/ADR-0048 (AGENTS.md structure/SSOT)
