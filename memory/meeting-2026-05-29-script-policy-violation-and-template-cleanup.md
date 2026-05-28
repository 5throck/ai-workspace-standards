# Meeting Transcript

**Date**: 2026-05-29
**Topic**: 스크립트 정책 위반 원인 분석 및 templates/common/ 폴더 구조 개선방안 도출
**Participants**: pm, architect, auditor, automation-engineer
**Rounds**: 2
**Language**: Korean
**Status**: Complete

---

## Transcript

### Round 1

**[PM]**:

팀원 여러분, 오늘 회의는 두 가지 중요한 문제를 다룹니다. 첫째, 최근 작업에서 생성된 `validate-agents.sh`, `validate-doc-folder.sh`, `validate-skills.sh`가 Shell script로 작성되었습니다. 이것은 명백한 정책 위반입니다. SCRIPTS.md에 따르면, OS 관련 없는 유효성 검증 스크립트는 Tier 2로 분류되어 TypeScript (.ts)로 작성되어야 합니다. 둘째, `templates/common/` 폴더 내에 정리가 필요한 파일들이 있다는 보고를 받았습니다. workspace root와 마찬가지로 docs 폴더로 이전할 사항들을 점검해야 합니다.

Architect, 먼저 이 스크립트 정책 위반이 왜 발생했는지 시스템 레벨에서 분석해 주실 수 있나요?

---

**[Architect]**:

PM의 지적대로, 이것은 명백한 정책 위반입니다. SCRIPTS.md의 Tier 정책을 보면:

**Tier 1** (Bootstrap & Native Scripts): 초기 프로젝트 설정, 부트스트래핑, 외부 런타임이 없는 상황 → `.sh` + `.ps1` 쌍
**Tier 2** (Ops & Automation Scripts): 일상적인 파이프라인 작업, 코드 생성, linting, syncing, lifecycle audits → TypeScript (`.ts`) + Bun runtime

문제의 세 스크립트(`validate-agents.sh`, `validate-doc-folder.sh`, `validate-skills.sh`)는 모두 **유효성 검증 로직**입니다. 이것들은:
- OS 특정 기능 사용 안 함
- Git 파일 시스템 작업만 수행
- 순수 파일 파싱 및 YAML/Markdown 검증

이것들은 Tier 2로 분명히 분류되어야 합니다. `.ts`로 작성되고 `package.json`에 등록되어 `bun run validate-agents` 형태로 실행되어야 합니다.

근본 원인은 **PM의 QA 프로세스 부재**입니다. 이전 회의에서 도출된 13개 작업 항목(A-01~A-07, D-01~D-07)이 실행될 때, PM이 Auditor를 통해 SCRIPTS.md 정책 준수를 검증하지 않았습니다. Auditor, 이 작업이 QA 게이트를 통과하지 못한 이유는 무엇인가요?

---

**[Auditor]**:

Architect의 지적은 정확합니다. 제 책임입니다. 제가 이전 작업을 QA할 때 다음을 검증했습니다:
- Runtime vs Governance 분리 준수
- docs/ 폴더 구조 정비
- .gitignore 패턴 업데이트
- CHANGELOG.md 및 memory 로그 업데이트

하지만 **SCRIPTS.md Tier 정책 준수 검증을 누락했습니다**. `qa-gate.sh` 실행 전에 `scripts/SCRIPTS.md`를 확인하여 신규 스크립트가 올바른 Tier로 작성되었는지 검증했어야 했습니다.

제 QA 프로세스의 결함:
1. 문서 구조 변경에는 집중했으나, **스크립트 생성 자체에 대한 정책 검증을 빼먹음**
2. `audit.sh`가 UTF-8, .gitignore, README pairing만 체크하지만, **SCRIPTS.md Tier 준수는 체크하지 않음**
3. 신규 .sh 파일 생성 시 "이게 Tier 1 부트스트래핑용인가 Tier 2 automation용인가?" 질문을 하지 않음

Automation-engineer, 세 스크립트를 확인해 보니 모두 OS 관련 로직이 없습니다. 이것이 TypeScript로 재작성되어야 한다는 점에 동의하시나요?

---

**[Automation-engineer]**:

Auditor, 완전히 동의합니다. 세 스크립트를 분석해 보니:

**`validate-agents.sh`** (3484 bytes):
- awk로 YAML frontmatter 파싱
- grep으로 파일 체크
- 순수 Git 파일 시스템 작업
- OS 특정 기능 없음 → **Tier 2, .ts로 재작성 필요**

**`validate-doc-folder.sh`** (1651 bytes):
- docs/ 폴더 구조 체크
- 순수 디렉토리 존재 여부 확인
- OS 특정 기능 없음 → **Tier 2, .ts로 재작성 필요**

**`validate-skills.sh`** (2341 bytes):
- SKILL.md frontmatter 체크
- YAML 필드 검증
- OS 특정 기능 없음 → **Tier 2, .ts로 재작성 필요**

PM, 제가 Phase 4 Implementation으로서 이것을 TypeScript로 재작성할 준비가 되어 있습니다. 하지만 먼저 두 번째 의제인 `templates/common/` 폴더 구조 개선방안도 논의해야 한다고 생각합니다. Architect, `templates/common/` 내의 어떤 파일들이 docs/로 이전 필요한가요?

---

### Round 2

**[Architect]**:

좋은 지적입니다, Automation-engineer. `templates/common/`를 분석해 보니 다음 파일들이 docs/로 이전 필요합니다:

**`templates/common/` 내의 혼합된 콘텐츠:**

1. **거버넌스 문서** → `templates/common/docs/governance/` 또는 `docs/governance/` 이전:
   - `templates/common/docs/` → 이미 docs 폴더 존재
   - 하지만 `templates/common/` 레벨의 문서들을 재정비 필요

2. **GitHub 설정 파일** → `templates/common/.github/` 유지 (이건 올바른 위치)

3. **Git hooks** → `templates/common/.githooks/` 유지 (이건 올바른 위치)

4. **환경 설정 샘플** → `templates/common/.env.sample`, `.gitattributes`, `.gitleaks.toml` 유지 (이건 올바른 위치)

5. **platform config files** → `templates/common/CLAUDE.md`, `GEMINI.md` 유지 (이건 올바른 위치)

문제는 **`templates/common/docs/` 내의 구조**입니다. workspace root의 `docs/governance/`와 유사하게 `templates/common/` 내의 거버넌스 문서들을 정리해야 합니다.

PM, `templates/common/` 내에서 어떤 것을 L1 template으로 유지하고, 어떤 것을 workspace root의 `docs/`로 통합할지 결정이 필요합니다. L0(workspace root)과 L1(template)의 관계를 명확히 해야 합니다.

---

**[PM]**:

Architect의 분석이 명확합니다. L0/L1 관계를 재정립하면:

**L0 (Workspace Root - SSOT):**
- `docs/governance/` → 거버넌스 정책의 단일 출처
- `docs/lifecycle/` → 에이전트/스킬 lifecycle 관리
- `scripts/` → workspace root 전용 스크립트

**L1 (Template Snapshot):**
- `templates/common/` → L0에서 publish-to-template.sh로 퍼블리시된 스냅샷
- `templates/common/docs/` → 템플릿 사용자를 위한 문서
- `templates/common/.github/`, `.githooks/` → 템플릿 프로젝트용 설정

제안하는 개선방안:

**E-01 (스크립트 정책 위반 수정):**
- `validate-agents.sh` → `validate-agents.ts` (Tier 2, package.json 등록)
- `validate-doc-folder.sh` → `validate-doc-folder.ts` (Tier 2, package.json 등록)
- `validate-skills.sh` → `validate-skills.ts` (Tier 2, package.json 등록)
- 세 .sh 파일 삭제
- SCRIPTS.md 레지스트리 업데이트

**E-02 (templates/common/ 구조 정비):**
- `templates/common/docs/` 내용 검토 및 필요시 `docs/` 통합
- L1 문서는 "새 프로젝트 생성 시 템플릿 사용자에게 제공되는 문서"로만 한정
- 거버넌스 정책 문서는 L0 `docs/governance/`에만 존재

Auditor, 이 두 가지 개선방안에 대한 우선순위와 실행 가능성을 평가해 주실 수 있나요?

---

**[Auditor]**:

PM, 두 개선방안 모두 실행 가능하지만 **E-01이 긴급**합니다.

**우선순위:**
1. **E-01 (스크립트 정책 위반 수정)** → 긴급, 즉시 실행 필요
   - 현재 상태: 정책 위반 상태로 운영 중
   - 위반도: SCRIPTS.md Tier 2 정책 위반
   - 영향: 다른 작업에서도 같은 실수 반복 위험

2. **E-02 (templates/common/ 구조 정비)** → 중장기 과제
   - 현재 상태: 구조적 혼란存在하지만 치명적 아님
   - 복잡도: L0/L1 관계 재정립 필요
   - 영향: 템플릿 퍼블리싱 프로세스에 영향

**E-01 실행 계획:**
- Phase 4: Automation-engineer가 세 .ts 파일 구현
- Phase 5: 제가 SCRIPTS.md 레지스트리 업데이트 및 qa-gate 통과 검증
- Phase 6: PM이 메모로그 및 CHANGELOG 업데이트

**E-02 실행 계획:**
- 별도 회의 필요: templates/common/ 내의 파일들을 하나씩 검토
- Architect가 L0/L1 관계를 명확히 정의한 ADR 작성 필요
- 그 후 Phase-by-phase 실행

Automation-engineer, E-01 즉시 시작 가능한가요?

---

**[Automation-engineer]**:

Auditor, 즉시 시작 가능합니다.

**E-01 실행 준비:**

1. **`validate-agents.ts`**:
   - agents/*.md YAML frontmatter 파싱
   - docs/lifecycle/agents/*.md 섹션 체크
   - TypeScript + Node.js fs 모듈로 구현
   - package.json에 `"validate-agents": "bun run scripts/validate-agents.ts"` 등록

2. **`validate-doc-folder.ts`**:
   - docs/ 폴더 구조 체크
   - TypeScript + fs 모듈로 구현
   - package.json 등록

3. **`validate-skills.ts`**:
   - skills/*/SKILL.md frontmatter 체크
   - YAML 필드 검증
   - TypeScript + js-yaml 라이브러리로 구현
   - package.json 등록

4. **기존 .sh 파일 삭제**:
   - `validate-agents.sh`
   - `validate-doc-folder.sh`
   - `validate-skills.sh`

5. **SCRIPTS.md 레지스트리 업데이트**:
   - 세 .sh 항목 삭제
   - 세 .ts 항목 추가 (status: active, source: L0)

PM, 승인되면 즉시 Phase 4 시작합니다. E-02는 별도 회의 후 진행하는 것을 제안합니다.

---

**[PM]**:

논의를 종합하고, Auditor가 최종 종합을 진행합니다.

---

**[Auditor]**: (Synthesis)

## 논의 종합

### 합의된 사항

**1. 정책 위반 원인 분석:**
- **근본 원인**: PM의 QA 프로세스 부재 + Auditor의 SCRIPTS.md Tier 정책 검증 누락
- **위반 내용**: `validate-agents.sh`, `validate-doc-folder.sh`, `validate-skills.sh`가 OS 관련 없는 유효성 검증임에도 불구하고 Tier 1(.sh)로 작성됨
- **올바른 분류**: Tier 2(TypeScript .ts) → `package.json` 등록 후 `bun run` 형태로 실행

**2. templates/common/ 구조 개선 필요성:**
- **혼재된 콘텐츠**: `templates/common/docs/` 내에 workspace root의 `docs/`와 유사한 거버넌스 문서가 섞여 있음
- **L0/L1 관계 모호**: workspace root(SSOT)와 template snapshot 간의 경계 불명확
- **정비 필요**: L1은 "템플릿 사용자를 위한 문서"로만 한정, 거버넌스 정책은 L0에만 존재

### 개발된 의견

**없음** - 모든 참여자가 원인 분석과 개선방향에 동의함

### 구체적 다음 단계 (Action Items)

| # | Owner | Deliverable | Phase |
|---|-------|-------------|-------|
| **E-01** | automation-engineer | `validate-agents.ts`, `validate-doc-folder.ts`, `validate-skills.ts` 구현 | Phase 4 |
| **E-02** | automation-engineer | 기존 .sh 파일 3개 삭제 | Phase 4 |
| **E-03** | auditor | SCRIPTS.md 레지스트리 업데이트 (.sh 삭제, .ts 추가) + qa-gate 통과 검증 | Phase 5 |
| **E-04** | pm | 메모로그 + CHANGELOG 업데이트 + PR 생성 | Phase 6 |
| **E-05** | architect | templates/common/ 구조 정비를 위한 별도 ADR 작성 (L0/L1 관계 명확화) | Phase 2 |

---

## Action Items

| # | Owner | Deliverable | Phase |
|---|-------|-------------|-------|
| E-01 | automation-engineer | `validate-agents.ts`, `validate-doc-folder.ts`, `validate-skills.ts` 구현 | Phase 4 |
| E-02 | automation-engineer | 기존 .sh 파일 3개 삭제 | Phase 4 |
| E-03 | auditor | SCRIPTS.md 레지스트리 업데이트 + qa-gate 통과 검증 | Phase 5 |
| E-04 | pm | 메모로그 + CHANGELOG 업데이트 + PR 생성 | Phase 6 |
| E-05 | architect | templates/common/ 구조 정비 ADR 작성 | Phase 2 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| E-01 | 세 .ts 파일이 OS 관련 없는 로직을 TypeScript로 올바르게 구현 | Auditor가 코드 리뷰 및 qa-gate 통과 확인 |
| E-02 | 기존 .sh 파일 3개가 완전히 삭제되고 Git에서 추적되지 않음 | `git status`에 삭제된 파일로 표시됨 |
| E-03 | SCRIPTS.md 레지스트리에 세 .ts 항목이 추가되고 세 .sh 항목이 삭제됨 | Auditor가 verify-scripts.ts --verify 실행 |
| E-04 | CHANGELOG.md에 E-01~E-03 변경사항이 기록되고 memory/YYYY-MM-DD.md에 회의 요약이 추가됨 | PM이 문서 업데이트 확인 |
| E-05 | Architect가 L0/L1 관계를 명확히 정의한 ADR을 작성하고 PM 승인을 받음 | ADR 문서가 docs/adr/에 생성됨 |
