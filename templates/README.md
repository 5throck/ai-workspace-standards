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
│   ├── scripts/         # Automation scripts (dev-sync, test-runner, etc.)
│   └── docs/_examples/  # Reference documentation
├── co-develop/          # Software development variant
├── co-design/           # Design workflow variant
├── co-work/             # Collaboration variant
├── co-security/         # Security engagement variant
├── co-consult/          # Strategy consulting variant
├── co-deck/             # Lecture/presentation variant (beta)
├── co-game/             # Game development variant (beta)
└── co-export/           # Import/export trade compliance variant (beta)
```

**How it works:** When scaffolding a new project, the script first copies `templates/common/` (shared infrastructure), then overlays the selected variant (variant-specific files override common files).

## Available Variants

| Variant | Status | Description |
|---------|--------|-------------|
| [`co-develop`](co-develop/) | ✅ Stable | Software development workflow with 7 agents (pm, architect, code-writer, designer, security-monitor, stack-setup, test-runner) |
| [`co-design`](co-design/) | ✅ Stable | Design workflow with 8 agents (design pm, design-lead, prototype-engineer, service-designer, etc.) |
| [`co-work`](co-work/) | ✅ Stable | General collaboration workflow with 7 agents (pm, analyst, content-writer, ms365-expert, etc.) |
| [`co-security`](co-security/) | ✅ Stable | Security engagement workflow with 6 agents (pm, red-team-lead, pentester, threat-modeler, etc.) |
| [`co-consult`](co-consult/) | ✅ Stable | Strategy consulting with 11 agents and 16 domain skills |
| [`co-deck`](co-deck/) | 🔶 Beta | Lecture/presentation production with 13 agents and multi-theme HTML-to-PDF pipeline |
| [`co-game`](co-game/) | 🔶 Beta | Game development for HTML5 Canvas with Vanilla TypeScript and 13 agents |
| [`co-export`](co-export/) | 🔶 Beta | Import/export trade-compliance workflow with 8 agents (HS classification, export control, FTA origin, duty drawback, logistics, market entry, foreign regulation monitoring, trade documentation) |

## Phase 1, 2 & 3 Advancements

The following 2026 Q3–Q4 roadmap enhancements have been integrated across template variants:

- **`generate-ide-rules.ts`**: Automatically generates `.cursorrules` and `.clauderules` context rules during scaffolding to sync IDE coding agents with project context (`co-develop`).
- **`zod-contract-gate`**: Mandates Zod runtime schema validation across internal API contract boundaries in `co-develop`.
- **`swe-solve`**: Autonomous 4-stage problem-solving workflow (Ingest & Inspect → Localization & Plan → Mutation & Test → Review & PR) in `co-develop`.
- **`compile-tokens.ts`**: Compiles `tokens.json` design tokens to CSS custom properties and TypeScript types in `co-design`.
- **`accessibility-audit`**: Automated WCAG 2.1 AA accessibility evaluation using axe-core in `co-design`.
- **`mece-logic-auditor`**: Structural MECE issue tree auditor with ME/CE/Logic scorecards in `co-consult`.
- **`presenter-mode`**: Dual-window HTML5 presenter display with BroadcastChannel synchronization in `co-deck`.
- **`render-pdf-deck.ts`**: Playwright-based paged-media presentation PDF renderer supporting CSS `@page` print rules in `co-deck`.
- **`ecs-core.ts`**: Zero-dependency 150-line TypeScript Entity Component System core engine in `co-game`.
- **`sound-synth`**: Web Audio API procedural retro 8-bit sound effect generator (`jsfxr`) in `co-game`.
- **`stride-threat-matrix`**: Automated STRIDE threat modeling template with DREAD risk scoring in `co-security`.
- **`sarif-exporter`**: Exports security findings in SARIF v2.1.0 format for GitHub PR security checks in `co-security`.
- **`md-to-ooxml.ts`**: Markdown to native Microsoft Office OOXML (`.docx` / `.xlsx`) compiler script in `co-work`.
- **`standup-synthesizer`**: Automated 24-hour daily standup digest synthesizer in `co-work`.


## Usage

```bash
# Default (co-develop)
bun scripts/new-project.ts my-project

# Explicit variant
bun scripts/new-project.ts my-project --variant co-design

# Specify platform and version tag
bun scripts/new-project.ts my-project --variant co-develop --platform both --version 0.5.3
```

### Automation & Testing Scripts (templates/common/scripts)

Scaffolded projects inherit shared automation scripts from `templates/common/scripts/`:

- **`dev-sync.ts` (v1.5.0)**: Full development sync pipeline (`bun run dev-sync "feat: msg"` or `--body-file <path>`). Includes pre-flight markdown link validation gate (`bun scripts/validate-docs-links.ts`), session logging, MEMORY.md indexing, CHANGELOG check, audit gate, sensitive file detection, git commit/push, and GitHub PR creation.
- **`test-runner.ts` (v1.1.0)**: Test suite runner (`bun scripts/test-runner.ts [suite] [flags]`). Supports `unit`, `integration`, `scenarios`, and `scripts` suites with parallel execution (`--parallel`/`--sequential`), worker pool concurrency control (`--concurrency <n>`), per-test timeouts (`--timeout <ms>`), and isolated worker temp directories (`TEST_TEMP_DIR`).

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

*Last Updated: 2026-08-10*
