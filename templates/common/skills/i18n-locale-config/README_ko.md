# i18n-locale-config

> **`SKILL.md` 프론트매터에서 생성됨 (2026-08-28 per-skill README 표준, CONSTITUTION §6.2).** 자유롭게 보강하세요 — 이 파일은 자동 재생성되지 않습니다.

## 목적

로케일 식별과 구성: BCP 47 로케일 ID 구조, 언어 대 국가 구분 원칙, 언어별 정렬 순서, 시간대 처리, 지역/언어 매트릭스를 다룹니다. 로케일 코드를 선택할 때, locales/&lt;lang&gt;.json을 구성할 때, 특정 언어의 정렬 순서를 수정할 때, 산출물에 표시할 시간대를 결정할 때 사용합니다. the language-vs-country doctrine, per-language collation order, timezone handling, and the region/language matrix. Use when: choosing a locale code, configuring locales/<lang>.json, fixing sort order for a language, or deciding which timezone a deliverable should display.

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
