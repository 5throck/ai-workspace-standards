# Meeting Transcript
**Date**: 2026-06-20
**Topic**: Storyteller Agent Upgrade, Variant Metadata Completeness, skills[] Gap Fix, co-deck Source-Verifier Retry Workflow
**Participants**: architect, docs-writer, lifecycle-manager, auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

### Round 1

**[architect]**: (Round 1)

The three agenda items share a root cause: lack of cross-template design consistency. Starting with the Storyteller agents:

Comparing co-design `storyteller.md` vs co-work `storyteller.md`:

| Item | co-design | co-work |
|------|-----------|---------|
| formal_name | Design Storyteller & Brand Philosopher | Organizational Storyteller & Culture Steward |
| phases (lead) | [1, 2] | [1, 2] |
| phases (support) | [3, 4] (Dispatch Protocol) | [3, 4, 5, 6] |
| Dispatch Tier | **high** (Dispatch Protocol) vs **medium** (frontmatter) ← **MISMATCH** | Same mismatch |
| Cultural Inquiry Steps | 4 steps | **5 steps** (includes Gap Analysis) — more refined |

Both agents have a conflict between `tier: medium` in frontmatter and `Tier: high` in Dispatch Protocol — this is a structural defect that directly affects model selection on auto-dispatch.

Proposal: Import co-work's 5-step inquiry into co-design, adding a "Narrative Gap Analysis" step. Unify tier to **medium** for both — both agents are primarily supporting roles. High tier is appropriate for design decision-makers like architect/design-lead.

Question to docs-writer: How do you assess the `description` field terminology differences between the two agents?

---

**[docs-writer]**: (Round 1)

The tier mismatch is clearly a documentation error. I want to highlight the trigger language pattern in the `description` field:

co-design: "Use when: establishing design philosophy, creating brand identity, defining system principles, or synthesizing cross-pattern meaning."
co-work: "Use when: defining team culture, managing organizational change, documenting history, or synthesizing cross-functional insights."

Both end with `synthesizing X`, but co-work includes "documenting history" as a trigger — this is a self-contradiction. The agent body states "You are NOT a technical writer. You don't write technical documentation" while the description offers "documenting" as a trigger.

Also, both agents have only 1 example each. For reliable PM auto-dispatch, minimum 3 examples are needed: clear use case, boundary case, and negative example.

Proposed improvements:
1. co-work description: replace "documenting history" → "preserving institutional knowledge"
2. Add 3+ examples to both agents
3. Import Gap Analysis step into co-design from co-work

Question to lifecycle-manager: Which lifecycle records will be touched by these changes?

---

**[lifecycle-manager]**: (Round 1)

Reporting lifecycle impact scope based on docs-writer's analysis:

For Storyteller agent modifications: `last_updated` date update required — both files currently **lack `last_updated` field**, which is itself a lifecycle governance violation. Workspace-level agents have this field; L2 variant agent files do not.

For variant metadata improvements (skills[] + agent_manifest addition):
- `docs/templates/VERSION_REGISTRY.json` — variant status record update
- `lifecycle.lastTransition` — record if change is structural
- Adding `agent_manifest` block to variant.json may touch **Template Contract** domain — need to verify whether `agent_manifest` is declared as optional field in `common-contract.json` or `workspace-schema.json`

For co-deck source-verifier retry workflow: adding `retry_policy` to `agent_manifest` requires:
- `docs/templates/VERSION_REGISTRY.json` update
- co-deck `version: 0.1.0 → 0.2.0` (minor bump for new feature)

Question to architect: What changes does `agent_manifest` schema extension require at the `workspace-schema.json` level?

---

### Round 2

**[architect]**: (Round 2)

lifecycle-manager raised the critical point about `workspace-schema.json` — this needs verification first. Now presenting the design for agenda item 3: source-verifier failure retry workflow.

Current co-deck `agent_manifest`:
```json
"pipeline_order": ["version", "research", "source-verifier", "storyline", ...],
"optional": ["source-verifier", "image-curator"]
```

Problem: `source-verifier` is declared `optional` but the pipeline is unidirectional. There is no spec for what happens on failure.

Three design options:

| Option | Approach | Pro | Con |
|--------|----------|-----|-----|
| A. `on_fail` field | Add `"on_fail": {"source-verifier": "research"}` to agent_manifest | Declarative, concise | variant.json carries execution logic |
| B. Retry in agent file | Add "on failure, handoff to research" in `agents/source-verifier.md` | Aligns with existing patterns, agent owns its behavior | Potential dual-management between file and manifest |
| C. Separate workflow.md | `## Failure Protocol` section or standalone doc | Can describe complex branching | File sprawl, sync burden |

Recommendation: **Option B + A combination**. Add `## Failure Protocol` with `On Fail: research (max 2 retries)` to source-verifier agent file, and add lightweight `retry_policy` block to variant.json:

```json
"retry_policy": {
  "source-verifier": {
    "on_fail": "research",
    "max_retries": 2,
    "failure_condition": "verification_score < threshold"
  }
}
```

Manifest declares **what**, agent file describes **how** — clean role separation.

Question to docs-writer: How to document this `retry_policy` field consistently with existing `agent_manifest` patterns?

---

**[docs-writer]**: (Round 2)

Agreeing on B+A combination. One terminology consistency concern:

Current co-deck `agent_manifest.notes`:
> "source-verifier: skip with --skip-verify flag for draft iterations."

This mixes `optional`, `skip`, and (new) `retry` — three concepts in the same context without distinction. Future readers will be confused.

Proposed 3-concept clarification:
- `optional: true` → Agent can be entirely omitted from workflow
- `skippable: true` + `--skip-verify` → Agent runs but failures are ignored and pipeline continues
- `retry_policy` → On failure, return to specified agent and retry

These three should be explicitly separated in `agent_manifest`.

For the variant metadata improvement: when adding `agent_manifest` to co-design and co-work, `pipeline_order` must be defined as optional (these variants have independent/parallel agent execution, unlike co-deck's strict sequence). Options: `pipeline_order: []` (empty array) or omit entirely with schema marking it as optional.

Question to lifecycle-manager: Final list of files requiring updates when adding `agent_manifest` to variants currently lacking it?

---

**[lifecycle-manager]**: (Round 2)

docs-writer's 3-concept clarification is accurate. Final file update targets by domain:

| Change | Files to Update | Domain |
|--------|----------------|--------|
| co-design/co-work storyteller.md update | `last_updated:` field (in file) | Agent |
| co-design/co-develop/co-work/co-security variant.json `skills[]` fill | `docs/templates/VERSION_REGISTRY.json` | Variant |
| co-design/co-develop/co-work variant.json add `agent_manifest` | `docs/templates/VERSION_REGISTRY.json`, `workspace-schema.json` (extension field review) | Variant + Template Contract |
| co-deck variant.json add `retry_policy` | `docs/templates/VERSION_REGISTRY.json`, version 0.1.0 → 0.2.0 | Variant |
| source-verifier.md add Failure Protocol section | `last_updated:` (in file) | Agent |
| workspace-schema.json add `retry_policy` schema | `docs/templates/VERSION_REGISTRY.json` | Template Contract |

Additional flag: co-consult `variant.json` has a `lifecycle` block but no `agent_manifest`. If other variants get `agent_manifest` this session, co-consult exclusion will surface as inconsistency again. PM must explicitly decide scope.

---

## Synthesis

**[auditor]**: (Synthesis)

### Points of Agreement

**Agenda 1 — Storyteller Agent Upgrade**:
- Unify tier to **medium** (frontmatter and Dispatch Protocol) — agreed
- Import **Gap Analysis step** into co-design from co-work — agreed
- co-work description: "documenting history" → **"preserving institutional knowledge"** — agreed
- Both agents: boost **examples to 3+** — agreed
- Add missing **`last_updated:` field** to both agent files — agreed (lifecycle-manager finding)

**Agenda 2 — Variant Metadata + skills[]**:
- Fill `skills[]` for co-design, co-develop, co-work, co-security based on actual `.claude/skills/` files — agreed
- When adding `agent_manifest`, treat **`pipeline_order` as optional field** (parallel-execution variants use empty array or omit) — agreed
- **co-consult inclusion: PM decision required** — open

**Agenda 3 — co-deck Source-Verifier Retry Workflow**:
- Adopt **Option B+A combination**: Failure Protocol in source-verifier.md + `retry_policy` block in variant.json — agreed
- docs-writer's **optional / skippable / retry 3-concept separation** — agreed, needs implementation

### Open Questions

1. `workspace-schema.json` extension field declaration for `retry_policy` and optional `agent_manifest.pipeline_order` — architect review required
2. Whether to include co-consult in this agent_manifest addition pass — PM decision
3. `failure_condition` threshold value for source-verifier `retry_policy` — domain expert / PM decision

---

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-01 | automation-engineer | Medium | co-design/co-work storyteller.md upgrade: tier unify (medium), add Gap Analysis step, 3+ examples, last_updated field, description wording fix | Both | Phase 4 |
| A-02 | automation-engineer | Medium | co-design, co-develop, co-work, co-security variant.json: fill skills[] from actual .claude/skills/, add agent_manifest block (pipeline_order optional) | Both | Phase 4 |
| A-03 | architect | High | workspace-schema.json: design schema extension for agent_manifest.retry_policy and optional pipeline_order field | Both | Phase 2 |
| A-04 | automation-engineer | Medium | co-deck variant.json: add retry_policy block, bump version 0.1.0→0.2.0; agents/source-verifier.md: add Failure Protocol section (max_retries: 2, on_fail: research) | Both | Phase 4 |
| A-05 | lifecycle-manager | Medium | Update docs/templates/VERSION_REGISTRY.json, add last_updated to modified agent files, confirm co-consult scope with PM and reflect accordingly | Both | Phase 6 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | Both storyteller.md files have tier: medium in both frontmatter and Dispatch Protocol | grep tier across both files |
| C-02 | co-work description contains "preserving institutional knowledge" not "documenting" | grep description co-work/agents/storyteller.md |
| C-03 | Both storyteller files have ≥3 examples and last_updated field | manual review |
| C-04 | variant.json skills[] non-empty for co-design, co-develop, co-work, co-security | bun scripts/audit.ts |
| C-05 | co-deck variant.json has retry_policy block and version 0.2.0 | read variant.json |
| C-06 | source-verifier.md has Failure Protocol section | grep "Failure Protocol" agents/source-verifier.md |
| C-07 | workspace-schema.json declares retry_policy and pipeline_order as valid optional fields | schema validation |
| C-08 | VERSION_REGISTRY.json reflects all variant changes | lifecycle audit |
