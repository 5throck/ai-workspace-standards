# Governance Docs Diet Analysis

**Date**: 2026-07-11
**Scope**: Duplication measurement across the mandatory session-start read set (`CLAUDE.md`, `GEMINI.md`, `CONSTITUTION.md`, `AGENTS.md`, plus the four required `docs/constitution/*.md` files) and consolidation recommendations. Analysis only — no governance documents modified in this report.

---

## 1. Session-Start Context Load

Per `CONSTITUTION.md` §"Session start checklist", every session must read:

| File | Lines | Words |
|---|---:|---:|
| `CONSTITUTION.md` | 569 | 4,390 |
| `AGENTS.md` | 630 | 4,931 |
| `CLAUDE.md` (or `GEMINI.md`) | 318 (308) | 2,619 (2,456) |
| `docs/constitution/00-ssot-architecture.md` | 78 | — |
| `docs/constitution/05-multi-agent-architecture.md` | 191 | — |
| `docs/constitution/08-coding-guidelines.md` | 107 | — |
| `docs/constitution/09-operations-workflow.md` | 263 | — |
| **Total (Claude Code session)** | **2,156 lines** | **~12,000+ words** | 

This is the *minimum* mandatory read set for every session at the workspace root, before any project-specific work begins — and does not include `memory/MEMORY.md`, per-agent files, or skill files also loaded per the checklist.

## 2. Confirmed Duplication

### 2.1 Execution Plan boilerplate table
The `| # | Task | Agent | Tier | Model | Spec |` table header (and its accompanying Design Gate / boilerplate rules) is rendered **5 separate times across 4 files**:
- `CLAUDE.md:210`
- `GEMINI.md:193`
- `CONSTITUTION.md:146` (abbreviated form, no `Spec` column)
- `AGENTS.md:375`, `AGENTS.md:412`, `AGENTS.md:427`, `AGENTS.md:439` — **4 occurrences within the same file** (§5.1 template, §5.2 platform-parity variant, and two worked examples in §5.3)

Each rendering carries near-identical prose around it ("Design Gate (Row 0) is MANDATORY...", "`/sync` is always the final step..."), meaning the same governance rule is maintained in up to 5 places. A change to the boilerplate (e.g., adding a column) requires editing all 5 to stay consistent — exactly the kind of drift this session's other workstreams (VERSION_MANIFEST parser, M-items) were fixing for code.

### 2.2 Three-tier model strategy
The High/Medium/Low tier definitions and their model mappings appear, in varying wording, **6 times**:
- `CLAUDE.md:249-251`
- `GEMINI.md:147-149`
- `AGENTS.md:172` (§3.6), `AGENTS.md:273-274` (§4.1, different wording than §3.6 in the same file)
- `CONSTITUTION.md:123` (condensed, inline in §5 prose)

`AGENTS.md` itself has two non-identical descriptions of the same tier system in two different sections — a within-file duplication, not just cross-file.

### 2.3 What is already well-consolidated (positive finding)
Not everything is duplicated — some rules follow good SSOT practice already:
- **PM Gateway "Single Point of Entry" rule**: stated once in `AGENTS.md` §3.1, referenced (not restated) from `CLAUDE.md` and `GEMINI.md`.
- **4-level enforcement model table** (Level 1-4 trigger/action/specialist): stated once in `CONSTITUTION.md` §5.5, referenced elsewhere via anchor links.

These two are useful templates for how the duplicated sections above (§2.1, §2.2) should be refactored.

## 3. Consolidation Recommendations

1. **Execution Plan boilerplate → single source in AGENTS.md §5.1 only.** Replace the 3 external copies (`CLAUDE.md`, `GEMINI.md`, `CONSTITUTION.md`) with a link to `AGENTS.md#51-standard-execution-plan-template`, matching the pattern already used for the PM Gateway rule. Within `AGENTS.md` itself, collapse the 4 internal occurrences to 1 template + worked examples that reference the template's column definitions instead of re-declaring them (the two worked examples in §5.3 can keep their own table *rows* — the actual example data — without re-explaining what each column means).
2. **Three-tier strategy → single source in `AGENTS.md` §3.6.** Replace `CLAUDE.md`/`GEMINI.md`'s inline restatements with a link (each platform file only needs to add its own model-ID mapping table, which is legitimately platform-specific and should stay local — the *concept* of High/Medium/Low is what's duplicated, not the model names). Resolve the two non-identical descriptions inside `AGENTS.md` itself (§3.6 vs §4.1) into one.
3. **Use the `intentional-duplicate` annotation (already defined in `CONSTITUTION.md` §10) for anything kept inline for AI context-proximity reasons.** If a maintainer decides some repetition is worth keeping (e.g., so a Claude Code session doesn't need to jump to `AGENTS.md` mid-task), annotate it explicitly per the existing convention rather than leaving unannotated silent duplication — this makes the duplication a documented, intentional trade-off instead of drift risk.
4. **Not recommended: touching `docs/constitution/*.md`.** These four files are already single-purpose, appropriately-scoped, and did not show the same duplication pattern in this analysis — no changes suggested there.

## Summary

### Findings
- Mandatory session-start reading is ~2,150 lines / ~12,000+ words before any task-specific work begins.
- The Execution Plan boilerplate table is duplicated 5 times across 4 files (4 of those within `AGENTS.md` alone).
- The three-tier model strategy explanation is duplicated 6 times across 4 files, including two non-identical versions within `AGENTS.md` itself.
- The PM Gateway single-entry-point rule and the 4-level enforcement table are **not** duplicated — they already follow a link-out SSOT pattern that should be the template for fixing §2.1 and §2.2.

### Recommended Actions
- Consolidate the Execution Plan boilerplate to one definition in `AGENTS.md` §5.1, link-out from `CLAUDE.md`/`GEMINI.md`/`CONSTITUTION.md`, matching the existing PM Gateway link-out pattern.
- Consolidate the three-tier strategy concept to one definition in `AGENTS.md` §3.6; keep only platform-specific model-ID tables local to `CLAUDE.md`/`GEMINI.md`.
- Where duplication is kept deliberately, apply the existing `intentional-duplicate: CONSTITUTION.md §N` annotation convention rather than leaving it undocumented.

### Deferred Items
- No governance-doc edits were made in this session — this report is the analysis input for a future, separately-planned consolidation change (which itself would need a Design Gate document per CONSTITUTION §5.5, since it touches L0 governance files).
- A full accounting of every duplicated sentence/table across all `docs/constitution/*.md` files was not performed — this analysis focused on the two highest-volume, most load-bearing duplications (execution plan, tier strategy) found via targeted grep, not an exhaustive diff.
