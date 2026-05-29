# Meeting Transcript
**Date**: 2026-05-29
**Topic**: Root cause analysis of CLAUDE.md/GEMINI.md duplication and CONSTITUTION.md existence in templates/common/
**Participants**: pm, architect, auditor, automation-engineer
**Rounds**: 2
**Orchestrator**: PM
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Problem Statement

1. `templates/common/CLAUDE.md` and `GEMINI.md` contain workspace-root content (referencing `C:\git\`) instead of project-level base content. Each variant folder also has its own CLAUDE.md/GEMINI.md — duplication across two layers.
2. `templates/common/CONSTITUTION.md` exists, but CONSTITUTION.md is a workspace governance document that must never be copied into L2 projects. Git log shows it was first added in commit `813398f` and has been updated repeatedly since.

---

## Transcript

### Round 1 — Root Cause Diagnosis

**PM**: (Opening)

Two contamination problems to diagnose. Agenda 1 (Round 1): root cause. Agenda 2 (Round 2): fix and prevention.

---

**Architect**: (Round 1)

Design principle: `templates/common/` stores files copied verbatim into new projects by `new-project.sh`. Variant folders overlay on top.

CLAUDE.md/GEMINI.md contamination: commit `581b805` (PM gateway policy addition) updated L0 CLAUDE.md and also synchronized `templates/common/CLAUDE.md` — but copied workspace-root content without review. The variant CLAUDE.md files are correct ("individual projects" content); only `templates/common/CLAUDE.md` is contaminated. Because new-project.sh overlays variant/ on top of common/, the variant CLAUDE.md correctly replaces it in practice — but common/CLAUDE.md itself is a time bomb for any future variant that doesn't include its own CLAUDE.md.

CONSTITUTION.md existence: first added in `813398f`, then updated every time L0 CONSTITUTION.md changed. Likely added with intent to "let projects reference workspace standards" but this is wrong design — CONSTITUTION.md is a workspace SSOT and must not be file-copied into projects.

---

**Auditor**: (Round 1)

Actual impact:
1. CONSTITUTION.md in common/: new-project.sh copies it to every new project. Content references workspace paths (C:\git\) — broken references in L2 projects.
2. CLAUDE.md/GEMINI.md contamination: currently masked by variant overlay. But future variants without their own CLAUDE.md would receive workspace-root content.

Why validate-templates.ts missed this: it validates "required files exist" (VARIANT_CONTRACT), not "file content is correct" or "forbidden files are absent." No blocklist validation exists.

Additional finding: both CONSTITUTION.md and CLAUDE.md contamination follow the same pattern — agents performing "L1 sync" operations copied L0 content without reviewing whether it was appropriate for the template layer.

---

**Automation-engineer**: (Round 1)

publish-to-template.ts only copies scripts/ and skills/ — not CLAUDE.md, GEMINI.md, or CONSTITUTION.md. So these were contaminated by direct agent writes during "L1 sync" operations, not by the publish pipeline.

Core missing guard: no explicit rule defining which files are allowed or forbidden in `templates/common/`. Without this constraint, agents have wide discretion when performing L1 sync tasks, leading to contamination.

---

**PM**: (Round 1 — Close)

Root cause confirmed: no blocklist policy for templates/common/ + no validate-templates.ts enforcement = agents freely contaminating template files during L1 sync operations.

---

### Round 2 — Fix and Prevention

**Automation-engineer**: (Round 2)

Three fixes:
1. CONSTITUTION.md deletion: immediate, no side effects. `rm templates/common/CONSTITUTION.md`.
2. CLAUDE.md/GEMINI.md: use as minimal project-level base content. Keep variant-agnostic common settings, remove all workspace root path references. Or use as placeholder only.
3. Prevention: add "Check 0: forbidden files in templates/common/" to validate-templates.ts. Forbidden list: CONSTITUTION.md (and future workspace-only docs).

---

**Architect**: (Round 2)

CLAUDE.md/GEMINI.md: keep minimal project-level base content — variant-agnostic settings from co-design/CLAUDE.md sections before the "Session Start" block. Remove all C:\git\ path references. Future-proof: if a generic variant is added without its own CLAUDE.md, the base file is correct.

validate-templates.ts Check 0 position: before Check 1 (variant.json). Forbidden file list: CONSTITUTION.md; expandable.

docs/governance/variant-contract.md also needs a Blocklist section — policy document and automated validation must match.

---

**Docs-writer**: (Round 2)

Proposed variant-contract.md Blocklist section:

```markdown
## Blocklist — Files NOT Allowed in templates/common/

| File | Reason |
|------|--------|
| CONSTITUTION.md | Workspace governance SSOT — projects reference via URL, not file copy |
| CLAUDE.md (workspace-root content) | Must contain project-level content only |
| GEMINI.md (workspace-root content) | Same as above |

Detection: templates/common/CLAUDE.md or GEMINI.md contains workspace-root content if it references:
- C:\git\ or /c/git/ absolute paths
- "workspace root" in the doc-intent line
- scripts/dev-sync.sh or workspace-only hook configurations
```

Prevention comment for templates/common/CLAUDE.md top:
```
<!-- TEMPLATE FILE: project-level base CLAUDE.md.
     DO NOT copy workspace root (C:\git\) content here.
     Variant CLAUDE.md files overlay this via new-project.sh. -->
```

---

## Action Items

| # | Owner | Deliverable | Tier | Model |
|---|-------|-------------|------|-------|
| T-01 | automation-engineer | Delete `templates/common/CONSTITUTION.md` | Low | haiku |
| T-02 | docs-writer | Replace `templates/common/CLAUDE.md` and `GEMINI.md` with project-level base content (remove workspace paths, add warning comment at top) | Medium | sonnet |
| T-03 | docs-writer | Add Blocklist section to `docs/governance/variant-contract.md` | Medium | sonnet |
| T-04 | automation-engineer | Add Check 0 to `validate-templates.ts`: error if forbidden files exist in templates/common/ | Medium | sonnet |
| T-05 | auditor | After T-01~T-04: run `bun run audit` + `bun run validate-templates` and confirm all pass | Medium | sonnet |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-01 | `templates/common/CONSTITUTION.md` does not exist | `ls templates/common/CONSTITUTION.md` returns not found |
| AC-02 | `templates/common/CLAUDE.md` does not reference `C:\git\` or "workspace root" | grep check |
| AC-03 | `docs/governance/variant-contract.md` has Blocklist section | Manual review |
| AC-04 | `validate-templates.ts` Check 0 detects and errors on CONSTITUTION.md in templates/common/ | Run validate-templates.ts with test file |
| AC-05 | `bun run audit` and `bun run validate-templates` both pass | Script output |
