---
name: translate
description: Translation helper for README and documentation files with diff preview and guidance
version: 1.0.0
owner: pm
tier:
  claude: medium
  antigravity: medium
  gemini-cli: medium
lifecycle:
  phase: production
  created: 2026-05-30
  last_updated: 2026-05-30
status: active
scope: common
metadata:
  type: process
  triggers:
    - translate
    - translation
    - localize
    - Korean translation
---

## Purpose

Provides translation helpers for README and documentation files with diff preview, synchronization checking, and translation guidance. 

**This is NOT an automatic translation tool** - it's a **helper tool** that assists translators in identifying changes and managing translation work systematically.

## Implementation

Calls the underlying script:
```bash
bun scripts/translate-readme.ts "$@"
```

## Usage

### Basic Command (README.md → README_ko.md)

```bash
/translate
```

Default values:
- Source file (`--from`): `README.md`
- Target file (`--to`): `README_ko.md`

### Translate Different Files

```bash
/translate CONTRIBUTING.md CONTRIBUTING_ko.md
```

### Preview Mode (Dry Run)

```bash
/translate --dry-run
```

Shows changes without modifying files.

### With Source/Target Flags

```bash
/translate --from README.md --to README_ko.md --dry-run
```

---

## Understanding Output

### 1. Hash Synchronization Status

```
✅ Files are already synchronized (hash: a1b2c3d4e5f6…).
   No translation updates needed.
```

If you see this message, your translation is up-to-date. No action needed.

```
⚠️  Warning: Content hashes are out of sync!
   Source content_hash:          a1b2c3d4e5f6…
   Target translated_from_hash:  9f8e7d6c5b4a…
```

If hashes don't match, the source file has changed and translation update is needed.

### 2. Change Detection Sections

```
Changes detected:

   ➕ New section: "Design Principles" (line 45)
   ✏️  Modified section: "Quick Start" (lines 20-35)
   🗑️  Deleted section: "Legacy Content" (line 100)
```

- **➕ New section**: New section added in source (translation needed)
- **✏️ Modified section**: Modified section (translation update needed)
- **🗑️  Deleted section**: Section deleted from source (should delete from translation)

### 3. Diff Preview

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

Shows Git-style diff:
- Lines starting with `-`: Content deleted from source
- Lines starting with `+`: Content added in source

### 4. Next Steps

```
Next steps:
   1. Review the changes above
   2. Update README_ko.md accordingly
   3. Update frontmatter in README_ko.md
   4. Verify: bun scripts/verify-readme-sync.ts --pre-commit
```

Provides actionable guidance for translators.

---

## Common Workflows

### Regular Translation Updates

1. **Check for changes**:
   ```bash
   /translate --dry-run
   ```

2. **Review changes**: Examine the diff preview

3. **Update translation**: Edit your translation file

4. **Update hashes**:
   ```bash
   bun scripts/verify-readme-sync.ts --update-hashes
   ```

### New Translation File Creation

If the target file doesn't exist yet:

1. **Copy source**:
   ```bash
   cp README.md README_ko.md
   ```

2. **Translate**: Edit README_ko.md

3. **Update hashes**:
   ```bash
   bun scripts/verify-readme-sync.ts --update-hashes
   ```

---

## Understanding Frontmatter

### content_hash (Source File)

```yaml
---
content_hash: a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef12
---
```

Computed from the file body (excluding frontmatter). Changes when content changes.

### translated_from_hash (Translation File)

```yaml
---
translated_from_hash: a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef12
---
```

Should match the source's `content_hash`. Indicates which version this translation is based on.

---

## Troubleshooting

### Source File Not Found

```
❌ Error: Source file not found: README.md
```

**Solution**: Check that the source file path is correct.

### Hash Mismatch After Update

```
⚠️  Warning: Content hashes are out of sync!
```

Even after updating the translation:

**Solution**: Update the `translated_from_hash` field:
```bash
bun scripts/verify-readme-sync.ts --update-hashes
```

### Verification Script Failure

```
❌ README sync check failed — commit blocked.
```

During git commit:

**Solution**: 
1. Update your translation
2. Update hashes
3. Commit again

---

## Tips and Best Practices

### Regular Checks

Run `/translate --dry-run` regularly to catch changes early.

### Quality Maintenance

- Review diff carefully before updating
- Maintain consistent terminology
- Keep technical meaning accurate

### Collaboration Workflow

1. English author updates README.md
2. Translator runs `/translate --dry-run`
3. Translator updates README_ko.md
4. Both run verification

---

## Advanced Usage

### Check Multiple Files

```bash
# Shell script example for multiple files
for file in README.md CONTRIBUTING.md; do
    /translate "$file" "ko/$file"
done
```

### Project-Level Files

```bash
/translate templates/common/README.md templates/common/README_ko.md
```

---

## Related Scripts

- **verify-readme-sync.ts**: Validates README synchronization
- **readme-lifecycle-audit.ts**: Audits README lifecycle state

---

## 한국어 설명 (Korean Documentation)

### 목적 (Purpose)

이 도구는 다음과 같은 상황에서 번역자를 지원합니다:

- **원본 README.md가 업데이트되었을 때**: 어떤 부분이 변경되었는지 확인
- **번역 파일 동기화 상태 확인**: 원본과 번역본의 내용이 일치하는지 검증
- **번역 가이드 제공**: 변경된 섹션을 명확히 표시하고 다음 단계 안내

### 기본 사용법 (Basic Usage)

**기본 명령어**:
```bash
/translate
```

기본값:
- 원본 파일: `README.md`
- 번역 파일: `README_ko.md`

**다른 파일 번역**:
```bash
/translate CONTRIBUTING.md CONTRIBUTING_ko.md
```

**미리보기 모드**:
```bash
/translate --dry-run
```

파일을 실제로 수정하지 않고 변경사항만 확인합니다.

### 일반적인 워크플로우 (Common Workflows)

**번역 업데이트**:
1. `/translate --dry-run`으로 변경사항 확인
2. Diff 미리보기 검토
3. 번역 파일 업데이트
4. `bun scripts/verify-readme-sync.ts --update-hashes` 실행

**새 번역 파일 생성**:
1. `cp README.md README_ko.md`
2. 번역 파일 편집
3. `bun scripts/verify-readme-sync.ts --update-hashes` 실행

### 문제 해결 (Troubleshooting)

**해시 불일치**:
```
⚠️  Warning: Content hashes are out of sync!
```

**해결책**:
```bash
bun scripts/verify-readme-sync.ts --update-hashes
```

### 팁과 모범 사례 (Tips and Best Practices)

- 정기적으로 `/translate --dry-run` 실행
- 용어 일관성 유지
- 기술적 의미 정확하게 전달