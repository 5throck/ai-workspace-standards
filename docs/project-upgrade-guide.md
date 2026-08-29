# Project Upgrade Guide

**Version**: 1.0.0
**Last Updated**: 2026-07-14
**Scope**: Upgrading existing L2/L3 projects created from variant templates when templates are updated

---

## §1: Overview

When the workspace root (L0) or common template (L1) is updated — new scripts, bug fixes, security improvements, agent behavior changes — existing projects created from variant templates need to be upgraded to receive these improvements.

This guide documents the `upgrade-project.ts` tool that automates this process.

### Who Is This For?

- **Project owners** managing live L2/L3 projects created from `co-*` variants
- **PM agents** orchestrating workspace maintenance

### Prerequisites

- The project must have been created from a workspace variant template (co-*)
- The project must be a git repository
- `bun` must be installed

---

## §2: Upgrade Tool

**Script**: `scripts/upgrade-project.ts` (v1.2.2)
**Location**: Workspace root (`C:\git\ai_workspace\`)

### Usage

```bash
# From the workspace root
bun scripts/upgrade-project.ts <project-path> [--variant <name>] [--platform <claude|antigravity|both>] [--dry-run]
```

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `<project-path>` | Yes | Path to the target project directory (can be relative or absolute) |
| `--variant <name>` | No | Template variant to upgrade from (e.g., `co-design`). Auto-detected from `.claude/template-version.txt` if omitted |
| `--platform <val>` | No | `claude`, `antigravity`, or `both` (default). Controls which platform config files are merged |
| `--dry-run` | No | Analyze without making changes. All actions logged with `[DRY RUN]` prefix |

---

## §3: How the Upgrade Works

### 3.1 File Categories

The upgrade tool classifies files into 5 categories:

#### 🔒 LOCKED Files (Unconditional Overwrite)

These security-critical files are ALWAYS overwritten, regardless of local modifications:

| File | Purpose |
|------|---------|
| `.githooks/pre-commit` | Pre-commit hook |
| `.githooks/pre-push` | Pre-push hook |
| `.githooks/commit-msg` | Commit message hook |
| `.githooks/post-checkout` | Post-checkout hook |
| `.githooks/pre-rebase` | Pre-rebase hook |
| `.gitattributes` | Git attributes (line endings, etc.) |
| `.gitleaks.toml` | Secret detection configuration |

#### 🔀 MERGE Files (Section-Based Merge)

These files use HTML-comment marker pairs for safe section replacement — everything between a
`START`/`END` pair is treated as workspace-managed and resynced from the template; content
outside marker pairs (e.g. a project's own `## <Variant> Context` tail section) is left alone:

| File | Marker | Status |
|------|--------|--------|
| CLAUDE.md | `<!-- COMMON-CLAUDE:START --> ... <!-- COMMON-CLAUDE:END -->` | ✅ Active (since v1.3.0) |
| GEMINI.md | `<!-- COMMON-GEMINI:START --> ... <!-- COMMON-GEMINI:END -->` | ✅ Active (since v1.3.0) |
| .gitignore | `<!-- WORKSPACE-MANAGED -->` | ⏳ Pending marker implementation |
| agents/pm.md | Extends pattern (`extends:` frontmatter, not markers) | ✅ Active (ADR-0033) |

> ⚠️ **Failure mode**: if a project's CLAUDE.md or GEMINI.md is ever hand-rewritten and the
> `COMMON-CLAUDE`/`COMMON-GEMINI` marker comments are not preserved around the copied sections,
> `upgrade-project.ts` loses its merge point for that file — the MERGE step silently no-ops for
> it on every future upgrade, and the file drifts out of sync permanently. This happened to
> `Projects/co-price` and `Projects/co-abap` in 2026-08 (CLAUDE.md rewritten with 0-1 of 9
> expected markers, GEMINI.md with 0-1 of 4). See §6 and §7 below.

#### 🔄 SYNC_IF_NEWER Files (Version-Based Update)

Scripts, agents, and skills are updated only when the template version is newer:

- **Scripts** (`.ts` files): Compared via `// @version X.Y.Z` header comment
- **Agents** (`.md` files): Compared via YAML frontmatter `version:` field
- **Skills** (`SKILL.md`): Compared via YAML frontmatter `version:` or MD5 hash

##### Project Asset Allowlist Gate (v1.16.0)

Brand-**new** common assets are only injected when the project's own
`variant.json` registers them — the project registry is the SSOT for what the
project wants:

| Asset | Registry consulted | Behavior when unregistered |
|-------|--------------------|----------------------------|
| Common skill (`templates/common/skills/`) | `skill_manifest.allowlist` | `SKIP (not in variant.json skill allowlist)` |
| Common agent (`templates/common/agents/`) | `agents[].file` | `SKIP (not in variant.json agent registry)` |

- Updates to **already-present** assets are never gated; registration is
  consulted only for brand-new additions.
- The variant-skills pass (`templates/<variant>/skills/` → `skills/`) is exempt —
  the variant template is the authority for variant-owned skills.
- Projects without a `variant.json` keep the ungated behavior.

To adopt a new common asset, add its slug to `variant.json`
(`skill_manifest.allowlist`) or the agent file to `agents[]`, then re-run the
upgrade. Rationale: without this gate the 0.6.0 i18n wave injected
`i18n-specialist` / `i18n-audit` into projects whose rosters never registered
them, tripping `audit-variant.ts` allowlist/parity checks. See
`docs/designs/2026-08-29-upgrade-asset-allowlist-gate-design.md`.

#### 🛡️ PRESERVE Files (Never Touched)

These files are always preserved — local modifications are safe:

| File/Directory | Reason |
|---------------|--------|
| `README.md` | Project-specific documentation |
| `README_ko.md` | Korean translation |
| `docs/context.md` | Project context |
| `src/` | Project source code |
| Project-only agents/skills | Not in template |

#### 📋 OVERWRITE Files (Governance)

Specific governance files unconditionally overwritten:

| File | Reason |
|------|--------|
| `docs/_common/security.md` | Security policy must match template |

### 3.2 Safety Mechanisms

1. **Pre-upgrade git stash**: Creates `pre-upgrade-snapshot-YYYYMMDD` stash entry before any changes
2. **`--dry-run` mode**: Full analysis with zero file modifications
3. **Security bootstrap verification**: Post-upgrade check of critical security files
4. **Recovery**: Run `git stash pop` to restore pre-upgrade state

---

## §4: Step-by-Step Upgrade Procedure

### Step 1: Check Current Template Version

```bash
cat <project>/.claude/template-version.txt
```

This shows the variant, version, and last upgrade date.

### Step 2: Preview Changes (Dry Run)

```bash
bun scripts/upgrade-project.ts <project-path> --dry-run
```

Review the output carefully:
- Files that will be LOCKED (overwritten)
- Files that will be MERGED (skipped currently — no markers)
- Scripts/agents/skills that will be SYNC'd (version comparison results)
- Files that will be PRESERVED

### Step 3: Commit Local Changes

Before upgrading, commit any uncommitted work:

```bash
cd <project-path>
git add -A
git commit -m "chore: pre-upgrade commit"
```

### Step 4: Run Upgrade

```bash
bun scripts/upgrade-project.ts <project-path>
```

The tool will:
1. Create a pre-upgrade stash
2. Process LOCKED files (unconditional overwrite)
3. Process MERGE files (currently skipped)
4. SYNC scripts, agents, skills (version-based)
5. Update template-version.txt
6. Verify security bootstrap

### Step 5: Verify Results

```bash
cd <project-path>
git status
git diff --cached
```

Review all changes. Verify that:
- Security hooks are intact (`.githooks/pre-commit` exists)
- `.gitleaks.toml` is present
- `.gitattributes` contains `eol=lf`

### Step 6: Commit Upgrade

```bash
git add -A
git commit -m "chore: upgrade template to vX.Y.Z"
```

### Rollback (If Needed)

```bash
git stash list          # Find the pre-upgrade stash
git stash pop stash@{0} # Restore pre-upgrade state
```

---

## §5: Decision Tree — When to Upgrade

```
Was the workspace template updated?
├── No → No upgrade needed
└── Yes
    ├── Is your project actively maintained?
    │   ├── Yes → Proceed with upgrade
    │   └── No → Defer; upgrade when resuming work
    │
    ├── Does the update include security fixes?
    │   ├── Yes → UPGRADE IMMEDIATELY (LOCKED files handle security)
    │   └── No → Schedule at convenience
    │
    └── Have you modified template-managed files?
        ├── Yes → Review dry-run carefully; stash local changes first
        └── No → Safe to upgrade directly
```

---

## §6: Known Limitations

| Limitation | Impact | Workaround |
|-----------|--------|-----------|
| No 3-way merge for SYNC files | Local modifications to scripts/agents are silently overwritten | Commit local changes before upgrade; manually merge after |
| `.gitignore` MERGE mechanism non-functional | `.gitignore` updates don't propagate | Manual copy of needed sections |
| CLAUDE.md/GEMINI.md MERGE requires markers | If a project's file was ever hand-rewritten without preserving `COMMON-CLAUDE`/`COMMON-GEMINI` markers, the merge point is silently lost and the file drifts permanently (2026-08 co-price/co-abap incident) | `bun scripts/audit.ts` at the workspace root WARNs on marker-count drift for any `Projects/co-*` checked out locally; re-add the missing marker pairs manually (compare against `templates/common/CLAUDE.md`/`GEMINI.md`) |
| No deleted file handling | Stale files from old templates accumulate | Periodic manual cleanup |
| No `--rollback` flag | Must know to use `git stash pop` | Keep this guide handy |
| Script subdirectories hardcoded | New script directories in future templates may be missed | Report missing dirs after upgrade |

---

## §7: Troubleshooting

### "Template has no WORKSPACE-MANAGED markers — skipping"

This is expected for `.gitignore` (the one remaining MERGE file without markers). This file won't be updated during upgrade — manually copy the relevant sections if needed.

### CLAUDE.md/GEMINI.md not picking up template changes after upgrade

Check whether the project's file still has its `COMMON-CLAUDE:START`/`COMMON-GEMINI:START` marker comments intact: `grep -c "COMMON-CLAUDE:START" CLAUDE.md` (expect it to roughly match `templates/common/CLAUDE.md`'s count). If the count is 0 or noticeably lower, the file was likely hand-rewritten at some point without preserving the markers — `upgrade-project.ts` has had nothing to merge into ever since. Fix by manually re-wrapping the corresponding sections with `<!-- COMMON-CLAUDE:START -->` / `<!-- COMMON-CLAUDE:END -->` (or `COMMON-GEMINI`) to match `templates/common/CLAUDE.md`/`GEMINI.md`, then re-run the upgrade. `bun scripts/audit.ts` at the workspace root flags this automatically (WARN-only) for any `Projects/co-*` present on the local machine.

### "SKIP (no template)" for agent files

Some agent files in the MERGE list (automation-engineer, docs-writer, scaffolding-expert, security-expert) don't exist in templates. These are stale references that will be removed in a future version.

### Security bootstrap check fails

The tool auto-fixes `core.hooksPath`. For other failures:
- Verify `.gitleaks.toml` exists and is valid
- Verify `.gitattributes` contains `eol=lf`
- Verify `.gitignore` contains `.env`

### Unversioned project (no template-version.txt)

The tool will prompt for confirmation before proceeding. This is expected for projects created before version tracking was added.

---

## §8: Related Documentation

- [Variant Creation Guide](../.agents/skills/create-variant/SKILL.md) — Phase A: Creating new variants
- [Variant Promotion Guide](../.agents/skills/promote-variant/SKILL.md) — Phase B: Promoting variants
- [New Project Scaffolding](constitution/07-new-project.md) — Creating new L3 projects
- [Fork Model (ADR-0031)](adr/0031-l1-l2-fork-model.md) — L1/L2 propagation philosophy
- [Variant Review Report (2026-07-14)](variant-review-report-2026-07-14.md) — Infrastructure audit results
