# slide-layout-gate

> **`SKILL.md` 프론트매터에서 생성됨 (2026-08-28 per-skill README 표준, CONSTITUTION §6.2).** 자유롭게 보강하세요 — 이 파일은 자동 재생성되지 않습니다.

## 목적

슬라이드 콘텐츠 준수 게이트입니다. estimate-layout.ts --lint을 실행하여 slidedata.json의 모든 슬라이드를 병합된 4계층 스펙의 content_constraints(슬라이드 유형별 제목/부제/설명 글자 수, 불릿 개수, 본문 글자 수)와 대조 검사합니다. Exit 1이면 PDF 내보내기가 차단됩니다. '레이아웃 게이트', '슬라이드 린트', '슬라이드 범위 확인', '슬라이드 콘텐츠 준수' 요청에 응답합니다.

- **스코프(scope)**: `co-deck`
- **버전**: 1.0.0

## 사용 시점

- 위 목적에 해당하는 작업을 수행할 때 로드합니다 (`SKILL.md` 설명 참조).

## 사전 조건

html-build

## 사용 방법

```
<SKILL.md의 지시에 따라 호출 — 또는 플랫폼 스킬 레지스트리를 통해 AI 스킬로 로드>
```

권한 지침과 프론트매터는 [SKILL.md](SKILL.md)를 참조하세요.
