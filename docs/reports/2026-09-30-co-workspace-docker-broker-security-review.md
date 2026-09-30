# co-workspace Docker Broker — Adversarial Security Review — 2026-09-30
**Date**: 2026-09-30
**Scope**: `services/co-workspace/src/docker-broker.ts` (create-body-validating Docker socket broker merged in PR #1253 for T-20260930-008), its tests, its compose wiring (`docker/docker-compose.isolation.yml`), and how the gateway builds `docker run` (`src/hermes.ts`).
**Method**: security-expert role (opus), read-only code review under the threat model "the gateway container is compromised and can send any HTTP request to `tcp://docker-broker:2375`". The PM re-read the code for the four headline findings (F1, F2, F4, F10) and the test gap; the remaining findings and all live checks are **not yet confirmed**. Docker Desktop was not running when this was written, so nothing was run live.
> Analysis only — no files modified in this report.

## Headline

The create-body policy is a **partial denylist**: it inspects about ten fields by exact key, then forwards the **original, unvalidated request text** to the daemon. Go's JSON decoder in the Docker daemon matches keys case-insensitively and keeps the last duplicate, so a crafted body can pass the broker's check and still set privileged options. Separately, the broker very likely does not work with the real `docker` CLI (versioned API paths, `User` in the wrong place), so it was probably never exercised with real traffic. Its unit tests encode the same misconceptions, so they pass without proving safety.

Consequence for the current `main`: with `docker-compose.isolation.yml` the gateway talks to this broker. Real turns most likely fail closed (403) and, for a hostile gateway, the policy is bypassable. The previous tecnativa-proxy configuration (PR #1246) was live-verified; the broker was not.

## Findings

Status legend: **read** = confirmed by reading the code (PM re-read for F1, F2, F4, F10); **live** = needs a run against the daemon.

| # | Severity | Attack / defect | Where | Status | Fix |
|---|---|---|---|---|---|
| F1 | Critical | **Case-insensitive key smuggling.** The check reads `HostConfig.Privileged` by exact key, but the daemon decodes case-insensitively and keeps the last duplicate. A body with a valid `HostConfig` plus `"hostconfig":{"privileged":true,"binds":["/:/host"]}` passes the check and reaches the daemon. The forwarded body is `raw`, not the validated object. | `docker-broker.ts` create branch (`body: raw`), `validateCreateBody` | read (daemon behavior: live) | Parse, then **rebuild a canonical body from an allowlist** and forward the re-serialized object; reject any key outside the allowlist, compared case-insensitively. |
| F2 | Critical | **`CapAdd` and profile disable.** Only `CapDrop` containing `ALL` and `SecurityOpt` *containing* `no-new-privileges` are required. `CapAdd:["SYS_ADMIN","SYS_PTRACE","DAC_READ_SEARCH"]` is applied after drop-ALL, and `SecurityOpt` may add `seccomp=unconfined`, `apparmor=unconfined`, `label=disable`. | `validateCreateBody` | read | Require `CapAdd` absent or empty; require `SecurityOpt` to equal exactly `["no-new-privileges"]`. |
| F3 | Critical | **Bind source via `..` or symlink.** Sources are checked with a string `startsWith(<data dir>/)`; nothing is canonicalized. `Binds:["<DATA>/../../:/host"]` is rejected only if the daemon does not clean the path (it does). The gateway also has `<DATA>` mounted read-write, so it can create `ln -s / <DATA>/x` and bind `<DATA>/x`; the daemon resolves the symlink on the host. | `validateCreateBody` (Binds, Mounts) | read for `..`; live for symlink | Reject `..`, `.`, `//`, non-absolute sources. A string check cannot stop symlinks in an attacker-writable directory: pin binds to the exact per-tenant paths the gateway legitimately sends and reject symlinks on a read-only view, or use rootless Docker / userns-remap so a host-root mount is harmless. |
| F4 | Critical | **`User` checked in the wrong place.** The broker requires `HostConfig.User === "10000:10000"`, but `User` is a top-level field of the create body (`Config.User`); `HostConfig` has no `User`. An attacker sets `HostConfig.User` to satisfy the check and top-level `User:"0:0"`. The real CLI sends the top-level `User`, so it would be rejected. | `validateCreateBody`; `tests/unit/co-workspace-docker-broker.test.ts` lines 25 and 84 | read | Check `body.User` exactly and reject `HostConfig.User`; fix the tests. |
| F5 | High | **Namespace joins.** Only `PidMode`/`NetworkMode` equal to `"host"` are blocked. `PidMode:"container:<victim>"`, `NetworkMode:"container:<victim>"`, `IpcMode`, `UTSMode`, `UsernsMode`, `CgroupnsMode` are unchecked. | `validateCreateBody` | read | Require these absent/default; require `NetworkMode` in `{default, bridge}`. |
| F6 | High | **`VolumesFrom`** mounts every volume of any container on the daemon; there is no name scoping on it. | not checked | read | Reject `VolumesFrom`, `Links`, `DeviceCgroupRules`, `DeviceRequests`. |
| F7 | High | Other unchecked host-affecting fields: `Sysctls`, `CgroupParent`, `Runtime`, `PortBindings`/`PublishAllPorts` (publishes a turn container on host interfaces), `ExtraHosts`, `Ulimits`, `Mounts[].BindOptions.Propagation`, `Mounts[].Type: tmpfs`; `Devices` only rejected when a non-empty array. | `validateCreateBody` | read | Strict allowlist schema over exactly the fields the CLI emits. |
| F8 | Medium | `Memory`/`PidsLimit` only need to be greater than 0; `1e15` passes. `NanoCpus` is not required. | `validateCreateBody` | read | Enforce maxima equal to the configured caps. |
| F9 | Medium | **Label forgery** (`co-workspace.tenant=<other>`) can confuse attribution. Low impact because the reaper scopes by name prefix. | `src/reaper.ts` | needs review | Overwrite `Labels` with the expected set. |
| F10 | Medium (functional, fail-closed) | **Versioned paths are not handled.** The docker CLI calls `/v1.xx/containers/create`, `/v1.xx/containers/json` and `HEAD /_ping`; the allowlist matches only unversioned paths and `GET /_ping`. Together with F4 the gateway cannot start a turn under the isolation compose. Whoever fixes this must strip `/vX.Y` **before** the policy decision and forward the normalized path. | `isAllowedRequest` | read (no `/v1.` handling in the file) | Strip `^/v\d+\.\d+` before the policy check; add a test using real CLI traffic. |
| F11 | Medium | **Path-encoding confusion.** The container ref is `decodeURIComponent`-ed for the prefix check while the raw path is forwarded (`co-workspace-turn-x%2F..%2F..%2Fexec`). | `isAllowedRequest`, forwarding | live | Match the raw segment against `^co-workspace-turn-[A-Za-z0-9_.-]+$` and reject `%` in paths. |
| F12 | Low | Headers are forwarded as-is (`Connection`, `Transfer-Encoding`, `Host`); `req.text()` on create is unbounded (memory DoS); `attach` streaming probably does not work with Bun fetch over a unix socket. | forwarding | live | Drop hop-by-hop headers, cap the body (64 KB), implement or drop `attach`. |
| F13 | Low | `GET /containers/co-workspace-turn-*/json` returns the turn's `Env`, including a provider key passed as `-e NAME` (resolved into `Config.Env`). Cross-tenant within the fleet. | inspect branch | read | Redact `Config.Env` in the response. |
| F14 | Info | Image check is exact when a tag is configured; with no tag any tag/digest of the repo is accepted; combined with F1 a lower-case `"image"` key wins. | `validateCreateBody` | read (F1 variant) | Covered by the canonical rebuild. |

## Verified safe (by reading code)
- The endpoint allowlist is default-deny: exec, rename, update, restart, pause, stop, export, archive, commit, images, volumes, networks, build are 403.
- The create name comes from the `?name=` query and must start with `co-workspace-turn-`; container refs by hex ID are rejected; upstream errors return 502 and never forward unfiltered; invalid JSON returns 400; an unset `CO_WORKSPACE_DATA_DIR_HOST` rejects every create.
- The container list is filtered to the fleet for the whole response regardless of `all`/`filters`/`limit`/`size`.
- Compose: the broker drops all caps, is read-only with `no-new-privileges`, sits on an `internal: true` network with no published port, and the gateway has no socket mount. Note the `:ro` on a unix socket does not restrict API calls, and the broker runs as root.

## Test gap
Covered today: allowlist 403s, prefix scoping, basic rejections (Privileged, HostConfig.User, bind outside the data dir), unset data dir, list filtering. Missing: `CapAdd`, extra `SecurityOpt`, `..` and symlink sources, case-variant keys, `VolumesFrom`, `container:` namespace modes, top-level `User`, versioned paths, `%2F` refs, body size, and any test replaying a real docker CLI create body.

## Live confirmation plan (from inside the gateway container)
Base body `V`: `{"Image":IMG,"Cmd":["id"],"HostConfig":{"CapDrop":["ALL"],"SecurityOpt":["no-new-privileges"],"User":"10000:10000","Memory":268435456,"PidsLimit":64}}`; create with `POST /containers/create?name=co-workspace-turn-t<N>`; a 201 means the bypass works; inspect with `GET /containers/co-workspace-turn-t<N>/json`; remove with `DELETE ...?force=1`.
- **L1 (F1)**: `V` with an extra `"HostConfig"` key `"privileged":true`; inspect `HostConfig.Privileged`.
- **L2 (F2+F4)**: top-level `"User":"0:0"`, `HostConfig.CapAdd:["SYS_ADMIN"]`, `SecurityOpt` with `seccomp=unconfined`; inspect `Config.User`, `HostConfig.CapAdd`.
- **L3 (F3 `..`)**: `Binds:["<DATA>/../../:/host:ro"]`; inspect `Mounts[0].Source`.
- **L4 (F3 symlink)**: `ln -s / <DATA>/pwn` from the gateway, then bind `<DATA>/pwn:/host:ro`; read a marker file through a second bind.
- **L5 (F5/F6)**: `VolumesFrom` and `PidMode:"container:<name>"` naming an existing container.
- **L6 (F10/F11)**: `GET /v1.45/containers/json` (expect 403 = versioned paths broken); `POST /containers/co-workspace-turn-x%2F..%2F..%2Fimages%2Fjson`; and a real `DOCKER_HOST=tcp://docker-broker:2375 docker run --name co-workspace-turn-probe ...` with the `src/hermes.ts` argv.
- Cleanup: remove the test containers and `<DATA>/pwn`.

## Recommended remediation order
1. Until fixed, do not run `docker compose up` with `docker-compose.isolation.yml` from `main` expecting working docker isolation; the last live-verified configuration is PR #1246 (tecnativa proxy).
2. Fix F1, F2, F4 and F10 together (canonical allowlist rebuild, exact `SecurityOpt`/`CapAdd`, top-level `User`, version-prefix stripping), then F3 (path containment, and the symlink strategy), F5–F7, and the remaining items.
3. Replace the broker unit tests with cases from the table above, and add a test that replays a real docker CLI create request: point the CLI at a small fake daemon socket that records the HTTP request the `docker run` argv from `hermesSpawnArgv` produces (path with API version, headers, JSON body), then feed that recording to the broker policy.
4. Run the live plan above on a machine with Docker before merging.

## F3 closure note (2026-09-30, T-20260930-038)

Finding F3 (bind-source symlink TOCTOU) is closed for tenant data by the opt-in volume-subpath mode: setting `CO_WORKSPACE_DATA_VOLUME` moves tenant storage into a named Docker volume and turn containers mount `storage/<P>/<N>/...` via `--mount type=volume,...,volume-subpath=...`, so no host path is ever named to the daemon and the check-to-mount race has nothing to race. Containment is daemon-enforced and was measured live on dockerd 29.8.1: `..` and absolute subpaths are rejected at create, and a symlink planted inside the volume at the mounted subpath makes the mount fail with "path concatenation escapes the base directory" rather than resolving outside the volume. The default bind mode is unchanged and retains the accepted F3 residual (the lstat walk narrows the window to milliseconds but cannot close it); rootless Docker or userns-remap remains the only full daemon-level fix. Design: `docs/designs/2026-09-30-coworkspace-volume-subpath-design.md`; ADR-0092 Addendum 14.
