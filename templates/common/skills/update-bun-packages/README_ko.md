# update-bun-packages

> **`SKILL.md` 프론트매터에서 생성됨 (2026-08-28 per-skill README 표준, CONSTITUTION §6.2).** 자유롭게 보강하세요 — 이 파일은 자동 재생성되지 않습니다.

## 목적

AI 워크스페이스(L0) 또는 독립 프로젝트(L2/L3) 전반의 Bun 의존성과 패키지를 스캔, 업데이트, 업그레이드하며 락파일 일관성, package.json 버전 갱신, 보안 준수를 보장합니다. Bun 의존성을 업데이트할 때, 패키지를 @latest로 업그레이드할 때, 워크스페이스나 템플릿의 오래된 패키지를 확인할 때 사용합니다. or standalone project (L2/L3) while ensuring lockfile consistency, package.json version bumps, and security compliance. Use when: updating bun dependencies, upgrading packages to @latest, checking outdated packages in workspace or templates.

- **스코프(scope)**: `common`
- **버전**: 1.3.0

## 사용 시점

- 위 목적에 해당하는 작업을 수행할 때 로드합니다 (`SKILL.md` 설명 참조).

## 사전 조건

(none)

## 사용 방법

```
<SKILL.md의 지시에 따라 호출 — 또는 플랫폼 스킬 레지스트리를 통해 AI 스킬로 로드>
```

권한 지침과 프론트매터는 [SKILL.md](SKILL.md)를 참조하세요.
