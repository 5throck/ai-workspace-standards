---
schemaVersion: 1.0.0
spec-id: 2026-09-20-graft-scaffold-resilience
---

# Graft Scaffold Resilience Design

## 1. Overview

New projects scaffold with the full graft surface (AGENTS.md instruction block,
`.mcp.json` entry, hooks, gitignore rules) but start without a graft graph on
machines where the `bunx` install path fails. On 2026-09-20 an E2E scaffold
verification on Windows reproduced the failure:

- `bunx @nanonets/graft build` exits non-zero. The fresh install dies at the
  `tree-sitter-kotlin` postinstall script. A failed install leaves a partial
  package in the bunx temp cache. Later bunx calls reuse that cache and fail
  with `MODULE_NOT_FOUND`.
- The scaffold graft steps (`new-project.ts` §7.7, `create-l3-scaffold.ts`
  Step 8.5) are warn-and-continue by design, so scaffolding succeeds while the
  ADR-0076 goal ("give the fresh project its graph right away") silently fails.
- The template `.mcp.json` launches the MCP server through the same broken
  `bunx` command, so graft MCP tools do not appear on affected machines.
- ZCode reads `.zcode/config.json` or `.agents/mcp.json`, not `.mcp.json`.
  The template ships neither, so ZCode sessions in new projects have no graft
  MCP at all.

The globally installed `graft` binary (0.18.0) works on the same machine and
built the identical project tree in seconds. This design makes the global
binary the primary path and keeps `bunx` as the fallback.

## 2. Changes

### C1 — Scaffold graft build: `graft` first, `bunx` fallback

Both scaffold entry points try the global `graft` binary before `bunx`:

- `scripts/new-project.ts` §7.7
- `scripts/create-l3-scaffold.ts` Step 8.5

Behavior: run `graft build`. On success, continue. On failure or spawn error,
run `bunx @nanonets/graft build`. On a second failure, keep the existing
non-fatal warning. The warning names both commands.

### C2 — Template `.mcp.json` launches `graft` directly

`templates/common/.mcp.json` changes the graft server command from
`bunx @nanonets/graft mcp` to `graft mcp`, matching the workspace root
`.mcp.json`. A JSON config cannot express a fallback, so the command must be
one value; the globally installed binary is the reliable one.

### C3 — Template ships `.ignore`

`templates/common/.ignore` carries the graft-generated content verbatim
(re-admit `graft/` cards to ripgrep search, exclude `graft/.cache/` and
`graft/.graph/`). New projects then track the file from the first commit.
This matches the state promoted to all eight live projects on 2026-09-20.

### C4 — Template ships `.agents/mcp.json` (ZCode/Antigravity fallback)

`templates/common/.agents/mcp.json` registers the graft MCP server with the
top-level `mcpServers` key. ZCode and Antigravity read this file when the
same-scope `.zcode` config defines no MCP servers, so new projects get graft
MCP in those hosts without manual setup.

## 3. Requirements

- R1: The scaffold must run `graft build` before `bunx @nanonets/graft build`.
- R2: A failed primary attempt must fall back to `bunx` without stopping the scaffold.
- R3: The template `.mcp.json` must launch the graft server with the `graft` command.
- R4: The template must ship `.ignore` with the graft search-admission content.
- R5: The template must ship `.agents/mcp.json` registering the graft server.

## 4. Acceptance Criteria

- AC1: A fresh scaffold on a machine with global `graft` produces `graft/INDEX.md` and `.ignore` at creation time.
- AC2: On a machine without global `graft` but a healthy `bunx`, the scaffold still builds the graph.
- AC3: The scaffolded project's `.mcp.json` names `graft` as the server command.
- AC4: The scaffolded project contains `.ignore` and `.agents/mcp.json`.
- AC5: `bun scripts/validate-templates.ts` and the post-scaffold audit pass.

## 5. Non-Goals

- Changing the eight live projects. `upgrade-project` delivers template changes later.
- Fixing the upstream `tree-sitter-kotlin` install failure.
- Pinning a graft version in the template.

## 6. Trade-offs

- **PATH dependency (C2, C4):** the `graft` command requires a global install
  (`bun i -g @nanonets/graft`). The scaffold keeps a `bunx` fallback (C1), and
  onboarding docs already treat the global install as standard. Machines that
  skip the install lose MCP only; the CLI path still self-heals the graph.
- **No per-host validation (C4):** `.agents/mcp.json` cannot carry a Windows
  absolute path in a shared template. Hosts that fail to resolve `graft` from
  PATH show a failed server entry; the file remains correct for hosts that do.
- **Duplicate sources of truth for `.ignore`:** graft regenerates this file on
  `graft build`. The template copy and the generated copy are byte-identical,
  so no drift is expected.

## 7. Exemptions

- Accessibility (ADR-0065): exempt. This change touches scaffold scripts and
  JSON/YAML config templates only. No user-facing UI exists in scope.
- Preview Verification (ADR-0070): exempt. No web/app UI is changed.

## 8. Test Plan

1. Run `bun scripts/validate-templates.ts`.
2. Scaffold a disposable project (`new-project.ts`, co-develop variant).
3. Verify: `graft/INDEX.md` exists, `.ignore` exists, `.mcp.json` names
   `graft`, `.agents/mcp.json` exists, `graft ask` answers.
4. Delete the disposable project.
