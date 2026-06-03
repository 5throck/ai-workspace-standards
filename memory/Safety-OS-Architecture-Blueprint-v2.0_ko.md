# Safety OS Architecture Blueprint v2.0
## Harness Engineering 기반 산업안전 AI Agent Platform 설계서

### 목적
본 문서는 산업안전, 보건, 환경(EHS), 컴플라이언스 업무를 지원하기 위한 GitHub-Native Safety Operating System(Safety OS)의 상세 설계서이다.

---

# 1. Executive Summary

## 비전

Safety OS는 다음을 수행한다.

- 법령 기반 업무 지원
- 산업별 워크플로우 자동화
- AI Agent Team 구성
- 비상 대응 지원
- 감사 대응
- 증적 관리
- 지속 개선

## 핵심 철학

Discover → Reuse → Adapt → Create

---

# 2. Enterprise Architecture

## Layer 0 – External Knowledge

- Legalize KR
- 국가법령정보센터
- K-Skill
- MCP Server
- ISO Standards
- 정부 가이드라인
- 사내 규정

## Layer 1 – Knowledge Acquisition

Agent:

- Legal Intelligence Agent
- Open Source Discovery Agent
- GitHub Repository Agent

## Layer 2 – Knowledge Graph

Traceability:

Regulation
→ Requirement
→ Control
→ Workflow
→ Skill
→ Script
→ Evidence
→ Finding
→ Corrective Action

## Layer 3 – Workflow Layer

Workflow Library

## Layer 4 – Agent Layer

Dynamic Team Assembly

## Layer 5 – Governance Layer

Safety Governance Manager

---

# 3. Industry Profiles

## Manufacturing

핵심 리스크

- 협착
- 추락
- 충돌
- 화재

주요 Workflow

- 위험성평가
- 설비점검
- 작업허가
- 협력사관리

## Chemical

핵심 리스크

- 폭발
- 누출
- 독성물질

주요 Workflow

- PSM
- HAZOP
- MOC
- Emergency Response

## Semiconductor

핵심 리스크

- 화학물질
- 가스
- 클린룸

주요 Workflow

- Chemical Safety
- PSM
- Emergency Response

## Construction

핵심 리스크

- 추락
- 낙하
- 중장비

주요 Workflow

- TBM
- Permit To Work
- Contractor Management

## Data Center

핵심 리스크

- 정전
- 화재
- 서비스 중단

주요 Workflow

- Change Management
- BCP
- Disaster Recovery

---

# 4. Agent Organization

## Governance

### Safety Governance Manager

책임

- 전략
- KPI
- 정책
- 표준 승인

### Safety Workflow Manager

책임

- Workflow 선택
- Agent Team 구성
- 진행관리

---

# 5. Agent Catalog

## Legal Intelligence Agent

입력

- 법령

출력

- Requirement Matrix

## Compliance Agent

입력

- 법령
- 규정

출력

- Gap Analysis

## Risk Assessment Agent

입력

- 작업 정보

출력

- Risk Register

## PSM Agent

입력

- 공정정보

출력

- HAZOP
- MOC

## Emergency Preparedness Agent

출력

- Emergency Playbook

## Disaster Response Agent

출력

- Recovery Plan

## Fire & Explosion Agent

출력

- Fire Prevention Plan

## Incident Investigation Agent

출력

- RCA Report

## Audit Agent

출력

- Audit Findings

## Training Agent

출력

- Curriculum

## Reporting Agent

출력

- Dashboard

## Knowledge Graph Agent

출력

- Graph Update

---

# 6. Workflow Library

## 위험성평가

Trigger

- 신규 작업
- 변경 작업

Flow

1. 작업 식별
2. 위험 식별
3. 위험도 평가
4. 통제방안 정의
5. 승인
6. 적용
7. 검증

Evidence

- 위험성평가서
- 승인 기록

## 작업허가(PTW)

Flow

1. 작업 신청
2. 위험 검토
3. 승인
4. 수행
5. 종료 확인

Evidence

- Permit
- Checklist

## MOC

Flow

1. 변경 요청
2. 영향 분석
3. HAZOP
4. 승인
5. 적용
6. 검증

---

# 7. Scenario Library

## 화재

Response Team

- Fire & Explosion Agent
- Emergency Agent
- Reporting Agent

## 화학물질 누출

Response Team

- PSM Agent
- Emergency Agent
- Incident Agent

## 중대재해

Response Team

- Compliance Agent
- Investigation Agent
- Reporting Agent

## 태풍

Response Team

- Disaster Agent
- Communication Agent

## 지진

Response Team

- Disaster Agent
- Asset Integrity Agent

---

# 8. Skill Catalog

## risk-assessment

Input

- 작업정보

Output

- 위험도

## permit-to-work

Output

- Permit Package

## emergency-response

Output

- Response Plan

## audit-preparation

Output

- Audit Checklist

## incident-investigation

Output

- RCA Report

## psm-moc

Output

- MOC Package

---

# 9. Script Catalog

## SOP Script

구성

- 목적
- 범위
- 절차
- 증적

## Checklist Script

구성

- 점검항목
- 결과
- 조치

## Audit Script

구성

- 인터뷰
- 문서검토
- 현장점검

## Emergency Script

구성

- 대응절차
- 연락체계
- 보고체계

---

# 10. GitHub Operating Model

## Repository Structure

safety-os/

- governance
- regulations
- requirements
- controls
- workflows
- scenarios
- skills
- scripts
- agents
- evidence-models
- knowledge-graph
- external

## Branch Strategy

main
develop
feature/*
release/*

## Review Process

Draft
→ Review
→ Approval
→ Release

---

# 11. Knowledge Graph Schema

Node

- Regulation
- Requirement
- Control
- Workflow
- Skill
- Script
- Evidence
- Finding
- CorrectiveAction

Relationship

REQUIRES
IMPLEMENTS
GENERATES
VALIDATES
CLOSES

---

# 12. Agent Team Assembly

입력

- Industry
- Workflow
- Scenario

출력

- Team Leader
- Participating Agents
- Skills
- Scripts
- Evidence

예시

Chemical + Leak Scenario

Leader:
PSM Agent

Members:
Emergency Agent
Investigation Agent
Reporting Agent

---

# 13. Claude Code / Codex 운영 전략

## 역할

Claude Code

- Workflow 생성
- Script 생성
- 문서 생성

Codex

- Repository 관리
- 자동화 구현
- CI/CD

## 공통 원칙

모든 변경은 GitHub Pull Request 기반

---

# 14. Implementation Roadmap

Phase 0 Foundation

Phase 1 Discovery

Phase 2 Knowledge Engineering

Phase 3 Workflow Engineering

Phase 4 Skill Engineering

Phase 5 Script Engineering

Phase 6 Scenario Engineering

Phase 7 Agent Engineering

Phase 8 Pilot

Phase 9 Enterprise Rollout

---

# 15. Master Program Prompt

You are the Harness Engineering Team responsible for building an enterprise-grade GitHub-native Safety Operating System.

Objectives:

1. Discover reusable assets.
2. Reuse before creating.
3. Build industry-specific workflows.
4. Build scenario libraries.
5. Build skill libraries.
6. Build script libraries.
7. Maintain full traceability.
8. Produce auditable evidence.

All outputs must support:

Regulation
→ Requirement
→ Control
→ Workflow
→ Skill
→ Script
→ Evidence
→ Audit
→ Improvement
