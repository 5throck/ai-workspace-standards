# SKILLS.md — Skill Lifecycle Registry

Curated registry for the co-work skills (T-20260925-005). One row per skill directory; values come from each skill's SKILL.md frontmatter. The auto-generated index this file replaces was produced by verify-skills.ts — converting this file to a curated registry opts the variant out of legacy-index regeneration.

> API Documentation, Documentation Writing, and Research Analysis were promoted to `templates/common/skills/` (scope: common) — inherited automatically, no longer listed here as variant-local skills.

## Registry

| skill | version | status | owner | last_reviewed | removal-date | notes |
|-------|---------|--------|-------|---------------|--------------|-------|
| `standup-synthesizer` | 1.0.1 | active | pm | 2026-10-08 | — | co-work only — Automated daily standup digest synthesizer aggregating git commit logs, issue status updates, pull… Forked from root `skills/standup-synthesizer` (variant-maintained): Related-Skills entries rendered as prose because the root copy's relative `../` links do not resolve in a scaffolded co-work project. |
| `svg-slide-authoring` | 1.1.1 | active | pm | 2026-11-03 | — | co-work only — Canonical SVG slide authoring language (closed whitelist, px viewBox, #RRGGBB, locked registry tokens). Used by deck-builder; spec 2026-11-03-co-work-native-pptx-deck-design. |
| `svg-quality-gate` | 1.1.0 | active | pm | 2026-11-03 | — | co-work only — Dual quality gate (early method sample + final), three-severity model, content-SSOT text-run diff, SHA-256 fingerprint reports. Runs scripts/svg-check.ts. |
| `pptx-export` | 1.1.0 | active | pm | 2026-11-03 | — | co-work only — Fingerprint-verified svg-to-pptx compilation into natively editable DrawingML + postflight receipt + PNG previews for the visual-judge gate. |

## Usage

Skills are invoked by the PM orchestrator or team members using the trigger phrases defined in each `SKILL.md` file.

---

*Maintained by: co-work variant team*
