# Meeting Transcript
**Date**: 2026-05-28
**Topic**: Cross-platform parity gap in /meeting skill — root .gemini/commands missing
**Participants**: pm, architect, automation-engineer, docs-writer
**Rounds**: 2
**Orchestrator**: PM
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

**PM**: (Opening)

Called this meeting to address the following issue: the /meeting skill update that added PM orchestrator mode correctly updated 6 files under templates/, but failed to create `.gemini/commands/meeting.md` at the workspace root. Despite `GEMINI.md` being present at the root and explicitly supporting the Gemini/Antigravity platform, the root-level Gemini command was absent — and remained absent after the update. This violates the cross-platform parity requirement of the skill lifecycle policy.

Round 1: Why did this happen — root cause analysis.
Round 2: How do we prevent recurrence — structural safeguards design.

First question to Architect: In which document is the cross-platform parity requirement currently stated? And if a checklist item for this existed, why was it not executed?

---

**Architect**: (Round 1)

The cross-platform parity requirement is not explicitly defined in any single document. `GEMINI.md` describes how the Gemini platform works, but there is no checklist item or policy declaration stating "when adding or modifying a skill, update both `.claude/commands/` and `.gemini/commands/`." The skill domain in `lifecycle-governance.json` also does not include this parity requirement.

Reconstructing the execution flow: the executor scanned existing files — `.claude/commands/meeting.md` (root), `templates/co-*/.claude/commands/meeting.md` (4 files), `templates/common/.gemini/commands/meeting.md` (1 file) — and treated these as the update targets. The problem: there was no mechanism to recognize "the absence of `.gemini/commands/` at the root" as an anomaly. A file that does not exist cannot be found in a scan, and therefore cannot be detected as missing.

Root causes: (1) **Policy gap** — no codified rule requiring platform parity on skill changes. (2) **Detection gap** — `audit.sh` and `skill-lifecycle-audit.ts` do not compare the file lists of `.claude/commands/` and `.gemini/commands/` at the root level.

Question to automation-engineer: What paths does `skill-lifecycle-audit.ts` currently scan at the root level, and does it include any check of the `.gemini/` directory?

---

**Automation-Engineer**: (Round 1)

`skill-lifecycle-audit.ts` scans `skills/` and `.claude/skills/` at the root level. `.claude/commands/` is classified as a *command* file, not a skill file, so it is not a scan target for this audit tool. `.gemini/commands/` is not registered as a scan target in any audit tool.

The concrete problem: the workspace root has no `.gemini/` directory at all, while `templates/common/.gemini/commands/` exists. This structural asymmetry between root and templates was not detectable by any tool.

Two implementable fixes: (1) Add an explicit parity check to `audit.sh` — compare the file list in `.claude/commands/` against `.gemini/commands/`, output WARN or FAIL on mismatch. (2) Immediately create the missing `.gemini/commands/meeting.md` at the root.

Question to docs-writer: In which file should this parity requirement be documented as a checklist item? `CONSTITUTION.md` skill lifecycle section, or a separate document?

---

**Docs-Writer**: (Round 1)

Adding to Architect's "policy gap" finding: `CONSTITUTION.md §6 — Skill Lifecycle` currently defines status transition criteria and required frontmatter, but contains no "cross-platform deployment" section at all. This is the documentary basis for the gap.

On placement: the cross-platform parity requirement should be codified in two places simultaneously. First, `CONSTITUTION.md §6` as a "Command Deployment Rule" item — a single sentence: "When a file is added or modified under `.claude/commands/`, the same operation must be performed under `.gemini/commands/`." This becomes the canonical rule. Second, `CLAUDE.md` and `GEMINI.md` slash command sections each get a one-line cross-reference: "Platform parity: command files must exist on both platforms simultaneously. See §6."

Creating a separate document is a risk — the more documents are scattered, the higher the likelihood of future omission. A single authoritative definition in `CONSTITUTION.md` with references from `CLAUDE.md`/`GEMINI.md` matches the existing patterns of this workspace.

---

**PM**: (Round 1 — Close)

Summary of Round 1: **Two compounding causes produced this omission.**

First, **policy gap** — cross-platform parity is not codified in `CONSTITUTION.md §6`. Confirmed by both Architect and docs-writer. Second, **detection gap** — `audit.sh` does not compare `.claude/commands/` and `.gemini/commands/` file lists. Confirmed by automation-engineer.

Critically: this issue originated from a **system design gap, not executor negligence**. The executor updated all files that existed; there was no tool to detect the absence of a file that should have existed. The process was wrong, not the execution.

Round 2 focus: safeguard design. Question to automation-engineer: when adding a parity check to `audit.sh`, should it be WARN or FAIL, and how should exceptions be handled?

---

**Automation-Engineer**: (Round 2)

Recommendation: **default WARN, with opt-out mechanism to escalate to FAIL over time.**

Rationale: since `.gemini/commands/` does not exist at the root right now, setting immediate FAIL would break `audit.sh` immediately. But WARN-only risks being permanently ignored. Therefore a staged transition.

Concrete design: add `check_command_parity()` to `audit.sh`. This function uses `.claude/commands/` file list as the source of truth and checks whether each filename exists under `.gemini/commands/`. On mismatch, outputs WARN and increments `PARITY_WARNINGS` counter. Individual command files can carry a `gemini-parity: skip` frontmatter field as an explicit opt-out — intentionally Claude-only commands would not trigger warnings.

Medium-term goal: promote this WARN to FAIL and enforce at pre-commit level. But the immediate prerequisite is creating the root `.gemini/commands/` directory and placing `meeting.md` there.

Question to Architect: Should this parity check also be added to `skill-lifecycle-audit.ts`, or is `audit.sh` alone sufficient?

---

**Architect**: (Round 2)

Agree with `audit.sh`-only placement for now, but with one scope clarification: the comparison target must be clearly defined. Root-level `.claude/commands/` vs `.gemini/commands/` is Step 1. Step 2 is determining whether the same parity check is needed at the template variant level — `co-security` already has both `.claude/commands/` and `.gemini/commands/`, but this is not validated by `validate-templates.ts`.

More importantly: propose a **structural SSOT redefinition**. Currently `.claude/commands/` is the de facto SSOT and `.gemini/commands/` is a manually synced copy. This structure is the root cause. The ideal structure is a platform-neutral SSOT at `templates/common/commands/meeting.md`, with `publish-to-template.sh` distributing to both `.claude/commands/` and `.gemini/commands/`. This is a medium-term refactor, not an immediate action.

Immediate actions are clear: create `.gemini/commands/meeting.md` at root, add parity WARN to `audit.sh`, add one-line parity policy to `CONSTITUTION.md §6`. Question to docs-writer: how do you scope the documentation work across these three?

---

**Docs-Writer**: (Round 2)

My scope among Architect's three immediate actions:

`CONSTITUTION.md §6` update: one paragraph addition under "Cross-Platform Deployment Rule": *"Any command file added or modified under `.claude/commands/` MUST have a corresponding file under `.gemini/commands/` at the same directory level. Intentional Claude-only exceptions must be marked with `gemini-parity: skip` in the file's frontmatter."* This is the canonical definition. Simple and verifiable.

`CLAUDE.md` and `GEMINI.md`: one-line reference each in the slash commands section — *"See CONSTITUTION.md §6 for cross-platform parity rules."* Nothing more. Redundant explanation in two files becomes a drift source over time.

Additional point: the `gemini-parity: skip` frontmatter field proposed by automation-engineer must also be reflected in documentation. Current command file frontmatter only has `description`. Adding this field is an extension of the skill frontmatter standard and must be specified in `CONSTITUTION.md §6` alongside the rule.

---

**PM**: (Synthesis)

**Outcome**: The Gemini parity omission was a system design gap, not an execution error. Both the policy layer and the detection layer require remediation.

**Points of agreement** (all three agents aligned):
- Root cause is dual: missing policy in `CONSTITUTION.md §6` + missing detection in `audit.sh`
- Short-term fix: create root `.gemini/commands/meeting.md`, add `check_command_parity()` WARN to `audit.sh`, add Cross-Platform Deployment Rule to `CONSTITUTION.md §6`
- `CONSTITUTION.md §6` is the canonical location for the rule; `CLAUDE.md`/`GEMINI.md` carry only cross-references
- `gemini-parity: skip` as an explicit opt-out mechanism for intentionally Claude-only commands

**Open question**: Whether `validate-templates.ts` should enforce variant-level parity — deferred until A-05 ADR is complete.

## Action Items

| # | Owner | Deliverable | Phase |
|---|-------|-------------|-------|
| A-01 | automation-engineer | Create `.gemini/commands/meeting.md` at workspace root | Immediate |
| A-02 | automation-engineer | Add `check_command_parity()` to `audit.sh` (WARN level, supports `gemini-parity: skip` opt-out) | Immediate |
| A-03 | docs-writer | Add Cross-Platform Deployment Rule to `CONSTITUTION.md §6` (includes `gemini-parity: skip` frontmatter spec) | Immediate |
| A-04 | docs-writer | Add §6 parity policy one-line cross-reference to `CLAUDE.md` and `GEMINI.md` slash command sections | Immediate |
| A-05 | architect | (Medium-term) Write ADR for centralizing command file SSOT under `templates/common/commands/` | Next sprint |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | Root `.gemini/commands/meeting.md` exists and content matches `.claude/commands/meeting.md` | `md5sum` comparison |
| C-02 | `audit.sh` outputs WARN when `.claude/commands/` has files absent from `.gemini/commands/` | `bash scripts/audit.sh` with a test missing file |
| C-03 | `CONSTITUTION.md §6` contains "Cross-Platform Deployment Rule" with `gemini-parity: skip` spec | Manual doc review |
| C-04 | `CLAUDE.md` and `GEMINI.md` each reference `CONSTITUTION.md §6` in slash command section | Manual doc review |
