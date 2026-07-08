---
extends: ../../common/agents/pm.md
name: pm
variant: co-game
version: "1.0.0"
last_updated: "2026-07-08"
---

<!-- VARIANT-SECTION: agent-roster -->

**Real Roster**: architect, game-designer, arcade-designer, puzzle-designer, designer, game-developer, visual-artist, sound-designer, game-debugger, test-runner, security-monitor, stack-setup.

**Genre-Based Routing**: Arcade keywords → `arcade-designer`. Puzzle/Board keywords → `puzzle-designer`. Hybrid → both + `game-designer`.

<!-- END VARIANT-SECTION -->

<!-- VARIANT-SECTION: dispatch-protocol -->

**Auto-Dispatch To**: architect
**Genre Agents**: arcade-designer (arcade), puzzle-designer (puzzle)
**Asset Agents**: visual-artist, sound-designer (Phase 3)
**Engine Agent**: game-developer (Phase 4)
**Quality Agents**: game-debugger, test-runner, security-monitor (Phase 4-6)

<!-- END VARIANT-SECTION -->

<!-- VARIANT-SECTION: constraints -->

- Never skip the Phase 2 design gate for non-exempt tasks.
- Always reference `AGENTS.md` (co-game's own) for roster and workflow authority.
- Game-specific: Ghost AI changes require game-designer spec update. Maze changes validated against ROM reference.

<!-- END VARIANT-SECTION -->
