# Meeting Transcript
**Date**: 2026-06-12
**Topic**: Unresolved issues follow-up — generateContextMd() placeholder hardcoding resolution, new-project.ts integration design, documentation priority
**Participants**: architect, auditor, docs-writer
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Context

Pre-meeting code inspection confirmed:
- `generateContextMd()` hardcodes `{{VERSION}}` → `'1.0'` (not using `metadata.version`)
- `generateContextMd()` hardcodes `{{PM_ROLE_DESCRIPTION}}` → `'Workflow management, dispatch, quality gates'`
- `VariantMetadata.version` is typed as literal `'0.1.0'` (MVP fixed)
- `new-project.ts` line 438 references `variantContextMd` path but only uses the statically copied file
- `generate-variant.ts` is 1020+ lines; direction is L2→L1 (variant promotion)
- `new-project.ts` direction is L1→L2 (project deployment)

---

## Transcript

### Round 1

**architect**: (Round 1)

The hardcoding issues are confirmed. Two specific problems: `{{VERSION}}` uses `'1.0'` instead of `metadata.version`; `{{PM_ROLE_DESCRIPTION}}` uses a generic string that should differ by variant. `VariantMetadata.version` is typed as `'0.1.0'` literal — and `generateContextMd()` ignores it entirely, using `'1.0'`.

The key architectural question: `generate-variant.ts` is designed for L2→L1 promotion direction; `new-project.ts` is L1→L2 deployment direction. Sharing `generateContextMd()` across these two directions risks blurring responsibility boundaries of each file.

Proposals: (1) Add `pmRoleDescription?: string` parameter to `generateContextMd()`. (2) Fix `{{VERSION}}` to use `metadata.version`. (3) Call `generateContextMd()` from `new-project.ts` after static copy.

---

**docs-writer**: (Round 1)

The directional asymmetry architect raises is the key issue. `generate-variant.ts` promotes L2→L1; `new-project.ts` deploys L1→L2. `generateContextMd()` is designed for the promotion direction. Reusing it in deployment blurs function responsibility.

Alternative: redefine `generateContextMd()` as a pure utility — "read template + substitute placeholders + write file" — that works in both directions. The direction is determined by the call context, not the function itself.

On documentation priority: A-03 (CONSTITUTION.md role clarification) is the foundational document. A-01 (script integration) and A-03 should proceed in parallel so design docs and implementation stay synchronized. Implementing A-01 first repeats the pattern of code running ahead of documentation.

---

**auditor**: (Round 1)

Two decision points emerge:

**Decision Point 1**: Share `generateContextMd()` as common utility, or create separate function in `new-project.ts`?
- Shared utility: DRY, single change point. Risk: `generate-variant.ts` (L2→L1 tool) contains deployment direction code — violates single responsibility.
- Separate function: minimal duplication, clear boundaries.
- Third option: extract common utility to `scripts/helpers/template-utils.ts`; both files import it.

**Decision Point 2**: `{{PM_ROLE_DESCRIPTION}}` resolution.
- Dynamic read from pm.md: technically correct but over-engineering for a rarely-changed value.
- Variant-keyed map in `new-project.ts`: simpler, maintainable.
- `{{VERSION}}`: straightforward fix — use `metadata.version`.

Most realistic near-term approach: add optional `overrides: { version?: string; pmRoleDescription?: string }` to `generateContextMd()`. This allows `new-project.ts` to pass variant-specific values without breaking existing `l2-to-variant-pipeline.ts` calls.

---

### Round 2

**architect**: (Round 2)

Supporting the `template-utils.ts` extraction (auditor's third option). `generate-variant.ts` is already 1020+ lines; adding deployment-direction logic will grow the file further and blur its role boundary.

Proposed `scripts/helpers/template-utils.ts`:
```typescript
export function applyContextTemplate(
  templatePath: string,
  outputPath: string,
  substitutions: {
    variantName: string;
    version: string;
    pmRoleDescription: string;
  }
): string
```

`generateContextMd()` becomes a thin wrapper calling `applyContextTemplate()`.
`new-project.ts` imports `applyContextTemplate()` directly.

For `{{PM_ROLE_DESCRIPTION}}`: variant-keyed map in `new-project.ts`:
```typescript
const PM_ROLE_DESCRIPTIONS: Record<string, string> = {
  'co-develop': 'Workflow management, task dispatch, quality gates',
  'co-consult': 'Engagement orchestration, client interface, final decisions',
  'co-security': 'Security governance, threat modeling, compliance review',
  'co-design': 'Design process management, creative direction, quality review',
  'co-work': 'Content workflow management, editorial oversight, quality gates',
};
```
Dynamic pm.md parsing is over-engineering — these values are variant-stable.

---

**docs-writer**: (Round 2)

Agree on `template-utils.ts` separation. Documentation note: need to verify where `{{PM_ROLE_DESCRIPTION}}` is actually used in `variant.context.template.md`. If it only appears in the header/description section, the per-variant distinction may not matter much in practice.

On documentation scope: A-02 + A-03 combined is small — one section (~20 lines) in `07-new-project.md` plus 2-3 sentences in `CONSTITUTION.md`. PM can write directly without specialist dispatch. A-04 (Agents table comment, 5 files, 1 line each) can also be done inline.

---

**auditor**: (Synthesis)

All unresolved issues from the previous meeting are now resolved.

**Agreed Conclusions**:
1. **`generateContextMd()` refactor**: Extract `applyContextTemplate()` to `scripts/helpers/template-utils.ts`. Both `generate-variant.ts` and `new-project.ts` import it. `generateContextMd()` becomes a wrapper.
2. **`{{VERSION}}` fix**: Use `metadata.version` — immediate fix.
3. **`{{PM_ROLE_DESCRIPTION}}` fix**: Variant-keyed map in `new-project.ts`. Dynamic pm.md parsing rejected as over-engineering.
4. **`new-project.ts` integration**: Call `applyContextTemplate()` after static context.md copy, overwriting with dynamically generated version.
5. **Documentation (A-02, A-03, A-04)**: PM-writable scope, no specialist needed.

**Platform Parity**: `template-utils.ts` is L0-only (common utility). `new-project.ts` modification requires L0+L1 sync.

---

## Final Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-05 | automation-engineer | Low | Create `scripts/helpers/template-utils.ts` with `applyContextTemplate()` function | L0-only | 1st |
| A-01 | automation-engineer | Medium | Refactor `generateContextMd()` to delegate to `applyContextTemplate()` + fix `{{VERSION}}` hardcoding + integrate into `new-project.ts` with PM_ROLE_DESCRIPTIONS map + L1 sync | L0+L1 | 2nd |
| A-02 | docs-writer | Low | Add VARIANT-INJECT governance section to `docs/constitution/07-new-project.md` | L0-only | 2nd (parallel) |
| A-03 | docs-writer | Low | Add `context.md` vs `variant.context.template.md` role distinction to CONSTITUTION.md | L0-only | 2nd (parallel) |
| A-04 | docs-writer | Low | Add "context proximity" comment to Agents table header in all 5 variant context.md files | L0-only | 2nd (parallel) |
| N-1 | lifecycle-manager | Medium | Lifecycle Update (Version, Timestamp, SCRIPTS.md) | L0+L1 | End |
| N | auditor | Medium | Final QA Audit (`bun scripts/audit.ts`) | L0+L1 | End |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | `applyContextTemplate()` exists in `template-utils.ts` and imported by both callers | grep import |
| C-02 | `{{VERSION}}` hardcode `'1.0'` removed, uses `metadata.version` | code read |
| C-03 | L2 project context.md created by `new-project.ts` contains VARIANT-INJECT markers | create test project, verify |
| C-04 | `docs/constitution/07-new-project.md` contains VARIANT-INJECT section | grep |
| C-05 | `bun scripts/audit.ts` passes | exit 0 |
