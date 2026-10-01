# Design: Self-managed tool surfaces — generic exclusion registry (T-20261002-001)

- **Spec ID**: 2026-10-02-self-managed-tool-surfaces
- **Date**: 2026-10-02
- **Status**: implemented
- **Source**: manual (user decision 2026-10-02: stop managing graft inside the workspace and
  templates/common; keep the tool self-managed)

## Problem

The graft CLI installs and rewrites its own surfaces (`skills/graft/` SSOT copy,
`.claude/skills/graft/` and sibling platform mirrors, `.claude/helpers/graft-*.cjs`,
`graft.local.json`). Governed ownership of those paths caused a recurring failure loop:
graft rewrites strip the SKILL.md frontmatter (`version:` missing → lifecycle gates fail),
re-bake helper paths (dirty-file churn swept into commits — the PR #1280 / T-20261001-015
evidence class), and the template mirrors drift (mirror-parity warnings, upgrade MISSING
findings, project gate noise).

## Decision (generic mechanism, not a graft one-off)

1. **Registry** — `docs/self-managed-surfaces.json`: a list of tools, each with `name`,
   `reason`, and `paths` (repo-relative files/directories the tool owns). Future self-managing
   tools register here instead of inventing ad-hoc ignores.
2. **Shared loader** — `scripts/lib/self-managed-tools.ts`: loads the registry and exposes
   `isSelfManagedPath(rel)` for validators.
3. **Validator wiring** — checks that scan those paths consult the registry and skip:
   `verify-platform-lifecycle.ts` (Check A missing-version and mirror checks),
   `skill-lifecycle-audit.ts` (frontmatter scans). Everything else follows from the files
   no longer being tracked or shipped.
4. **Root custody transfer** — `git rm --cached` the graft surfaces + `.gitignore` entries
   added in the WORKSPACE-MANAGED ignore block. graft keeps regenerating them locally;
   git sees nothing. `skills/graft/SKILL.md` (SSOT) stays tracked with valid frontmatter and
   `l2_propagate: false` so no platform mirror is regenerated from it.
5. **Template withdrawal** — delete the graft mirrors under `templates/common/` (skills/graft +
   four platform mirrors) and drop the graft rows from `docs/templates/common-contract.json`.
   New scaffolds and upgrades stop delivering graft as governed content. Projects keep their
   existing copies until the next `--prune-removed` upgrade removes them; the delivered
   `.gitignore` entries stop the churn in the meantime. Project sessions keep full graft
   capability (the graft MCP entry and per-project `graft build` are independent of the skill
   mirrors).
6. **custody note** — `.claude/helpers/graft-hooks.cjs` and `graft-statusline.cjs` are included
   in the transfer (they are re-baked by graft's session hook). A fresh clone must run
   `graft init` once to materialize them.

## Accessibility

Non-UI tooling change — no accessibility impact (per ADR-0065).

## Preview Verification

Non-UI change — no rendered-preview verification required (per ADR-0070).

## Verification

- `bun scripts/verify-platform-lifecycle.ts` — clean with graft surfaces present but
  frontmatter-stripped (the exact state that failed before).
- `bun scripts/skill-lifecycle-audit.ts` — clean.
- `bun scripts/audit.ts` — pipeline gate battery (this run).
- `git status` clean of graft churn after a graft session-hook rewrite.
