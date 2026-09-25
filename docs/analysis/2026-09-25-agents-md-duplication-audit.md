# AGENTS.md Duplication Audit — L0 (AGENTS↔CONSTITUTION) and L1/L2 (AGENTS↔context.md)

- **Date**: 2026-09-25
- **Type**: Duplication audit report (evidence input to `docs/designs/2026-09-25-agents-md-size-reduction-design.md`; decides nothing by itself)
- **Method**: section-level self-joins and cross-joins over all 15 AGENTS.md files, CONSTITUTION.md, `templates/common/docs/context.md`, and 13 `templates/co-*/docs/<variant>.context.md`, reusing the workspace's own similarity primitives (`scripts/helpers/context-sections.ts`: `computeLineOverlapSimilarity`, `computeTokenOverlapSimilarity`, `splitIntoSections`). Grades: HIGH ≥ 0.8, MED 0.6–0.8, LOW 0.5–0.6. Managed marker zones reported separately as intentional duplication. Measurement script: one-off (`tests/.temp/`, not shipped).
- **Companion**: size companion piece in `docs/analysis/2026-09-25-agents-md-size-analysis.md`.

---

## 1. Findings Summary

| # | Tag | Finding | Grade | Size |
|---|---|---|---|---|
| F1 | `[DUP-INT]` | L0 AGENTS.md: the COMMON-AGENTS zone's ADR summaries are near-verbatim copies of owned §3 subsections (§3.9/§3.10/§3.11) | HIGH (tok 0.89–0.97) | ~2.5k duplicated |
| F2 | `[DUP-CROSS]` | L0: PM Gateway workflow maintained in BOTH AGENTS.md §3 (13,569B) and CONSTITUTION §5.5 (5,081B) | MED (tok 0.66) | 5.1k duplicated |
| F3 | `[DUP-INT]` | Every variant: §1 roster table vs §2 agent definitions restate the same agent data | HIGH (tok 0.83–0.94 on 13/13) | 1.5–15k per file |
| F4 | `[RULE-GAP]` | Variant context.md `## Agents` sections are unenforced subsets of the AGENTS.md roster — the "keep in sync" constitution rule has zero enforcement and is unmet fleet-wide | measured | — |
| F5 | `[DUP-CROSS]` | "Computational Integrity" rule text restated in ~8 variant context.md files vs AGENTS.md §7 | MED (tok 0.68) | 448B × 8 |
| F6 | `[FORMAT-DRIFT]` | Roster representations diverge: co-price 15-row table vs co-safety prose tree vs co-news absent; co-safety VARIANT-SECTION wrappers create doubled headings (### + ## same title, ×3) | — | — |
| F7 | `[RULE-GAP]` | audit.ts check #29 skips (WARN) when `## §6: Skills` is absent — 3 of 12 projects get NO skill-table integrity check (co-price: template-inherited absence; co-architect: heading variant `## Skills`; co-newbiz: standalone structure, future variant) | — | — |
| F8 | `[DUP-CROSS]` (intentional, healthy) | COMMON-CONTEXT zones are byte-identical across all 13 variants (2 zones, md5 `56d0c64635`/`435d5a3680` × 13) — injection machinery working; zone content (STE100 + PM authority + key rules) is by-design duplication of L0 governance | identical | 2,049B + 424B × 13 |

## 2. Detail

### F1 — L0 internal: zone vs owned §3 [DUP-INT]
Owned-vs-zone comparison (zone internals at H3 granularity vs marker-stripped owned sections):

| Zone section | vs owned section | token |
|---|---|---|
| `### LLM Work Routing Policy (ADR-0078)` (795B) | §3 PM Gateway Workflow (13,569B; §3.9) | **0.97** |
| `### Instruction Writing Standard (ADR-0079)` (934B) | §3 (§3.10) | **0.95** |
| `### PM Team-Management Authority (ADR-0080)` (793B) | §3 (§3.11) | **0.89** |
| `### Universal Design Gate (ADR-0074)` (536B) | §5 Execution Plan Templates (5,758B) | 0.63 |

Disposition candidate: single-home the ADR-0078/0079/0080 policy text in the owned §3 subsections; the zone keeps a one-line pointer (or vice versa — the marker zone's purpose is fleet injection, so the pointer direction should keep the ZONE as the injected carrier and slim the owned restatement, or drop the owned restatements if the zone travels to all consumers). Saves ~2.4k at L0 and removes future dual-maintenance drift.

### F2 — L0 cross-file: AGENTS §3 ↔ CONSTITUTION §5.5 [DUP-CROSS]
PM Gateway workflow is double-registered: AGENTS.md §3 (13,569B, the operational edition) vs CONSTITUTION §5.5 (5,081B, the governance edition) at token 0.66; §3 also overlaps CONSTITUTION §5 Multi-Agent Architecture (0.64) and §4 Other Workflows overlaps it (0.60). Notably CONSTITUTION §5.5 already practices the right pattern internally — it explicitly defers the execution-plan table to "AGENTS.md §5.1 (do not restate it here)". Extending that defer-don't-restate posture from §5.5 ↔ AGENTS §3 is the design's S4 candidate. Method note: CONSTITUTION's `## Terminology Definition` is a 58k catch-all section — H3-level splitting was required for meaningful numbers (L2-level comparison produces inflated token overlaps).

### F3 — Variant internal: §1 roster ↔ §2 definitions [DUP-INT]
All 13 variants show HIGH token overlap between §1 (roster tables) and §2 (agent definitions) — 0.83–0.94 in co-abap/co-consult/co-design/co-security/co-work — because §2 restates the roster with per-agent prose. This is data duplicated within-file; the size-reduction design's roster-generation decision (D4: generate from `variant.json` + `agents/*.md` frontmatter) directly addresses it.

### F4 — Roster sync rule is unenforced and unmet [RULE-GAP]
`docs/constitution/01-folder-structure.md:60` requires AGENTS.md to stay in sync with `docs/context.md ## Agents`. Measured reality (context `## Agents` vs AGENTS §1/§2 roster):

| Variant | AGENTS roster rows | context `## Agents` rows | Notes |
|---|---:|---:|---|
| co-abap | 44 | 20 | context missing PM + specialists |
| co-consult | 22 | 11 | subset |
| co-deck | 24 | 15 | subset |
| co-design | 19 | 8 | subset |
| co-develop | 18 | 7 | subset |
| co-export | 21 | 10 | subset |
| co-game | 24 | 13 | subset |
| co-hr | 23 | 24 | near-parity but header cells counted (format drift) |
| co-news | 18 | 0 | no usable table |
| co-price | 22 | 15 | subset |
| co-safety | 51 | 0 | prose tree, not a table |
| co-security | 17 | 6 | subset |
| co-work | 18 | 7 | subset |

Every context `## Agents` is a strict subset (systematically missing PM and i18n-specialist at minimum). No script enforces this rule today (validate-templates Check 9 compares Skills paths only; WS-09 requires only an `Agents` heading to exist). Disposition candidates: generate the context `## Agents` section from the same roster SSOT as AGENTS.md, or drop the rule text — an unenforced rule that is 13/13 unmet is worse than no rule.

### F5 — Computational Integrity restatement [DUP-CROSS]
AGENTS.md §7 Universal Baseline Behaviors ↔ context.md `## Computational Integrity` (448B) at token 0.68 in ~8 variants — the rule text is carried in both files. Disposition candidate: single-home in AGENTS.md §7; context.md keeps the pointer (or accept — 448B × 13 is small).

### F6 — Format drift [FORMAT-DRIFT]
Three roster representations coexist (co-price table / co-safety prose tree / co-news absent); co-safety's `VARIANT-SECTION` wrappers emit doubled headings (`### Governance Workflow` + `## Governance Workflow`, ×3). Feeds the size-reduction design's normalization work.

### F7 — §6-integrity check blind spot [RULE-GAP]
`audit.ts` check #29 (T-20260910-016) matches exactly `^## §6: Skills`; absence → `Warn('AGENTS.md §6: Skills section not found — skill-table integrity check skipped')`. Fleet scan: 9/12 projects have the exact heading; 3 skip the check entirely — co-price (template `templates/co-price/AGENTS.md` lacks §6 — the only variant template without it — so scaffolded projects inherit the absence), co-architect (has `## Skills` in a non-matching heading format — a false negative), co-newbiz (standalone structure; slated to become a variant). Remediation handled directly in this PR: co-price template §6 added (from its 22-row registry), co-architect heading normalized, co-newbiz §6 generated from its own inventory with the future variant-promotion note.

### F8 — COMMON-CONTEXT zones: intentional duplication, healthy [DUP-CROSS]
Both zones byte-identical across 13 variants (md5 `56d0c64635` ×13, `435d5a3680` ×13) — the marker-inject machinery is fully in sync (the dev-sync 4.55 WARN-stage drift concern does not fire today). The zones themselves restate STE100 + PM-authority + key-rules content by design; whether that content should keep traveling as an injected zone or collapse into a pointer is a design decision, not a drift problem.

## 3. Method Notes & Measurement Caveats

- `stripMarkerZones` handles **COMMON-CONTEXT only** — there is no COMMON-AGENTS equivalent in `scripts/helpers/context-sections.ts`, so AGENTS.md zone-stripping required special-casing in this audit. Tooling gap worth closing if AGENTS.md checks multiply.
- Stub sections (e.g. L0 §2 is a 185B pointer to `agents/`) produce degenerate line-overlap 0.50 pairs; comparisons used a ≥300-byte body filter where noted.
- CONSTITUTION.md's `## Terminology Definition` spans ~58k bytes (its trailing `## Manual Annotations Section` swallows §6.7–§11); all CONSTITUTION comparisons were run at H3 level to avoid bag-of-tokens inflation.
- co-abap's AGENTS.md was under active revision by a parallel session during measurement; its §4 (21,489B) figures may shift when that work lands.

## 4. Inputs to the Size-Reduction Design

1. F1+F2 justify the L0 diet (D5) beyond byte count: the duplications are dual-maintenance liabilities, not just weight.
2. F3 strengthens roster generation (D4): within-file restatement disappears when §1/§2 generate from SSOT.
3. F4 adds a decision the design must make explicitly: roster sync with context.md becomes either generated (preferred) or de-ruled.
4. F7's remediation closes the check blind spot independently of the size work.
5. F8 confirms the injection machinery needs no repair — design effort can stay on the owned bodies.
