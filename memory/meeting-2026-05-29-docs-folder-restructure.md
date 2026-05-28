# Meeting Transcript

**Date**: 2026-05-29
**Topic**: workspace root docs/ 폴더 정리 및 구조 재설계
**Participants**: pm, architect, docs-writer, auditor
**Rounds**: 2
**Language**: Korean
**Status**: Complete

---

## Agenda

- 문제 1: docs/lifecycle/ 폴더와 agents/, skills/ 폴더의 중복
- 문제 2: docs/variant/ 폴더를 templates/로 이전 필요성
- 최종 구조 제안 및 실행 계획 수립

---

## Transcript

### **Round 1**

**[PM (Facilitator)]**: (Opening)

오늘 회의는 workspace root의 docs/ 폴더 구조를 재설계하는 것입니다. 현재 발견된 문제들은:

1. **lifecycle/ 폴더 중복**: workspace root에 `agents/`와 `skills/`가 있는데, 방금 생성한 `docs/lifecycle/agents/`와 `docs/lifecycle/skills/`가 중복
2. **variant/ 폴더 위치**: `docs/variant/`에 variant별 phase 정의가 있는데, 이것은 `templates/`로 이전해야 할 것으로 보임

Architect님, 구조적 관점에서 먼저 의견을 주십시오.

---

**[Architect]**:

감사합니다, PM님. 제가 보기에 이것은 **단일 진실의 원칙(Single Source of Truth)** 위반입니다.

**문제 1 - lifecycle/ 폴더 중복**에 대해:

현재 중복된 구조:
```
workspace root/
├── agents/              # 에이전트 정의 (실제 파일)
├── skills/              # 스킬 정의 (실제 파일)
└── docs/
    └── lifecycle/
        ├── agents/      # 에이전트 lifecycle 문서 (새로 생성)
        └── skills/      # 스킬 lifecycle 문서 (새로 생성)
```

이것은 다음과 같은 문제를 야기합니다:
- **Definition vs Documentation**: `agents/*.md`가 실제 정의인데, `docs/lifecycle/agents/*.md`가 또 다른 정의가 됨
- **Sync 부담**: 두 곳을 동기화해야 함 - 수정 시 agents/와 docs/lifecycle/agents/ 모두 업데이트 필요
- **Confusion**: 사용자가 어느 것을 "진짜"로 봐야 하는지 혼란

제안:
1. **lifecycle 문서를 agents/와 skills/ 내부에 통합**: 각 `agents/*.md` 파일에 lifecycle 섹션을 포함
2. **docs/lifecycle/ 폴더는 거버넌스 문서만 보관**: Phase transition rules, validation procedures 등

**문제 2 - variant/ 폴더 위치**에 대해:

`docs/variant/`에 있는 것은 variant별 phase 정의입니다. 이것은 어디에 속해야 할까요?

제 분석:
- **Variant phase 정의**는 template 소속입니다. 각 variant는 독립적인 workflow를 가집니다.
- **예**: co-design template이 생성될 때, `templates/co-design/agents/pm.md`가 co-design만의 phase를 사용해야 함
- **현재 문제**: phase 정의가 workspace root에 있어서, variant template에서 이를 참조하기 어려움

제안:
1. **`docs/variant/` → `templates/common/variant/`로 이전**: variant phase 정의를 template 공간으로
2. **각 variant template에서 참조**: `templates/co-design/agents/pm.md`가 `templates/common/variant/co-design/phases.md`를 참조

Docs-writer님, 문서 관리 관점에서 어떻게 생각하십니까?

---

**[Docs-writer]**:

Architect님의 분석에 동의합니다만, 구체적인 구조 제안이 필요합니다.

**lifecycle 문서 통합**에 대해:

Architect님이 "각 `agents/*.md` 파일에 lifecycle 섹션을 포함"하라고 하셨는데, 이것은 **frontmatter + markdown 통합** 접근이 필요합니다:

```markdown
---
name: pm
tier: high
# ... other frontmatter
lifecycle:
  phase: production
  created: 2026-05-15
  history:
    - {date: 2026-05-15, from: null, to: design, reason: "Initial creation", approver: "pm"}
    - {date: 2026-05-25, from: design, to: production, reason: "Acceptance criteria met", approver: "auditor"}
---

## Role

...

## Lifecycle Documentation

### Phase History
...

### Acceptance Criteria
...
```

이렇게 하면:
- **Single source**: `agents/*.md`가 유일한 진실
- **Self-contained**: 각 에이전트가 자신의 lifecycle을 포함
- **No duplication**: `docs/lifecycle/agents/` 폴더 불필요

**variant/ 폴더 이전**에 대해:

동의합니다. `templates/common/variant/`로 이전하는 것이 맞습니다. 하지만 **참조 방법**이 중요합니다:

**Option A - Relative path 참조**:
```markdown
# templates/co-design/agents/pm.md

## Domain Workflow

Follow the co-design phase definitions: [../../../../common/variant/co-design/phases.md](../../../../common/variant/co-design/phases.md)
```

**Option B - Include directive**:
```markdown
# templates/co-design/agents/pm.md

<!-- @include ../../../../common/variant/co-design/phases.md -->
```

제안은 **Option A**입니다. Git에서 relative path로 참조하는 것이 표준적입니다.

Auditor님, 이 구조가 검증 가능한지 어떻게 생각하십니까?

---

**[Auditor]**:

두 분의 제안을 검토해 보겠습니다.

**lifecycle 통합 (frontmatter 접근)**에 대해:

장점:
- ✅ Single source of truth 달성
- ✅ 중복 제거
- ✅ 자기-참조적 구조

단점/위험:
- ⚠️ **Frontmatter 복잡성**: YAML이 너무 길어짐
- ⚠️ **Validation 부담**: `validate-agents.sh`가 frontmatter와 markdown body 모두 검증해야 함
- ⚠️ **Readability**: lifecycle 섹션이 길어지면 실제 agent 정의보다 문서가 길어질 수 있음

제안:
**Frontmatter 간소화 + 별도 문서 유지**:

1. **Frontmatter에는 간단한 lifecycle 정보만**:
```yaml
---
lifecycle:
  phase: production
  created: 2026-05-15
  last_updated: 2026-05-29
```

2. **상세 lifecycle 문서는 `docs/lifecycle/agents/`에 보관** (현재 상태 유지):
- 이것은 **documentation이 아닌 definition**이 아닙니다
- `agents/*.md`는 **runtime definition** (에이전트가 실제로 읽는 파일)
- `docs/lifecycle/agents/*.md`는 **governance record** (거버넌스 기록)

이유:
- Agent가 실행될 때 `agents/*.md`를 읽는데, 이 파일이 너무 길면 성능 문제
- Lifecycle 기록은 **audit trace**로 필요하지만, agent runtime에는 불필요
- **Separation of concerns**: Runtime definition vs Governance record

**variant/ 폴더 이전**에 대해:

완전히 동의합니다. `templates/common/variant/`가 올바른 위치입니다.

추가 제안:
- **variant/ 이전 시 validate-templates.ts 경로 업데이트 필요**
- **VARIANT_CONTRACT.md**가 이 경로를 참조할 수 있으니 확인 필요

PM님, 최종 구조 제안을 정리해 주십시오.

---

### **Round 1 - Summary**

지금까지 논의된 내용:
1. **lifecycle/ 폴더**: `docs/lifecycle/agents/`와 `docs/lifecycle/skills/` 유지 (governance record 용도)
2. **variant/ 폴더**: `docs/variant/` → `templates/common/variant/`로 이전
3. **Frontmatter 간소화**: agents/*.md에는 간단한 lifecycle 정보만 유지

---

### **Round 2**

**[PM]**:

논의를 종합하고 최종 구조 제안을 정리하겠습니다.

**최종 구조 제안**:

```
workspace root/
├── agents/                     # Runtime definition (실제 사용)
│   ├── pm.md                   # Frontmatter: 간단한 lifecycle 정보
│   ├── architect.md
│   └── ...
├── skills/                     # Runtime definition (실제 사용)
│   ├── agent-lifecycle-manager/SKILL.md
│   └── ...
├── docs/                       # Documentation & Governance (기록용)
│   ├── constitution/           # 거버넌스 (기존)
│   ├── governance/             # PR workflow, branch strategy (신규)
│   ├── lifecycle/              # Governance record (신규, 유지)
│   │   ├── README.md            # Phase transition rules
│   │   ├── agents/              # 상세 lifecycle 기록
│   │   │   ├── pm.md
│   │   │   ├── architect.md
│   │   │   └── ...
│   │   └── skills/              # 상세 lifecycle 기록
│   │       ├── agent-lifecycle-manager.md
│   │       └── ...
│   └── superpowers/             # 슈퍼파워 (기존)
└── templates/                  # Template 정의
    ├── common/
    │   ├── variant/            # Variant phase 정의 (이전 예정)
    │   │   ├── co-design/phases.md
    │   │   ├── co-develop/phases.md
    │   │   └── ...
    │   ├── CLAUDE.md            # Runtime config (유지)
    │   ├── GEMINI.md
    │   └── ...
    └── co-design/              # 각 variant template
        ├── agents/pm.md        # ../../common/variant/co-design/phases.md 참조
        └── ...
```

**핵심 원칙**:
1. **Runtime vs Governance 분리**: `agents/*.md`는 실행용, `docs/lifecycle/agents/*.md`는 거버넌스 기록용
2. **Single source for phases**: Variant phase 정의는 `templates/common/variant/`가 유일한 원천
3. **Cross-reference**: Variant agent가 `templates/common/variant/`를 참조

**실행 순서**:
1. **Phase 1**: `docs/variant/` → `templates/common/variant/` 이전
2. **Phase 2**: 각 variant agent의 phase 참조 경로 업데이트
3. **Phase 3**: validate-templates.ts 경로 확인 및 업데이트
4. **Phase 4**: `docs/lifecycle/` 폴더는 그대로 유지 (governance record)

이 구조에 동의하십니까?

---

**[Architect]**:

동의합니다. 이 구조가 **명확한 관심사항 분리**를 합니다:

**Runtime Definition** (`agents/*.md`):
- Purpose: Agent가 실제로 읽는 파일
- Content: Role, dispatch protocol, constraints
- Lifecycle: 간단한 frontmatter only (phase, created, last_updated)

**Governance Record** (`docs/lifecycle/agents/*.md`):
- Purpose: Audit trace, phase transition history
- Content: 상세 phase history, acceptance criteria, dependencies
- NOT used by agent runtime

이것은 **Practical한 접근**입니다. Agent가 실행될 때 긴 lifecycle 문서를 읽을 필요가 없습니다.

한 가지 추가 제안:
**Frontmatter format 표준화**:

```yaml
---
lifecycle:
  phase: production          # current phase
  created: 2026-05-15        # creation date
  last_updated: 2026-05-29   # last modification date
  governance: docs/lifecycle/agents/pm.md  # link to detailed record
---
```

Docs-writer님, 이 frontmatter format을 모든 에이전트에 적용할 수 있습니까?

---

**[Docs-writer]**:

네, 가능합니다. Frontmatter 표준화는 좋습니다. 그리고 제가 확인해야 할 부분이 있습니다:

**variant/ 이전 시 참조 경로**입니다.

현재 각 variant agent가 `docs/variant/`를 참조하고 있는데, 이것을 `templates/common/variant/`로 변경해야 합니다.

**예시 (co-design)**:

**이전** (잘못된 참조):
```markdown
# templates/co-design/agents/pm.md

Follow the co-design phase definitions: [../../../../docs/variant/co-design/phases.md](../../../../docs/variant/co-design/phases.md)
```

**이후** (올바른 참조):
```markdown
# templates/co-design/agents/pm.md

Follow the co-design phase definitions: [../../../../common/variant/co-design/phases.md](../../../../common/variant/co-design/phases.md)
```

또한, **Architect님의 제안대로 frontmatter에 `governance` 필드를 추가**하면, 각 에이전트가 자신의 governance 문서를 찾을 수 있습니다:

```yaml
---
governance: docs/lifecycle/agents/pm.md
---
```

Auditor님, 이 구조가 검증 가능한지 확인해 주십시오.

---

**[Auditor]**:

구조를 검증해 보겠습니다.

**검증 관점**:

1. **Runtime Performance**: ✅ Agent가 짧은 frontmatter만 읽으므로 성능 OK
2. **Traceability**: ✅ `docs/lifecycle/agents/*.md`가 audit trace로 보존됨
3. **Single Source of Truth**: ✅ Variant phase는 `templates/common/variant/`만 존재
4. **Cross-reference Validity**: ✅ Relative path로 참조하므로 안전

**추가 검증 필요 사항**:

1. **validate-agents.sh** 업데이트:
   - 현재 `docs/lifecycle/agents/*.md`의 필수 섹션을 검증
   - 이것은 **governance record validation**으로 그대로 유지

2. **agents/*.md frontmatter validation**:
   - `lifecycle.phase`가 production/review/design 중 하나인지
   - `lifecycle.governance` 경로가 실제로 존재하는지

3. **variant/ 이전 시 경로 참조 확인**:
   - 각 variant agent가 새로운 경로를 참조하는지
   - `grep -r "docs/variant" templates/*/`로 기존 참조 찾기

**Acceptance Criteria**:
- [ ] `docs/variant/`가 `templates/common/variant/`로 이전됨
- [ ] 각 variant agent가 새로운 경로를 참조함
- [ ] `docs/lifecycle/` 폴더 구조 유지됨
- [ ] `validate-agents.sh`가 governance record만 검증함
- [ ] 모든 에이전트 frontmatter에 `governance` 필드 있음

PM님, 이제 최종 합의안을 도출할 수 있습니까?

---

## Synthesis

**[Auditor]**: (Synthesis)

Round 1과 Round 2의 논의를 종합하면 다음과 같습니다.

---

### Points of Agreement

1. **Runtime vs Governance 분리**: `agents/*.md`는 실행용, `docs/lifecycle/agents/*.md`는 거버넌스 기록용
2. **variant/ 이전**: `docs/variant/` → `templates/common/variant/`로 이전
3. **Frontmatter 표준화**: 간단한 lifecycle 정보 + `governance` 링크
4. **docs/lifecycle/ 유지**: Governance record 용도로 그대로 보존

---

### Action Items

| # | Owner | Deliverable | Phase |
|---|-------|-------------|-------|
| D-01 | Docs-writer, Architect | `docs/variant/` → `templates/common/variant/` 이전 | Phase 1 |
| D-02 | Docs-writer | 각 variant agent의 phase 참조 경로 업데이트 (`../../docs/variant/` → `../../common/variant/`) | Phase 2 |
| D-03 | Docs-writer, Architect | validate-templates.ts 경로 확인 및 업데이트 | Phase 3 |
| D-04 | Docs-writer | 모든 `agents/*.md`에 표준화된 frontmatter 추가 (lifecycle.phase, lifecycle.governance) | Phase 4 |
| D-05 | Auditor | validate-agents.sh 업데이트 (governance record validation 명확화) | Phase 5 |
| D-06 | Docs-writer | templates/common/ 완료된 수행계획 파일 삭제 (PHASE_3_DELIVERY.md, VARIANT_LIFECYCLE_INTEGRATION.md) | Phase 6 |
| D-07 | Docs-writer, Auditor | templates/common/ lifecycle 파일 처리 (LIFECYCLE_GOVERNANCE.md 등 docs/로 이전 또는 병합 검토) | Phase 7 |

---

### Open Disagreements or Unresolved Questions

없음. 모든 참여자가 제안된 구조 재설계에 동의함.

---

## Final Structure Agreement

**Accepted Structure**:

```
workspace root/
├── agents/               # Runtime definition
├── skills/               # Runtime definition
├── docs/                  # Documentation & Governance
│   ├── constitution/
│   ├── governance/
│   ├── lifecycle/       # Governance record (KEEP)
│   └── superpowers/
└── templates/            # Template definitions
    └── common/
        └── variant/       # Variant phases (MOVE from docs/variant/)
```

**Key Principles**:
1. **Separation of Concerns**: Runtime vs Governance
2. **Single Source**: Variant phases in templates/common/variant/ only
3. **Standardization**: Frontmatter with governance links

## Execution Phases

### Phase 1: Variant Folder Migration
**Owner**: Docs-writer, Architect
- Move `docs/variant/` → `templates/common/variant/`
- Update all references

### Phase 2: Reference Path Updates
**Owner**: Docs-writer
- Update variant agent references
- Validate all paths

### Phase 3: Validation Scripts Update
**Owner**: Architect
- validate-templates.ts path check

### Phase 4: Frontmatter Standardization
**Owner**: Docs-writer
- Add lifecycle metadata to all agents
- Add governance links

### Phase 5: Validation Script Enhancement
**Owner**: Auditor
- Clarify validate-agents.sh purpose

### Phase 6: Cleanup Completed Plans
**Owner**: Docs-writer
- Remove PHASE_3_DELIVERY.md
- Remove VARIANT_LIFECYCLE_INTEGRATION.md

### Phase 7: Lifecycle File Consolidation
**Owner**: Docs-writer, Auditor
- Review templates/common/ lifecycle files
- Move or merge with docs/governance/

## Post-Meeting Notes

This restructuring resolves:
- ❌ **Duplicate lifecycle records**: Now clear separation (runtime vs governance)
- ❌ **Confusing variant locations**: Now in templates/common/variant/
- ❌ **Mixed concerns in templates/common/**: Will be cleaned up in Phase 6-7

All participants agreed to the proposed structure and execution plan.
