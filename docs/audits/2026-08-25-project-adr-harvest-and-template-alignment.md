# Project ADR Harvest & Template Alignment — Audit Notes

**Date**: 2026-08-25
**Scope**: Projects/co-* ADR corpora surveyed; findings reflected into variant templates.
**Trigger**: owner request — reflect project-level ADR content first, then align each variant template's ADR scaffolding with its actual current situation.

## 1. Survey

| Corpus | Files | Format | Themes |
|---|---|---|---|
| Projects/co-newbiz `docs/adr/` | 69 | prose status (`**Status**: Accepted`), NNNN-slug, includes amendment/errata/reversal chains (0048→0037, 0049→0016, 0050 errata, 0062 reversal) | kill-criteria executability + registry extensions, evidence-var plane, human-role registry, three-axis case model, procedure layering, decision anchors |
| Projects/co-architect `docs/adr/` | 18 | mixed frontmatter/prose, some Accepted | CAD intelligence pipeline, architecture knowledge graph (+ its own platform constitution ADR-017), MCP tool registry, COM-handler migration |
| Projects/co-price `docs/adr/` | 5 | NNNN-slug | Bun single-manager, governance-marker variant conversion, on-rails multi-provider copilot, deterministic engine modules |
| templates/co-* | 0 (pre-seed) | — | gap closed same-day by `docs/adr/README.md` seeds (12 copies) |

Root reference point: `docs/adr/` 45 files; `verify-adr-governance.ts --strict` PASS at survey time.

## 2. Classification of harvest candidates

- **(i) Instance-specific** (majority): deal-domain rulings, CAD pipeline internals, price-engine modules — stay project-local by design (workspace ADR-0060 amendment already refuses porting registries without generic backing).
- **(ii) Template-relevant patterns** — already absorbed upstream this cycle: supersession-not-deletion discipline ↔ DEC standard (ADR-0061); documents-before-code ↔ Design Gate; human-role exemption ↔ graph projection v0.2.0.
- **(iii) Workspace-generalizable backlog** (recorded, not acted on):
  - Project ADR **status formats are split** between frontmatter and `**Status**:` prose lines across repos — harmless today (root validator tolerates both), but a future cross-repo ADR lint should pick one canonical shape.
  - co-architect ADR-017 (knowledge-graph platform constitution) is sibling practice to workspace ADR-0060 — worth a cross-reference if that repo ever joins the workspace governance corpus.

## 3. Reflected changes (this PR)

1. Each variant template's `docs/adr/README.md` gains a **Variant Anchor** section: its registered `[<PREFIX>-R1]` rule (location cited) plus 2–3 grounded "likely first records" themes derived from that variant's current gates/assets — so the first engagement writes decision records that land correctly instead of inventing conventions.
2. Common seed README stays generic; variants differentiate.

## 4. Not done / why

- Back-porting project ADR *files* into templates: rejected — template is the upstream SSOT; instance history belongs to instances.
- Editing Projects/* ADR formats for consistency: out of scope here (separate repos); recorded as backlog item (iii).
