# Meeting Transcript
**Date**: 2026-06-05
**Topic**: Antigravity Auto-Mode Configuration Cleanup Discussion
**Participants**: pm, architect, security-expert, docs-writer, automation-engineer
**Rounds**: 2
**Language**: Korean
**Status**: Complete

---

## Transcript

### Round 1

**[PM]**: Meeting opened. Agenda: Cleanup of Antigravity Auto-Mode configuration, which has been deemed unnecessary.

**[Architect]**: Agreed with user assessment - Auto-Mode is unnecessary:
1. Experimental status (ADR-0030)
2. Claude Code has native `Agent` tool - no need for Auto-Mode infrastructure
3. Feature duplication with Agent Manager
4. Maintenance burden for experimental feature

Proposal: Remove Auto-Mode settings from L0 `.gemini/settings.json`, mark ADR-0030 as "archived" or "deprecated", remove or minimize Auto-Mode sections in GEMINI.md/CLAUDE.md.

Question to **docs-writer**: Complete deletion vs archived reference?

**[Security Expert]**: Agreed on necessity assessment, but added security perspective:

**Re-evaluated Security Value**:
1. **DenyList Value**: `terminal.denyList` is useful beyond Auto-Mode - blocking dangerous commands is security best practice
2. **MCP Tool Approval**: `mcp.toolApproval: "Manual"` has value - external MCP server security is important
3. **Request Review Value**: `artifact.reviewPolicy: "Request Review"` is good practice but shouldn't be enforced

Proposal: Keep `terminal.denyList` and `mcp.toolApproval` as security best practices, remove `terminal.executionPolicy` and `artifact.reviewPolicy`.

Question to **automation-engineer**: Can denyList and MCP approval be separated as standalone settings?

**[Docs-writer]**: Document perspective on cleanup:

**Option A: Complete Deletion** (support architect):
- Delete Auto-Mode sections from GEMINI.md/CLAUDE.md
- Delete or move ADR-0030 to `docs/adr/archived/`
- Pros: Clean docs, removes experimental feature confusion
- Cons: Loss of historical context

**Option B: Archived Reference** (middle ground):
- Keep brief "Historical Note" in GEMINI.md/CLAUDE.md
- Move ADR-0030 to `docs/adr/retired/` with "DEPRECATED - 2026-06-05" marking
- Pros: Preserves context, future reference
- Cons: Increased doc complexity

Proposal: Option A - complete deletion is cleanest.

Question to **architect**: Delete ADR-0030 or preserve in archived folder?

**[Automation Engineer]**: Practical perspective:

**Script Check Needed**: Need to verify if Auto-Mode related scripts exist.

**Settings Separation Feasibility** (answering security-expert):
```json
// Remove Auto-Mode parts
{
  // "terminal.executionPolicy": "Auto",  // Remove
  // "artifact.reviewPolicy": "Request Review",  // Remove
  "mcp.toolApproval": "Manual",  // Keep as security setting
  "terminal.denyList": [...]  // Keep as security setting
}
```

Proposal:
1. Remove `terminal.executionPolicy` and `artifact.reviewPolicy` from `.gemini/settings.json`
2. Keep `mcp.toolApproval` and `terminal.denyList` as separate "Security Configuration" section
3. Check and remove related scripts if needed

Question to **pm**: Should security settings (MCP approval, denyList) be maintained, or wait for Antigravity Native approach?

**[PM]**: Round 1 summary:

**Agreements**:
1. Auto-Mode (`terminal.executionPolicy`, `artifact.reviewPolicy`) is unnecessary - agreed to remove
2. Security settings (`mcp.toolApproval`, `terminal.denyList`) need separate discussion
3. Doc cleanup: choose between complete deletion or archived reference

**Undecided**:
1. Security settings maintenance
2. Doc cleanup approach (complete deletion vs archived)
3. ADR-0030 handling (delete vs archived folder)

### Round 2

**[Architect]**: Proposed **2-Phase Approach**:

**Phase 1: Auto-Mode Removal** (agreed portion)
1. Remove from `.gemini/settings.json`:
   - `terminal.executionPolicy: "Auto"` ❌
   - `artifact.reviewPolicy: "Request Review"` ❌
2. Complete deletion of Auto-Mode sections from GEMINI.md/CLAUDE.md
3. Apply same removal to L1 (`templates/common/.gemini/settings.json`)

**Phase 2: Security Settings Decision** (needs discussion)
- **Option A**: Maintain - Keep `mcp.toolApproval: "Manual"` + `terminal.denyList` as separate "Security Configuration" documentation
- **Option B**: Remove - Remove all, wait for Antigravity Native approach

Proposal: Option B - complete removal is cleanest.

Questions to **docs-writer** and **automation-engineer**: Do you agree? Or prefer to maintain security settings?

**[Security Expert]**: Agreed with 2-phase approach but **strongly recommends maintaining security settings**:

**Reasons to Maintain**:
1. **mcp.toolApproval: "Manual"** is core to MCP tool security
   - External MCP servers can exfiltrate data
   - Manual approval is security best practice
   - Value remains even with Antigravity Native

2. **terminal.denyList** also worth maintaining
   - Dangerous command blocking is a safety measure
   - Prevents AI from accidentally executing dangerous commands

**Revised Proposal**:
- **Phase 1**: Remove Auto-Mode ✅
- **Phase 2**: Maintain Security Settings ✅
  - Keep `mcp.toolApproval: "Manual"`
  - Keep `terminal.denyList`
  - Document these as separate "MCP & Terminal Security" section

Question to **docs-writer**: How should security configuration section be structured?

**[Docs-writer]**: **Compromise proposal - 3-Phase Approach**:

**Phase 1: Complete Auto-Mode Removal** (everyone agreed)
- Complete deletion of Auto-Mode sections from GEMINI.md/CLAUDE.md
- Move ADR-0030 to `docs/adr/retired/` + mark "DEPRECATED - 2026-06-05: Auto-Mode deemed unnecessary, replaced by native Agent tool"

**Phase 2: Security Settings Separation Documentation** (accept security-expert proposal)
- Maintain in `.gemini/settings.json`:
  ```json
  {
    "mcp.toolApproval": "Manual",
    "terminal.denyList": [...]
  }
  ```
- Add new section in GEMINI.md/CLAUDE.md: "## Antigravity Security Configuration"
- Content: Explain MCP tool approval and terminal denyList

**Phase 3: Execution and Verification**
- automation-engineer handles L0→L1 propagation
- auditor performs final verification

Question to **pm**: Should we proceed with this 3-phase approach?

**[Automation Engineer]**: Agreed with **docs-writer**'s 3-phase approach and **concretized execution plan**:

**Specific Execution Plan**:

**Step 1: .gemini/settings.json Modification**
```json
// BEFORE (Auto-Mode + security settings mixed)
{
  "terminal.executionPolicy": "Auto",  // Remove
  "artifact.reviewPolicy": "Request Review",  // Remove
  "mcp.toolApproval": "Manual",  // Keep
  "terminal.denyList": [...]  // Keep
}

// AFTER (security settings only)
{
  "mcp.toolApproval": "Manual",
  "terminal.denyList": [...]
}
```

**Step 2: Related Scripts Verification**
- `publish-to-template.ts` - may need Auto-Mode logic removal
- Need to check other scripts

**Step 3: L0→L1 Propagation**
- Execute `dev-sync.ts`
- Update `templates/common/.gemini/settings.json`

**Status**: Ready for execution command.

Question to **pm**: Do you approve this execution plan?

**[Auditor]**: Synthesis provided (see Action Items below).

---

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-01 | automation-engineer | Low | .gemini/settings.json 수정 - Auto-Mode 제거, 보안 설정 유지 | Antigravity | 4 |
| A-02 | docs-writer | Medium | GEMINI.md/CLAUDE.md 수정 - Auto-Mode 섹션 삭제 + Security Configuration 섹션 추가 | Both | 4 |
| A-03 | docs-writer | Medium | ADR-0030을 docs/adr/retired/로 이동 + DEPRECATED 마킹 | Both | 4 |
| A-04 | automation-engineer | Low | 관련 스크립트 확인 및 수정 | Antigravity | 4 |
| A-05 | automation-engineer | Low | L1 전파 - dev-sync.ts 실행 | Antigravity | 4 |
| A-06 | auditor | Medium | 최종 QA 감사 - bun scripts/audit.ts | Both | 6 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-01 | .gemini/settings.json에서 Auto-Mode 설정 제거됨 | `terminal.executionPolicy`, `artifact.reviewPolicy` 없음 |
| AC-02 | .gemini/settings.json에서 보안 설정 유지됨 | `mcp.toolApproval: "Manual"`, `terminal.denyList` 존재 |
| AC-03 | GEMINI.md/CLAUDE.md에서 Auto-Mode 섹션 삭제됨 | 섹션 검색 실패 |
| AC-04 | GEMINI.md/CLAUDE.md에 Security Configuration 섹션 추가됨 | 새 섹션 존재 |
| AC-05 | ADR-0030이 retired 폴더로 이동됨 | `docs/adr/retired/0030-auto-mode-architecture.md` 존재 |
| AC-06 | L0→L1 전파 완료됨 | `templates/common/.gemini/settings.json` 업데이트됨 |
| AC-07 | QA 감사 통과 | `bun scripts/audit.ts` 실행 성공 |