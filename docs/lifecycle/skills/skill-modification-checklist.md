# Skill Modification Review Checklist (SK-01)

> **Purpose**: Define when and how to review skills for necessary modifications.  
> **Owner**: lifecycle-manager  
> **Related**: [CONSTITUTION.md §6](../../constitution/06-skill-lifecycle.md), [skill-lifecycle-manager SKILL.md](../../../skills/skill-lifecycle-manager/SKILL.md)

---

## When to Trigger a Skill Modification Review

A skill should be queued for modification review when **any** of the following conditions apply:

| Trigger | Signal | Action |
|---------|--------|--------|
| **Tool/API change** | A tool the skill references is renamed, removed, or has new required params | Immediate review |
| **Agent roster change** | A specialist agent the skill dispatches is added, removed, or renamed | Immediate review |
| **Standards update** | CONSTITUTION.md or CLAUDE.md sections referenced in the skill are revised | Review within 1 week |
| **Failed execution** | A user reports that following a skill produced an error or unexpected result | Immediate review |
| **Dependency archived** | A skill invoked via `/skill` in the body is deprecated or removed | Immediate review |
| **Periodic audit** | Scheduled quarterly review (see §4) | Review within audit window |

---

## Pre-Review Checklist

Before opening a modification, confirm:

- [ ] The triggering condition is documented (which of the 6 triggers above applies)
- [ ] `bun scripts/validate-skills.ts` passes on the current file (establish a clean baseline)
- [ ] `bun scripts/skill-dependency-analysis.ts` shows no circular or orphaned dependencies for this skill
- [ ] The governance record at `docs/lifecycle/skills/<skill-name>.md` is up to date

---

## Modification Review Steps

### Step 1 — Scope Assessment
- [ ] Identify all steps/sections affected by the trigger
- [ ] Determine whether the change is **minor** (wording, example update) or **major** (new step, removed capability, changed trigger conditions)
- [ ] If major: file an ADR entry in the governance record before editing

### Step 2 — Content Validation
- [ ] All step numbers are sequential with no gaps
- [ ] Every step that calls a tool, command, or agent has an explicit error-handling note or fallback
- [ ] `/skill <name>` references resolve to an active (non-deprecated) skill
- [ ] File paths, script names, and agent names match current filesystem state
- [ ] "Use when" / trigger phrases in frontmatter accurately reflect the updated behavior

### Step 3 — Frontmatter Update
- [ ] `version` field incremented (semver: patch for minor, minor for major)
- [ ] `last_updated` field set to today's date (YYYY-MM-DD)
- [ ] `status` field reflects correct lifecycle state (`active` | `deprecated` | `archived`)
- [ ] If status changed to `deprecated`: add `deprecated_reason` field and `replacement` field

### Step 4 — Governance Record Update
Update `docs/lifecycle/skills/<skill-name>.md`:
- [ ] Add entry to `## Phase History` table with date, version, and description of change
- [ ] Update `## Acceptance Criteria` if behavior changed
- [ ] If cross-platform parity is required: verify `.gemini/skills/<name>/SKILL.md` is updated in sync

### Step 5 — Post-Modification Validation
- [ ] `bun scripts/validate-skills.ts` passes with no errors
- [ ] `bun scripts/skill-dependency-analysis.ts` shows clean dependency graph
- [ ] Run the skill manually (or trace through the steps) to confirm executability
- [ ] Stage and commit: `git add skills/<name>/SKILL.md docs/lifecycle/skills/<name>.md`

---

## Major vs. Minor Classification

| Change Type | Classification | ADR Required | Version Bump |
|-------------|---------------|-------------|-------------|
| Typo / wording fix | Minor | No | Patch (x.x.+1) |
| New example added | Minor | No | Patch |
| Step reordered | Minor | No | Patch |
| New step added | Major | Yes | Minor (x.+1.0) |
| Step removed | Major | Yes | Minor |
| Trigger condition changed | Major | Yes | Minor |
| Capability removed entirely | Major | Yes | Major (+1.0.0) |
| Skill deprecated | Major | Yes | Major |

---

## Quarterly Review Procedure

See [AGENTS.md — Periodic Skill Review Schedule](../../../AGENTS.md#periodic-skill-review-schedule) for the quarterly cadence and ownership.

During a quarterly review, apply this checklist to **every active skill** using `bun scripts/skill-dependency-analysis.ts --report` to generate a full health report, then address any findings in priority order:

1. 🔴 Broken dependencies or circular references → immediate fix
2. 🟡 Stale file-path references → fix within 1 week
3. 🟢 Wording or example improvements → batch in next release cycle

---

## Phase History

| Date | Version | Change |
|------|---------|--------|
| 2026-05-29 | 1.0.0 | Initial creation (A-03 from PM Facilitator Transition Review meeting) |

## Acceptance Criteria

- AC-03: This file exists at `docs/lifecycle/skills/skill-modification-checklist.md` with all review steps documented ✅
