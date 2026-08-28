---
status: "Accepted"
---

# ADR-0005: Documentation Consolidation and Lowercase Naming Standard

**Status**: Accepted
**Date**: 2026-08-25
**Deciders**: pm, ux-specialist, l10n-auditor

## Context

The `docs/` folder had grown by accretion with two structural problems:

1. **Naming inconsistency**: nine files used SCREAMING_UPPERCASE names
   (`BIZ_LOGIC.md`, `PRD.md`, …) while others were lowercase (`context.md`,
   `security.md`). Reference hygiene suffered — 100+ occurrences across 29 files,
   including Vitest `[Ref: BIZ_LOGIC.Section_X]` tags.
2. **Duplication and misplacement**:
   - `deployment.md` overlapped `architecture.md` §5–§6 almost entirely
     (standalone build, NEXTAUTH_URL trust, cookie protocol both described twice).
   - `harness_protocol.md` duplicated the procedure that
     `skills/harness-verification/SKILL.md` is the authoritative home for per the
     AGENTS.md Harness Workflow (a 15-line summary pointing at an 85-line orphan).
   - `SKILLS.md` (the skills catalog) lived in `docs/` although the workspace
     convention places skill catalogs at `skills/SKILLS.md` (ai_workspace root and
     co-newbiz pattern).

## Decision

1. **Lowercase filenames** for all docs: `architecture.md`, `biz_logic.md`,
   `design.md`, `deployment.md`(→merged), `erd.md`, `glossary.md`,
   `harness_protocol.md`(→absorbed), `prd.md`. All 29 referencing files updated in
   the same change, including test-tag strings.
2. **Merge `deployment.md` into `architecture.md` §5–§6**; unique operational content
   (troubleshooting table, manual setup, standalone run command) preserved.
3. **Absorb `docs/harness_protocol.md` into `skills/harness-verification/SKILL.md`**
   (now v2.1.0) as the single authoritative procedure.
4. **Move the catalog: `docs/SKILLS.md` → `skills/SKILLS.md`**, with new
   `skills/README.md` + `README_ko.md` describing layout and index rules.
5. `prd.md` roadmap synced with the v10.1 execution plan.

Result: `docs/` reduced from 13 to 11 files with no orphaned references.

## Consequences

- One home per concern: specs in `docs/`, procedures in `skills/`, catalogs beside
  their subjects.
- `[Ref:]` tag strings now match the on-disk filename (`[Ref: biz_logic.…]`),
  keeping grep-based traceability exact.
- Future doc additions must use lowercase kebab-case names and declare their owner
  agent in the PR body.
