# Meeting Transcript
**Date**: 2026-05-31
**Topic**: .claude/skills owner field — Skill Lifecycle Governance Violation
**Participants**: lifecycle-manager, architect, auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

**[lifecycle-manager]** (Round 1)

The user correctly identified a governance issue. Structural breakdown:

The `skill-lifecycle-audit.ts` owner validation logic:
- Missing `owner` field → ERROR
- `owner` value not found in `agents/*.md` → ERROR (orphaned skill)

However, the three skills in `.claude/skills/` (`code-review`, `refactoring`, `test-driven-development`) are NOT agent-dispatched workflow skills. They are **Claude Code platform trigger skills** with `metadata.type: process` and `metadata.triggers` — tools invoked directly by the user or auto-triggered via keyword matching.

Adding `owner: pm` creates two false assertions:
1. PM dispatches this skill (false — user invokes it)
2. PM is responsible for this skill's lifecycle (unclear — PM doesn't even reference these skills)

The `owner` concept in skill lifecycle management means "maintainer responsible for this skill." Assigning an agent name as owner to platform tool skills **obscures accountability** and constitutes incorrect metadata.

---

**[architect]** (Round 1)

Fully agrees with lifecycle-manager. The root cause is the **absence of a skill classification system**.

Current skill structure:

| Path | Nature | Current owner handling |
|------|--------|------------------------|
| `skills/*/SKILL.md` | Agent workflow skills | `owner: pm` → appropriate |
| `.claude/skills/*/SKILL.md` | Platform trigger tool skills | `owner: pm` → **inappropriate** |

Two solution directions:

**Option A** — Modify `skill-lifecycle-audit.ts`: exempt `.claude/skills/` path skills from `owner` validation, or treat `metadata.type: process` as making owner optional.

**Option B** — Add `category: platform` or `scope: tool` field to skill frontmatter; audit script skips owner validation when this field is present.

Recommends **Option A** — simpler and immediate. The `.claude/skills/` path itself already semantically implies "platform tool skill," so path-based exemption is clear.

---

**[auditor]** (Round 1)

Agrees with both. Additional perspective:

The `agentExists` function validates in two steps:
1. Check registered agent names parsed from AGENTS.md
2. Check if `agents/{owner}.md` exists on disk

Adding `owner: pm` passes the audit because `agents/pm.md` exists — but this **sacrifices semantic correctness for audit compliance**. It perpetuates the anti-pattern the audit should catch: "file exists but owner is semantically wrong."

Concrete implementation for Option A:
```typescript
// In skill-lifecycle-audit.ts, within auditSkills
const isPlatformSkill = skillFile.includes('/.claude/skills/') || skillFile.includes('\\.claude\\skills\\');
if (!isPlatformSkill && !frontmatter.owner) { /* error */ }
```

This means:
- `.claude/skills/` skills → `owner` optional (recognized as platform tool skills)
- `skills/` skills → `owner` required (agent workflow skills enforced)

---

**[lifecycle-manager]** (Round 2)

Endorses auditor's implementation direction. Additional point: the `status: active` field added to `.claude/skills/` files must also be **removed**.

The `status` field tracks the lifecycle state of agent workflow skills (draft → active → deprecated → archived). Applying this concept to platform tool skills is also a category error. Platform skills don't manage "activation state" via `status` — their presence in the filesystem is what makes them active.

Conclusion: Both `status: active` and `owner: pm` must be **removed** from `.claude/skills/*/SKILL.md`, and `skill-lifecycle-audit.ts` must exempt `.claude/skills/` from owner/status mandatory validation.

---

**[architect]** (Round 2)

Fully aligned with lifecycle-manager. Final scope confirmed:

**Change 1 — `scripts/skill-lifecycle-audit.ts`**
- Exempt `.claude/skills/` path skills from `owner` and `status` required validation
- Only validate `name` and `description` for these skills

**Change 2 — `.claude/skills/*/SKILL.md` (3 files)**
- Remove the recently added `status: active` and `owner: pm` fields (revert to prior state)

Applied together: audit passes AND metadata semantics are accurate.

---

**[auditor]** (Synthesis)

### Points of Agreement

- `.claude/skills/` skills are **platform trigger tool skills** — a distinct category from agent workflow skills
- Adding `owner: pm` was a **semantic distortion** for audit compliance and violates lifecycle governance
- `status: active` is similarly a category error for platform skills
- Correct fix: **modify audit script logic** + **revert incorrectly added fields**

### Open Questions

None — approach is fully aligned.

### Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | automation-engineer | Low | `scripts/skill-lifecycle-audit.ts` — add owner/status validation exemption for `.claude/skills/` path | Immediate |
| A-02 | automation-engineer | Low | `.claude/skills/*/SKILL.md` (3 files) — remove `status: active` and `owner: pm` fields | Parallel with A-01 |
| A-03 | auditor | Medium | Re-run `bun scripts/skill-lifecycle-audit.ts` and `bun scripts/audit.ts` to verify | After A-01 + A-02 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | `bun scripts/skill-lifecycle-audit.ts` passes with 0 errors | Run audit |
| C-02 | `.claude/skills/*/SKILL.md` files have no `owner` or `status` fields | File inspection |
| C-03 | `skills/*/SKILL.md` owner/status validation still enforced (no regression) | Run audit |
