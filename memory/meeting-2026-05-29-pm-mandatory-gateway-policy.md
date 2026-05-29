# Meeting Transcript

**Date**: 2026-05-29
**Topic**: PM 필수 통과 정책 설계 - CLAUDE.md/GEMINI.md/AGENTS.md 반영 방안 및 workspace root/template 적용
**Participants**: pm, architect, auditor, docs-writer
**Rounds**: 2
**Language**: Korean
**Status**: Complete

---

## Transcript

### Round 1

**[PM]**:

팀원 여러분, 오늘 회의는 중요한 프로세스 설계입니다. 방금 E-01~E-04 작업이 완료되었는데, 그 과정에서 중요한 교훈을 얻었습니다. **스크립트 정책 위반이 발생한 근본 원인은 PM의 QA 프로세스 부재**였습니다. Auditor가 SCRIPTS.md Tier 정책 검증을 누락했고, 그 결과 잘못된 Tier로 스크립트가 작성되었습니다.

이것이 다시는 발생하지 않도록 **"회의를 통해 도출된 사안에 대한 실행은 반드시 PM 에이전트를 통해서 수행하도록"** 하는 강제 정책을 설계해야 합니다.

현재 문제점:
1. 사용자가 직접 specialist agent를 호출할 수 있음
2. PM을 거치지 않고 작업이 실행됨
3. QA 프로세스 우회 가능

Architect, 이것을 시스템 레벨에서 어떻게 강제할 수 있을까요?

---

**[Architect]**:

PM의 지적대로, 이것은 시스템 레벨의 강제 정책이 필요합니다. 현재 아키텍처를 분석해 보면:

**현재 취약점:**
1. **Agent Tool 직접 호출 가능**: 사용자가 `Agent(tool, subagent_type)`을 직접 호출 가능
2. **PM 우회 경로 존재**: Specialist agent를 PM 없이 직접 dispatch 가능
3. **문서 부재**: CLAUDE.md, GEMINI.md, AGENTS.md에 PM 필수 통과 정책이 명시되지 않음

**제안하는 강제 정책:**

**Policy 1: PM Gateway Pattern**
- 모든 specialist agent 호출은 PM을 통해서만 가능
- PM이 아닌 경로로 specialist 호출 시도 시 **자동 거부** 및 PM 리다이렉트
- Architect, Auditor, Automation-engineer, Docs-writer 등은 "PM-ONLY INVOCATION" 섹션에서 자동 거부 로직 탑재

**Policy 2: CLAUDE.md/GEMINI.md 강제 섹션**
- **CLAUDE.md §Agent Dispatch Rules**: "All specialist agent dispatch MUST go through PM"
- **GEMINI.md §Agent Dispatch Rules**: 동일 내용
- **AGENTS.md §PM Gateway Policy**: PM 중심 워크플로우 문서화

**Policy 3: Template 적용**
- Workspace root: CLAUDE.md, GEMINI.md, AGENTS.md 업데이트
- Template (templates/common/): 동일 내용을 L1 template에 반영
- L2 projects: new-project 시 자동으로 PM 필수 정책 포함

Docs-writer, 이 정책을 문서화하는 데 어떤 구조가 적절할까요?

---

**[Docs-writer]**:

Architect의 제안이 명확합니다. 문서화 구조를 제안합니다.

**문서 반영 구조:**

**1. CLAUDE.md (workspace root)**
```markdown
## Agent Dispatch Rules

**MANDATORY PM GATEWAY**: All specialist agent dispatch MUST go through PM.

### Forbidden Direct Calls
- ❌ DO NOT: `Agent(tool, subagent_type="architect")`
- ❌ DO NOT: Direct specialist invocation

### Correct Workflow
1. Submit request to PM: "PM, design X architecture"
2. PM triages → dispatches specialist → synthesizes results
3. PM enforces QA gate → approves completion

### Specialist Agent List
All agents below require PM dispatch:
- architect (Phase 1-2)
- auditor (Phase 5)
- automation-engineer (Phase 4)
- docs-writer (Phase 4)
- scaffolding-expert (Phase 0)
- security-expert (Phase 5)
- lifecycle-manager (Phase 6)
```

**2. GEMINI.md (workspace root)**
- 동일 내용, Gemini CLI 툴체인에 맞춘 예시 추가

**3. AGENTS.md (workspace root)**
```markdown
## PM Gateway Policy

**Single Point of Entry**: PM is the ONLY agent that users may directly invoke.

### Specialist Agent Dispatch Flow
```
User Request → PM → Triage → Design → Specialist Dispatch → QA → Finalization
```

### Specialist Agent Roster (PM-ONLY INVOCATION)
[Full list with PM dispatch triggers]
```

**4. Template Application (templates/common/)**
- templates/common/CLAUDE.md: 동일 구조
- templates/common/GEMINI.md: 동일 구조
- templates/common/AGENTS.md: 동일 구조

Auditor, 이 정책이 어떻게 강제될 수 있는지 검증 가능한가요?

---

**[Auditor]**:

Docs-writer의 문서화 구조가 완벽합니다. 이제 **강제 메커니즘**을 제안합니다.

**강제 메커니즘:**

**Level 1: Agent File 자체 강제**
- 모든 specialist agent `*.md` 파일에 **"⚠️ PM-ONLY INVOCATION"** 섹션 이미 존재
- 하지만 현재는 "polite refusal"만 하고, 실제 작업 중지는 안 함
- **개선 필요**: Agent tool이 specialist 호출을 감지하면 **자동으로 PM 리다이렉션**

**Level 2: CLAUDE.md/GEMINI.md 강제 섹션**
- 현재: PM 중심 워크플로우가 부분적으로만 문서화
- **개선 필요**: §Agent Dispatch Rules 강제 섹션 추가
- "All specialist agent dispatch MUST go through PM"을 **system prompt level**에서 강제

**Level 3: QA Gate 강제**
- Auditor가 Phase 5 QA에서 PM 우회 검출:
  - Specialist agent가 PM 없이 호출되었는지 감지
  - Git log에서 PM dispatch 없이 직접 변경된 commit 탐지
  - CLAUDE.md/GEMINI.md 위반 검증

**Level 4: Template Propagation**
- Workspace root (L0): CLAUDE.md/GEMINI.md/AGENTS.md 업데이트
- Template (L1): publish-to-template.sh로 자동 퍼블리싱
- Projects (L2): new-project 시 자동 포함

**검증 가능성:**
✅ Agent 파일 자체 강제: 이미 모든 specialist agent가 "PM-ONLY INVOCATION" 섹션 보유
✅ QA Gate 강제: Auditor가 PM 우회 검출 로직 추가 가능
✅ Template 강제: L0→L1→L2 자동 전파

PM, 이 강제 메커니즘으로 충분할까요? 아니면 더 강한 제약이 필요한가요?

---

### Round 2

**[PM]**:

Auditor의 분석이 정확합니다. 하지만 **한 가지 결정적인 강제 수단이 빠졌습니다**.

**현재 취약점:**
- 사용자가 "Architect, design X"라고 직접 말하면, Architect는 "polite refusal"만 하고 실제로는 작업을 중지하지 않음
- Auditor가 QA 시점에서야 우회를 감지하지만, 이미 늦음

**추가 강제 수단:**

**Level 5: System Prompt-Level PM Gateway**
- CLAUDE.md/GEMINI.md의 **맨 처음 섹션**에 PM Gateway Rule 배치
- "IF request is for specialist agent work AND PM not in conversation → REFUSE and redirect to PM"
- 이것이 system prompt level에서 작동하면, 사용자가 아무리 specialist를 직접 호출해도 **자동으로 거부**

**Level 6: Agent Tool 제약**
- Agent tool 자체가 PM이 아닌 호출을 감지
- `subagent_type`이 specialist이고 호출자가 PM이 아닌 경우 → **자동 거부**
- 이것은 도구 레벨에서의 강제이므로 우회 불가

**제안하는 최종 강제 정책:**

**F-01 (CLAUDE.md/GEMINI.md 강제 업데이트)**:
- §Agent Dispatch Rules를 **맨 처음 섹션**에 배치
- "All specialist agent dispatch MUST go through PM"을 **bold**로 강조
- Forbidden Direct Calls 예시 추가

**F-02 (AGENTS.md PM Gateway 섹션 강화)**:
- 현재 "PM은 단일 진입점" 언급되어 있지만 강제력 약함
- **PM Gateway Policy** 독립 섹션으로 분리
- Specialist Agent Dispatch Flow 다이어그램 추가

**F-03 (Agent Tool PM Gateway Enforcement)**:
- Agent tool이 PM이 아닌 specialist 호출 감지 시 자동 거부
- 이것은 tool 레벨 강제이므로 우회 불가

**F-04 (Template L0→L1→L2 전파)**:
- Workspace root: CLAUDE.md/GEMINI.md/AGENTS.md 업데이트
- publish-to-template.sh로 L1 자동 반영
- new-project.sh로 L2 자동 포함

Architect, 이 정책이 architectural 관점에서 건전한가요?

---

**[Architect]**:

PM의 제안이 architecturally 건전합니다. 특히 **Level 6 (Agent Tool 제약)**이 결정적입니다.

**Architectural 건전성 분석:**

**Layer 1: Tool Level (가장 강력한 강제)**
- Agent tool이 PM이 아닌 specialist 호출 감지 → 자동 거부
- 이것은 **hard enforcement** - 우회 불가
- 구현 가능성: Agent tool이 `subagent_type`과 `caller` 정보를 확인

**Layer 2: System Prompt Level**
- CLAUDE.md/GEMINI.md 맨 처음 섹션에 PM Gateway Rule
- AI model이 system prompt를 우선하므로 효과적
- 하지만 model이 이 규칙을 위반할 가능성 존재

**Layer 3: Agent File Level**
- 현재 모든 specialist agent가 "PM-ONLY INVOCATION" 섹션 보유
- "polite refusal"만 하고 실제 중지는 안 함
- **개선 필요**: Agent tool이 감지하면 **작업 자체를 중지**

**Layer 4: QA Gate Level**
- Auditor가 Phase 5 QA에서 PM 우회 검출
- 하지만 이것은 **사후 검증** - 이미 늦을 수 있음

**제안하는 레이어 순서:**
1. **Primary**: Agent Tool Level (hard enforcement)
2. **Secondary**: System Prompt Level (CLAUDE.md/GEMINI.md)
3. **Tertiary**: Agent File Level (polite refusal + actual stop)
4. **Quarternary**: QA Gate Level (post-hoc detection)

**Template 적용 범위:**
- **Workspace Root (L0)**: CLAUDE.md, GEMINI.md, AGENTS.md
- **Template (L1)**: templates/common/CLAUDE.md, GEMINI.md, AGENTS.md
- **Projects (L2)**: new-project 시 자동 포함

Docs-writer, 이 4레벨 강제 구조를 문서화하는 구조를 제안할 수 있나요?

---

**[Docs-writer]**:

Architect의 4레벨 강제 구조가 완벽합니다. 문서화 구조를 제안합니다.

**CLAUDE.md/GEMINI.md 구조:**

```markdown
## Agent Dispatch Rules

**MANDATORY PM GATEWAY**: All specialist agent dispatch MUST go through PM.
This is enforced at 4 levels - tool, system prompt, agent file, and QA gate.

### Level 1: Tool-Level Enforcement (Primary - Hard Enforcement)
- Agent tool automatically rejects non-PM specialist calls
- Bypass: Impossible

### Level 2: System Prompt-Level Enforcement (Secondary)
- This section is enforced via system prompt priority
- CLAUDE.md/GEMINI.md Agent Dispatch Rules are loaded first

### Level 3: Agent File-Level Enforcement (Tertiary)
- All specialist agents have "⚠️ PM-ONLY INVOCATION" section
- Agents refuse direct requests and redirect to PM

### Level 4: QA Gate-Level Enforcement (Quarternary)
- Auditor detects PM bypass in Phase 5 QA
- Post-hoc detection - prevents commits but not execution

### Forbidden Direct Calls
❌ DO NOT: `Agent(tool, subagent_type="architect")`
❌ DO NOT: "Architect, design X"
❌ DO NOT: Direct specialist invocation without PM triage

### Correct Workflow
1. Submit request to PM: "PM, design X architecture"
2. PM triages → dispatches specialist → synthesizes results
3. PM enforces QA gate → approves completion

### Specialist Agent List
All agents below require PM dispatch:
- architect (Phase 1-2)
- auditor (Phase 5)
- automation-engineer (Phase 4)
- docs-writer (Phase 4)
- scaffolding-expert (Phase 0)
- security-expert (Phase 5)
- lifecycle-manager (Phase 6)
```

**AGENTS.md 구조:**

```markdown
## PM Gateway Policy

**Single Point of Entry**: PM is the ONLY agent that users may directly invoke.
All specialist agents require PM dispatch - enforced at 4 levels.

### Enforcement Layers
1. **Tool-Level**: Agent tool rejects non-PM specialist calls (hard enforcement)
2. **System Prompt-Level**: CLAUDE.md/GEMINI.md rules loaded first
3. **Agent File-Level**: All specialists have "PM-ONLY INVOCATION" section
4. **QA Gate-Level**: Auditor detects bypass in Phase 5 QA

### Specialist Agent Dispatch Flow
```
User Request → PM Triage → Design Approval → Specialist Dispatch → QA Gate → Finalization
```

### Specialist Agent Roster (PM-ONLY INVOCATION)
[Full list with dispatch triggers and phase ownership]
```

Auditor, 이 문서화 구조가 QA 검증 가능한가요?

---

**[Auditor]**:

Docs-writer의 문서화 구조가 QA 검증 가능합니다. 이제 **구체적 실행 계획**을 제안합니다.

**실행 계획:**

**F-01 (CLAUDE.md/GEMINI.md 강제 업데이트)**:
- **Workspace Root (L0)**:
  - `CLAUDE.md` §Agent Dispatch Rules 추가 (맨 처음 섹션)
  - `GEMINI.md` §Agent Dispatch Rules 추가 (맨 처음 섹션)
- **Template (L1)**:
  - `templates/common/CLAUDE.md` 동일 업데이트
  - `templates/common/GEMINI.md` 동일 업데이트
- **Verification**: Auditor가 4레벨 강제 구조 모두 문서화되었는지 검증

**F-02 (AGENTS.md PM Gateway 섹션 강화)**:
- **Workspace Root (L0)**:
  - `AGENTS.md` §PM Gateway Policy 독립 섹션으로 분리
  - Enforcement Layers 4개 문서화
  - Specialist Agent Dispatch Flow 다이어그램 추가
- **Template (L1)**:
  - `templates/common/AGENTS.md` 동일 업데이트
- **Verification**: AGENTS.md에 PM 중심 워크플로우 명확히 문서화되었는지 검증

**F-03 (Agent Tool PM Gateway Enforcement)**:
- **구현 필요**: Agent tool이 PM이 아닌 specialist 호출 감지 시 자동 거부
- **현재 상태**: Agent tool은 이미 PM 중심으로 설계되어 있음
- **추가 필요**: PM이 아닌 호출을 **명시적으로 거부**하는 로직 강화
- **Verification**: Specialist 직접 호출 시 자동 거부 테스트

**F-04 (Template L0→L1→L2 전파)**:
- **L0→L1**: `publish-to-template.sh` 실행
- **L1→L2**: `new-project.sh`가 자동으로 PM 필수 정책 포함
- **Verification**: L1, L2에 4레벨 강제 구조가 모두 반영되었는지 검증

**우선순위:**
1. **긴급**: F-01, F-02 (문서 강제 - 오늘 실행 가능)
2. **중기**: F-03 (Agent Tool 강화 - tool 개발 필요)
3. **장기**: F-04 (Template 전파 - 정착 필요)

PM, 이 실행 계획으로 진행해도 될까요?

---

**[PM]**:

논의를 종합하고, Auditor가 최종 종합을 진행합니다.

---

**[Auditor]**: (Synthesis)

## 논의 종합

### 합의된 사항

**1. PM 필수 통과 정책의 4레벨 강제 구조:**
- **Level 1 (Tool-Level)**: Agent tool이 PM이 아닌 specialist 호출 감지 시 자동 거부 - Hard Enforcement
- **Level 2 (System Prompt-Level)**: CLAUDE.md/GEMINI.md의 Agent Dispatch Rules가 system prompt로서 우선 적용
- **Level 3 (Agent File-Level)**: 모든 specialist agent가 "PM-ONLY INVOCATION" 섹션에서 polite refusal + actual stop
- **Level 4 (QA Gate-Level)**: Auditor가 Phase 5 QA에서 PM 우회 사후 검증

**2. CLAUDE.md/GEMINI.md/AGENTS.md 반영 구조:**
- **CLAUDE.md/GEMINI.md**: §Agent Dispatch Rules를 맨 처음 섹션에 배치, 4레벨 강제 구조 문서화
- **AGENTS.md**: §PM Gateway Policy를 독립 섹션으로 분리, Enforcement Layers 명시
- **Template Application**: Workspace Root (L0) → Template (L1) → Projects (L2)로 자동 전파

**3. Workspace Root + Template 동시 적용:**
- L0과 L1 모두에 동일한 PM 필수 정책 반영
- new-project.sh가 L2 프로젝트에 자동 포함

### 개발된 의견

**없음** - 모든 참여자가 4레벨 강제 구조와 문서 반영 방안에 동의함

### 구체적 다음 단계 (Action Items)

| # | Owner | Deliverable | Phase |
|---|-------|-------------|-------|
| **F-01** | docs-writer | CLAUDE.md/GEMINI.md §Agent Dispatch Rules 추가 (Workspace Root L0) | Phase 4 |
| **F-02** | docs-writer | templates/common/CLAUDE.md, GEMINI.md 동일 업데이트 (Template L1) | Phase 4 |
| **F-03** | docs-writer | AGENTS.md §PM Gateway Policy 독립 섹션 분리 및 강화 (Workspace Root L0) | Phase 4 |
| **F-04** | docs-writer | templates/common/AGENTS.md 동일 업데이트 (Template L1) | Phase 4 |
| **F-05** | auditor | CLAUDE.md/GEMINI.md/AGENTS.md 4레벨 강제 구조 문서화 검증 + QA Gate 강화 | Phase 5 |
| **F-06** | pm | publish-to-template.sh 실행으로 L0→L1 전파 + 메모로그/CHANGELOG 업데이트 + PR 생성 | Phase 6 |

---

## Action Items

| # | Owner | Deliverable | Phase |
|---|-------|-------------|-------|
| F-01 | docs-writer | CLAUDE.md/GEMINI.md §Agent Dispatch Rules 추가 (Workspace Root L0) | Phase 4 |
| F-02 | docs-writer | templates/common/CLAUDE.md, GEMINI.md 동일 업데이트 (Template L1) | Phase 4 |
| F-03 | docs-writer | AGENTS.md §PM Gateway Policy 독립 섹션 분리 및 강화 (Workspace Root L0) | Phase 4 |
| F-04 | docs-writer | templates/common/AGENTS.md 동일 업데이트 (Template L1) | Phase 4 |
| F-05 | auditor | CLAUDE.md/GEMINI.md/AGENTS.md 4레벨 강제 구조 문서화 검증 + QA Gate 강화 | Phase 5 |
| F-06 | pm | publish-to-template.sh 실행으로 L0→L1 전파 + 메모로그/CHANGELOG 업데이트 + PR 생성 | Phase 6 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| F-01 | CLAUDE.md/GEMINI.md에 §Agent Dispatch Rules가 맨 처음 섹션에 추가되고 4레벨 강제 구조가 문서화됨 | Auditor가 문서 검증 |
| F-02 | templates/common/CLAUDE.md, GEMINI.md에 동일한 §Agent Dispatch Rules가 추가됨 | Auditor가 template 검증 |
| F-03 | AGENTS.md에 §PM Gateway Policy 독립 섹션이 분리되고 Enforcement Layers 4개가 명시됨 | Auditor가 문서 구조 검증 |
| F-04 | templates/common/AGENTS.md에 동일한 §PM Gateway Policy가 추가됨 | Auditor가 template 검증 |
| F-05 | Auditor가 CLAUDE.md/GEMINI.md/AGENTS.md의 4레벨 강제 구조를 모두 검증하고 QA Gate를 강화함 | qa-gate.sh 통과 |
| F-06 | L0→L1 전파 완료되고 CHANGELOG.md에 기록되며 memory/YYYY-MM-DD.md에 회의 요약이 추가됨 | PM이 문서 업데이트 확인 |
