# Meeting Transcript
**Date**: 2026-06-05
**Topic**: Auto-Mode Functionality Cleanup Discussion
**Participants**: pm, architect, automation-engineer, docs-writer
**Rounds**: 2
**Language**: Korean
**Status**: Complete

---

## Transcript

### Round 1

**[PM]**: Meeting opened. Agenda: Cleanup of "Auto-Mode functionality" (not .gemini/settings.json configuration fields themselves).

**User Correction**: "Not about changing .gemini/settings, but about the Auto-Mode functionality that was created."

**Need to Identify**:
1. What is the Auto-Mode functionality actually?
2. Did ADR-0030 design this functionality?
3. Where are related scripts/codes?
4. Why is it now unnecessary?

**[Architect]**: Need to read ADR-0030 first to understand the actual Auto-Mode functionality.

**ADR-0030 Details**:
- Title: "Auto-Mode Architecture" (presumed)
- This ADR likely documents the Auto-Mode functionality design
- Reading the ADR will clarify the scope and implementation approach

**Proposal**:
1. PM reads ADR-0030 first
2. Understand the Auto-Mode functionality scope
3. Then discuss cleanup approach

**[Docs-writer]**: ADR location: usually in `docs/adr/` directory
- Filename: `0030-auto-mode-architecture.md` (presumed)
- This file will reveal the Auto-Mode functionality design

**Other Auto-Mode related docs**:
- GEMINI.md "Antigravity Auto-Mode Configuration" section (recently added)
- CLAUDE.md same section (platform parity)
- Auto-Mode related analysis docs in memory/

**[PM]**: Read ADR-0030 to understand Auto-Mode functionality reality.

### Round 2

**[PM]**: Read ADR-0030 and **identified the Auto-Mode functionality reality**.

**Auto-Mode Functionality is**:
- Functionality to **automatically dispatch specialist agents** after PM approves execution plan
- Composed of **4 TypeScript modules**:
  - `scripts/lib/platform-dispatcher.ts` - Platform detection and agent dispatch
  - `scripts/lib/plan-parser.ts` - Convert Markdown plan to structured tasks
  - `scripts/lib/auto-mode.ts` - Checkpoint-based orchestration
  - `scripts/lib/checkpoint-manager.ts` - Track execution progress

**Current Status**:
- ADR Requirements section shows all `[ ]` (not implemented) - **no code written yet!**

**Why Unnecessary** (presumed):
1. Claude Code already has `Agent` tool, making Auto-Mode infrastructure unnecessary
2. Antigravity also has UI-based Agent Manager, making automation difficult
3. Complexity increase > actual value

**[Architect]**: Meaning of cleaning up unimplemented Auto-Mode functionality:

**Cleanup Meaning**:
1. **ADR-0030 deprecation**: Functionality not implemented and won't be implemented going forward
2. **Documented content cleanup**: Delete Auto-Mode sections recently added to GEMINI.md/CLAUDE.md
3. **Settings cleanup**: Remove Auto-Mode related fields from `.gemini/settings.json`
4. **Design doc preservation**: Mark ADR-0030 as "retired" and preserve (for historical reference)

**Cleanup needed regardless of implementation status**:
- ADR and docs already exist even if not implemented
- Without cleanup, future confusion will occur
- Need to clearly mark as "unnecessary functionality"

**Proposal**:
- Move ADR-0030 to `docs/adr/retired/` + mark "DEPRECATED - 2026-06-05: Never implemented, deemed unnecessary"
- Complete deletion of Auto-Mode sections in GEMINI.md/CLAUDE.md
- Remove Auto-Mode settings fields from `.gemini/settings.json`

**[Automation Engineer]**: Specific fields to remove and script verification:

**Fields to remove from `.gemini/settings.json`**:
```json
{
  // Remove:
  "terminal.executionPolicy": "Auto",  // ❌ Remove
  "artifact.reviewPolicy": "Request Review",  // ❌ Remove (added by Auto-Mode)
  
  // Consider keeping:
  "mcp.toolApproval": "Manual",  // ⚠️ Security setting - separate discussion
  "terminal.denyList": [...]  // ⚠️ Security setting - separate discussion
}
```

**Related Scripts**:
- No implemented scripts exist (ADR Requirements all unimplemented)
- But documented content exists:
  - GEMINI.md Auto-Mode section (recently added)
  - CLAUDE.md Auto-Mode section (platform parity)
  - Related memory/ docs

**Proposal**:
- Remove `terminal.executionPolicy` and `artifact.reviewPolicy` from `.gemini/settings.json`
- Consider keeping `mcp.toolApproval` and `terminal.denyList` as separate security settings
- Complete deletion of Auto-Mode sections in GEMINI.md/CLAUDE.md
- Move ADR-0030 to `docs/adr/retired/`

**[Docs-writer]**: Final proposal - **2-Phase Cleanup**:

**Phase 1: Complete Auto-Mode Removal**
1. Move ADR-0030 to `docs/adr/retired/` + DEPRECATED marking
2. Complete deletion of Auto-Mode sections in GEMINI.md/CLAUDE.md
3. Remove from `.gemini/settings.json`:
   - `terminal.executionPolicy: "Auto"`
   - `artifact.reviewPolicy: "Request Review"`

**Phase 2: Security Settings Decision**
- **Option A**: Maintain - Document `mcp.toolApproval: "Manual"` + `terminal.denyList` as security configuration
- **Option B**: Remove - Remove all, wait for Antigravity Native approach

**Proposal**: Option A - security settings worth maintaining

**[PM]**: **Final decision: Phase 1 only** (Complete Auto-Mode Removal)

**Reason**:
- User requirement is to clean up "Auto-Mode functionality"
- Security settings are separate discussion (lower priority)
- Focus on Auto-Mode removal

**Execution Plan**:
1. Move ADR-0030 to `docs/adr/retired/`
2. Delete Auto-Mode sections in GEMINI.md/CLAUDE.md
3. Remove Auto-Mode fields from `.gemini/settings.json`
4. L1 propagation (`dev-sync.ts`)
5. QA audit

**[Auditor]**: Synthesis provided (see Action Items below).

---

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-01 | docs-writer | Medium | Move ADR-0030 to docs/adr/retired/ + DEPRECATED marking | Both | 4 |
| A-02 | docs-writer | Medium | Complete deletion of Auto-Mode sections in GEMINI.md/CLAUDE.md | Both | 4 |
| A-03 | automation-engineer | Low | Remove Auto-Mode fields from .gemini/settings.json | Antigravity | 4 |
| A-04 | automation-engineer | Low | L1 propagation - dev-sync.ts execution | Antigravity | 4 |
| A-05 | auditor | Medium | Final QA audit - bun scripts/audit.ts | Both | 6 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-01 | ADR-0030 moved to retired folder | `docs/adr/retired/0030-auto-mode-architecture.md` exists |
| AC-02 | Auto-Mode sections deleted from GEMINI.md/CLAUDE.md | Section search fails |
| AC-03 | Auto-Mode fields removed from .gemini/settings.json | `terminal.executionPolicy`, `artifact.reviewPolicy` absent |
| AC-04 | L0→L1 propagation completed | `templates/common/.gemini/settings.json` updated |
| AC-05 | QA audit passed | `bun scripts/audit.ts` execution successful |
