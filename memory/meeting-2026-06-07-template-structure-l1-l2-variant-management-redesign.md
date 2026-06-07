# Meeting Transcript

**Date**: 2026-06-07
**Topic**: Template structure and L1-L2 variant management redesign
**Participants**: architect, docs-writer, automation-engineer
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

### Round 1

**[architect]**:

L1(templates/common/agents/pm.md)의 현재 상태를 분석해 보니, 이것은 심각한 구조적 문제를 안고 있습니다. ADR-0033에서 정의한 L0→L1→L2 계층 구조에서, L1은 "순수 템플릿"으로서 L0를 상속받되되 variant 특성을 가져서는 안 됩니다. 하지만 현재 L1 pm.md는 L0(workspace)의 단순 복사본으로서, variant 템플릿으로서의 역할을 하지 못하고 있습니다.

docs-writer에게 묻겠습니다. 현재 L1 pm.md가 356줄인데, 이 중에서 실제로 모든 variant에 공통적으로 적용되어야 하는 "공통 항목"은 무엇이 있습니까? 그리고 variant별로 달라져야 하는 "variant 특이사항"은 무엇이 있을까요?

---

**[docs-writer]**:

architect가 지적한 문제가 맞습니다. 현재 L1 pm.md를 분석해 보니:

**공통 항목** (모든 variant에 적용):
- Phase 0, 2, 5, 6 오케스트레이션
- PM Gateway 실행 계획 서식
- 에이전트 디스패 규칙
- Quality gate 강제
- 필수 도구 집합

**Variant 특이사항** (현재 L1에 혼재되어 있음):
- Agent Roster (현재는 co-consult 기반으로 하드코딩됨)
- Governance Workflow (co-consult 특화)
- Dispatch Protocol (co-consult 특화)

하지만 더 근본적인 문제는 L1이 "하나의 variant"처럼 동작한다는 점입니다. ADR-0031 Fork Model에 따르면 L1은 공통 기반만 제공해야 하고, L2가 독립적으로 진화해야 합니다.

automation-engineer에게 묻겠습니다. 현재 scaffolding script들이 L1과 L2의 관계를 어떻게 처리하고 있습니까? 특히 new-project.ts와 create-l2-scaffold.ts를 확인해 본 적이 있습니까?

---

**[automation-engineer]**:

docs-writer의 분석이 정확합니다. 현재 scaffolding scripts를 확인해 보니:

**new-project.ts**: L1 → L2 복사 방식 사용
- `templates/common/` 전체를 복사
- L1 pm.md의 Agent Roster가 모든 L2에 복사됨

**create-l2-scaffold.ts**: 동일한 L1 복사
- variant 특화는 수동으로 처리해야 함

이것이 근본적인 문제입니다. L1이 co-consult처럼 동작하게 되어서, 새로운 variant를 만들 때마다 co-consult의 Agent Roster를 가지게 됩니다.

architect에게 제안을 합니다. L1 pm.md를 "내용이 없는 순수 extends 파일"로 만들고, 실제 내용은 L0에서 상속받도록 재설계하는 방안은 어떻습니까?

---

**[architect]**:

automation-engineer의 제안은 ADR-0033에서 이미 제안되었던 것과 같습니다. 하지만 이번 회의에서 확인된 것은 현재 L1이 variant처럼 동작하고 있다는 점입니다.

**제안: L1 pm.md를 순수 extends 파일로 전환**

```yaml
---
extends: ../../../agents/pm.md
type: template
description: "Pure L1 template - inherits all content from L0"
overrides:
  - section: "## Agent Roster"
    scope: "remove"  # L1은 Agent Roster를 가지지 않음
  - section: "## Governance Workflow"
    scope: "remove"  # L1은 Governance Workflow를 가지지 않음
---
```

이렇게 하면:
1. L1은 L0의 모든 내용을 상속받음
2. variant 특성(제거될 섹션)은 override로 명시
3. L2는 L1을 extends하되, 추가로 variant.pm.md를 통해 특이사항을 정의

docs-writer, 이 접근 방식이 L0→L1→L2 계층 구조에 맞다고 보십니까?

---

**[docs-writer]**:

architect의 접근이 구조적으로 타당합니다. 하지만 한 가지 우려가 있습니다: **variant.pm.md 도입**입니다.

현재 variant 폴더 구조를 보니:
```
templates/
  common/
    agents/
      pm.md
  co-consult/
    agents/
      pm.md
```

variant.pm.md를 추가하면:
```
templates/
  common/
    agents/
      pm.md (extends L0, overrides 제거)
  co-consult/
    variant.md (새로운 파일, variant 특성 정의)
    agents/
      pm.md (extends L1, 추가 특성)
```

하지만 이것은 기존 구조와 충돌할 수 있습니다. automation-engineer, 기존 script들이 variant 폴더 구조를 어떻게 기대하고 있습니까?

---

**[automation-engineer]**:

기존 script들은 현재 `templates/<variant>/` 폴더 구조를 기대하고 있습니다. variant.pm.md를 추가하면 script들을 전면 수정해야 할 것입니다.

**대안 제안**: 기존 `templates/<variant>/agents/pm.md` 파일을 `variant.md`로 재활용

현재 L2 pm.md 파일들이 이미 존재하는데, 이것들을 `variant.md`로 리네이밍하고 역할을 재정의할 수 있습니다:

```markdown
<!-- templates/co-consult/variant.md -->
extends: ../common/agents/pm.md
variant_overrides:
  - Set custom Agent Roster for consulting workflow
  - Override Governance Workflow
  - Define consulting-specific dispatch protocol
```

이렇게 하면:
- 기존 폴더 구조 유지
- 기존 script들은 pm.md 파일을 찾지만, 이제 variant 특성 정의 파일이 됨
- L1은 순수 extends 파일로 전환

architect, 이 접근이 어떻습니까?

---

**[architect]**:

automation-engineer의 제안이 현실적입니다. 기존 폴더 구조를 유지하면서 variant 특성을 분리하는 좋은 방법입니다.

docs-writer, variant.md(또는 variant.pm.md)가 관리해야 할 variant 특이사항을 구체적으로 정의해 줄 수 있겠습니까?

---

**[docs-writer]**:

variant.md가 관리할 내용:

1. **Agent Roster 정의**: variant별 전문가 에이전트 목록
2. **Workflow 단계 정의**: variant별 특화된 Phase 정의 (예: co-consult는 Phase 0-Triage-Analysis-Delivery)
3. **Dispatch Protocol**: variant별 에이전트 호출 규칙
4. **Governance 요구**: variant별 승인 필요 단계
5. **Resource 할당**: variant별 팀 구성 및 역할

**구조적 제안**:

```yaml
# templates/co-consult/variant.md
variant:
  name: co-consult
  formal_name: Consulting Project Template
  description: Business consulting and strategic advisory projects
  
workflow:
  phases: [0, 1, 2, 4, 5, 6]  # Phase 3 제외
  triage_required: true
  
agent_roster:
  - phase: Triage
    agents: [engagement-leader, strategy-analyst, industry-expert]
  - phase: Analysis
    agents: [data-analyst, subject-matter-expert]
    
dispatch_rules:
  can_lead_phases: [0, 2, 6]
  auto_dispatch_to: [engagement-leader, solutions-architect]
  
governance:
  client_approval_required: true
  stakeholder_signoff: true
```

automation-engineer, 이 구조를 scaffolding script에 통합하기 어렵겠습니까?

---

**[automation-engineer]**:

제안된 구조를 scaffolding에 통합하는 것은 가능하지만, 상당한 복잡도가 있습니다. **YAML 파싱과 기존 스크립트의 호환성**을 고려해야 합니다.

**구현 방안**:

1. **variant.md 로더**: `templates/<variant>/variant.md` 새로 생성
2. **scaffolding script 수정**: 
   - variant.md 읽기
   - YAML frontmatter 추출
   - context.md 생성 시 해당 내용 반영
   - agents/pm.md 생성 시 extends 체인 참조

**영향 범위**:
- `scripts/new-project.ts`
- `scripts/create-l2-scaffold.ts`
- `scripts/l2-to-variant-pipeline.ts`
- `scripts/create-new-variant.ts`

architect, 한 가지 추가 확인이 필요합니다. 현재 common/agents/lifecycle-manager.md 파일이 있는데, 실제로 사용되고 있습니까?

---

**[architect]**:

좋은 지적입니다. lifecycle-manager agent를 검토해 봐시다.

grep으로 검색해 보니 workspace 전체에서 lifecycle-manager를 참조하는 파일이 거의 없습니다:
- `agents/lifecycle-manager.md` (L0)
- `common/agents/lifecycle-manager.md` (L1 복사본)

그런데 실제 사용되는 곳:
- AGENTS.md에 등록되어 있음
- skill-lifecycle-manager 스킬에서만 사용됨

**결론**: lifecycle-manager는 **workspace lifecycle 관리용**이지, **PM 오케스트레이션용이 아닙니다**. 따라서:
1. L1 common/agents/에 있을 필요 없음 (사용되지 않음)
2. L0에만 존재하면 됨

docs-writer와 automation-engineer, 이 분석이 맞습니까? variant.md 구조와 scaffolding 수정 방안에 동의하십니까?

---

**[docs-writer]**:

동의합니다. automation-engineer의 구현 방안과 architect의 lifecycle-manager 분석에 동의합니다.

---

**[automation-engineer]**:

구현 방안에 동의합니다. YAML frontmatter 방식으로 variant.md를 정의하고 scaffolding script들을 수정하겠습니다.

---

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-01 | architect | High | Redesign L1 pm.md as pure extends file - remove all content, add extends directive to L0 with overrides for Agent Roster/Governance Workflow sections | L0-only | Phase 1-2 |
| A-02 | docs-writer | High | Define variant.md YAML schema - specify structure for variant metadata, agent roster, workflow phases, dispatch rules, governance requirements | L0-only | Phase 1-2 |
| A-03 | automation-engineer | Medium | Update scaffolding scripts to read variant.md - modify new-project.ts, create-l2-scaffold.ts, l2-to-variant-pipeline.ts, create-new-variant.ts to parse variant.md and integrate into context.md generation | L0-only | Phase 4 |
| A-04 | automation-engineer | Low | Remove unused lifecycle-manager from L1 - delete templates/common/agents/lifecycle-manager.md | L0-only | Phase 4 |
| A-05 | architect | Low | Update ADR-0033 to document new L1→L2 extends pattern - add variant.md documentation, clarify pure template approach | L0-only | Phase 4 |

---
*Transcript created by: pm*
*Synthesis by: auditor (cross-domain agent)*