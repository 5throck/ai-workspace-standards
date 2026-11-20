# Meeting-Facilitation Skill Lifecycle

## Created

2026-05-29

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-05-29 | - | production | Initial skill established for multi-agent meeting facilitation | lifecycle-manager |
| 2026-05-30 | production | production | Updated to v1.1.0: Reflect dual execution modes (Claude inline vs Antigravity native subagents) | antigravity |
| 2026-05-30 | production | production | Updated to v1.2.0: Restructured Antigravity mode to Sequential Relay Protocol and unified dual-engine SSOT | antigravity |
| 2026-05-30 | production | production | Updated to v1.3.0: Modularized SKILL.md into specialized execution modes (`modes/claude.md`, `modes/antigravity.md`) and extracted common templates | antigravity |
| 2026-05-30 | production | production | Updated to v1.3.1: Enforced English and UTF-8 encoding standard across SKILL.md and resolved text corruption | antigravity |
| 2026-08-16 | production | production | Version drift fix: aligned lifecycle doc to v1.4.0 per SKILL.md | lifecycle-manager |
| 2026-09-05 | production | production | Updated to v1.4.1: Added Governance Rules section (dissent seat, PROPOSAL-not-decision, verbatim dissent preservation) — generic rules back-ported from Projects/co-newbiz v1.5.0 | zcode |
| 2026-11-10 | production | production | Updated to v1.5.0: committee-form alignment per U-20261109-001 (ADR-0196) — 6-step deliberation flow with response contract and 7-section committee minutes output (spec 2026-11-09-meeting-facilitation-committee-alignment-design, DEC-20261109-01) | lifecycle-manager |
| 2026-11-21 | production | production | Updated to v1.6.0: turn-based dialogue redesign per U-20261121-001 (upstream ADR-0204) — agenda-at-open, per-issue participant selection, seven-move turn mechanics with per-issue budget, progress line, chair-proposed consensus with participant-only vote (spec 2026-11-21-meeting-facilitation-turn-based-design) | automation-engineer |

## Acceptance Criteria

### Production Phase

- [x] Skill purpose clearly defined: Multi-agent meeting facilitation
- [x] Trigger conditions: When user requests collaborative decision making
- [x] Examples provided: Meeting workflows, action item generation
- [x] Successfully tested in meeting scenarios

## Dependencies

- pm (facilitator agent)
- All agents (meeting participants)

## Usage Statistics

- **First Used**: 2026-05-20 (estimated)
- **Last Used**: 2026-05-29 (system improvement meeting)
- **Total Invocations**: ~8 (estimated)

## Metadata

- **Current Phase**: production
- **Owner**: pm
- **Last Updated**: 2026-11-21
- **Last Reviewer**: automation-engineer

## Changelog

- **1.6.0** (2026-11-21): turn-based dialogue redesign (U-20261121-001, spec 2026-11-21-meeting-facilitation-turn-based-design; upstream ADR-0204) — agenda-at-open distills 2-5 named issues before any discussion (mid-meeting append preserved); per-issue participant selection of 3-5 with one-line reasons, dissent seat always selected, non-participant silence never counted as agreement, one floor-request escape; seven-move turn mechanics (`propose`/`ask`/`answer`/`rebut`/`concede`/`amend`/`pass`) with display-name addressing, answer-first speaker order, one-amend-per-issue limit, per-issue budget 3 turns/participant cap 12 with `--rounds N` mapped to a per-issue turn budget; progress line `issue i/n · speaker <display name> · turns used t/<budget>`; chair-proposed consensus voted by participants only (chair never votes), closing `agreed`/`narrowed`/`unresolved`; minutes become a short body with verbatim key exchanges plus Appendix A full turn transcript and Appendix B interrupted attempts. Per-turn stance line dropped (stance recorded at the consensus vote); no runtime round-mode fallback — rollback is version revert; Governance Rules byte-identical.

- **1.5.0** (2026-11-10): committee-form alignment (U-20261109-001, DEC-20261109-01, spec 2026-11-09-meeting-facilitation-committee-alignment-design) — 6-step facilitation flow: agenda with round-count-as-parameter and no silent reduction, facilitator agenda pass distilling 2-5 named issues, four-clause round-2+ response contract (≥2 named peers with agree/rebut/ask; answer prior-round questions; explicit `changed:`/`no change:` stance line; stay on-issue); 7-section committee minutes (attributed discussion by issue → agreements → verbatim dissent → open questions → action items → PROPOSAL-labelled recommendation). Resolves the "decisions" wording tension against Governance Rule 2; Governance Rules byte-identical.

- **1.4.4** (2026-09-26): self-contained rewrite — removed `.claude|gemini/commands/meeting.md` delegation; the legacy `/meeting` slash command was retired (T-20260926-027, spec 2026-09-26-meeting-command-retirement). Governance rules and transcript format unchanged.

- **1.4.3** (2026-09-21): patch bump — deliver accumulated template content to the fleet (equal-version content drift measured 2026-09-21; upgrade-project 1.37 UPDATE delivery).

- **1.4.2** (2026-09-21): patch bump — deliver accumulated template content that predated this version to the fleet (equal-version content drift measured 2026-09-21; upgrade-project 1.37 UPDATE delivery).
- **Version**: 1.6.0
