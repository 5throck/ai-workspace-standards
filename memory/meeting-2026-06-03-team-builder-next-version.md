# Meeting Transcript
**Date**: 2026-06-03
**Topic**: team-builder next version improvements — implementation direction for A-04 through A-09
**Participants**: architect, automation-engineer, docs-writer, auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

### Round 1

**[Architect]**: (Round 1)

Grouped A-04~A-09 by implementation dependency:

- Group 1 (script internals): A-04, A-05, A-06 — all `team-builder.ts` only. A-06 (phases type decision) is a prerequisite; schema must be finalized before the runtime validator (A-04) and tier handling (A-05) can be written correctly.
- Group 2 (path change): A-07 — touches SKILL.md Step 5 text, CHECKPOINT_FILE constant, and .gitignore. Best done after A-04 so the validator references the correct path.
- Group 3 (documentation): A-08, A-09 — SKILL.md text changes only, independent of code, can proceed in parallel.

Directed question to automation-engineer: in existing agent frontmatter, which representation of phases is dominant — numbers or strings?

---

**[Automation-Engineer]**: (Round 1)

Confirmed by reading agents/*.md: string format ("1", "2") is the standard. For example, pm.md uses `phases: ["0", "1", "2", "3", "4", "5", "6"]`. Therefore A-06 resolution: fix SKILL.md JSON schema to use string arrays — do not change the agent files.

For A-04 runtime validation, recommended self-validation function (~20 lines, no Zod dependency):

```typescript
function validateProposal(obj: unknown): obj is TeamBuilderProposal {
  if (typeof obj !== "object" || obj === null) return false;
  const p = obj as Record<string, unknown>;
  if (typeof p.version !== "string") return false;
  if (!p.changes || typeof p.changes !== "object") return false;
  const c = p.changes as Record<string, unknown>;
  for (const key of ["agentsToCreate","agentsToConvert","agentsToDelete",
                      "skillsToCreate","skillsToModify","skillsToReassign","workflowPhases"]) {
    if (!Array.isArray(c[key])) return false;
  }
  return true;
}
```

Directed question to docs-writer: what is the exact scope of A-08 and A-09 changes?

---

**[Docs-Writer]**: (Round 1)

Validation function approach is clean. Recommended enhancement: instead of early `return false`, collect all error reasons and output them together for easier debugging.

A-08 scope: Remove the sentence "Or, if the Engagement Leader has Bash tool access, run the script directly after informing the user" from Step 5. Replace with: "Do NOT run the script directly. Always wait for the user to execute `bun scripts/team-builder.ts` explicitly." (~2 lines changed)

A-09 scope: After "at least 2 authoritative sources" in Step 2, add three validation criteria:
1. Publication date within 5 years
2. Official domain of the organization or peer-reviewed journal DOI
3. Primary source preferred over secondary citation — if only secondary available, note the original source explicitly.
(~4 lines added)

On A-07: recommended saving to `memory/` rather than `.claude/` — memory is already session-artifact territory, semantically correct, and more likely already in .gitignore. Directed question to architect: preference on storage path?

---

### Round 2

**[Architect]**: (Round 2)

Agree with `memory/` for A-07. Extending scope: the checkpoint file (`CHECKPOINT_FILE`) is currently at `docs/.team-builder-checkpoint.json` — move it to `memory/.team-builder-checkpoint.json` at the same time for consistency. Only one constant to update:

```typescript
// Before
const CHECKPOINT_FILE = join(CWD, "docs", ".team-builder-checkpoint.json");
// After
const CHECKPOINT_FILE = join(CWD, "memory", ".team-builder-checkpoint.json");
```

Also update SKILL.md Step 5 path reference from `docs/team-builder-proposal-YYYY-MM-DD.json` to `memory/team-builder-proposal-YYYY-MM-DD.json`. Since A-07 and A-08 both touch SKILL.md, bundle them in a single commit.

A-05 implementation: in `generateAgentMd()`, replace single tierVal with per-platform values using nullish coalesce fallback:

```typescript
const claudeTier = a.tier.claude;
const geminiTier = a.tier.gemini ?? a.tier.claude;
const antigravityTier = a.tier.antigravity ?? a.tier.claude;
```

This preserves backward compatibility — `tier.gemini` and `tier.antigravity` are already optional in the interface.

Directed question to automation-engineer: agree on PR bundling A-04/A-05/A-06 together? Also, is there improvement potential in the `modifySkills()` HTML comment append pattern?

---

**[Automation-Engineer]**: (Round 2)

Agree on PR bundling: A-06 → A-05 → A-04 order within PR-1 (schema finalized first, then tier handling, then validator).

On `modifySkills()`: current pattern appends `<!-- team-builder modification: ... -->` HTML comments. Two problems: (1) multiple modifications accumulate duplicate comments, (2) HTML comments are invisible to AI reading the file so change history is effectively untracked. Better approach: write changes as `## Modification History` markdown section, making them visible to AI consumers. Proposing this as A-10 for a future PR.

Recommended PR structure:
- PR-1: A-06 + A-05 + A-04 (schema and validation)
- PR-2: A-07 + A-08 + A-09 (path + documentation)
- PR-3 (optional): A-10 (modifySkills improvement)

---

### Synthesis

**[Auditor]**: (Synthesis)

All implementation directions for A-04 through A-09 confirmed. One new item surfaced.

---

## Decisions

| Item | Decision |
|------|----------|
| A-06 phases type | Fix SKILL.md JSON schema to string arrays (matches existing agent frontmatter standard) |
| A-04 runtime validation | Self-validation function (~20 lines), no Zod, outputs per-field error messages |
| A-05 tier multi-platform | `gemini ?? claude` and `antigravity ?? claude` nullish coalesce fallback |
| A-07 save path | Both proposal JSON and checkpoint file move to `memory/` |
| A-08 SKILL.md | Remove AI-unilateral execution sentence, replace with explicit prohibition |
| A-09 benchmark criteria | Add 3-item checklist: 5-year recency, official domain/DOI, primary source preference |

## Action Items

| # | Owner | Tier | Deliverable | PR |
|---|-------|------|-------------|----|
| A-04 | automation-engineer | Medium | Self-validation function with per-field error output | PR-1 |
| A-05 | automation-engineer | Medium | Per-platform tier values in `generateAgentMd()` with nullish fallback | PR-1 |
| A-06 | architect | Medium | Fix SKILL.md JSON schema phases to string array | PR-1 |
| A-07 | automation-engineer | Medium | Move CHECKPOINT_FILE and proposal save path to `memory/` | PR-2 |
| A-08 | docs-writer | Low | Remove AI-unilateral execution language from SKILL.md Step 5 | PR-2 |
| A-09 | docs-writer | Low | Add 3-item benchmark source validation checklist to SKILL.md Step 2 | PR-2 |
| A-10 | automation-engineer | Low | Replace HTML comment append in `modifySkills()` with Markdown history section | PR-3 (optional) |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| A-04 | Invalid JSON proposal causes immediate halt with field-level error message | Unit test: pass object missing required array field |
| A-05 | Agent file generated with different claude/gemini tiers when proposal specifies them | Manual test with mixed-tier proposal |
| A-06 | SKILL.md schema example uses string arrays for phases; no type mismatch at validation | Review SKILL.md + run validator |
| A-07 | `docs/` contains no proposal or checkpoint artifacts after execution | Integration test |
| A-08 | SKILL.md Step 5 contains no language permitting AI-unilateral script execution | Manual review |
| A-09 | SKILL.md Step 2 includes all 3 source validation criteria | Manual review |
