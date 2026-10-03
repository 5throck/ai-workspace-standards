# co-workspace CLI Provider-Key Support Design — claude/codex runtimes — 2026-10-03

**Date**: 2026-10-03
**Status**: Approved (Row 0 design; implementation lands in this wave)
**Spec id**: 2026-10-03-coworkspace-cli-provider-key-design
**Scope**: services/co-workspace (runtime credential model)
**Context**: user request (2026-10-03, Korean-language session; paraphrased in English) — extend the provider-key credential model to Claude Code / Codex CLI / Antigravity CLI, and deliver BOTH deployment parity and the documented posture for the non-hermes runtimes. Related: T-20261003-023 (container parity), provider-key design 2026-09-29 (R4 listed this as a non-goal — superseded in part by this design).

## 1. Problem

Provider-key mode (`CO_WORKSPACE_LLM_PROVIDER` + `_LLM_API_KEY` + `_LLM_BASE_URL`) currently stamps credentials only into hermes tenants (`config.yaml`). The claude/codex/antigravity runtimes depend on the OPERATOR's interactive CLI logins living in the gateway process's HOME — so those runtimes are unusable for any deployment (or container) that does not carry the operator's logins, and per-deployment static keys (the recommended low-limit posture from ADR-0092 Addendum 9) cannot be used with them.

## 2. Evidence (live probes, 2026-10-03 — P6 protocol-probe step)

- **claude**: `claude --help` documents "Anthropic auth is strictly `ANTHROPIC_API_KEY` or [login]" — first-class env-key support; `ANTHROPIC_BASE_URL` redirects the endpoint (documented for proxies/custom Anthropic-compatible endpoints).
- **codex**: `OPENAI_API_KEY` is the built-in openai provider's env credential (`env_key` in the provider stanza); probe: `codex exec` starts and runs with a key in env and no login. Custom base URLs are a `~/.codex/config.toml` `model_providers.<id>.base_url` concern (or `-c` overrides) — NOT a plain env var.
- **antigravity (agy)**: full CLI help exposes NO credential/API-key flag or env var — the runtime is Google-account OAuth login-only. Provider-key support is NOT applicable; excluded (documented, with the boot warning below).

## 3. Requirements

- R1: when provider-key mode is on and the configured provider's protocol family matches the runtime, chat turns for `claude`/`codex` inject the key (and, for claude, the base URL) into the turn's environment under the CLI's native variable names — precedence: injected key over the operator's interactive login.
- R2: family mismatch (e.g. provider `gemini` with runtime `codex`) injects nothing and warns at boot; `custom` matches both Anthropic- and OpenAI-protocol runtimes (the operator owns base-URL compatibility — documented loudly).
- R3: provider-key mode off → behavior unchanged (allowlisted env from the operator's process env, CLI logins as today).
- R4: antigravity stays login-only; the boot warning names it when a key is configured.
- R5: codex base-URL override is out of scope for env injection (config.toml stanza is operator-side) — documented in the README runtime matrix.

## 4. Design

- D1 — pure mapping `runtimeProviderKeyEnv(runtime, cfg): Record<string, string> | null` (config.ts, next to `resolveLlmProviderKey`):
  - no `llmApiKey` → `null`;
  - `runtime=claude`, provider ∈ {anthropic, custom, zai} → `{ ANTHROPIC_API_KEY: value }` plus `{ ANTHROPIC_BASE_URL: llmBaseUrl }` when a base URL is set;
  - `runtime=codex`, provider ∈ {openai, custom} → `{ OPENAI_API_KEY: value }`;
  - `runtime=antigravity`, or family mismatch → `null`;
  - `runtime=hermes` → `null` (the existing hermes path owns it — `providerKeyEnv` + config.yaml stamping).
- D2 — chat.ts: for non-hermes runtimes, merge the mapping into the adapter's `env` (`{ ...process.env, ...map }`); the adapters' `allowlistedEnv` already permits `ANTHROPIC_*`/`OPENAI_*` prefixes and denies gateway secrets, so the injected key flows and `CO_WORKSPACE_*` never does.
- D3 — boot warning `runtimeProviderKeyWarning(cfg)` (access.ts, next to `isolationPostureWarning`): fires when a key is configured and (a) runtime is antigravity ("login-only — provider key cannot apply"), or (b) the provider family cannot serve the runtime (names both). Silent when matched or when no key is set.
- D4 — provider families: `anthropic`, `zai` → Anthropic-protocol (claude); `openai` → OpenAI-protocol (codex); `gemini` → agy (login-only, no key); `custom` → matches claude and codex (operator guarantees the base URL speaks the runtime's protocol); `none`/unset with a key set behaves as `custom` (mirrors `resolveLlmProviderKey`).
- D5 — zai + claude requires `CO_WORKSPACE_LLM_BASE_URL` pointing at the Anthropic-compatible endpoint (z.ai: `https://api.z.ai/api/anthropic`); without it the key hits api.anthropic.com and fails — documented in the README matrix.

## 5. Non-goals

- Per-tenant provider/model selection (unchanged, deployment-wide).
- Codex base-URL env injection (config.toml stanza is the mechanism; operator-side).
- antigravity API-key support (the CLI exposes none; revisit upstream).
- Container image binaries/credential mounts (T-20261003-023 tracks that decision separately — this design removes the credential half of that gap for claude/codex).

## 6. Test plan

- Pure-mapping suite: no key → null; claude+anthropic → ANTHROPIC_API_KEY (+ BASE_URL with/without llmBaseUrl); claude+zai with base URL; codex+openai → OPENAI_API_KEY; codex+anthropic → null (mismatch); antigravity+anything → null; hermes → null; custom matches both.
- Boot-warning suite: mismatch and antigravity cases warn; matched/no-key silent.
- Existing suites stay green (adapters unchanged — injection is caller-side env).

## 7. Verification

Full co-workspace battery + service typecheck + README/runtime-matrix update; audit gate via dev-sync.

## Part B — deployment parity for the non-hermes runtimes (user decision: options a+b both)

Added post-registration when the user directed BOTH the provider-key extension AND
deployment parity (T-20261003-023 scope a; process-isolation layer):

- B1 — the gateway image bakes the **claude and codex CLIs** (node:22 stage + `npm i -g`
  pinned `@anthropic-ai/claude-code@2.1.288` / `@openai/codex@0.160.0`, install-time
  `--version` assertion). Process-isolation turns inside the gateway container now work
  for every runtime but antigravity.
- B2 — **antigravity is NOT baked**: the local probe shows a platform-native 186 MB Mach-O
  binary and no npm/Linux artifact source verifiable from here. Delivered instead as a
  read-only binary + login-home mount in the new `docker-compose.creds.yml` overlay
  (`CO_WORKSPACE_AGY_BIN_HOST` / `CO_WORKSPACE_GEMINI_HOME_HOST`), with claude/codex login
  homes (`CO_WORKSPACE_CLAUDE_HOME_HOST` / `_CODEX_HOME_HOST`) in the same overlay for
  login-mode deployments. All mounts read-only by design.
- B3 — the docker-isolation fail-fast now states what IS supported (process isolation for
  all runtimes; hermes-only sibling turns) and names the follow-up. Boot logs the effective
  credential mode per non-hermes runtime (provider-key env names vs interactive login).
- B4 — DEFERRED (T-20261003-025): docker-ISOLATED sibling turns for non-hermes runtimes —
  needs runtime-image CLI builds, adapter container wrappers, and a broker bind-policy
  expansion for per-CLI credential homes (security-sensitive, its own design gate).
- B5 — README gains the runtime matrix (protocol / continuity / credentials / isolation).
