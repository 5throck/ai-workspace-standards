# Meeting Transcript
**Date**: 2026-05-28
**Topic**: Recurring Encoding Issue Resolution and README Auto-Update Mechanism Review
**Participants**: pm, architect, automation-engineer, security-expert, docs-writer, auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

### Facilitator Opening (PM)

Two agenda items:
1. **Encoding issues**: In this session, `§` in a commit message was written as `unknown-8bit` by `dev-sync.sh`'s auto-CHANGELOG insertion, blocking the pre-commit hook. PowerShell pipe corruption and CP949 issues have also recurred. Diagnose root cause and discuss structural fix.
2. **README auto-update**: `dev-sync.sh` only auto-generates `scripts/README.md`. `verify-readme-sync.ts` checks `sync_version` matching. Is this actually guaranteeing README synchronization?

---

### Round 1

**Architect**:

Root cause: `dev-sync.sh` CHANGELOG auto-insertion uses `perl -i -pe` with no encoding control:
```bash
perl -i -pe 'BEGIN{$m=shift; $d=shift}
  if (/^## \[Unreleased\]/) { $_ .= "\n### Added\n- **[$d]**: \Q$m\E\n" }
' "$MSG" "$TODAY" CHANGELOG.md
```
Under `LC_ALL=C`, `perl` reads files in byte mode. The `§` character (UTF-8: `0xC2 0xA7`) may be interpreted as `latin-1` byte `0xA7`, which `file --mime-encoding` reports as `unknown-8bit`.

Structural fix: replace `perl` with Python (explicit `encoding='utf-8'`) or move to `bun`/TypeScript. Python is already used in `upgrade-project.sh` for WORKSPACE-MANAGED marker replacement.

Question to AutomationEngineer: Does changing `LC_ALL=C` to `LC_ALL=C.UTF-8` break existing `grep`, `awk`, or `perl` patterns in `dev-sync.sh`?

---

**SecurityExpert**:

Agrees with Architect's root cause. `unknown-8bit` is also a security risk signal — encoding-ambiguous files can be misinterpreted by tools, polluting the trust chain in auto-committed files.

Current pre-commit check is **reactive** (detects after file is created). True fix is **proactive** encoding enforcement at creation time.

Proposed auto-fix in pre-commit hook: try `iconv` conversion on detection. But questioned whether `iconv` is reliable on Windows Git Bash.

Question to AutomationEngineer: Is `iconv` stable on Git Bash for Windows? Is `python3` more portable?

---

**AutomationEngineer**:

Answered Architect: `LC_ALL=C → en_US.UTF-8` changes `grep` regex behavior — `[a-z]` may match Unicode range in UTF-8 locale. Most `awk`/`sed` unaffected. `perl` requires `-CSD` flag for multi-byte. Recommend `LC_ALL=C.UTF-8` (lightweight) over full `en_US.UTF-8`.

Short-term fix for CHANGELOG insertion:
```bash
python3 -c "
import sys, re
msg, today, path = sys.argv[1], sys.argv[2], sys.argv[3]
content = open(path, encoding='utf-8').read()
replacement = f'\n### Added\n- **[{today}]**: {msg}\n'
content = re.sub(r'(## \[Unreleased\])', r'\1' + replacement, content, count=1)
open(path, 'w', encoding='utf-8').write(content)
" "$MSG" "$TODAY" CHANGELOG.md
```
`python3 sys.argv` avoids shell injection risk (no shell metacharacter expansion).

Answered SecurityExpert: `iconv` is **unreliable on Git Bash for Windows** (missing in some MSYS2 setups). `python3` is far more portable. Recommend detecting encoding with `python3`, then suggesting the fix command — not auto-correcting silently.

`dev-sync.ps1` already sets `$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8` — `.sh`/`.ps1` encoding parity is broken.

Question to DocsWriter: Is using `§` in commit messages (and thus CHANGELOG entries) compliant with CONSTITUTION.md §3 Conventional Commits?

---

**DocsWriter**:

Conventional Commits does not prohibit Unicode characters in message body. The problem is shell escaping during variable passing, not the character itself.

Pragmatic proposal: **disable CHANGELOG auto-insertion** in `dev-sync.sh` entirely and require manual `/changelog` entries only. CHANGELOG is a user-facing release document; auto-inserted commit messages are lower quality than hand-crafted entries.

README synchronization analysis:
1. `dev-sync.sh` auto-generates only `scripts/README.md`
2. `verify-readme-sync.ts` checks only that `sync_version` numbers match between `README.md` and `README_ko.md`
3. **Content can differ while `sync_version` is identical** — the check is a false guarantee
4. `templates/co-develop`: audit showed `[SKIP] No README files found` — missing README in a stable variant is a significant gap

Question to Architect: `sync_version` requires manual bumping with no enforcement — where should this policy be documented? Or should we replace the mechanism entirely?

---

### Round 2

**Architect**:

`sync_version` is an honor-system — no structural enforcement if nobody bumps it.

Recommended replacement: **Option A — Content Hash comparison**:
- Remove `sync_version` frontmatter
- `verify-readme-sync.ts` computes SHA-256 hash of section headers from `README.md`
- Compare against stored hash in `README_ko.md`'s frontmatter field `translated_from_hash`
- Hash mismatch = FAIL with actionable message

Option B (auto-translate) rejected: requires LLM calls, not suitable for CI.
Option C (hybrid with `sync_version`): retain version number but also add hash tracking.

Recommended: **Option A** — deterministic, pure TypeScript, no external tools.

Question to AutomationEngineer: Should `templates/co-develop/` have `README.md`/`README_ko.md`, or should generated projects create their own?

---

**SecurityExpert**:

Final encoding recommendations:

1. Add to top of `dev-sync.sh`:
```bash
export LC_ALL=C.UTF-8
export PYTHONIOENCODING=utf-8
```
2. Python `sys.argv` approach avoids shell injection — `\Q$m\E` quoting in `perl` is replaced by safe argument passing.
3. For README: Option A correct, but section-header-only hash misses content-only changes. Recommend full-file hash comparison with `content_hash` frontmatter in `README.md` and `translated_from_hash` in `README_ko.md`.

Question to DocsWriter: If CHANGELOG auto-insertion is removed, should `[Unreleased]` being empty block `dev-sync` with `exit 1`? Currently it only warns.

---

**AutomationEngineer**:

Answered Architect: `templates/co-develop/` having no README is a **design error**. Stable variants must have `README.md` + `README_ko.md`. `validate-templates.ts` Check 8 (Shared file sync) should catch this but currently doesn't check for README presence.

Implementation plan:
1. `dev-sync.sh`: add `LC_ALL=C.UTF-8` + `PYTHONIOENCODING=utf-8`, replace `perl` with `python3 sys.argv`, remove auto-insert, block with `exit 1` if `[Unreleased]` empty
2. `verify-readme-sync.ts`: replace `sync_version` with hash comparison
3. `validate-templates.ts`: add stable variant README existence check

---

**DocsWriter**:

Answered SecurityExpert: Support **exit 1 for empty `[Unreleased]`**. Without enforcement, CHANGELOG becomes effectively optional, making release notes impossible to reconstruct.

Preferred structure: remove auto-insert + enforce non-empty = users must run `/changelog` before `/sync`.

README hash approach: `README.md` stores `content_hash: <sha256>` frontmatter. `README_ko.md` stores `translated_from_hash: <sha256>`. On mismatch: "README.md has been updated — README_ko.md translation needs updating." Far more precise than `sync_version`.

---

## Action Items

| # | Owner | Deliverable | Priority |
|---|-------|-------------|----------|
| A-01 | AutomationEngineer | `dev-sync.sh`: add `LC_ALL=C.UTF-8` + `PYTHONIOENCODING=utf-8`; replace `perl` CHANGELOG insertion with `python3 sys.argv`; block with `exit 1` if `[Unreleased]` empty | High |
| A-02 | AutomationEngineer | `dev-sync.ps1`: remove CHANGELOG auto-insertion for policy parity (`.ps1` encoding is fine but consistency required) | High |
| A-03 | AutomationEngineer | `scripts/verify-readme-sync.ts`: replace `sync_version` with `content_hash`/`translated_from_hash` SHA-256 comparison | Medium |
| A-04 | AutomationEngineer | `scripts/validate-templates.ts`: add stable variant README.md + README_ko.md existence check | Medium |
| A-05 | DocsWriter + ScaffoldingExpert | `templates/co-develop/`: create `README.md` and `README_ko.md` with `content_hash`/`translated_from_hash` frontmatter | Medium |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | Commit message with `§` or other multibyte chars does not corrupt CHANGELOG | Run `dev-sync.sh "feat: §10 test"` and verify CHANGELOG UTF-8 clean |
| C-02 | `dev-sync.sh` blocks with `exit 1` when `[Unreleased]` has no bullet items | Run with empty `[Unreleased]` and confirm non-zero exit |
| C-03 | `verify-readme-sync.ts` detects content mismatch even when version numbers match | Manually change README.md content without updating hash, run verifier |
| C-04 | `validate-templates.ts` fails when stable variant has no README | Remove co-develop README and run validator |
| C-05 | `templates/co-develop/` has both README.md and README_ko.md | `ls templates/co-develop/README*.md` shows 2 files |
