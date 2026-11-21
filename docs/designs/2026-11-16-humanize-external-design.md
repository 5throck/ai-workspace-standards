# Humanize as a declared co-work external — Korean AI-tell and translationese detection and polishing — design

> **CORRECTED (2026-11-21, owner decision)** — the `im-not-ai` entry (§2.2) must **not**
> be installed: the owner ruled that the external dependency is 5throck/Humanize only,
> and `epoko77-ai/im-not-ai` is never installed as a project dependency (its rulebook and
> prompt are already ported inside Humanize's `rules.js`/`prompt.js`). The pin `v1.0.0`
> noted in §2.1 as "does not exist yet" now exists (tag `v1.0.0`, commit `4860b0ec45a68d1be031f120e6d3fd5219569bc9`).
> Reference: Projects/co-newbiz `docs/designs/2026-11-21-humanize-server-migration-design.md`
> (the first production migration onto the Humanize server interface).

- **Spec ID**: 2026-11-16-humanize-external-design
- **Status**: Approved (PM, 2026-11-16) — implementation in templates/co-work only
- **Date**: 2026-11-16
- **Owner**: architect (design only); implementation dispatched by PM to automation-engineer
- **Builds on (does NOT replace)**: docs/designs/2026-11-07-external-deps-standard-design.md (status `implemented`, docs/specs/registry.json:3060-3067) and docs/designs/2026-11-07-external-deps-machinery-design.md
- **Upstream tickets**: U-20261116-003, U-20261116-005
- **Tiers**: L0 (no change; machinery already live) · L2 (templates/co-work seed and adapter) · L3 (delivery by upgrade visits only)

## 1. Problem

The co-deck keynote review on 2026-11-16 found translationese and internal-wording
defects in the authored Korean deck text. A Korean AI-tell checker exists
(Humanize), and co-deck already calls it. But nothing declares it, pins it, or
installs it:

- `templates/co-deck/skills/storyline/SKILL.md:50-66` (Step 1.6) runs an optional
  lint with `POST http://localhost:8765/api/analyze`. It skips silently when the
  server is unreachable. No project can reproduce the server it expects.
- Humanize's rulebook comes from im-not-ai (Humanize `README.md:7`). Its agent family
  (`humanize-monolith` and related agents) lives only in personal global agents, so
  it cannot be reproduced per project.

The schema v2 external-deps standard covers this case. That standard is
`scripts/lib/external-deps.ts` plus the `scripts/external-deps.ts` CLI, with the
co-work seed `templates/co-work/external-deps.json` that already pins `ppt-master`.

## 2. Decision

Add two entries to `templates/co-work/external-deps.json`, next to `ppt-master`.
They share one adapter.

### 2.1 Entry `humanize`

| Field | Value |
|---|---|
| repo | `https://github.com/5throck/Humanize` (reference clone: `/Users/techcross/git/project/Humanize`) |
| pin | `v1.0.0` (**does not exist yet**, see §6) |
| commit | omitted until the first install records it |
| install_dir | `external/humanize` |
| license | `MIT` (Humanize `LICENSE:1`), allow class, so no `license_decision` |
| usage | `as-is` |
| propagation | `never` |
| adapter | `scripts/humanize/humanize-adapter.ts` |
| compatibility_test | `bun scripts/humanize/humanize-adapter.ts selftest` |
| consumer | Korean text lint and polish (co-work authoring; co-deck Step 1.6 by opt-in) |

What it supplies: the offline rule engine `rules.js` and the HTTP server `serve.ts`.
The server's default port is 8765 (`serve.ts:41`, overridable with `--port` or
`PORT`). Its deterministic routes are `/api/analyze`, `/api/polish`, `/api/prompt`,
`/api/chunk` and `/api/merge` (`serve.ts:524`, `serve.ts:604-608`). The upstream
test suite runs with `bun test.mjs`.

### 2.2 Entry `im-not-ai`

| Field | Value |
|---|---|
| repo | `https://github.com/epoko77-ai/im-not-ai` |
| pin | `v2.4.4` |
| commit | `333b35c18d99c34b31c7e1ebfef1931c075b649b` |
| install_dir | `external/im-not-ai` |
| license | `MIT`, allow class |
| usage / propagation | `as-is` / `never` |
| adapter | `scripts/humanize/humanize-adapter.ts` (shared) |
| compatibility_test | `bun scripts/humanize/humanize-adapter.ts selftest` |

What it supplies: the `humanize-monolith` agent family (`agents/humanize-monolith.md`
and related files), the rulebook
`skills/humanize-korean/references/ai-tell-taxonomy.md`, and the quick-rules header
and footer. Humanize says its own rules are built on this repo (`README.md:7`,
`README.md:152`).

### 2.3 Shared adapter `scripts/humanize/humanize-adapter.ts`

The adapter lives outside both install dirs. It is the only code path that touches
either clone.

| Subcommand | Behavior |
|---|---|
| `paths` | Print the resolved absolute paths of the im-not-ai agent files and rulebook, and the Humanize `serve.ts` and `rules.js`. |
| `serve [--port N]` | Start `external/humanize/serve.ts` with `bun` (default port 8765). |
| `analyze <file>` | POST `{ text }` to `<base>/api/analyze`. `<base>` is `$HUMANIZE_URL`, or `http://localhost:8765` when unset. Print the finding count and the top patterns. If the server is unreachable, print `lint unavailable` and exit 0. |
| `selftest` | Offline check that the expected clone files exist (`serve.ts`, `rules.js`, `ai-tell-taxonomy.md`, `agents/humanize-monolith.md`). No network, no server. |

### 2.4 Invariants

1. Agents never edit files inside `external/humanize` or `external/im-not-ai`
   (`usage: as-is`).
2. Vendoring either clone into `templates/` is forbidden. The
   `external-dep-vendoring` FAIL arm of `scripts/validate-templates.ts` (check at
   line 3410) enforces this.
3. A failed scaffold fetch only warns. `scripts/new-project.ts` uses the WARN
   posture, and only `--strict-external-deps` turns it into an error
   (`new-project.ts:2225`). So a missing `v1.0.0` tag degrades new projects to a
   warning, not a broken scaffold.
4. Lint is advisory. It never blocks a build.

## 3. Alternatives considered

| Option | Verdict | Reason |
|---|---|---|
| Vendor the rules into co-deck | Rejected | Drifts from upstream and trips the vendoring guard |
| Global `~/.claude` agents only | Rejected | Not reproducible per project and not pinned |
| im-not-ai only | Rejected | It has no server, so Step 1.6 has nothing to call |
| Humanize MCP server (`mcp-server.mjs`) | Deferred | A possible later option, once the pinned clone is in place |

## 4. Consumption by co-deck (Step 1.6)

This design does not change co-deck. A co-deck project that wants the lint does the
following:

1. Add the same `humanize` entry to its own `external-deps.json`. Alternatively, it
   gets the entry if co-deck later extends its seed.
2. Run `bun scripts/external-deps.ts install`.
3. Start the server with `bun scripts/humanize/humanize-adapter.ts serve`.
4. Step 1.6 then runs `bun scripts/humanize/humanize-adapter.ts analyze slide_deck.md`
   in place of the raw `curl`.

The step stays optional and never blocks a build. **Suggestion (not part of this
design's scope):** a later change could extend `templates/co-deck/external-deps.json`
and swap the Step 1.6 `curl` for the adapter call.

## 5. Implementation scope (templates/co-work only)

- `templates/co-work/external-deps.json`: add the two entries in §2.1 and §2.2.
- `templates/co-work/scripts/humanize/humanize-adapter.ts`: new file, as in §2.3.
- Verify with `bun scripts/external-deps.ts verify` and `bun scripts/validate-templates.ts`
  (the vendoring arm must stay clean). Run `bun scripts/audit.ts`.
- Do not touch workspace-root files or other variants in the same change
  (CLAUDE.md §9).

## 6. Open items

1. **Tag `v1.0.0` on 5throck/Humanize.** Resolved 2026-11-16: tag pushed at
   commit `4860b0e`, recorded as `commit` in the seed.
2. **Registry row.** Designs are registered in `docs/specs/registry.json`; the
   parent standard has a row at lines 3060-3067. This design needs a matching row,
   which PM adds (status `approved`).
