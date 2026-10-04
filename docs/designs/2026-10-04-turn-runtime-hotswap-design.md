# Design: Turn-Runtime Hot-Swap (Runtime-Neutral Config, No-Restart Switching)

- **Spec id**: `2026-10-04-turn-runtime-hotswap-design`
- **Date**: 2026-10-04
- **Status**: Implemented
- **Related**: `services/co-workspace/src/{config,state,routes/admin,chat}.ts`, design `2026-10-03-coworkspace-cli-provider-key-design` (credential modes), `2026-10-03-coworkspace-sibling-turns-design` (docker-isolated claude/codex turns)

## Problem (user review)

Two structural complaints about switching the team runtime (e.g. hermes → claude):

1. **Every switch required editing `.env` and recreating the containers** — a
   connection-method change should not need a compose restart.
2. **The configuration parameters are hermes-centric** — `CO_WORKSPACE_HERMES_MODEL`,
   `CO_WORKSPACE_HERMES_EXTRA_ARGS`, `hermesBin`… although the params apply to every
   runtime.

Also raised: session continuity and speed under turn-based execution — answered in
§Continuity (claude keeps per-tenant sessions via `--resume`; nothing is lost).

## Decisions

1. **Overlay file + admin API, no restart.** The operator's turn configuration lives
   in `data/turn-config.json` (`TurnOverrides`: runtime, provider, apiKey, baseUrl,
   model, extraArgs). It **overrides env at boot** (loud failure on a corrupt/invalid
   file — a silently wrong credential file is the worst failure mode) and is written
   by **`PUT /admin/turn-config`**, which applies to the RUNNING gateway immediately —
   new turns pick it up on their next spawn; in-flight turns finish on the old config.
   - `GET /admin/turn-config` returns the effective values with the API key **masked**
     (`•••` + last 4) — secrets never leave the process in full.
   - `PUT` merges over the previous overlay file, re-presents the admin password
     (session-hardening D4 — credential change is a destructive-class op), is
     audit-logged, and validates loudly: runtime enum, provider charset, apiKey
     non-empty, baseUrl https, model length, extraArgs string-or-array.
   - Protocol-family mismatches (e.g. provider=openai with runtime=claude) APPLY but
     return a warning — the operator may be preparing a switch; the boot path surfaces
     the same warning.
2. **Runtime-neutral parameter names, aliases for back-compat.** New envs
   `CO_WORKSPACE_MODEL` (model for turns — claude `--model` / hermes config.yaml
   stamp) and `CO_WORKSPACE_TURN_EXTRA_ARGS` (extra argv for every turn);
   `CO_WORKSPACE_HERMES_MODEL` / `CO_WORKSPACE_HERMES_EXTRA_ARGS` remain as
   deprecated aliases (existing deployments keep working). Internal field names
   (`hermesModel`, `hermesExtraArgs`) are unchanged — renaming them is a mechanical
   sweep that can ride a later refactor; the operator-facing surface is neutral now.
3. **claude model passthrough.** The claude adapter receives `--model <cfg.model>`
   when a model is configured (hermes already stamps it into its config.yaml). Codex
   keeps its config.toml model path (documented).

## Continuity & speed (user questions, answered)

- **Session continuity is preserved on every runtime**: claude `--resume <session_id>`
  (session id persisted in the tenant registry), hermes named threads
  (`--continue gw-<tenantId>`), codex `exec resume <thread_id>`. Each turn re-opens
  the SAME server-side session, so the model's context carries across turns.
- **Per-turn latency**: docker-isolated turns add container start (~1s) + CLI init
  (~1-2s) per turn — the same class hermes already had, not a regression of the
  switch. Prompt re-processing cost is mitigated by provider-side caching (Anthropic
  prompt caching applies to `-p` turns with stable prefixes). If sub-second turn
  hand-off ever matters, a resident-worker model (long-lived CLI process per tenant)
  is the design evolution — explicitly future work; the hot-swap state model already
  supports it (the overlay selects the runtime, the adapter owns the mechanics).

## Non-goals

- Renaming internal config fields (mechanical, later sweep).
- A resident turn worker (future work, above).
- Per-tenant runtime selection (global for now — tenants are the user's own teams).

## Tests

`tests/unit/co-workspace-turn-config.test.ts` (8 cases): apply-round-trip, family
mismatch warning, loud validation, overlay persist/load, corrupt-file boot refusal,
PUT-body parsing (string extraArgs split), apiKey masking. Env-parity ratchet covers
the new envs (compose passthrough + .env.sample + README rows).
