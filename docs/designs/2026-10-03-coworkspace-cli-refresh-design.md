# co-workspace Baked-CLI Refresh Policy — 2026-10-03

**Date**: 2026-10-03
**Status**: Approved (Row 0 design; implementation lands in this wave)
**Spec id**: 2026-10-03-coworkspace-cli-refresh-design
**Scope**: services/co-workspace docker images; root CI (scheduled check)
**Problem**: the gateway image bakes four CLIs (hermes, claude, codex, agy). CLIs update on
vendor cadence (claude/codex near-weekly); a stale baked CLI drifts from protocol changes
and security patches. This design fixes the update mechanics.

## 1. Policy (per CLI)

| CLI | Source of truth | Update mechanism | "latest" allowed? |
|---|---|---|---|
| hermes | workspace checkout (`hermes-agent/`) | `build-runtime-image.sh` rsyncs the checkout into the runtime image; gateway base carries the image's hermes | n/a (checkout-driven) |
| claude | `@anthropic-ai/claude-code` npm | **pinned** in `docker/Dockerfile`, bump deliberately | no |
| codex | `@openai/codex` npm | **pinned** in `docker/Dockerfile`, bump deliberately | no |
| agy | Google installer script | pinned BY BUILD DATE — installer always fetches current; reproducibility caveat documented | unavoidable today (no versioned artifact URL) |

- P1 — **deliberate bump, never silent latest** (precedent: the Bun-pin policy, ADR-0094
  amendment — "bump deliberately, never latest"): pins change only through a reviewed PR
  whose body records the new version and the probe evidence (`--version` runs in-build).
- P2 — **weekly drift check**: a scheduled workflow compares the Dockerfile pins against
  `npm view <pkg> version` and, on drift, opens a GitHub issue naming old→new (the signal
  channel; the PM converts it to a workspace ticket — no auto-bump, no auto-merge).
- P3 — **rebuild runbook**: after merging a bump (or any CLI-affecting change), the operator
  refreshes the running stack with `docker/rebuild.sh --runtime` (rebuilds the gateway image
  AND the per-turn runtime image, which builds FROM the gateway image and inherits the CLIs).
  `--runtime` is required for turn-parity because sibling containers run the runtime image.
- P4 — **agy caveat**: the installer has no versioned artifact URL, so image rebuilds may
  pick up a newer agy than the previous build; recorded per-build via the in-image
  `agy --help` assertion. When Google publishes versioned artifacts, add a pin here.
- P5 — **in-container self-update is inert**: claude/codex/agy may attempt background
  self-update inside ephemeral turn containers; the writes die with the container and the
  gateway container's copies are root-owned read-only paths for uid 10000 — the baked pin
  stays authoritative.

## 2. Implementation

- `/.github/workflows/cli-version-drift.yml`: weekly cron (Mon 03:00 UTC), ubuntu,
  extracts the two npm pins from `services/co-workspace/docker/Dockerfile`, compares with
  `npm view`, `gh issue create` on drift (idempotent: searches for an existing open issue
  with the same title prefix first).
- README: the runtime matrix gains a "CLI refresh" paragraph (P2/P3 runbook).

## 3. Non-goals

- Auto-bump PRs / auto-merge (P1 forbids).
- Renovate/Dependabot integration (the pins live in a Dockerfile RUN line, not a manifest;
  the drift check is the lighter fit).
- Runtime auto-update inside turn containers (P5).

## 4. Verification

Workflow YAML parse; drift-check logic exercised locally against the current pins (no drift
today = no issue opened; a forced-drift dry run validates the comparison branch).
