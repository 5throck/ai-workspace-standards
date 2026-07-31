# AI Workspace Templates

![Template Version](https://img.shields.io/badge/version-0.5.3-blue)

This directory contains template variants for scaffolding new AI-assisted projects.
Select a variant when running `bun scripts/new-project.ts <name> --variant <variant>`.

## Template Structure

```
templates/
├── common/              # Shared infrastructure (all variants)
│   ├── .githooks/       # Git hooks
│   ├── .github/         # GitHub integration (CI/CD, dependabot)
│   ├── scripts/         # Automation scripts
│   └── docs/_examples/  # Reference documentation
├── co-develop/          # Software development variant
├── co-design/           # Design workflow variant
├── co-work/             # Collaboration variant
├── co-security/         # Security engagement variant
├── co-consult/          # Strategy consulting variant
├── co-deck/             # Lecture/presentation variant (beta)
└── co-game/             # Game development variant (beta)
```

**How it works:** When scaffolding a new project, the script first copies `templates/common/` (shared infrastructure), then overlays the selected variant (variant-specific files override common files).

## Available Variants

| Variant | Status | Description |
|---------|--------|-------------|
| [`co-develop`](co-develop/) | ✅ Stable | Software development workflow with 7 agents (pm, architect, code-writer, etc.) |
| [`co-design`](co-design/) | ✅ Stable | Design workflow with 7 agents (design pm, service-design, ui-ux-design-intelligence, etc.) |
| [`co-work`](co-work/) | ✅ Stable | General collaboration workflow with 7 agents |
| [`co-security`](co-security/) | ✅ Stable | Security engagement workflow with 6 agents |
| [`co-consult`](co-consult/) | ✅ Stable | Strategy consulting with 15 agents and 16 domain skills |
| [`co-deck`](co-deck/) | 🔶 Beta | Lecture/presentation production with 13 agents and multi-theme HTML-to-PDF pipeline |
| [`co-game`](co-game/) | 🔶 Beta | Game development for HTML5 Canvas with Vanilla TypeScript and 12 agents |

## Usage

```bash
# Default (co-develop)
bun scripts/new-project.ts my-project

# Explicit variant
bun scripts/new-project.ts my-project --variant co-design

# Specify version tag
bun scripts/new-project.ts my-project --variant co-develop --version 0.5.3
```

## Shared File Sync Rule

Some files are shared between the workspace and templates:
- `.claude/commands/meeting.md` ↔ `templates/co-develop/.claude/commands/meeting.md`

When the workspace version changes, manually sync to the template variant:
```bash
cp .claude/commands/meeting.md templates/co-develop/.claude/commands/meeting.md
bun scripts/validate-templates.ts  # confirm no drift
```

## Version Policy

See [CHANGELOG.md](CHANGELOG.md) for full history.

- **Major** bump: agent dispatch model changes
- **Minor** bump: new agents, new variants going stable, structural section changes
- **Patch** bump: documentation and description updates

*Last Updated: 2026-07-31*
