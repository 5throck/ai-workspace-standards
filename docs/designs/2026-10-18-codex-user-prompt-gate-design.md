# Codex UserPromptSubmit Gate — prompt-level identity gate for direct specialist invocation

- **Date**: 2026-10-18
- **Status**: Implemented
- **Spec ID**: 2026-10-18-codex-user-prompt-gate-design
- **Related**: `docs/designs/2026-10-17-pm-dispatch-gate-design.md` (predecessor wave — Claude/Gemini tool-level gate), AGENTS.md §3.1, `docs/governance/agents/pm-gateway-workflow.md` §3.1.3, `scripts/hooks/pm-role-bootstrap.ts` v1.1.0 (marker writer, reused unchanged), OpenAI Codex hooks documentation (https://developers.openai.com/codex/hooks)

## 1. Background

The 2026-10-17 wave declared the Codex leg of the PM dispatch gate "N/A — no dispatch tool surface exists; prompt-only by design" (predecessor §3). That premise is now stale: Codex ships a first-class hooks framework (`hooks.json` / inline `[hooks]` in `config.toml`, events `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Stop`, …, trust-review via `/hooks`). CODEX.md §1 still says "no `PreToolUse`/`PostToolUse` equivalents are wired", so the workspace under-uses a real enforcement surface.

Codex still has **no subagent dispatch tool** — the predecessor's `PreToolUse`-on-`Agent` shape has no Codex analog. But Codex sessions receive the raw user prompt at the `UserPromptSubmit` event, and the workspace's own "Command Intercept Rule" (CODEX.md §3) already treats a slash-style prompt (`/memlog`) as an explicit invocation. A user typing `/architect ...` (or any rostered specialist as a slash command) in Codex is the exact moral equivalent of the Claude `Agent(subagent_type: "architect")` call: a direct-dispatch attempt that bypasses PM.

## 2. Goal and Non-Goals

**Goal**: block explicit slash-style specialist invocations at the prompt boundary in Codex sessions that hold no fresh PM-role marker, and give Codex sessions the same marker chain (SessionStart bootstrap) the Claude/Gemini gates rely on.

**Non-Goals**:

- No gating of prose. "Ask docs-writer to fix the README" passes — only the leading `/` command form is the explicit-dispatch surface on Codex. Fuzzy intent classification is out (KISS, predecessor §2).
- No `PreToolUse` Codex wiring. There is no dispatch tool to match; the workspace's other Codex `PreToolUse` candidates (e.g. gating `apply_patch`) are unrelated to dispatch identity.
- No L2 variant wiring. Variants carry no `.codex/config.toml` today (the `codex-config` propagation domain is L0→L1 only, `l2_drift_eligible: false`), so hooks.json mirrors that exact shape: L0 + L1, not variants.
- No changes to `pm-role-bootstrap.ts` — its stdin contract (`hook_event_name`, `session_id`) is a subset of the Codex SessionStart payload (common input fields: `session_id`, `cwd`, `hook_event_name`, `model`, `permission_mode`, `turn_id`, `source`-equivalent start values `startup|resume|clear|compact|fork`), so it is reused verbatim.

## 3. Surface Evidence (Codex hooks, resolved from official docs 2026-10)

| Fact | Value | Consequence |
|---|---|---|
| Event payload | common fields + `prompt` (the user prompt about to be sent) | gate reads `prompt` + `session_id` |
| Matcher | **not supported** for `UserPromptSubmit` | hooks.json omits `matcher` entirely |
| Block shape | `{"decision": "block", "reason": "..."}` on stdout (exit 0), or exit 2 + stderr | gate uses the JSON shape, exit 0 always |
| Inject shape | `{"hookSpecificOutput": {"hookEventName": ..., "additionalContext": ...}}` | pm-role-bootstrap's output is already valid Codex SessionStart output |
| Trust model | non-managed hooks are hash-pinned and **skipped until trusted** per `.codex/` layer; `/hooks` reviews; `--dangerously-bypass-hook-trust` bypasses per-invocation | untrusted → gate silently absent → CODEX.md prompt-enforcement stays the documented fallback |
| Config location | `<repo>/.codex/hooks.json` loads only when the project layer is trusted | L0 hooks.json + L1 mirror; no variant wiring |
| Timeout default | 600 s if omitted | set explicit `timeout: 10` (matches Claude settings.json convention) |

## 4. Design

### 4.1 New hook: `scripts/hooks/codex-user-prompt-gate.ts` @1.0.0 (L0+L1 verbatim mirror)

1. Read stdin JSON; unparseable → exit 0 silently (fail-open, predecessor §4.2 contract).
2. Extract `prompt` (string) and `session_id` (string | absent).
3. Roster: `agents/*.md` minus `pm.md`, loaded live from the workspace root (same as pm-dispatch-gate; roster evolution is free).
4. Match: trimmed prompt's leading token `/^\/([a-z0-9][a-z0-9_-]*)/i` — if the captured name is on the roster, this is a direct-dispatch attempt. Non-slash prompts and unknown names exit 0 silently.
5. Marker check: identical to pm-dispatch-gate (`PM_GATE_STATE_DIR` override else `<os.tmpdir()>/ai-workspace-pm-gateway/<sanitized session_id>.json`, `{ts}` fresh within 24 h; unreadable state → fail-open). Sessions without `session_id` are never marker-exempt.
6. Block: write `{"decision":"block","reason":"[PM-GATE] ..."}` to stdout, exit 0. The reason states the rule (AGENTS.md §3.1), the observed invocation, and the two recovery paths (route through PM, or boot the session into the PM role via pm-role-bootstrap / CODEX.md session bootstrap).
7. Marker helpers are deliberately duplicated from pm-dispatch-gate (both are standalone hook executables; predecessor established the "mirrors pm-role-bootstrap v1.1.0" pattern — no shared import because importing a script with `main()` would execute it).

### 4.2 Wiring: `.codex/hooks.json` (new, L0) + `templates/common/.codex/hooks.json` (L1 mirror, byte-identical)

```json
{
  "description": "PM Gateway identity gates (AGENTS.md §3.1) — Codex lifecycle wiring (spec 2026-10-18-codex-user-prompt-gate-design).",
  "hooks": {
    "SessionStart": [
      { "hooks": [ { "type": "command",
        "command": "bun \"$(git rev-parse --show-toplevel)/scripts/hooks/pm-role-bootstrap.ts\"",
        "timeout": 10, "statusMessage": "Loading PM bootstrap..." } ] }
    ],
    "UserPromptSubmit": [
      { "hooks": [ { "type": "command",
        "command": "bun \"$(git rev-parse --show-toplevel)/scripts/hooks/codex-user-prompt-gate.ts\"",
        "timeout": 10, "statusMessage": "Checking PM dispatch policy..." } ] }
    ]
  }
}
```

- `$(git rev-parse --show-toplevel)` is the docs' own command pattern — sessions launched at the workspace root (the governed surface) resolve the root regardless of session cwd.
- SessionStart matcher omitted → fires on every start source (`startup|resume|clear|compact|fork`), matching pm-role-bootstrap's "all sources" contract.

### 4.3 Propagation: `scripts/propagation-map.json` `codex-config` domain

`include_pattern` widens `config.toml` → `{config.toml,hooks.json}` (L0 `.codex/` → L1 `templates/common/.codex/`, still flat, still `l2_drift_eligible: false`). Description and note updated. The L1 copy of propagation-map.json is kept byte-identical (existing in-sync check).

### 4.4 Documentation: CODEX.md §1 (root + L1 mirror)

- Hook status table: Codex rows move from "❌ Not fired" to reflect the wired pair — PM dispatch gate: ✅ Hook (UserPromptSubmit, project root, trust required); Post-write/QA/gitleaks rows stay ❌ (unchanged — out of scope).
- New "Codex hook trust-gating" block: hooks load only when the `.codex/` layer is trusted (`/hooks` review; hash-pinned — edits re-trigger review; skipped-until-trusted is the safe default), plus the residual-risk statement (subdirectory/Projects/* sessions, desktop surfaces, bypass flag) and the standing manual fallback (`bun scripts/hooks/post-write-lifecycle-check.ts`, `bun scripts/audit.ts`).
- §1's "no native subagent tool" note stays; the enforcement story becomes "prompt-enforced + prompt-boundary hook", not "prompt-enforced only".

## 5. Enforcement matrix after deployment

| Surface | Pre | Post |
|---|---|---|
| Codex CLI (workspace root, hooks trusted) | prompt-only | SessionStart marker + UserPromptSubmit block on rostered slash invocations |
| Codex CLI (hooks untrusted / untrusted project) | prompt-only | unchanged — prompt-enforced fallback documented in CODEX.md |
| Codex Desktop App / IDE extension | prompt-only | same hooks.json applies where project trust is granted; otherwise prompt-only |
| Claude / Gemini | tool-level gate (predecessor) | unchanged |

## 6. Tests

`tests/unit/codex-user-prompt-gate.test.ts` (subprocess over stdin, temp `PM_GATE_STATE_DIR`, mirroring pm-dispatch-gate.test.ts):

- Non-slash prompt mentioning a specialist by name → silent allow (scope guard).
- Slash prompt for a non-rostered name (`/sync`, `/definitely-not-rostered`) → silent allow.
- Rostered slash prompt, no marker → `{"decision":"block"}` with a PM Gateway reason.
- Rostered slash prompt with fresh marker → silent allow; stale (25 h) marker → block again.
- Malformed stdin → exit 0, silent; absent `session_id` → never exempt.
- Chain: pm-role-bootstrap SessionStart (Codex-shaped payload with `permission_mode`/`model` extras) writes the marker, then the gate allows.

Run scoped: `bun test tests/unit/codex-user-prompt-gate.test.ts` (never bare `bun test` at the workspace root).

## 7. Registry and pins

- `scripts/SCRIPTS.md`: new row `hooks/codex-user-prompt-gate.ts` L0 1.0.0 active, delivery L0+L1.
- `tests/unit/generate-scripts-mirror.test.ts` rowKeys pin 156 → 157 (+1 `hooks/codex-user-prompt-gate.ts` delivered to L0+L1), comment updated per the pin's own changelog convention.
- CHANGELOG entry under `[2026-10-18]`.

## 8. Deliberately out of scope

- Variant (L2) `.codex/` wiring — no variant carries a Codex config layer today; revisit if ADR-0077's downstream seed policy changes.
- `PermissionRequest`/`PreToolUse` Codex events — no dispatch-identity surface.
- Claude/Gemini gate changes — predecessor spec remains authoritative.
