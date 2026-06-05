# Meeting Transcript
**Date**: 2026-06-05
**Topic**: Antigravity Auto-Mode Setting Revision and Security Risk Re-evaluation
**Participants**: pm, architect, security-expert, automation-engineer
**Rounds**: 2
**Language**: Korean
**Status**: Complete

---

## Transcript

### Round 1

**[PM]**: Meeting opened. Two critical issues identified:
1. L1/L2 propagation problem: concerns about directly modifying variant `.gemini/settings.json`
2. Security risk: `"artifact.reviewPolicy": "Auto-Accept"` setting may be dangerous

**[Architect]**: From structural perspective, direct L2 modification violates Fork Model (ADR-0031). L1→L2 relationship ends at scaffold time. L2 evolves independently. Question to **pm**: Why choose direct modification instead of using `l2-to-variant-pipeline.ts` for promotion?

**[Security Expert]**: Security concerns added to structural issues. `"artifact.reviewPolicy": "Auto-Accept"` is dangerous:
- Enables malicious code injection without verification
- Makes irreversible changes to Git history
- Even with manual MCP approval, auto-accepted code can already be exploiting vulnerabilities

Question to **automation-engineer**: If malicious code is already auto-accepted into files, does manual MCP approval become meaningless?

**[Automation Engineer]**: Practical concerns added. Current setup allows:
1. Agent generates code → auto-accept immediately applies file changes
2. Modified file calls MCP tool for data exfiltration
3. Manual approval requested but malicious code already applied

Question to **architect**: Given `dev-sync.ts` auto-propagates L0→L1, why manually modify each L2 variant?

**[PM]**: Summary of concerns:
- **architect**: Correct - direct L2 modification violates governance
- **security-expert** & **automation-engineer**: Auto-Accept security risk is valid

### Round 2

**[Architect]**: Solution proposed:
1. Rollback direct L2 modifications
2. Keep Auto-Mode settings in L1 (`templates/common/.gemini/settings.json`)
3. Each L2 variant manually uses `l2-to-variant-pipeline.ts` when needed
4. Change `"artifact.reviewPolicy"`: "Auto-Accept" → "Request Review"

**[Security Expert]**: Agreed with architect. Stronger recommendation:
- `terminal.executionPolicy`: "Auto" (safe - agent spawn only)
- `artifact.reviewPolicy`: "Request Review" (secure - code verification)
- `mcp.toolApproval`: "Manual" (secure - prevent data exfiltration)
- `terminal.denyList`: [...] (safe - dangerous command blocking)

Question to **automation-engineer**: Can you create a script for manual L2 promotion after L0→L1 propagation?

**[Automation Engineer]**: Implementation plan:
1. Modify L0 `.gemini/settings.json` (security-enhanced version)
2. Propagate to L1 via `dev-sync.ts` (automatic)
3. Create L2 promotion script: `scripts/upgrade-l2-gemini-settings.ts`

Question to **pm**: Should we proceed with this direction?

**[Auditor]**: Synthesis provided (see Action Items below).

---

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-01 | architect | High | 롤백 계획 수립 - L2 variant 직접 수정 되돌리기 방안 설계 | Both | 2 |
| A-02 | automation-engineer | Low | L0 settings.json 수정 - artifact.reviewPolicy를 Request Review로 변경 | Antigravity | 4 |
| A-03 | automation-engineer | Low | L1 전파 - dev-sync.ts 실행으로 templates/common/.gemini/settings.json 업데이트 | Antigravity | 4 |
| A-04 | automation-engineer | Low | L2 승격 스크립트 작성 - upgrade-l2-gemini-settings.ts | Antigravity | 4 |
| A-05 | docs-writer | Medium | GEMINI.md 업데이트 - 보안 강화 설정 반영 | Antigravity | 4 |
| A-06 | auditor | Medium | 최종 감사 - 모든 variant 설정 검증 | Both | 6 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-01 | L2 variants 롤백 완료 | `templates/co-*/.gemini/settings.json`에서 auto-mode 설정 제거됨 |
| AC-02 | L0/L1 보안 설정 적용 | `"artifact.reviewPolicy": "Request Review"` 적용됨 |
| AC-03 | 승격 스크립트 작성 | `scripts/upgrade-l2-gemini-settings.ts` 생성됨 |
| AC-04 | 문서 업데이트 | GEMINI.md에 보안 강화 설정 문서화됨 |
| AC-05 | 전체 감사 통과 | `bun scripts/audit.ts` 실행 시 L0/L1/L2 설정 일관성 확인됨 |
