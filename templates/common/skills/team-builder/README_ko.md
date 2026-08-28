# team-builder

> **`SKILL.md` 프론트매터에서 생성됨 (2026-08-28 per-skill README 표준, CONSTITUTION §6.2).** 자유롭게 보강하세요 — 이 파일은 자동 재생성되지 않습니다.

## 목적

Engagement Leader가 모든 컨설팅 도메인을 위한 새로운 AI 에이전트 팀을 구축하도록 안내합니다. 요구사항 인터뷰, 웹 벤치마킹, 현재 팀 진단, 제안 생성, 사용자 승인 게이트를 다룹니다. scripts/team-builder.ts가 실행할 승인된 제안 JSON을 산출합니다. '새 에이전트 팀 구축' 요청 시 트리거됩니다. Covers requirements interview, web benchmarking, current team diagnosis, proposal generation, and user approval gate. Outputs an approved proposal JSON for scripts/team-builder.ts to execute. Triggered by: "build new agent team".

- **스코프(scope)**: `common`
- **버전**: 1.1.0

## 사용 시점

- 위 목적에 해당하는 작업을 수행할 때 로드합니다 (`SKILL.md` 설명 참조).

## 사전 조건

none

## 사용 방법

```
<SKILL.md의 지시에 따라 호출 — 또는 플랫폼 스킬 레지스트리를 통해 AI 스킬로 로드>
```

권한 지침과 프론트매터는 [SKILL.md](SKILL.md)를 참조하세요.
