# graft → Trail Vendor Rename Migration Policy (U-20261031-009) — Design

- **Date**: 2026-10-31
- **Status**: Approved (2026-10-31, user mandate — process-all-tickets directive)
- **Spec id**: `2026-10-31-graft-trail-migration`
- **Owner**: architect (dispatched by PM)
- **Related**: ADR-0074 (Design Gate), ADR-0076 (graft fleet integration), design `2026-10-02-self-managed-tool-surfaces` (`docs/self-managed-surfaces.json`), design `2026-10-31-template-security-hardening-design.md` (R2.4 removes the graft Bash wildcards), U-20261031-009, DEC-20261031-03
- **UI exemption**: Documentation, gitignore, and policy changes only. No UI surface. Exempt per ADR-0065 and ADR-0070.
- **Scope guard**: This is a policy + L0/L1 doc/config update. It is NOT a fleet-wide mechanical migration. Delivered projects converge on their next upgrade visit.

## R1 — Problem

The graft vendor renamed the product to Trail (`@trailhq/trail-code`) at
0.25 → 0.28, and `graft upgrade` auto-runs `trail init`, which rewrites
tracked repo surfaces outside agent control. co-develop hit this on
2026-10-31; co-work, co-export, co-game, co-price carry the same surfaces and
hit it on their next upgrade. Every affected repo produces the same
working-tree diff, and the workspace's own L0/L1 surfaces still speak graft.

### R1.1 — Claim verification table (ticket claims vs source, 2026-10-31)

| Claim | Verdict | Evidence |
|---|---|---|
| L0 skill SSOT at `skills/graft/SKILL.md` | **confirmed** | File exists; frontmatter `name: graft`, `scope: common`, `l2_propagate: false`, `mirror: false`; triage reason `info:l0_origin skills/graft/SKILL.md <- skills/graft/SKILL.md` |
| Five platform mirrors of the skill | **confirmed** | `.claude/skills/graft/`, `.agents/skills/graft/`, `.codex/skills/graft/`, `.gemini/skills/graft/`, `.hermes/skills/graft/` all present (gitignored, self-managed) |
| `.gitignore` carries a graft-mirror block needing trail-era paths | **confirmed** | L0 `.gitignore` L80-89: `graft.local.json` override + five `.<platform>/skills/graft/` mirrors + `.claude/helpers/graft-{hooks,statusline}.cjs`; L196-197: `/graft/` graph cache (`graft build`). Same block ships in `templates/common/.gitignore` L75-85 and variant templates (co-price verified identical) |
| AGENTS.md graft block rewritten in place by `trail init` | **confirmed** | `AGENTS.md` L286+ `<!-- graft:start -->…<!-- graft:end -->` block present; `skills/graft/SKILL.md` L98-106 documents the block as tool-managed (`upsertSection` re-appends on deletion; durable removal is `graft uninstall`) |
| co-develop post-migration state | **confirmed** | `Projects/co-develop/.claude/settings.json` SessionStart now runs `.trail/hook.cjs`; graft allow entries (`graft:`, `npx graft:*`, `graft-dev:`, `node dist/cli.js:*`) already removed from its allow list; `.claude/helpers/graft-hooks.cjs` gone |
| Template reconciliation / dev-sync managed-block checks may flag rewritten blocks | **confirmed, with the specific checks named** | The AGENTS.md graft block is tool-managed via `graft:start`/`graft:end` markers — it is NOT a `WORKSPACE-MANAGED:`/`COMMON-*` keyed block, so `validate-templates.ts` MM-01 (model-literal placement) and VA-05 (COMMON-* section sync) do not police it and will NOT flag it. The real flag/re-seed risk on the next upgrade visit is `scripts/upgrade-project.ts` TEMPLATE TREE SYNC: `JSON_MERGE` deep-merges `.claude/settings.json` (graft-era hook entries would be re-merged into the trail-rewritten file) and the `.mcp.json` / helper seeds use ADD_IF_MISSING semantics (deleted-by-trail seeds get re-added). Also `scripts/skill-session-review.ts` and skill-graph tooling reference `skills/graft/` paths |
| References to graft across the workspace are broad | **confirmed** | `skills/SKILLS.md` (registry row), `docs/VERSION_MANIFEST.md` L55 (skill row: `skills/graft/SKILL.md`), `docs/self-managed-surfaces.json` (nine graft paths), `skills/create-variant/SKILL.md` (graft surface checklist + `WORKSPACE-MANAGED: graft repo context graph` note), `skills/upgrade-project/SKILL.md` (ADD_IF_MISSING seeds list), `skills/adopt-project/SKILL.md`, ADR-0076, AGENTS.md graft block, templates' `.claude/.gemini` settings mcpServers + HERMES.md + .gitignore |

### R1.2 — What `trail init` does (observed, co-develop)

Rewrites AGENTS.md graft markers to trail markers (index path `graft/` →
`.trail/cache/`, commands `graft` → `trail`); swaps `opencode.json` MCP entry;
replaces `.claude/settings.json` graft hooks with `.trail/hook.cjs`; deletes
tracked `.mcp.json` and `.claude/helpers/graft-{hooks,statusline}.cjs`;
creates `.trail/` (cache self-gitignored, learnings committable).

## R2 — Decision

### R2.1 — Skill SSOT disposition: rename `skills/graft` → `skills/trail`

**Decision: rename, with an alias note in the renamed SKILL.md.** Not
keep-and-alias-doc.

Rationale:
1. The skill is doctrine for a tool whose CLI surface (every command in the
   doc: `graft ask/grep/skeleton/callers/map/build/check`) becomes `trail …`
   after migration. Keeping a `graft`-named skill that teaches `graft`
   commands would be wrong doctrine the moment the binary on PATH is Trail —
   the skill's trigger words (`graft`, `repo context graph`) and body would
   diverge from reality on every migrated repo.
2. Alias-only documentation leaves the registry vocabulary wrong in every
   surface that enumerates skills (SKILLS.md, VERSION_MANIFEST.md,
   self-managed-surfaces.json) and breaks the mirror-path convention
   (`skills/<name>/` ↔ `.<platform>/skills/<name>/`).
3. This is a low-cost rename: one directory, one frontmatter `name:`, one
   registry row each in SKILLS.md and VERSION_MANIFEST.md, one
   self-managed-surfaces.json entry, and prose updates in the four lifecycle
   skills. The tool's own mirrors are self-managed and regenerate at
   `trail init` — the workspace does not hand-migrate them.

Aliased-compat note added to the renamed SKILL.md: "renamed from graft
(vendor rename 0.28, @trailhq/trail-code); `graft …` commands in older
references read as `trail …`". The rename is L0; nothing propagates to
templates/common (the skill is `scope: common` but `l2_propagate: false` and
the template does not ship a copy — verified: no `templates/common/skills/graft/`).

References to update (grep-verified set):
- `skills/SKILLS.md` registry row (`graft` → `trail`)
- `docs/VERSION_MANIFEST.md` L55 row (path + name + triggers)
- `docs/self-managed-surfaces.json`: replace the graft tool entry with a
  `trail` entry carrying BOTH path generations — keep the graft-era paths
  (`.claude/skills/graft/`, helpers, `skills/graft/`) AND add trail-era paths
  (`.trail/`, `.claude/helpers/trail-*` when observed) so validators skip
  both during the transition. Do not delete the graft paths yet: pre-migration
  projects still carry them.
- `skills/create-variant/SKILL.md` (surface checklist + managed-block note)
- `skills/upgrade-project/SKILL.md` (seed list wording)
- `skills/adopt-project/SKILL.md` (graft build step wording)
- `AGENTS.md` — NO hand-edit of the `graft:start/end` block (tool-managed;
  hand edits are reverted at next session start). The rename is invisible to
  it until `trail init` rewrites it.
- `skills/graft/SKILL.md` → `skills/trail/SKILL.md` (git mv, body updated to
  trail command names with a graft-era compatibility note)

Historical docs (ADR-0076, past designs, CHANGELOG) are records — never
retro-edited.

### R2.2 — `.gitignore` update for trail-era paths

Extend, don't replace, the tool-owned block in L0 `.gitignore` and
`templates/common/.gitignore`:

```gitignore
# --- Trail (ex-graft) tool-owned surfaces — self-managed, design 2026-10-31-graft-trail-migration:
.trail/cache/
.claude/helpers/trail-hooks.cjs
.claude/helpers/trail-statusline.cjs
# --- graft-era surfaces (pre-migration instances; keep until fleet converges) ---
(existing graft block stays, commented as legacy)
```

`.trail/cache` is self-gitignored by the tool per the ticket, but the
workspace-level entry costs nothing and protects pre-`trail init`
partial states. The `/graft/` cache line stays until convergence (it is
regenerable, harmless if orphaned). Rename the block comment from "WORKSPACE-MANAGED
graft-mirror" to "tool-owned mirrors (trail-era + graft-era legacy)".

### R2.3 — Platform skill mirrors policy

No workspace action on mirror CONTENT: all five mirrors are self-managed
(gitignored, `docs/self-managed-surfaces.json`, design 2026-10-02). Policy:

1. The renamed SSOT is `skills/trail/`. sync-skills does NOT mirror it
   (self-managed carve-out stays; update the carve-out paths per R2.1).
2. Post-migration, `trail init` regenerates the platform mirrors itself
   (observed: co-develop's Claude hooks now point at `.trail/hook.cjs`).
3. Transition rule for validators: mirror-freshness and skill-graph tooling
   that enumerate `skills/*/` must tolerate the absence of a `.trail`-era
   mirror for `skills/trail/` — the existing self-managed skip already
   covers this once `self-managed-surfaces.json` lists trail paths.

### R2.4 — Per-project migration guidance + dev-sync tolerance

On the next upgrade visit to a graft-era project, the migration sequence is:

1. Project owner (or upgrade-project skill) runs the vendor upgrade; `trail
   init` rewrites the working tree (the co-develop diff shape).
2. The upgrade MERGE pass then runs. Two concrete conflicts to handle — this
   is the "dev-sync managed-block check" the ticket asked to name precisely:
   - **`JSON_MERGE` on `.claude/settings.json`** (`scripts/upgrade-project.ts`
     TEMPLATE TREE SYNC): the L1 template still carries graft-era hook
     entries, so a naive merge would re-add `graft-hooks.cjs` hooks into the
     trail-rewritten file. Tolerance rule: the merge skips template hook
     entries whose command references a path that does not exist in the
     project after migration (existsSync-style guard on the helper path), and
     the R2.6 dedupe helper of the security batch collapses any residue.
     Template-side, once R2.5 lands, the graft hook entries leave the template
     and the conflict class disappears.
   - **ADD_IF_MISSING seeds** (`.mcp.json`, helper files): add-if-missing
     re-adds files that Trail deliberately deleted. Tolerance rule: when the
     project carries `.trail/` (the migration marker), the graft-era seeds
     for `.mcp.json` / `graft-hooks.cjs` / `graft-statusline.cjs` are treated
     as RETIRED — recorded in the upgrade decision log as `SEED_SKIP`
     (retired-surface), not re-seeded.
3. The renamed `skills/trail/` SSOT arrives via the skill-sync pass like any
   L0 skill; the old `skills/graft/` copy is removed by the same pass in
   projects where it was tracked (most instances gitignore it — no-op).

No hand-edits in `Projects/co-*` outside an upgrade visit.

### R2.5 — Template surfaces

`templates/common` ships graft-era surfaces (`.gitignore` block, `.gemini`
mcpServers.graft, `.claude` hook/helper references in variant templates,
create-variant checklist). Policy: update the `.gitignore` block (R2.2) and
prose references now; leave the mcpServers/`graft` hook entries in place as
 graft-era defaults UNTIL a template-level trail migration pass is designed —
removing them now would change what new scaffolds get while the L0 tooling
itself still runs graft 0.25-era. The security batch (design
2026-10-31-template-security-hardening R2.4) already removes the graft Bash
allow wildcards; that is the permission surface settled. The mcpServers and
helper-hook surface follows in a dedicated follow-up ticket when the L0
itself completes its own `trail init` — which is the trigger event for the
whole L0/L1 surface flip, and is deliberately NOT part of this design's
mechanical scope.

### R2.6 — What we do NOT do

- No fleet-wide scripted `trail init` across the 16 projects. Migration
  happens at each project's natural upgrade visit.
- No hand-edit of the AGENTS.md graft block (tool-managed; reverted anyway).
- No retro-edit of historical records (ADR-0076, CHANGELOG, past designs).
- No deletion of graft-era gitignore/validator tolerance while any project is
  pre-migration.

## R3 — Files to change

| File | Action | Description |
|---|---|---|
| `skills/graft/` → `skills/trail/SKILL.md` | rename + edit | Frontmatter `name: trail`; body commands `graft` → `trail`; graft-era alias note |
| `skills/SKILLS.md` | modify | Registry row rename |
| `docs/VERSION_MANIFEST.md` | modify | Row path/name/triggers |
| `docs/self-managed-surfaces.json` | modify | graft entry → trail entry carrying both path generations |
| `.gitignore` | modify | Trail-era block + legacy comment (R2.2) |
| `templates/common/.gitignore` | modify | Same block |
| `skills/create-variant/SKILL.md`, `skills/upgrade-project/SKILL.md`, `skills/adopt-project/SKILL.md` | modify | Prose: trail naming, seed-retirement rule (R2.4) |
| `scripts/upgrade-project.ts` | modify | `.trail/` marker → SEED_SKIP(retired-surface) for graft-era seeds; existsSync guard for helper-referencing hook entries in JSON_MERGE (R2.4) |

## R4 — Platform Impact

| Platform | Impact | Files Affected |
|---|---|---|
| Claude Code | settings.json hook entries currently reference graft helpers; JSON_MERGE guard prevents re-adding them post-migration | `scripts/upgrade-project.ts` |
| Antigravity (GEMINI.md) | None — gemini mcpServers.graft stays until the follow-up pass; no doc change targets GEMINI.md | N/A — the graft block AGENTS.md rewrite is tool-managed and arrives via trail init |
| Gemini CLI | Shares gemini settings | same as above |
| Codex | `.codex/config.toml` seed and `.codex/skills/graft/` mirror are self-managed/tool-owned; seed-retirement rule covers it | upgrade-project seed list |
| templates/common | .gitignore block update only (R2.5) | `templates/common/.gitignore` |
| Hermes | `.hermes/skills/graft/` mirror is self-managed; no doc ships to hermes in this change | N/A |

## R5 — Acceptance criteria

- [ ] `skills/trail/SKILL.md` exists with `name: trail`, valid frontmatter (lifecycle gates read it), and a graft-era alias note; `skills/graft/` is gone.
- [ ] SKILLS.md, VERSION_MANIFEST.md rows reference `skills/trail/SKILL.md`.
- [ ] `docs/self-managed-surfaces.json` lists trail-era paths and retains graft-era paths (both skipped by validators).
- [ ] L0 and `templates/common` `.gitignore` carry the trail-era block with the graft block retained as legacy.
- [ ] `bun scripts/validate-templates.ts`, `bun scripts/audit.ts --spec-check --lifecycle-only`, and skill registry sync checks pass with the renamed skill.
- [ ] upgrade-project fixture: a project containing `.trail/` + missing `.mcp.json` does NOT get `.mcp.json` re-seeded; decision log records `SEED_SKIP (retired-surface)`.
- [ ] upgrade-project fixture: template hook entries referencing nonexistent helper paths are not merged into `.claude/settings.json`.

## R6 — Non-goals / risks

- No forced migration; pre-migration projects keep working graft surfaces until their visit.
- Residual risk: `trail init` behavior beyond the observed co-develop diff (e.g. future path changes) — the marker-based (`.trail/` exists) tolerance rules degrade gracefully: unknown surfaces re-seed as before, worst case recreating today's flag-and-clean loop.
