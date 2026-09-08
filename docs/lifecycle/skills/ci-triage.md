# Ci-Triage Skill Lifecycle

## Metadata
- **Skill**: ci-triage
- **Status**: active
- **Version**: 0.1.0
- **Created**: 2026-09-08
- **Last Updated**: 2026-09-08

## Description
Lightweight CI / audit / scaffold failure triage loop: deterministic reproduction,
minimal repro, provenance tracing, root-cause fix, re-verification with a
validator-hardening ratchet. Pilot from the 2026-09-08 project-review ecosystem
gap analysis (design: docs/designs/2026-09-08-ci-triage-skill-design.md).

## Changelog
- 2026-09-08: 0.1.0 — initial pilot version

## Dependencies
- project-review (escalation path for multi-domain failures)
- sync (fix landing pipeline)
- scripts/ticket.ts (validator-hardening ratchet tickets)

## Phase History
| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-09-08 | - | production | Pilot created from project-review v1.2.0 ecosystem gap analysis; procedure codified from 2026-09-07 proven practice | pm |

## Acceptance Criteria

### Active Phase
- [x] SKILL.md exists at `skills/ci-triage/SKILL.md`
- [x] Frontmatter valid; triggers distinct from project-review's
- [x] Design doc present (docs/designs/2026-09-08-ci-triage-skill-design.md)
- [x] Registered in docs/VERSION_MANIFEST.md and distributed to platform mirrors
- [ ] First real triage invocation recorded (pilot success criterion)

## Usage Statistics
- **First Used**: (pending first invocation)
- **Last Used**: —
- **Total Invocations**: 0

## Metadata
- **Current Phase**: production
- **Version**: 0.1.0
- **Owner**: pm
- **Last Updated**: 2026-09-08
- **Last Reviewer**: pm
