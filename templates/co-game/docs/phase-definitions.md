# Phase Definitions — co-game

This document defines the workflow phases used by the `co-game` variant. It follows the standard workspace phase structure (see `templates/common/docs/phase-definitions.md`) with co-game's actual specialist agents mapped to each phase, per each agent's `phases:` frontmatter field in `agents/*.md` and the Phase Determination Checklist in `AGENTS.md §3.5`. co-game uses a 6-phase model (Phases 0–5); the standard Phase 5 (Lifecycle Finalization) and Phase 6 (QA & Finalization) are collapsed into co-game's single Phase 5 (Finalization), which owns both governance updates and the `/sync`/PR pipeline.

---

## Phase Overview

| Phase | Name | PM Role | Who Acts |
|-------|------|---------|----------|
| 0 | Team Assembly | Orchestrator | PM + `stack-setup`, `security-monitor` (baseline scan) |
| 1 | Triage | Observer | `architect`, `game-designer`, `arcade-designer` *or* `puzzle-designer`, `stack-setup` |
| 2 | Analysis | Gate Keeper | PM + `architect`, `game-designer`, `arcade-designer` *or* `puzzle-designer` |
| 3 | Design | Coordinator | `designer`, `visual-artist`, `sound-designer` |
| 4 | Implementation | Coordinator | `game-developer`, `game-debugger`, `test-runner` |
| 5 | Finalization | Owner | PM (governance + audit + `/sync` + PR) + `security-monitor` (pre-PR advisory check) |

> `arcade-designer` vs `puzzle-designer` is genre-gated (see `co-game.context.md § Genre-Based Dispatch`): exactly one is active for pure-genre projects; both plus `game-designer` are active for hybrid genres.

---

## Phase Details

### Phase 0 — Team Assembly
**PM opens the phase**: clarify the game objective, confirm scope and genre, assemble the specialist team.
- PM reviews the request and classifies the genre (Arcade, Puzzle/Board, or Hybrid) per the Genre-Based Dispatch table
- `stack-setup` (Tier: Low) prepares the environment when the project manifest is unrecognized; security-reviews every setup command before execution
- `security-monitor` (Tier: Medium) runs a post-scaffold baseline scan to seed `security/` and catch vulnerabilities introduced by scaffolded dependencies
- PM identifies which specialist agents are in scope, including the genre-correct designer (`arcade-designer` or `puzzle-designer`)
- **Output**: confirmed scope, genre classification, team assignment, baseline security state

### Phase 1 — Triage
**PM observes**: read-only specialist agents work in parallel to analyze the request.
- `architect` (Tier: High) analyzes requirements and sketches the architectural approach (data models, module boundaries, type system)
- `game-designer` (Tier: High) defines universal design direction: core loop, difficulty curve principles, reward system, tutorial flow
- `arcade-designer` *or* `puzzle-designer` (Tier: High) applies genre-specific analysis — entity AI / wave systems / scoring (arcade) or matching logic / turn systems / difficulty generation (puzzle)
- `stack-setup` (Tier: Low) may continue supporting environment/dependency identification
- PM intervenes only if analysis quality or genre classification is insufficient
- **Output**: architectural sketch, universal + genre design direction, identified constraints
- **Gate**: none — phase ends when agents signal completion

### Phase 2 — Analysis
**PM enforces the gate**: synthesizes Phase 1 findings into requirements and acceptance criteria; no design execution or implementation without explicit user approval.
- `architect` (Tier: High) produces the implementation plan and any ADRs for significant architectural decisions; surfaces trade-offs explicitly
- `game-designer` (Tier: High) finalizes the universal game design specification (state machines, difficulty tables, reward tables, tutorial flow)
- `arcade-designer` *or* `puzzle-designer` (Tier: High) finalizes the genre-specific design specification (entity AI tables, level data, scoring formulas *or* matching rules, board data, difficulty algorithms)
- PM synthesizes all findings into a consolidated requirements + acceptance-criteria document
- **USER APPROVAL REQUIRED** before proceeding to Phase 3 (asset/UI design) and Phase 4 (implementation)
- **Output**: approved implementation plan, ADRs, universal + genre design specifications, requirements + acceptance criteria

### Phase 3 — Design
**PM coordinates**: asset, UI, and audio specialists produce executable specifications from the approved Phase 1-2 design direction.
- `designer` (Tier: Medium) produces UI/UX specifications: wireframes, component specs, interaction flows, design tokens (WCAG AA minimum)
- `visual-artist` (Tier: Medium) produces sprite/animation frame specs, procedural Canvas rendering instructions, board/tile visuals, backgrounds, and HUD elements — all geometric, no image files
- `sound-designer` (Tier: Medium) produces procedural audio specifications: SFX (oscillator/GainNode/BiquadFilterNode parameters), BGM loop structures, audio effect chains, and trigger mappings using the Web Audio API
- Agents hand off directly to each other and to Phase 4 without PM intervention (e.g. `game-designer`/genre-designer → `visual-artist` for visual style; → `sound-designer` for audio-visual sync triggers)
- **Output**: UI/UX specs, visual asset specs, audio specs — all ready for `game-developer` to implement

### Phase 4 — Implementation
**PM coordinates**: the build-test-debug loop executes against the approved specs.
- `game-developer` (Tier: Low) implements the Canvas rendering engine, game loop (fixed timestep), collision detection, entity systems, sprite rendering, and gameplay mechanics — strictly from approved specs; reports blockers rather than redesigning
- `test-runner` (Tier: Medium) runs the test suite, validates each acceptance criterion, and runs the audit script as the QA gate; produces a pass/fail report
- `game-debugger` (Tier: Medium) is dispatched on bug reports to apply systematic-debugging root-cause analysis, propose targeted fixes, write reproduction tests, and document resolved patterns in `docs/bug-patterns/`
- Loop: `game-developer` → `test-runner` → `game-debugger` (on failures), up to **3 iterations** before escalating to the user
- **Output**: implemented game, passing test suite, clean audit, bug-pattern documentation

### Phase 5 — Finalization
**PM owns**: governance updates and the session close-out pipeline.
- PM updates governance documents for any agent/skill/script changes
- PM logs decisions to `memory/YYYY-MM-DD.md`
- `security-monitor` (Tier: Medium) runs the pre-PR advisory check (read-only) and surfaces any active CRITICAL advisories before merge
- PM runs the audit gate; maximum 2 fix iterations before escalating to the user
- PM runs the `/sync` pipeline (memlog → sync-md → changelog → audit → commit → push → PR)
- PR opened with English title and description
- **Output**: passing audit report, governance records updated, merged PR or open PR link

---

## Agent-to-Phase Mapping (Source of Truth)

Per each agent's frontmatter `phases:` field in `templates/co-game/agents/*.md`. The `phases:` field is authoritative; any narrative text inside an agent body or in `co-game.context.md` that conflicts with this table is stale and must be reconciled to match the frontmatter.

| Agent | Phases | Tier | Optional? |
|-------|--------|------|-----------|
| `stack-setup` | 0, 1 | Low | Yes (unrecognized stack only) |
| `security-monitor` | 0, 5 | Medium | No |
| `architect` | 1, 2 | High | No |
| `game-designer` | 1, 2 | High | No |
| `arcade-designer` | 1, 2 | High | Yes (arcade-genre only) |
| `puzzle-designer` | 1, 2 | High | Yes (puzzle-genre only) |
| `designer` | 3 | Medium | No |
| `visual-artist` | 3 | Medium | No |
| `sound-designer` | 3 | Medium | No |
| `game-developer` | 4 | Low | No |
| `game-debugger` | 4 | Medium | Yes (on bug reports) |
| `test-runner` | 4 | Medium | No |

**Tier sourcing note**: Every co-game agent declares an explicit `tier:` block in its frontmatter (`tier.claude: high | medium | low`). No tier was inferred. The workspace 3-tier model maps these to registry IDs and Claude Code dispatch aliases as follows: High → `claude-opus-4-7` → `model = "opus"`; Medium → `claude-sonnet-4-6` → `model = "sonnet"`; Low → `claude-haiku-4-5` → `model = "haiku"` (see `CLAUDE.md §6`).

> **Note (discrepancy for future maintainer)**: `co-game.context.md § Workflow Phases` describes Phase 3 (Design) as the phase where "Game Designer produces universal spec" and "Genre Designer produces genre spec". This conflicts with the authoritative frontmatter: `game-designer`, `arcade-designer`, and `puzzle-designer` all declare `phases: [1, 2]`, meaning their spec production happens in Phase 1 (Triage) and Phase 2 (Analysis), **not** Phase 3. Per the documented convention (frontmatter `phases:` is the source of truth), this `phase-definitions.md` file places those three designers in Phases 1-2. The `co-game.context.md` Workflow Phases table should be reconciled to match — Phase 3 is owned by `designer`, `visual-artist`, and `sound-designer` (asset/UI/audio specs only). This file intentionally does **not** edit `co-game.context.md` or any agent file; the reconciliation is left to a separate governance change.

---

## Variant Customization Points

co-game declares its specialist agents per phase in `AGENTS.md §3.5 Phase Determination` and each agent's `agents/<name>.md` frontmatter:

```yaml
# Example agent frontmatter (game-designer)
phases: [1, 2]
handoff_to: [game-developer, visual-artist]
handoff_from: [pm]
required_skills: []
```

The PM role and Phase 0/5 structure track the workspace-standard phase model. co-game differs from the standard template in phases 1-4:

- **Phases 1-2 are fused read-only analysis**: `architect`, `game-designer`, and the genre-selected `arcade-designer` *or* `puzzle-designer` all act in both phases — there is no separate "research" vs "design review" split. The user approval gate sits at the end of Phase 2 and governs entry into both Phase 3 (asset design) and Phase 4 (implementation).
- **Genre-gated design parallelism**: exactly one of `arcade-designer`/`puzzle-designer` is active for pure-genre projects; both are active alongside `game-designer` for hybrid genres (tower defense, roguelike, idle). `game-designer` always provides the universal layer; the genre designer applies it.
- **Phase 3 is the asset/UI/audio layer only**: `designer` (UI/UX), `visual-artist` (sprites, tiles, HUD, procedural rendering), and `sound-designer` (Web Audio API SFX + BGM) produce executable specifications — never code, never image/audio files (zero-dependency procedural constraint).
- **Phase 4 is a tight dev→test→debug loop**: `game-developer` (Low tier — the only Low-tier implementation agent) implements from approved specs, `test-runner` runs the QA gate, and `game-debugger` is dispatched on failures, looping up to 3× before user escalation.
- **Phase 5 merges lifecycle finalization and QA**: co-game collapses the standard Phase 5 (governance) and Phase 6 (audit + `/sync` + PR) into a single owner-phase, with `security-monitor` performing a read-only pre-PR advisory check as the final gate.

---

## PM Facilitation per Phase

| Phase | PM Opening | PM Monitoring | PM Synthesis |
|-------|-----------|---------------|--------------|
| 0 | Classify genre, assemble team, dispatch `stack-setup`/`security-monitor` | Confirm env setup + baseline scan complete | Scope + genre classification + team assignment |
| 1 | Brief read-only analysts (`architect`, `game-designer`, genre designer) on triage goals | Track parallel analysis quality | Triage findings + confirmed genre |
| 2 | Synthesize Phase 1 findings into requirements + AC | — | Approved requirements + AC + design specs (USER APPROVAL) |
| 3 | Hand off approved direction to `designer`/`visual-artist`/`sound-designer` | Intervene if off-spec or off-genre | Asset/UI/audio specs ready for implementation |
| 4 | Confirm implementation scope with `game-developer` | Track dev→test→debug loop (max 3 iterations) | QA gate pass report |
| 5 | Update governance + run audit + `/sync` | Fix audit issues (max 2 iterations); run `security-monitor` pre-PR check | PR link + memory log + drift report |
