# Design: Union-Merge Fix for CHANGELOG/Memory Conflicts

**Date**: 2026-08-18
**Status**: Approved
**Spec ID**: 2026-08-18-changelog-memory-conflict-fix
**Scope**: `.gitattributes` (workspace root, `templates/common/`, `templates/co-deck/`, live `Projects/*/`), `CHANGELOG.md`

---

## 1. Problem Statement

Recurring textual merge conflicts on `CHANGELOG.md` and `memory/*.md` whenever two PR branches are open at the same time. Every `/sync` run (`scripts/dev-sync.ts`) commits these shared pipeline files on **every** commit:

- `CHANGELOG.md` — entries prepended under `## [Unreleased]` (line 171-186 gate + manual `/changelog` edits)
- `memory/YYYY-MM-DD.md` — session summary appended (`appendFileSync`, dev-sync.ts lines 110-145)
- `memory/MEMORY.md` — index row inserted (scripts/sync-md.ts)
- `docs/VERSION_MANIFEST.md` — fully regenerated (scripts/generate-version-manifest.ts, run on every sync)
- `scripts/README.md` — fully regenerated (scripts/generate-scripts-readme.ts, run on every sync)
- `templates/CHANGELOG.md` — L0 template changelog (root only)

Two PR branches based on the same `main` both modify the same anchor lines (top of `[Unreleased]`, end of the day's memory file, header separator of the MEMORY.md session table) → the second merge always raises a conflict even though the changes are purely additive.

**Prior attempt**: `docs/designs/sequential-pr-merge-policy-design.md` (2026-07-11) added a process rule ("merge before branching, or justify parallel work"). The design doc itself notes sequential merge order cannot fix this — the conflicts are baked in at branch creation time. Conflicts continue (e.g. commit 651a2b36 "merge main into handbook design docs branch to resolve CHANGELOG/memory conflicts"). A process rule is not sufficient; a mechanical fix is required.

## 2. Decision Summary

Add git's built-in **`merge=union` union merge driver** to `.gitattributes` for the append-only / regenerated pipeline files:

```
CHANGELOG.md merge=union
templates/CHANGELOG.md merge=union
memory/*.md merge=union
docs/VERSION_MANIFEST.md merge=union
scripts/README.md merge=union
```

`merge=union` instructs git to auto-combine both sides' lines in a conflicting hunk instead of emitting conflict markers. Because these files are append/prepend-only or fully regenerated on every sync, both sides' additions are always non-exclusive content that should both be kept. Verified by simulation (see §7): a two-branch parallel append scenario that previously conflicted now merges cleanly with both branches' entries preserved.

**Applied to**:
- `.gitattributes` (workspace root) — includes `templates/CHANGELOG.md`
- `templates/common/.gitattributes` — inherited by every new project via `new-project.ts` `copyDir()` and refreshed by `upgrade-project.ts`
- `templates/co-deck/.gitattributes` — variant overlay (co-deck projects overwrite the common copy, so the rules must exist here too)
- `Projects/*/.gitattributes` (co-abap, co-abap-plugin, co-architect, co-consult, co-deck, co-game, co-news, safety_os) — immediate relief for live variant repos; co-architect already had a partial block, only the regenerated-file rules were added there

## 3. Files to Change

| File | Action |
|------|--------|
| `.gitattributes` | Add union block (incl. `templates/CHANGELOG.md`) |
| `templates/common/.gitattributes` | Add union block |
| `templates/co-deck/.gitattributes` | Add union block |
| `Projects/*/.gitattributes` (8 live repos) | Add union block |
| `CHANGELOG.md` | Document this change under `[Unreleased]` |

## 4. Trade-offs Considered

| Option | Pro | Con | Decision |
|--------|-----|-----|----------|
| `merge=union` via `.gitattributes` | Zero dependency (git built-in driver), industry-standard for changelogs, mechanical, no per-merge resolution | Entry order after a union merge is not chronological (may need a quick manual pass); duplicate rows possible in regenerated files until the next sync | **Selected** |
| Changelog fragments (towncrier/scriv style: `docs/changelog.d/<branch>.md`, aggregated at release) | Conflicts become impossible by construction | Larger architectural change; generated CHANGELOG still needs a conflict strategy; overkill for this workspace | Rejected |
| `git rerere` (reuse recorded resolution) | Auto-replays previously recorded resolutions | Requires initial manual resolution per conflict shape; does not handle genuinely divergent appends; config-dependent | Rejected |
| Post-merge-only writes (write memory/CHANGELOG only on `main` after merge) | PR branches never touch shared files | Changes when logs appear (not written until merge); behavior change with edge cases (never-merged PRs); larger sync-flow rework | Rejected for now |
| Process rule only (status quo, sequential-branch rule) | Already in governance docs | Proven insufficient — conflicts are baked in at branch-creation time | Rejected |

**Documented limitations of the selected option**:
- **Ordering**: union concatenation is deterministic but not chronological. CHANGELOG entries are date-prefixed so order within `[Unreleased]` is cosmetic; memory session summaries may need a quick manual reorder.
- **Duplicates**: a union merge of two *regenerated* files (`docs/VERSION_MANIFEST.md`, `scripts/README.md`) can contain transient duplicate rows (e.g. two rows for one script with different versions). These are overwritten by the next sync's regeneration, and no audit parses them, so they self-heal.
- **In-place edits**: if two branches edit the *same existing line* (rare — these files are append-only in practice), both versions appear. Acceptable.
- **Scope**: only the listed files. `scripts/SCRIPTS.md` (SSOT registry, row-update style) is deliberately **not** unioned — union could duplicate rows for a script both branches update.

## 5. Platform Impact

| Platform | Impact |
|----------|--------|
| Claude Code | None — git-level, not prompt-level |
| Antigravity (GEMINI.md) | None |
| templates/common | `.gitattributes` union block inherited by all new projects |

No CLAUDE.md / GEMINI.md changes; no script changes. `merge=union` is a built-in git driver — no `git config` required.

## 6. Acceptance Criteria

- [x] Union block present in root, `templates/common/`, `templates/co-deck/` `.gitattributes`
- [x] Union block present in all 8 live `Projects/*/.gitattributes`
- [x] `git check-attr merge -- CHANGELOG.md memory/MEMORY.md docs/VERSION_MANIFEST.md scripts/README.md templates/CHANGELOG.md` → `union`
- [x] Scratch-repo simulation: parallel branches appending CHANGELOG entries + memory summaries + regenerating VERSION_MANIFEST merge with zero conflict markers; both sides' content preserved
- [x] `bun scripts/audit.ts` passes

## 7. Verification

Two-branch simulation in a throwaway repo (git 2.x, `ort` merge strategy): branch A and branch B each prepended a CHANGELOG entry, appended a session summary to the same `memory/2026-08-18.md`, and bumped the same script's row in `docs/VERSION_MANIFEST.md`. After merging A then B:

- `CHANGELOG.md`: both entries preserved under `[Unreleased]`, no conflict markers
- `memory/2026-08-18.md`: both session summaries preserved
- `docs/VERSION_MANIFEST.md`: duplicate rows (as predicted), regenerated away at next sync
- `git merge` exited cleanly — "Merge made by the 'ort' strategy"

## 8. Future Follow-up (not in scope)

- Evaluate unioning `scripts/SCRIPTS.md` if row-update conflicts resurface
- Consider migrating to changelog fragments if the union ordering caveat becomes a nuisance
