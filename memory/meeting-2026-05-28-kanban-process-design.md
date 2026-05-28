# Meeting Transcript
**Date**: 2026-05-28
**Topic**: Kanban Process and System Design for Current and New Projects
**Participants**: pm, architect, automation-engineer, docs-writer, auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

### Facilitator Opening (PM)

Two agenda items:
1. **Current project**: Introducing a Kanban system into the ai-workspace-standards workspace root itself.
2. **New projects**: Bundling a Kanban process as a default when projects are created via `new-project.sh`.

The workspace has strong event-driven pipelines (/sync, /changelog, /memlog, /meeting) but lacks a visual task-state tracking system.

---

### Round 1

**Architect**:

The workspace has event-driven pipelines but no state-machine model for tracking work. Kanban is fundamentally a state machine: `Backlog → In Progress → Review → Done`. Three architectural layers require decisions:

**Layer 1 — Storage**: Where to persist board state. Options: (A) fully delegate to GitHub Issues/Projects API, (B) local `kanban/` directory with markdown files, (C) extend `memory/`. Recommends **(B) + (A) sync**: `kanban/board.md` as canonical source of truth, synced to GitHub Projects at `/sync` time. Rationale: local files work offline and are easily readable/writable by AI agents.

**Layer 2 — Slash Commands**: New slash command `.claude/commands/kanban.md` providing `/kanban add`, `/kanban move`, `/kanban done`, and `/kanban list`. Commands should update `kanban/board.md` immediately without requiring a full `/sync`.

**Layer 3 — New Project Propagation**: `new-project.sh` must copy `kanban/` directory and `kanban/board.md` (empty initial state) along with `.claude/commands/kanban.md`. These files belong in `templates/common/` so all variants receive them automatically.

Question to AutomationEngineer: What are the practical limits of parsing `kanban/board.md` in bash/PowerShell — is pure `sed`/`awk` sufficient, or is a bun TypeScript helper required?

---

**AutomationEngineer**:

Supports the (B) + (A) sync direction. Strongly opposes markdown table parsing in pure bash/PowerShell: `awk -F'|'` breaks immediately when task names contain `|` characters or backticks in cell content. Same problem with PowerShell `-split '\|'`. Historical precedent: the `/changelog` perl implementation was replaced with python3 for exactly this reason.

Proposes **`scripts/kanban.ts`** — a bun TypeScript helper responsible for:
1. Parsing `kanban/board.md` (regex-based, multibyte-safe)
2. Card CRUD (add / move / done / list)
3. `--json` output mode for agent-readable structured data
4. `--gh-sync` flag for GitHub Projects API sync

The `.claude/commands/kanban.md` slash command is a thin wrapper calling `bun scripts/kanban.ts "$ARGUMENTS"`. Since bun is already an assumed dependency, no new dependencies are introduced.

Prefers **section header format** for board.md (`## Backlog`, `## In Progress`, `## Review`, `## Done`) over table format — easier to parse and more human-readable.

Question to Architect: Is the section header format acceptable architecturally? Question to DocsWriter: Should the board.md format spec be added to CONSTITUTION.md?

---

**DocsWriter**:

Section header format is clearly superior for documentation purposes. Table format requires fixed columns and schema changes for every new metadata field. Section headers allow each card to be a standalone markdown block — extensible without format versioning.

Proposed card format for `kanban/board.md`:

```markdown
## Backlog

### [CARD-001] Fix encoding issue
- **Priority**: High
- **Owner**: automation-engineer
- **Created**: 2026-05-28
- **Labels**: bug, encoding

## In Progress
...
```

Advantages: `CARD-NNN` ID enables 1:1 mapping with GitHub Issues; human-editable; `kanban.ts` parsing on `###` headers is far more stable than table parsing.

Concern raised to Architect: `kanban/` in `templates/common/` is correct, but `board.md` must be **initialized empty per project** — not copied with content. `scripts/kanban.ts` and `.claude/commands/kanban.md` go in `templates/common/scripts/` and `templates/common/.claude/commands/`. This distinction is critical: `kanban/board.md` must be classified as **PRESERVE tier** so `upgrade-project` never overwrites user board data.

Question to Auditor: Should a missing `kanban/board.md` in a stable variant be added as Check 12 in `validate-templates.ts`?

---

**Auditor**:

DocsWriter's PRESERVE tier observation is the most critical point raised so far. The current `upgrade-project.sh` LOCKED/MERGE/PRESERVE classification table in `CONSTITUTION.md §10` has no explicit entry for `kanban/` files — introducing Kanban without updating that table risks the first `upgrade-project` run silently overwriting user board data.

Three consistency gaps identified:

**Gap 1**: Architect's proposal to add Kanban to `templates/common/` requires an immediate update to `CONSTITUTION.md §10` classification table. `kanban/board.md` → PRESERVE, `scripts/kanban.ts` → LOCKED, `.claude/commands/kanban.md` → LOCKED.

**Gap 2**: DocsWriter's `CARD-NNN` ID scheme — if ID generation lives in `scripts/kanban.ts`, a collision-prevention strategy is needed. Must verify coexistence with daily memory log naming.

**Gap 3**: AutomationEngineer's `--gh-sync` flag — GitHub Projects API v2 is GraphQL. Adding a GraphQL client to bun creates a new dependency. A safer approach: use `gh` CLI as a proxy (`gh project item-add ...`), which wraps GraphQL and is consistent with `dev-sync.sh`'s existing `gh pr create` pattern.

Question to AutomationEngineer: When implementing GitHub Projects sync via `gh project item-add`, how should the project number be discovered/stored — `kanban/config.json` or `.claude/` settings?

---

### Round 2

**Architect**:

Auditor's three gaps are correct. CONSTITUTION.md §10 update is a prerequisite — without it, the Kanban design will be destroyed on the first `upgrade-project` run.

Final file classification:

| File | Tier | Reason |
|------|------|--------|
| `kanban/board.md` | PRESERVE | User kanban data — never overwrite |
| `kanban/config.json` | MERGE | Project ID settings — WORKSPACE-MANAGED marker |
| `scripts/kanban.ts` | LOCKED | Standard tooling — always latest |
| `.claude/commands/kanban.md` | LOCKED | Standard command |

On `kanban/config.json` location: belongs in `kanban/` not `.claude/`. Reason: config is contextually part of the kanban data layer; `.claude/` is Claude Code-specific settings directory. Format: `{"github_project_number": 1, "github_project_owner": "5throck"}`. The `kanban.ts` script reads this and passes `--project-id` to `gh project item-add`. MERGE tier allows `upgrade-project` to replace only the WORKSPACE-MANAGED sections (the project ID) without touching user data.

Question to DocsWriter: Should Kanban documentation go in `CONSTITUTION.md §10` (Terminology additions) or a new `§11 Kanban Process` section?

---

**AutomationEngineer**:

Adopts Auditor's `gh` CLI proxy recommendation. Direct GraphQL calls dropped. `gh project item-add --owner OWNER --number NUMBER --url ISSUE_URL` pattern matches existing `gh pr create` interface — consistent and no additional dependencies.

Agrees with Architect on `kanban/config.json` location. Implementation: config loading order in `scripts/kanban.ts`:
1. Load `kanban/config.json` if it exists
2. If absent, skip GitHub sync even when `--gh-sync` flag is present (print warning)
3. Local board operations work fully without config

This establishes an **offline-first** principle — Kanban works without GitHub connectivity.

Proposed `scripts/kanban.ts` interface:
```
bun scripts/kanban.ts add "task name" [--priority high|med|low] [--owner AGENT]
bun scripts/kanban.ts move CARD-ID <backlog|in-progress|review|done>
bun scripts/kanban.ts list [--lane in-progress] [--json]
bun scripts/kanban.ts sync   # gh project sync
bun scripts/kanban.ts init   # initialize board.md (called from new-project)
```

`CARD-ID` format: `CARD-YYYYMMDD-NNN` — date prefix makes collision probability effectively zero. Resolves Auditor's Gap 2 concern.

Question to DocsWriter: Should `.claude/commands/kanban.md` be written in English or Korean? Existing commands (/sync, /changelog) are in English — is this consistent with CONSTITUTION.md language policy?

---

**DocsWriter**:

Answers Architect's §10 vs. §11 question: **New §11 Kanban Process section is required**. §10 is Terminology (definitions); Kanban is Process (operational rules). Mixing them breaks the document's structure.

§11 must contain:
1. **Lane definitions**: Backlog / In Progress / Review / Done — entry/exit conditions for each lane
2. **Card format specification**: `CARD-YYYYMMDD-NNN` ID, required metadata (Priority, Owner, Created, Labels)
3. **Tool references**: `scripts/kanban.ts` and `.claude/commands/kanban.md`

Answers AutomationEngineer's language policy question: CONSTITUTION.md §2 states "all documentation files (markdown) in English" and "conversational interactions in Korean." `.claude/commands/kanban.md` is *tool documentation* — **must be in English**. Same pattern as `/sync` and `/changelog`. AI agents must be able to parse skill content consistently; English is required.

Open question passed to Auditor: When implementing `validate-templates.ts` Check 12 for Kanban file presence — should a missing `kanban/board.md` in a stable variant be an **error** (required) or **warning** (optional)? This requires a user decision before implementation.

---

## Action Items

| # | Owner | Deliverable | Priority |
|---|-------|-------------|----------|
| A-01 | AutomationEngineer | `scripts/kanban.ts`: bun-based kanban tool — add/move/list/sync/init commands, CARD-YYYYMMDD-NNN ID generation, `gh` CLI GitHub Projects sync, offline-first config loading | High |
| A-02 | AutomationEngineer | `new-project.sh` / `new-project.ps1`: add `kanban init` call to initialize empty `board.md` + `config.json` at project creation | High |
| A-03 | Architect + DocsWriter | `CONSTITUTION.md §11`: new Kanban Process section — lane definitions (Backlog/In Progress/Review/Done entry-exit conditions), card format spec (CARD-YYYYMMDD-NNN, required metadata), tool references, PRESERVE/LOCKED/MERGE classification | High |
| A-04 | Architect | `CONSTITUTION.md §10`: update file upgrade tier table to add `kanban/board.md` (PRESERVE), `kanban/config.json` (MERGE), `scripts/kanban.ts` (LOCKED), `.claude/commands/kanban.md` (LOCKED) | High |
| A-05 | DocsWriter | `.claude/commands/kanban.md` slash command (English), sync to `templates/common/.claude/commands/kanban.md`, add `validate-templates.ts` Check 12 for kanban file presence (error vs. warning level pending user decision) | Medium |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | `bun scripts/kanban.ts add "task" --priority high` adds card to Backlog in `kanban/board.md` | Run command and inspect board.md |
| C-02 | `bun scripts/kanban.ts move CARD-20260528-001 in-progress` moves card to In Progress section | Run and verify board.md section change |
| C-03 | `new-project.sh` generates project with empty `kanban/board.md` and `kanban/config.json` | Scaffold new project and verify files exist |
| C-04 | `upgrade-project.sh` does NOT overwrite existing `kanban/board.md` | Add board card, run upgrade, verify card survives |
| C-05 | `CONSTITUTION.md` has both §10 updated classification table and new §11 Kanban Process section | Manual review |

## Open Questions

| # | Question | Requires |
|---|----------|---------|
| Q-01 | Is `kanban/board.md` presence required (error) or optional (warning) for stable variants? | User decision before A-05 implementation |
