# Meeting Transcript
**Date**: 2026-06-01
**Topic**: Removal and simplification of auditor and lifecycle-manager agents from templates
**Participants**: architect, lifecycle-manager, auditor
**Rounds**: 3
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

### architect (Round 1)

The discussion targets two distinct layers: the workspace root (`ai-workspace-standards`) and the agents copied to new projects via `templates/common`. Conflating these produces unclear conclusions.

The core problem: `auditor` and `lifecycle-manager` were designed as workspace governance agents, but their inclusion in `templates/common/agents/` causes them to be copied into every derived project. Placing a Phase 5 QA gate agent and a Phase 6 lifecycle governance agent inside a content-collaboration variant like co-work is a category error.

One concern remains: if auditor is removed entirely, how do co-develop and co-security variants handle QA? Proposal: move auditor to variant-specific agent directories and remove from common. Asked lifecycle-manager to share their perspective first.

### lifecycle-manager (Round 1)

Acknowledged architect's layer distinction. Raised the role duplication problem candidly. Most lifecycle-manager responsibilities are already automated: `agent-lifecycle-audit.ts` validates state, pre-commit hooks enforce propagation, `/sync` writes memory logs and changelogs. Phase 6 manual recording fills a very small gap.

One argument against full removal: contextual judgment scripts cannot make — e.g., where to reassign owned skills when an agent is deprecated. But whether this requires a dedicated agent or can be handled by PM + skill is an open question.

Proposal: isolate lifecycle-manager as a workspace-root-only agent; in variant projects, replace with PM + `agent-lifecycle-manager` skill.

### auditor (Round 1)

The key value of auditor is structural independence — checks and balances. But with `/sync` already running `audit.ts` automatically, the pipeline has effectively replaced the auditor in practice.

Remaining question: which variants still benefit from auditor? co-work — no. co-develop — yes, for code review and PR quality. co-security — critical. co-design — minimal.

Agreed with architect's direction. Clarified that "removing from common" must be paired with explicitly adding auditor to co-develop and co-security variant agent directories. Asked lifecycle-manager who defines per-variant agent criteria.

### architect (Round 2)

Proposed `variant.json` extension with `required_agents` and `optional_agents` fields to allow scaffolding scripts to determine agent inclusion per variant. This is more flexible than the current "copy everything from common" approach.

Combined with lifecycle-manager's skill-replacement direction: variant projects use PM + `agent-lifecycle-manager` skill; workspace root retains the full agent.

Posed a challenge to auditor: if `/sync` pipeline already enforces audit in co-develop, is the auditor's residual value large enough to justify inclusion?

### lifecycle-manager (Round 2)

Raised a prerequisite problem: `upgrade-project.sh` and `.ps1` include `agents/auditor.md` in their update target lists. Removing from common without updating upgrade scripts causes re-injection on upgrade. Both must change together.

Also flagged: `validate-templates.ts` checks for `agent-lifecycle-manager` skill presence in AGENTS.md. If applied to variant projects, the skill must remain registered in variant AGENTS.md even after the agent is removed.

Conclusion: all changes must be applied atomically — partial application causes cascading validation failures. Proposed: fully specify the change set first, then ship as a single PR.

### auditor (Round 2)

Answered architect's challenge: auditor adds value in co-develop only if focused on what `audit.ts` cannot do — semantic validation. `audit.ts` handles structural validation. Co-develop needs semantic validation: code quality, PR description adequacy, implementation vs. design intent alignment. Scripts cannot do this; agents can.

Therefore, auditor's role in co-develop should be redefined — not "agent that runs audit.ts" but "agent that semantically validates PR readiness."

Fully agreed with atomicity principle. Proposed: change specification document first, implementation after.

### architect (Round 3)

Summarized three points of convergence: (1) layer separation; (2) atomicity; (3) role redefinition — auditor as semantic validator, not pipeline executor.

Two open decisions: (1) `variant.json` agent lists — structurally sound but large in scope, better as a separate PR; (2) upgrade-project strategy — "keep if present, do not add if absent" for existing projects.

### lifecycle-manager (Round 3)

Defined three acceptance criteria:

1. **New scaffolding verification**: `new-project.sh --variant co-work` must NOT generate `agents/auditor.md` or `agents/lifecycle-manager.md`, and post-scaffold audit must not FAIL due to their absence.
2. **Workspace root integrity**: `bun scripts/audit.ts` at workspace root must still PASS.
3. **Upgrade regression check**: `upgrade-project.sh` must not re-inject removed agents.

Auditor role redefinition is out of scope for this change — deferred to separate workstream.

### auditor (Synthesis)

**Points of Agreement:**
All three agents converged: remove `auditor` and `lifecycle-manager` from `templates/common/agents/`; isolate as workspace-root-only agents; replace lifecycle management in variant projects with PM + lifecycle skills; ship all changes in a single atomic PR after full specification.

**Open / Unresolved:**
- `variant.json` required_agents field — deferred to separate PR
- Auditor role redefinition for co-develop/co-security — deferred
- Whether co-develop and co-security variants receive variant-specific auditor.md — pending decision

---

## Action Items

| # | Owner | Tier | Deliverable |
|---|-------|------|-------------|
| A-01 | PM | High | Remove `templates/common/agents/auditor.md` and `lifecycle-manager.md` |
| A-02 | PM | Medium | Remove both files from `upgrade-project.sh` and `upgrade-project.ps1` inclusion lists |
| A-03 | PM | Medium | Update CLAUDE.md/GEMINI.md boilerplate: remove or reassign N-1 Lifecycle Update and N Final QA Audit rows |
| A-04 | PM | Medium | Review `validate-templates.ts` agent-lifecycle-manager skill check — restrict to workspace-level if currently applied to variant projects |
| A-05 | PM | Low | Run all three acceptance criteria after implementation to confirm no regression |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | co-work scaffold excludes auditor.md and lifecycle-manager.md | Run new-project, check agents/ dir |
| C-02 | Workspace root audit still passes | bun scripts/audit.ts at C:/git |
| C-03 | upgrade-project does not re-inject removed agents | Run upgrade on existing project, check agents/ |
