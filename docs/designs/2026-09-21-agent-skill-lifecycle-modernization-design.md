# Design: Agent & Skill Lifecycle Modernization under PM Team-Management Authority

- **Spec ID**: `2026-09-21-agent-skill-lifecycle-modernization-design`
- **Date**: 2026-09-21
- **Status**: implemented
- **Owner**: pm (procedures) / automation-engineer (audit enforcement)
- **Related**: ADR-0080 (team-management authority), ADR-0061 (decision records), ADR-0067 (session-evidence loop), `2026-09-21-upgrade-project-skill-subfile-sync-design` (delivery mechanics)

## Summary

ADR-0080 gave the PM top-down hiring/firing authority and gave agents a bottom-up,
PM-approved skill-request channel. The two governing procedures
(`agent-lifecycle-manager` 1.2.0, `skill-lifecycle-manager` 1.4.0) and their audit
enforcement were built alongside it but leave lifecycle integrity gaps that this
session measured in production: 33 fleet projects missing delivered-skill sub-files,
19 live references to retired skill names, undelivered common-skill content hidden
by equal version numbers, and no machine-checked deprecation deadlines. This design
closes the procedure gaps, adds blocking enforcement, and remediates the measured
drift.

## Root Problems (measured 2026-09-21)

| # | Problem | Evidence |
|---|---------|----------|
| P1 | Procedures never regenerate derived artifacts (VERSION_MANIFEST, skill-graph) nor create lifecycle records for new agents | explore inventory 2026-09-21; simulate-pipeline 1.0.1 lockstep incident |
| P2 | No reference-integrity gate — retired/renamed skill names persist in live SKILL.md files | 19 stale refs found across templates + projects; 14 truly retired names |
| P3 | Version-bump discipline unenforced — same-version content changes are never delivered | PR #873 content shipped 2026-09-11, still undelivered 2026-09-21 (translate, documentation-writing, +11 more skills) |
| P4 | Deprecation has no deadlines that anything checks | `removal-date` parsed but never compared to today; deprecated agents accumulate (ADR-0080 known cost) |

## Requirements

- **R1 — Procedure completeness**: hiring creates the agent lifecycle record; every
  hire/fire/create/modify/deprecate/remove regenerates VERSION_MANIFEST and the
  skill-graph projection as explicit steps (not implicit /sync side effects).
- **R2 — Registry lockstep checklist**: a single canonical checklist in
  `skill-lifecycle-manager` enumerating every surface a skill change must touch
  (SKILLS.md row, lifecycle record, VERSION_MANIFEST, skill-graph, 4 platform
  mirrors, L1 publish, validators).
- **R3 — Successor tracking**: `superseded_by:` frontmatter field on deprecated
  skills; recorded in the lifecycle record; consumed by the reference gate.
- **R4 — Reference integrity (blocking)**: SKILL.md body references to skill names
  that resolve nowhere FAIL the audit immediately (user decision 2026-09-21);
  references to deprecated names WARN; intentional historical notes are allowed via
  an explicit allowlist file.
- **R5 — Deadline enforcement**: expired `removal-date` (skills) and expired
  `removal_review:` (agents) FAIL the audit; deprecated agents without a
  scheduled removal review FAIL.
- **R6 — Agent reference completeness**: `owner:` pointing at a nonexistent agent
  FAILs; dangling `handoff_to`/`handoff_from` FAILs (previously prose-only).
- **R7 — Vocabulary alignment**: agent status vocabulary converges on
  `active|deprecated|archived` (constitution text stops using `retired` as a state;
  the audit accepts `retired` as a legacy alias for `archived` with a warning).
- **R8 — One-time remediation**: fix the 8 template files carrying stale
  references; batch-bump every common skill whose content drifted without a version
  bump so the fleet upgrade (upgrade-project 1.37.1 CATCH-UP/UPDATE) converges all
  projects in one pass.

## Design

### Procedure changes

`skill-lifecycle-manager` 1.5.0 adds a **Registry Lockstep Checklist** section and
rewires R1–R3 (evidence_refs mandatory, DEC frontmatter compliance + validator
invocation, lockstep on approval), Deprecate (bump + superseded_by + removal-date +
sweep), Remove (record retirement + full sweep + derived-artifact regeneration).

`agent-lifecycle-manager` 1.3.0 adds H5 record-creation + derived-artifact steps,
F4 `removal_review:` scheduling (deprecated + 90 days, consumed by the quarterly
review), and upgrades F5 prose checks to named audit checks.

### Enforcement changes

`skill-lifecycle-audit.ts` 1.5.0 new checks:

- **Check RI (reference integrity, ERROR)**: extract backticked skill-name
  candidates from SKILL.md bodies; a name resolves if it exists in root `skills/`,
  any `templates/*/skills/`, or the same directory's skill set. Unresolvable names
  → ERROR. Allowlist: `docs/lifecycle/reference-allowlist.json`
  (`{"file_substring": "skill-name"}` entries mark intentional historical
  references; seeded with simulate-pipeline's two former-skill mentions).
- **Check RI-d (deprecated reference, WARN)**: references resolving only to
  deprecated skills.
- **Check RD (removal-date expired, ERROR)**: `removal-date` ≤ today on a row that
  still exists.
- **Check LC (lifecycle-record coverage, WARN)**: active skill with no
  `docs/lifecycle/skills/<name>.md`.

`agent-lifecycle-audit.ts` 1.3.0 new checks:

- **Check 12 (owner target, ERROR)**: `owner:` naming an agent that exists nowhere
  (files + roster) — complements existing Check 6 (deprecated-owner).
- **Check 13 (handoff integrity, ERROR)**: `handoff_to`/`handoff_from` naming a
  nonexistent or archived agent.
- **Check 14 (removal review, ERROR)**: agent deprecated with
  `removal_review:` date in the past, or deprecated without one.
- Status vocabulary: accept `retired` as legacy alias of `archived` (WARN to
  migrate).

### Constitution alignment

`06-skill-lifecycle.md`: documents the reference gate, `superseded_by`,
deprecation-time bump rule. `05.6-agent-lifecycle.md`: documents
`removal_review:`, drops `retired` as a distinct state (aligns R7).

### Remediation (one-time, same PR)

8 template reference fixes (common/handbook-sync-audit, common/k-dart,
co-game/sound-synth, co-safety/completion-inspection + construction-permit-overview
+ gmp-deviation-capa, co-security/verify-authorization, co-abap/
source-command-celebrate) and patch version bumps for all common skills with
fleet-wide same-version content drift (translate, documentation-writing,
ci-triage, handbook-sync-audit, finishing-a-development-branch,
source-command-commit-push-pr, research-analysis, api-documentation,
platform-command-lifecycle-manager, platform-skill-lifecycle-manager, gateguard,
meeting-facilitation, zod-contract-gate, project-review), each with SKILLS.md +
lifecycle-record lockstep. `script-lifecycle-manager` is absorbed by its own 1.5.0
bump in this PR.

## Files Changed

- `skills/skill-lifecycle-manager/SKILL.md` 1.5.0; `skills/agent-lifecycle-manager/SKILL.md` 1.3.0 (+ mirrors)
- `scripts/skill-lifecycle-audit.ts` 1.5.0; `scripts/agent-lifecycle-audit.ts` 1.3.0 (+ L1 SCRIPTS.md rows)
- `docs/lifecycle/reference-allowlist.json` (new)
- `docs/constitution/06-skill-lifecycle.md`, `docs/constitution/05.6-agent-lifecycle.md`
- Template skill fixes + registry lockstep (SKILLS.md, lifecycle records, VERSION_MANIFEST, skill-graph)

## Test Plan

- Unit tests for the new audit checks: stale reference FAIL, allowlist pass,
  deprecated-ref WARN, expired removal-date FAIL (skills); unknown-owner FAIL,
  dangling handoff FAIL, overdue removal-review FAIL (agents).
- `bun test` full suite; `bun scripts/audit.ts`; `bun scripts/validate-templates.ts`.
- Fleet rollout (post-merge): `upgrade-project.ts --dry-run` review per project,
  then apply + per-project `/sync`; parity re-audit (missing-file + reference scans)
  expected to reach zero.

## Accessibility

Non-UI developer tooling and documentation. Exempt from WCAG 2.1 AA considerations
per ADR-0065's backend/non-UI exemption.

## Preview Verification

No rendered UI output. Exempt per ADR-0070; verification is the audit/test battery
above.

## Rollout & Compatibility

The new checks land in the same PR as the remediation, so the repository is
gate-consistent on merge (user decision: immediate FAIL, no soak). Fleet projects
receive everything through the normal upgrade path; no project-side manual action
beyond the standard per-project `/sync`.
