# Antigravity Auto-Mode Alternative Solutions Analysis

**Date**: 2026-06-05
**Status**: Phase 1 Complete → Alternatives Evaluation
**Finding**: `.gemini/settings.json` auto-approve configuration is **NOT supported** (security constraint)

---

## Confirmed Constraints

### 1. YOLO Mode: Command-Line Only (❌ settings.json 불가)

**Confirmed by**:
- [Gemini CLI configuration documentation](https://geminicli.com/docs/reference/configuration/)
- [GitHub Issue #12194](https://github.com/google-gemini/gemini-cli/issues/12194)

**Fact**: `"approvalMode": "yolo"` in `.gemini/settings.json` is **intentionally ignored** (security design)

**Available approvalMode values in settings.json**:
- ✅ `"default"` - Standard interactive approval
- ✅ `"auto_edit"` - Auto-approve edit tools only
- ✅ `"plan"` - Read-only planning mode
- ❌ `"yolo"` - **CLI-only**, cannot be set in settings.json

### 2. Agent Manager UI Cannot Be Automated

**Confirmed by**: ADR-0030 (Line 161)
> "Antigravity limitation: Agent Manager UI cannot be automated; requires user interaction for each agent spawn"

---

## Alternative Solutions (Ranked by Feasibility)

### Alternative A: Document Command-Line Workflow (권장 ⭐⭐⭐⭐⭐)

**접근**: `.gemini/settings.json` 설정 대신, GEMINI.md에 명령행 사용법을 문서화

**구현**:
```markdown
## Auto-Mode for Antigravity Users

Antigravity에서 자동 실행을 위해:

```bash
# Terminal에서 실행
antigravity --yolo              # 전체 자동 승인
# 또는
antigravity --approval-mode=yolo  # 전체 자동 승인
```

**주의**: YOLO mode는 안전 모드가 아닙니다. 신뢰할 수 있는 task만 사용하세요.
```

**장점**:
- ✅ 즉시 사용 가능 (공식 지원)
- ✅ 보안 제약 존중 (설정 파일 영구화 방지)
- ✅ Template 구조와 무관 (L0/L1/L2에 영향 없음)
- ✅ 문서화만으로 구현 완료

**단점**:
- ⚠️ L0/L1/L2 자동 전파 불가능 (사용자가 매번 flag 입력)
- ⚠️ Template ecosystem의 장점 활용 불가

**Template 전파**: ❌ 불가능 (사용자 매뉴얼에 의존)

---

### Alternative B: Investigate Hook-Based Auto-Approve (⭐⭐⭐)

**접근**: Antigravity가 agent spawn 시 hook을 지원하는지 확인

**조사 필요사항**:
1. Antigravity GitHub repository code 검색
   - `"AgentSpawn"`, `"agent-spawn"`, `"onAgentSpawn"` hook 관련 코드
2. `.gemini/settings.json` hooks 섹션 확장 가능성 확인
3. Antigravity 문서에서 hooks 스키마 확인

**가능한 구현** (if supported):
```json
{
  "hooks": {
    "AgentSpawn": {
      "autoApprove": true,
      "description": "Auto-approve agent spawns in auto-mode"
    }
  }
}
```

**장점** (if supported):
- ✅ `.gemini/settings.json`에 포함 가능 → L0/L1/L2 자동 전파
- ✅ Template ecosystem 활용
- ✅ 영구적 설정 (사용자 편의)

**단점**:
- ❓ 지원 여부 미확인 (코드/문서 조사 필요)
- ⚠️ 지원하지 않을 경우 대폭 낭비

**다음 단계**:
```bash
# Antigravity GitHub repository 검색
git clone <antigravity-repo>
cd antigravity
grep -r "AgentSpawn\|agent.*spawn.*hook\|onAgentSpawn" --include="*.ts" --include="*.json"
```

**Template 전파**: ✅ 가능 (if supported)

---

### Alternative C: Request Antigravity Platform Feature (⭐⭐)

**접근**: Antigravity에 `.gemini/settings.json` 기반 auto-approve 기능 요청

**요청 내용**:
```yaml
feature_request:
  title: "Add auto-approve configuration to settings.json"
  description: |
    Allow users to configure agent spawn auto-approval via
    .gemini/settings.json for automated workflows

  proposed_schema:
    autoApprove:
      agentSpawns: boolean
      executionPlans: boolean
      requireApprovalForDestructiveOps: boolean
```

**장점**:
- ✅ 장기적으로 가장 clean한 solution
- ✅ Template ecosystem에 완벽 통합 가능

**단점**:
- ❌ 단기 해결 불가능 (platform 개발 필요)
- ❌ Antigravity 팀이 기능을 구현할지 확신 없음
- ⚠️ 수주~수개월 소요 가능

**다음 단계**:
- Antigravity GitHub에 issue 제출
- 또는 Antigravity Discord/커뮤니티에 문의

**Template 전파**: ✅ 가능 (if implemented by platform)

---

### Alternative D: Hybrid Approach - Document Now, Request Later (권장 ⭐⭐⭐⭐)

**접근**: 즉시 사용 가능한 솔루션 (Alternative A) + 장기적 개선 (Alternative C)

**Phase 1 (즉시)**: GEMINI.md 문서화
- Alternative A 구현
- 사용자가 `--yolo` flag를 사용하는 방법 안내

**Phase 2 (장기)**: Platform 기능 요청
- Alternative C 실행
- Antigravity에 `.gemini/settings.json` auto-approve 기능 요청

**Phase 3 (미래)**: Template 전파 (if implemented)
- Platform이 기능을 지원하면 `.gemini/settings.json`에 추가
- L0→L1→L2 자동 전파

**장점**:
- ✅ 즉시 사용 가능한 solution 제공
- ✅ 장기적 개선 가능성 열어둠
- ✅ 단기/장기 균형

**단점**:
- ⚠️ 두 단계로 나누어져 있음

---

### Alternative E: Accept Manual Approval (⭐)

**접근**: 현재 상태 그대로 수용 - Agent Manager 승인 프롬프트를 그대로 사용

**장점**:
- ✅ 가장 안전한 방법
- ✅ 추가 작업 불필요

**단점**:
- ❌ 자동화 목적 달성 실패
- ❌ Antigravity의 auto-mode 장점 활용 불가

---

## Recommended Solution

### 즉시 실행: Alternative A (문서화)

**이유**:
1. 유일하게 **즉시 실행 가능**한 solution
2. 공식적으로 지원되는 방법
3. 보안 제약을 존중
4. 구현 비용: 문서 업데이트만 (10분)

**구현 작업**:
- GEMINI.md에 "Auto-Mode for Antigravity" 섹션 추가
- `--yolo` flag 사용법 안내
- 보안 경고 포함

### 장기 조사: Alternative B (Hook 지원 확인)

**이유**:
- Template ecosystem 활용 가능성
- 구현 시 가장 이상적 solution

**조사 방법**:
- Antigravity GitHub repository code search
- Document 결과 보고서 작성

### 장기 요청: Alternative C (Platform 기능)

**이유**:
- 장기적으로 가장 clean한 solution
- Template ecosystem 완벽 통합

---

## Comparison Matrix

| Alternative | 즉시 실행 가능 | Template 전파 | 보안 | 구현 난이도 | 권장 |
|-------------|---------------|--------------|------|-----------|------|
| A: 문서화 | ✅ | ❌ | ✅ | Low (10분) | ⭐⭐⭐⭐⭐ |
| B: Hook 조사 | ❌ (조사 필요) | ✅ (if supported) | ✅ | Medium (조사 후 결정) | ⭐⭐⭐ |
| C: Platform 요청 | ❌ | ✅ (if implemented) | ✅ | Low (제출만) | ⭐⭐ |
| D: Hybrid | ✅ | ✅ (장기) | ✅ | Low + Medium | ⭐⭐⭐⭐ |
| E: 수동 승인 | ✅ | ❌ | ✅✅ | Zero (아무것도 안 함) | ⭐ |

---

## Next Steps

### Immediate (Today)
1. **GEMINI.md 업데이트**: Alternative A 구현 (10분)
2. **문서 확인 보고서 수정**: YOLO mode 명확히 설명

### Short-term (This Week)
3. **Hook 지원 조사**: Alternative B (automation-engineer)
4. **조사 결과 보고서**: memory/에 저장

### Long-term (This Month)
5. **Platform 기능 요청**: Alternative C (PM 또는 사용자 직접)

---

## Conclusion

**가장 현실적인 solution**: **Alternative A (문서화)** + **Alternative B (Hook 조사)**

즉시 문서화를 구현하고, Hook 지원 여부를 조사하여 장기적 개선 가능성을 확인합니다.

만약 Hook이 지원된다면, Alternative A에서 Alternative B로 전환하여 `.gemini/settings.json` 기반 solution을 구현할 수 있습니다.
