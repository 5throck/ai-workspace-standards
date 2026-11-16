# Design: co-deck + co-learning upstream backport batch (2026-11-15)

Ticket: U-20261114-007 (survey), T-20261114-013 (exam-bank promotion decision),
T-20261114-011 (dangling design-doc citation). User instruction: backport
Projects/co-deck and Projects/co-learning improvements into their templates and
process all related tickets.

## R1 — Backport set (project supersedes template; wholesale copy)

| Item | From → To | Version | Content |
|------|-----------|---------|---------|
| validate-image-manifest.ts | Projects/co-deck → templates/co-deck/scripts/co-deck/ | 1.4.0 → 1.4.1 | pool-duplicate diagnostics normalize win32 backslash separators (single emission site, POSIX unchanged) |
| validate-image-manifest.test.ts | Projects/co-deck → templates/co-deck/scripts/co-deck/tests/ | (pin) | win32 test pin at :430 |
| storyline SKILL.md ×6 | Projects/co-deck → templates/co-deck {skills, .agents, .claude, .gemini, .hermes, .codex}/skills/storyline/ | 1.2.0 → 1.3.0 | Step 3.5 Slide Content Hygiene Check (internal-annotation ban list, regex, allowed replacements); carries lang: ko / proper-noun frontmatter for verbatim Korean defect strings |
| exam-bank-operations SKILL.md ×6 | Projects/co-learning → templates/co-learning {skills, .agents, .claude, .gemini, .hermes, .codex}/skills/exam-bank-operations/ | 1.1.0 → 1.2.0 | §5 Invigilation policy + §6 Misconduct handling (DEC-20261007-01), tags extended |
| SKILLS.md registry row | → templates/co-learning/skills/SKILLS.md | 1.2.0, 2026-10-07 | note merged with scope text |
| lifecycle record | → templates/co-learning/docs/lifecycle/skills/exam-bank-operations.md | v1.2.0 row | 2026-10-07 history entry appended |

## R2 — Deliberate exclusions

- **html-build SKILL presentations→deliverables flip**: the project reflects the
  fleet's deliverables/ consolidation, but templates/co-deck still SCAFFOLDS
  presentations/. Flipping the doc without the scaffold tree makes the template
  self-inconsistent; the scaffold-dir migration is a dedicated decision (freeze-
  lift upgrade-visit class), not a wholesale copy.
- **inject-video-players project side stays 1.3.0**: template is ahead (1.3.1
  deck-relative binding fix); the project picks it up at its next upgrade visit.
- **co-learning agents/pm.md, i18n-specialist.md, SKILLS.md format, README**:
  template is AHEAD (ADR-0033 extends pattern, registry format, i18n sync
  frontmatter) — upgrade-visit territory, not backport material.
- **co-learning project-local roster** (8 agents, two-streams README, variant.json
  roster): instantiation-specific — project's own hires per T-20261114-003.
- **exam-bank-steward.md**: project diff is `[Project Name]`→`co-learning`
  placeholder instantiation only.
- **project settings.json pm-dispatch-gate duplicate** (2 entries vs template's 1):
  project-side defect; recorded as evidence, not template material (fix belongs to
  the co-learning project session).

## R3 — T-20261114-013 promotion decision (owner decision, made per user instruction)

The exam-bank v1.2.0 additions (invigilation policy, misconduct handling) are
education-generic: no project names, no engagement data, policy applies to any
exam-operations context. The user's backport instruction is the owner decision;
the promotion proceeds with DEC-20261007-01 as the recorded source decision.

## R4 — T-20261114-011 fix (option b from the ticket)

Reword the workflows.md boundary-rules citation to drop the unresolvable
`docs/designs/...` path (design doc exists only in the project repo): cite
DEC-20261007-01 with a provenance qualifier. The three boundary rules stay as
the normative text. Template copy only — the project copy's citation resolves.

## R5 — Tickets

- T-20261114-013 → resolved fixed (promotion landed; owner decision recorded).
- U-20261114-007 → resolved duplicate (its 4 items are the same set U-20261114-009
  carries, filed 2026-11-14 19:40 with explicit "not yet covered by U-20261114-006/
  -007/-008" scoping; U-009 is the live tracking ticket).
- U-20261114-009 → stays waiting; result note updated (storyline Step 3.5 landed;
  the bullet-context doctrine, Humanize lint, generator-parity and download-videos
  subs mode remain unimplemented in BOTH project and template — surveyed).
- T-20261114-011 → resolved fixed (citation reworded; grep clean).

## Acceptance

- validate-templates, verify-scripts, audit --spec-check, bun test all green.
- Platform-mirror parity: all 6 storyline copies at 1.3.0, all 6 exam-bank copies
  at 1.2.0.
- No unresolved docs/designs/ path in templates/co-learning/docs/governance/
  agents/workflows.md.
- VERSION_MANIFEST regenerated (validator 1.4.1, storyline 1.3.0, exam-bank 1.2.0).
