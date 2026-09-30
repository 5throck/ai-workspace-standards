# co-workspace Docker Broker as a Raw Socket Proxy — Design

- **Date**: 2026-09-30
- **Status**: implemented
- **Spec id**: `2026-09-30-coworkspace-docker-broker-raw-proxy-design`
- **Owner**: architect (design), automation-engineer (implementation, T-20260930-027)
- **Related**: ADR-0092 Addendum 13, `services/co-workspace/src/docker-broker.ts`, `services/co-workspace/src/docker-broker-policy.ts`, `services/co-workspace/docker/docker-compose.isolation.yml`, `docs/reports/2026-09-30-co-workspace-docker-broker-security-review.md`, supersedes in part `2026-09-30-coworkspace-docker-broker-design`

## R1 — Problem

PR #1253 (T-20260930-008) replaced the tecnativa socket proxy with a create-body-validating
broker. The adversarial review (PR #1257) found it bypassable and unusable.

Bypasses (review findings):
- It validated a parsed copy but forwarded the raw text. Go's daemon decodes keys
  case-insensitively and the last duplicate wins, so a validated body and the executed body
  could differ.
- `CapAdd` was unchecked; `SecurityOpt` only had to contain `no-new-privileges`.
- `User` was checked under `HostConfig`, but it is a top-level field of the create body. The
  old unit tests encoded the same mistake.
- Bind sources were only string-prefix checked (symlinks in the data dir defeat that).
- Container inspect returned the environment of any in-scope container.

Unusable (measured, Docker CLI 29.8.1, Bun 1.4.2):
- The CLI sends versioned paths (`/v1.56/...`) and `HEAD /_ping`; only unversioned paths and
  `GET /_ping` were allowed.
- The `docker run --rm -i` sequence is `HEAD /_ping` (twice), `POST /containers/create` with
  Content-Length, `POST /containers/<64HEX>/attach` on a separate connection using
  `Connection: Upgrade` / `Upgrade: tcp`, `POST .../wait?condition=removed`, then
  `POST .../start`. No `/resize`, no `DELETE` (AutoRemove), no inspect.
- The fetch-based proxy cannot carry attach: the daemon received no stdin and an immediate
  FIN after the 101; the CLI printed nothing yet exited 0 (silent failure).
- After create the CLI addresses the container by its 64-hex ID, so name-prefix scoping
  rejected every request after create.
- Other commands: `docker kill <name>` gives `POST /v1.56/containers/<name>/kill`; the reaper
  gives `GET /v1.56/containers/json?all=1&filters=<%-encoded>` and
  `DELETE /v1.56/containers/<12hex>?force=1` (short ID).
- A first raw prototype that byte-piped after the first head let the CLI's second request on
  the same connection through unparsed (pipelining bypass).
- The raw prototype carried the full sequence only with upstream half-close via
  `socket.shutdown()` (not `socket.end()`, which loses the upstream reply after client FIN)
  and `allowHalfOpen: true` on both sockets.

## R2 — Decision and Architecture

Replace `Bun.serve` + `fetch` with a raw front end and move the decisions into a pure policy
module.

- `src/docker-broker.ts`: `Bun.listen` with `allowHalfOpen`, exactly one request per client
  connection. Head read until CRLFCRLF (16 KiB cap, timeouts); the request line is strictly
  matched; duplicate `Content-Length`, obs-fold and bare CR/LF are rejected;
  `Transfer-Encoding` is rejected with 400 on every route; the body is capped at 64 KiB.
  Any client byte beyond the declared body of the one parsed request closes the connection
  (`pipelined`).
- The upstream head is rebuilt from scratch with `Connection: close`; client headers are never
  forwarded. The create body is forwarded as the canonical re-serialized text built from the
  allowlists, never the raw text.
- Modes: buffered (create, list), piped (ping, version, start, wait, kill, delete) and upgrade
  (attach). Attach is a bidirectional pipe: client FIN triggers `upstream.shutdown()` and
  upstream FIN triggers `client.shutdown()`; writes queue and drain under backpressure.
- Limits: 64 concurrent connections (`CO_WORKSPACE_BROKER_MAX_CONN`, above that 503);
  upstream failure is 502; denied requests are 403 with `{"message":"docker broker: <reason>"}`
  (the CLI prints `message`).
- Ref resolution: every container ref goes through an INTERNAL inspect whose response is never
  returned to the client. It must show a name matching the turn pattern and the configured
  `co-workspace.instance` label; the forwarded ref is rewritten to the full 64-hex Id. This
  handles the CLI's 64-hex IDs, the gateway's name-based `kill`, and the reaper's short IDs
  without changing the gateway.
- Compose: the broker keeps `user: "0:0"` (socket access), `read_only`, `cap_drop: [ALL]`,
  `no-new-privileges`, no published ports, internal `dockerapi` network. It additionally
  mounts the data dir read-only at the same host path (for the bind walk) and receives the
  policy env (instance id, resource caps, hermes binary, runtime image, data dir host path).

## R3 — Policy Specification (`src/docker-broker-policy.ts`)

Paths: an optional `/v1.NN` prefix is stripped before the route decision; paths must not
contain `%`, `//`, `/./` or `/../`; `%` is only accepted in the query. Queries reject
duplicate keys and keys outside the per-route allowlist.

| Route | Query rule | Mode |
|---|---|---|
| HEAD/GET `/_ping`, GET `/version` | none | piped |
| GET `/containers/json` | `all`, `filters` (bounded, JSON) | buffered; response filtered by turn name pattern AND instance label |
| POST `/containers/create` | `name` only, matching the turn pattern | buffered, body schema below |
| POST `/containers/{ref}/attach` | `stream`, `stdin`, `stdout`, `stderr` all 1; requires `Upgrade: tcp` | upgrade |
| POST `/containers/{ref}/start` | none | piped, bind re-check |
| POST `/containers/{ref}/wait` | `condition` in removed, not-running, next-exit | piped |
| POST `/containers/{ref}/kill` | `signal` absent or a KILL/TERM form | piped |
| DELETE `/containers/{ref}` | `force`, `v` | piped |

Inspect and resize are NOT allowed; exec, images, volumes, networks, build, swarm, info are 403.

Create body: a strict JSON scanner rejects any object with duplicate keys or keys equal
ignoring case (including escape-decoded forms). Every key at every level is checked against an
exact-case allowlist; unknown keys are rejected. Key rules:
- Top level: `Image` equals `CO_WORKSPACE_RUNTIME_IMAGE` exactly; `User` is exactly
  `10000:10000`; `Entrypoint` comes from the configured hermes binary; `Env` is an allowlist
  (`HERMES_HOME`, `HERMES_ACCEPT_HOOKS`, at most one provider key); `Labels` are the exact set
  `co-workspace.turn`, `co-workspace.instance`, `co-workspace.tenant` with tenant/name
  consistency.
- HostConfig: `CapDrop` exactly `["ALL"]`; `SecurityOpt` exactly `["no-new-privileges"]`;
  `Memory`, `NanoCpus`, `PidsLimit` positive and within caps taken from the gateway's env;
  every dangerous field (Privileged, PidMode, IpcMode, UsernsMode, CapAdd, VolumesFrom,
  Devices, Sysctls, Mounts, Runtime, Tmpfs and the rest) must equal the CLI default or is
  rejected; `HostConfig.User` is rejected outright.

## R4 — Bind Containment

Binds must be exactly two entries of the shape
`<DATA>/storage/<P>/<N>/(project|hermes-home):/work/(project|hermes-home)`, each source paired
with its matching target, both using the same principal and name (segments limited to a safe
character class, not `.` or `..`), optional `:rw` only. This stops `..`, `//`, relative and
foreign paths and extra targets, but not symlinks, since the gateway can write the data dir.

Symlink controls:
1. At create, the broker walks each component from the data dir to the leaf with `lstat`
   (directories only, no symlinks) and requires the resolved path to equal the leaf. It fails
   closed on errors. This works under `cap_drop: [ALL]` (verified live; no `DAC_READ_SEARCH`
   needed with tenant dirs created by uid 10000).
2. At start, the broker repeats the walk on the binds returned by the internal inspect and
   compares them with the binds recorded at create.

## R5 — Test Plan and Results

- `tests/unit/co-workspace-docker-broker-policy.test.ts`: fixture
  `tests/fixtures/docker-cli/create-request.json` (a real CLI capture) accepted and rebuilt
  canonically; an attack table with one expected reason each (case-variant and duplicate keys,
  `CapAdd`, `SecurityOpt` variants, top-level `User`, `HostConfig.User`, `PidMode`/`NetworkMode`
  `container:`, `VolumesFrom`, `Mounts`, resource caps, env and label forgery, bind shape
  variants, real symlinks in a temp dir, unknown keys at every level); route and query tests.
- `tests/unit/co-workspace-docker-broker.test.ts` with `tests/helpers/fake-docker-daemon.ts`:
  24 integration tests over raw sockets replaying the real CLI capture (create, attach with
  half-close, wait, start), plus pipelining, smuggling, chunked, oversize, symlink swap
  between create and start, connection limit and slow head.
- Both files: 136 tests passing at the time of writing. Mutation checks (PM): removing the
  raw-vs-canonical rebuild, the start re-check, the create-time walk, the pipelining close,
  `Transfer-Encoding` rejection, the duplicate-key scan or the `User` check each fails a test.
- Live (Docker 29.8.1, macOS Docker Desktop, isolated compose project, dummy provider values):
  startup probe and boot reaper work; team create ready in about 6 s; one chat turn ran the
  real docker CLI through the broker (create 201, attach upgraded, wait, start) and the client
  received `system init`; cancel returned in 4 ms with the container gone within 1 s; delete
  removed the tenant folder; a restart reaped a labeled orphan (short-ID delete resolved) and
  left an other-instance and an unlabeled decoy alone. 24 attack requests sent from inside
  the gateway container all got 403/400 with a specific reason and created nothing.

## R6 — Residual Risk and Not Done

Residual risk (accepted):
- The symlink race between the start-time check and the daemon resolving the bind source
  cannot be closed by any string or `lstat` check while the gateway can write the data dir.
  The broker narrows it to milliseconds. Rootless Docker or userns-remap is the only complete
  fix.
- The broker runs as root (needed to read the socket) with all capabilities dropped and a
  read-only rootfs.
- A compromised gateway can still create, start and kill the turn containers it legitimately
  owns, bounded by the policy. Turn containers' environments are no longer readable through
  the broker (inspect removed).

Not verified: Docker Desktop versus Linux symlink semantics on real bind mounts (live checks
ran on macOS Docker Desktop); backpressure under very large output; a real provider turn end
to end; Linux data-dir ownership behavior with the read-only broker mount.

Not done in this pass: rootless Docker or userns-remap migration; egress policy for turn
containers; changes to the gateway argv, reaper or `stopContainer`. The raw capture's `Cmd`
contained `--max-turns undefined --run-budget undefined` only because the capture script did
not pass `maxTurns`/`runBudgetSeconds`; the gateway does pass them (`src/chat.ts`), and the
committed fixture uses real values (100 and 300). It is not a gateway defect.
