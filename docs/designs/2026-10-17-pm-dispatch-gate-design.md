# PM Dispatch Gate — tool-level identity gate for non-PM specialist dispatch

- **Date**: 2026-10-17
- **Status**: Implemented
- **Spec ID**: 2026-10-17-pm-dispatch-gate-design
- **Related**: AGENTS.md §3.1 (PM Gateway Policy), `docs/governance/agents/pm-gateway-workflow.md` §3.1.3 (enforcement levels), `scripts/hooks/agent-model-gate.ts` (precedent for ask-mode hooks), `scripts/hooks/pm-role-bootstrap.ts` (session-boot PM injection), superseded-in-scope `templates/co-safety/scripts/co-safety/check-pm-approval.ts` (`@status deprecated`)

## 1. Background

AGENTS.md §3.1 mandates that all specialist dispatch (`pm.md`, `architect.md`, `auditor.md`, `automation-engineer.md`, `docs-writer.md`, `lifecycle-manager.md`, `security-expert.md`, `scaffolding-expert.md`, `skill-graph-analyst.md` — the `agents/*.md` roster minus `pm.md`) go through the PM. §3.1.3 of the PM Gateway workflow declares a four-level enforcement model whose **Level 1 ("Tool-Level: hard enforcement") has never been implemented**: the only `PreToolUse` hook matching `Agent` (`.claude/settings.json:45` → `scripts/hooks/agent-model-gate.ts`) checks model tier only, not dispatcher identity. A session that never adopted the PM role could dispatch specialists directly with nothing more than a prompt-layer assumption (`pm-role-bootstrap.ts` injects "You are the PM" text at SessionStart, but nothing records or verifies session state afterwards, and the injection is not inherited by subagents).

A prior attempt (`templates/co-safety/scripts/co-safety/check-pm-approval.ts`) is deprecated: it gated **all** Write/Edit tool calls through a physical approval-flag protocol, was heavier than the sliding gate it protected, and did not fire on Claude Code Desktop App / Antigravity surfaces ("Physical PreToolUse hooks do not fire", `check-pm-approval.ts:19-23`).

## 2. Goal and Non-Goals

**Goal**: mechanically detect a non-PM session dispatching a rostered specialist and surface an enforcement prompt at the tool boundary — on every surface where a hook protocol actually exists.

**Non-Goals**:

- No gating of Write/Edit/Bash (that was the deprecated check-pm-approval scope; post-write checks remain the existing `post-write-lifecycle-check.ts` hooks).
- No gating of non-specialist dispatch types (`explore`, `plan`, `oracle`, `librarian`, category dispatch, etc.) — only rostered specialists.
- No involvement in mid-session dispatch permission negotiation; only the dispatch moment.

## 3. Tool-Surface Evidence (resolved from workspace docs, no external search needed)

| Surface | Specialist-dispatch tool | Hooks fire | Gate wiring |
|---|---|---|---|
| Claude Code CLI | `Agent` | Yes | `PreToolUse` matcher `"Agent"` |
| Claude Code Desktop App | `Agent` | Intermittent per workspace testing (GEMINI.md "Platform Hook Support") | Same hook; leftover ambiguity is documented residual risk |
| Gemini CLI | `invoke_subagent` | Yes (`BeforeTool`) | `BeforeTool` matcher `invoke_subagent` |
| Antigravity (IDE / CLI) | `invoke_subagent` | No (agent self-enforces, GEMINI.md:44-45) | Prompt-only — CONSTITUTION §11 |
| Codex (CLI / IDE) | **None** — specialist "dispatch" is in-session role-context execution (CODEX.md:21,144) | No | N/A — no dispatch tool surface exists; prompt-only by design |
| Other platforms (e.g. OpenCode) | Platform-specific | No | Prompt-only (documented residual risk) |

## 4. Design

### 4.1 Session-state marker (writer side)

`scripts/hooks/pm-role-bootstrap.ts` (bumped 1.0.1 → 1.1.0) gains one behaviour, entirely inside its existing fail-open error handling: on every successful SessionStart invocation it writes a marker file proving "this session bootstrapped into the PM role".

- State dir: `PM_GATE_STATE_DIR` env override, else `join(os.tmpdir(), 'ai-workspace-pm-gateway')` (outside the repo — no gitignore entry, no encoding/SSOT risk).
- File name: sanitized `session_id` from the hook's stdin JSON (`/[^A-Za-z0-9_-]/g → '_'`). Sessions without a `session_id` in the payload write nothing — an unmarkable platform simply stays in ask-mode on the gate.
- Content: `{ "ts": <epoch ms>, "source": "pm-role-bootstrap" }`. Freshness TTL: 24 h (checked on read; stale markers count as absent).
- The writer never rejects a session on state-write failure (fail-open, matching the script's contract).

### 4.2 Identity gate (enforcement side)

New `scripts/hooks/pm-dispatch-gate.ts`, registered per-platform:

1. Accept hook stdin JSON; anything unparseable → exit 0 (fail-open).
2. `tool_name` must be `Agent` (Claude) or `invoke_subagent` (Gemini); otherwise exit 0.
3. Extract the dispatched specialist: `subagent_type` (Claude `Agent`) / `subagent_name` (Gemini `invoke_subagent`).
4. Only act when the value matches the rostered specialist set (`agents/*.md` filenames minus `pm.md`, loaded from disk at call time so roster evolution is free). Unknown types pass with exit 0.
5. Look up the marker (`<state_dir>/<session_id>.json`): **present + fresh → allow silently** (exit 0, no stdout).
6. **Absent → programmatic enforcement** (two shapes, matching `gateguard-fact-force.ts:261-268` precedent):
   - Claude: `{decision:'ask', reason: PM Gateway message}` on stdout, exit 0 — routes through the permission prompt.
   - Gemini: `{decision:'deny', reason: PM Gateway message}` on stdout, exit 0 — Gemini BeforeTool has no ask-verb; deny returns the reason to the agent as feedback, per the established gemini-branch precedent.
7. State-dir un-readable → fail-open (warn stderr, allow).

Reason message states the rule (AGENTS.md §3.1), the observed dispatch, and the two clean recovery paths: switch the session into the PM role (run `pm.md` bootstrap) or re-issue the dispatch through the PM.

### 4.3 Platform registration

- `.claude/settings.json` — new `PreToolUse` entry, matcher `"Agent"`, command `bun scripts/hooks/pm-dispatch-gate.ts` (co-runs with the existing agent-model-gate; disjoint concerns: model tier vs. dispatcher identity).
- `.gemini/settings.json` — new `BeforeTool` entry, matcher `invoke_subagent`, same command. `hooks.PreToolUse` stays Claude-only per `scripts/helpers/validate-platform-parity.ts:111-119`; BeforeTool is the sanctioned Gemini-side event.

### 4.4 Why not reuse check-pm-approval

It gated every Write/Edit regardless of dispatch relevance, required a physical approval flag, and its own deprecated header records the surface problems. This gate is dispatch-scoped, reads roster + marker only, and fails open — the narrowest mechanism that makes Level 1 real.

## 5. Enforcement matrix after deployment

| Enforcement level | Pre-gate | Post-gate |
|---|---|---|
| L1 tool-level | Unimplemented | Claude Code (Agent) + Gemini CLI (invoke_subagent), active; Desktop App intermittent; Antigravity/Codex/others prompt-only by surface reality |
| L2-L4 (audit, prompt, checklist) | Already in place | Unchanged |

## 6. Tests

`tests/unit/pm-dispatch-gate.test.ts` (executes both scripts through `Bun.spawnSync` with a temp `PM_GATE_STATE_DIR`):

- Non-matching `tool_name` → silent allow (no stdout).
- Unknown `subagent_type` → silent allow.
- Rostered specialist, no marker → Claude path returns `decision: ask` with a PM Gateway reason; Gemini path (tool converted to `invoke_subagent`) returns `decision: deny` with the same reason (protocol parity with gateguard).
- Rostered specialist, fresh marker present → silent allow.
- Malformed stdin JSON → exit 0, silent allow.
- `pm-role-bootstrap.ts` with a `session_id` payload → marker file created in the overridden state dir; gate then allows on that marker.

Run scoped: `bun test tests/unit/pm-dispatch-gate.test.ts` (workspace README scopes root tests away from `Projects/*/` — never run bare `bun test` at the workspace root).

## 7. L1–L3 propagation (template layer)

Follow-up to §4-§6: the L0-only wiring is mirrored into the template fleet so the gate applies through the standard project flows.

### 7.1 Changes

1. **L1 hook-script mirrors**: `templates/common/scripts/hooks/pm-dispatch-gate.ts` (verbatim copy of L0 v1.0.0) and `templates/common/scripts/hooks/pm-role-bootstrap.ts` (synced 1.0.1 → 1.1.0 so the marker-write behaviour lands in every variant). No manual delivery-claim registration is needed: files under `scripts/` fall under the TEMPLATE TREE SYNC default claim (`scripts/lib/upgrade-policy.ts:409` — `underDir(rel, 'scripts')` → `{ policy: 'SYNC', pass: 'SYNC_IF_NEWER: scripts/' }`).
2. **Template settings wiring**: `templates/common/.claude/settings.json` gains the same `PreToolUse` / matcher `Agent` group as L0 (`bun scripts/hooks/pm-dispatch-gate.ts`, timeout 10, statusMessage "Checking PM dispatch policy..."); `templates/common/.gemini/settings.json` gains the same `BeforeTool` / matcher `invoke_subagent` group as L0 (timeout 5000). JSON files host no marker zones, so variant settings are synced structurally, not by text.
3. **`sync-variant-settings.ts` 1.0.0 → 1.1.0**: `MANAGED_SUBSTRINGS` gains `pm-dispatch-gate`; the managed-entry sync generalizes from SessionStart/`.claude`-only to all managed entries across events `{claude: SessionStart, PreToolUse}` and `{gemini: SessionStart, BeforeTool}` over all 13 variant settings files. Gemini `SessionStart` legitimately mixes flat hook entries and group objects (identical to L0 — not drift); managed entries are group-wrapped, and flat non-managed entries are preserved byte-for-value. `--check` remains the audit gate (exit 1 on drift); the do-nothing contract of v1.0.0 tests carries over via the retained `syncManagedSessionStart` export.

### 7.2 Flow application matrix

| Flow | Mechanism by which the gate applies | Evidence gate |
|---|---|---|
| new-project | scaffold copies `templates/` wholesale — hooks + settings entries arrive at creation | scaffold-parity facts in `scripts/lib/upgrade-policy.ts` |
| upgrade-project | TEMPLATE TREE SYNC delivers `scripts/hooks/*` (`SYNC_IF_NEWER: scripts/`); settings deliveries carry the gate entries | `bun scripts/check-upgrade-coverage.ts` (strict) |
| project-to-variant | re-homing consumes an existing project; gate scripts/settings ride the project's next upgrade | upgrade coverage, unchanged pipelines |
| promote-variant (L3→L2) | pipeline's core-script integrity concerns `dev-sync.ts`/`audit.ts` only — the gate is a hook, not a core script | `validate-variant-readiness` |

### 7.3 Deliberately out of scope

`agent-model-gate` (L0 PreToolUse `Agent`) is NOT propagated — it is workspace-root dispatch-tier governance, outside this propagation request. The gemini `.claude/commands → templates/common` zero-propagation line (Check G) is a separate, already-passing channel.
