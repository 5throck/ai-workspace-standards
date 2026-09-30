# co-workspace Create-Body-Validating Docker Socket Broker — Design

- **Date**: 2026-09-30
- **Status**: implemented
- **Spec id**: `2026-09-30-coworkspace-docker-broker-design`
- **Owner**: automation-engineer (dispatched for T-20260930-008)
- **Related**: ADR-0092, `services/co-workspace/src/docker-broker.ts`, `docker/docker-compose.isolation.yml`, live proxy findings recorded 2026-09-30 (isolation compose WARNING block)

## R1 — Problem

The tecnativa/docker-socket-proxy sidecar filters by API ENDPOINT only and cannot
inspect the container-create body, so a compromised gateway could still create a
privileged container or bind-mount `/`. `CONTAINERS=1` also exposed every container
on the daemon to list/inspect (their environments included). The ticket offered
rootless Docker or a create-body-validating broker.

## R2 — Decision

**Build the create-body-validating broker** (`src/docker-broker.ts`, runs in the
existing gateway image via a compose command override — no new image):
1. **Create-body validation** (fail-closed): image must equal `CO_WORKSPACE_RUNTIME_IMAGE`;
   no `Privileged`; `CapDrop` includes ALL; `SecurityOpt` includes no-new-privileges;
   `User` is exactly `10000:10000`; no host PidMode/NetworkMode; no devices;
   `Memory`/`PidsLimit` caps required; bind/mount sources must sit under
   `CO_WORKSPACE_DATA_DIR_HOST` (unset → all binds rejected — no unvalidatable delivery).
2. **Name scoping**: create/start/wait/kill/attach/inspect/remove resolve only
   `co-workspace-turn-*` container refs, and GET /containers/json responses are
   filtered to that fleet before they reach the gateway — the daemon's other
   workloads (and their env, previously visible via inspect) disappear.
3. **Endpoint allowlist**: exactly the live-verified set — GET /version|/_ping,
   GET /containers/json, POST /containers/create, POST …/start|wait|kill|attach,
   GET …/json, DELETE …/ . Exec, images, volumes, networks, info, build, swarm, and
   everything else is 403.

The broker runs as root with cap_drop ALL + read_only fs + no-new-privileges
(root is required for the socket's root:root 660 DAC check — the same reason the
old proxy image ran as root). Policy inputs (`CO_WORKSPACE_RUNTIME_IMAGE`,
`CO_WORKSPACE_DATA_DIR_HOST`) mirror the gateway's own config; both sides must
agree or creates fail closed.

Rootless Docker stays the long-term direction (operator environment change, not
implementable in-repo); the residual accepted risk is that a compromised gateway
can still manage the turn containers it legitimately owns.

## R3 — Rejected Alternatives

| Alternative | Reason for rejection |
|---|---|
| Rootless Docker now | Operator host migration (daemon user, socket path, storage driver); not landable as code — recorded as the follow-up direction in the compose header. |
| Keep tecnativa + gateway-side create-body guard | The guard and the enforcement point must be the same component; a gateway-side check is bypassed by exactly the compromise it defends against. |
| Docker Compose label-based scoping via `daemon.json` authorizers | Docker has no built-in per-request authorization hooks without an authz plugin — which IS a broker, just in a different runtime; the Bun broker shares the tested codebase and test harness. |

## R4 — Verification

- New `tests/unit/co-workspace-docker-broker.test.ts` (10 pass): route allowlist,
  create-body rejection matrix (12 rules), fail-closed misconfig, fleet-name
  scoping, list filtering, and an end-to-end pass through the REAL production
  handler (`createBrokerHandler`) against a fake upstream — 403s outside the
  allowlist, body forwarded intact on valid creates, privileged create rejected,
  foreign-named create rejected, list fleet-filtered.
- `co-workspace-docker-hardening.test.ts` rewritten for the broker architecture
  (command override, root-but-caps-dropped, policy mirrors, no published ports);
  `env-parity` covers the four `CO_WORKSPACE_BROKER_*` vars (compose-exempt with
  reasons — they live on the broker service in the isolation override — and
  documented in `.env.sample`).
- Full co-workspace suite: 252 pass / 0 fail. README isolation section rewritten;
  the isolation compose WARNING block replaced by the broker control summary.

## R5 — Out of Scope

- Live end-to-end turn through the real daemon with the broker in the path —
  part of T-20260930-009 operator verification (docker mode already requires it).
- Rootless Docker migration guide — operator documentation, follow-up when the
  host migration happens.
