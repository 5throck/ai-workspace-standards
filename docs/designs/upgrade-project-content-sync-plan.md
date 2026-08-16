---
lang: ko
lang_reason: source-material
---

# upgrade-project.ts 확장 계획 — agents/docs/skills/scripts 업그레이드 지원

## 배경

`upgrade-project.ts`는 현재 git hooks / 거버넌스 파일(`LOCKED`)과
`WORKSPACE-MANAGED` 마커 파일(`MERGE`)만 처리한다.
실제 콘텐츠 폴더(`agents/`, `scripts/`, `skills/`, `docs/`)는 업그레이드 대상에서 빠져 있어
예를 들어 `audit.ts`가 프로젝트에 v2.7.3으로 남아 있어도 자동 반영이 안 된다.

## 현황 조사 결과

| 폴더 | 버전 소스 | 현황 |
|------|----------|------|
| `scripts/*.ts` | `// @version X.Y.Z` 헤더 | 8개 outdated (audit.ts 2.7.3→2.9.1 등), 누락 없음 |
| `agents/*.md` | frontmatter `version: "X.Y.Z"` | 템플릿엔 버전 있음, 프로젝트 파일은 전부 버전 없음 |
| `skills/*/SKILL.md` | frontmatter `version: X.Y.Z` | 일부만 명시적 버전, 프로젝트-only 스킬 다수 존재 |
| `docs/_common/*.md` | 없음 | 5개 파일 모두 프로젝트에 존재, context.md는 프로젝트 고유 |

### 실제 outdated scripts (co-architect 기준)

```
agent-lifecycle-audit.ts  1.1.2 → 1.1.3
audit.ts                  2.7.3 → 2.9.1
lifecycle-sync-audit.ts   1.3.4 → 1.4.0
validate-md-language.ts   1.3.0 → 1.4.2
validate-pm-extends.ts    0.2.1 → 0.3.0
verify-platform-lifecycle.ts  1.1.0 → 1.1.1
verify-scripts.ts         1.0.0 → 1.2.0
verify-skills.ts          1.0.0 → 1.2.0
```

## 구현 계획

**수정 파일**: `scripts/upgrade-project.ts` (단일 파일)

### 1. 유틸 함수 추가

```typescript
function semverGt(a: string, b: string): boolean
function extractScriptVersion(filePath: string): string    // // @version 헤더
function extractFrontmatterVersion(filePath: string): string  // version: "..." frontmatter
function fileHash(filePath: string): string                // 내용 해시 (버전 없는 파일용)
```

### 2. scripts/ — SYNC_IF_NEWER

- 소스: `templates/common/scripts/*.ts` + 서브디렉토리(`hooks/`, `lib/`, `helpers/`)
- template > project → 복사
- 프로젝트 전용 스크립트: PRESERVE (건드리지 않음)
- 버전 없는 파일: SKIP

### 3. agents/ — SYNC_IF_NEWER

- 소스 우선순위: `templates/<variant>/agents/` → fallback `templates/common/agents/`
- template > project, 또는 project에 버전 없고 template엔 있으면 → 복사
- 프로젝트 전용 에이전트(design-lead.md 등): PRESERVE
- README.md / README_ko.md: PRESERVE (버전 없음)

### 4. skills/ — SYNC_IF_NEWER

- 소스: `templates/common/skills/*/SKILL.md`
- 명시적 버전 있으면 semver 비교, 없으면 내용 해시 비교
- 프로젝트 전용 스킬(audit-workspace, create-variant 등): PRESERVE

### 5. docs/ — 선택적 OVERWRITE (allowlist)

| 파일 | 처리 |
|------|------|
| `phase-definitions.md` | OVERWRITE (거버넌스) |
| `security.md` | OVERWRITE (거버넌스) |
| `context.md` | PRESERVE (프로젝트 고유) |
| `README.md` / `README_ko.md` | PRESERVE |

### 카운터 & 출력

기존 `lockedChanged`, `mergeChanged`, `preserveListed`에 `syncChanged` 추가.
Summary에 `Sync files updated: N` 항목 추가.

## 검증

```bash
# dry-run으로 전체 확인
bun scripts/upgrade-project.ts Projects/co-architect --dry-run
```

기대 출력:
```
--- SYNC_IF_NEWER: scripts/ ---
  audit.ts: 2.7.3 → 2.9.1  [DRY RUN] WOULD COPY
  ...
--- SYNC_IF_NEWER: agents/ ---
  analyst.md: (none) → 1.0.0  [DRY RUN] WOULD COPY
  ...
--- SYNC_IF_NEWER: skills/ ---
  ...
--- OVERWRITE: docs/_common/ ---
  phase-definitions.md  [DRY RUN] WOULD COPY
  security.md  [DRY RUN] WOULD COPY
```

## 알려진 한계

`extractScriptVersion`은 `// @version X.Y.Z` (라인 주석) 형식만 인식한다. `scripts/helpers/security-validator.ts`처럼 JSDoc 블록 주석(`/**\n * @version X.Y.Z\n */`) 스타일로 버전을 선언한 파일은 정규식이 매칭되지 않아 항상 "버전 없음"으로 판정되고, `SYNC_IF_NEWER` 대상에서 조용히 제외된다 — 실제로는 버전이 있고 outdated한 파일인데도 사용자에게 아무 경고 없이 영구히 동기화되지 않는다.

2026-08-17에 `Projects/co-deck` 업그레이드 중 이 문제로 실제 장애가 발생했다: `scripts/audit.ts`를 최신 버전으로 동기화했더니, 이 최신 `audit.ts`가 `security-validator.ts` 1.1.0에서만 추가된 `sourceShellInjectionPatterns` export를 요구했다. `security-validator.ts`는 위 버그 때문에 계속 1.0.1에 머물러 있었고(정상적으로 SYNC_IF_NEWER 대상이 되었어야 함), 그 결과 `audit.ts` import 시점에 `SyntaxError: Export named 'sourceShellInjectionPatterns' not found`로 파이프라인 전체가 크래시했다. 해당 세션에서는 `audit.ts`/`security-validator.ts` 둘 다 업그레이드에서 제외하고 롤백한 뒤, 정규식 수정 + `security-validator.ts` 자체 테스트(`security-validator.test.ts`, 업그레이드 전부터 6개 실패 상태였음)와 함께 별도 팔로업 작업으로 분리했다.

**후속 조치 필요**: `extractScriptVersion`이 JSDoc 스타일(`\*\s*@version\s+(\d+\.\d+\.\d+)`)도 매칭하도록 정규식 확장. 워크스페이스 전역에서 `// @version` vs `* @version` 두 스타일이 몇 개 파일에 쓰이고 있는지 먼저 확인(`grep -rn "\* @version" scripts/` vs `grep -rn "// @version" scripts/`) — 이 설계 문서가 애초에 라인 주석 스타일만 상정하고 작성됐으므로, 다른 파일도 같은 이유로 조용히 스킵되고 있을 가능성이 있다.

## 상태

- [x] 구현 완료 — `semverGt`/`extractScriptVersion`/`extractFrontmatterVersion`/`fileHash` 및 `SYNC_IF_NEWER` (scripts/agents/skills), `docs/_common/` OVERWRITE 전부 `upgrade-project.ts`에 반영되어 있고, `Sync files updated` 카운터도 존재함 (커밋 이력상 2026-07-19 `v1.7.0` 확장 작업보다 앞서 구현된 것으로 추정 — 정확한 구현 커밋은 미확인). 2026-08-17 `Projects/co-deck` 업그레이드에서 실제로 정상 동작 확인.
- [ ] 위 "알려진 한계" 섹션의 JSDoc `@version` 인식 확장 — 미착수, 별도 세션에서 팔로업 예정
