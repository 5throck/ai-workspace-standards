# Team Gateway Phase 2 Hardening Design — Auth, Quotas, Toolset Scoping, Container Isolation

- **Spec id**: `2026-09-27-team-gateway-phase2-hardening`
- **Date**: 2026-09-27
- **Status**: Approved (Row 0 design; implementation lands in the same PR)
- **Related**: ADR-0092 (Team Gateway — this implements its §10 Phase 2 roadmap), ADR-0074 (Universal Design Gate), ADR-0088 (Hermes platform support), T-20260927-019 (pinned-scaffold defect, unrelated but concurrent)
- **Scope**: Hardening of `services/team-gateway/` — API-key auth, per-tenant quotas with enforcement, first-class toolset scoping, and an opt-in per-tenant container isolation mode (`TEAM_GATEWAY_ISOLATION=docker`) — plus docs. No template changes.

---

## 1. Background

ADR-0092 landed the Phase 0 gateway with an honestly-stated posture: loopback bind, no auth, single process, per-tenant `HERMES_HOME` as the only isolation boundary, usage recorded but not enforced. Phase 2 hardening (design §10) was flagged as the gate to anything beyond localhost use. This design implements the roadmap items that are enforceable by the gateway process itself, and scopes the operator-side items (network egress) to what the gateway can honestly contribute.

Verified facts driving the design:
- Hermes `-t/--toolsets` accepts a comma-separated toolset list per session — a real per-session tool-confinement knob.
- Hermes `egress` (iron-proxy) is an operator-installed host-side TLS-intercepting firewall (own wizard, `proxy.yaml` ruleset, disabled by default) — deployment-owned, not per-tenant gateway configuration.
- Docker is available on the reference machine (29.8.0), so container isolation can be live-verified rather than paper-specified.

## 2. Goals / Non-Goals

**Goals**
- G1: Optional API-key authentication on every route except `GET /health` and `GET /` (static page); keys via `TEAM_GATEWAY_API_KEYS` (comma-separated); disabled with a startup warning when unset (preserves the Phase 0 local mode).
- G2: Per-tenant quotas enforced before a turn starts: lifetime turn cap (`TEAM_GATEWAY_TENANT_MAX_TURNS`) and cumulative token cap (`TEAM_GATEWAY_TENANT_MAX_TOKENS`); `0` = off. Exceeded → `429` on all chat surfaces.
- G3: First-class toolset scoping: `TEAM_GATEWAY_HERMES_TOOLSETS` → `-t` on every spawned session.
- G4: Opt-in per-tenant container isolation: `TEAM_GATEWAY_ISOLATION=docker` wraps each session spawn in `docker run --rm -i` with only the tenant project dir + Hermes home mounted; startup fails fast when the Docker CLI is unusable in this mode. Default remains `process`.
- G5: Credential secrets never appear in API responses, logs, or error bodies (unchanged from Phase 0).

**Non-Goals**
- N1: No multi-user identity model — one shared key pool, keys are bearer credentials (not per-human accounts).
- N2: No key rotation UI / secret-manager integration — env-supplied keys; rotation is a restart. Later.
- N3: No per-tenant egress config generation — iron-proxy is host-side and operator-deployed; the runbook documents the deployment shape. The gateway contributes toolset scoping + ceilings.
- N4: No billing — quotas return `429`; metering remains usage counters.
- N5: No Kubernetes/scheduler integration — container isolation targets a single Docker host.

## 3. Surface Additions

| Concern | Mechanism | Failure shape |
|---|---|---|
| Auth | `Authorization: Bearer <k>`, `x-api-key: <k>`, or `x-goog-api-key: <k>` | `401 {error}` |
| Quota (turns) | `TEAM_GATEWAY_TENANT_MAX_TURNS` > 0 and registry turns ≥ cap | `429 {error}` before the stream opens |
| Quota (tokens) | `TEAM_GATEWAY_TENANT_MAX_TOKENS` > 0 and cumulative tokens ≥ cap | `429 {error}` before the stream opens |
| Isolation | `TEAM_GATEWAY_ISOLATION=docker` + `TEAM_GATEWAY_RUNTIME_IMAGE` | startup failure when `docker version` unusable |
| Toolsets | `TEAM_GATEWAY_HERMES_TOOLSETS` → `-t <list>` | n/a |

Exempt from auth: `GET /health`, `GET /` (liveness + static page). Everything else — native REST and all three wire surfaces — requires a valid key when auth is enabled. Auth headers accepted: Bearer, `x-api-key`, `x-goog-api-key` (so every wire surface's native header style works).

## 4. Design Decisions

- **D1 — Key auth, disabled by default, fail-closed when enabled.** Empty `TEAM_GATEWAY_API_KEYS` keeps the Phase 0 localhost mode (startup warning states it). Any configured key enables enforcement on every non-exempt route. Comparison hashes both sides (SHA-256) before a constant-time compare — no length or prefix oracles. Key identity is not per-user: the key pool is a shared bearer credential, recorded nowhere per-request.
- **D2 — Quotas are per-tenant lifetime counters enforced pre-turn.** The registry already persists per-tenant state; each completed turn adds `inputTokens/outputTokens` from the result envelope, and `sessions` counts turns. Enforcement happens before opening any stream, so a rejected turn costs nothing and surfaces as `429` in every wire's native error channel. Lifetime counters (no windows) keep the model honest and simple; windowed quotas are a later addition.
- **D3 — Container isolation = per-turn ephemeral sibling container, same argv contract.** `TEAM_GATEWAY_ISOLATION=docker` wraps the exact same Hermes argv in `docker run --rm -i --workdir /work/project -v <projectDir>:/work/project -v <hermesHome>:/work/hermes-home -e HERMES_HOME=/work/hermes-home <image> …` — only the tenant project dir and Hermes home are mounted, nothing else is reachable; stdout carries the same JSONL protocol so the parser is unchanged. `HERMES_BIN` in docker mode is the in-container binary path. The image is operator-built from `services/team-gateway/docker/Dockerfile` (contains bun + Hermes). Startup probe runs `docker version` and fails fast in docker mode.
- **D4 — Egress policy scoping.** The gateway enforces what it can (toolset scoping via `-t`, run ceilings, tenant-dir trust) and documents the host-side iron-proxy deployment for network egress enforcement — inventing config keys for a wizard-managed daemon would be a false guarantee. Per-tenant egress differentiation rides iron-proxy's ruleset (operator concern).
- **D5 — Startup fail-fast for explicit modes.** A misconfigured explicit isolation mode must not silently downgrade: docker mode with an unusable Docker CLI aborts startup. Auth-enabled-with-weak-config (empty key entries) likewise aborts startup.

## 5. Implementation Waves

| Wave | Content |
|---|---|
| W1 | This design doc + spec registration |
| W2 | Auth middleware + quota accounting/enforcement (`src/auth.ts`, registry usage fields, server gating) + tests |
| W3 | Toolset flag + docker isolation adapter (`hermes.ts` argv/spawn split, config, startup probe) + unit tests (argv construction, probe) |
| W4 | Docs (README security section rewrite, design doc Phase 2 record, ADR-0092 Addendum 2, CHANGELOG) |
| W5 | Gates + live verification + `/sync` PR |

## 7. Verification Plan

1. Unit: auth accepts/rejects across the three header styles and constant-time path; quota thresholds trip exactly at the cap (`429`); docker argv construction pins mounts/env/order; probe function verdicts on a fake `docker` binary.
2. Full gateway suite (51+ tests) green; service typecheck clean.
3. Live smoke (process mode): auth-enabled startup → `401` without key, `200` with key on all surfaces; quota trip on a low cap.
4. Live smoke (docker mode): build the runtime image, provision a tenant, run one turn — same JSONL protocol and done event as process mode, verified in-container.
5. `bun scripts/audit.ts` green; `/sync` PR.

## 8. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Keys leak via logs/metrics | Keys are never echoed; auth failures log the header style only |
| Docker socket exposure widens blast radius | Docker mode is opt-in; the daemon socket is touched only via the CLI binary, no socket mounts into tenant containers |
| Container image drift vs gateway code | Runtime image is operator-pinned (`TEAM_GATEWAY_RUNTIME_IMAGE`); README documents rebuild-on-release |
| Quota counters lost on registry corruption | Counters are advisory capacity control, not billing truth; `429` fails closed |
| Pipelined requests pass the quota gate on stale counters | The gate is checked at request time against the persisted counter (pre-turn 429); a client that pipelines without consuming the previous stream may enqueue turns past the soft cap — counters still account every turn. Documented semantics; per-tenant serialization bounds the overshoot |
| Auth bypass via exempted routes | Exemptions limited to two static GETs (`/health`, `/`); audit test asserts every other route returns 401 keyless |

## 9. Accessibility & Preview Verification Statements

- **Accessibility (ADR-0065)**: exempt — HTTP API hardening; the demo page gains one optional labeled input (API key) using semantic form controls.
- **Preview Verification (ADR-0070)**: exempt — no shipped rendered UI change beyond the dev-aid input; verification is API/test-based (§7).

## 10. Addendum (2026-09-27, same-day wave 2): Windowed Quotas + Key Rotation

- **Windowed quotas**: `TEAM_GATEWAY_QUOTA_WINDOW=lifetime|daily` (default lifetime). `daily` reads per-UTC-day buckets (`rec.daily`, pruned to the 8 most recent days on write) so caps reset each day; `lifetime` reads the cumulative counters. `assertQuota`/`windowUsage` take an injectable day key for deterministic testing.
- **Key rotation without restart**: `TEAM_GATEWAY_API_KEYS_FILE` — one key per line, `#` comments. Keys = env pool ∪ file keys; `POST /admin/reload` (auth-required) re-reads the file and re-unions with the process-immutable env pool. A reload that would empty the pool while auth is enabled is rejected (`400`). This is the secret-manager-agnostic rotation path: point the file at any managed-secret mount. (Found during implementation: re-parsing `process.env` in the reload path would drop file keys and silently disable auth — the env portion is captured at startup instead.)
- Tests: window usage with injectable day keys (fresh-day reset), key-list parsing (comments/blanks), rotation flip (`/admin/reload`), reload auth-protection.

## 11. Verification Record (2026-09-27, live)

- Docker isolation live-verified end to end with the production image: `services/team-gateway/docker/Dockerfile` rebased onto the official `nousresearch/hermes-agent` image (PyPI 0.15.2 predates the chat stream-json protocol — wheel builds are upstream-refused by design; the official image is the supported packaging), gateway restart under `TEAM_GATEWAY_ISOLATION=docker` → tenant provision → one live turn inside the ephemeral container (exit 0, container-side session id, correct workspace-team answer, 36k/139 token usage through the container boundary). The isolation adapter passes the Hermes binary as `--entrypoint` because upstream images ship an s6 init entrypoint.
- Antigravity runtime adapter (ADR-0092 Addendum 3) live-verified: fresh tenant two-turn remember/recall probe answered "remembered" then "77" across `--conversation` turns.

## 12. Addendum (2026-09-27, second): Accounts Wave — Verification Flow and Analytics

Post-#1138 additions recorded here (design credit: ADR-0092 Addendum 5):
- **Email-verification flow**: signup(ID, email, password) → pending account + verification token (24h) → mail to the outbox → key entry activates. PII minimization: raw email discarded on activation, users keep `email_hash`; login by ID.
- **Admin analytics endpoint** (`/admin/stats`): per-principal tenant counts + recursive disk usage + turn rollups; global status/variant/token aggregates; rendered as bar charts in the demo admin menu.
- **Files/History APIs** (Wave A): `GET /tenants/:id/files|/file` (tenant-confined, denylist, 256KB cap) and `/tenants/:id/history` backed by the `turns` table (last-100 pruning).

## 10. References

- ADR-0092 + `docs/designs/2026-09-27-team-gateway-service-design.md` (Phase 0 baseline, §10 roadmap)
- Hermes CLI: `chat -t/--toolsets`, `egress` (iron-proxy, operator-side), `HERMES_ACCEPT_HOOKS`
- Docker CLI: `run --rm -i --workdir -v -e` (isolation adapter contract)
