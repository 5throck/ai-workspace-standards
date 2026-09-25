# MCP Governance Server Design — Harness-Neutral Access to Workspace Governance Tools

- **Date**: 2026-09-25
- **Status**: Approved (Row 0 design; implementation lands in the same PR per T-20260925-009)
- **Related**: ADR-0088 (Hermes Agent platform support — origin ticket), ADR-0074 (Universal Design Gate), ADR-0080 (PM team-management authority), AGENTS.md §3.1 (PM Gateway), AGENTS.md §3.7.5 (governance backlog)
- **Scope**: Design + implementation of `scripts/mcp-governance-server.ts` (stdio MCP server exposing four governance scripts) with unit tests and registry updates. No change to any governance rule itself.

---

## 1. Background

The PM Gateway's enforcement layers (AGENTS.md §3.1.3) are harness-specific: the tool-level gate lives in Claude Code's `.claude/settings.json` (hooks), and prompt-level enforcement rides CLAUDE.md/GEMINI.md/CODEX.md twins. ADR-0088 added Hermes Agent as a supported surface; Hermes has no hook system, so its enforcement is advisory (AGENTS.md prose) plus the commit-time gates (`audit.ts`, the `/sync` pipeline) — which ARE harness-agnostic but only fire at commit time. Ticket T-20260925-009 asked for the missing middle layer: expose the governance scripts themselves as **MCP tools**, so any MCP-capable harness (Hermes via `hermes mcp add`, and any other client) can invoke them directly — read gates on demand, and the two sanctioned write paths without shell access.

## 2. Goals / Non-Goals

**Goals**

- G1: A single stdio MCP server (`scripts/mcp-governance-server.ts`) exposing four governance tools: `ticket`, `audit`, `spec_register`, `qa_gate`.
- G2: Zero new npm dependencies — the MCP stdio transport is newline-delimited JSON-RPC 2.0, implementable in one bun script.
- G3: Safety by construction: `execFileSync` with an argv array (no shell interpolation), subcommand/flag allowlists, workspace-confined path arguments, per-call timeout, output tails capped.

**Non-Goals**

- N1: No remote transports (SSE/HTTP) — stdio only; the server runs where the workspace lives.
- N2: No automatic registration into any harness — each harness gets one documented config line (e.g. `hermes mcp add`); registration is the user's onboarding step, mirroring ADR-0088 D7's philosophy.
- N3: No new governance RULES — the server makes existing gates callable; it does not make them mandatory for harnesses that never call them (commit-time gates remain the hard layer; this is stated honestly in §7).
- N4: No PM-bypass — the tools execute the same scripts the PM Gateway dispatches; they confer no authority to skip Design Gate or specialist dispatch.

## 3. Tool Surface

| Tool | Wraps | Arguments (allowlisted) | Write? |
|---|---|---|---|
| `ticket` | `scripts/ticket.ts` | `action`: `list\|board\|doctor` (read); `move` (write) with `id`, `status` ∈ {backlog, waiting, running, review, done, failed}, optional `result` | move only |
| `audit` | `scripts/audit.ts` | optional flag ∈ {`--spec-check`, `--lifecycle-only`} (read-only gate) | no |
| `spec_register` | `scripts/spec-register.ts` | `file` (must resolve inside `docs/designs/`), `source`, optional `status`, `update`/`id`, `--list` (read) | register/update |
| `qa_gate` | `scripts/qa-gate.ts` | none | no |

Response envelope (every tool): `{ command, exitCode, stdout (tail ≤ 8000 chars), stderr (tail ≤ 4000 chars) }` as the MCP text content; `isError: true` when exitCode ≠ 0 or spawn fails. Timeout 120 s per call.

## 4. Design Decisions

- **D1 — stdio JSON-RPC 2.0, hand-rolled.** MCP stdio transport is newline-delimited JSON-RPC; the needed surface is `initialize`, `notifications/initialized`, `tools/list`, `tools/call`, `ping`, plus standard errors (-32700/-32601/-32602). A dependency-free implementation keeps the workspace's bun-only script policy intact and the audit surface small. Protocol-version negotiation echoes the client's requested version (falling back to `2024-11-05`).
- **D2 — argv allowlists, no shell.** Every tool call spawns `bun scripts/<script> …` via `execFileSync` with a constructed argv array. `ticket move` statuses and `audit` flags are enum-checked; `spec_register --file` must resolve inside the workspace's `docs/designs/`.
- **D3 — Layer L0, workspace-root only.** The governed scripts (`ticket.ts` L0-only, `audit.ts`, `spec-register.ts`, `qa-gate.ts`) are workspace governance surfaces (AGENTS.md §3.7.5); the server is classified L0 in SCRIPTS.md and is not shipped to scaffolded projects.
- **D4 — Registration is documented, not automated.** Hermes (syntax verified live, v0.21.4): `hermes mcp add governance --command bun --args <workspace>/scripts/mcp-governance-server.ts` then answer `y` at the tool-enable prompt. Any other MCP client: one stdio-server config entry with the same command. `~/.hermes` state stays user-owned (ADR-0088 D7 posture).
- **D5 — Enforcement honesty.** The README/AGENTS-facing text says what this is: harness-neutral *access* to the gates, not a new enforcement layer. A harness that never calls the tools gains nothing and loses nothing; the commit-time gates are unchanged.

## 5. Platform Impact

| Surface | Impact |
|---|---|
| Claude Code | None required; optionally callable via a `.mcp.json` entry (user-added) |
| Gemini CLI / Codex / Antigravity | None required; same optional stdio registration |
| Hermes Agent | First-class consumer: `hermes mcp add governance --command bun --args <workspace>/scripts/mcp-governance-server.ts` restores on-demand gate access that hook-based harnesses get from `.claude/settings.json` |

## 6. Verification Plan

1. `bun test tests/unit/mcp-governance-server.test.ts` — subprocess handshake: initialize → tools/list (4 tools advertised) → `tools/call` on a read tool (`ticket list`), JSON envelope asserted; unknown method → -32601; `ticket move` with a disallowed status → -32602.
2. `bun scripts/audit.ts` / `qa-gate.ts` green (no governance drift).
3. Live smoke: **done 2026-09-25** — registered via `hermes mcp add governance --command bun --args …` (4/4 tools enabled in `~/.hermes/config.yaml`); `hermes mcp test governance` connects and lists ticket/audit/spec_register/qa_gate.

## 7. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Server becomes a bypass around PM dispatch | Tools execute the same gated scripts; no tool mutates governance docs directly; D5 statement in docs |
| Protocol drift against MCP spec revisions | Handshake echoes the client's requested version; surface kept to the stable 2024-11-05 core |
| Output flooding from audit runs | Tails capped (8k/4k chars); timeout 120 s |
| Script misuse from a non-workspace cwd | CWD guard: server resolves scripts relative to its own `import.meta.dir/..` and refuses to serve if the layout is absent |

## 8. Accessibility & Preview Verification Statements

- **Accessibility (ADR-0065)**: exempt — developer-tooling infrastructure (a protocol server); no user-facing UI.
- **Preview Verification (ADR-0070)**: exempt — no rendered UI artifact; verification is subprocess-test-based (§6).

## 9. References

- T-20260925-009 (origin ticket), ADR-0088 (Hermes platform support — `hermes mcp add` interface verified live v0.21.4)
- AGENTS.md §3.1 (PM Gateway), §3.7.5 (governance backlog); MCP stdio transport spec (2024-11-05 core)
- `scripts/ticket.ts`, `scripts/audit.ts`, `scripts/spec-register.ts`, `scripts/qa-gate.ts`
