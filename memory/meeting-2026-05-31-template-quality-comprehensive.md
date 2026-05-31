# Meeting Transcript
**Date**: 2026-05-31
**Topic**: New Project Template Quality Comprehensive Review — Missing Scripts, Dependencies, and Documentation Defects (3rd Meeting)
**Participants**: architect, auditor, automation-engineer, lifecycle-manager
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete
**Series**: Third template quality meeting (extends meeting-2026-05-31-template-script-check-b-fix.md + new errors from co-security project)

---

## New Errors Reported (co-security project dev-sync failure)

1. agents/pm.md — Required Tools section missing (triggers audit FAIL)
2. Missing 'glob' package — validate-md-language.ts depends on external glob, not in project
3. Korean-only markdown files — README_ko.md flagged as violation
4. Stale shell reference — README.md:27 references scripts/new-project.sh which doesn't exist in generated project
5. Skill audit issues — details TBD

---

## Root Cause Analysis

| Error | Root Cause |
|-------|-----------|
| 1. Required Tools FAIL | New audit check (added today) immediately applies to existing generated projects that haven't been migrated |
| 2. glob missing | validate-md-language.ts uses external glob package; workspace root has it in package.json but templates/common has no package.json |
| 3. Korean README FAIL | README_ko.md intentionally Korean but audit has no *_ko.md exception |
| 4. Stale shell ref | co-security README.md references workspace-root-level new-project.sh; generated projects have no scripts/ directory |
| 5. Skill audit | Requires separate investigation |

---

## Transcript

**[Architect]**: (Round 1)

Classified 5 errors into two tracks: pre-existing template bugs vs. new audit check collision with existing projects. Error 1 (Required Tools): co-security is an existing project that predates today's Required Tools section addition. The new audit check (A-04) now flags it immediately. Error 2 (glob): same pattern as sync-md.ts missing — validate-md-language.ts is deployed to templates/common but its dependency (glob) is not. Workspace root package.json has glob, templates/common has no package.json. Error 3 (Korean README): README_ko.md is intentional but validate-md-language.ts has no *_ko.md exclusion. Error 4 (stale shell ref): co-security README.md:27 says "bash scripts/new-project.sh" but generated projects have no scripts/ directory. This is a template documentation bug. Asked automation-engineer about glob dependency resolution approaches.

**[Automation Engineer]**: (Round 1)

Two approaches for glob: (A) create templates/common/package.json with glob, or (B) replace glob with Bun.Glob built-in API (no external package needed). Recommended B — Bun.Glob.scan() is fully supported and eliminates the external dependency entirely. Also: Error 1 (Required Tools) context — co-security is an existing project, not a newly generated one. New projects from today's templates would have the Required Tools sections. This is a migration problem: new audit checks should declare their scope (workspace root vs generated projects) explicitly. IS_WORKSPACE_ROOT flag already exists in audit.ts; Required Tools check should be gated on it.

**[Lifecycle Manager]**: (Round 1)

Confirmed: the failure is in an existing co-security project, not a newly generated one. This reveals a structural gap: no migration guide exists for when new audit checks are added. When a check is added, all existing projects immediately fail — users may be blocked unexpectedly. Proposed migration checklist for new check additions: (1) decide whether to apply to existing generated projects immediately; (2) declare scope via IS_WORKSPACE_ROOT/variant.json; (3) document migration steps. Error 3 (Korean README) and Error 4 (stale ref) are pure template bugs — straightforward to fix. Asked auditor about managing backward compatibility for new audit checks.

**[Auditor]**: (Round 1)

Current audit.ts has no versioning or scope metadata per check. Proposed check-level scope metadata as a long-term solution, but immediate pragmatic fix: gate Required Tools check on IS_WORKSPACE_ROOT. Generated projects identified by variant.json presence. This stops the immediate breakage. Five errors fall into two categories: template bugs requiring immediate fix (errors 2, 3, 4) and design decisions (errors 1, 5). Error 5 (skill audit) needs separate investigation.

**[Architect]**: (Round 2)

Finalized three-layer solution structure: Layer 1 (immediate hotfix PR) = errors 1-4 fixes. Layer 2 (audit architecture) = IS_WORKSPACE_ROOT scoping for Required Tools, migration checklist documentation. Layer 3 (previous meeting agenda) = sync-md.ts/verify-readme-sync.ts copy, SCRIPTS.md reclassification, Check B/X improvements, smoke test. All previous meeting items (A-01 through A-04) remain valid and are batched into a separate scripts-PR.

**[Automation Engineer]**: (Round 2)

validate-md-language.ts Bun.Glob replacement is straightforward. *_ko.md exclusion pattern: `const EXCLUDED_PATTERNS = [/README_ko\.md$/, /\/ko\//, /\/locales\/ko\//]`. Error 4 (stale shell ref): co-security README.md Quick Start section should be rewritten — scaffolded projects don't run new-project.sh, they ARE the output of new-project.sh. The README should describe how to USE the project, not how to CREATE it.

---

## Decisions

1. `glob` → `Bun.Glob` built-in (no package.json needed)
2. Required Tools check scoped to workspace root only (IS_WORKSPACE_ROOT)
3. *_ko.md exception added to validate-md-language.ts
4. co-security README.md Quick Start rewritten
5. Migration checklist for new audit checks (to be added as governance doc)

## Action Items

| # | Owner | Tier | Deliverable | PR |
|---|-------|------|-------------|----|
| B-01 | automation-engineer | High | `validate-md-language.ts`: replace glob with Bun.Glob + add *_ko.md exclusion; sync to templates/common/scripts/ | hotfix-PR |
| B-02 | automation-engineer | High | `audit.ts`: gate Required Tools check on IS_WORKSPACE_ROOT; sync to templates/common/scripts/audit.ts | hotfix-PR |
| B-03 | docs-writer | Medium | `templates/co-security/README.md:27` rewrite Quick Start — remove workspace-root new-project.sh reference | hotfix-PR |
| B-04 | auditor | Low | Skill audit issues investigation and fix | hotfix-PR or next |
| A-01 | automation-engineer | High | `sync-md.ts` + `verify-readme-sync.ts` → templates/common/scripts/; SCRIPTS.md entries added | scripts-PR |
| A-02 | lifecycle-manager | Medium | SCRIPTS.md layer reclassification: remove intentional, add L0-only/L1-only/common enum | scripts-PR |
| A-03 | automation-engineer | Medium | lifecycle-sync-audit.ts: Check B layer branching + file existence check + Check X (L0-only ref scan) | scripts-PR |
| A-04 | automation-engineer | Low | test-new-project.ts smoke test: dev-sync.ts success verification | scripts-PR |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | Existing co-security project audit passes after hotfix | bun scripts/audit.ts in co-security project |
| C-02 | validate-md-language.ts uses Bun.Glob (no glob import) | grep "from 'glob'" → no matches |
| C-03 | README_ko.md not flagged by language validation | run validate-md-language.ts |
| C-04 | co-security README.md:27 does not reference scripts/new-project.sh | grep check |
| C-05 | Required Tools check skipped in generated projects (variant.json present) | run audit in new project |
| C-06 | New project /sync completes without error (after A-01) | create new project, run dev-sync.ts |
| C-07 | bun scripts/audit.ts passes at workspace root | run audit |
