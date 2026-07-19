---
content_hash: PLACEHOLDER
sync_version: 1
---

# co-game

**Language**: **English** · [한국어](README_ko.md)

> **⚠️ BETA VARIANT** - Status: beta (v0.1.0)
> This variant is in active development and should not be used in production environments.

---

Game development variant for HTML5 Canvas games using Vanilla TypeScript. Specialized agents for game design, arcade/puzzle genres, visual art, sound, engine implementation, debugging, and testing.

## Quick Start

This is a beta variant of the workspace template. It inherits from `templates/common` and includes variant-specific customizations.

### For Claude Code users:

See `CLAUDE.md` for detailed instructions.

### For Gemini CLI users:

See `GEMINI.md` for detailed instructions.

## Beta Status

This variant is currently in **beta** and requires:

- **Client Engagements**: 0/3 (see variant governance rules)
- **Beta Duration**: 0/3 months
- **Additional Checks**: Pending

See `scripts/helpers/variant-governance-rules.ts` for promotion criteria.

## Variant Type

**Type**: game

This variant focuses on Game development for HTML5 Canvas games using Vanilla TypeScript.

## Agent Roster

| Agent | Role | Tier | Model |
|-------|------|------|-------|
| **architect** | Design agent — produces implementation plans and technical specs. | Medium | claude-sonnet-4-6 |
| **game-designer** | Universal game design agent — core game loop, difficulty curves, reward systems, tutorial/onboarding. | Medium | claude-sonnet-4-6 |
| **arcade-designer** | Arcade game design specialist — entity AI patterns, wave/stage systems, item/power-up mechanics, scoring. | Medium | claude-sonnet-4-6 |
| **puzzle-designer** | Puzzle/board game design specialist — matching/link logic, turn-based systems, difficulty generation. | Medium | claude-sonnet-4-6 |
| **designer** | UI/UX design agent — wireframes, component specs, design tokens. | Medium | claude-sonnet-4-6 |
| **game-developer** | Game implementation agent — Canvas rendering engine, game loop, collision detection, entity systems. | Medium | claude-sonnet-4-6 |
| **visual-artist** | Visual asset specification agent — sprite sheet layouts, animation frames, board/tile visuals, backgrounds. | Medium | claude-sonnet-4-6 |
| **sound-designer** | Procedural audio design specialist — SFX specs, BGM loop structures, Web Audio API effect chains. | Medium | claude-sonnet-4-6 |
| **game-debugger** | Game debugger agent — root-causes bugs, proposes fixes, writes reproduction tests. | Medium | claude-sonnet-4-6 |
| **test-runner** | QA and verification agent — runs tests, validates acceptance criteria, QA gate. | Medium | claude-sonnet-4-6 |
| **security-monitor** | Security monitor — scans for vulnerabilities, advisories, and secret leaks. | Medium | claude-sonnet-4-6 |
| **stack-setup** | Stack Setup Specialist — environment setup, build configuration, unrecognized-stack recovery. | Medium | claude-sonnet-4-6 |

> **PM Gateway**: `agents/pm.md` (High tier) orchestrates all specialist dispatch — see [AGENTS.md](AGENTS.md) for the full PM Gateway workflow and dispatch triggers.
> **Genre routing**: `arcade-designer` handles reaction/timing-based arcade games (maze, shooter, breakout, snake); `puzzle-designer` handles turn-based/grid games (match-3, logic puzzles, board/card games); `designer` and `stack-setup` are optional/skip-if-not-needed.

## Skills

| Skill | Location | Purpose |
|-------|----------|---------|
| `code-review` | `skills/code-review/` | Systematic PR/code quality, security, and standards review |
| `refactoring` | `skills/refactoring/` | Safe, test-backed structural code improvement |
| `test-driven-development` | `skills/test-driven-development/` | Red-green-refactor TDD workflow |

Additional platform skills (agent lifecycle, security scanning, meeting facilitation, script/skill lifecycle management, etc.) are available under `.claude/skills/` — see [AGENTS.md §6](AGENTS.md#§6-skills) for the full resolution order and registry.

---

**Generated**: 2026-07-08T00:02:24.182Z
**MVP Wave 3** - L2-to-Variant Pipeline
**Updated**: 2026-07-19 — agent roster and skills corrected to match variant.json/AGENTS.md current state
