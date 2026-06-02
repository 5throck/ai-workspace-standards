# Meeting Transcript
**Date**: 2026-06-02
**Topic**: ① Unused Claude Code latest features review and prioritization; ② publish-to-template.ts missing AGENTS.md/CLAUDE.md/GEMINI.md synchronization
**Participants**: PM (facilitator), Architect, Auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Context

**Agenda 1 — Unused Claude Code features (v2.1.158)**
Current workspace settings do not use:
- asyncRewake on hooks (exit-code-2 re-wakes Claude)
- effortLevel setting
- permissions.deny rules
- worktree.bgIsolation setting
- Stop / PreToolUse / WorktreeCreate / SubagentStart / SubagentStop hooks
- Dynamic Workflows (w22), Security Guidance Plugin (w22)
- continueOnBlock PostToolUse config

**Agenda 2 — publish-to-template.ts sync gap**
Pre-meeting audit findings:
- AGENTS.md: MISSING in templates/common/
- CLAUDE.md: MISSING in templates/common/
- GEMINI.md: MISSING in templates/common/
- publish-to-template.ts covers: scripts, skills, commands, platform skills
- publish-to-template.ts does NOT cover: AGENTS.md, CLAUDE.md, GEMINI.md
- CLAUDE.md §10 lifecycle rule requires manual propagation but no script support exists

---

## Transcript

### PM (Facilitator Opening)

Two agenda items:
1. Feature gaps in Claude Code configuration — asyncRewake, effortLevel, deny rules, new hooks
2. publish-to-template.ts does not handle governance document propagation — all three .md files missing from templates/common/

---

### Architect (Round 1)

Both agendas share the same root principle: tools must enforce policy.

**Agenda 1 — Feature priority framework:**

Immediate (settings change only, zero risk):
- asyncRewake: true — highest ROI, closes silent failure gap
- effortLevel: "high" — one line, consistent quality
- permissions.deny — explicit block for --no-verify, push --force, rm -rf
- worktree.bgIsolation: "none" — Windows CRLF fix

Next step (hook additions, needs testing):
- Stop hook — replace per-write audit.ts with end-of-turn single validation
- PreToolUse hook — block protected file access before write
- WorktreeCreate hook — auto-configure git hooks path
- SubagentStart/Stop hooks — agent dispatch tracking

Hold (experimental, needs validation):
- Dynamic Workflows, Security Guidance Plugin, continueOnBlock

**Agenda 2 — L0/L1/L2 structure analysis:**

These files cannot be propagated as-is because they have variant-specific sections:

```
L0 (workspace root)
  AGENTS.md    → workspace-only, NOT propagated to variants
  CLAUDE.md    → common sections + workspace-specific sections
  GEMINI.md    → common sections + workspace-specific sections

L1 (templates/common)
  CLAUDE.md    → common sections only (shared across all variants)
  GEMINI.md    → common sections only
  (no AGENTS.md — fully variant-specific)

L2 (templates/co-*)
  AGENTS.md    → variant-specific (maintained independently)
  CLAUDE.md    → L1 common sections + variant-specific sections (merged)
  GEMINI.md    → L1 common sections + variant-specific sections (merged)
```

Section-based merging needed. Asked Auditor for risk assessment.

---

### Auditor (Round 1)

**Agenda 1 — asyncRewake critical finding:**
Current hooks run async. If they fail, Claude doesn't know — governance gates are effectively disabled until pre-commit catches issues at PR time. asyncRewake: true closes this gap immediately.

Stop hook benefit beyond efficiency: PostToolUse running per-write produces false positives (intermediate state failures when editing 10 files). Stop hook eliminates this by running only after the turn completes.

**Agenda 2 — Sync gap risk: HIGH**
Current reality: every CLAUDE.md update requires manual propagation to 4 variant files. This session ran this propagation dozens of times. Without automation, consistency is impossible. validate-templates.ts has P-01 check (CLAUDE.md ↔ GEMINI.md within-variant parity) but NO check for root ↔ variant synchronization.

Short-term proposal: add claude-docs domain to propagation-map.json for file-level copy.
Long-term: section marker approach (Architect's L0/L1/L2 structure).

---

### Architect (Round 2)

**Agenda 1 — Three-phase plan finalized:**

Phase 1 (settings change only, immediate):
- asyncRewake: true on PostToolUse, TeammateIdle
- effortLevel: "high"
- permissions.deny (--no-verify, push --force, rm -rf)
- worktree.bgIsolation: "none"
- WorktreeCreate hook (git config core.hooksPath)

Phase 2 (hook restructuring, this week):
- Migrate PostToolUse audit.ts → Stop hook (eliminate false positives)
- PostToolUse: keep lifecycle-check only
- Add PreToolUse (protected file access block)
- Add SubagentStart/Stop (agent dispatch logging)

Phase 3 (hold, validate first):
- Dynamic Workflows, Security Plugin, continueOnBlock

**Agenda 2 — Section marker approach:**

Simple file copy limitation: variant-specific sections (§5 Specialist Agent List, §6 Native Sub-agents) would be overwritten incorrectly.

Revised plan:
- Short-term: publish-to-template.ts --docs flag for direct file copy (at least automated path)
- Medium-term: Section markers <!-- COMMON:START --> / <!-- COMMON:END --> in CLAUDE.md/GEMINI.md; publish-to-template.ts merges common sections; validate-templates.ts validates sync

AGENTS.md: exclude from propagation entirely, maintain independently per variant.

---

### Auditor (Round 2 / Synthesis)

**Recommendation: Section marker approach over simple file copy.**

Simple copy would continue causing P-01 parity check failures. Section marker approach has higher implementation cost but existing scripts (merge-frontmatter.ts, inject-skills.ts) provide proven patterns.

**Points of Agreement:**

Agenda 1:
1. Phase 1 immediate: asyncRewake, effortLevel, permissions.deny, worktree.bgIsolation, WorktreeCreate hook
2. Phase 2 this week: Stop hook migration, PreToolUse, SubagentStart/Stop
3. Phase 3 hold: Dynamic Workflows, Security Plugin, continueOnBlock

Agenda 2:
1. AGENTS.md excluded from propagation — variant-independent maintenance continues
2. CLAUDE.md / GEMINI.md: section marker approach adopted
   - <!-- COMMON:START --> / <!-- COMMON:END --> markers
   - publish-to-template.ts extracts and merges common sections
   - validate-templates.ts validates common section synchronization
3. propagation-map.json claude-docs domain added as short-term supplement

**Open Question:**
- What is the boundary of "common sections" in CLAUDE.md? Which §1-12 sections are truly universal vs variant-specific? (Resolved during P1 implementation)

---

## Action Items

| # | Owner | Tier | Deliverable | Priority |
|---|-------|------|-------------|----------|
| A-01 | automation-engineer | Low | Add asyncRewake, effortLevel, permissions.deny, worktree.bgIsolation, WorktreeCreate hook to root .claude/settings.json and templates/common/.claude/settings.json | P0 |
| A-02 | automation-engineer | Low | Apply same Phase 1 settings to all 4 variant .claude/settings.json | P0 |
| A-03 | architect | High | Design common section boundary document for CLAUDE.md/GEMINI.md (which sections are universal vs variant-specific) | P1 |
| A-04 | automation-engineer | Medium | Implement publish-to-template.ts --docs flag + section merge logic | P1 |
| A-05 | automation-engineer | Medium | Add claude-docs domain to propagation-map.json (short-term supplement) | P1 |
| A-06 | automation-engineer | Medium | Add validate-templates.ts Check: CLAUDE.md common section sync validation | P2 |
| A-07 | automation-engineer | Medium | Phase 2 hook restructuring: Stop hook migration, PreToolUse, SubagentStart/Stop | P2 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | asyncRewake: true on PostToolUse and TeammateIdle hooks in all settings.json files | Manual settings review |
| C-02 | permissions.deny blocks git push --force, --no-verify, rm -rf | Test: attempt blocked commands |
| C-03 | WorktreeCreate hook fires git config core.hooksPath .githooks | Test: create worktree, check hook |
| C-04 | publish-to-template.ts --docs propagates CLAUDE.md common sections to all variants | bun run publish-to-template -- --docs --dry-run |
| C-05 | validate-templates.ts detects when variant CLAUDE.md common section differs from root | Test: modify root CLAUDE.md, run check |
| C-06 | Stop hook runs audit.ts once per turn instead of per-write | Session transcript shows single audit run |
