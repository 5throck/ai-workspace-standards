# co-workspace Provider Key+Base-URL Configuration — Design

- **Date**: 2026-09-29
- **Status**: implemented
- **Spec id**: `2026-09-29-co-workspace-provider-key-config-design`
- **Owner**: governance-ticket-runner (user-directed architecture change)
- **Related**: ADR-0092 (Addendum 10 corrects R2/R6; Addendum 4 shared credential store; Addendum 5 SEC-07; Addendum 7 seed directory bind), `docs/designs/2026-09-27-co-workspace-phase2-hardening-design.md` (docker isolation)

## R1 — Problem

Docker-isolated turns authenticate the tenant Hermes via a per-turn copy of the
operator's OAuth `auth.json` (runChat re-seed). On 2026-09-29 Nous Portal revoked
the session (`invalid_grant` — refresh-token reuse): every Hermes instance sharing
the copied `auth.json` is an independent refresher of the SAME single-use refresh
token, so the isolation architecture itself violates the OAuth provider's rotation
contract. Any copy-based credential mechanism will recur this failure class.

## R2 — Decision

Replace the copy-based OAuth path with **static provider credentials** supplied by
the operator as configuration — the API Key + Base URL that LLM providers issue:

| Config | Meaning |
|--------|---------|
| `CO_WORKSPACE_LLM_PROVIDER` | Selector mirroring the co-newbiz scheme: `openai \| anthropic \| gemini \| zai \| custom` (default `custom` when a key is set; `none`/unset = off) |
| `CO_WORKSPACE_LLM_BASE_URL` | OpenAI-compatible base URL (e.g. `https://api.openai.com/v1`); required for `custom`, optional override for named providers |
| `CO_WORKSPACE_LLM_API_KEY` | The provider's API key |
| `CO_WORKSPACE_HERMES_MODEL` | Model id (existing knob, unchanged) |

Provider resolution (R6): the selector picks which env var carries the key —
`openai`/`custom` → `OPENAI_API_KEY`, `anthropic` → `ANTHROPIC_API_KEY`,
`gemini` → `GOOGLE_API_KEY` (an exact name in hermes's env allowlist — the `GOOGLE_`
prefix is not allowlisted because `GOOGLE_CLIENT_SECRET` is a gateway secret), `zai` →
`ZAI_API_KEY` — and the selector value (lower-cased) is stamped into tenant config.yaml
as `model.provider`. Unset selector
with a key present = `custom` (backward compatible with the first key-mode release).

When `llmApiKey` is configured:

- **Tenant config.yaml** (re-stamped every turn) stamps `model.provider` (the
  selector value; `custom` by default), `model.base_url`, and `model.default`.
  *(Original text said `provider: custom` always and the key env was always
  `OPENAI_API_KEY`; corrected by ADR-0092 Addendum 10.)*
- **Turn spawn** injects the key under the provider's env name (see the resolution
  table above) into the isolated container (`-e NAME`) and into the process-mode spawn
  env (hermesEnv). *(Superseded in part by R8: the key is also stamped as
  `model.api_key` in the tenant config.yaml, so "never lands on disk" no longer holds.)*
- **The per-turn auth.json re-seed is skipped** — no OAuth token is copied
  anywhere, so the refresh-token reuse class is structurally gone.

When `llmApiKey` is NOT configured, the legacy shared-store/auth.json behavior is
preserved unchanged (deployment compatibility until the operator migrates).

## R3 — Trust-path note

The generated config.yaml trusts the tenant project directory. Isolated turns
mount the project at `/work/project` (the gateway-side copy sits under `/data/...`),
so both paths are stamped explicitly — still per-tenant, never blanket (ADR-0088 D7).

## R4 — Non-goals

- Per-tenant provider/model selection (one deployment-wide provider).
- Migrating the antigravity/claude/codex runtimes (they carry their own binaries
  and credential surfaces).
- Removing the shared-store process-mode path (it remains the no-key fallback).

## R5 — Acceptance criteria

- [x] `loadConfig` parses `CO_WORKSPACE_LLM_BASE_URL` / `CO_WORKSPACE_LLM_API_KEY`.
- [x] `tenantConfigYaml` stamps `provider: custom` + `base_url` when configured, and
      the output is unchanged when not configured.
- [x] `hermesSpawnArgv` (docker) and `hermesEnv` (process) inject the provider's key
      env name (`OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GOOGLE_API_KEY` / `ZAI_API_KEY`)
      only when the key is configured.
- [x] runChat skips the auth.json re-seed when the key is configured.
- [x] compose passes both variables through (empty default = off).

## R8 — Provider key is stamped into tenant config.yaml (plaintext)

`tenantConfigYaml` writes `model.api_key` into each tenant's `<hermesHome>/config.yaml`
on every turn (re-stamped, like provider/base_url). This is required, not optional:
live-verified 2026-09-29 that hermes agent turns resolve the provider key through the
profile secret scope and do not borrow ambient env (an env-only turn returned 401).
The env injection from R2 is kept in addition.

Consequences and accepted risk:

- In docker isolation the tenant hermes home is mounted read-write into the turn
  container, so the agent's own tools can read the key; a prompt-injected turn could
  exfiltrate it (network egress is open). The per-tenant files API is rooted at the
  tenant project directory only, not the hermes home, so the key is not served there.
- Accepted for the single-operator deployment: use a dedicated, scoped, low-limit
  provider key and rotate it on suspicion.
- Hardening that ships with T-20260929-006: YAML-safe quoting of stamped values,
  restrictive file mode where possible, and passing the key to docker as `-e NAME`
  (no value on argv). See ADR-0092 Addendum 9.

## R6b — Provider selector: `zai` and stamped provider name

`zai` is a fifth selector value (`config.ts` `resolveLlmProviderKey`): key env
`ZAI_API_KEY`, paired with `https://api.z.ai/api/anthropic`. `model.provider` is stamped
from `resolveLlmProviderName` — the selector value, lower-cased, default `custom`.
Any unrecognized selector value falls back to `OPENAI_API_KEY` as the key env name.

## R7 — Default reasoning effort

Thinking-mandatory models (e.g. glm-5.3-flash) reject effort-less requests.
`CO_WORKSPACE_HERMES_REASONING_EFFORT` is stamped as `agent.reasoning_effort` in
tenant config.yaml (`tenantConfigYaml`). In key mode an unset variable resolves to
`low` (a nullish default in `server.ts`); an explicitly empty value is preserved by
`loadConfig` and omits the stamp. Compose uses `${VAR-low}` (no colon) so an empty
host value stays empty instead of becoming `low`.

- [x] `tenantConfigYaml` stamps `agent.reasoning_effort` only when non-empty.
- [x] Key-mode default is `low`; empty omits.
- [x] Acceptance R2/R6 statements corrected for `zai` and per-provider env names
      (ADR-0092 Addendum 10).
