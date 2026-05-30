# README 번역 가이드

`translate-readme.ts` 도구를 사용하여 README.md 파일의 변경사항을 추적하고 번역 작업을 체계적으로 관리할 수 있습니다.

이 도구는 **자동 번역 도구가 아닙니다**. 번역자가 변경된 내용을 파악하고 수동으로 번역하는 데 도움을 주는 **보조 도구**입니다.

---

## 목적

이 도구는 다음과 같은 상황에서 번역자를 지원합니다:

- **원본 README.md가 업데이트되었을 때**: 어떤 부분이 변경되었는지 확인
- **번역 파일 동기화 상태 확인**: 원본과 번역본의 내용이 일치하는지 검증
- **번역 가이드 제공**: 변경된 섹션을 명확히 표시하고 다음 단계 안내

---

## 기본 사용법

### 기본 명령어 (README.md → README_ko.md)

```bash
bun scripts/translate-readme.ts
```

기본값:
- 원본 파일 (`--from`): `README.md`
- 번역 파일 (`--to`): `README_ko.md`

### 다른 파일 번역

```bash
bun scripts/translate-readme.ts --from CONTRIBUTING.md --to CONTRIBUTING_ko.md
```

### 미리보기 모드 (Dry Run)

```bash
bun scripts/translate-readme.ts --dry-run
```

파일을 실제로 수정하지 않고 변경사항만 확인합니다.

---

## 출력 내용 이해하기

### 1. 해시 동기화 상태

```
✅ Files are already synchronized (hash: a1b2c3d4e5f6…).
   No translation updates needed.
```

이 메시지가 표시되면 번역 파일이 최신 상태입니다. 추가 작업이 필요하지 않습니다.

```
⚠️  Warning: Content hashes are out of sync!
   Source content_hash:          a1b2c3d4e5f6…
   Target translated_from_hash: 9f8e7d6c5b4a…
```

해시가 일치하지 않으면 원본 파일이 변경되었음을 의미합니다. 번역 업데이트가 필요합니다.

### 2. 변경 감지 섹션

```
Changes detected:

   ➕ New section: "Design Principles" (line 45)
   ✏️  Modified section: "Quick Start" (lines 20-35)
   🗑️  Deleted section: "Legacy Content" (line 100)
```

- **➕ New section**: 원본에 새로 추가된 섹션 (번역 필요)
- **✏️  Modified section**: 수정된 섹션 (번역 업데이트 필요)
- **🗑️  Deleted section**: 원본에서 삭제된 섹션 (번역본에서도 삭제 필요)

### 3. Diff 미리보기

```
Diff preview:

------------------------------------------------------------
--- a/README.md
+++ b/README_ko.md
@@ -20,7 +20,7 @@
 ## Quick Start
 
-### 1. Install prerequisites
+### 1. Install prerequisites (Bun required)
 
 | Tool | Version | Purpose | Install |
------------------------------------------------------------
```

Git 형식의 diff를 보여줍니다:
- `-`로 시작하는 줄: 원본에서 삭제된 내용
- `+`로 시작하는 줄: 원본에서 추가된 내용
- 변경된 줄의 컨텍스트를 함께 표시

### 4. 다음 단계 안내

```
Next steps:

   1. Review the changes above
   2. Update README_ko.md accordingly
   3. Update frontmatter in README_ko.md:
      - Update translated_from_hash: a1b2c3d4e5f6…
   4. Verify: bun scripts/verify-readme-sync.ts --pre-commit
```

단계별 지시사항을 따라 번역을 완료하세요.

---

## 일반적인 워크플로우

### 워크플로우 1: 정기적인 번역 업데이트

1. **최신 상태 확인**
   ```bash
   cd <project-directory>
   bun scripts/translate-readme.ts
   ```

2. **변경사항 검토**
   - 출력된 diff를 주의 깊게 읽어 변경된 부분 파악
   - 새로운 섹션, 수정된 섹션, 삭제된 섹션 확인

3. **번역 파일 업데이트**
   - `README_ko.md`를 텍스트 편집기로 열기
   - 변경된 부분을 수동으로 번역
   - 삭제된 섹션 제거

4. **프론트매터 업데이트**
   ```yaml
   ---
   translated_from_hash: a1b2c3d4e5f6…  # 도구가 표시한 새 해시 값
   ---
   ```

5. **검증**
   ```bash
   bun scripts/verify-readme-sync.ts --pre-commit
   ```

   검증에 성공하면 다음 메시지가 표시됩니다:
   ```
   ✅ README.md and README_ko.md are synchronized.
   ```

### 워크플로우 2: 새 번역 파일 생성

번역 파일이 아직 존재하지 않는 경우:

1. **도구 실행**
   ```bash
   bun scripts/translate-readme.ts --from README.md --to README_ko.md
   ```

2. **전체 원본 내용 검토**
   - 도구가 전체 파일을 diff 형식으로 표시
   - 모든 섹션을 번역해야 함

3. **번역 파일 생성**
   - `README_ko.md` 파일 생성
   - 원본 내용을 기반으로 번역
   - 프론트매터 추가:

   ```yaml
   ---
   translated_from_hash: <원본 해시 값>
   ---
   ```

4. **검증**
   ```bash
   bun scripts/verify-readme-sync.ts --pre-commit
   ```

---

## 프론트매터 (Frontmatter) 이해하기

### 원본 README.md의 프론트매터

```yaml
---
content_hash: a1b2c3d4e5f6…  # 파일 본문의 SHA-256 해시
sync_version: 1
---
```

- `content_hash`: 원본 파일의 **본문 내용** (프론트매터 제외)에 대한 해시 값
- 파일이 수정될 때마다 자동으로 변경됨

### 번역 파일 README_ko.md의 프론트매터

```yaml
---
translated_from_hash: a1b2c3d4e5f6…  # 번역이 기반한 원본 파일의 해시
---
```

- `translated_from_hash`: 이 번역이 어느 버전의 원본을 기반으로 했는지 나타냄
- 원본의 `content_hash`와 일치해야 동기화 상태로 간주

---

## 문제 해결 (Troubleshooting)

### 문제 1: "Error: Source file does not exist"

```
❌ Error: Source file 'README.md' does not exist.
```

**해결 방법**:
- 파일 경로가 올바른지 확인
- 프로젝트의 루트 디렉토리에서 실행 중인지 확인

```bash
cd <project-directory>
bun scripts/translate-readme.ts
```

### 문제 2: 해시 값이 계속 다르게 표시됨

```
⚠️  Warning: Content hashes are out of sync!
```

프론트매터를 올바르게 업데이트했는데도 이 메시지가 계속 표시되는 경우:

**확인할 사항**:
1. 프론트매터 형식이 올바른지 확인
   ```yaml
   ---
   translated_from_hash: a1b2c3d4e5f6…
   ---
   ```

2. 해시 값 복사 시 오타가 없는지 확인
3. 여백(스페이스/탭)이 포함되지 않았는지 확인

### 문제 3: 검증 스크립트 실패

```bash
bun scripts/verify-readme-sync.ts --pre-commit
```

다음과 같은 오류가 표시될 수 있음:
```
❌ README_ko.md is out of sync with README.md
```

**해결 방법**:
1. `translate-readme.ts` 도구를 다시 실행하여 현재 상태 확인
2. 변경된 섹션을 번역
3. 프론트매터 업데이트
4. 검증 재실행

### 문제 4: Git diff가 표시되지 않음

```
No diff available - one or both files do not exist.
```

**해결 방법**:
- 두 파일 모두 존재하는지 확인
- 파일 경로가 올바른지 확인

---

## 팁과 모범 사례

### 1. 정기적인 확인

원본 README.md가 자주 업데이트되는 프로젝트의 경우:
- 주 1회 또는 중요한 변경 후 `translate-readme.ts` 실행
- Pull Request가 병합된 후 즉시 확인

### 2. 번역 품질 유지

- 변경된 섹션만 번역하지 말고 문맥을 고려하여 전체 문서 검토
- 기술 용어의 일관성 유지 (용어집 참고)
- 원본의 의도와 뉘앙스를 정확히 전달

### 3. 협업 워크플로우

프로젝트에서 다른 번역자와 협업하는 경우:
- 번역 작업 중인 섹션을 이슈 또는 PR로 트래킹
- 번역 완료 후 PR을 생성하여 코드 리뷰 과정 거치
- 검증 스크립트 통과 후에만 병합

### 4. 다양한 파일 번역

README 외의 다른 문서도 동일한 방식으로 번역:

```bash
# CONTRIBUTING 가이드 번역
bun scripts/translate-readme.ts --from CONTRIBUTING.md --to CONTRIBUTING_ko.md

# ARCHITECTURE 문서 번역
bun scripts/translate-readme.ts --from docs/ARCHITECTURE.md --to docs/ARCHITECTURE_ko.md
```

---

## 고급 옵션

### 여러 파일 일괄 확인 (Shell Script)

```bash
#!/bin/bash
# check-all-translations.sh

for file in README.md CONTRIBUTING.md ARCHITECTURE.md; do
    if [ -f "$file" ]; then
        base="${file%.md}"
        ko="${base}_ko.md"
        echo "Checking: $file → $ko"
        bun scripts/translate-readme.ts --from "$file" --to "$ko"
        echo "---"
    fi
done
```

### 특정 디렉토리의 모든 마크다운 파일 번역 확인

```bash
#!/bin/bash
# check-docs-translations.sh

find docs -name "*.md" -not -name "*_ko.md" | while read -r file; do
    base="${file%.md}"
    ko="${base}_ko.md"
    echo "Checking: $file → $ko"
    bun scripts/translate-readme.ts --from "$file" --to "$ko"
    echo "---"
done
```

---

## 관련 스크립트

- **`verify-readme-sync.ts`**: README 파일 동기화 상태를 검증하고 pre-commit 훅에서 실행됨
- **`readme-lifecycle-audit.ts`**: 템플릿 디렉토리의 README.md/README_ko.md 쌍을 감사

---

## 도움말 명령어

도구 사용법이 기억나지 않는 경우:

```bash
bun scripts/translate-readme.ts --help
# 또는
bun scripts/translate-readme.ts -h
```

모든 옵션과 사용 예제가 표시됩니다.

---

## 용어집

| 용어 | 설명 |
|------|------|
| **Content Hash** | 파일 내용(본문)의 SHA-256 해시 값. 내용이 변경되면 해시도 변경됨 |
| **Frontmatter** | 마크다운 파일 상단의 `---`로 둘러싸인 메타데이터 섹션 |
| **Diff** | 두 파일 간의 차이점을 보여주는 형식화된 출력 |
| **Dry Run** | 파일을 실제로 수정하지 않고 결과만 미리보기하는 모드 |
| **Sync** | 원본과 번역본의 내용이 일치하는 상태 |

---

## 지원 및 피드백

이 도구 사용 중 문제가 발생하거나 개선 제안이 있으시면:

- **이슈 생성**: 프로젝트의 GitHub 이슈 트래커에 버그 리포트
- **개선 제안**: 기능 요청 또는 문서 개선 제안 환영
- **번역 질문**: 번역 관련 질문은 프로젝트 메인테이너에게 문의

---

*마지막 업데이트: 2026-05-30*
