# SKILLS.md — Skill Lifecycle Registry

Curated registry for the co-work skills (T-20260925-005). One row per skill directory; values come from each skill's SKILL.md frontmatter. The auto-generated index this file replaces was produced by verify-skills.ts — converting this file to a curated registry opts the variant out of legacy-index regeneration.

> API Documentation, Documentation Writing, and Research Analysis were promoted to `templates/common/skills/` (scope: common) — inherited automatically, no longer listed here as variant-local skills.

## Registry

| skill | version | status | owner | last_reviewed | removal-date | notes |
|-------|---------|--------|-------|---------------|--------------|-------|
| `svg-slide-authoring` | 1.5.1 | active | pm | 2026-11-07 | — | co-work only — Canonical SVG slide authoring language (closed whitelist, px viewBox, #RRGGBB, locked registry tokens). Used by deck-builder; spec 2026-11-03-co-work-native-pptx-deck-design; v1.5.0 composition patterns (two-column default, punchline band, data-hook, full-bleed background rect) + XML-entity spelling guidance per spec 2026-11-06-deck-pipeline-hardening-design. |
| `svg-quality-gate` | 1.2.0 | active | pm | 2026-11-07 | — | co-work only — Dual quality gate (early method sample + final), three-severity model, bidirectional content-SSOT text-run diff, SHA-256 fingerprint reports. Runs the python checker scripts/deck/svg_check.py 2.0.0 (v1.2.0 — Phase 2 port of the retired svg-check.ts; parity harness test_svg_check_parity.py keeps both implementations pinned). |
| `pptx-export` | 2.0.1 | active | pm | 2026-11-07 | — | co-work only — Engine swap (v1.4.0 → 2.0.0): pipeline = svg-check content-SSOT fingerprint gate (ours) → ppt-master-adapter translation → ppt-master v6.8.0 (MIT, github.com/hugohe3/ppt-master) deterministic chain verbatim → their delivery/OPC validation → postflight receipt; white-underlay resvg previews productionized as scripts/deck/render_previews.py 1.0.0 (v2.0.1 — resvg-py engine, previews render from OUR SVGs); svg-to-pptx.ts removed (Phase 2, 2026-11-07 — superseded pins moved to the python parity suite / ppt-master validators); MIT attribution + PyMuPDF/AGPL exclusion per DEC-20261106-04; pin + manifest per external-deps.json (install_dir `external/ppt-master/`, external-deps machinery). |

## Usage

Skills are invoked by the PM orchestrator or team members using the trigger phrases defined in each `SKILL.md` file.

---

*Maintained by: co-work variant team*
