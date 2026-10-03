# co-workspace Docker-Isolated Turns for Non-Hermes Runtimes — 2026-10-03

**Date**: 2026-10-03
**Status**: Approved (Row 0 design; implementation lands in this wave)
**Spec id**: 2026-10-03-coworkspace-sibling-turns-design
**Scope**: services/co-workspace (docker-broker policy, spawn layer, provisioning)
**Context**: T-20261003-025 — the last delivery gap from T-20261003-023. Predecessors: `2026-10-03-coworkspace-cli-provider-key-design` (credential model; the gateway image now bakes claude/codex, so the runtime image — which builds FROM the gateway image — inherits them), raw-proxy broker design (policy architecture).

## 1. Problem

Docker-isolated sibling turns run hermes only: the broker create-body policy pins `Entrypoint` to `cfg.hermesBin`, requires the hermes env pairs, and allows exactly the `project`/`hermes-home` binds. A non-hermes runtime cannot run an isolated turn even though the image now carries the CLIs — the only multi-user isolation boundary (docker mode) is unavailable to them.

## 2. Requirements

- R1: docker-isolated turns work for the claude and codex runtimes under the SAME security properties as hermes turns (canonical body rebuild, fixed working dir, uid 10000, caps dropped, mounts equality re-checked at start, lstat walks at create).
- R2: the broker policy stays entrypoint-driven and fail-closed: an entrypoint outside the allowlist is rejected; each runtime gets its own fixed env contract and home mount; nothing client-supplied is trusted beyond the validated fields.
- R3: the credential-bearing hermes home is NEVER mounted into a non-hermes container; each runtime mounts only its own per-tenant home.
- R4: antigravity remains excluded from docker isolation (no verifiable Linux artifact; login-only) — fail-fast retained, message updated.
- R5: both bind mode and volume-subpath mode are supported, extending (not replacing) the existing validation.
- R6: hermes behavior is byte-identical — the existing pinned hermes spawn/policy tests pass unchanged and prove the refactor.

## 3. Design

- D1 — **Entrypoint allowlist** (broker): `Entrypoint[0]` ∈ {`cfg.hermesBin`, `"claude"`, `"codex"`} (fixed constants — the runtime image carries exactly these three). The entrypoint selects the runtime profile; `agy` is rejected by absence.
- D2 — **Runtime-home mapping** (single source): entrypoint → home leaf + in-container path + required env pairs:
  - `hermes` → `hermes-home`, `/work/hermes-home`, `HERMES_HOME=/work/hermes-home` + `HERMES_ACCEPT_HOOKS=1` (unchanged)
  - `claude` → `claude-home`, `/work/claude-home`, `CLAUDE_CONFIG_DIR=/work/claude-home`
  - `codex` → `codex-home`, `/work/codex-home`, `CODEX_HOME=/work/codex-home`
  Env values are FIXED (client cannot set them); `≤1` provider key stays universal; `claude` additionally allows an optional `ANTHROPIC_BASE_URL` validated as a strict `https://` URL (≤300 chars, no whitespace/quotes/backslashes) for custom endpoints. No other env names.
- D3 — **Mounts**: exactly 2 as today — `/work/project` + `/work/<home-leaf-of-entrypoint>`. The hermes home is NOT mounted for claude/codex (R3). `SUBPATH_RE` leaf set extends to `project|hermes-home|claude-home|codex-home`; `validateBindShape`/`validateMounts` require the home leaf/target to match the entrypoint's mapping.
- D4 — **Provisioning**: tenant provisioning creates `claude-home` + `codex-home` (empty, mode 700, uid 10000 in docker mode) alongside `hermes-home`, so bind sources exist for the broker's lstat walk and volume subpaths exist for the daemon's start-time lstat; the volume-init helper `mkdir -p` extends to all four leaves.
- D5 — **Spawn layer**: `hermesSpawnArgv` refactors into an exported generalization `turnSpawnArgv` (entrypoint, inner argv, container, home leaf/mount/source, fixed env pairs, provider key, hermes-only shared-auth block); `hermesSpawnArgv` delegates with hermes values — the existing pinned hermes argv tests prove byte-identity. The claude/codex adapters gain an optional `container` (same shape, plus `hostRuntimeHome` for the per-runtime home source) and build their docker argv via the same generalization; stdin stays `ignore` (message goes via argv, unlike hermes's stdin query).
- D6 — **chat.ts**: passes the container config for claude/codex when isolation=docker (same name/labels/resource-caps shape as hermes turns; provider key via bare `-e NAME`; `ANTHROPIC_BASE_URL` as a literal `-e NAME=value`). The kill-by-name contract (`onSpawn`) applies to all three.
- D7 — **Fail-fast**: `CO_WORKSPACE_ISOLATION=docker` + `runtime=antigravity` still exits with remediation; claude/codex now proceed.
- D8 — **Runtime image**: no change — it builds FROM the gateway image and inherits the baked CLIs; the README notes `build-runtime-image.sh` picks them up.

## 4. Security notes

The policy remains canonical-rebuild-from-allowlist: the new surface adds three fixed env names with fixed values, one URL-validated optional env, and one extra home leaf derived from the entrypoint — no free-form client data. The container name/labels/resource-caps contracts are unchanged and shared across runtimes. Credential exposure per container shrinks vs hermes (its own home only, provider key via env).

## 5. Test plan

- Broker policy: claude/codex create bodies pass in bind AND volume mode; entrypoint `agy`/unknown rejected; home-leaf mismatch vs entrypoint rejected; `ANTHROPIC_BASE_URL` non-https/oversized rejected; hermes fixtures unchanged.
- Spawn: existing hermes argv pins green after the refactor (byte-identity); new containerized claude/codex argv builders tested pure (labels, entrypoint, mounts, env, provider key).
- Provisioning: runtime homes created + chowned.
- Full battery + service typecheck.

## 6. Verification

Honesty boundary: policy and argv verified by tests; a LIVE isolated claude/codex turn (real key, real broker) is not verifiable in this session — recorded as such in the README matrix and ticket result.

## Part C — antigravity status after the user-provided installer (2026-10-03)

The gateway image bakes the agy binary (Google's official installer; see the
cli-provider-key design Part C). Docker-isolated antigravity turns REMAIN blocked in the
broker policy (`agy` is not in RUNTIME_TURN_PROFILES): the CLI has no API-key credential
surface, and the only credential path into a sibling container — mounting operator login
state — is a SEC-07-class exposure. The fail-fast at boot names this. Enabling it later
requires either an upstream API-key mode or a reviewed credential-broker design.
