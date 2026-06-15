---
translated_from_hash: PLACEHOLDER
sync_version: 1
---

# co-develop

> **상태**: 안정화 (v1.0.0)

---

소프트웨어 개발 워크플로우 — PM, Architect, Designer, Code Writer, Test Runner, Security Monitor로 구성된 전체 에이전트 팀.

## 빠른 시작

이 variant는 `templates/common`을 상속하며 소프트웨어 개발을 위한 6단계 선형 거버넌스 파이프라인을 제공합니다.

### Claude Code 사용자:

`CLAUDE.md`에서 상세 안내를 확인하세요.

### Gemini Code 사용자:

`GEMINI.md`에서 상세 안내를 확인하세요.

## Variant 유형

**유형**: development

이 variant는 소프트웨어 개발 워크플로우, 기능 구현 및 통합 테스트에 중점을 둡니다.

## 에이전트 구성

| 에이전트 | 역할 | 티어 |
|---------|------|------|
| architect | 시스템 설계 및 아키텍처 계획 | Medium |
| code-writer | 기능 구현 | Low |
| designer | UI/UX 및 컴포넌트 설계 | Low |
| security-monitor | 보안 검토 및 컴플라이언스 | Medium |
| test-runner | 테스트 및 QA 검증 | Low |

## 스킬

Variant 전용 스킬 없음. `templates/common/skills/`의 공유 스킬을 사용합니다.

---

**안정화 승격일**: 2026-06-13
**템플릿 버전**: 1.0.0
