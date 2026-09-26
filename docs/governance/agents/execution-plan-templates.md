# Execution Plan Templates — Operational Reference

> Canonical operational reference relocated from L0 `AGENTS.md` (ADR-0090 thin-dispatcher restructure, 2026-09-26).
> Content below is verbatim from the source section at extraction time; AGENTS.md points here.
> Source: `AGENTS.md §5`. Relocation-only move — rules unchanged (design N2).

**Load contract**: PM and specialists MUST Read this file before executing the workflow it describes. Citing a rule without reading its owning file is a process violation.

---

## §5: Execution Plan Templates

### §5.1 Standard Execution Plan Template

> **Design Gate (Row 0)**: Universal across tiers (L0–L3) per ADR-0074 — every code change must
> carry spec activity (design doc + registry entry), enforced by the sync-time spec-check
> (`audit.ts --spec-check`, dev-sync step 3.9, FATAL). Full Row 0 ceremony (execution-plan
> boilerplate, architect ownership) applies at L0/L1; L2/L3 satisfy the gate with the
> one-design-doc convention via `scripts/spec-register.ts`.

| # | Task | Agent | Tier | Model | Spec |
|---|------|-------|------|-------|------|
| 0 | Create/update design doc → `docs/designs/<spec-id>-design.md` | architect | High | [model] | NEW |
| 1 | [task description] | [specialist] | High/Medium/Low | [model] | <spec-id> |
| N | `/sync "type(scope): message"` — lifecycle + audit + commit + push + PR | pm | Medium | [model] | |

**Execution Order**: [Parallel | Sequential]

**Key points**:
- **Row 0 (Design Gate) is MANDATORY at every tier (ADR-0074)** — a design document must be created/updated before implementation; L2/L3 satisfy it with a single design doc + `spec-register.ts` entry (full ceremony stays L0/L1)
- **Design docs for user-facing features MUST include an Accessibility section** (target level, affected interaction areas, verification method) per ADR-0065 — accessibility is a mandatory consideration for web/app/CLI/document feature development (WCAG 2.1 AA baseline); backend/non-UI work is exempt only with an explicit statement
- **Design docs for user-facing web/app UI MUST include a Preview Verification note** (rendered check at ≥ 2 declared breakpoints, ≥ 1 key interaction, evidence attached) per ADR-0070 — a UI change is not done until it was seen rendered; pure backend/non-UI work is exempt only with an explicit statement
- Tier column is MANDATORY (High/Medium/Low)
- `/sync` is always the final step — it covers lifecycle update, full audit, commit, push, and PR creation
- No separate Lifecycle Update or Final QA Audit rows needed — `/sync` handles both
- State parallel vs sequential order below the table
- "pm (direct)" is FORBIDDEN - PM never executes directly
- **When a plan spans more than one PR**: merge each PR before branching for the next row's work, per [CONSTITUTION.md §3.3 Sequential Branch Dependency Rule](../../../docs/constitution/03-pr-workflow.md#33-sequential-branch-dependency-rule) — `dev-sync.ts` touches shared pipeline files (CHANGELOG.md, memory logs, VERSION_MANIFEST.md, generated READMEs) on every commit, so unmerged parallel branches conflict by default. If parallel branches are genuinely required, this plan's Trade-offs section must state why.

### §5.1.1 Design Gate Exemptions

When a task falls into an exempt category, Row 0 is replaced with an exemption marker:

| Category | ID | Description | Row 0 Format |
|----------|----|-------------|--------------|
| memory-log | E1 | Session log entry in `memory/YYYY-MM-DD.md` | `── EXEMPT: memory-log ──` |
| changelog | E2 | `CHANGELOG.md` update only | `── EXEMPT: changelog ──` |
| hotfix-typo | E3 | Typo fix, single-line change, trivial fix | `── EXEMPT: hotfix-typo ──` |
| pure-readme | E4 | README.md body text only (no structural/design change) | `── EXEMPT: pure-readme ──` |
| sync-only | E5 | `/sync` execution only (lifecycle finalization) | `── EXEMPT: sync-only ──` |

**Rules**:
- Exempt Row 0: Agent/Tier/Model columns left blank (`—`)
- Only E1–E5 categories may be used — PM cannot invent ad-hoc exemptions
- Abuse of exemptions is a governance violation
- These codes are machine-consumed by `audit.ts --spec-exempt=E1..E5` / `SYNC_SPEC_EXEMPT` (ADR-0055 Stage 2 gating; invalid codes hard-Fail)

### §5.2 Platform Parity Considerations

When modifying files that affect both CLAUDE.md and GEMINI.md:

| # | Task | Agent | Tier | Model | Spec | Platform |
|---|------|-------|------|---------|----------|
| 1 | [task] | [specialist] | [tier] | [model] | Both |
| N | `/sync "type(scope): message"` | pm | Medium | [model] | Both |

**Platform Column**: `Claude` / `Antigravity` / `Both` / `L0-only`

**Note**: See execution plan boilerplate in CLAUDE.md ("### 5. Agent Dispatch Rules" and "## Execution Plan Boilerplate"), GEMINI.md (identical headings), and agents/pm.md for the Platform column definition.

### §5.3 Example Execution Plans

#### Example 1: Multi-Agent Platform Parity Update

<!-- WORKSPACE-MANAGED: tier-model-mapping -->
> **Note**: The `Model` column below shows the Claude Code short alias (`sonnet`/`opus`/`haiku`/`fable`) actually passed to the `Agent()` tool's `model` parameter — not the registry ID (e.g. `claude-sonnet-5-0`). See [CLAUDE.md §6](../../../CLAUDE.md#6-native-sub-agents-agent-tool) for the registry-ID → alias translation table. On Gemini/Antigravity, use the literal model ID instead (see GEMINI.md's equivalent example).
<!-- /WORKSPACE-MANAGED -->

| # | Task | Agent | Tier | Model | Spec |
|---|------|-------|------|-------|------|
| 1 | Update agents/pm.md | docs-writer | Medium | sonnet | <spec-id> |
| 2 | Update scripts/audit.ts | automation-engineer | Low | haiku | <spec-id> |
| 3 | Update CLAUDE.md §5 | docs-writer | Medium | sonnet | <spec-id> |
| 4 | Update GEMINI.md §5 | docs-writer | Medium | sonnet | <spec-id> |
| 5 | `/sync "docs(agents): update pm.md and platform dispatch rules"` | pm | Medium | sonnet | |

**Execution Order**: Sequential (platform parity requires CLAUDE.md and GEMINI.md updates together)

#### Example 2: Single Specialist Task

| # | Task | Agent | Tier | Model | Spec |
|---|------|-------|------|-------|------|
| 1 | Update project README introduction | docs-writer | Medium | sonnet | <spec-id> |
| 2 | `/sync "docs: update project README introduction"` | pm | Medium | sonnet | |

**Execution Order**: Sequential

---

