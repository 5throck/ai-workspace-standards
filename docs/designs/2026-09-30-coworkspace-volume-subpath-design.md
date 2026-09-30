# Design: Opt-in Volume-Subpath Mode for the Co-Workspace Docker Broker (T-20260930-038)

- **Date**: 2026-09-30
- **Status**: Draft (design only; implementation ticket T-20260930-038)
- **Related**: `docs/designs/2026-09-30-coworkspace-docker-broker-raw-proxy-design.md` (current broker design), ADR-0092 Addendum 13, `services/co-workspace/src/docker-broker-policy.ts`, `services/co-workspace/src/docker-broker.ts`, `services/co-workspace/src/hermes.ts`, `services/co-workspace/src/lifecycle.ts`, `services/co-workspace/docker/docker-compose.isolation.yml`
- **Problem**: The F3 race from the 2026-09-30 security review — bind sources are followed through symlinks by the daemon, so a compromised gateway can swap `storage/<P>/<N>` for a symlink between the broker's `validateBindsOnDisk` check and the daemon's mount at `/start`. The lstat walk narrows but does not close the TOCTOU window (the broker itself documents this as residual risk).
- **Fix**: an OPT-IN mode where tenant data lives in a named Docker volume and turn containers use `--mount type=volume,...,volume-subpath=<rel>`. Volume-subpath resolution happens inside the daemon from the volume's own root; it cannot escape (measured: symlink / `..` / absolute subpaths are all rejected by dockerd 29.8.1). No host path is ever named, so there is nothing to race.

## 1. Measured ground truth (do not re-derive)

Experiments on Docker Desktop for Mac, docker 29.8.1:

1. `-v <data>/userslink:/h` where `userslink -> /Users` exposed Mac `/Users` inside the container. The bind-source race is real.
2. `--mount type=volume,src=<vol>,dst=/h,volume-subpath=<rel>` is daemon-enforced escape-safe:
   - `volume-subpath=../x` → daemon error "path concatenation escapes the base directory"
   - `volume-subpath=/abs` → "subpath must be a relative path within the volume"
   - a symlink inside the volume pointing outside → resolved within the volume base only
   - legitimate relative subpaths work as expected.

## 2. Mode selection

New env `CO_WORKSPACE_DATA_VOLUME` (a Docker volume name, e.g. `coworkspace-data`):

| | bind mode (default, today) | volume mode (opt-in) |
|---|---|---|
| Trigger | `CO_WORKSPACE_DATA_VOLUME` unset | `CO_WORKSPACE_DATA_VOLUME=<name>` set |
| Tenant storage | `<DATA_HOST>/storage/<P>/<N>/{project,hermes-home}` on the host FS | `<name>:/storage/<P>/<N>/{project,hermes-home}` inside the volume |
| Turn mount | `-v host:dst` → `HostConfig.Binds` | `--mount type=volume,src=<name>,dst=...,volume-subpath=...` → `HostConfig.Mounts` |
| Broker data check | lstat walk + realpath (kept) | none — daemon enforces containment |
| Read-only data-dir mount on the broker | required (for the lstat walk) | dropped — no host path is named |
| Residual F3 race | accepted (documented) | closed |

Volume name validation at config load: `^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$` (docker's own volume-name charset); reject otherwise, fail closed at boot.

## 3. Wire format (docker CLI 29.8.1)

In volume mode the gateway argv replaces the two `-v` entries for tenant data:

```
--mount type=volume,src=<DATA_VOLUME>,dst=/work/project,volume-subpath=storage/<P>/<N>/project
--mount type=volume,src=<DATA_VOLUME>,dst=/work/hermes-home,volume-subpath=storage/<P>/<N>/hermes-home
```

The CLI converts this to `HostConfig.Mounts` in the `/containers/create` body (exact JSON shape to be confirmed by a live capture — see §9):

```json
"HostConfig": {
  "Binds": null,
  "Mounts": [
    { "Type": "volume", "Source": "<DATA_VOLUME>", "Target": "/work/project",
      "ReadOnly": false, "Consistency": "default",
      "VolumeOptions": { "NoCopy": false, "Labels": {}, "DriverConfig": {}, "Subpath": "storage/<P>/<N>/project" } },
    { "Type": "volume", "Source": "<DATA_VOLUME>", "Target": "/work/hermes-home",
      "ReadOnly": false, "Consistency": "default",
      "VolumeOptions": { "NoCopy": false, "Labels": {}, "DriverConfig": {}, "Subpath": "storage/<P>/<N>/hermes-home" } }
  ]
}
```

Implementation must NOT trust this sketch: capture a real `docker run --mount ...` create body against the fake/real daemon and commit it as the fixture (§9). The policy validates against the captured shape.

`/containers/<id>/json` inspect similarly reports `HostConfig.Mounts` (and `Mounts` at top level); the start-time equality check compares against `HostConfig.Mounts`.

## 4. Broker policy in volume mode

`PolicyConfig` gains `dataVolume?: string` (from `CO_WORKSPACE_DATA_VOLUME`). Mode = `dataVolume !== undefined`. Exactly one of the two storage validations is active per boot.

### 4.1 Create-body validation (`validateCreate`)

Volume mode branch replaces `validateBindShape` + `validateBindsOnDisk`:

- `HostConfig.Binds`, if present, must be null/`[]` (reject any bind — mixed Binds+Mounts is denied outright).
- `HostConfig.Mounts` is removed from `HC_FORBIDDEN` only in volume mode and must be an array of exactly 2 entries.
- Each entry is key-allowlisted; only these keys are accepted (extra key → reject):
  - `Type` (must be `"volume"` — reject `bind`, `tmpfs`, `npipe`, `image`, `cluster`)
  - `Source` (must equal `cfg.dataVolume` exactly — wrong volume → reject)
  - `Target` (must be `/work/project` or `/work/hermes-home`; duplicate target → reject; both targets present exactly once)
  - `ReadOnly` (must be `false` if present)
  - `VolumeOptions` (object; only key `Subpath` allowed inside; every other `VolumeOptions` key rejected)
  - All other keys (`Consistency`, `BindOptions`, `TmpfsOptions`, `ImageOptions`, `NoCopy`, `Labels`, `DriverConfig`, ...) → reject, even if the CLI sends them; the canonical rebuild drops whatever the client sent and re-emits only validated fields, so the forwarded body stays canonical (same invariant as today: raw body never forwarded).
- **Subpath regex** (the core check):

```ts
// <P> and <N> reuse PN_RE: /^(?!\.{1,2}$)[A-Za-z0-9@._+-]{1,128}$/
const SUBPATH_RE = /^storage\/((?!\.{1,2}$)[A-Za-z0-9@._+-]{1,128})\/((?!\.{1,2}$)[A-Za-z0-9@._+-]{1,128})\/(project|hermes-home)$/;
```

  The regex alone already rejects `..`, `.`, absolute (`/...` never matches `^storage/`), empty, backslashes, whitespace, and any traversal shape (`storage/a/../b/x` fails on the middle segment). Belt-and-braces: additionally reject any `Subpath` containing `..` or starting with `/` before the regex, for an explicit deny reason in logs.
- `principal` / `project` facts are derived from the subpath capture groups (bind mode derives them from the bind string; both feed the same facts interface).
- The canonical rebuild emits exactly:

```json
"HostConfig": { "Binds": null, "Mounts": [
  { "Type": "volume", "Source": "<DATA_VOLUME>", "Target": "/work/project",
    "VolumeOptions": { "Subpath": "storage/<P>/<N>/project" } },
  { "Type": "volume", "Source": "<DATA_VOLUME>", "Target": "/work/hermes-home",
    "VolumeOptions": { "Subpath": "storage/<P>/<N>/hermes-home" } }
] }
```

  (Everything else the CLI sent about mounts is dropped — the daemon fills defaults. This mirrors how the bind-mode rebuild already normalizes `:rw`.)

### 4.2 Start-time check

`handleStream` for `op === "start"` in volume mode: compare the inspect's `HostConfig.Mounts` deep-equal to the mounts recorded at create (new `CacheEntry.mounts`). Mismatch → 403 "mounts changed since create". `validateBindsOnDisk` is NOT called (no host paths exist). `sameBinds` generalizes to a mounts variant (or `semanticEqual` reuse).

### 4.3 Everything else unchanged

Route allowlist, one-request-per-connection parsing, ref resolution by label + name rewrite, list filtering, header rebuild — identical in both modes. `filterContainerList`, `checkRoute` untouched.

## 5. Volume initialization and ownership

Problem: a freshly created named volume is root-owned (`root:root`, 0700 root dir). Turn containers run as uid 10000 and cannot write into their subpath. The gateway runs as uid 10000 **without** docker access (only the broker holds the socket), so the gateway cannot chown.

**Chosen mechanism — broker-internal helper jobs with reserved names.** The broker (root inside its container, holds the raw socket) runs a short-lived helper container on the gateway's behalf:

- Helper image: `CO_WORKSPACE_VOLUME_INIT_IMAGE`, default `alpine:3.20`, pinned by digest in the compose override.
- Helper container name: `co-workspace-volctl-<8hex>` — deliberately does NOT match `NAME_RE`, so the gateway can never create, start, or list it (the policy only forwards turn-named refs); the broker itself spawns it via the socket directly, outside the policy path, with a fixed, non-gateway-controlled body.
- Two ops:
  - **init(subpath)**: `docker create --name <helper> --rm=false -v <vol>:/v <img> sh -c 'mkdir -p /v/<subpath>/project /v/<subpath>/hermes-home && chown -R 10000:10000 /v/<subpath> && chmod 700 /v/<subpath>'` + start + wait + delete. (mkdir first makes subpath-auto-creation behavior of the daemon irrelevant — deterministic across docker versions.)
  - **rm(subpath)**: same shape with `rm -rf /v/<subpath>` — required for tenant delete in volume mode (see §6).
- The subpath string passed to both ops is validated by the SAME `SUBPATH_RE` from §4.1 before any helper spawn — the helper argv is built only from validated components (no shell interpolation of raw input; the subpath goes into the helper's `sh -c` only after regex validation, and even then it is re-escaped or — preferred — passed as two fixed paths derived from the regex capture groups).

**Why not the alternatives** (recorded for review):
- *Gateway-side init container*: gateway lacks docker access by construction; granting it would undo the broker threat model.
- *Init container per turn create*: adds ~1–2 s and one container per turn for no benefit — ownership only changes on provisioning.
- *Bind-backed volume (`volume-opt o=bind,device=<hostpath>`)*: reintroduces a host path and with it the race; defeats the purpose.
- *userns-remap / rootless*: the true full fix (as today's design says) — out of scope here; volume mode reduces the exposed surface to the volume root only.

**Idempotency**: init is safe to re-run (mkdir -p + chown -R). The gateway calls init as the last step of `provisionTenant` in volume mode (replacing the `chownTree` calls), every time; no init-state registry needed. Failure → tenant status `failed` with the helper's stderr, same as any provisioning failure.

**Broker surface for the ops**: new broker control route, checked in `checkRoute` before the docker-path policy (explicitly NOT part of the endpoint allowlist comment §4 of the isolation compose):

```
POST /coworkspace/volume   body: {"op":"init"|"rm","subpath":"storage/<P>/<N>/<leaf>"}
```

- Available only in volume mode (bind mode → 403 always).
- Auth: requires header `X-Co-Workspace-Token` matching `CO_WORKSPACE_BROKER_TOKEN` when that env is set (compose override sets it on both sides; the internal `dockerapi` network is the primary control, the token is defense in depth).
- Response: 204 on helper success, 502 with helper stderr tail (capped) on failure.
- The route is reachable only from the `dockerapi` internal network (no published port) — same exposure model as the docker API routes themselves.

## 6. Gateway changes

### 6.1 Config (`src/config.ts`)

- `GatewayConfig.dataVolume?: string` (parsed + regex-validated when set). Volume mode requires `isolation === "docker"` and `CO_WORKSPACE_DATA_DIR_HOST` may remain set (bind-mode paths still used for gateway-local file access? — **No**: see 6.3; but leaving it set is harmless).
- Boot probe (`dockerIsolationProbe` equivalent) in volume mode additionally asserts `docker volume inspect <name>` succeeds, creating it if absent (`docker volume create` via the same CLI/broker path — the create goes through the broker's route policy; volume routes are currently 403, so the volume must either pre-exist or the probe is documented as operator-run; **decision**: operator runs `docker volume create` per the runbook, the probe only asserts existence and fails fast with a remediation message).

### 6.2 Turn spawn (`src/hermes.ts`)

- `HermesSpawnOptions.container` gains `dataVolume?: string; subpathBase?: string` (e.g. `storage/<P>/<N>`).
- `hermesSpawnArgv`: in volume mode, replace the two tenant `-v` flags with the two `--mount` flags of §3. The optional `sharedAuthDir` bind (legacy OAuth mode) is **not supported in volume mode** — spawn throws a clear error; volume mode requires provider-key credential mode (documented; keeps bind validation code exactly as-is and avoids a third mount shape). If a real deployment later needs it, the bind-mode policy already validates it and can be re-enabled.
- Facts for logging unchanged.

### 6.3 Lifecycle (`src/lifecycle.ts`, callers)

- `hostSidePath` (lifecycle.ts:107) and the `hostProjectDir`/`hostHermesHome` plumbing become bind-mode-only; in volume mode the gateway passes `dataVolume` + `subpathBase` instead (mount targets inside the container stay `/work/project` / `/work/hermes-home` regardless).
- `provisionTenant` in volume mode: replace the two `chownTree` calls with one broker `volume init` call (§5).
- `deleteTenantData` in volume mode: `rmSync` cannot reach into the volume. Sequence: quiesce → broker `volume rm(subpath)` → drop registry/history/locks. If the helper rm fails, keep the registry row with status `failed` + error (retryable), do NOT delete the record — mirrors today's "validate paths first, fail without touching state" ordering.
- `chownTree` itself is untouched (still used in bind mode).

### 6.4 File list (exact)

| File | Change |
|---|---|
| `services/co-workspace/src/docker-broker-policy.ts` | `PolicyConfig.dataVolume`; `loadPolicyConfig` parses+validates it; `SUBPATH_RE` export; `validateMounts` (volume-mode create validation + canonical rebuild); volume-mode branch in `validateCreate`; `CreateFacts` gains `mounts` (binds/mounts mutually exclusive per mode); `/coworkspace/volume` route decision in `checkRoute`; `HC_FORBIDDEN` handling becomes mode-dependent |
| `services/co-workspace/src/docker-broker.ts` | mode branch in `handleCreate` (skip `validateBindsOnDisk` in volume mode); `CacheEntry.mounts`; start-time mounts equality; `/coworkspace/volume` handler + helper-container runner (`runVolumeHelper(op, subpath)`) with pinned image + reserved name; token check on the control route |
| `services/co-workspace/src/config.ts` | `dataVolume` config + validation + volume-mode boot probe (`docker volume inspect` assert) |
| `services/co-workspace/src/hermes.ts` | `container.dataVolume`/`container.subpathBase`; `--mount` argv in volume mode; throw on `sharedAuthDir` + volume mode |
| `services/co-workspace/src/lifecycle.ts` | volume-mode branches in `provisionTenant` (init instead of chownTree) and `deleteTenantData` (helper rm instead of rmSync); `hostSidePath` annotated bind-mode-only |
| callers of `hermesSpawnArgv`/`hostSidePath` (`chat.ts` / route files) | pass volume+subpath in volume mode (mechanical; exact sites found via `graft callers hostSidePath` at implementation time) |
| `services/co-workspace/docker/docker-compose.volume.yml` | NEW (§7) |
| `services/co-workspace/docker/docker-compose.isolation.yml` | comment block updated: volume mode drops the RO data-dir mount + lstat walk; new control route documented; `CO_WORKSPACE_BROKER_TOKEN` / `CO_WORKSPACE_VOLUME_INIT_IMAGE` env pass-through |
| `services/co-workspace/docker/.env.sample` | `CO_WORKSPACE_DATA_VOLUME` sample + `COMPOSE_FILE` volume-mode line |
| `tests/fixtures/docker-cli/create-request-volume.json` | NEW: real CLI capture of the `--mount` create body (§9) |
| `tests/helpers/fake-docker-daemon.ts` | record + replay `HostConfig.Mounts` (§8) |
| `tests/` policy + hermes + e2e specs | test table (§8) |

## 7. Compose: `docker-compose.volume.yml`

Third override, layered after the isolation file:

```
COMPOSE_FILE=docker-compose.yml:docker-compose.isolation.yml:docker-compose.volume.yml
```

Contents:
- `docker-broker` service: drop the RO data-dir volume mount (override with `volumes: []` semantics via `!reset` tag or by listing only the socket — compose merge replaces list values); add env `CO_WORKSPACE_DATA_VOLUME: ${CO_WORKSPACE_DATA_VOLUME:?set the tenant data volume name}`, `CO_WORKSPACE_BROKER_TOKEN: ${CO_WORKSPACE_BROKER_TOKEN:-}`, `CO_WORKSPACE_VOLUME_INIT_IMAGE: ${CO_WORKSPACE_VOLUME_INIT_IMAGE:-alpine:3.20}`.
- `co-workspace` service: same `CO_WORKSPACE_DATA_VOLUME` env (gateway needs it for argv + lifecycle).
- **Env-parity rule (COMPOSE_EXEMPT consideration)**: both services must receive the variable; the parity check (if wired) lists `CO_WORKSPACE_DATA_VOLUME` as required in both when the volume override is active. Since compose env-parity is per-file, the override file itself declaring it for both services is the parity mechanism — no exempt entry needed.
- One-time setup command documented in the file header: `docker volume create <name>`.

## 8. Tests

- **Fixture**: capture the real volume-mode create body exactly like `create-request.json` was captured (run the gateway argv with `--mount` against a recording daemon or `docker run --rm --mount ... --dry-run`-equivalent via a socat tee); commit as `tests/fixtures/docker-cli/create-request-volume.json`. The policy test loads it through `validateCreate` and must pass. A hand-written body is NOT acceptable — the HC_DEFAULT_* shape proved version-specific last time.
- **Fake daemon**: `FakeContainer` gains `Mounts: unknown[] | null`; create records the create body's HostConfig.Mounts (or null when absent); inspect returns it; `requests` already records everything (no change needed there). A `hold`-style helper-path is not needed — helper containers are exercised via a dedicated unit test with an `override` reply for their create/start/wait.
- **Policy test table (volume mode)** — each row: reject with a specific reason:
  1. `Subpath: "../escape"`; 2. `Subpath: "/abs"`; 3. `Subpath: ""`; 4. `Subpath: "storage/p/n/../../x"`; 5. `Subpath: "storage/p/n/other"` (leaf not project|hermes-home); 6. `Subpath: "storage/../n/project"`; 7. `Source: "other-volume"`; 8. `Type: "bind"`; 9. `Type: "tmpfs"`; 10. third mount entry / missing hermes-home mount / duplicate target; 11. `Binds` present alongside `Mounts` (mixed → reject); 12. `VolumeOptions.Labels` or `DriverConfig` non-empty / extra `VolumeOptions` key; 13. `ReadOnly: true`; 14. top-level key `Consistency` present. Plus accept rows: the captured fixture; both targets with valid PN_RE edge names (`a.b@c+d`), and bind-mode regression (existing tests untouched and still green).
- **Broker tests**: start allowed when inspect Mounts == recorded; 403 when one Subpath mutated after create; `/coworkspace/volume` in bind mode → 403; token mismatch → 403; helper spawn argv built from regex capture groups (snapshot test).
- **Gateway tests**: `hermesSpawnArgv` volume mode emits the two `--mount` flags and no `-v` for tenant data; throws on `sharedAuthDir`+volume; provisioning calls init (mocked broker) instead of chownTree; delete calls rm and keeps the record on helper failure.

## 9. Live verification plan

Discipline as the raw-proxy work: isolated compose project, dummy provider env, no real credentials.

1. `docker volume create coworkspace-live-test`; `COMPOSE_FILE=...:docker-compose.volume.yml docker compose -p coworks-vol-test up -d`.
2. Provision a dummy tenant (provider-key mode, `OPENAI_API_KEY=dummy`); confirm: helper init container ran and exited 0; `docker volume inspect` + a helper `ls` shows `storage/<P>/<N>/{project,hermes-home}` owned by 10000:10000.
3. Run one turn; confirm the create body through the broker log matches the committed fixture shape; turn writes land inside the volume (`docker run --rm -v coworkspace-live-test:/v alpine ls /v/storage/...`).
4. Attack probes from a shell with broker network access: create with mutated `Subpath: ../x` → 403; `Source: other` → 403; mixed Binds+Mounts → 403; start after inspect-mount mutation (hand-crafted) → 403.
5. Symlink-in-volume probe: create a symlink inside `storage/<P>/<N>/project` pointing at `/etc` (via helper) and confirm the daemon resolves it within the volume base only (files appear inside the volume root, host `/etc` untouched) — the measured ground truth restated in situ.
6. Delete the tenant → helper rm runs, subpath gone, registry row gone.
7. Tear down: `docker compose -p coworks-vol-test down -v`, remove the test volume.

## 10. Migration runbook sketch (bind → volume)

1. Quiesce: stop the gateway (`docker compose ... stop co-workspace`) — no turns in flight.
2. Create the volume: `docker volume create <name>`.
3. Copy data (one-shot container, preserves uid 10000 ownership — copy with `cp -a` inside a container so host-side uid mapping on macOS does not rewrite ownership):
   `docker run --rm -v <DATA_HOST>/storage:/src:ro -v <name>:/dst alpine sh -c 'cp -a /src/. /dst/storage/'`
4. Switch env: set `CO_WORKSPACE_DATA_VOLUME=<name>`, extend `COMPOSE_FILE` with `docker-compose.volume.yml`, optionally set `CO_WORKSPACE_BROKER_TOKEN`.
5. Start with the volume override; boot probe asserts the volume exists.
6. Existing tenants keep working (subpaths copied verbatim); new tenants create new subpaths. The old host `storage/` is retained (read-only) until cutover is confirmed, then removed by the operator manually.
7. Rollback: remove the override + env, restart — bind mode is byte-for-byte unchanged; any turns run in volume mode persisted their data in the volume (copy back with the reverse `cp -a` if needed).

## 11. What stays true in bind mode / residual risk

**Bind mode is unchanged**: default when `CO_WORKSPACE_DATA_VOLUME` is unset; identical create validation (Binds allowlist + lstat walk + start re-check), identical compose files, identical fixtures and tests pass untouched. All volume-mode branches are gated on the config value, including `checkRoute` (the `/coworkspace/volume` route 403s in bind mode unconditionally).

**Residual risk after this change (volume mode)**:

| Risk | Status |
|---|---|
| Bind-source symlink TOCTOU (F3) | **Closed** for tenant data — no host path is named; subpath containment is daemon-enforced |
| Compromised gateway can still kill/delete turn containers, read tenant data via shared volume | Accepted (unchanged; gateway is trusted with its own tenants' data) |
| Helper image supply chain | Mitigated: pinned by digest, operator-configurable; helper runs with default (non-privileged) caps, volume-only mount |
| Gateway could request `volume rm` on another tenant's subpath | Same trust level as today's rmSync-on-known-paths; subpath regex + tenant-record lookup bind the subpath to the tenant being deleted; single-operator accepted |
| Shared auth dir in volume mode | Unsupported (provider-key mode required) — eliminates the last host-path bind rather than carrying it |
| Rootless Docker / userns-remap gap | Still the only fix for the *remaining* daemon-level trust assumptions; unchanged recommendation |
