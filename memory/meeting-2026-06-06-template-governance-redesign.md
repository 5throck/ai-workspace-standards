# Meeting Transcript
**Date**: 2026-06-06
**Topic**: Template Management and Deployment Structure — Comprehensive Improvement Design
**Participants**: architect, auditor, automation-engineer, lifecycle-manager
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Background

All structural problems discovered during today's session:
1. Layer/scope classification values undefined — `common` ambiguous (L0+L1 vs L0+L1+L2?)
2. Dual-mode scripts (audit.ts, dev-sync.ts) misclassified as L0-only
3. L0+L1 scripts deployed to L2 variants (helpers/*.ts etc.)
4. variant template not delta-only — full copies + outdated files causing regression bugs
5. No central skills registry (no SKILLS.md equivalent)
6. Propagation pipeline has dual exclusion mechanisms (SCRIPTS.md-based vs hardcoded array)
7. No reverse-direction validation (L2 receiving files it shouldn't)
8. new-project.sh overlay causes older variant files to overwrite newer common files

---

## Root Cause

> "Deployment Layer definitions and criteria did not exist when the deployment mechanisms were built."

Three structural defects:
1. Layer value semantics are buried in code (single `if (layer.includes('L0-only')) continue;`)
2. One-way propagation only — no reverse validation gate
3. variant template role undefined — delta vs full copy never documented

---

## Transcript

### Round 1

**architect** (Round 1):
Identified single root cause: deployment Layer definitions were never formally established. Three defects: (1) Layer semantics only in code, not documented, (2) no reverse validation — all leaks came from this, (3) variant template role (delta vs full) never defined. Proposed "Layer Governance Framework" as ADR to fix all three simultaneously.

**auditor** (Round 1):
Identified tool defects: (1) `validate-templates.ts` Check 10 is unidirectional (L0→L1 only), (2) `new-project.sh` has dual conflicting exclusion mechanisms (`parseTier3ExclusionsFromScriptsMd()` + `L0_SCRIPTS` hardcoded array) — `verify-readme-sync.ts` incorrectly excluded is a symptom of this, (3) no SCRIPTS.md equivalent for skills. Proposed principle: all deployment decisions must come from declarative registries; code should only read them.

**automation-engineer** (Round 1):
Confirmed `new-project.sh` exclusion unification is feasible. Proposed `layer-filter.ts` as single filter engine imported by all three tools (`publish-to-template.ts`, `create-l2-scaffold.ts`, `validate-templates.ts`). Bash limitation workaround: delegate to TypeScript if Bun available, minimal hardcoded fallback for bootstrap-only if not. This eliminates `L0_SCRIPTS` array and makes SCRIPTS.md the sole SSOT.

**lifecycle-manager** (Round 1):
Confirmed Layer parsing is currently duplicated across 3 locations with different implementations. `layer-filter.ts` would consolidate to one. Identified deeper problem: no governance process for Layer value assignment — anyone can add a script with any Layer value. Proposed: lifecycle-manager role explicitly includes Layer value validation responsibility. Asked architect to expand ADR C-01 scope.

---

### Round 2

**architect** (Round 2):
Expanded ADR C-01 scope to full Layer Governance Framework: Layer definitions, decision tree, governance process, skill-script unified Layer system, delta-only principle. Proposed 3-phase roadmap: Phase 1 (ADR), Phase 2 (tool unification), Phase 3 (registry completion as single PR).

**automation-engineer** (Round 2):
Designed `layer-filter.ts` interface: `LayerFilter` with `getScriptLayer()`, `getSkillLayer()`, `scriptsForLayer()`, `skillsForLayer()`, `includeInL2()`, `includeInL1()`. `new-project.sh` Bash implementation: delegate to `bun scripts/helpers/layer-filter.ts --l0-only --format=list`, remove `L0_SCRIPTS` array entirely.

**lifecycle-manager** (Round 2):
Defined Phase 3 scope: 84 SCRIPTS.md corrections + 14 SKILLS.md entries + common-contract.json + publish-to-template rerun + variant scripts/skills cleanup. Must be single PR to avoid intermediate inconsistent state.

**auditor** (Synthesis):
See Action Items.

---

## Decisions

| Decision | Detail |
|----------|--------|
| Root cause | Layer definitions missing at design time → all problems stem from this |
| Solution approach | 3-phase: ADR first, then tools, then data |
| ADR C-01 scope | Full Layer Governance Framework (not just definitions) |
| layer-filter.ts | New helper script — single source of Layer decisions |
| new-project.sh | Remove L0_SCRIPTS array, delegate to layer-filter.ts |
| Phase 3 | Single PR only — intermediate state prevents validation |
| Governance process | lifecycle-manager approves Layer values for new scripts/skills |

## 3-Phase Roadmap

### Phase 1 — Definition (ADR C-01)
- Layer 3-tier definition (L0 / L0+L1 / L0+L1+L2)
- Decision tree (Q1/Q2/Q3)
- Layer governance process (lifecycle-manager approval)
- variant template delta-only principle
- Skill scope + script Layer unified system
- SKILLS.md design

### Phase 2 — Tool Unification
- `scripts/helpers/layer-filter.ts` (new)
- `publish-to-template.ts` refactor
- `create-l2-scaffold.ts` refactor
- `new-project.sh` L0_SCRIPTS removal
- `validate-templates.ts` reverse check enhancement

### Phase 3 — Registry Completion (single PR)
- SCRIPTS.md full Layer correction (84 scripts)
- SKILLS.md creation (14 skills)
- common-contract.json final update
- publish-to-template.ts rerun
- variant scripts/ and skills/ cleanup

---

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| H-01 | architect | High | ADR C-01 — Layer Governance Framework (definitions + decision tree + governance process + delta-only principle) | L0-only | 1-2 |
| H-02 | automation-engineer | Low | `scripts/helpers/layer-filter.ts` — new single filter engine (reads SCRIPTS.md + SKILLS.md) | L0-only | 4 |
| H-03 | automation-engineer | Low | `publish-to-template.ts` refactor — use layer-filter.ts, remove SKILL.md direct parsing | L0-only | 4 |
| H-04 | automation-engineer | Low | `create-l2-scaffold.ts` refactor — use layer-filter.ts, consolidate parseTier3Exclusions | L0-only | 4 |
| H-05 | automation-engineer | Low | `new-project.sh` improvement — delegate to layer-filter.ts, remove L0_SCRIPTS array | L0-only | 4 |
| H-06 | automation-engineer | Low | `validate-templates.ts` enhancement — integrate layer-filter.ts for reverse direction checks | L0-only | 4 |
| H-07 | lifecycle-manager + automation-engineer | Medium | Phase 3 single PR — SCRIPTS.md corrections + SKILLS.md creation + common sync + variant cleanup | L0-only | 4 |
