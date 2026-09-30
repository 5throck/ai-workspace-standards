# co-workspace Perceived-Latency UX + Turn Timing — Design

- **Date**: 2026-09-30
- **Status**: implemented
- **Spec id**: `2026-09-30-coworkspace-latency-ux-design`
- **Owner**: automation-engineer (dispatched for T-20260930-010 / T-20260930-011)
- **Related**: `docs/reports/2026-09-30-co-workspace-turn-latency-research.md` (§2 quick win, §4 measurement plan), tickets T-20260930-010 / T-20260930-011, ADR-0092

## R1 — Problem

The research report measured gateway-side fixed cost under 1 s per turn and located
the 16–26 s in model time. Two gateway gaps make it worse for the client:

1. The OpenAI (`responses.ts`), Anthropic, and Gemini SSE builders forward only
   `text` events, so a client sees nothing for the whole thinking phase; only the
   Gemini path had a heartbeat.
2. No stage has timing instrumentation, so the §4 operator measurement cannot run.

## R2 — Decision

1. **Perceived-latency quick win (T-20260930-010, XS):** every streaming builder
   (native, OpenAI, Anthropic, Gemini) emits an immediate `: thinking…` SSE
   comment frame right before the turn starts, registers `startHeartbeat`
   (15 s `: ping`), and maps progress-worthy Hermes events to comment frames via
   `turnProgressComment` (`tool_use` → `: tool: <name>…`, `tool_result` →
   `: tool: <name> done (<ms>ms)`, `system` init → `: turn: runtime ready`).
   Comments are wire-legal SSE that protocol clients ignore. The native surface
   keeps forwarding every raw event; it gains the comment frame and heartbeat only.
2. **Per-stage timing logs (T-20260930-011):** a dependency-free `TurnTiming`
   (`src/timing.ts`) emits one structured `[turn-timing]` JSON line per stage with
   `ms_total` / `ms_stage`. Stages: chat.ts `t0` / `t_lock` / `t_stamp` /
   `turn_done` (token + provider cache fields); hermes.ts `t_spawn` /
   `t_first_byte` / `t_system` / `t_first_tool` / `t_first_text` / `t_result` /
   `t_exit` / `turn_summary` (derived stage split inputs); responses.ts
   `t_first_sse_frame` per surface. `turnLogKey(tenantId)` is the deterministic
   join key (`co-workspace-turn-<sanitized tenantId>`); `turnContainerName` stays
   unique per call because it names a container, not a log key. chat.ts passes its
   timer into `runHermesTurn` (`timing?: TurnTiming` option) so all stages share
   one timeline; direct callers get a local timer. `CO_WORKSPACE_TURN_TIMING=0`
   silences the logs (default on; one line per stage — negligible volume).

## R3 — Rejected Alternatives

| Alternative | Reason for rejection |
|---|---|
| Forward reasoning/tool events as protocol data frames | Would break wire contracts of the OpenAI/Anthropic/Gemini surfaces; comments achieve visibility with zero contract change. |
| Real `cached_tokens` in stream chunks | Usage is not part of chat-completions stream chunks in this gateway's contract; cache fields surface in the `turn_done` / `turn_summary` log lines instead. |
| Gate timing logs behind a new config flag plumbed through loadConfig | Env-var check inside `TurnTiming` keeps the surface at zero config; compose / .env.sample still document it (env-parity test enforces). |

## R4 — Verification

- `bun test tests/unit/co-workspace-latency-ux.test.ts` — new: comment mapping unit
  cases; OpenAI stream opens with `: thinking…`, carries runtime-ready + tool
  comments, role-before-content ordering, `[DONE]` termination; one shared turn key
  across chat + hermes stages; full stage set present; `cached_tokens` survives
  into `turn_done`.
- Full `bun test tests/unit/co-workspace-*.test.ts` — 243 pass / 0 fail. Four
  pre-existing tests were updated: three SSE parsers now skip comment frames
  (SSE-spec client behavior), two turn tests drain the streaming body instead of
  relying on the old first-byte flush timing.
- Env parity: `CO_WORKSPACE_TURN_TIMING` added to `docker/docker-compose.yml` and
  `docker/.env.sample`.

## R5 — Out of Scope

- The real-provider operator measurement (§4 of the research report) — needs a real
  key; tracked under T-20260930-009 (operator verification).
- Model-side cost reductions (context trim, prefix caching checks, history
  compaction) — research §2 medium items, separate tickets if pursued.
