---
status: "Accepted"
---

# ADR-0001: Adopt Bun as the Single Package Manager

**Status**: Accepted
**Date**: 2026-08-25
**Deciders**: pm, devops-admin, lead-architect

## Context

The repository carried **two lockfiles simultaneously** (`bun.lock` and
`package-lock.json`) with no declared source of truth — a standing drift risk.
Meanwhile the parent `ai_workspace` standardizes on bun (`bun run scripts/*.ts`
governance tooling, `bun.lock` at workspace root), so every governance interaction
crossed a package-manager boundary.

Historical context from memory logs (2026-05-25): hybrid `.cmd`/`.ps1`/`.sh`
scripting was already consolidated once before; npm/bun duality was the remaining
hybrid.

## Decision

1. `bun.lock` is the **single lock source**; `package-lock.json` is deleted.
2. All documentation and scripts reference bun commands (`bun install`, `bun run`,
   `bunx prisma`).
3. The Dockerfile keeps its three-stage shape but installs dependencies via
   **bun on a Node base image** (`COPY --from=oven/bun:1` binary onto
   `node:22-alpine`, then `bun install --frozen-lockfile`). Builder/runner stages
   remain Node 22 because Next standalone output executes on Node.
4. `scripts/setup.ts` runs `bun install`, then `prisma generate` and `prisma db push`.

## Alternatives Considered

- **Stay on npm**: rejected — permanent drift against the workspace toolchain and
  two-lockfile ambiguity.
- **Bun end-to-end including runtime container**: rejected for now — Next
  standalone server targets Node; switching runner images is a separate,
  higher-risk decision.

## Consequences

- Faster installs; one lockfile to audit; `upgrade-project.ts` and other
  workspace tooling run natively against this project.
- Native module (`better-sqlite3`) must be verified per platform after install —
  covered by the vitest gate (40/40 green post-migration).
- `next start` is invalid under standalone mode regardless of manager; docs now
  state `node .next/standalone/server.js`.
