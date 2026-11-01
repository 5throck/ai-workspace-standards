# Design: Ephemeral Ports for co-workspace Test Servers

- **Spec id**: `2026-11-01-coworkspace-ephemeral-port-design`
- **Date**: 2026-11-01
- **Status**: Implemented
- **Related**: `services/co-workspace/src/config.ts`, `tests/unit/co-workspace-*.test.ts`, `services/co-workspace/src/server.ts` (`Bun.serve`), README `CO_WORKSPACE_PORT` row

## Problem

CI observed a flaky failure class: `tests/unit/co-workspace-sse-cancel.test.ts:66` —
"Failed to start server ... EADDRINUSE" (port 34732). Diagnosis (PM-side, re-verified
during implementation):

- 11 `tests/unit/co-workspace-*.test.ts` files draw their gateway port as
  `CO_WORKSPACE_PORT: String(20000 + Math.floor(Math.random() * 20000))` and bind a
  real server. `bun test` runs test FILES in parallel, so concurrent workers draw from
  the same 20k space independently — birthday collisions on the same port are
  inevitable at this file count (two workers drew the same port in today's CI run).
- `services/co-workspace/src/config.ts` `num()` requires `parsed > 0`, so
  `CO_WORKSPACE_PORT=0` is treated as junk and falls back to 9030. That is why the
  random-port pattern exists at all: the tests could not ask for an ephemeral port.
- `Bun.serve` fully supports port `0` (kernel-assigned ephemeral port) and reports
  the actually-bound port via `server.port`; every affected test already builds its
  base URL from `server.port` (e.g. `co-workspace-sse-cancel.test.ts:67`), not from
  the configured value. So ephemeral binding is reachable with a config-only change.

## Decision

**`CO_WORKSPACE_PORT=0` becomes a meaningful value: bind an ephemeral port.**

- `loadConfig` parses the port with 0-as-meaningful semantics, mirroring the file's
  existing `numOr0` shape but preserving the unset default:
  - unset (or empty/whitespace — compose interpolation convention, same as
    `CO_WORKSPACE_API_KEYS`) → default `9030`;
  - set and parses to a finite number `>= 0` → that value (`0` = ephemeral);
  - junk or negative → fallback `9030` (unchanged).
- The 11 server-binding test files switch to the literal `CO_WORKSPACE_PORT: "0"`.
  No port space is drawn at all — the kernel assigns disjoint ports per worker, so
  the birthday-collision class is eliminated rather than shrunk.
- Production unaffected: `0` was previously an invalid value that silently fell back
  to 9030, so no deployment can be relying on it; unset still means 9030, and the
  Dockerfile/README default (9030) is untouched. The `0 = ephemeral` meaning is
  documented in the config doc-comment next to the port line.
- Kept as-is: `tests/unit/co-workspace-tenant.test.ts` asserts `cfg.port === 9999`
  from its own explicit env — that is a config-parse assertion with no server bind.
  `tests/unit/co-workspace-env-parity.test.ts` only checks the Dockerfile/README
  default (9030) — untouched.

## Blast Radius

- `services/co-workspace/src/config.ts` — one parser + doc-comment (service source,
  not `scripts/` tooling: the file carries no `@version` header and none is added).
- 11 `tests/unit/co-workspace-*.test.ts` files — one-line mechanical replacement each.
- 1 new pinning test in the existing `GatewayConfig (loadConfig)` block of
  `tests/unit/co-workspace-tenant.test.ts` (house convention: config-adjacent tests
  live there).
- `CHANGELOG.md` `[Unreleased]` entry.
- No template, skill, script, or production runtime surface changes.

## Test Plan

1. New pinning test (config semantics): `CO_WORKSPACE_PORT: "0"` → `cfg.port === 0`;
   unset → `cfg.port === 9030`; junk (`"not-a-number"`) → `9030`.
2. Ephemeral smoke: `createServer` on a `CO_WORKSPACE_PORT: "0"` config binds
   successfully and reports `server.port !== 0` (the actual assigned port).
3. All 11 touched suites pass individually (`bun test tests/unit/co-workspace-<name>.test.ts`).
4. Full `bun test tests/unit/co-workspace-*.test.ts` set green; full `bun run test:unit`
   green; `bunx tsc --noEmit` 0 errors; `bun scripts/audit.ts` green.
5. CI on the landing PR must be genuinely green — the green run is the regression
   proof that the EADDRINUSE flake class is fixed.

## Accessibility (ADR-0065) / UI Preview Verification (ADR-0070)

Non-UI change: configuration parsing and test infrastructure only — no user-facing
surface, no markup, no visual artifact. ADR-0065 accessibility review and ADR-0070
UI preview verification are exempt (N/A).
