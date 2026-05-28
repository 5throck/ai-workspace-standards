# Meeting Transcript
**Date**: 2026-05-28
**Topic**: Variant Parity Sync Implementation Plan Review
**Participants**: pm, architect, security-expert, auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

**[Facilitator — PM]**: This meeting reviews the implementation plan at `docs/superpowers/plans/2026-05-28-variant-parity-sync.md`. The plan covers 6 tasks and approximately 49 files. Each participant should evaluate executability, gaps, and risk from their domain perspective.

---

**Architect** (Round 1):

The overall task order is logical (Task 1 → 2/3 → 4 → 5 → 6 respects dependencies). Three structural concerns:

1. **Variant Contract parsing is fragile.** The plan has `validate-templates.ts` parse the Required Files table from VARIANT_CONTRACT.md at runtime. Markdown table parsing breaks on formatting changes. Proposal: create `templates/common/variant-contract.json` as the machine-readable source; keep VARIANT_CONTRACT.md as the human-readable document.

2. **sync.md edit instructions lack expected end state.** Tasks 2 and 3 say "remove the Pre-PR Security Gate section" without specifying the final section list after removal. Executors need clarity on where the cut ends.

3. **Skill content quality is uneven.** `verify-authorization/SKILL.md` is executable (5-step checklist). `meeting-facilitation/SKILL.md` is just a pointer to the workspace skill — no self-contained content. It needs to be rewritten for the co-security context.

Question to Security-Expert: assess the domain fitness of the four missing skills. Question to Auditor: does the JSON separation approach match existing `validate-templates.ts` patterns?

---

**Security-Expert** (Round 1):

`verify-authorization/SKILL.md` content is solid overall. One Critical gap: Step 2 checks that the `Authorized Signature` field exists but does not validate that the signature is from an authorized party. Two items must be added: (a) signature date must be ≤ engagement start date, (b) signatory title must carry authorization authority.

The plan copies co-develop's `.claude/settings.json` to co-security (Task 4b Step 4). This is wrong — co-develop's settings.json is `{ "mcpServers": ... }` with hooks disabled. co-security must have PostToolUse secret scan hooks **enabled by default** since engagement work handles sensitive credentials.

Agree with Architect on `meeting-facilitation/SKILL.md` — security meetings specifically require PM to run `verify-authorization` before any offensive TTPs are discussed.

Question to Auditor: Task 6 verification lacks end-to-end functional testing. Confirm `/sync` and pre-commit hook behavior should be added.

---

**Auditor** (Round 1):

**On JSON separation**: current `validate-templates.ts` already reads `variant.json` directly (JSON pattern). Adding `variant-contract.json` matches the existing pattern. Agreed — JSON separation is correct. Task 1 must add a Step 2 to create `variant-contract.json`.

**Additional gap in Tasks 2 and 3**: the `agents/README.md` draft in the plan omits the `bun run agent:create` CLI usage section that co-develop's README includes. All variants should maintain this section.

**End-to-end testing gap is Critical**: Task 6 only runs `validate-templates.ts` and verifies file structure. There is no test that the copied command files actually execute. Task 6 needs: run `/changelog 'test entry'` in a scaffolded test project and verify CHANGELOG.md is updated.

**Two consistency issues found**:
1. co-work/co-design `security-check.md` rows still appear in the File Map with strikethrough — should be deleted entirely to avoid executor confusion.
2. `docs/context.md` link in the CLAUDE.md draft — need to confirm whether the correct path in a deployed project is `docs/context.md` or `templates/common/docs/context.md`.

Question to Architect: provide the `variant-contract.json` schema so it can be included in the plan for executors.

---

**Architect** (Round 2):

Proposed `variant-contract.json` schema:

```json
{
  "required": [
    "variant.json", "CLAUDE.md", "GEMINI.md", "AGENTS.md",
    "README.md", "README_ko.md",
    "agents/pm.md", "agents/README.md", "agents/README_ko.md",
    ".claude/settings.json",
    ".claude/commands/changelog.md", ".claude/commands/memlog.md",
    ".claude/commands/new-task.md", ".claude/commands/sync.md",
    ".claude/commands/meeting.md",
    ".gemini/settings.json",
    ".gemini/commands/changelog.md", ".gemini/commands/memlog.md",
    ".gemini/commands/new-task.md", ".gemini/commands/sync.md"
  ],
  "optional": [
    ".claude/commands/security-check.md",
    ".gemini/commands/security-check.md"
  ],
  "context_file_pattern": "docs/{variant}.context.md"
}
```

`context_file_pattern` is a separate field because it is the only required file whose path is variant-name-dependent.

File Map strikethrough entries should be fully deleted — agreed with Auditor.

`docs/context.md` link path: `new-project.sh` copies `templates/common/docs/context.md` to `docs/context.md` in the deployed project, so `docs/context.md` is correct in generated projects. The link path in `templates/co-develop/CLAUDE.md` (`templates/common/docs/context.md`) is a template-internal reference. Plan executor should verify this before writing co-security CLAUDE.md.

Strong support for Security-Expert's default-ON hooks proposal. Task 4b Step 4 must be changed from "copy settings.json" to "create settings.json with PostToolUse hook enabled."

Task ordering note: if JSON separation is adopted, Task 1 must create both files (VARIANT_CONTRACT.md + variant-contract.json) before Task 5 Step 6 (validate-templates.ts modification) can proceed. Task 1 needs to be split into two steps.

---

**Security-Expert** (Round 2):

Agreement with Architect's JSON schema and settings.json correction.

CLAUDE.md Security Engagement Rules quality: the 5 rules in the plan are directionally correct but manually dependent. Rule 3 ("don't commit discovered credentials") becomes automatic enforcement when settings.json has the PostToolUse hook enabled. CLAUDE.md should explicitly reference this automation: "These rules are automatically enforced by the PostToolUse hook in `.claude/settings.json`."

Supplement to Auditor's end-to-end testing proposal: Task 6 should add two security-specific verifications:
1. In the scaffolded co-security project, run `git config core.hooksPath .githooks`, stage a `.env` file, attempt commit — verify pre-commit hook blocks it.
2. Run `verify-authorization` skill with no `docs/authorization.md` present — verify BLOCKED status is returned.

These two tests confirm co-security is actually ready for engagement use, not just structurally complete.

Additional gap: the CLAUSE.md draft has no Key Files section. `PATCH_LOG.md`, `ansible/`, and `docs/findings/` are the core engagement artifacts in co-security and must be documented in the Key Files section of CLAUDE.md so AI tools can orient themselves.

---

**Auditor** (Synthesis):

**Points of agreement:**

1. **Introduce `variant-contract.json`**: Add to Task 1 as Step 2. Use Architect's proposed schema. `validate-templates.ts` reads JSON directly. VARIANT_CONTRACT.md remains as human-readable documentation.

2. **co-security `.claude/settings.json` written fresh**: Task 4b Step 4 changed from "copy" to "create with PostToolUse secret scan hook enabled by default."

3. **`verify-authorization/SKILL.md` supplemented**: Add signature date ≤ start date and signatory title authority checks to Step 2.

4. **`meeting-facilitation/SKILL.md` rewritten with real content**: Include mandatory `verify-authorization` prerequisite for security meetings.

5. **File Map cleanup**: Delete co-work/co-design `security-check.md` rows entirely.

6. **`agents/README.md` for co-work/co-design**: Add `bun run agent:create` CLI usage section currently missing from plan drafts.

7. **co-security CLAUDE.md**: Add Key Files section listing PATCH_LOG.md, ansible/, docs/findings/. Add note that Security Engagement Rules are automatically enforced by PostToolUse hook.

8. **Task 6 end-to-end testing**: Add three verification steps — (a) `/changelog` execution test, (b) `.env` pre-commit block test, (c) `verify-authorization` BLOCKED state test.

**Unresolved (executor judgment required):**

- `docs/context.md` link path in generated CLAUDE.md — read `templates/co-develop/CLAUDE.md` actual link before writing co-security version.

**Plan modification summary:**

| # | Location | Change | Priority |
|---|----------|--------|----------|
| M-01 | Task 1 | Add Step 2: create `variant-contract.json` with Architect's schema | Required |
| M-02 | Task 4b Step 4 | Create co-security `.claude/settings.json` with PostToolUse hook ON (not a copy) | Required |
| M-03 | Task 4d Step 9 | Add signature date and signatory title validation to verify-authorization Step 2 | Required |
| M-04 | Task 4d Step 10 | Rewrite meeting-facilitation with real content + verify-authorization prerequisite | Required |
| M-05 | File Map | Delete co-work/co-design security-check.md rows | Recommended |
| M-06 | Task 2/3 | Add bun run agent:create CLI section to agents/README.md drafts | Recommended |
| M-07 | Task 4a Step 1 | Add Key Files section to CLAUDE.md draft + hook enforcement note | Recommended |
| M-08 | Task 6 | Add three end-to-end verification steps | Required |

---

## Action Items

| # | Owner | Deliverable | Phase |
|---|-------|-------------|-------|
| M-01 | Automation-Engineer | Add `variant-contract.json` creation to Task 1 in the plan | Plan revision |
| M-02 | Automation-Engineer | Rewrite Task 4b Step 4 — co-security settings.json with hooks ON | Plan revision |
| M-03 | Security-Expert | Supplement verify-authorization SKILL.md content in Task 4d Step 9 | Plan revision |
| M-04 | Security-Expert | Rewrite meeting-facilitation SKILL.md content in Task 4d Step 10 | Plan revision |
| M-05 | Auditor | Remove security-check.md rows from File Map for co-work/co-design | Plan revision |
| M-06 | Docs-Writer | Add CLI section to agents/README.md drafts in Tasks 2 and 3 | Plan revision |
| M-07 | Docs-Writer | Add Key Files section and hook note to CLAUDE.md draft in Task 4a | Plan revision |
| M-08 | Architect | Add three end-to-end test steps to Task 6 | Plan revision |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-01 | Plan includes variant-contract.json schema and creation step | Read Task 1 in revised plan |
| AC-02 | co-security settings.json draft shows PostToolUse hook enabled | Read Task 4b Step 4 in revised plan |
| AC-03 | verify-authorization SKILL.md includes signature date + title authority checks | Read Task 4d Step 9 in revised plan |
| AC-04 | Task 6 includes .env pre-commit block test and verify-authorization BLOCKED test | Read Task 6 in revised plan |
