# co-workspace Turn Latency Research — 2026-09-30
**Date**: 2026-09-30
**Scope**: `services/co-workspace` (ticket T-20260929-003: "thinking model + uncached team-context prefill, about 16-26 s per turn")
**Method**: architect agent (read-only code and config analysis plus a no-provider container cold-start measurement); the PM re-measured the cold start and re-checked the SSE claims in code.
> Analysis only — no files modified in this report. No real provider key was available: every model-side number below is an estimate.

## Bottom line

Process and container startup is not the problem. The fixed cost per turn is well under 1 s. Almost all of the 16-26 s is model time (a mandatory thinking phase, prefill of the team context, and a session history that grows every turn), and no stage has timing instrumentation today. Measure first (section 4), then fix the model-side costs. A warm per-tenant runtime would save at most about 1.5 s of about 20 s and weakens isolation, so it comes last.

## 1. Where the time goes

| Stage | Per turn? | Cost | Basis |
|---|---|---|---|
| Gateway work before the runtime (registry lookup, quota checks, chat lock, `config.yaml` re-stamp) | yes | under 10 ms | estimate; `src/responses.ts`, `src/chat.ts`, `src/tenant.ts` |
| Container create + start + remove (docker mode) | yes | about 0.17 s warm, 0.24 s first | **measured** (architect and PM, Docker 29.8.1, `co-workspace-runtime:latest`, direct socket) |
| Hermes CLI start inside the container (`--version`) | yes | about 0.42 s total per turn | **measured** (0.421-0.426 s, five runs) |
| Hermes `chat` startup (session store, skill discovery, toolsets, provider client) | yes | 0.5-1.5 s | estimate |
| Socket proxy hop and bind mounts | yes | probably 10-50 ms each | estimate |
| Prefill of team context (`AGENTS.md`, `HERMES.md`, system prompt, tool schemas) | yes, per model round-trip | about 13k-20k tokens; 3-7 s | estimate |
| Thinking plus answer (`glm-5.3-flash`, reasoning effort `low`) | yes | 8-15 s | estimate, unverified split |
| Session history replay (`--continue gw-<tenantId>`) | yes, grows linearly | grows with each turn | estimate |

Measured context sizes (tokens = bytes / 3.5): `templates/co-work` `AGENTS.md` 25,361 B (about 7.2k tokens) and `HERMES.md` 10,084 B (about 2.9k); `templates/co-abap` `AGENTS.md` 31,537 B (about 9.0k) and `HERMES.md` 10,084 B; skills 8,269 B (co-work, 4 files) and 91,140 B (co-abap, 13 files; about 26k tokens only if loaded eagerly, roughly 1k tokens if only an index is injected). Which files Hermes actually injects is Hermes behaviour and is not visible in this repository.

The spread between 16 s and 26 s probably comes from tool round-trips inside one user turn (`--max-turns`): each round-trip repeats the prefill and a thinking pass.

**First token versus total.** Nothing in the gateway delays the first token: `runHermesTurn` forwards each stdout line immediately and the SSE sink enqueues directly. The gap is on the wire: the OpenAI (`src/responses.ts:117`), Anthropic (`:166`) and Gemini (`:215`) builders forward only `text` events, so reasoning and tool events are dropped, and `startHeartbeat` runs only on the Gemini path (`:212`). On the OpenAI path a client sees nothing for the whole thinking phase.

## 2. Mitigations

| Component | Mitigation | Expected saving | Risk | Effort | Needs a real key to validate |
|---|---|---|---|---|---|
| Perceived latency | Send a `: thinking` comment frame right after `runChat` starts, add heartbeats to the native and OpenAI paths, map reasoning/tool events to comment frames | 0 s real, large perceived gain | none (comments are valid SSE) | XS | no |
| Team context prefill | Trim `AGENTS.md`/`HERMES.md` for runtime tenants, keep skills as a lazy index, avoid loading two overlapping root files | about 1-4 s (30-60% of prefill) | agent quality | S-M | yes |
| Provider prefix caching | Keep the prompt prefix byte-identical (system prompt, context files, tool schemas, then history); check the `cached_tokens` usage field. The gateway's `config.yaml` re-stamp is deterministic and the project path is stable per tenant, so the gateway does not break the prefix; the risk is a date, cwd or session id early in the Hermes prompt | 2-5 s per turn after the first | low | S to verify | yes |
| History growth | Cap or compact history if Hermes has a setting | grows with session length | loses context | S-M | yes |
| Thinking model / effort | `low` is the floor (the model returns 400 without an effort). Evaluate a non-thinking or faster model per variant via `CO_WORKSPACE_HERMES_MODEL` | possibly 50% or more | quality | S (config) | yes |
| Tool round-trips | Narrower `-t` toolsets per variant, lower `--max-turns` for chat | about 5 s per avoided round-trip | capability | S | yes |
| Container per turn | Warm per-tenant runtime with an idle reaper | 0.4-1.5 s | loses "nothing survives a turn"; needs memory budget and idle timeout | M-L | no |

## 3. Plan

- **Quick wins (under 1 day):** add the instrumentation below; the UX frames and heartbeats; with a real key read `cached_tokens` and dump one request body to look for dynamic fields in the prefix; try a smaller toolset and lower `--max-turns` for chat tenants.
- **Medium (days):** trim runtime context per variant (co-abap first); fix any prefix instability in Hermes; configure history compaction; evaluate a model tier per variant.
- **Only if the data supports it:** a warm per-tenant runtime.
- **Do not:** drop `--cap-drop ALL`, `--user 10000:10000`, `no-new-privileges`, the resource caps or the socket proxy for startup speed; share one runtime across tenants; remove the per-tenant chat lock (`state.db` WAL safety); skip the config re-stamp (it is how config changes reach existing tenants).

## 4. Measurement plan (operator, with a real key)

Log one structured line per stage keyed by the turn container name (proposal only, not implemented):
- `src/chat.ts`: `t0` (entry), `t_lock` (after the queue wait), `t_stamp` (after `writeTenantConfig`).
- `src/hermes.ts` `runHermesTurn`: `t_spawn` (before and after `Bun.spawn`), `t_first_byte`, `t_system` (Hermes ready), `t_first_reasoning`, `t_first_tool`, `t_first_text` (time to first token), `t_result`, `t_exit`, and `tokens` including any `cached`/`cache_read` field.
- `src/responses.ts`: `t_first_sse_frame`.
- Derived: start = `t_system - t_spawn`; prefill plus thinking = `t_first_text - t_system`; generation = `t_result - t_first_text`.
- Run five consecutive turns on one tenant (growth trend and cache hits), in process and docker mode, for co-work and co-abap.

## Measured versus estimated

Measured: container and Hermes cold start (raw values above), context and skill file sizes, and the code paths cited. Estimated: all token counts, Hermes `chat` startup, proxy overhead, the model-time split, history growth and caching savings.

## Action wiring

Follow-up tickets are recorded in `tickets/governance/` (see the CHANGELOG entry of this report): the UX quick win, and the instrumentation plus real-key measurement run.
