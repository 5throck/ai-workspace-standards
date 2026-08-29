---
name: harness-verification
description: >-
  Authoritative Harness Engineering Protocol: machine-readable spec requirements,
  documentation-to-test mapping, baseline-seed verification, runtime guardrails,
  handover certification, and drift management — issuing a Harness Pass Certificate.
version: "2.1.0"
last_reviewed: "2026-08-25"
status: active
scope: co-price
owner: cpa-auditor
prerequisites: docs/biz_logic.md section anchors exist; ACME baseline seed available
relates_to:
  - skill: double-entry-reconciliation
    type: follows
  - skill: i18n-audit
    type: composes_with
  - skill: pricing-playbook
    type: composes_with
  - skill: i18n-audit
    type: composes_with
  - skill: scenario-comparison
    type: composes_with
  - skill: prisma-7
    type: composes_with
  - skill: ui-component-design
    type: composes_with
metadata:
  type: quality
  triggers:
    - "verify engine"
    - "harness pass"
    - "run verification protocol"
---

# Harness Engineering Protocol — AIG Agentic Standard

This skill is the single authoritative procedure for making documentation machine-readable
and implementation verifiable, so AI agents can harness documents to drive autonomous
development and validation. *(Absorbed the former `docs/harness_protocol.md` document, 2026-08-25.)*

## Trigger
Execute after any write to `src/lib/simulation.ts`, `src/lib/engine/*`, or related business logic.

## 1. Machine-Readable Specifications
- **Mathematical formulas**: all business formulas written in **LaTeX** in `docs/biz_logic.md`
  so agents can parse equations into TypeScript.
- **JSON schema references**: any complex structure mentioned in `architecture.md` must have a
  matching TypeScript interface in `src/lib/types.ts` (documentation-to-code alignment).

## 2. Verification Steps (the original five gates)
1. **Zod Schema Verification**: all new inputs covered by `src/lib/schemas.ts`.
2. **Math Precision Check**: `mathjs` used for all floating-point math — never native `+ - * /`.
3. **Documentation Mapping**: implemented logic documented in `biz_logic.md` with LaTeX formulas.
4. **Test Harness**: `[Ref: biz_logic.Section_X]`-tagged Vitest suite passes on the Baseline Seed.
5. **Output Certificate**: issue a **Harness Pass Certificate** in the task log if all gates pass.

## 3. Documentation-to-Test Mapping
Every core logic block in `biz_logic.md` cross-references a unit test in `src/__tests__`
(naming convention: `[Ref: biz_logic.Section_2.1]` in the suite description). A **Harness Test**
runs the standard Baseline Seed (`SimulationState`) and asserts output matches the Baseline
Result P&L snapshot defined in the docs.

## 4. Runtime Guardrails (Harnessing State)
1. **Zod enforcement**: every input to `simulate()` validated by Zod schemas mirroring `erd.md`.
2. **Type-safe math**: `mathjs` wrappers (`precision.ts`) against IEEE 754 drift.
3. **Boundary guards**: early returns or thrown errors for invalid states (e.g., mix ratio ≠ 1.0).

## 5. Agentic Verification Handover
1. **Submission**: `core-engine-dev` submits code + Vitest report.
2. **Audit**: `cpa-auditor` verifies assertions match the LaTeX formulas exactly.
3. **Certification**: Auditor issues the Harness Pass Certificate (PR body marker).

### 5.1. Precision Verification Checklist
- [ ] `mathjs` used for non-integer calculations?
- [ ] Test uses the Baseline Seed (§3)?
- [ ] Rounding (`Math.round`) applied only at final-output stage in expectations?

### 5.2. Security Audit Checklist (with `security-auditor`)
- [ ] No secrets leakage: `.env` ignored; no hardcoded keys/tokens.
- [ ] Data sanitization: inputs Zod-validated; Prisma only, no raw SQL.
- [ ] Access control: Server Actions validate ownership via `getUserId()` / `auth()`.
- [ ] Asset integrity: `prisma/dev.db` tracked correctly, not corrupted.

## 6. Spec Self-Healing & Drift Management
On logic drift (code ≠ spec):
1. **Spec first**: update `biz_logic.md` with the corrected LaTeX formula.
2. **Harness update**: modify the test suite to match the new formula.
3. **Implementation**: adjust engine code until the updated harness passes.
4. **Audit**: reconvene the Strategic Council for any change impacting BEP or Contribution Margin.

## Output
Harness Pass Certificate block (gates passed, seed hash, tolerances) or a rejection list of
failing `[Ref:]` anchors.
## Context

See [docs/co-price.context.md](../../docs/co-price.context.md) for project context and the consulting engagement lifecycle.

## When to Use

- When a co-price task requires **5-gate engine certification pipeline** within the engagement lifecycle.

## Execution Steps

1. **Receive dispatch** from PM with task parameters and document anchors.
2. **Execute** the skill procedure against the artifacts named in the task scope.
3. **Report** results to the dispatching agent with evidence links.

## Output Format

Structured markdown report delivered to the dispatching agent, citing document anchors (for example `[Ref: biz_logic.*]`) where applicable.

## Related Skills

- Owner agent: `cpa-auditor`. See `variant.json` skills registry for the full co-price skill set.
