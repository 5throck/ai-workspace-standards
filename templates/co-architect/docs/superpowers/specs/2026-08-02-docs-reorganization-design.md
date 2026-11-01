# docs/ Reorganization — Design Spec

**Date:** 2026-08-02
**Status:** Approved (brainstorming stage) → pending implementation plan
**Branch:** `chore/docs-reorganization` (off `main`)

## 1. Problem

Design and planning documents are scattered across six `docs/` subdirectories, with two outright inconsistencies:

1. **ADRs live in two places.** `docs/adr/` holds `0036-scripts-typescript-only.md`, `0037-cad-agent-modularization.md` (bare-number filenames). `docs/designs/` holds `ADR-001`…`ADR-015` (prefix filenames; the sequence skips `ADR-003` — no such file was ever created, a benign gap, not a live broken reference). 16 project ADRs total, two numbering schemes, two folders.
2. **Plans live in two places.** `docs/plans/` (4 older roadmaps) and `docs/superpowers/plans/` (22 brainstorming-skill outputs). Specs exist only as `docs/superpowers/specs/` (23).
3. **`docs/designs/` is a catch-all** (48 files) mixing ADRs, feature designs, a plan (`MCP-000-zwcad-mcp-server-plan`), a changelog (`ELEV-001-v1-changelog`), and a postmortem (`POSTMORTEM-010-mcp-tool-registry`).

Root cause: no enforced taxonomy. Material accreted wherever was convenient at the time, and the brainstorming skill hardcodes `docs/superpowers/specs/` as its output path, creating an origin-based split that was never made intentional.

## 2. Goals

- Co-locate all project ADRs in `docs/adr/`.
- Give `docs/designs/` and `docs/plans/` crisp, non-overlapping roles via an explicit **origin rule**.
- Fold single-file directories that don't earn their own slot (`programs/`).
- Prune untracked local-generated cruft from the repo root.
- Preserve every cross-reference (no broken links).

## 3. Non-goals (explicitly out of scope)

- Unifying the ADR filename format (`0036-slug` vs `ADR-NNN-slug`). Both are heavily referenced by path **and** by ID (e.g. `ADR-007 Rule 1` in MCP tool docstrings, `ADR-015` in ADR-015 itself); renaming would break dozens of refs. Recorded as a separate future cleanup.
- Renumbering ADRs into one sequence.
- Moving or renaming anything under `docs/superpowers/` (the brainstorming skill's output zone — kept as-is per the "keep superpowers/" constraint).
- Touching the already-clean zones: `reference/` (except adding `POSTMORTEM-010`), `guides/`, `research/`, `release/` (except adding the ELEV changelog), `firm-governance/` (except absorbing the program doc), loose `docs/*.md`.
- Editing `CHANGELOG.md` historical entries (it is an immutable log; stale paths there are expected).

## 4. Organizing principle — the origin rule

Because `docs/superpowers/` must remain the brainstorming skill's output zone, the split between hand-written and skill-generated material is made **intentional** rather than accidental:

| Directory | Role | Origin |
|---|---|---|
| `docs/adr/` | All decision records (numbered) | any origin |
| `docs/designs/` | Hand-written feature/technical designs | manual |
| `docs/plans/` | Hand-written plans/roadmaps | manual |
| `docs/superpowers/specs/` | Skill-generated design specs | brainstorming skill |
| `docs/superpowers/plans/` | Skill-generated implementation plans | brainstorming skill |

This dissolves the `designs/` ↔ `superpowers/specs/` overlap (both are technical designs; the only difference is origin) by giving each a non-overlapping slot.

## 5. Target tree

```
docs/
├── adr/            ← ALL project ADRs (16)
├── designs/        ← feature designs only (~31)
├── plans/          ← hand-written plans/roadmaps (5)
├── superpowers/    ← UNCHANGED (plans/ + specs/)
├── firm-governance/← + production-readiness-program.md (absorbs programs/)
├── reference/      ← UNCHANGED (+ POSTMORTEM-010)
├── guides/         ← UNCHANGED
├── research/       ← UNCHANGED
├── release/        ← v3.md + ELEV-001-v1-changelog.md
└── (loose docs/*.md — UNCHANGED)
```

`docs/programs/` is removed (empty after the single file moves).

## 6. Move map (18 file moves + 3 local-dir deletions)

All moves use `git mv` to preserve history.

### 6.1 ADRs → `docs/adr/` (14 files, names preserved)

`docs/designs/ADR-001-architecture-graph.md`
`docs/designs/ADR-002-com-bridge-v3-versioning-design.md`
`docs/designs/ADR-004-cad-intelligence-pipeline-design.md`
`docs/designs/ADR-005-architecture-graph-schema.md`
`docs/designs/ADR-006-pattern-dsl-recognition-engine.md`
`docs/designs/ADR-007-appspec-rendering-architecture.md`
`docs/designs/ADR-008-command-versioning-editing.md`
`docs/designs/ADR-009-pipeline-execution-framework.md`
`docs/designs/ADR-010-mcp-tool-registry.md`
`docs/designs/ADR-011-handler-result.md`
`docs/designs/ADR-012-validation-layer.md`
`docs/designs/ADR-013-com-handler-migration.md`
`docs/designs/ADR-014-request-scoped-derived-cache.md`
`docs/designs/ADR-015-reasoning-pipeline-gap-bridging.md`

(The sequence skips `ADR-003` — no such file was ever created. A precise `grep -rn "ADR-003[^0-9]"` confirms no live reference to it exists; the gap is benign.)

### 6.2 Other extractions from `docs/designs/`

| File | Destination |
|---|---|
| `MCP-000-zwcad-mcp-server-plan.md` | `docs/plans/` |
| `ELEV-001-v1-changelog.md` | `docs/release/` |
| `POSTMORTEM-010-mcp-tool-registry.md` | `docs/reference/` |

### 6.3 `docs/programs/` dissolution

| File | Destination |
|---|---|
| `production-readiness-program.md` | `docs/firm-governance/` |

`docs/programs/` directory removed once empty.

### 6.4 Root local-cruft deletion (untracked, gitignored — no git impact)

| Path | Size | Action |
|---|---|---|
| `output/` | 21M / 60 files | delete |
| `workflow_output/` | 16K / 2 files | delete |
| `backups/` | empty | delete |

## 7. Cross-reference update strategy

Discovery is grep-driven. Run after the `git mv`s and edit every path ref found (the ID refs are unaffected because ADR numbers are preserved).

### 7.1 Docs whose **path** references must update

`grep -rn "docs/designs/ADR-\|docs/designs/MCP-000\|docs/designs/ELEV-001-v1-changelog\|docs/designs/POSTMORTEM-010\|docs/programs/" --include="*.md"` (excluding `node_modules/`, `.venv/`) yields the actual ref-holders (verified during spec review):

- **`docs/README.md`** — documents the current taxonomy: `designs/` described as holding "Architecture Decision Records (ADR series)" and `programs/` as a distinct category, plus a placement-rule flow. Must rewrite the `designs/` row (now feature designs only), delete the `programs/` row, and revise the placement-rule flow. *(This is the most visible user-facing doc affected.)*
- **`docs/designs/DOCS-001-design.md`** — cross-links ADR-002/005/006/007/008 by path, contains a `docs/designs/ELEV-001-v1-changelog.md` path ref at line ~123 (a deprecated-file table row that breaks when that file moves to `release/`), **and** contains the addendum that established `docs/programs/` (see §10 risk R3). Update all three.
- **`docs/designs/PKG-001-cad-intelligence-restructure-design.md`** — `ADR-001` path ref.
- **`docs/designs/AI-002-graph-driven-rendering-design.md`** — `ADR-001`, `ADR-002` path refs.
- **`docs/designs/ADR-002-com-bridge-v3-versioning-design.md`** — `ADR-001` path ref (self-moving file; update its content, then move).
- **`docs/designs/POSTMORTEM-010-mcp-tool-registry.md`** — `ADR-010` path ref (self-moving file).
- **`docs/designs/TEST-001-design.md`**, **`PACKAGING-001-design.md`**, **`CLOSED-LOOP-001-design.md`** — `docs/programs/` path refs (programs/ is dissolving).
- **`docs/plans/2026-07-09-v3-completion-roadmap.md`** — `ADR-007`, `ADR-001`, `docs/programs/` path refs.
- **`docs/reference/cad-system-roadmap.md`** — `MCP-000` path ref.

### 7.2 Expected false positives (do NOT edit)

`grep -rn "docs/designs/ADR-" --include="*.py" --include="*.md"` also surfaces ~16 hits under `src/cad_intelligence/**/*.py` and 4 platform copies of `skills/generate-room-elevation/SKILL.md` — all pointing at **`docs/designs/ADR-face-elevation-architecture.md`**, which **STAYS** in `designs/` (see R4). These must not be edited; filter them out during implementation.

### 7.3 Untouched references

- **ID references** (`ADR-007 Rule 1` in MCP tool docstrings, `ADR-015`, `ADR-0036`) — untouched; ADR numbers preserved so ID refs still resolve.
- **`CHANGELOG.md`** and **`memory/*.md`** — left as-is (immutable historical logs; stale paths there are expected, same exemption granted to both).

### 7.4 Post-move verification

Re-run the §7.1 grep after edits; the only remaining hits should be the §7.2 false positives (pointing at the stationary `ADR-face-elevation-architecture`) and the §7.3 historical logs.

## 8. Audit impact

`scripts/audit.ts` enforces only: (a) no non-standard `.md` at project root, (b) `docs/research/*.md` has `## References`. Neither depends on the `adr/` ↔ `designs/` split. Audit stays green. The reorganization adds no new files at root and touches no `docs/research/` file.

## 9. Verification

- `git mv` preserves history; `git log --follow` resolves on the new path.
- Post-move grep matches **only** the §7.2 false positives (stationary `ADR-face-elevation-architecture` in `src/` + `skills/`) and the §7.3 historical logs (`CHANGELOG.md`, `memory/*.md`) — per §7.4.
- `bun scripts/audit.ts` exits 0.
- `pytest` unaffected (no source code under `docs/`).
- `/sync "chore(docs): reorganize scattered design and plan docs"` to commit, push, and open the PR.

## 10. Risks

- **Missed path reference** → broken link. Mitigation: grep-driven discovery + the ID refs being unaffected.
- **R3 — `docs/programs/` removal reverses the DOCS-001 addendum.** `docs/designs/DOCS-001-design.md` (lines ~255–275) has a formal addendum that deliberately *established* `docs/programs/` with rationale ("plans are time-boxed and become historical; programs persist across many sprints") and recorded `docs/README.md` as reflecting this. Dissolving `programs/` therefore **reverses a recorded taxonomy decision**, not merely a one-file slot-saving. This is accepted deliberately: with a single occupant (`production-readiness-program.md`), the plans-vs-programs distinction is unobservable in practice and does not earn a permanent top-level category — the doc moves to `firm-governance/` (the strategic-material home). DOCS-001's addendum and `docs/README.md` are updated in §7.1 to record the reversal, so a future reader sees the rationale rather than re-creating the category.
- **R4 — `ADR-face-elevation-architecture` self-describes as an ADR.** The file's H1 reads `# ADR: Four-Domain Face-Centered Elevation Architecture` and contains a developed ADR chain (ADR-aa … ADR-jj with Exit Criteria), yet it has **no number** and is therefore not part of the numbered `ADR-NNN` decision-record sequence that moves to `adr/`. Classification: it **stays** in `designs/` as a feature/architecture design. The decision is by sequence membership (numbered → `adr/`; unnumbered → `designs/`), documented here so it does not appear arbitrary.
