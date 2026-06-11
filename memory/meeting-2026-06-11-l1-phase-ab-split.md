# Meeting Transcript
**Date**: 2026-06-11
**Topic**: L1 Phase A/B Split — Variant Pre-Resolution and new-project Simplification
**Participants**: architect, automation-engineer, auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

### Round 1

**architect**: (Round 1)

The current architecture has a latent issue: `templates/co-*/agents/pm.md` files contain only YAML skeleton (`extends:` + `variant:` fields). The actual pm.md content is assembled at runtime by `merge-frontmatter.ts` during `new-project.sh`. This means the audit gate sees an incomplete skeleton, not the real deployed content.

If we split L1 into A and B phases, we can pre-resolve all `extends:` references at build time. L1-A remains the existing `publish-to-template.ts --governance-l1`. L1-B becomes a new `resolve-variants.ts` script that processes each `templates/co-*/` directory and writes fully-merged files in-place.

The key design question is: how does the L1-B phase get triggered? My recommendation is a separate script invoked explicitly by the maintainer — simpler than modifying `publish-to-template.ts`, and clearly separated from L1-A.

**automation-engineer**: (Round 1)

From an implementation perspective, the separate-script approach is the right call. I'd reuse the existing `readUTF8File` / `writeUTF8File` helpers from `scripts/lib/encoding-utils.ts` and the frontmatter parsing logic already in `merge-frontmatter.ts`.

The idempotency design via `# @resolved-from:` header is elegant — a single grep check at the top of each file tells us whether it's already resolved. The `--force` flag can override for re-resolution after upstream pm.md changes.

For `variant.json`, we can scan `agents/` and `skills/` directories in each variant and populate the `agents[]` and `skills[]` arrays automatically — no more empty arrays in variant.json.

**auditor**: (Round 1)

Two audit implications to flag. First, the current `audit.ts` check for L2 pm.md uses three conditions: `variant_overrides:`, `extends:`, or `<!-- VARIANT-SECTION: governance-workflow -->`. After L1-B resolves files, none of these will be present in the resolved output. We need to add a fourth condition: `# @resolved-from:` header recognition.

Second, the line-count check (< 200 lines) for L2 pm.md must still hold. Resolved files inheriting the full L1 pm.md content may approach this limit — we should verify the L1 source stays under the limit.

---

### Round 2

**architect**: (Round 2)

Responding to the auditor's line-count concern: the L1 pm.md is currently around 140 lines including the extended L0 content. The merge adds variant-specific frontmatter fields (typically 3-5 lines). Total is well under 200. This remains a valid guard against accidental L0 content duplication.

On trigger mechanism: the user confirmed "별도 스크립트" (separate script). The pipeline becomes: L1-A (`publish-to-template.ts --governance-l1`) → L1-B (`resolve-variants.ts`) → `new-project.sh` (pure copy). This is documented in SCRIPTS.md and enforced by audit.

**automation-engineer**: (Round 2)

Confirming the `new-project.sh` simplification scope: remove lines 306-378 (the `extends:` detection loop, `merge-frontmatter.ts` call, and post-copy verification block). Replace with a simple `find $TEMPLATES_DIR -type f | while read` loop that just copies every file. Same change in `new-project.ps1`.

One edge case: what if someone runs `new-project` before running `resolve-variants.ts`? The pm.md will be copied as an unresolved skeleton. We should add a WARN in `audit.ts` for projects that contain `extends:` in pm.md without `@resolved-from:`.

**auditor**: (Round 2)

The edge case is real but acceptable. The pre-commit gate catches this via `bun scripts/audit.ts` — if a project's pm.md has `extends:` without `@resolved-from:`, the audit check at line ~620 will now FAIL (since neither `extends:` nor `@resolved-from:` satisfies the resolved condition, and `VARIANT-SECTION` won't be present either). This is the correct behavior — the template maintainer must run `resolve-variants.ts` before committing.

Synthesis complete: the design is sound. Proceed with implementation.

---

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-01 | automation-engineer | Low | Create `scripts/resolve-variants.ts` v1.0.0 | L0-only | L1-B |
| A-02 | automation-engineer | Low | Update `scripts/audit.ts` — add `isResolved` check for `@resolved-from:` | L0-only | L1-B |
| A-03 | automation-engineer | Low | Simplify `new-project.sh` — remove extends loop, replace with pure cp | L0-only | L1-B |
| A-04 | automation-engineer | Low | Simplify `new-project.ps1` — same as A-03 | L0-only | L1-B |
| A-05 | automation-engineer | Low | Update `scripts/SCRIPTS.md` — add `resolve-variants.ts` entry | L0-only | L1-B |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | `bun scripts/resolve-variants.ts` exits 0, writes `@resolved-from:` header to all 5 variant pm.md files | `grep "@resolved-from" templates/co-*/agents/pm.md` |
| 2 | `bun scripts/audit.ts` passes with 0 failures after resolution | `bun scripts/audit.ts` exit code 0 |
| 3 | `new-project.sh` no longer calls `merge-frontmatter.ts` | `grep merge-frontmatter scripts/new-project.sh` returns empty |
| 4 | `resolve-variants.ts` is idempotent — second run reports "already resolved — skip" | Run twice, verify no duplicate writes |
