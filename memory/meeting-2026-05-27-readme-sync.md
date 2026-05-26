# Meeting Transcript
**Date**: 2026-05-27
**Topic**: README and README_ko synchronization
**Participants**: Template Architect, Documentation Writer, Automation Engineer, PM Agent (Facilitator/Synthesizer)
**Rounds**: 2
**Language**: English
**Status**: Complete

---

## Transcript

**[Template Architect]**: (Round 1)

Looking at the workspace structure, we need a clear policy on where localized READMEs are strictly required. I propose that the workspace root (`/`) and all template roots (`/templates/*`) must have both `README.md` and `README_ko.md`. For utility directories like `/scripts`, `/agents`, or `/skills`, an English `README.md` is sufficient unless the team explicitly requests a Korean version. We shouldn't force translations everywhere, just where onboarding is critical.

---

**[Documentation Writer]**: (Round 1)

I agree with the Architect's scope. The workspace root and templates are the primary entry points for developers. To ensure these files don't drift out of sync, we need a reliable tracking mechanism. Relying on Git timestamps can be flaky depending on checkout behavior. I propose we require a YAML frontmatter block at the top of these specific READMEs with a `sync_version: <integer>` field. Whenever a change is made to one, the author must increment the version, which forces them to update the other file to match.

---

**[Automation Engineer]**: (Round 1)

The frontmatter `sync_version` approach is clean and easy to parse. I can write cross-platform validation scripts: `scripts/verify-readme-sync.sh` and `scripts/verify-readme-sync.ps1`. The scripts will scan the root and `/templates/*` directories, extract the `sync_version` from both `README.md` and `README_ko.md`, and fail if they are missing or if the versions don't match. I'll then hook this script into our pre-commit pipeline so it runs automatically before every commit.

---

**[Template Architect]**: (Round 2)

That sounds robust. Automation Engineer, please ensure the script allows an easy way to configure additional directories in the future. Perhaps an array or a configuration variable at the top of the script. Documentation Writer, you will need to establish the baseline by adding `sync_version: 1` to the existing READMEs in those target directories.

---

**[Documentation Writer]**: (Round 2)

Will do. I'll also add a brief instruction comment next to the `sync_version` field so future contributors understand why it's there and that they need to update the translated file.

---

**[Automation Engineer]**: (Round 2)

Perfect. I'll implement the scripts and update the Git pre-commit hook configuration (e.g., via husky or native git hooks, depending on what we have set up in the `security-expert`'s domain). I will ensure the error messages are clear and tell the developer exactly which files have mismatched versions.

---

**[PM Agent]**: (Synthesis)

The discussion has converged nicely on a practical, automated solution.

### Points of Agreement
- **Scope**: `README.md` and `README_ko.md` pairs are strictly required in the workspace root (`/`) and all template roots (`/templates/*`).
- **Tracking Mechanism**: Use a YAML frontmatter field `sync_version: <integer>` in both files to track parity.
- **Automation**: Validation scripts will check these directories and enforce that versions match.
- **Enforcement**: The validation scripts will be integrated into the Git pre-commit hook.

### Open Disagreements or Unresolved Questions
- None. The team is fully aligned.

---

## Action Items

| # | Owner | Deliverable | Phase |
|---|-------|-------------|-------|
| A-01 | Template Architect | Document the localized README policy in `CONSTITUTION.md` or architectural guidelines. | Next |
| A-02 | Documentation Writer | Add `sync_version: 1` frontmatter to existing README/README_ko pairs in root and `/templates/*`. | Next |
| A-03 | Automation Engineer | Create `scripts/verify-readme-sync.sh` and `.ps1` and integrate into the pre-commit hook. | Next |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | Target directories identified | Workspace root and templates explicitly checked by script |
| 2 | Version tracking implemented | Both READMEs contain `sync_version` frontmatter |
| 3 | Automation enforces sync | Commits fail if `sync_version` mismatches in target directories |
