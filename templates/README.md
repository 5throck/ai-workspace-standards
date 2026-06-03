# AI Workspace Templates

![Template Version](https://img.shields.io/badge/version-0.5.0-blue)

This directory contains template variants for scaffolding new AI-assisted projects.
Select a variant when running `bash scripts/new-project.sh <name> --variant <variant>`.

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
└── co-consult/          # Strategy consulting variant
```

**How it works:** When scaffolding a new project, the script first copies `templates/common/` (shared infrastructure), then overlays the selected variant (variant-specific files override common files).

## Available Variants

| Variant | Status | Description |
|---------|--------|-------------|
| [`co-develop`](co-develop/) | ✅ Stable | Software development workflow with 7 agents (pm, architect, code-writer, etc.) |
| [`co-design`](co-design/) | ✅ Stable | UI/UX design workflow with 5 agents (design pm, design-lead, ux-researcher, visual-designer, prototype-engineer) |
| [`co-work`](co-work/) | ✅ Stable | General collaboration workflow with 4 agents (collaboration pm, analyst, content-writer, project-coordinator) |
| [`co-security`](co-security/) | 🔶 Beta | Security engagement workflow with 6 agents (pm, red-team-lead, pentester, threat-modeler, patch-engineer, report-writer) |
| [`co-consult`](co-consult/) | ✅ Stable | Strategy consulting workflow with 11 specialized agents (Engagement Leader, Strategy Analyst, Industry Expert, Change Management Partner, Communications Lead, and more) |

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

*Last Updated: 2026-06-03*
