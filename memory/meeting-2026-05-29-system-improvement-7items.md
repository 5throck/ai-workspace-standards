# Meeting Transcript

**Date**: 2026-05-29
**Topic**: 시스템 개선 7개 아이템에 대한 구체적 개선방안 도출
**Participants**: pm, architect, auditor, automation-engineer, lifecycle-manager, docs-writer
**Rounds**: 2
**Language**: Korean
**Status**: Complete

---

## Agenda

- A-01: variant별 workflow phase 반영 점검 (workspace root 및 template)
- A-02: PM 실행과제 3-tier 전략 시각화 (workspace root 및 template)
- A-03: lifecycle 관리 문서화 (workspace root)
- A-04: 스킬 신설 후 수정 점검 절차 (workspace root 및 template)
- A-05: 스크립트 고도화 및 점검 관리 (workspace root 및 template)
- A-06: doc 폴더로 이전 및 파일 구조 재정비 (workspace root)
- A-07: 완료된 수행계획 md 정리 (workspace root)

---

## Transcript

### **Round 1**

**[PM (Facilitator)]**: (Opening)

오늘 회의는 우리 시스템의 7가지 핵심 개선 과제를 다룹니다. 각 아이템은 variant별 차이, 실행과제의 3-tier 전략 시각화, lifecycle 문서화, 스킬 점검 절차, 스크립트 고도화, 파일 구조 재정비, 완료된 문서 정리를 다룹니다. 이 모든 것이 상호 연결되어 있으므로, 각 전문가의 관점에서 구체적인 해결책을 제안해 주십시오.

Architect님, 먼저 **A-01 (variant별 workflow phase 반영)**과 **A-06 (doc 폴더로의 이전 및 파일 구조)**을 시작으로 구조적 관점에서 의견을 부탁드립니다.

---

**[Architect]**:

감사합니다, PM님. 제가 보기에 A-01과 A-06은 하나의 큰 구조 재설계 문제입니다.

**A-01 (variant별 workflow phase 반영)**에 대해: 현재 workspace root와 template에 동일한 phase 정의가 복사되어 있지만, 이것이 위험합니다. co-design, co-work, co-pair 각 variant는 다른 workflow를 가집니다. 예를 들어:
- **co-design**: Design → Prototype → Test → Iterate
- **co-work**: Analyze → Draft → Review → Publish
- **co-pair**: Plan → Pair-program → Review → Merge

그런데 현재 phase 정의가 variant 간에 동기화되지 않아, PM이 실행과제를 수행할 때 variant를 바꾸면 phase가 깨집니다. 제안:
1. **Template에는 각 variant 전용 phase 정의 파일 생성**: `templates/co-design/phases.md`, `templates/co-work/phases.md` 등
2. **Workspace root에는 "variant 공통" core phases만 유지**: Plan → Execute → Verify → Archive (모든 variant에 적용되는 최소 단위)
3. **PM의 실행과제 plan 생성 시, 현재 variant를 감지하고 해당 variant의 phase를 자동 로드**

**A-06 (doc 폴더 이전 및 파일 구조)**에 대해: 현재 root에 너무 많은 메타데이터 파일이 섞여 있습니다. 구조 제안:
```
workspace-root/
├── doc/
│   ├── lifecycle/          # lifecycle 관리 문서
│   ├── variant/            # variant별 정의
│   └── governance/         # 거버넌스/PR 규칙
├── agents/                 # agent 정의 (그대로)
├── skills/                 # skill 정의 (그대로)
├── templates/              # template 정의 (그대로)
└── scripts/               # 자동화 스크립트 (그대로)
```

이것은 단순한 이동이 아니라, **문서의 목적별 분류**입니다. PM님, 이 구조는 실행과제의 3-tier 전략 시각화(A-02)에도 영향을 미칠 것입니다. Lifecycle-manager님, A-04 (에이전트/스킬 생애주기 연관)와 A-03 (lifecycle 문서화)에 대해 어떻게 생각하십니까?

---

**[Lifecycle-manager]**:

Architect님의 제안에 동의합니다. 특히 variant별 phase 분리는 생애주기 관리에서도 필수적입니다.

**A-03 (lifecycle 문서화)**에 대해: 현재 에이전트와 스킬의 생애주기 상태(phase)는 코드로만 관리되고, 설계 이력이 없습니다. 예를 들어:
- `agents/pm.md`이 "production" phase라고 가정해 봅시다. 언제 production으로 승격되었는지? 어떤 acceptance criteria를 만족했는지? 이것이 기록되어 있지 않습니다.
- 스킬도 마찬가지입니다. `skill-lifecycle-manager` 스킬이 언제 생성되었고, 어떤 리뷰를 거쳤는지?

제안:
1. **`doc/lifecycle/agents/`에 각 에이전트의 lifecycle 기록 저장**
2. **스킬도 동일하게 `doc/lifecycle/skills/`에 기록**
3. **phase 승격은 auditor의 검증 후에만 가능**

**A-04 (스킬 신설 후 수정 점검 절차)**에 대해: 이것은 A-03과 연결됩니다. 스킬이 신설되면 "design" phase로 시작하고, 리뷰를 거쳐 "production"으로 승격됩니다. 문제는 **production 이후 수정이 필요할 때**입니다. 현재 절차가 없습니다. 제안:
1. **스킬 수정 시 "design" phase로 되돌림 (rollback)**
2. **수정 내용을 doc/lifecycle/skills/[skill-name].md에 기록**
3. **Auditor가 수정 내용을 검증하고 다시 "production"으로 승격**

Docs-writer님, 이 기록 관리는 님과 긴밀하게 협력해야 할 것 같습니다. A-03과 A-04를 문서화 관점에서 어떻게 보십니까?

---

**[Docs-writer]**:

Lifecycle-manager님, 완전히 동의합니다. 문서화는 단순한 기록이 아니라 **거버넌스의 핵심**입니다.

**A-03 (lifecycle 문서화)**에 대해: 제가 보기에 `doc/lifecycle/` 폴더 구조는 다음과 같아야 합니다:
```
doc/lifecycle/
├── agents/
│   ├── pm.md
│   ├── architect.md
│   └── ...
├── skills/
│   ├── skill-lifecycle-manager.md
│   ├── meeting-facilitation.md
│   └── ...
└── templates/
    ├── co-design.md
    ├── co-work.md
    └── co-pair.md
```

각 파일은 Markdown이어야 하고, 다음 섹션을 포함해야 합니다:
1. **Creation Date**: 언제 만들어졌는지
2. **Phase History**: phase 변경 이력 (날짜 + 이유 + 승인자)
3. **Acceptance Criteria**: 각 phase별 만족 기준
4. **Dependencies**: 다른 에이전트/스킬과의 의존성

**A-04 (스킬 수정 점검 절차)**에 대해: 스킬이 production일 때 수정되면, 다음 절차를 제안합니다:
1. **Pull Request 제목에 "[skill-update] [skill-name]" 접두사 추가**
2. **PR 본문에 수정 이유와 acceptance criteria 변경사항 명시**
3. **Auditor가 PR 템플릿에 따라 검증**
4. **Merge 후 `doc/lifecycle/skills/[skill-name].md`의 Phase History 업데이트**

Automation-engineer님, 이제 A-05 (스크립트 고도화)와 A-07 (완료된 문서 정리)에 대해 이야기해 봅시다. 스크립트는 이 모든 것을 자동화하는 핵심입니다. A-05에 대해 어떻게 생각하십니까?

---

**[Automation-engineer]**:

Docs-writer님의 말씀대로, 스크립트는 거버넌스의 자동화 핵심입니다.

**A-05 (스크립트 고도화)**에 대해: 현재 스킬/에이전트는 md 파일로 관리되는데, md 파일이 늘어나면 다음을 놓치기 쉽습니다:
- 가이드라인 위반 (예: Acceptance Criteria가 없음)
- 원칙 위반 (예: Phase History가 기록되지 않음)
- 일관성 위반 (예: 다른 스킬과 다른 구조)

제안: **`scripts/validate-skills.sh`**와 **`scripts/validate-agents.sh`**를 만들어서 자동 점검합니다:

```bash
#!/bin/bash
# scripts/validate-skills.sh

# 1. 모든 skill/*.md 파일을 순회
# 2. 각 파일이 다음 섹션을 포함하는지 확인:
#    - ## Acceptance Criteria
#    - ## Phase History
#    - ## Dependencies (선택)
# 3. 누락된 섹션이 있으면 경고 출력
# 4. git pre-commit hook에서 실행

# 예시 출력:
# ✅ skill-lifecycle-manager.md: All required sections present
# ⚠️  meeting-facilitation.md: Missing 'Phase History' section
# ❌ frontend-design.md: Missing 'Acceptance Criteria' section
```

또한 **`scripts/cleanup-completed-md.sh`**를 만들어서 A-07 (완료된 문서 정리)을 자동화합니다:
```bash
#!/bin/bash
# memory/ 폴더에서 완료된 수행계획 md를 탐지
# 완료 기준:
#   - 모든 task가 'completed' 상태
#   - 최종 종합 메시지 있음
# 완료된 파일을 memory/completed/로 이동
```

Auditor님, 이 스크립트들은 pre-commit hook에서 실행되어야 합니다. 검증 절차에 대해 어떻게 생각하십니까?

---

**[Auditor]**:

Automation-engineer님의 스크립트 제안은 검증 거버넌스에 필수적입니다.

**A-05 (스크립트 고도화)**에 대해: 제안하신 두 스크립트를 pre-commit hook에 추가해야 합니다. 구체적으로:
1. **`.git/hooks/pre-commit`에 `scripts/validate-skills.sh`와 `scripts/validate-agents.sh` 추가**
2. **검증 실패 시 commit 방지** (exit code 1 반환)
3. **경고(⚠️)는 허용하지만 오류(❌)는 방지**

또한 **`scripts/validate-doc-folder.sh`**를 만들어서 A-06 (doc 폴더 이전)을 검증합니다:
```bash
#!/bin/bash
# workspace root에 다음 파일들이 있는지 확인:
# - CHANGELOG.md (있어야 함)
# - CLAUDE.md (있어야 함)
# - lifecycle 관련 md (없어야 함, doc/lifecycle/에 있어야 함)
# 위반 시 경고 출력
```

**A-02 (3-tier 전략 시각화)**에 대해: 이것은 PM의 실행과제 plan 생성과 관련이 있습니다. PM이 실행과제를 수행하기 전에 사용자에게 다음을 보여주어야 합니다:
1. **Task 목록**: 각 task의 제목과 담당 agent
2. **Tier assignment**: 각 task가 High/Medium/Low 중 어느 tier에 속하는지
3. **Model selection**: 각 tier에 어떤 모델을 사용할지 (예: High→opus, Medium→sonnet, Low→haiku)
4. **Est. token cost**: 각 task의 예상 토큰 비용

PM님, 이것을 실행과제 plan에 어떻게 통합할 수 있습니까?

---

**[PM]**:

Auditor님의 지적이 정확합니다. A-02 (3-tier 전략 시각화)는 제가 실행과제를 수행할 때 가장 먼저 사용자에게 보여줘야 할 정보입니다.

제안하는 **실행과제 Plan 템플릿**:

```markdown
## 실행과제 Plan: [과제 제목]

### Task Overview
| # | Task | Owner | Tier | Model | Est. Cost |
|---|------|-------|------|-------|-----------|
| 1 | [Task 1] | architect | High | opus | ~2,000 tokens |
| 2 | [Task 2] | automation-engineer | Low | haiku | ~500 tokens |
| 3 | [Task 3] | auditor | Medium | sonnet | ~1,000 tokens |

### Tier Assignment Rationale
- **High-tier**: 복잡한 설계/분석이 필요한 task → opus
- **Medium-tier**: 리뷰/검증이 필요한 task → sonnet
- **Low-tier**: 단순 변환/보일러플레이트 생성 → haiku

### Execution Flow
1. Task 1 (High) → 결과를 Task 2에 전달
2. Task 2 (Low) → 결과를 Task 3에 전달
3. Task 3 (Medium) → 최종 종합

### Total Est. Token Cost: ~3,500 tokens

### User Confirmation
이 plan으로 진행하시겠습니까? (Y/n)
```

이 plan은 **실행과제 수행 전**에 사용자에게 보여주어야 합니다. 사용자가 확인(Y)하면 실제 `TaskCreate`로 생성합니다.

---

### **Round 2**

**[Architect]**:

Round 1의 제안들을 종합해 보면, 이것은 **한 번의 구조 재설계 프로젝트**입니다. A-06의 doc 폴더 이전은 다른 모든 아이템의 전제 조건입니다.

제안하는 **실행 순서**:
1. **Phase 1**: `doc/` 폴더 구조 생성 및 문서 이전 (A-06)
2. **Phase 2**: variant별 phase 정의 분리 및 core phases 정의 (A-01)
3. **Phase 3**: lifecycle 기록 시스템 구현 (A-03)
4. **Phase 4**: 스킬 수정 절차 및 검증 스크립트 구현 (A-04, A-05)
5. **Phase 5**: PM의 3-tier 시각화 plan 통합 (A-02)
6. **Phase 6**: 완료된 문서 자동 정리 (A-07)

이 프로젝트는 **Medium-tier (sonnet)** 작업입니다. 단순한 파일 이전이 아니라, 거버넌스 구조를 바꾸는 설계 작업이기 때문입니다. PM님, 이 순서에 동의하십니까?

---

**[Auditor]**:

Architect님의 순서에 동의합니다만, **각 phase별 acceptance criteria**를 명확히 해야 합니다.

**Phase 1 (doc 폴더 이전)** acceptance criteria:
- [x] `doc/lifecycle/`, `doc/variant/`, `doc/governance/` 폴더 생성
- [x] workspace root의 lifecycle 관련 md 파일 모두 이전
- [x] `scripts/validate-doc-folder.sh`가 pre-commit hook에서 실행됨
- [x] 모든 variant template이 `doc/variant/` 구조를 반영함

**Phase 3 (lifecycle 기록)** acceptance criteria:
- [x] `doc/lifecycle/agents/`에 모든 에이전트의 phase history 기록됨
- [x] `doc/lifecycle/skills/`에 모든 스킬의 phase history 기록됨
- [x] 각 파일에 Acceptance Criteria 섹션 포함됨
- [x] Auditor가 phase 승격을 승인하는 절차 마련됨

이 acceptance criteria는 **A-03 (lifecycle 문서화)**의 핵심입니다. Lifecycle-manager님, 이것을 doc/lifecycle/ 문서 구조에 어떻게 반영할 수 있습니까?

---

**[Lifecycle-manager]**:

Auditor님의 acceptance criteria는 doc/lifecycle/ 문서 구조의 템플릿이 될 수 있습니다.

제안하는 **`doc/lifecycle/README.md`**:
```markdown
# Lifecycle Documentation

## Purpose
에이전트와 스킬의 생애주기를 기록하고 거버넌스합니다.

## File Structure
```
doc/lifecycle/
├── README.md (이 파일)
├── agents/
│   └── [agent-name].md
├── skills/
│   └── [skill-name].md
└── templates/
    └── [template-name].md
```

## Required Sections

Each [agent/skill/template].md file MUST include:

### 1. Creation Date
- **Format**: `Created: [YYYY-MM-DD]`
- **Purpose**: 언제 만들어졌는지 기록

### 2. Phase History
- **Format**:
  ```markdown
  ## Phase History
  - [YYYY-MM-DD] [from-phase] → [to-phase] - [reason] - [approver]
  ```
- **Purpose**: phase 변경 이력 추적

### 3. Acceptance Criteria
- **Format**:
  ```markdown
  ## Acceptance Criteria ([phase-name] Phase)
  - [x] [criterion-1]
  - [x] [criterion-2]
  ```
- **Purpose**: 각 phase별 만족 기준 정의

### 4. Dependencies (Optional)
- **Format**:
  ```markdown
  ## Dependencies
  - [dependency-1]
  - [dependency-2]
  ```
- **Purpose**: 다른 에이전트/스킬과의 의존성 명시

## Phase Transition Rules

1. **Design → Review**: Architect/DQM 담당자가 승인
2. **Review → Production**: Auditor가 acceptance criteria 검증 후 승인
3. **Production → Design** (rollback): 수정 필요 시, Lifecycle-manager가 rollback

## Validation

- `scripts/validate-skills.sh`와 `scripts/validate-agents.sh`가 필수 섹션을 검증
- Pre-commit hook에서 실행
- 누락된 섹션이 있으면 commit 방지
```

이 README는 A-03의 핵심 거버넌스 문서입니다. Docs-writer님, 이것을 `doc/lifecycle/README.md`로 저장하고, 각 에이전트/스킬의 문서를 이 템플릿에 맞춰야 합니다. 어떻게 생각하십니까?

---

**[Docs-writer]**:

Lifecycle-manager님의 README 템플릿은 완벽합니다. 이것은 A-03의 표준이 될 것입니다.

**Phase 1 (doc 폴더 이전)**에서 이 README를 먼저 생성하고, 그 다음 각 에이전트/스킬의 문서를 작성하겠습니다. 구체적인 **작업 순서**:

1. **`doc/` 폴더 구조 생성**:
   ```bash
   mkdir -p doc/lifecycle/agents doc/lifecycle/skills doc/lifecycle/templates
   mkdir -p doc/variant doc/governance
   ```

2. **`doc/lifecycle/README.md` 생성** (Lifecycle-manager의 템플릿 사용)

3. **각 에이전트/스킬의 lifecycle 문서 작성**:
   - 예: `doc/lifecycle/agents/pm.md`
   - 예: `doc/lifecycle/skills/skill-lifecycle-manager.md`

4. **variant별 phase 정의 이전**:
   - `templates/co-design/phases.md` → `doc/variant/co-design/phases.md`
   - `templates/co-work/phases.md` → `doc/variant/co-work/phases.md`
   - `templates/co-pair/phases.md` → `doc/variant/co-pair/phases.md`

5. **workspace root의 core phases 정의**: `CONSTITUTION.md`에 있는 core phases만 유지

Automation-engineer님, 이제 A-05 (스크립트 고도화)와 A-07 (완료된 문서 정리)를 구현할 차례입니다. 제안하신 스크립트들을 실제로 작성할 수 있습니까?

---

**[Automation-engineer]**:

네, 물론입니다. Docs-writer님이 제안한 폴더 구조에 맞춰서 스크립트를 작성하겠습니다.

**`scripts/validate-skills.sh`**:
```bash
#!/bin/bash
# Validate all skill/*.md files have required sections

REQUIRED_SECTIONS=("## Phase History" "## Acceptance Criteria")
ERRORS=0
WARNINGS=0

for skill in skills/*.md; do
  if [ "$skill" == "skills/README.md" ]; then
    continue
  fi

  missing_sections=()
  for section in "${REQUIRED_SECTIONS[@]}"; do
    if ! grep -q "$section" "$skill"; then
      missing_sections+=("$section")
    fi
  done

  if [ ${#missing_sections[@]} -gt 0 ]; then
    echo "❌ $skill: Missing sections: ${missing_sections[*]}"
    ((ERRORS++))
  else
    echo "✅ $skill: All required sections present"
  fi
done

if [ $ERRORS -gt 0 ]; then
  echo "❌ Validation failed with $ERRORS error(s)"
  exit 1
else
  echo "✅ All skills validated successfully"
  exit 0
fi
```

**`scripts/validate-agents.sh`** (동일한 구조):
```bash
#!/bin/bash
# Validate all agents/*.md files have required sections

# 동일한 로직, agents/ 폴더에 적용
```

**`scripts/validate-doc-folder.sh`**:
```bash
#!/bin/bash
# Validate workspace root does not contain lifecycle-related md files

VIOLATIONS=()

# workspace root에 다음 파일들이 있으면 안 됨
for file in lifecycle-*.md phase-*.md; do
  if [ -f "$file" ]; then
    VIOLATIONS+=("$file")
  fi
done

if [ ${#VIOLATIONS[@]} -gt 0 ]; then
  echo "⚠️  Warning: The following files should be in doc/lifecycle/: ${VIOLATIONS[*]}"
  exit 0  # 경고는 commit을 막지 않음
else
  echo "✅ No lifecycle files in root (correct)"
  exit 0
fi
```

**`scripts/cleanup-completed-md.sh`**:
```bash
#!/bin/bash
# Move completed task plans from memory/ to memory/completed/

COMPLETED_MARKER="## Task Status: Completed"

for file in memory/*.md; do
  if grep -q "$COMPLETED_MARKER" "$file"; then
    mkdir -p memory/completed
    mv "$file" memory/completed/
    echo "✅ Moved completed file: $file"
  fi
done
```

이 스크립트들을 `.git/hooks/pre-commit`에 추가하면, A-05와 A-07이 자동화됩니다. Auditor님, 마지막으로 A-02 (3-tier 시각화)를 PM의 실행과제 plan에 어떻게 통합할 수 있을까요?

---

**[Auditor]**:

Automation-engineer님의 스크립트는 완벽합니다. 이제 A-02 (3-tier 시각화)를 PM의 실행과제 plan에 통합하는 방법을 제안하겠습니다.

PM이 실행과제를 생성할 때, 다음 **3-tier plan 템플릿**을 사용해야 합니다:

```markdown
## 실행과제 Plan: [과제 제목]

### Task Overview
| # | Task | Owner | Tier | Model | Est. Cost |
|---|------|-------|------|-------|-----------|
| 1 | [Task 1 제목] | [agent-1] | High | opus | ~2,000 tokens |
| 2 | [Task 2 제목] | [agent-2] | Low | haiku | ~500 tokens |
| 3 | [Task 3 제목] | [agent-3] | Medium | sonnet | ~1,000 tokens |

### Tier Assignment Rationale
- **High-tier (opus)**: 복잡한 설계/분석/PM 오케스트레이션 → Task 1
- **Medium-tier (sonnet)**: 리뷰/검증/QA → Task 3
- **Low-tier (haiku)**: 단순 변환/보일러플레이트 생성 → Task 2

### Execution Flow
1. Task 1 (High-tier) → 결과를 Task 2에 전달
2. Task 2 (Low-tier) → 결과를 Task 3에 전달
3. Task 3 (Medium-tier) → 최종 종합 및 리뷰

### Total Est. Token Cost: ~3,500 tokens

### User Confirmation Required
이 plan으로 진행하시겠습니까? (Y/n)

[사용자 입력 대기 중...]
```

이 템플릿은 **PM의 실행과제 생성 시 무조건 표시**되어야 합니다. 사용자가 확인(Y)하면 실제 `TaskCreate`로 생성합니다.

또한, **각 task의 acceptance criteria**도 이 plan에 포함되어야 합니다:
```markdown
### Acceptance Criteria per Task

| # | Task | Acceptance Criteria |
|---|------|---------------------|
| 1 | Task 1 | [AC-1.1], [AC-1.2], [AC-1.3] |
| 2 | Task 2 | [AC-2.1], [AC-2.2] |
| 3 | Task 3 | [AC-3.1], [AC-3.2], [AC-3.3] |
```

PM님, 이것을 실행과제 생성 workflow에 어떻게 통합할 수 있습니까?

---

**[PM]**:

Auditor님의 제안을 제 실행과제 생성 workflow에 통합하겠습니다.

**실행과제 Plan 생성 workflow**:

1. **사용자가 실행과제를 요청**하면, PM은 즉시 다음을 수행:
   ```bash
   # PM 내부 로직
   1. 실행과제를 N개의 atomic tasks로 분해
   2. 각 task를 High/Medium/Low tier로 할당
   3. 각 tier에 적절한 모델 선택 (opus/sonnet/haiku)
   4. 각 task의 예상 토큰 비용 추정
   5. Auditor의 3-tier plan 템플릿에 맞춰 plan 표시
   ```

2. **plan을 사용자에게 표시**하고, 다음을 확인:
   ```
   이 plan으로 진행하시겠습니까? (Y/n)
   ```

3. **사용자가 Y를 입력**하면:
   ```bash
   # 실제 task 생성
   TaskCreate(title="Task 1", description="...", tier="High", model="opus")
   TaskCreate(title="Task 2", description="...", tier="Low", model="haiku")
   TaskCreate(title="Task 3", description="...", tier="Medium", model="sonnet")
   ```

4. **사용자가 n을 입력**하면:
   ```bash
   # plan 재조정 또는 중단
   ```

이 workflow는 **제가 실행과제를 수행할 때 무조건 거쳐야 할 단계**입니다. Architect님, 이제 모든 제안을 종합하고 최종 action item을 도출할 준비가 되었습니다.

---

## Synthesis

**[Auditor]**: (Synthesis)

Round 1과 Round 2의 논의를 종합하면, 다음 **Points of Agreement**와 **Action Items**를 도출할 수 있습니다.

---

### Points of Agreement

1. **구조 재설계 필요성**: 현재 시스템의 7가지 개선 과제는 상호 연결되어 있으며, 한 번의 구조 재설계 프로젝트로 해결해야 함
2. **doc/ 폴더 구조**: `doc/lifecycle/`, `doc/variant/`, `doc/governance/`로 분류하여 문서 관리
3. **variant별 workflow 분리**: 각 variant 전용 phase 정의와 workspace root에는 core phases만 유지
4. **lifecycle 문서화**: 각 에이전트/스킬의 phase history와 acceptance criteria 기록
5. **스크립트 고도화**: validation 및 cleanup 스크립트로 자동화
6. **3-tier 시각화**: PM의 실행과제 plan에 task별 tier/model/cost 표시
7. **pre-commit hook 통합**: 모든 validation 스크립트를 git hook에서 실행

---

### Action Items

| # | Owner | Deliverable | Phase |
|---|-------|-------------|-------|
| A-01 | Architect, Docs-writer | `doc/` 폴더 구조 생성 및 lifecycle 문서 이전 | Phase 1 |
| A-02 | Architect | variant별 phase 정의 분리 및 core phases 정의 | Phase 2 |
| A-03 | Lifecycle-manager, Docs-writer | `doc/lifecycle/README.md` 생성 및 각 에이전트/스킬 lifecycle 문서 작성 | Phase 3 |
| A-04 | Auditor | 스킬 수정 절차 정의 및 PR 템플릿에 반영 | Phase 4 |
| A-05 | Automation-engineer | `validate-skills.sh`, `validate-agents.sh`, `validate-doc-folder.sh` 구현 | Phase 4 |
| A-06 | PM | 실행과제 3-tier plan 템플릿을 workflow에 통합 | Phase 5 |
| A-07 | Automation-engineer | `cleanup-completed-md.sh` 구현 및 pre-commit hook에 추가 | Phase 6 |

---

### Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-01 | `doc/lifecycle/` 폴더가 존재하고 모든 에이전트/스킬의 lifecycle 문서가 있음 | `ls doc/lifecycle/agents/ && ls doc/lifecycle/skills/` |
| AC-02 | 각 lifecycle 문서에 Phase History와 Acceptance Criteria 섹션이 있음 | `grep "## Phase History" doc/lifecycle/*/*.md` |
| AC-03 | `validate-skills.sh`와 `validate-agents.sh`가 pre-commit hook에서 실행됨 | `cat .git/hooks/pre-commit \| grep validate` |
| AC-04 | PM의 실행과제 plan에 task별 tier/model/cost 표가 있음 | PM이 실행과제 생성 시 plan 표시 확인 |
| AC-05 | `doc/variant/`에 각 variant의 phase 정의가 있음 | `ls doc/variant/*/phases.md` |
| AC-06 | workspace root에 lifecycle 관련 md 파일이 없음 | `ls *.md \| grep -v "^\(CHANGELOG\|CLAUDE\|CONSTITUTION\|README\).md$"` |

---

### Open Disagreements or Unresolved Questions

없음. 모든 참여자가 제안된 구조 재설계 프로젝트에 동의함.

---

## Execution Phases

### Phase 1: doc/ 폴더 구조 생성 및 문서 이전 (A-06)
**Owner**: Architect, Docs-writer
**Acceptance Criteria**: AC-01, AC-06

### Phase 2: variant별 phase 정의 분리 (A-01)
**Owner**: Architect
**Acceptance Criteria**: AC-05

### Phase 3: lifecycle 기록 시스템 구현 (A-03)
**Owner**: Lifecycle-manager, Docs-writer
**Acceptance Criteria**: AC-02

### Phase 4: 스킬 수정 절차 및 검증 스크립트 (A-04, A-05)
**Owner**: Auditor, Automation-engineer
**Acceptance Criteria**: AC-03

### Phase 5: PM의 3-tier 시각화 plan 통합 (A-02)
**Owner**: PM
**Acceptance Criteria**: AC-04

### Phase 6: 완료된 문서 자동 정리 (A-07)
**Owner**: Automation-engineer
**Acceptance Criteria**: AC-03 (pre-commit hook 통합)

---

## Post-Meeting Notes

- 이 프로젝트는 **Medium-tier (sonnet)** 작업으로 분류됨
- 각 phase는 순차적으로 실행되어야 함 (Phase 1 → Phase 2 → ... → Phase 6)
- 각 phase 완료 후 Auditor가 acceptance criteria를 검증해야 함
- 모든 phase 완료 후 전체 시스템에 대한 integration test 필요
