# SKILLS.md — Skill Lifecycle Registry

Curated registry for the co-utility variant-exclusive skills (T-20260924-009 pattern). One row per variant-exclusive skill directory; values come from each skill's SKILL.md frontmatter.

> **SSOT note**: This registry is the single source of truth for co-utility variant-exclusive skill lifecycle records (`version`, `status`, ownership). Per-skill history notes in `docs/lifecycle/skills/<name>.md` are supporting records and must stay consistent with this registry.

## Registry

| skill | version | status | owner | last_reviewed | removal-date | notes |
|-------|---------|--------|-------|---------------|--------------|-------|
| `post-write-check` | 1.0.0 | active | qa | 2026-11-19 | — | 1.0.0 initial release — mandatory post-write quality gate (workspace audit + project test suite); doctrine from the QuickDL engagement |

## Usage

Skills are invoked by the PM orchestrator or team members using the trigger phrases defined in each `SKILL.md` file.

---

*Maintained by: co-utility variant team*
