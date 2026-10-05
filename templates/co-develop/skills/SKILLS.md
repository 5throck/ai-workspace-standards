# SKILLS.md — Skill Lifecycle Registry

Curated registry for the co-develop variant-exclusive skills (T-20260924-009). One row per variant-exclusive skill directory; values come from each skill's SKILL.md frontmatter.

> **SSOT note**: This registry is the single source of truth for co-develop variant-exclusive skill lifecycle records (`version`, `status`, ownership). Per-skill history notes in `docs/lifecycle/skills/<name>.md` are supporting records and must stay consistent with this registry.

## Registry

| skill | version | status | owner | last_reviewed | removal-date | notes |
|-------|---------|--------|-------|---------------|--------------|-------|
| `code-review` | 1.0.0 | active | pm | 2026-07-19 | — | co-develop only — correctness/maintainability/security-focused code reviews |
| `refactoring` | 1.0.0 | active | pm | 2026-07-19 | — | co-develop only — behavior-preserving structural improvement |
| `swe-solve` | 1.1.1 | active | pm | 2026-08-25 | — | co-develop only — autonomous issue-to-PR resolution pipeline |
| `test-driven-development` | 1.0.0 | active | pm | 2026-07-19 | — | co-develop only — TDD red-green-refactor implementation |

## Usage

Skills are invoked by the PM orchestrator or team members using the trigger phrases defined in each `SKILL.md` file.

---

*Maintained by: co-develop variant team*
