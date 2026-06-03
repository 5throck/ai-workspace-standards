# Safety Operating System Harness Engineering Guide
Version: 1.0

## Purpose
본 문서는 Harness Engineering 방법론을 활용하여 산업안전·보건·환경(EHS) 및 컴플라이언스 업무를 지원하는 GitHub-Native Safety Operating System(Safety OS)을 설계·구축하기 위한 종합 가이드이다.

---

# 1. Vision

## 목표
Safety OS는 단순 챗봇이 아닌 운영체계(Operating System)이다.

지원 범위:

- 법령 관리
- 위험성평가
- 작업허가
- 협력사 관리
- PSM
- 비상대응
- 사고조사
- 감사
- 교육
- KPI 보고
- 증적관리
- 지속개선

## 핵심 원칙

1. Discover → Reuse → Adapt → Create
2. Workflow First
3. Scenario Driven
4. Evidence Based
5. Traceability
6. GitHub Native
7. Continuous Improvement

---

# 2. Reference Architecture

External Knowledge Sources
→ Knowledge Acquisition Layer
→ Knowledge Graph Layer
→ Workflow Layer
→ Skill Layer
→ Script Layer
→ Agent Execution Layer
→ Evidence Layer
→ Governance Layer

---

# 3. Knowledge Acquisition Strategy

## External Sources

### Legal

- Legalize KR
- 국가법령정보센터
- 고용노동부
- 산업안전보건공단
- 소방청
- 환경부

### Standards

- ISO 45001
- ISO 31000
- ISO 22301

### Open Source

- GitHub
- MCP Registry
- K-Skill
- Public Safety Repositories

## Discovery Workflow

1. Repository Search
2. Asset Classification
3. Reusability Analysis
4. Gap Analysis
5. Catalog Registration
6. Governance Review

---

# 4. Governance Model

## Safety Governance Manager (SGM)

책임:

- 전략 수립
- 정책 수립
- KPI 정의
- 표준 승인
- 감사 체계 관리

산출물:

- Governance Framework
- KPI Framework
- Compliance Framework

## Safety Workflow Manager (SWM)

책임:

- Workflow 선택
- Agent Team 구성
- Task Routing
- 진행 관리
- 증적 수집

산출물:

- Execution Plan
- Workflow Assignment
- Evidence Map

---

# 5. Agent Pool

## Legal Intelligence Agent

역할:

- 법령 분석
- 법령 개정 추적
- 요구사항 도출

산출물:

- Regulation Catalog
- Requirement Matrix

## GitHub Repository Agent

역할:

- GitHub 탐색
- Workflow 탐색
- Skill 탐색
- Script 탐색

산출물:

- Repository Catalog
- Reusable Asset Catalog

## Open Source Discovery Agent

역할:

- 오픈소스 조사
- 재사용 후보 식별
- 라이선스 검토

## Compliance Agent

역할:

- 준수성 검증
- Gap 분석

## Risk Assessment Agent

역할:

- 위험성 평가
- 위험도 분석
- 통제방안 제안

## PSM Agent

역할:

- PSM
- HAZOP
- MOC
- Permit to Work

## Contractor Safety Agent

역할:

- 협력사 관리
- 자격 검증
- 교육 검증

## Asset Integrity Agent

역할:

- 설비 무결성
- 예방정비
- 설비 건전성

## Emergency Preparedness Agent

역할:

- 비상계획
- BCP
- 훈련계획

## Disaster Response Agent

역할:

- 자연재해 대응
- 복구계획

## Fire & Explosion Agent

역할:

- 화재
- 폭발
- 방폭

## Incident Investigation Agent

역할:

- RCA
- 5 Why
- 재발방지

## Audit Agent

역할:

- 내부감사
- 외부감사
- ISO 감사

## Training Agent

역할:

- 교육체계
- 역량관리

## Reporting Agent

역할:

- KPI
- 경영진 보고

## Knowledge Graph Agent

역할:

- Traceability
- Knowledge Graph 구축

---

# 6. Industry Profiles

## Manufacturing

주요 Workflow

- 위험성평가
- 설비점검
- 작업허가
- 협력사관리
- 안전교육

## Chemical

주요 Workflow

- PSM
- HAZOP
- MOC
- 화학물질 도입
- 비상대응

## Construction

주요 Workflow

- TBM
- 작업허가
- 고소작업
- 협력사관리

## Semiconductor

주요 Workflow

- Chemical Safety
- PSM
- Emergency Response

## Data Center

주요 Workflow

- Change Management
- Disaster Recovery
- Business Continuity

---

# 7. Workflow Engineering Standard

각 Workflow 정의 항목

- Name
- Purpose
- Trigger
- Owner
- Inputs
- Outputs
- Participants
- Decision Gates
- Related Regulations
- Required Evidence
- KPIs

예시: 위험성평가

1. 작업선정
2. 위험요인 식별
3. 위험도 평가
4. 개선대책 수립
5. 승인
6. 현장 적용
7. 효과 검증

---

# 8. Scenario Engineering Standard

각 Scenario 정의 항목

- Scenario Name
- Industry
- Trigger
- Impact
- Likelihood
- Response Team
- Escalation Rules
- Communication Plan
- Recovery Plan
- Lessons Learned

예시:

- 화재
- 폭발
- 화학물질 누출
- 중대재해
- 태풍
- 홍수
- 지진

---

# 9. Skill Engineering

Skill Template

- Skill Name
- Objective
- Inputs
- Outputs
- Dependencies
- Related Regulations
- Related Workflows

예시

- risk-assessment
- permit-to-work
- emergency-response
- incident-investigation
- compliance-gap-analysis
- psm-moc

---

# 10. Script Engineering

Script Types

- SOP Script
- Checklist Script
- Audit Script
- Emergency Script
- Incident Script
- Training Script

Script Template

- Purpose
- Trigger
- Inputs
- Steps
- Decision Points
- Outputs
- Required Evidence

---

# 11. Knowledge Graph

Traceability Chain

Regulation
→ Requirement
→ Control
→ Workflow
→ Skill
→ Script
→ Evidence
→ Finding
→ Corrective Action

---

# 12. GitHub Repository Structure

```text
safety-os/

├── governance/
├── regulations/
├── requirements/
├── controls/
├── industry-profiles/
├── workflows/
├── scenarios/
├── skills/
├── scripts/
├── evidence-models/
├── knowledge-graph/
├── agents/
└── external/

external/
├── legalize-kr/
├── k-skill/
├── mcp/
├── iso/
└── public-guidelines/
```

---

# 13. Project Execution Roadmap

## Phase 0 Foundation

- Scope 정의
- 산업 선정
- Governance 정의

## Phase 1 Discovery

- GitHub 조사
- Legal Repository 조사
- K-Skill 조사
- MCP 조사

## Phase 2 Knowledge Engineering

- 법령 카탈로그
- 요구사항 카탈로그
- 통제체계 정의

## Phase 3 Workflow Engineering

- 산업별 Workflow 설계

## Phase 4 Skill Engineering

- Skill 설계
- 재사용 자산 선정

## Phase 5 Script Engineering

- SOP 작성
- Checklist 작성

## Phase 6 Scenario Engineering

- 비상대응 시나리오 설계

## Phase 7 Agent Team Engineering

- Agent Pool 설계
- Team Assembly Logic 설계

## Phase 8 Validation

- Pilot
- Audit
- Gap Closure

## Phase 9 Continuous Improvement

- Feedback Loop
- KPI 개선
- Knowledge Graph 고도화

---

# 14. Master Prompt

You are a Harness Engineering Team responsible for building a GitHub-native Safety Operating System.

Follow:

Discover
→ Reuse
→ Adapt
→ Create

Before creating any asset:

- Search GitHub
- Search Legal Repositories
- Search MCP Registries
- Search Skill Libraries
- Search Workflow Libraries

Build:

- Industry Profiles
- Regulation Catalogs
- Knowledge Graphs
- Workflow Libraries
- Skill Libraries
- Script Libraries
- Scenario Libraries
- Agent Teams

Maintain Traceability:

Regulation
→ Requirement
→ Control
→ Workflow
→ Skill
→ Script
→ Evidence
→ Audit Finding
→ Corrective Action
