# Meeting Transcript
**Date**: 2026-06-03
**Topic**: Template Version Problem Diagnosis and Resolution
**Participants**: architect, scaffolding-expert, automation-engineer, auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Context

User attempted to create a new project using `new-project.sh` with `--version 5.0.0` and `--version 5.0.1`, both of which failed. Actual available tags are `template-v0.4.0`, `template-v0.5.0`, `template-v0.5.1`. The `co-consult` variant exists in the workspace but is absent from all git tags.

---

## Transcript

### Round 1

**architect**: Diagnosed two overlapping issues. First, version number confusion — user typed `5.0.0` but the actual tag is `0.5.0`. This is not a personal typo but a UX failure; the system does not clearly communicate the version format. Second, co-consult variant is missing from all tags. Asked scaffolding-expert whether the tag release procedure is explicitly defined.

**scaffolding-expert**: Confirmed that `co-consult` was added on 2026-06-03 but the template tag was never published after the sync. Tag release is manual with no automation. Also noted that `templates/VERSION` (0.5.0) does not match the latest tag (template-v0.5.1), creating ambiguity. Asked automation-engineer whether `list-template-versions.ts` has any VERSION-vs-tag mismatch warning.

**automation-engineer**: Confirmed that `list-template-versions.ts` only lists tags — no comparison with the workspace VERSION file. Also identified that `new-project.sh` error messages do not suggest correct alternatives ("Did you mean: 0.5.1?"), which is why the user tried `5.0.0` → `5.0.1` without correcting the format. Proposed adding fuzzy version suggestion logic and a workspace state comparison section. Asked auditor about test coverage.

**auditor**: Summarized root causes as: (1) manual unregulated tag release → co-consult orphaned; (2) no UX feedback on invalid version input. Confirmed that version validation failure cases are not covered in tests. Asked architect whether tag automation should integrate with `/sync` or be a separate `release` command.

### Round 2

**architect**: Advised against integrating tag release into `/sync` — daily commit pipeline should not trigger release tags. Proposed Approach A (audit.ts warns on untagged template changes) combined with Approach B (CLAUDE.md §10 lifecycle table rule for `templates/` modification). Asked scaffolding-expert if `tag-template.ts` already exists.

**scaffolding-expert**: Confirmed `tag-template.ts` does not exist and needs to be created. Defined expected script behavior: read VERSION, check for existing tag, list new variants missing from tag, confirm and publish tag, add audit check. Proposed immediate hotfix: publish `template-v0.5.2` to include co-consult and update VERSION to 0.5.2.

**automation-engineer**: Assessed that `list-template-versions.ts` improvement is faster than `new-project.sh` fuzzy suggestion (bash Levenshtein is complex). Proposed prioritized implementation order: hotfix first, then list improvement, then tag-template.ts, then audit check, then CLAUDE.md update, finally new-project.sh error improvement.

### Synthesis (auditor)

Root cause is systemic, not user error. Template tag release has no automation or lifecycle enforcement. UX feedback is absent when invalid versions are entered. Immediate hotfix required to unblock co-design/co-consult users.

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | pm | High | Publish `template-v0.5.2` tag + update `templates/VERSION` to `0.5.2` (hotfix) | Immediate |
| A-02 | automation-engineer | Medium | `list-template-versions.ts` — add VERSION vs latest tag mismatch warning | Short-term |
| A-03 | automation-engineer | Medium | Create `scripts/tag-template.ts` (version check + variant listing + tag publish) | Short-term |
| A-04 | automation-engineer | Low | Add "template changed but tag not published" check to `audit.ts` | Short-term |
| A-05 | scaffolding-expert | Low | Add `templates/` modification → tag rule to `CLAUDE.md §10` lifecycle table | Short-term |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | `new-project.sh "co-design1" --variant co-design` succeeds without --version flag | Manual run |
| C-02 | `list-template-versions.ts` shows warning when VERSION ≠ latest tag | Script output check |
| C-03 | `bun scripts/tag-template.ts` publishes tag and updates VERSION atomically | Script test run |
| C-04 | `audit.ts` fails when templates/ modified but tag not published | Audit run after template edit |
