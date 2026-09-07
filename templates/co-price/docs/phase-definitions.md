# Phase Definitions — co-price

This document defines the workflow phases used by the `co-price` variant. co-price does **not** use a single linear phase ladder: it runs a **dual lifecycle** (AIG 5-phase build lifecycle + consulting engagement lifecycle) plus a 9-stage **Commercial Operating Cycle**. The authoritative definition lives in `AGENTS.md` ("Dual Lifecycle Phase Gates", `VARIANT-PHASE-GATE-START/END` block); this document is the lifecycle-records companion that maps those gates to the standard workspace phase vocabulary (see `templates/common/docs/phase-definitions.md`).

---

## Phase Mapping

| Workspace Phase | co-price realization |
|-------|----------------------|
| 0 Project Initiation | Build Phase 1 "Triage & Strategy" / Operating Cycle Stage 0 "Objectives & Constraints" |
| 1 Research & Analysis | Operating Cycle Stage 1 "Diagnose" (`market-intelligence-analyst`) |
| 2 Design Review & Approval | Engagement "Design"/"Validate" stages; Build Phase 2 "Technical Design" (user approval mandatory) |
| 3 Implementation | Build Phase 3 "Implementation Chain" (engine → UI, serial); Cycle Stages 3–5 (Allocate / Terms Design / Price Path) |
| 4 Verification & Delivery | Build Phase 4 "Verification & Audit" (cpa + security-auditor + l10n PASS); Cycle Stage 6 "Validate" (**user gate**) |
| 5 Lifecycle Finalization | Build Phase 5 "Finalization" (memlog, CHANGELOG, `/sync` PR); Cycle Stage 7 "Execute" |
| 6 QA & Finalization | Cycle Stage 8 "Review" (`netROI(8w)` + re-score) — output feeds the next cycle's Stages 0–2 |

---

## Gate Ownership

- **Engagement stage advances** require `engagement-director` sign-off and are logged in the engagement state file.
- **Client-facing export** additionally requires explicit user approval.
- **Cycle Stage 6 (Validate)** is a hard user gate (tri-view approval by `cpa-auditor`).

## Governance
- Full gate tables: `AGENTS.md` §Dual Lifecycle Phase Gates
- Agent roster, tiers, and dispatch triggers: `AGENTS.md` and `variant.json`
