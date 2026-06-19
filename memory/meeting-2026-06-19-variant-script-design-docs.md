# Meeting Transcript
**Date**: 2026-06-19
**Topic**: Variant-specific script design — documentation gaps and ADR-0033 divergence
**Participants**: architect, automation-engineer, docs-writer, auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Context

Following the co-deck Python→TypeScript conversion and deployment fix (PR #279), a review revealed
that variant-specific script design is not properly reflected in formal documentation. Four gaps
were identified before the meeting:

1. ADR-0033 proposes `scripts/local/` but implementation uses `scripts/co-deck/`
2. `docs/creating-a-variant.md` has no script step
3. `docs/constitution/06.5-script-lifecycle.md` has no L2 variant section
4. `docs/constitution/07-new-project.md` missing WORKSPACE_ONLY_FILES and package.json deployment docs

---

## Transcript

**[architect]**: (Round 1)

ADR-0033's design intent is correct but implementation diverged. ADR-0033 proposes `scripts/local/<script>.ts`
while co-deck uses `scripts/co-deck/<script>.ts`. Both patterns bypass the L1 audit's non-recursive readdirSync
scan, but the naming convention differs. Preference: `scripts/local/` is more universal — does not couple to
variant name, stable if variant is renamed. Question to docs-writer: which path convention is easier to document?

**[automation-engineer]**: (Round 1)

Agrees on the divergence. However, emphasizes the package.json deployment mechanism gap as higher risk:
WORKSPACE_ONLY_FILES deleting L1 package.json before variant overlay, merge-package-scripts.ts injecting
audit/dev-sync/sync-md — none of this is in 07-new-project.md. Prefers `scripts/<variant>/` over `scripts/local/`
for explicitness — `scripts/local/` loses context about which variant the scripts belong to. Question to auditor:
where should the non-recursive scan constraint be documented?

**[docs-writer]**: (Round 1)

Categorizes gaps into structural (ADR-0033/path convention) vs operational (WORKSPACE_ONLY_FILES, package.json).
Notes that creating-a-variant.md has no script step at all — a complete blind spot for users. Supports
`scripts/local/` for documentation consistency but acknowledges that updating ADR-0033 to match reality
(scripts/<variant>/) is more pragmatic.

**[auditor]**: (Round 1)

Flags ADR-0033 status inconsistency: frontmatter says `status: "Accepted"` but body says `## Status: Proposed`.
Immediate governance violation, fix required regardless of implementation debate. Recommends a dedicated
"Audit Constraints" section in 06.5-script-lifecycle.md to document non-recursive scan as intentional design —
if someone changes it to recursive, the entire variant-scripts-in-subdirectory pattern breaks. Agrees with
automation-engineer: `scripts/<variant>/` is better from audit traceability perspective.

**[architect]**: (Round 2)

Persuaded by auditor's argument for `scripts/<variant>/`. Final design proposal: `scripts/<variant>/` is canonical,
`external/` subdirectory deferred to Phase 2, `variant.json` script_manifest marked as "Proposed future extension".
ADR-0033 should be revised accordingly.

**[automation-engineer]**: (Round 2)

Agrees. Prioritizes: immediate (deployment safety) — 07-new-project.md WORKSPACE_ONLY_FILES + 06.5 L2 variant section.
Later — ADR-0033 revision, creating-a-variant.md step, CONSTITUTION hub update.

**[docs-writer]**: (Round 2)

Agrees on priority split. Adds: creating-a-variant.md checklist needs optional script items:
`(optional) Variant scripts in scripts/<variant>/` and `(optional) variant.json declares script_manifest`.
Optional because not all variants need custom scripts.

---

## Synthesis (auditor)

**Points of Agreement**:
- `scripts/<variant>/` is canonical — ADR-0033 to be revised accordingly
- ADR-0033 status inconsistency (frontmatter vs body) requires immediate fix
- `external/` subdirectory deferred to Phase 2
- Non-recursive scan in verifyScriptRegistryConsistency() is intentional design constraint — must be documented

**Open Questions**:
- `variant.json` script_manifest: defer to Phase 2 or add immediately to co-deck? Decision pending.

---

## Action Items

| # | Owner | Tier | Deliverable | Platform | Priority |
|---|-------|------|-------------|----------|----------|
| A-01 | automation-engineer | Medium | Add WORKSPACE_ONLY_FILES + variant package.json deployment to `docs/constitution/07-new-project.md` | Both | Immediate |
| A-02 | automation-engineer | Medium | Add "Variant-Specific Scripts (L2)" section to `docs/constitution/06.5-script-lifecycle.md` (subdirectory rule + non-recursive scan constraint) | Both | Immediate |
| A-03 | architect | Medium | Revise `docs/adr/0033-variant-specific-skills-scripts-blueprint.md` — `scripts/local/` → `scripts/<variant>/`, defer external, fix status inconsistency | L0-only | Immediate |
| A-04 | docs-writer | Low | Add variant script step to `docs/creating-a-variant.md` + optional checklist items | Both | Later |
| A-05 | pm | Low | Update `CONSTITUTION.md §6.5` hub entry | Both | Later |

---

## Follow-up Discussion: variant.json script_manifest (Round 2 meeting)

**Date**: 2026-06-19
**Participants**: architect, automation-engineer, auditor
**Topic**: Whether to implement script_manifest in variant.json now or defer to Phase 2

### Key Principle Established
*A declaration must always be introduced together with validation. A declaration without validation is technical debt.*

### Decision
Implement script_manifest NOW, but in minimal form:
- `script_manifest.local[]` with path references only (no source_url, version_tag, etc.)
- `validate-templates.ts` path-existence check added simultaneously
- `external` array + ingestion automation deferred to Phase 2
- ADR-0033 to explicitly mark Phase 2 scope

### Additional Action Items

| # | Owner | Tier | Deliverable | Platform | Priority |
|---|-------|------|-------------|----------|----------|
| A-06 | automation-engineer | Low | Add `script_manifest.local` minimal declaration to `templates/co-deck/variant.json` | L0-only | Immediate |
| A-07 | automation-engineer | Low | Add `script_manifest.local[].path` existence check to `scripts/validate-templates.ts` | L0-only | Immediate |
