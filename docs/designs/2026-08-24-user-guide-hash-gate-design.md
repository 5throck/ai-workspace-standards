# User-Guide translated_from_hash Gate Design

**Design ID**: 2026-08-24-user-guide-hash-gate-design
**Status**: Implemented (PR8 WARN stage → PR10 FAIL stage)
**PR**: #8 of 10-PR owner-approved series (promotion in the PR10 follow-up)
**Author**: automation-engineer (per PM-approved plan)
**Created**: 2026-08-24
**Promoted**: 2026-08-24 — `verify-readme-sync.ts` v1.4.0 (PR10): WARN → FAIL per ADR-0055 playbook. Soak evidence: zero warnings observed from PR #646 seeding through #647.

---

## Problem Statement

The workspace has 10 variants with bilingual user-guide documentation (`docs/user-guide.md` + `docs/user-guide_ko.md`). No automated mechanism existed to detect when the EN guide changes but the KO translation is not updated, leading to documentation drift.

**Key Requirements**:
- Detect stale translations across all 10 variants
- Follow ADR-0055 WARN-first playbook (WARN → error promotion after soak)
- Reuse existing hash-based synchronization infrastructure from `verify-readme-sync.ts`
- Support seeding of missing hashes via `--update-hashes`
- Preserve file encoding (UTF-8-no-BOM) and line endings (CRLF/LF)

---

## What Was Built

### 1. Static Audit (WARN Stage)

**File**: `scripts/verify-readme-sync.ts` (version 1.2.0 → 1.3.0)

**New Function**: `runUserGuideHashAudit()`

**Behavior**:
- Scans all 10 `templates/co-*/docs/user-guide*.md` pairs
- For each pair:
  - Reads `translated_from_hash` from KO guide's YAML frontmatter
  - Computes current EN guide hash (SHA-256 of body after stripping frontmatter)
  - Compares values and reports:
    - **WARN** (not error): Hash missing → "user-guide pair missing translated_from_hash (run with --update-hashes to seed)"
    - **WARN** (not error): Hash stale → "user-guide_ko.md translated_from_hash is stale — EN guide changed since translation"
    - **PASS**: Hashes synchronized
- **Exit code**: WARNs do NOT affect process exit code (per ADR-0055 playbook)

**Console Output Format**:
```
=== User-guide translated_from_hash (WARN stage) ===
[PASS] templates/co-design: user-guide hashes synchronized (a1b2c3d4e5f6...)
[WARN] templates/co-develop: user-guide pair missing translated_from_hash (run with --update-hashes to seed)
[WARN] templates/co-security: user-guide_ko.md translated_from_hash is stale — EN guide changed since translation
        user-guide.md current hash:          f6e5d4c3b2a1...
        user-guide_ko.md translated_from_hash: a1b2c3d4e5f6...

User-guide hash audit: 8 passed, 2 warnings (WARN stage — does not affect exit code)
```

### 2. Hash Seeding & Update

**New Function**: `updateUserGuideHash(variantDir: string)`

**Behavior** (via `--update-hashes` flag):
- Computes current EN guide hash
- Writes/updates `translated_from_hash` in KO guide's frontmatter:
  - If frontmatter exists: replaces existing `translated_from_hash` line or inserts it before closing `---`
  - If no frontmatter: creates minimal frontmatter block with only this key
- **Idempotent**: Re-running with unchanged EN content produces no file modification
- **Encoding Preservation**: Detects and preserves original CRLF/LF line endings
- **Scope**: Only modifies `user-guide_ko.md`; never touches EN guides or README files

### 3. Key Implementation Details

**Hashing Convention**:
- Reuses `computeContentHash()` helper (already used for README.md pairs)
- SHA-256 of file body after stripping YAML frontmatter
- Body-drift detection: recomputed hash vs. stored hash must match (prevents silent stale-hash bug)

**Frontmatter Format**:
```yaml
---
translated_from_hash: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
---
```

**Key Name Choice**: `translated_from_hash` (matches README_ko.md convention)

### 4. Fixture Tests

**File**: `tests/user-guide-hash.test.ts` (new)

**Coverage**:
1. ✅ Missing hash → WARN in static audit output
2. ✅ Stale hash → WARN with hash comparison display
3. ✅ `--update-hashes` writes/refreshes correctly and is idempotent
4. ✅ WARN does not flip exit code (even with multiple warnings)
5. ✅ User-guide audit section appears in static output

**Approach**: Temp-dir fixtures (co-test*, co-warn*) — created at test runtime, cleaned up after

---

## Verification

| Command | Expected Result |
|---------|-----------------|
| `bun test tests/user-guide-hash.test.ts` | ✅ All tests pass |
| `bun scripts/verify-readme-sync.ts` | ✅ Static audit runs clean (or shows WARNs for unseeded variants) |
| `bun scripts/verify-readme-sync.ts --update-hashes` | ✅ Seeds hashes in all 10 user-guide_ko.md files |
| `git diff` (after --update-hashes) | ✅ Only shows 10 user-guide_ko.md frontmatter additions |
| `bun scripts/verify-readme-sync.ts` (re-run) | ✅ All 10 pairs now PASS |
| `bun scripts/verify-scripts.ts --check-drift` | ✅ L0 ↔ L1 pair in sync (scripts/verify-readme-sync.ts vs templates/common/scripts/verify-readme-sync.ts) |
| `bun scripts/audit.ts` | ✅ All gates pass |
| `bun scripts/validate-templates.ts` | ✅ 0 errors |
| `bun scripts/verify-adr-governance.ts --strict` | ✅ Exit 0 |
| `bun scripts/validate-md-language.ts` | ✅ Exit 0 |

---

## Follow-Ups

### 1. Error Promotion (Completed — PR10, 2026-08-24)

**Timeline**: Completed after WARN soak through PR #647 (zero warnings observed)

**Implementation**: Promoted WARN to FAIL in `runUserGuideHashAudit()` (v1.4.0):
- Function now returns `Promise<number>` with failure count
- Console output changed from `[WARN]` to `[FAIL]` (red `\x1b[31m`)
- Failures increment `totalErrors` and affect exit code
- Summary line updated to reflect FAIL stage per ADR-0055

**Evidence**: Since the gate seeded all 11 variant pairs in PR #646, the audit reported "11 passed, 0 warnings" through PR #647, meeting the ADR-0055 WARN-first soak condition.

**Changes made**:
1. `scripts/verify-readme-sync.ts` v1.3.0 → v1.4.0: Promoted to FAIL stage
2. `tests/user-guide-hash.test.ts`: Updated tests to expect FAIL behavior (exit code 1 on failures)
3. `scripts/SCRIPTS.md`: Updated version and documentation for FAIL stage
4. `.gitignore`: Added `.claude/plans/` for session-local plan artifacts

### 2. Guide Body Generation (Out of Scope)

**Decision**: User-guide body content generation stays **manual** (not automated).

**Rationale**:
- User guides contain legal/compliance text in some variants
- High risk of hallucination or misrepresentation with AI generation
- Human translation review required for accuracy

**Automation Scope**: Hash synchronization only (detects drift, not generate content)

---

## References

- **ADR-0055**: Governance Validators (WARN-first playbook)
- **verify-readme-sync.ts**: README.md hash synchronization infrastructure (reused)
- **scripts/SCRIPTS.md**: Version registry (1.3.0 WARN stage → 1.4.0 FAIL stage)
- **docs/specs/registry.json**: Design spec entry (2026-08-24-user-guide-hash-gate-design)
