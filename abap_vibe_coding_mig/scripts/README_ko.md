# 프로젝트 스크립트 (Project Scripts)

프로젝트 운영을 위한 유틸리티 스크립트입니다.

## 사용 가능한 스크립트

### 셸 스크립트 (Bash + PowerShell)

모든 유틸리티 스크립트는 크로스 플랫폼 호환성을 위해 `.sh`와 `.ps1` 버전을 모두 제공합니다:

| 스크립트 | 목적 |
|---------|------|
| `setup.sh` / `setup.ps1` | 초기 프로젝트 설정 (env, 의존성, 첫 커밋) |
| `audit.sh` / `audit.ps1` | 문서 및 파일 무결성 감사 |
| `dev-sync.sh` / `dev-sync.ps1` | 전체 동기화 파이프라인 (memlog → changelog → audit → commit → PR) |
| `sync-md.sh` / `sync-md.ps1` | memory/MEMORY.md 인덱스 업데이트 |
| `gen-pr-body.sh` / `gen-pr-body.ps1` | 변경 사항에서 PR 바디 생성 |

### TypeScript (Bun) 스크립트

복잡한 오케스트레이션 및 자동화 스크립트:

| 스크립트 | 목적 |
|---------|------|
| `verify-skills.ts` | `skills/` 디렉토리의 모든 스킬이 로드 가능한지 확인 |
| `agent-create.ts` | 새 에이전트 정의 파일 생성 |
| `agent-list.ts` | 메타데이터와 함께 모든 에이전트 나열 |
| `agent-delete.ts` | 에이전트 파일 삭제 |
| `agent-verify.ts` | 에이전트/문서 동기화 확인 |
| `dispatch.ts` | 에이전트 디스패치를 위한 메인 진입점 |
| `dispatch-parallel.ts` | 병렬 에이전트 디스패처 |
| `dispatch-serial.ts` | 종속성이 있는 직렬 에이전트 디스패처 |
| `retry-handler.ts` | 지수 백오프가 포함된 재시도 로직 |

## NPM 스크립트

`package.json`에 정의된 편의 단축키:

```bash
bun run verify-skills     # 스킬 확인
bun run agent:create      # 새 에이전트 생성
bun run agent:list        # 에이전트 목록
bun run agent:delete      # 에이전트 삭제
bun run agent:verify      # 에이전트/문서 동기화 확인
bun run dispatch:parallel # 병렬 디스패치 실행
bun run dispatch:serial   # 직렬 디스패치 실행
```

## 하이브리드 스크립팅 모델

이 프로젝트는 하이브리드 스크립팅 접근 방식을 따릅니다:

- **TypeScript (Bun)** - 복잡한 오케스트레이션, 멀티 에이전트 디스패치, 자동화 파이프라인
- **셸 스크립트** - 일상적인 유틸리티 및 크로스 플랫폼 호환성

### 스크립트 페어링 규칙

셸 스크립트의 생성, 수정, 삭제는 항상 두 버전을 모두 유지해야 합니다:

| 작업 | 요구사항 |
|------|----------|
| `.sh` 생성 | `.ps1`도 반드시 생성 |
| `.sh` 수정 | `.ps1`도 반드시 수정 |
| `.sh` 삭제 | `.ps1`도 반드시 삭제 |

## 파일 인코딩

모든 스크립트는 **UTF-8 (BOM 없음)**으로 저장해야 합니다.

PowerShell 스크립트는 인코딩을 명시적으로 지정해야 합니다:
```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
```

---

*프로젝트 템플릿 - 필요에 따라 사용자 정의하세요*
