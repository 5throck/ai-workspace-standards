# i18n-layout

> **`SKILL.md` 프론트매터에서 생성됨 (2026-08-28 per-skill README 표준, CONSTITUTION §6.2).** 자유롭게 보강하세요 — 이 파일은 자동 재생성되지 않습니다.

## 목적

텍스트 레이아웃 및 인코딩 가이드: 문자 인코딩(UTF-8, 레거시 한글 코드페이지, BOM 관련 위험), 줄바꿈 방식, RTL/양방향(bidi) 처리, 문자 체계별 폰트 선택(한글 중심)을 다룹니다. 인코딩이 깨지거나 문자가 깨져 보일 때, RTL 로케일이 올바르게 렌더링되어야 할 때, 특정 문자 체계에 맞는 폰트를 선택해야 할 때, CRLF/BOM 문제가 발생할 때 사용합니다. Korean code pages, BOM hazards), line endings, RTL/bidi handling, and script-specific font selection (Hangul focus). Use when: encoding is corrupted or mojibake appears, an RTL locale must render correctly, fonts must be chosen for a script, or CRLF/BOM issues surface.

- **스코프(scope)**: `common`
- **버전**: 1.0.0

## 사용 시점

- 위 목적에 해당하는 작업을 수행할 때 로드합니다 (`SKILL.md` 설명 참조).

## 사전 조건

(none)

## 사용 방법

```
<SKILL.md의 지시에 따라 호출 — 또는 플랫폼 스킬 레지스트리를 통해 AI 스킬로 로드>
```

권한 지침과 프론트매터는 [SKILL.md](SKILL.md)를 참조하세요.
