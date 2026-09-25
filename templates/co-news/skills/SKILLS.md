# SKILLS.md — Skill Lifecycle Registry

Curated registry for the co-news skills (T-20260925-005). One row per skill directory; values come from each skill's SKILL.md frontmatter. The auto-generated index this file replaces was produced by verify-skills.ts — converting this file to a curated registry opts the variant out of legacy-index regeneration.

## Registry

| skill | version | status | owner | last_reviewed | removal-date | notes |
|-------|---------|--------|-------|---------------|--------------|-------|
| `ai-tell-reduction` | 1.0.0 | active | style-editor | 2026-08-10 | — | co-news only — Guides style-editor through reducing "AI-tell" patterns in generated prose so articles read as… |
| `financial-infographic-svg` | 1.0.1 | active | visual-editor | 2026-08-24 | — | co-news only — Guides visual-editor through turning a financial-narrative-brief's structured data into inline SVG… |
| `financial-journalism-style` | 1.0.0 | active | style-editor | 2026-08-10 | — | co-news only — Guides style-editor (and reporter during drafting) through house-style conventions for Korean… |
| `financial-narrative-brief` | 1.0.1 | active | financial-analyst | 2026-08-26 | — | co-news only — Guides financial-analyst through converting raw k-dart DART data into an article-ready narrative… |
| `source-verification-ledger` | 1.0.1 | active | fact-checker | 2026-08-24 | — | co-news only — Guides fact-checker through the newsroom's source-verification discipline — every material claim in… |
| `style-lint-checklist` | 1.0.1 | active | style-editor | 2026-08-26 | — | co-news only — Pre-publication lint pass that encodes the financial-journalism style guide's top rules as… |

## Usage

Skills are invoked by the PM orchestrator or by individual agents using the trigger phrases defined in each `SKILL.md` file.

See [`agents/README.md`](../agents/README.md) for the full workflow and agent handoff chain.

---

*Maintained by: co-news variant team*
