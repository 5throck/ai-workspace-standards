# Meeting Transcript
**Date**: 2026-05-30
**Topic**: Root Cause Analysis of Phase 1/2/3 Issues and Prevention Measures
**Participants**: PM, Architect, Auditor
**Rounds**: 2
**Orchestrator**: PM
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Agenda

1. Round 1: Root cause identification — why did Phase 1/2/3 issues occur?
2. Round 2: Prevention measures — what automation and process changes will prevent recurrence?

---

## Round 1: Root Cause Identification

**PM**: (Round 1 — Open)

We are here to understand why the 17 critical and 9 moderate issues discovered during the Phase 1/2/3 comprehensive review occurred in the first place. Architect, please begin by analyzing the structural patterns across the findings — what common failure modes do you see?

---

**Architect**: (Round 1)

Looking across all 17 Phase 1/2/3 findings, I see four distinct failure mode categories:

**Migration without propagation (RCA-01)**: The TypeScript migration deleted `.sh` files but left references intact across CLAUDE.md, README.md, constitution §9, AGENTS.md, and hooks. The migration was scoped to "delete the file" without a complementary "scan and update all references" phase. This is a classic incomplete refactoring pattern — the artifact changes but the documentation layer doesn't follow.

**Manual template synchronization (RCA-02)**: `publish-to-template.ts` maintains an explicit allowlist of files to sync to L1. When `audit.ts` was created as a new file, it was never added to that allowlist. The synchronization gap is structurally guaranteed whenever new files are added without a corresponding registry update.

**Architecture decisions not propagated (RCA-03)**: When `pm.md` was updated to remove PM ownership of Phases 4 and 5, the dependent documents (`phase-definitions.md`, `constitution §5.2`, all template `pm.md` files) were not updated. There is no mechanism linking a source-of-truth document to its dependents.

**No quality loop for new automation code (RCA-04)**: The DFS bug in `skill-dependency-analysis.ts`, the shell injection in sync scripts, and the missing language validation in `gen-pr-body.ts` all indicate that new scripts are written and shipped without review gates. The existing `audit.ts` validates workspace standards but not the correctness of the tools it relies on.

---

**Auditor**: (Round 1)

I agree with Architect's four categories and want to add a cross-cutting observation: all four root causes share a common trait — **they are all detectable at commit time with the right automation**, but our current pre-commit hook only checks artifact existence and frontmatter, not content consistency or reference validity.

Specifically:
- RCA-01 is detectable: grep staged files for `bash scripts/*.sh` patterns
- RCA-02 is detectable: diff `scripts/*.ts` against `templates/common/scripts/` and flag unsynced files
- RCA-03 is detectable: parse phase ownership declarations across documents and compare against a canonical schema
- RCA-04 is only partially detectable at commit time — code review and linting are needed

The gap is not in our tooling philosophy — we have the right infrastructure — but in the scope of what the pre-commit hook actually checks. We are checking "does the file exist and is it well-formed" but not "does it agree with the other files it depends on."

---

**PM**: (Round 1 — Close)

Both analyses converge on the same diagnosis: we have strong per-artifact validation but no cross-artifact consistency enforcement. The four root causes (migration propagation, template sync, architecture decision propagation, code quality) are all manifestations of the same gap — changes propagate manually when they should propagate automatically.

For Round 2, I want the team to propose specific, automatable prevention measures for each root cause. Auditor, please lead with what can be added to the pre-commit hook immediately.

---

## Round 2: Prevention Measures

**PM**: (Round 2 — Open)

Based on Round 1's diagnosis, we need concrete prevention measures that can be implemented as automation rather than process documentation. Auditor, what changes to the pre-commit hook address RCA-01 and RCA-02 immediately?

---

**Auditor**: (Round 2)

For RCA-01, the fix is straightforward: add a grep pattern to the pre-commit hook that scans staged files for `bash scripts/*.sh` references. If any staged `.md`, `.ts`, or hook file contains a reference to a `.sh` script that no longer exists in `scripts/`, block the commit with a clear error. This catches migration residue at source.

For RCA-02, I recommend adding a validation step to `validate-templates.ts` (already run in pre-commit) that diffs `scripts/*.ts` against `templates/common/scripts/*.ts`. Any file present in L0 but absent in L1 should produce an error, not just a warning. The current D-04 check is a warning; it needs to be an error for critical scripts like `audit.ts`.

Both of these are low-effort additions that would have caught C-01 and C-05 before they reached the repository.

---

**Architect**: (Round 2)

For RCA-03, I propose introducing a `workspace-schema.json` (or extending `variant-contract.json`) that serves as the single source of truth for cross-document invariants:

```json
{
  "phases": {
    "canonical": [0, "1-2", 3, 4, 5, 6],
    "pm_owned": [0, 2, 6]
  },
  "agent_tiers": {
    "docs-writer": "medium",
    "automation-engineer": "low"
  }
}
```

`validate-templates.ts` then reads this schema and validates that all documents declaring phase numbers or agent tiers match the schema values. Any deviation is a validation error that blocks commits.

This moves the source of truth from prose (which is hard to parse and compare) to structured data (which is trivially comparable). When an architecture decision changes, you update `workspace-schema.json` first, then the validator catches all dependent documents that haven't been updated yet.

For RCA-04, the Auditor is correct that pre-commit can't fully address code quality. I recommend a `script-quality-gate.md` in `docs/governance/` that defines mandatory review checklist items for new TypeScript scripts: security patterns (`execFileSync` over `execSync`), SCRIPTS.md registration, and a minimum test case requirement.

---

**PM**: (Round 2 — Close)

The team has produced a coherent prevention framework:
- Immediate automation (RCA-01, RCA-02): pre-commit grep for stale `.sh` refs + L0/L1 sync validation as errors
- Medium-term automation (RCA-03): `workspace-schema.json` as cross-document source of truth
- Process documentation (RCA-04): `script-quality-gate.md` as a code review checklist for new scripts

The open question raised by Architect — whether to extend `variant-contract.json` or create a new `workspace-schema.json` — is deferred to Architect's design proposal. All other items have clear owners and timelines.

---

## Action Items

| # | Owner | Deliverable | Priority |
|---|-------|-------------|----------|
| A-01 | automation-engineer | Add `.sh` reference detection to `audit.ts` — block commits containing `bash scripts/*.sh` references to non-existent files | Immediate |
| A-02 | automation-engineer | Upgrade L0/L1 sync check in `validate-templates.ts` from warning to error for critical scripts | Immediate |
| A-03 | architect | Design `workspace-schema.json` (or `variant-contract.json` extension) as source of truth for phase numbers, PM-owned phases, and agent tiers; update `validate-templates.ts` to enforce it | Within 1 week |
| A-04 | auditor | Create `docs/governance/script-quality-gate.md` — mandatory checklist for new TypeScript scripts (security, registration, test coverage) | Within 1 week |
| A-05 | lifecycle-manager | Add "cross-document consistency review" item to quarterly drift check procedure in `AGENTS.md` | Within 2 weeks |

## Open Questions

- A-03 implementation decision: extend `variant-contract.json` vs. new `workspace-schema.json` — Architect to propose after reviewing existing schema structure

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-01 | Pre-commit blocks commits with stale `bash scripts/*.sh` references | Test by staging a file with `bash scripts/audit.sh` — commit should fail |
| AC-02 | `validate-templates.ts` errors (not warns) when L0 script has no L1 counterpart | Test by adding a new `.ts` to `scripts/` without syncing to `templates/common/scripts/` |
| AC-03 | Phase number declarations in all documents match `workspace-schema.json` | Validator catches any document declaring Phase 5 as "Finalization" while schema says "QA" |
| AC-04 | `script-quality-gate.md` exists with security, registration, and test checklists | File present at `docs/governance/script-quality-gate.md` |
| AC-05 | Quarterly drift check includes cross-document consistency review | `AGENTS.md` periodic review section lists this as a required check item |
