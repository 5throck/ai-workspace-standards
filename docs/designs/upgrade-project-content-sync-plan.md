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

## 상태

- [ ] 구현 대기 중
