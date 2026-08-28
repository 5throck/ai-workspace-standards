# CodeGraph Remnant Removal — L0 and Variant Templates

| Field | Value |
|-------|-------|
| Date | 2026-08-28 |
| Status | accepted |
| Spec ID | `codegraph` |
| Governing anchor | None — hygiene cleanup. See CHANGELOG 2026-07-05 removal entry for initial cleanup. |
| Related | `docs/designs/l2-to-variant-conversion-pipeline.md` |

## Problem

**CodeGraph** is an external third-party MCP server (`@colbymchenry/codegraph@0.9.7`) that provided AST-based codebase exploration via `bunx`/`npx`, using a runtime SQLite index stored in a gitignored `.codegraph/` directory. It was introduced on 2026-05-24 (commit `d93100ae`, PR #59).

A partial removal was performed on 2026-07-05: L0 root platform settings (`.claude/settings.json`, `.gemini/settings.json`) were cleaned. The `co-safety` variant was fully cleaned, and its runtime had already been removed on 2026-06-16.

However, **reintroduction sources remain active** in the workspace:

1. **`scripts/helpers/generate-variant.ts`** actively injects codegraph MCP server configuration into every newly generated variant's platform settings — meaning any new variant or variant regeneration re-introduces the dependency.
2. **Template `.claude/settings.json` and `.gemini/settings.json`** files across 5 variant templates still contain codegraph `mcpServers` blocks.
3. **L0 and template `.gitignore`** files still carry codegraph index directory entries.
4. **L0 and common template `workspace-schema.json`** still list `.codegraph` in ignored directories.
5. **`scripts/propagate-to-templates.ts`** still lists `.codegraph` in its encoding-skip directory set.
6. **`templates/co-abap/scripts/co-abap/setup.ts`** still contains `--with-codegraph` opt-in logic.

These remnants must be removed to prevent silent reintroduction and to complete the cleanup initiated on 2026-07-05.

## Scope and Decisions

The following decisions were confirmed by the user:

1. **L0 reintroduction sources are in scope** — `generate-variant.ts`, `propagate-to-templates.ts`, `.gitignore`, and `workspace-schema.json` at L0 root will be cleaned in this PR.
2. **Historical archives, CHANGELOG, and memory records are KEPT** — The `templates/co-safety/docs/_meta/archive/code-graph/` directory (6 files) and its identical counterpart in `Projects/co-safety` were deliberately archived per the 2026-06-21 meeting resolution ("Truth-in-Documentation"). All CHANGELOG.md entries and `memory/` session records are preserved as historical records.
3. **Project-side cleanup is a separate later phase** — Individual project instances (settings files, `.codegraph/` databases, `.gitignore`, setup scripts) will be cleaned in a follow-up Phase 5 after this template-level PR merges. This ordering is deliberate: templates must be clean **before** any project upgrade runs, otherwise `upgrade-project` or variant regeneration would re-introduce codegraph into already-cleaned projects.

## Change Design

### D1 — L0 Reintroduction Sources

These are the root-cause files that actively re-inject codegraph into downstream artifacts.

#### D1.1 `scripts/helpers/generate-variant.ts`

**Active injection source.** This script generates codegraph MCP server configuration into every newly created variant's platform settings.

- **`.claude/settings.json` generation (~lines 1340-1343):** Removes the `codegraph` entry from the `mcpServers` block.
- **`.gemini/settings.json` generation (~lines 1434-1437):** Removes the `codegraph` entry from the `mcpServers` block.
- Bump `@version` frontmatter.
- Update `scripts/SCRIPTS.md` registry entry to reflect version change.

#### D1.2 `scripts/propagate-to-templates.ts`

- **Line 193:** Remove `'.codegraph'` from the `ENCODING_SKIP_DIRS` array.
- Bump `@version` frontmatter.
- Update `scripts/SCRIPTS.md` registry entry.

#### D1.3 `.gitignore`

- **Lines 121-122:** Remove the `# --- CodeGraph Index ---` comment header and the `.codegraph/` entry.

#### D1.4 `docs/workspace-schema.json`

- **~Line 137:** Remove the `".codegraph"` entry from the `ignored-dirs` list in the workspace schema.

### D2 — Template Active Configuration

These are the downstream artifacts that already contain codegraph configuration and must be cleaned.

#### D2.1 Variant template platform settings (10 blocks across 5 templates)

Remove the codegraph `mcpServers` block from each file, preserving valid JSON structure.

| Template | File | Approx. Lines |
|----------|------|---------------|
| `co-abap` | `.claude/settings.json` | 26-30 |
| `co-abap` | `.gemini/settings.json` | 26-30 |
| `co-export` | `.claude/settings.json` | 16-20 |
| `co-export` | `.gemini/settings.json` | 4-8 |
| `co-hr` | `.claude/settings.json` | 16-20 |
| `co-hr` | `.gemini/settings.json` | 4-8 |
| `co-news` | `.claude/settings.json` | 16-20 |
| `co-news` | `.gemini/settings.json` | 4-8 |
| `co-price` | `.claude/settings.json` | 17-20 |
| `co-price` | `.gemini/settings.json` | 15-17 |

**Note on `co-price`:** The `.gemini/settings.json` block uses the unpinned `-y` form (without explicit `@0.9.7` version pin). Both pinned and unpinned forms are removed.

#### D2.2 `templates/co-abap/scripts/co-abap/setup.ts`

Remove all `--with-codegraph` opt-in logic:

- **Line 22:** Usage comment referencing `--with-codegraph`.
- **Line 48:** CLI flag parsing for `--with-codegraph`.
- **Lines 432-439:** Initialization/index block that conditionally runs codegraph setup.
- Bump `@version` frontmatter.
- Update project `SCRIPTS.md` registry entry if an entry exists for this script.

#### D2.3 Variant template `.gitignore` files (12 templates)

Remove the `# CodeGraph Index` comment and `.codegraph/` entry from each template's `.gitignore`:

`co-abap`, `co-consult`, `co-deck`, `co-design`, `co-develop`, `co-export`, `co-game`, `co-hr`, `co-news`, `co-price`, `co-security`, `co-work`

#### D2.4 `templates/common/docs/workspace-schema.json`

- **~Line 128:** Remove the `".codegraph"` entry from the `ignored-dirs` list.

### D3 — Kept Items (Do NOT Touch)

The following are explicitly excluded from changes:

| Item | Reason |
|------|--------|
| `templates/co-safety/docs/_meta/archive/code-graph/` (6 files) and identical dir in `Projects/co-safety` | Deliberately archived per 2026-06-21 meeting ("Truth-in-Documentation") |
| `co-safety` blueprint docs with "NOT IMPLEMENTED" annotations (02-architecture.md, 04-agent-catalog.md, 05-implementation-roadmap.md, appendix/A-agent-definitions.md) | Historical design intent; annotations already mark as unimplemented |
| Superpowers specs/plans mentioning codegraph tool schemas | Historical reference material |
| All `CHANGELOG.md` and `memory/` records | History — never retroactively edited |
| Project-side `scripts/audit.ts` comment-only references ("external tools (codegraph, antivirus, etc.)") | Core scripts; resolved by future script upgrades, never hand-edited for content |
| `docs/designs/l2-to-variant-conversion-pipeline.md` references | Documents the stripping rule itself — meta-reference |
| Project cleanup (settings, `.codegraph/` DBs, `.gitignore`, setup scripts) | Separate Phase 5 follow-up after this PR merges |

## Registrations

| # | File | Nature of Change |
|---|------|-----------------|
| 1 | `docs/designs/2026-08-28-codegraph-removal-design.md` | **New** — this design document |
| 2 | `scripts/helpers/generate-variant.ts` | Edit — remove 2 codegraph injection blocks (~L1340-1343, ~L1434-1437); bump `@version` |
| 3 | `scripts/propagate-to-templates.ts` | Edit — remove `.codegraph` from `ENCODING_SKIP_DIRS` (L193); bump `@version` |
| 4 | `scripts/SCRIPTS.md` | Registry update — version bumps for items 2 and 3 |
| 5 | `.gitignore` | Edit — remove codegraph comment + entry (L121-122) |
| 6 | `docs/workspace-schema.json` | Edit — remove `.codegraph` from `ignored-dirs` (~L137) |
| 7 | `templates/co-abap/.claude/settings.json` | Edit — remove codegraph mcpServers block (L26-30) |
| 8 | `templates/co-abap/.gemini/settings.json` | Edit — remove codegraph mcpServers block (L26-30) |
| 9 | `templates/co-export/.claude/settings.json` | Edit — remove codegraph mcpServers block (L16-20) |
| 10 | `templates/co-export/.gemini/settings.json` | Edit — remove codegraph mcpServers block (L4-8) |
| 11 | `templates/co-hr/.claude/settings.json` | Edit — remove codegraph mcpServers block (L16-20) |
| 12 | `templates/co-hr/.gemini/settings.json` | Edit — remove codegraph mcpServers block (L4-8) |
| 13 | `templates/co-news/.claude/settings.json` | Edit — remove codegraph mcpServers block (L16-20) |
| 14 | `templates/co-news/.gemini/settings.json` | Edit — remove codegraph mcpServers block (L4-8) |
| 15 | `templates/co-price/.claude/settings.json` | Edit — remove codegraph mcpServers block (L17-20) |
| 16 | `templates/co-price/.gemini/settings.json` | Edit — remove codegraph mcpServers block (L15-17, unpinned `-y` form) |
| 17 | `templates/co-abap/scripts/co-abap/setup.ts` | Edit — remove `--with-codegraph` logic (L22, L48, L432-439); bump `@version` |
| 18 | `templates/co-abap/SCRIPTS.md` | Registry update — version bump for item 17 (if entry exists) |
| 19 | `templates/co-abap/.gitignore` | Edit — remove codegraph entry |
| 20 | `templates/co-consult/.gitignore` | Edit — remove codegraph entry |
| 21 | `templates/co-deck/.gitignore` | Edit — remove codegraph entry |
| 22 | `templates/co-design/.gitignore` | Edit — remove codegraph entry |
| 23 | `templates/co-develop/.gitignore` | Edit — remove codegraph entry |
| 24 | `templates/co-export/.gitignore` | Edit — remove codegraph entry |
| 25 | `templates/co-game/.gitignore` | Edit — remove codegraph entry |
| 26 | `templates/co-hr/.gitignore` | Edit — remove codegraph entry |
| 27 | `templates/co-news/.gitignore` | Edit — remove codegraph entry |
| 28 | `templates/co-price/.gitignore` | Edit — remove codegraph entry |
| 29 | `templates/co-security/.gitignore` | Edit — remove codegraph entry |
| 30 | `templates/co-work/.gitignore` | Edit — remove codegraph entry |
| 31 | `templates/common/docs/workspace-schema.json` | Edit — remove `.codegraph` from `ignored-dirs` (~L128) |

**Total: 31 files** (1 new + 30 edited).

## Verification

| # | Check | Expected Result |
|---|-------|-----------------|
| 1 | `bun scripts/validate-templates.ts` | 0 errors |
| 2 | `bun scripts/audit.ts` | Pass |
| 3 | `grep -ri codegraph` across `templates/` + L0 active files | 0 hits, excluding: `co-safety` archive/blueprint/superpowers dirs, `CHANGELOG.md`, `memory/`, `docs/designs/l2-to-variant-conversion-pipeline.md`, project `audit.ts` comments |
| 4 | Code inspection of `generate-variant.ts` | No codegraph emission in `.claude/settings.json` or `.gemini/settings.json` generation sections |
| 5 | JSON validity check on all edited `settings.json` files | Valid JSON (no trailing commas, balanced braces) |
| 6 | JSON validity check on both edited `workspace-schema.json` files | Valid JSON |

## Out of Scope

- **Project-side cleanup** — Individual project instances (settings files, `.codegraph/` SQLite databases, `.gitignore` entries, setup scripts) will be cleaned in a separate follow-up phase after this template-level PR merges. Templates must be clean first to prevent `upgrade-project` or variant regeneration from re-introducing codegraph into already-cleaned projects.
- **`co-safety` archive directory** — Deliberately preserved per 2026-06-21 meeting resolution.
- **CHANGELOG.md and memory/ historical records** — Never retroactively edited.
- **Core `scripts/audit.ts` comment-only references** — Will be resolved by future script version upgrades.

## Implementation Notes

- **Template-to-project ordering:** Variant templates are cleaned in this PR. Project-level cleanup happens in a subsequent phase. This order is mandatory — if projects were cleaned first, running `upgrade-project` or regenerating a variant from the (still-dirty) templates would re-introduce codegraph.
- **GateGuard pre-edit hook:** The workspace GateGuard hook will prompt for importer investigation on the first edit to each file. The implementer should comply with this prompt — the importers and downstream consumers have been identified in this design document's D1/D2 sections, so the investigation is already complete.

## References

- CHANGELOG.md — 2026-07-05 entry (initial codegraph removal from L0 root platform settings)
- CHANGELOG.md — 2026-05-24 entry (codegraph introduction, commit `d93100ae`, PR #59)
- CHANGELOG.md — 2026-06-16 entry (co-safety runtime removal)
- `docs/designs/l2-to-variant-conversion-pipeline.md` — documents the stripping rule for variant conversion
- 2026-06-21 meeting transcript — "Truth-in-Documentation" resolution for co-safety archive
