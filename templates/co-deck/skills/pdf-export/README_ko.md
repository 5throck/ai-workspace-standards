# pdf-export

> **`SKILL.md` 프론트매터에서 생성됨 (2026-08-28 per-skill README 표준, CONSTITUTION §6.2).** 자유롭게 보강하세요 — 이 파일은 자동 재생성되지 않습니다.

## 목적

Generates PDF from slide data using pdf-lib. Extracts slidedata.json, runs sample (5-slide) then full PDF generation scripts, reviews results. Reads the 4-layer spec merge (base → theme → style → overrides) directly — no Playwright measurement required. Responds to "make PDF", "export PDF", "convert to PDF". Stage 11 of the lecture workflow.

- **스코프(scope)**: `co-deck`
- **버전**: 2.1.1

## 사용 시점

- 위 목적에 해당하는 작업을 수행할 때 로드합니다 (`SKILL.md` 설명 참조).

## 사전 조건

prep-pdf

## 사용 방법

```
<SKILL.md의 지시에 따라 호출 — 또는 플랫폼 스킬 레지스트리를 통해 AI 스킬로 로드>
```

권한 지침과 프론트매터는 [SKILL.md](SKILL.md)를 참조하세요.
