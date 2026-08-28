# project-review

> **`SKILL.md` 프론트매터에서 생성됨 (2026-08-28 per-skill README 표준, CONSTITUTION §6.2).** 자유롭게 보강하세요 — 이 파일은 자동 재생성되지 않습니다.

## 목적

Performs a comprehensive parallel review of the current project using all available specialist agents. Auto-detects project type and agent roster, generates an execution plan, dispatches agents in parallel, and produces a prioritized improvement plan (Critical/High/Medium/Low). Use when: user requests a full project review ("/project-review" or "do a full project review"); PM detects structural changes (3+ agent files modified, phase schema changes, variant.json modified, new domain added); QA escalation from auditor (safety-audit.ts ERROR >= 3 or Critical finding).

- **스코프(scope)**: `co-safety`
- **버전**: 1.1.0

## 사용 시점

- 위 목적에 해당하는 작업을 수행할 때 로드합니다 (`SKILL.md` 설명 참조).

## 사전 조건

(none)

## 사용 방법

```
<SKILL.md의 지시에 따라 호출 — 또는 플랫폼 스킬 레지스트리를 통해 AI 스킬로 로드>
```

권한 지침과 프론트매터는 [SKILL.md](SKILL.md)를 참조하세요.
