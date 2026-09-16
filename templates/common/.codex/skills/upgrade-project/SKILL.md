---
name: upgrade-project
description: "Upgrade an existing L2/L3 project to the current template version. Use when: upgrading a variant-based project, syncing template improvements, refreshing scripts/agents/skills/docs/commands."
version: "1.5.0"
status: active
scope: workspace
owner: pm
last_reviewed: 2026-09-16
relates_to:
  - skill: promote-variant
    type: follows
metadata:
  type: scaffolding
  triggers:
    - upgrade project
    - upgrade template
    - sync project with template
    - refresh project
    - update project infrastructure
---

# Upgrade Project

Upgrades an existing project created from a variant template to match the current template version.

## When to Use

- The workspace template has been updated with new scripts, agent improvements, or security fixes
- A project needs to receive the latest governance or automation infrastructure
- Periodic maintenance to keep projects in sync with template evolution

## Prerequisites

- The project must have been created from a `co-*` variant template
- The project must be a git repository
- `bun` must be installed

## Script

**Script**: `scripts/upgrade-project.ts` (v1.28.0)
**Location**: Workspace root only (`L0` per ADR-0073 Amendment 1 — projects do not carry a copy; from inside a project use `bun ../../scripts/upgrade-project.ts .`)
**Usage**: `bun scripts/upgrade-project.ts <project-path> [--variant <name>] [--platform claude|antigravity|both] [--dry-run] [--prune-removed] [--rollback] [--yes] [--skip-context-commonization] [--force-context-sync]`

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `<project-path>` | Yes | Path to the target project. A path that resolves to the workspace ROOT is rejected (root is L0, not a project); targets outside `Projects/` print a warning |
| `--variant <name>` | No | Auto-detected from `.claude/template-version.txt` |
| `--platform <val>` | No | `claude`, `antigravity`, or `both` (default: both) |
| `--dry-run` | No | Analyze without making changes |
| `--prune-removed` | No | Remove files present in project but absent from template (falls back to a direct delete when `git rm` fails on untracked files) |
| `--rollback` | No | Restore pre-upgrade git stash snapshot; exits 1 when the restore fails. Under `--dry-run` it prints a no-op plan instead |
| `--yes` | No | Skip the proceed prompt when `template-version.txt` is missing |
| `--skip-context-commonization` | No | Opt out of the CONTEXT_COMMONIZATION pass for this run |
| `--force-context-sync` | No | Take the template `docs/context.md` even when the project copy carries project-only content (the discarded section count is logged) |

## How It Works

The upgrade tool classifies files into categories:

| Category | Behavior | Examples |
|----------|----------|---------|
| **LOCKED** | Unconditional overwrite | Git hooks, `.gitleaks.toml`, `.gitattributes` |
| **MERGE** | Section-based merge via markers | `CLAUDE.md`, `GEMINI.md`, `.gitignore`, `agents/pm.md` |
| **DOCS_MERGE** | Section-based merge (managed blocks) | `AGENTS.md`, `docs/<variant>.context.md` |
| **DOCS_OVERWRITE** | Plain overwrite (no blocks) | `docs/phase-definitions.md` |
| **VARIANT_DOCS_SYNC** *(folded v1.22.0)* | No longer a separate pass — its files (`docs/context.md` and the shared docs pair set) are delivered by **TEMPLATE TREE SYNC**'s default SYNC policy with identical inline-version/hash/conflict semantics | — |
| **TEMPLATE TREE SYNC** | Default-policy delivery for template files no dedicated pass claims: add-if-missing, then inline-version/hash update with conflict warning. `JSON_MERGE` deep-merges platform settings (project-only array entries preserved); `ADD_IF_MISSING` seeds (`.codex/config.toml`, graft surfaces) never overwrite; `WORKSPACE` seeds (`docs/designs/`, `docs/lifecycle/`, …) are add-if-missing only | Rest of the `docs/` tree (`user-guide`, variant domain docs, `countries/KR.md`, `skill-graph.overrides.json`), `.github/`, `.claude`/`.gemini/settings.json`, `.mcp.json`, `opencode.json`, `.editorconfig`, platform `skills.json` |
| **ENV_SAMPLE SYNC** *(since v1.23.0)* | Country-aware MERGE delivery of `.env.sample`: template content with `# >>> country-scoped:<CC>` blocks pruned to the project's detected country (region-neutral = all blocks stripped, matching scaffold posture); same-NAME keys superseded by the template line, project-only keys preserved under a marker section (idempotent); standard conflict warning on locally-modified copies | `.env.sample` |
| **CONTEXT_COMMONIZATION** *(since v1.20.0)* | After `docs/context.md` refreshes, near-duplicate top-level sections of `docs/<variant>.context.md` are pruned: token-overlap >= 0.65 → REMOVE (logged), >= 0.30 → REVIEW (manual Context Commonization Review, ADR-0050 Part 3 — never auto-removed), below → silent. Sections containing managed COMMON-*/VARIANT-INJECT content downgrade to REVIEW; managed zones and the version footer are excluded. Comparison reads the template source, so dry-run verdicts match apply | `docs/<variant>.context.md` |
| **GOVERNANCE FILES SYNC** *(since v1.12.0)* | Strictly add-if-missing delivery of top-level governance files from the variant template, then `templates/common`. An existing project file is always preserved (licenses are intentionally forkable) | `LICENSE`, `SECURITY.md` |
| **COMMANDS_SYNC** | Hash-based sync | `.claude/commands/*.md`, `.gemini/commands/*.md` |
| **SYNC_IF_NEWER** | Version-based update | Scripts (`.ts`), agents (`.md`), skills (`SKILL.md`) |
| **PRESERVE** | Never touched | `README.md`, `src/` |
| **OVERWRITE** | Governance files | `docs/_common/security.md` |

> **Path note**: the `docs/...` paths in the tables above (`docs/context.md`, `docs/phase-definitions.md`, `docs/engagement-orchestration.md`, `docs/team-configuration-guide.md`, `docs/_common/security.md`, etc.) live inside the generated variant project being upgraded, not at the workspace root.

**Coverage is deny-list by design** ([2026-09-11-upgrade-policy-coverage-design.md](../../docs/designs/2026-09-11-upgrade-policy-coverage-design.md)): the classification for every template path lives in `scripts/lib/upgrade-policy.ts`, and the fallback policy *delivers by default* — a file added to the template without a dedicated upgrade pass still reaches existing projects instead of silently falling through. `bun scripts/check-upgrade-coverage.ts [--variant <name>] [--strict] [--json]` reports (and with `--strict` gates) the classification matrix over the whole effective template tree: placeholder tokens in delivered files, WS-07 contamination (`docs/context.md` inside a variant template), and JSON health of `JSON_MERGE` targets.

### Supported Managed Block Markers

The merge engine recognizes these marker patterns for section-based merge:

| Marker | Open | Close | Use Case |
|--------|------|-------|----------|
| WORKSPACE-MANAGED | `<!-- WORKSPACE-MANAGED[:desc] -->` | `<!-- /WORKSPACE-MANAGED -->` | Generic managed sections |
| COMMON-CLAUDE | `<!-- COMMON-CLAUDE:START -->` | `<!-- COMMON-CLAUDE:END -->` | CLAUDE.md shared sections |
| COMMON-GEMINI | `<!-- COMMON-GEMINI:START -->` | `<!-- COMMON-GEMINI:END -->` | GEMINI.md shared sections |
| VARIANT-INJECT | `<!-- VARIANT-INJECT:label -->` | `<!-- END VARIANT-INJECT -->` | Variant template injection points |
| COMMON-AGENTS | `<!-- COMMON-AGENTS:START -->` | `<!-- COMMON-AGENTS:END -->` | AGENTS.md shared sections |
| COMMON-CONTEXT | `<!-- COMMON-CONTEXT:START -->` | `<!-- COMMON-CONTEXT:END -->` | Common coding-guidelines zone merged into `docs/<variant>.context.md` (since v1.26.0 — previously projects had no delivery channel for that zone) |
| DYNAMIC_SKILLS | `<!-- DYNAMIC_SKILLS_START -->` | `<!-- DYNAMIC_SKILLS_END -->` | Skill registry tables |

Keyed markers (WORKSPACE-MANAGED, VARIANT-INJECT) match project blocks by their `: label` suffix and insert labeled blocks the project lacks; unlabeled blocks match positionally.

### Safety Mechanisms

1. **Pre-upgrade git stash (tracked + untracked)**: apply mode runs `git stash push -u` creating `pre-upgrade-snapshot-YYYYMMDD`; since v1.28.0 untracked files are included, so every CONFLICT file has rollback coverage. A failed stash is a hard error (exit 1) — it is never treated as "working tree clean"
2. **Pre-scan conflict semantics (v1.28.0)**: the locally-modified file set is snapshotted BEFORE the stash runs, so `--dry-run` CONFLICT verdicts match the apply run instead of being silently downgraded to UPDATE once the tree is stashed clean
3. **Honest exit codes (v1.28.0)**: the script exits 1 when the pre-upgrade stash fails, when `--rollback` cannot restore the stash, or when the post-upgrade security summary is FAILED — a scripted consumer never sees a green exit for a red run
4. **Root-target guard (v1.27.0)**: a `<project-path>` resolving to the workspace ROOT is rejected with an error (the 2026-09-12 root-upgrade incident delivered the whole template/L1 tree through exactly this hole); targets outside `Projects/` warn
5. **`--dry-run` mode**: full analysis with zero writes; bootstrap artifacts are only verified on apply (they are materialized there), so dry runs skip the security checklist instead of reporting spurious failures
6. **Security bootstrap verification**: post-upgrade check of `.gitleaks.toml`, hooks, `.gitattributes`, `.gitignore`, and `core.hooksPath` (auto-fixed when drifted)
7. **Local modification detection**: warns when overwriting files that were locally modified before the upgrade started
8. **Post-upgrade sync-skills.ts**: automatically distributes platform skills after upgrade

### `docs/context.md` Version Sync

`docs/context.md` (the immutable common project-context file) carries an inline `*context.md
version: X.Y*` footer that the TEMPLATE TREE SYNC pass compares against `templates/common/docs/context.md`'s
footer on every upgrade run — if the project's copy is behind, it's updated automatically. Since v1.25.0
the overwrite is guarded: before copying, the pass detects project-only top-level sections (headings
absent from the template, outside COMMON-*/VARIANT-INJECT managed zones) or a missing version footer
(a fully restructured file). When project-only content exists, the copy is SKIPPED with a loud
CONTEXT PRESERVE log unless `--force-context-sync` takes the template version anyway (logging the
discarded section count). "Immutable" means don't hand-edit it for project-specific content (that
belongs in `docs/<variant>.context.md`) — it does not mean the file never changes; this is the
sanctioned, conflict-aware channel for it to receive non-breaking governance/infra updates over time.
`docs/<variant>.context.md`'s `<!-- VARIANT-INJECT -->`-wrapped sections (in DOCS_MERGE, above) are
the equivalent mechanism for that file's shared-guidance subset.

As the number of variants grows, unrelated `docs/<variant>.context.md` files independently
converging on similar wording is expected. `scripts/audit.ts`'s cross-variant context
commonization check (WARN-only) flags sections with high textual overlap across variants as
candidates for promotion into `docs/context.md` (if shared by most variants) or a shared skill
(if shared by only a subset) — run it after scaffolding a new variant, or at minimum every 5
variants / quarterly. Full procedure: `skills/context-commonization-review/SKILL.md`. Full rationale: ADR-0050 Part 3.

## Step-by-Step Procedure

1. **Check version**: `cat <project>/.claude/template-version.txt`
2. **Dry run**: `bun scripts/upgrade-project.ts <project> --dry-run`
3. **Commit local changes**: `cd <project> && git add -A && git commit -m "chore: pre-upgrade"`
4. **Run upgrade**: `bun scripts/upgrade-project.ts <project>`
5. **Verify**: `cd <project> && git status && git diff --cached`
6. **Commit**: `git commit -m "chore: upgrade template to vX.Y.Z"`

### Rollback

```bash
bun scripts/upgrade-project.ts <project> --rollback   # exits 1 if the restore fails
# or manually:
git stash list
git stash pop stash@{0}
```

## See Also

- [Project Upgrade Guide](../../docs/project-upgrade-guide.md)
- [Variant Conversion Guide](../../docs/variant-conversion-guide.md)
- [Fork Model (ADR-0031)](../../docs/adr/0031-l1-l2-fork-model.md)

## Post-Upgrade Verification

After upgrading, run the following to confirm script registry consistency:

```bash
cd <project-directory>
bun scripts/verify-scripts.ts --verify
```

Must exit 0 with 0 errors. If ghost entries appear, the project's `scripts/SCRIPTS.md` may need manual cleanup (see the Tier 3 SCRIPTS.md Filtering section of the script-lifecycle governance docs at the workspace root).
