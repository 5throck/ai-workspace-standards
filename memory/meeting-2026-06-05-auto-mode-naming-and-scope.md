# Meeting Transcript

**Date**: 2026-06-05
**Topic**: Auto-mode naming and platform scope decision
**Participants**: pm, architect, docs-writer, auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

**[PM]**: (Opening)

This meeting was convened to decide on the naming and platform scope of Auto-mode.

**Background**:
The user provided two important pieces of feedback:
1. "auto-mode" is more intuitive than "auto-executor"
2. Auto-mode is only needed for Antigravity, not Claude Code

**Current Situation**:
- Just changed "PM Auto-mode" → "Auto-Executor", but user suggested reverting
- Current ADR 0030 is designed as Cross-platform (Claude + Antigravity)

**Discussion Goals**:
1. Final naming decision (auto-mode vs auto-executor vs others)
2. Platform scope decision (Claude-only, Antigravity-only, Cross-platform)
3. Necessity of ADR 0030 scope adjustment

Participants, please share your perspectives from each expertise area. Address each other by name.

---

**[Architect]**: (Round 1)

PM, good convening. Let me share my analysis from an architecture perspective.

**Naming Analysis**:

I agree with the user that "auto-mode" is more intuitive. My reasons:

1. **User mental model**: "Auto" + "Mode" is already a familiar concept (e.g., Auto-pilot, Auto-focus)
2. **Problem with "Executor"**: Emphasizing only execution makes the full workflow of "Planning" and "Execution" ambiguous
3. **PM's role**: PM is responsible for full orchestration, so "Mode" better reflects PM's control scope

**Platform Necessity Analysis**:

Important insight. My analysis:

**Claude Code Status**:
- Native `Agent` tool enables direct specialist calls
- Execution plan table → approval → sequential Agent tool calls (already automated)
- Separate auto-mode infrastructure is **over-engineering**

**Antigravity Status**:
- Agent Manager UI-based manual staging required
- Workspace isolation (worktree) complexity
- Auto-mode provides **real value** (automatic staging after plan approval)

**Conclusion**:
Designing auto-mode as an **Antigravity-only feature** is reasonable in terms of preventing technical debt and maintaining simplicity.

docs-writer, what do you think from a user experience perspective? Would "auto-mode" naming cause any confusion for users?

---

**[Docs-writer]**: (Round 1)

architect, excellent analysis. Let me share my thoughts from documentation and user perspective.

**Naming: Support for "auto-mode"**

As architect pointed out, "auto-mode" is already a familiar term:

1. **Industry standard**:
   - Gmail: "Auto-reply" mode
   - Cameras: "Auto-focus" mode
   - IDEs: "Auto-save" mode

   Users immediately understand "X-auto-mode" as "automated mode".

2. **Confusion risk with "Executor"**:
   - "Auto-Executor" looks like it only handles execution
   - Actually includes planning, execution, checkpoint, rollback all together
   - Mismatch between name and functionality

**User Test Results** (hypothetical):

```
Question: "What is Auto-Executor?"
Answer: "A tool that automatically executes?"
Question: "Then what about Planning?"
Answer: "Hmm... is only execution automated?"
```

Conversely:

```
Question: "What is Auto-mode?"
Answer: "An automated mode?"
Question: "What is automated?"
Answer: "Mode where execution proceeds automatically after plan approval"
```

**Platform Scope: Documentation challenge of Antigravity-only**

architect, if going Antigravity-only, we need to clearly indicate in documentation:

**CLAUDE.md Update**:
```markdown
## Auto-Mode (Antigravity Only)

> Note: Claude Code does not require auto-mode infrastructure.
> The native Agent tool provides equivalent functionality.
```

**GEMINI.md Update**:
```markdown
## Auto-Mode

Auto-mode enables automated plan execution with manual checkpoints.
Optimized for Antigravity's Agent Manager workflow.
```

auditor, from a governance perspective, is there any issue with adjusting ADR 0030 from Cross-platform to Antigravity-only?

---

**[Auditor]**: (Round 1)

docs-writer, important question. Let me analyze from governance and consistency perspective.

**Current ADR 0030 Status Check**:

Just renamed: `0030-auto-executor-architecture.md`
Current scope: Cross-platform (Claude Code + Antigravity)

**Governance Issues**:

1. **Platform Declaration Mismatch**:
   - ADR states "Cross-platform"
   - Actual necessity: "Antigravity-only"
   - **Problem**: ADR doesn't accurately reflect architecture decision

2. **Lifecycle Audit Findings**:
   - Current ADR 0030 declares scripts/lib/ as L0-only
   - If Antigravity-only, this is **correct declaration** (no propagation to Claude Code variants needed)
   - propagation-map.json already has `scripts-lib` domain noted as "L0-only per SCRIPTS.md"

3. **Consistency Check**:
   ```
   CLAUDE.md: Currently has Auto-Mode section (assumes Cross-platform)
   GEMINI.md: Currently no Auto-Mode section

   If going Antigravity-only:
   - CLAUDE.md: Delete Auto-Mode section OR add "Not applicable" note
   - GEMINI.md: Add Auto-Mode section
   ```

**Recommendation**:

Redesign ADR 0030 as **Antigravity-only ADR**:

```markdown
# ADR-0030: Auto-Mode for Antigravity Platform

**Status**: Accepted
**Scope**: Antigravity-only
**Rationale**: Claude Code Agent tool provides equivalent functionality

## Context

Antigravity's Agent Manager requires manual staging for each specialist.
Auto-mode automates this workflow while maintaining checkpoint safety.
```

architect, do you think this scope adjustment is architecturally sound? Or are there benefits to maintaining Cross-platform?

---

**[Architect]**: (Round 2)

auditor, good question. Let me consider the benefits of maintaining Cross-platform.

**Theoretical benefits of Cross-platform maintenance**:

1. **Unified PM workflow**: Same PM experience on both platforms
2. **Code reuse**: Write scripts/lib/ once, use on both sides
3. **Reduced testing overhead**: Test one implementation covers both

**But actual problems**:

1. **Over-engineering in Claude Code**:
   ```typescript
   // This is already possible in Claude Code:
   Agent(
     description = "Execute plan",
     subagent_type = "automation-engineer",
     prompt = "..."
   )
   ```

   Separate `platform-dispatcher.ts`, `auto-executor.ts` infrastructure is **unnecessary abstraction**

2. **Maintenance burden**:
   - Cross-platform code must track both platform APIs
   - If Claude Code Agent tool changes, auto-mode also needs modification
   - **Actually code that won't be used in Claude Code**

3. **Complexity cost**:
   ```typescript
   // Cross-platform dispatcher:
   if (platform === 'claude-code') {
     return await Agent(...);  // Direct call already possible
   } else if (platform === 'antigravity') {
     return await invoke_subagent(...);  // This is really needed
   }
   ```

   Claude Code branch is **dead code**

**Benefits of Antigravity-only**:

1. **Simplicity**: Dispatcher only needs to consider Antigravity
2. **Clear value proposition**: "Automate manual staging in Antigravity"
3. **Maintenance reduction**: Track only one platform

**Final Recommendation**:

**Scope**: Antigravity-only
**Reasons**:
- Claude Code is already automated
- Cross-platform is over-engineering
- Respect simplicity principle

pm, are you ready to make the final decision? Shall we get agreement from docs-writer and auditor?

---

**[Docs-writer]**: (Round 2)

architect, persuasive. Let me share final thoughts from documentation perspective.

**Naming: Final confirmation of "Auto-Mode"**

✅ Propose decision as **"Auto-Mode"**:
- User intuitiveness priority
- Aligns with industry standard
- Reflects PM's orchestration role

**Scope: Final confirmation of Antigravity-only**

✅ Propose decision as **Antigravity-only**:
- Documentation simplicity secured
- Add only "Not applicable for Claude Code" note in CLAUDE.md
- Detailed explanation in GEMINI.md

**Documentation Changes Required**:

1. **agents/pm.md**:
   - Section title: "Auto-Mode Execution" (maintain)
   - Clarification note: "Antigravity-only feature. Claude Code uses native Agent tool."

2. **docs/adr/0030**:
   - Filename: `0030-auto-mode-architecture.md` (done)
   - Title: "Auto-Mode for Antigravity Platform"
   - Add scope statement

3. **CLAUDE.md**:
   ```markdown
   ## Auto-Mode (Antigravity Only)

   > **Claude Code Note**: The native Agent tool provides equivalent
   > functionality. Auto-mode infrastructure is not required.
   ```

4. **GEMINI.md**:
   ```markdown
   ## Auto-Mode

   Auto-mode automates plan execution for Antigravity's Agent Manager.
   See [ADR-0030](docs/adr/0030-auto-mode-architecture.md) for details.
   ```

auditor, from a governance perspective, does this change plan comply?

---

**[Auditor]**: (Round 2)

docs-writer, documentation plan is clear. Let me do final verification from governance perspective.

**Compliance Check**:

✅ **Platform Declaration Consistency**:
- ADR 0030: Clearly declared as "Antigravity-only"
- CLAUDE.md: "Not applicable" note prevents Claude Code user confusion
- GEMINI.md: Detailed guide for Antigravity users

✅ **Lifecycle Rules**:
- scripts/lib/*.ts: L0-only (no propagation to templates/common/ since Antigravity-only)
- propagation-map.json: Maintain current "L0-only per SCRIPTS.md" note
- SCRIPTS.md: Specify `layer: L0-only` for each script file

✅ **ADR Integrity**:
- Status: Need to change Proposed → Accepted
- Context section: Add rationale "Claude Code already automated"
- Decision section: Specify "Antigravity-only"

**Risk Assessment**:

⚠️ **Potential User Confusion**:
- CLAUDE.md users might try after seeing "Auto-Mode" section
- **Mitigation**: Clear "Not applicable for Claude Code" note

**Final Recommendation**:

✅ **Approve changes**:
1. Naming: "Auto-Mode" (revert to original)
2. Scope: Antigravity-only
3. ADR 0030: Redesign as "Auto-Mode for Antigravity Platform"
4. Documentation: Update CLAUDE.md/GEMINI.md

**Action Items Summary**:
1. A-01: agents/pm.md - Revert "Auto-Executor" → "Auto-Mode", add Antigravity-only note
2. A-02: docs/adr/0030 - Change title to "Auto-Mode for Antigravity Platform", update scope explanation
3. A-03: CLAUDE.md - Add "Antigravity-only" note to Auto-Mode section
4. A-04: GEMINI.md - Add Auto-Mode section with detailed explanation
5. A-05: SCRIPTS.md - Verify `layer: L0-only` specified for scripts/lib/*.ts files

pm, will you give final approval?

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | pm | Medium | Revert agents/pm.md "Auto-Executor" → "Auto-Mode", add Antigravity-only note | Phase 4 |
| A-02 | docs-writer | Medium | Redesign docs/adr/0030 title to "Auto-Mode for Antigravity Platform", update scope explanation | Phase 4 |
| A-03 | docs-writer | Medium | Update CLAUDE.md Auto-Mode section with "Not applicable for Claude Code" note | Phase 4 |
| A-04 | docs-writer | Medium | Add Auto-Mode section to GEMINI.md with detailed explanation | Phase 4 |
| A-05 | auditor | Low | Verify scripts/lib/*.ts files have `layer: L0-only` declarations in SCRIPTS.md | Phase 4 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | All references to "Auto-Executor" reverted to "Auto-Mode" | Grep search for "Auto-Executor" returns no results |
| 2 | ADR 0030 clearly declares Antigravity-only scope | ADR title and content reflect Antigravity-only design |
| 3 | CLAUDE.md has "Not applicable for Claude Code" note | CLAUDE.md Auto-Mode section contains clear note |
| 4 | GEMINI.md has Auto-Mode section with detailed explanation | GEMINI.md contains Auto-Mode usage guide |
| 5 | All scripts/lib/*.ts declared as L0-only in SCRIPTS.md | SCRIPTS.md layer column shows L0-only for all auto-mode scripts |
