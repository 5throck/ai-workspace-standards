# /meeting Command Retirement — Reference Audit (2026-09-26)

- **Purpose**: ADR-0090 프로그램 이후 `/meeting` 슬래시 커맨드 폐기에 따른 전 계층 참조 실태 조사 (user directive 2026-09-26)
- **Method**: 전 워크스페이스 grep(`*.md`, node_modules/.git 제외) + 유형 분류

## 1. 총량

`/meeting` 참조 파일 **875개** (templates 386 · Projects 489 · 루트 문서 6 수준).

## 2. 유형 분류

| 유형 | 정의 | 처리 방침 |
|---|---|---|
| **cmd_ad** (186) | `/meeting "topic"` 호출 광고(명령 테이블·명시 호출 안내) | meeting-facilitation 스킬 참조로 교체 — **대상** |
| **session_prose** (182) | "In a `/meeting` session..." 세션 서술(co-deck 등 에이전트 정의) | "In a facilitated meeting" 등 서술어 정리 — **대상** |
| **skill_self** (269) | meeting-facilitation 스킬/그 전달 미러 자체 참조 | 대부분 정상(스킬 자기 참조) — SSOT 우선 검토 |
| **historical** (28) | memory/CHANGELOG 이력 기록 | **불변** (이력 기록) |
| **other** (327) | 커맨드 파일·스키마 문서 등 | 개별 판단 |

## 3. 계층별 분포

- L0 루트 문서: AGENTS.md(§3.7 교체 완료·§6 충돌 표), CLAUDE.md/GEMINI.md(명령 테이블+명시 호출), CODEX.md(Command Intercept 맥락)
- L1: templates/common/{AGENTS,CLAUDE,GEMINI}.md + templates/README(.md/_ko.md 회의 커맨드 동기화 안내)
- L2: 13개 variant {AGENTS,CLAUDE,GEMINI}.md + co-deck agents/*.md(8파일 세션 서술) + co-deck/README(.md/_ko.md)
- Projects: 12개 프로젝트 {CLAUDE,GEMINI,AGENTS}.md + 전달 미러(.claude/.gemini/.codex/.agents/.hermes 스킬 사본) + memory 이력

## 4. 처리 원칙 (SSOT 우선)

1. **SSOT에서만 수정**: skills/meeting-facilitation/SKILL.md, L0 트윈(CLAUDE/GEMINI/CODEX), L0 AGENTS.md, templates/common — 전달 사본(미러)은 재동기화로 자동 반영
2. **이력 불변**: memory/, CHANGELOG의 과거 기록은 수정하지 않음
3. **명령 파일 자체**( .claude/commands/meeting.md, .gemini/commands/meeting.md): platform-command-lifecycle-manager 스킬의 관리 대상 — 본 감사에서는 미처리(별도 결정)
4. ** Projects 계층**: 각 프로젝트 /sync 경유 착지(전달 사본 재동기화)

## 5. 참조

- 사용자 지시: 2026-09-26 "AGENTS.md 내 더 이상 사용하지 않는 /meeting 스킬 → meeting-facilitation 스킬로 변경"
- 선행: PR #1092 (AGENTS.md §3.7 교체), ADR-0090/0091
