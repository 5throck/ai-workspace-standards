# AI Workspace Templates

![Template Version](https://img.shields.io/badge/version-0.4.0-blue)

This directory contains template variants for scaffolding new AI-assisted projects.
Select a variant when running `bash scripts/new-project.sh <name> --variant <variant>`.

## Available Variants

| Variant | Status | Description |
|---------|--------|-------------|
| [`co-develop`](co-develop/) | ✅ Stable | Software development workflow with full agent team |
| [`co-design`](co-design/) | 🔵 Planned | UI/UX design workflow |
| [`co-work`](co-work/) | 🔵 Planned | General collaboration workflow |

## Usage

```bash
# Default (co-develop)
bash scripts/new-project.sh my-project

# Explicit variant
bash scripts/new-project.sh my-project --variant co-develop
```

## Shared File Sync Rule

Some files are shared between the workspace and templates:
- `.claude/commands/meeting.md` ↔ `templates/co-develop/.claude/commands/meeting.md`

When the workspace version changes, manually sync to the template variant:
```bash
cp .claude/commands/meeting.md templates/co-develop/.claude/commands/meeting.md
bash scripts/validate-templates.sh  # confirm no drift
```

## Version Policy

See [CHANGELOG.md](CHANGELOG.md) for full history.

- **Major** bump: agent dispatch model changes
- **Minor** bump: new agents, new variants going stable, structural section changes
- **Patch** bump: documentation and description updates
