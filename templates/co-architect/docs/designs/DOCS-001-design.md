# DOCS-001: docs/ Taxonomy Reorganization

> **Spec ID**: DOCS-001
> **Version**: 1.0 (design, unimplemented)
> **Status**: Approved — Open Items resolved 2026-07-04 (see §6 addendum). Ready for Phase 1 execution.
> **Created**: 2026-07-04
> **Authors**: Architect (docs-tree analysis + repo-wide reference grep)
> **Source**: PM survey of `docs/` scattering/duplication, escalated for a Design Gate deliverable
> **Risk**: 🔴 High — touches far more than 3 modules (38 doc files + inbound references from `CLAUDE.md`-adjacent docs, `docs/README.md`, and one source-code comment). Per `agents/architect.md` constraints, this doc is a plan only; no file has been moved, renamed, or edited other than this one.

---

## 1. Problem Statement

`docs/` currently holds 38 Markdown files across 6 root files + 6 subfolders (`designs/`, `architecture/decisions|domain|technical/`, `planning/plans|specs/`, `guides/`, `research/`). `docs/README.md` (lines 5-16) documents a 7-row taxonomy table, but direct inspection of the tree shows the actual content has already outgrown that table in specific, verifiable ways:

### 1.1 File Curator is split across three folders with no cross-links

- `docs/architecture/technical/file-curator-architecture.md` — architecture/design doc.
- `docs/guides/file-curator-user-guide.md` — end-user guide.
- `docs/planning/plans/2026-06-15-file-curator-agent.md` — the original implementation plan (checkbox-tracked), predating the current `src/file_curator/` package that has since shipped.

Grep across the repo found no file that links all three together, and no marker in the plan doc indicating it is now historical (the feature is implemented and consumed via `_file_curator_notify` in `src/cad_intelligence/cad_io/com_bridge.py` and `handlers/drawing.py`). A reader who finds one of the three has no path to the other two.

### 1.2 ADRs are split across two folders under an undocumented rule

- `ADR-001-architecture-graph.md` lives in `docs/architecture/decisions/`, using the formal ADR template (Context/Decision/Alternatives/Consequences), Status: Accepted.
- `ADR-002-com-bridge-v3-versioning-design.md` lives in `docs/designs/`, using the spec-ID design-doc template (Spec ID/Version/Status/Created), Status: Design approved — implementation pending.

`docs/README.md` line 11 documents `architecture/decisions/` as the ADR home ("e.g. ADR-001"), and line 12 documents `designs/` as covering only "ELEV, AXIS, PKG series" — it does not mention an ADR series in `designs/` at all. Yet `ADR-002-*` sits there today, and both docs cross-link into each other by relative path (`docs/designs/ADR-002-com-bridge-v3-versioning-design.md:10` → `../architecture/decisions/ADR-001-architecture-graph.md`). There is no written rule for which ADRs go where; in practice it appears to be simply "whichever folder the author happened to use."

### 1.3 Two parallel "design doc" tracks, one undocumented

`docs/designs/` is the CLAUDE.md-mandated Design Gate deliverable location (root workspace `CLAUDE.md` and this project's `CLAUDE.md` both cite `docs/designs/<spec-id>-design.md` by name as the canonical Row-0 output; `agents/architect.md` line 55 cites the same path). Its current contents — `ADR-002`, `AI-002`, `AI-003`, `AXIS-001`, `ELEV-001` (+ `ELEV-001-v1-changelog.md`), `ELEV-002`, `PKG-001` — all consistently carry a structured header (Spec ID / Version / Status / Created / Authors / Source / Supersedes), even though `docs/README.md` only documents 3 of these 7 series by name.

Separately, `docs/architecture/technical/` contains two documents that are *not* spec-ID design docs but read like earlier, foundational technical designs:

- `zwcad-mcp-server-plan.md` — no Spec ID, no Status field. Confirmed still load-bearing: `src/cad_intelligence/cad_io/server.py:110` carries a code comment `# Tool definitions (JSON Schema — mirrors docs/architecture/technical/zwcad-mcp-server-plan.md)`, i.e. this is a real code→doc dependency. But the doc's original ~10-tool scope has been significantly extended by later spec-ID docs — the live MCP server now exposes 50 tools, most added by `AXIS-001`/`ELEV-002`-era work that itself lives in `docs/designs/`, not here.
- `cad-compliance-integration-design.md` — no Spec ID, no Status field, despite "design" in its own filename.

These two documents predate the `docs/designs/<spec-id>-design.md` convention becoming consistent practice, and now sit in a different folder from the docs that superseded/extended parts of them, with no explicit "superseded-by" pointer in either direction.

### 1.4 Roadmap-type content is duplicated conceptually, not textually

`docs/architecture/technical/cad-system-roadmap.md` (Status: "Draft — pending meeting approval", 2026-06-29) is an M1–M5 execution roadmap. It is the most heavily cross-linked non-ADR document found in the grep sweep — referenced from `docs/planning/specs/2026-07-01-ai-use-case-roadmap-design.md` (×2), `docs/designs/AI-003-v1-to-v3-migration-design.md` (×2, including an explicit P0-bug attribution), `docs/designs/PKG-001-*.md` (×3), `docs/designs/AI-002-*.md` (×1), and both `docs/architecture/technical/cad-intelligence-{vision,status}.md` (which are themselves companion/reconciliation docs built around it).

Meanwhile `docs/planning/plans/` and `docs/planning/specs/` hold dated, forward-looking plan/spec documents with overlapping purpose (both are "what should happen next" documents) but zero cross-reference convention connecting them to `cad-system-roadmap.md`. Confirmed separately: `docs/planning/specs/2026-07-01-ai-use-case-roadmap-design.md` lines 224-227 link to `docs/architecture/domain/roadmap.md` — **a file that does not exist** (the real file is `agent-team-implementation-roadmap.md`). This is an already-broken link, evidence that this cluster of documents is not being kept consistent as it grows.

Also spot-checked independently: `cad-system-roadmap.md`'s cited "P0 bugs" (`StartUndoMarker`→`StartUndoMark`, `AddMText`→`AddText` in `cad_agent.py`) are already fixed in current source. Not a reorg issue by itself, but it confirms `architecture/technical/` content needs an owner/refresh cadence, not just a new home — moving it does not fix staleness.

### 1.5 The `architecture/` parent bundles two unrelated subject domains

`docs/architecture/domain/` (6 files: README, `agent-team-implementation-roadmap.md`, `communication-agent-design.md`, `pcc-v1-template.md`, `regulatory-db-integration-research.md`, `usage-boundaries.md`) is entirely about **architecture-firm business-process governance** — an Intake/Research/Review/QA/Communication agent team, Human-in-the-Loop gates, liability boundaries (`usage-boundaries.md`, Status: Approved, binding). All 6 files date from 2026-06-15/16 and largely self-describe as "Draft — pending architect approval" with no visible later approval — they predate the 2026-06-17 co-architect/co-design 3-team merge plan and appear frozen since.

`docs/architecture/technical/` (7 files) is entirely about **the CAD software platform itself** — MCP server, COM bridge, compliance engine, file curator.

These two subtrees share almost nothing except that both are "architecture" in the plain English sense: one is about architecture *practice* (the business of running an architecture firm), the other is about software *architecture* (the CAD automation platform). Bundling them under one `architecture/` parent is a naming collision that actively invites confusion — someone looking for "the architecture doc" has no way to know which sense is meant from the parent folder name alone, only after descending into `domain/` vs `technical/`.

### 1.6 No folder-level staleness signal exists outside `docs/designs/`

Per the file-header survey, only `docs/designs/*` files consistently carry Spec ID/Version/Status/Created metadata. Every other subfolder (`architecture/`, `planning/`, `guides/`) is inconsistent — some files have a Status line, most don't. This makes it structurally hard to tell, folder by folder, whether a document is current, superseded, or abandoned without reading its full body. `docs/architecture/domain/` in particular sits in exactly this blind spot: nothing marks it stale, but nothing confirms it's current either.

### 1.7 `docs/README.md` itself is the clearest evidence the taxonomy has drifted

The table at `docs/README.md:5-16` is the single most authoritative statement of intended structure in the repo, but it is already inconsistent with the tree it describes:
- Says `designs/` covers "ELEV, AXIS, PKG series" — omits ADR and AI series, both of which are present today.
- Describes `planning/` as one bucket — the real folder has an undocumented `plans/` vs `specs/` split (inferred from content only: `plans/` = checkbox-tracked implementation plans, `specs/` = roadmap/design-style documents).
- `docs/planning/specs/2026-06-27-game-team-expansion-design.md` is about a "co-game" agent team (Pac-Man/arcade genre design), unrelated to co-architect's CAD/architecture-firm domain — apparent cross-template leakage, not something the taxonomy table anticipates at all.

---

## 2. Proposed Taxonomy

The core organizing principle: **group by lifecycle stage of the content, not by subject-matter word association.** "Architecture" as a folder name is retired for anything except the platform's own software-architecture ADRs, to remove the domain/technical naming collision (§1.5).

| Folder | Lifecycle stage | Contains | Naming rule |
|---|---|---|---|
| `docs/designs/` | Design Gate output (CLAUDE.md Row 0) — the spec-ID system of record | All spec-ID design docs: feature specs, ADRs, migration plans — anything that is the formal, reviewed decision record for a piece of work | `<SPEC-ID>-design.md` (existing convention, now made canonical for ADRs too — see §3.2) |
| `docs/reference/` | Living reference — no expiry, updated in place as the system evolves | Renamed from `docs/architecture/technical/`. Status/vision/roadmap-reconciliation docs that describe "the system as it stands," kept current rather than superseded | No enforced pattern; each file should carry a Status line (`Living reference`, `Draft`, etc.) |
| `docs/firm-governance/` | Org/business-process governance for the architecture-firm domain | Renamed from `docs/architecture/domain/`. Explicitly *not* under an `architecture/` parent, to kill the domain/technical naming collision | No enforced pattern |
| `docs/plans/` | Dated execution plan/roadmap — time-boxed, becomes historical once executed | Merge of `docs/planning/plans/` + `docs/planning/specs/` (the `plans/` vs `specs/` split was never documented and the content difference — checklist vs. narrative roadmap — isn't worth two folders) | `YYYY-MM-DD-<slug>.md` (existing convention) |
| `docs/guides/` | End-user-facing, task-oriented | Unchanged | `<feature>-user-guide.md` / `<topic>-guide.md` (existing convention) |
| `docs/research/` | Point-in-time research report, external-facing evidence | Unchanged (already has a working audit.ts check for `## References`) | `YYYY-<topic>.md` (existing informal convention) |
| *(root)* `docs/*.md` | Project-identity / cross-cutting policy docs | Unchanged: `context.md`, `co-architect.context.md`, `phase-definitions.md`, `security.md`, `testing-guidelines.md`, `README.md` | n/a |

**Unambiguous placement rule** (the thing `docs/README.md` currently lacks): when creating a new doc, ask in order —

1. Is this the Design Gate deliverable for a spec (CLAUDE.md Row 0), or a formal architecture decision record (what used to be an ADR)? → `docs/designs/<SPEC-ID>-design.md`. **ADRs get a spec ID too** (see §3.2) — there is no longer a separate ADR home.
2. Is this a "living" description of the system as it is today, with no natural end-state (a status page, a vision doc, a roadmap reconciliation table)? → `docs/reference/`.
3. Is this governance/process content for the architecture-*firm* business (agent team org design, HITL gates, liability boundaries) rather than the CAD *software*? → `docs/firm-governance/`.
4. Is this a dated, time-boxed execution plan or roadmap that will become historical once done? → `docs/plans/YYYY-MM-DD-<slug>.md`.
5. Is this written for an end user setting up or using the product? → `docs/guides/`.
6. Is this a research report citing external sources? → `docs/research/` (must include `## References`, already enforced by `scripts/audit.ts`).

This collapses the current 6-subfolder, 2-ambiguous-split tree (`architecture/{decisions,domain,technical}`, `planning/{plans,specs}`) into 5 flat, single-purpose subfolders with zero same-content ambiguity.

---

## 3. Full Migration Table

All 38 files, grouped by current location. "No change" means path is identical; "Rename folder only" means the file itself is untouched but its parent folder is renamed per §2.

### 3.1 Root docs/*.md (6 files) — no change

| Old path | New path |
|---|---|
| `docs/README.md` | `docs/README.md` (content rewritten to match new taxonomy — not a move) |
| `docs/co-architect.context.md` | no change |
| `docs/context.md` | no change |
| `docs/phase-definitions.md` | no change |
| `docs/security.md` | no change |
| `docs/testing-guidelines.md` | no change |

### 3.2 docs/designs/ + docs/architecture/decisions/ (9 files → 9 files, folder merge)

| Old path | New path | Rationale |
|---|---|---|
| `docs/designs/ADR-002-com-bridge-v3-versioning-design.md` | `docs/designs/ADR-002-com-bridge-v3-versioning-design.md` | No change — already in the right place under the new rule |
| `docs/designs/AI-002-graph-driven-rendering-design.md` | `docs/designs/AI-002-graph-driven-rendering-design.md` | No change |
| `docs/designs/AI-003-v1-to-v3-migration-design.md` | `docs/designs/AI-003-v1-to-v3-migration-design.md` | No change |
| `docs/designs/AXIS-001-design.md` | `docs/designs/AXIS-001-design.md` | No change |
| `docs/designs/ELEV-001-design.md` | `docs/designs/ELEV-001-design.md` | **Deprecated** — marked DEPRECATED 2026-07-05 (ELEV-001 fully retired). File kept for historical reference. |
| `docs/designs/ELEV-001-v1-changelog.md` | `docs/designs/ELEV-001-v1-changelog.md` | **Deprecated** — marked DEPRECATED 2026-07-05 (ELEV-001 fully retired). File kept for historical reference. |
| `docs/designs/ELEV-002-design.md` | `docs/designs/ELEV-002-design.md` | No change |
| `docs/designs/PKG-001-cad-intelligence-restructure-design.md` | `docs/designs/PKG-001-cad-intelligence-restructure-design.md` | No change |
| `docs/designs/ADR-005-architecture-graph-schema.md` | `docs/designs/ADR-005-architecture-graph-schema.md` | No change — new file (2026-07-05, ADR-004 split). Architecture Graph Schema: node/edge types, query API, evidence, coordinates, Ontology Layer. |
| `docs/designs/ADR-006-pattern-dsl-recognition-engine.md` | `docs/designs/ADR-006-pattern-dsl-recognition-engine.md` | No change — new file (2026-07-05, ADR-004 split). Pattern DSL & Recognition Engine: candidates, patterns, inference, relationship rules DSL. |
| `docs/designs/ADR-007-appspec-rendering-architecture.md` | `docs/designs/ADR-007-appspec-rendering-architecture.md` | No change — new file (2026-07-05, ADR-004 split). ApplicationSpec & Rendering: builder ABC, ElevationSpec, ConstraintEngine, Renderer. |
| `docs/designs/ADR-008-command-versioning-editing.md` | `docs/designs/ADR-008-command-versioning-editing.md` | No change — new file (2026-07-05, ADR-004 split). Command / Versioning / Editing: mutations, undo, EventBus, artifact versioning. |
| `docs/architecture/decisions/ADR-001-architecture-graph.md` | `docs/designs/ADR-001-architecture-graph.md` | **Moves.** Folds the one-file `architecture/decisions/` folder into `designs/`, joining ADR-002. Resolves §1.2: both ADRs now live in one place under one rule ("ADRs are spec-ID docs like any other design doc; the formal ADR template — Context/Decision/Alternatives/Consequences — is a valid *body* format inside a `docs/designs/*.md` file, same as the lighter-weight Implementation Plan format in `agents/architect.md`"). `docs/architecture/decisions/` is deleted once empty. |

### 3.3 docs/architecture/technical/ → docs/reference/ (7 files, folder rename)

| Old path | New path | Rationale |
|---|---|---|
| `docs/architecture/technical/cad-compliance-integration-design.md` | `docs/reference/cad-compliance-integration-design.md` | Rename-folder-only. See Open Item 1 re: retroactive spec ID. |
| `docs/architecture/technical/cad-intelligence-status.md` | `docs/reference/cad-intelligence-status.md` | Rename-folder-only. Already self-labels "Living reference" — best fit for the new folder's definition. |
| `docs/architecture/technical/cad-intelligence-vision.md` | `docs/reference/cad-intelligence-vision.md` | Rename-folder-only. Already self-labels "Living reference." |
| `docs/architecture/technical/cad-system-roadmap.md` | `docs/reference/cad-system-roadmap.md` | Rename-folder-only. Note: still "Draft — pending meeting approval" despite being heavily cross-referenced as authoritative (§1.4) — flagged as a staleness/status issue independent of the move, not fixed by relocation. |
| `docs/architecture/technical/file-curator-architecture.md` | `docs/reference/file-curator-architecture.md` | Rename-folder-only, pending Open Item 2 (File Curator consolidation decision). |
| `docs/architecture/technical/mcp-integration-guide.md` | `docs/reference/mcp-integration-guide.md` | Rename-folder-only. |
| `docs/architecture/technical/zwcad-mcp-server-plan.md` | `docs/reference/zwcad-mcp-server-plan.md` | Rename-folder-only. See Open Item 1 — also has a code-comment inbound reference (§4) that must be updated in the same commit as the move. |

### 3.4 docs/architecture/domain/ → docs/firm-governance/ (6 files, folder rename)

| Old path | New path |
|---|---|
| `docs/architecture/domain/README.md` | `docs/firm-governance/README.md` |
| `docs/architecture/domain/agent-team-implementation-roadmap.md` | `docs/firm-governance/agent-team-implementation-roadmap.md` |
| `docs/architecture/domain/communication-agent-design.md` | `docs/firm-governance/communication-agent-design.md` |
| `docs/architecture/domain/pcc-v1-template.md` | `docs/firm-governance/pcc-v1-template.md` |
| `docs/architecture/domain/regulatory-db-integration-research.md` | `docs/firm-governance/regulatory-db-integration-research.md` |
| `docs/architecture/domain/usage-boundaries.md` | `docs/firm-governance/usage-boundaries.md` |

After 3.3/3.4, `docs/architecture/` is empty and deleted.

### 3.5 docs/planning/plans/ + docs/planning/specs/ → docs/plans/ (4 files, folder merge)

| Old path | New path | Rationale |
|---|---|---|
| `docs/planning/plans/2026-06-15-file-curator-agent.md` | `docs/plans/2026-06-15-file-curator-agent.md` | See Open Item 2 — File Curator consolidation may retire this file rather than just move it. |
| `docs/planning/plans/2026-06-17-co-architect-3team-integration.md` | `docs/plans/2026-06-17-co-architect-3team-integration.md` | Move only. |
| `docs/planning/specs/2026-06-27-game-team-expansion-design.md` | See Open Item 3 | Likely cross-template leakage unrelated to co-architect's domain — flagged for a deletion/relocation decision, not a default move. |
| `docs/planning/specs/2026-07-01-ai-use-case-roadmap-design.md` | `docs/plans/2026-07-01-ai-use-case-roadmap-design.md` | Move only. Contains a broken link to `docs/architecture/domain/roadmap.md` (should be `agent-team-implementation-roadmap.md`) — fix as part of the link-fix pass regardless of reorg. |

### 3.6 docs/guides/ — no change (3 files)

| Old path | New path |
|---|---|
| `docs/guides/file-curator-user-guide.md` | no change (pending Open Item 2) |
| `docs/guides/first-time-user-guide.md` | no change |
| `docs/guides/sandbox-guide.md` | no change |

### 3.7 docs/research/ — no change (3 files)

| Old path | New path |
|---|---|
| `docs/research/2026-apartment-design-report.md` | no change |
| `docs/research/2026-apartment-story-analysis.md` | no change |
| `docs/research/2026-apartment-ux-research.md` | no change |

**Totals**: 38 files in → 38 files out (or 37 if Open Item 3 resolves to deletion, or fewer if Open Item 2 resolves to consolidation). 6 root, 9 `designs/`, 7 `reference/`, 6 `firm-governance/`, 4 `plans/`, 3 `guides/`, 3 `research/`.

---

## 4. Link-Fix Checklist

Every inbound reference to a path this plan moves, found via repo-wide grep. Each must be updated in the same commit that performs the corresponding move (Phase 2, §5).

| Referencing file | Line(s) | What it references | Fix needed |
|---|---|---|---|
| `docs/designs/ADR-002-com-bridge-v3-versioning-design.md` | 10 | `../architecture/decisions/ADR-001-architecture-graph.md` | → `ADR-001-architecture-graph.md` (same-folder relative link once merged into `designs/`) |
| `docs/designs/AI-002-graph-driven-rendering-design.md` | 10, 23, 179, 249, 259, 274, 307 | ADR-001 / ADR-002 cross-refs | Update relative paths to same-folder form |
| `docs/designs/AI-003-v1-to-v3-migration-design.md` | 8, 10, 16, 18, 20, 57, 72, 74, 119, 125, 135, 136, 153, 154 | ADR-001/ADR-002/`cad-system-roadmap.md` refs | Update ADR relative paths (same-folder); update `cad-system-roadmap.md` path to `../reference/cad-system-roadmap.md` |
| `docs/designs/PKG-001-cad-intelligence-restructure-design.md` | 21, 38, 41, 64, 77, 80, 148, 157, 158, 161, 187, 188, 196 | `docs/architecture/technical/*` (3 files), `docs/architecture/decisions/ADR-001-*` | Update all to `docs/reference/*` and `docs/designs/ADR-001-*` respectively |
| `docs/architecture/decisions/ADR-001-architecture-graph.md` (→ `docs/designs/ADR-001-*.md`) | 53 | `docs/architecture/technical/cad-intelligence-status.md` | → `docs/reference/cad-intelligence-status.md` |
| `docs/architecture/technical/cad-system-roadmap.md` (→ `docs/reference/*`) | 274–277 | `zwcad-mcp-server-plan.md`, `cad-compliance-integration-design.md`, `file-curator-architecture.md`, `docs/architecture/domain/regulatory-db-integration-research.md` | First 3: same-folder (all move to `docs/reference/` together). Last: → `../firm-governance/regulatory-db-integration-research.md` |
| `docs/architecture/technical/cad-intelligence-vision.md` (→ `docs/reference/*`) | 111 | `cad-system-roadmap.md` | Same-folder, no change needed after move (both move together) |
| `docs/planning/specs/2026-07-01-ai-use-case-roadmap-design.md` (→ `docs/plans/*`) | 6, 224–227 | `docs/architecture/technical/cad-system-roadmap.md`, `docs/architecture/domain/roadmap.md` **(broken — should be `agent-team-implementation-roadmap.md`)**, `cad-compliance-integration-design.md`, `regulatory-db-integration-research.md` | Update to `docs/reference/cad-system-roadmap.md`, `docs/firm-governance/agent-team-implementation-roadmap.md` (fixing the pre-existing broken link as part of this pass), `docs/reference/cad-compliance-integration-design.md`, `docs/firm-governance/regulatory-db-integration-research.md` |
| `docs/co-architect.context.md` | 341 | directory-structure table row citing `architecture/` | Update table to reflect new taxonomy (§2) |
| `src/cad_intelligence/cad_io/server.py` | 110 | code comment: `# ... mirrors docs/architecture/technical/zwcad-mcp-server-plan.md` | Update comment path to `docs/reference/zwcad-mcp-server-plan.md`. **This is the one non-doc file in the whole tree that references a moved path — must not be missed.** |
| `docs/README.md` | 5–16 | entire taxonomy table | Rewrite per §2 of this design (this is the primary deliverable of Phase 2, not an incidental fix) |
| `docs/context.md` | 41–50 (workspace-template block), 151–168 (File Organization Policy) | Generic docs/ description; does not name subfolders | No fix required — this file is IMMUTABLE and intentionally project-type-agnostic; it already doesn't hardcode the subfolder taxonomy, so it is not stale relative to this reorg. Confirm during Phase 2 review that no edit is needed here. |
| `CHANGELOG.md` | 85 | Historical entry describing the *previous* `guides/`+`architecture/{domain,technical}` reorg | No fix — historical record, do not edit past changelog entries. |
| `memory/*.md` (2026-06-28, 2026-06-29, 2026-07-01, 2026-07-04) | various | Historical session-log mentions of paths already renamed once before (e.g. `docs/architecture-firm/`, underscore-variant filenames) | No fix — memory logs are point-in-time records, not living references. Do not edit. |

**Explicitly NOT requiring a fix** (confirmed via grep, listed to show the search was exhaustive): `AGENTS.md`, `agents/*.md`, `skills/*.md`, `scripts/*.ts`, `README.md`, `README_ko.md` contain no path-level references to `docs/architecture/`, `docs/planning/`, or the specific files being moved (README.md/README_ko.md reference `docs/guides/first-time-user-guide.md`, which is not moving). `agents/zwcad-drafter.md` references File Curator extensively but only the `src/file_curator/` code package and operational concepts, never a `docs/` path.

---

## 5. Phased Plan

Per `agents/architect.md`'s constraint to flag >3-module changes as high-risk and require explicit confirmation: **this plan touches 38 doc files, 8+ inbound-reference files, and 1 source file. Do not begin Phase 1 until the Open Items in §6 are resolved by the user/PM.**

| Phase | Scope | Risk | Exit checkpoint |
|---|---|---|---|
| **0 (this doc)** | Design only — no files moved. Architect produces `DOCS-001-design.md`; PM presents Open Items to user. | None | User has explicitly approved a taxonomy and answered all §6 items |
| **1 — Create new structure** | Create the 3 new/renamed folders (`docs/reference/`, `docs/firm-governance/`, `docs/plans/`) empty. Move files per §3 using `git mv` (preserves history) — no content edits yet except where §6 decisions require content changes (e.g. File Curator consolidation, if chosen). Delete now-empty `docs/architecture/`, `docs/planning/` folders. | Medium — pure moves are low-risk with `git mv`, but volume is high (38 files) | `git status` shows only renames (R) for moved files, no unexpected M/D; no file left in an old folder that should be empty |
| **2 — Fix inbound references** | Apply every row in §4's link-fix checklist, including the `docs/README.md` taxonomy rewrite (§2) and the `src/cad_intelligence/cad_io/server.py:110` comment update. Fix the pre-existing broken `docs/architecture/domain/roadmap.md` link as part of this pass (§3.5). | Medium — mechanical but must not miss the one code-comment reference | `validate-docs-links` skill (or equivalent link-check) reports zero dead links in `docs/`; grep for the 4 deleted folder names (`architecture/decisions`, `architecture/domain`, `architecture/technical`, `planning/plans`, `planning/specs`) returns zero hits repo-wide |
| **3 — Verify and close out** | Run `bun scripts/audit.ts` (confirm the `docs/research/*.md` → `## References` check still passes — that folder is untouched, so it should). Run the `validate-docs-links` skill across all of `docs/`. Update `docs/co-architect.context.md`'s directory table (§4). | Low | Audit script and link-checker both pass clean; PM reviews final tree against §2's table before `/sync` |
| **4 — `/sync`** | `/sync "docs(reorg): consolidate docs/ taxonomy per DOCS-001"` | — | Standard sync pipeline (memlog → changelog → audit → commit → PR) |

No redirect stubs are proposed for Phase 1→2 (unlike a public-URL doc site, these are in-repo relative links with no external consumers to preserve continuity for) — the reorg is intended to land as one coherent PR per Phase 1+2, reviewed together, so stub files would only add churn to delete again in Phase 3. If the user prefers incremental PRs instead of one combined PR, split at the Phase 1/2 boundary and keep both old and new paths live (via short-lived redirect stub `.md` files containing only a pointer line) between them — see Open Item 4.

---

## 6. Open Items (require explicit user/PM decision before automation-engineer executes anything)

1. **Retroactive spec IDs for non-spec-ID technical designs?** `cad-compliance-integration-design.md` and `zwcad-mcp-server-plan.md` (moving to `docs/reference/` in this plan) read like foundational designs but never got a spec ID or Status field, and `zwcad-mcp-server-plan.md`'s original ~10-tool scope is now significantly extended by `AXIS-001`/`ELEV-002` (50 tools live today). Options: (a) leave them in `docs/reference/` as living-reference prose with no spec ID — this design doc's default; (b) retroactively assign spec IDs (e.g. `MCP-000`) and move them into `docs/designs/` as historical/superseded-marked design docs, with an explicit "superseded in part by AXIS-001/ELEV-002" note. **Needs a decision**: reference doc or retroactive spec?

2. **File Curator: consolidate into one doc, or keep three with cross-links?** Current split — `docs/reference/file-curator-architecture.md` (design), `docs/plans/2026-06-15-file-curator-agent.md` (now-historical implementation plan), `docs/guides/file-curator-user-guide.md` (user guide) — serves three different audiences (architects, past-implementer, end users), which is itself a legitimate reason to keep them separate. But right now none of them link to the others. Options: (a) keep three, add a "Related docs" cross-link block to the top of each (lowest-risk, this design's default if no other decision is made); (b) merge architecture doc + plan into one `docs/reference/file-curator-architecture.md` with the plan's content folded in as a "History" section, keep the user guide separate (plan content is stale/historical once a feature ships, so folding it into the reference doc's changelog-style section may be cleaner than a live standalone plan file). **Needs a decision.**

3. **`2026-06-27-game-team-expansion-design.md` — delete, or relocate to a different project?** This spec describes a "co-game" genre-design agent team (Pac-Man/arcade content), unrelated to co-architect's CAD/architecture-firm domain. It appears to be cross-template leakage from another workspace variant. This design doc does not default-move it into `docs/plans/` (§3.5 flags it as "See Open Item 3" rather than assigning a target path) because moving stray content forward perpetuates the leak. **Needs a decision**: confirm it's leakage and delete, or confirm it's intentionally retained co-architect content (e.g. a shelved side-experiment) and give it a proper home.

4. **Single combined PR vs. incremental PRs with redirect stubs?** §5 defaults to one PR covering Phase 1+2 together. If the user prefers smaller reviewable PRs, Phase 1 and Phase 2 split across two PRs, and short-lived stub files (containing just a "moved to X" pointer line) are needed at the old paths in between so the tree isn't broken mid-migration. **Needs a decision** on PR granularity before Phase 1 starts.

5. **`docs/architecture/domain/` content — is it still current?** All 6 files date to 2026-06-15/16, most self-label "Draft — pending architect approval," and predate the 2026-06-17 3-team merge. This design doc only proposes a folder rename (`architecture/domain/` → `firm-governance/`) and does not attempt to assess or refresh the content itself — that is a separate content-owner decision, not a filesystem question. **Flagging, not deciding**: PM should separately confirm whether this content needs a refresh/re-approval pass, independent of and not blocking this reorg.

6. **`docs/README.md` rewrite ownership**: Phase 2 includes rewriting `docs/README.md`'s taxonomy table (§2) as part of this reorg. Confirm docs-writer (not architect) should execute that content rewrite once the taxonomy itself is approved — this design doc specifies the target table but does not write the final prose.

---

### Decisions (recorded 2026-07-04, PM + user)

1. **Taxonomy (§2)**: Approved as proposed, no changes.
2. **File Curator (Item 2)**: Merge `docs/architecture/technical/file-curator-architecture.md` + `docs/planning/plans/2026-06-15-file-curator-agent.md` into one `docs/reference/file-curator-architecture.md`, with the plan's content folded in as a trailing "History / Implementation Log" section. `docs/guides/file-curator-user-guide.md` stays separate (different audience). §3.3/§3.5 migration rows updated accordingly — the plan file is retired (merged, not moved) rather than landing at `docs/plans/2026-06-15-file-curator-agent.md`.
3. **Retroactive spec IDs (Item 1)**: Assign spec IDs and move both orphan technical designs into `docs/designs/`, each marked historical/partially-superseded: `zwcad-mcp-server-plan.md` → `docs/designs/MCP-000-zwcad-mcp-server-plan.md` (note: superseded in part by AXIS-001/ELEV-002 — original ~10-tool scope now 50 tools); `cad-compliance-integration-design.md` → `docs/designs/MCP-001-cad-compliance-integration-design.md`. Both get a Spec ID/Version/Status header retrofitted (Status: "Historical — implemented, superseded in part"). The `src/cad_intelligence/cad_io/server.py:110` comment must point to the new `docs/designs/MCP-000-*.md` path, not `docs/reference/`.
4. **Game-team file (Item 3)**: Confirmed cross-template leakage, unrelated to co-architect. Delete `docs/planning/specs/2026-06-27-game-team-expansion-design.md` outright — do not migrate it anywhere.
5. **PR granularity (Item 4)**: Not explicitly decided — default to architect's Phase 5 recommendation (single combined PR covering Phase 1+2, no redirect stubs).
6. **Firm-governance staleness (Item 5)**: Flagged only, not blocking this reorg — folder rename proceeds; a separate future task should review `docs/firm-governance/` content currency.
7. **README rewrite (Item 6)**: automation-engineer executes the table rewrite per §2 as part of Phase 2/3 (no separate technical-writer dispatch needed for a single table edit).

---

## Addendum (2026-07-09): `docs/programs/` category added

This DOCS-001 taxonomy (§2) is executed and historical — the migration itself is not being reopened. This addendum records a subsequent, additive change to the taxonomy: a new top-level category, `docs/programs/`, was introduced alongside the five folders §2 established.

**Why a new category, not a `docs/plans/` entry**: §2's placement rule (item 4) routes "a dated, time-boxed execution plan or roadmap that will become historical once executed" to `docs/plans/`. That definition assumes an end state. Some initiatives — e.g. an ongoing production-readiness effort spanning benchmarking, monitoring, CI hardening, and closed-loop automation — have no fixed end date and are meant to be updated in place across many sprints, the same "living reference" property `docs/reference/` has for system-state docs, but scoped to forward-looking *work programs* rather than "the system as it stands." Forcing that content into a dated `docs/plans/YYYY-MM-DD-<slug>.md` file would misrepresent it as time-boxed and require either perpetual re-dating or an artificial "done" state that doesn't reflect reality.

**The distinction**: *Plans are time-boxed; Programs persist across many sprints.* A `docs/plans/` doc is archived once its roadmap executes (see `docs/plans/2026-07-09-v3-completion-roadmap.md` for an example of exactly this transition). A `docs/programs/` doc is never archived in that sense — it is updated in place as its sub-areas are scoped, executed, and re-scoped, the way `docs/reference/` docs are updated in place as the system evolves.

| Folder | Lifecycle stage | Contains | Naming rule |
|---|---|---|---|
| `docs/programs/` | Ongoing, multi-sprint initiative — no fixed end date, updated in place | Cross-cutting programs of work spanning many sprints and sub-areas (e.g. production readiness: benchmarking, monitoring, CI hardening, closed-loop automation) | `<program-name>.md` (descriptive slug, no date prefix — the absence of a date is the signal that this is a living document, not a dated snapshot) |

**Updated unambiguous placement rule** — insert as a new question before the existing "dated, time-boxed execution plan" question (renumbering §2's original items 4-6 to 5-7):

4. Is this an ongoing, multi-sprint initiative with no fixed end date (production readiness, closed-loop automation, ...)? → `docs/programs/<program-name>.md`.

**Status header convention for `docs/programs/` docs**: unlike a spec-ID design doc (`Status: Design approved`) or a dated plan (which ends in a terminal state like `Complete`/`Archived`), a program doc's Status header should read `Status: Active — living document`, signaling explicitly that there is no terminal state to reach and that the doc is expected to be revised in place.

**First instance**: `docs/programs/production-readiness-program.md`, created 2026-07-09 as the direct follow-on to `docs/plans/2026-07-09-v3-completion-roadmap.md` — the archived roadmap answered "can we build it," this program tracks "can people depend on it."

`docs/README.md`'s live taxonomy table has been updated with the corresponding `docs/programs/` row (see that file directly — it is the doc read day-to-day; this addendum is the design-of-record for the change).

---

## Addendum (2026-08-02): `docs/adr/` centralization + `docs/programs/` dissolution

This addendum records a second subsequent change to the DOCS-001 taxonomy. As with the 2026-07-09 addendum, the original migration (§3) is **not reopened** — the §1–§6 tables and prose above remain the frozen design-of-record for the original reorg, and stale paths there describe that migration, not the current tree. These are additive changes recorded here for traceability. Full design-of-record for this change: `docs/superpowers/specs/2026-08-02-docs-reorganization-design.md`.

**1. ADRs centralized into `docs/adr/` (reverses §2's "no separate ADR home").** DOCS-001 §2 deliberately collapsed the ADR home into `docs/designs/` ("ADRs get a spec ID too — there is no longer a separate ADR home"). In practice the numbered ADR series (`ADR-001`…`ADR-015`, skipping the never-created `ADR-003`) grew to 14 files and reads as a distinct decision log, while the bare-number series (`0036-`, `0037-`) already lived in `docs/adr/`. All are now co-located in `docs/adr/`. A follow-up pass unified the naming: the bare-number files were renamed to `ADR-0036-scripts-typescript-only.md` / `ADR-0037-cad-agent-modularization.md` to match the `ADR-NNN-slug.md` convention (and each file's own H1 title); ADR **numbers and IDs are unaffected**. That same pass also moved and renamed the master ADR `ADR-016-face-elevation-architecture.md` (the four-domain elevation architecture) into `docs/adr/` — completing the centralization. `docs/designs/` now holds feature/technical designs only.

**2. `docs/programs/` dissolved (reverses the 2026-07-09 addendum).** With a single occupant (`production-readiness-program.md`), the plans-vs-programs distinction proved unobservable in practice and did not earn a permanent top-level category. The program doc moved to `docs/firm-governance/` (the strategic-material home); the `docs/programs/` directory is removed. Consequently `docs/README.md`'s live taxonomy table **no longer carries** the `programs/` row the 2026-07-09 addendum announced — `firm-governance/` now absorbs persistent strategic initiatives by default. The 2026-07-09 addendum above is kept intact as the design-of-record for the (now-reversed) programs/ decision.

**3. `docs/designs/` catch-all cleaned up.** Three further files that DOCS-001 §3.2 / Decision 3 had routed into `designs/` were re-homed to their lifecycle-appropriate folders: `ELEV-001-v1-changelog.md` → `docs/release/` (a release changelog, not a design); `MCP-000-zwcad-mcp-server-plan.md` → `docs/plans/` (a dated plan); `POSTMORTEM-010-mcp-tool-registry.md` → `docs/reference/` (a living-reference postmortem).

**4. Mis-filed skill-generated plan relocated.** `2026-06-17-co-architect-3team-integration.md` bore the brainstorming-skill execution header (`> **For agentic workers:** REQUIRED: Use superpowers:...`) that marks it as skill output, yet it sat in `docs/plans/` alongside hand-written plans. It moved to `docs/superpowers/plans/` to match the origin-based split. The other three date-prefixed plans in `docs/plans/` (`2026-07-01-ai-use-case-roadmap-design.md`, `2026-07-09-closed-loop-001-implementation.md`, `2026-07-09-v3-completion-roadmap.md`) are hand-written and correctly remain in `docs/plans/`.

**Net effect on the placement rule**: §2 step 1 ("formal architecture decision record → `docs/designs/`") is amended to route ADRs to `docs/adr/`; the 2026-07-09 addendum's step 4 ("ongoing multi-sprint initiative → `docs/programs/`") is removed. `docs/README.md` reflects both changes in its live placement rule and directory table — that file remains the day-to-day read; this addendum is the design-of-record for the change.
