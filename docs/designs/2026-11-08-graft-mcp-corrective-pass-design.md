# graft→trail MCP corrective pass — design

- **Spec id**: 2026-11-08-graft-mcp-corrective-pass-design
- **Status**: implemented
- **Date**: 2026-11-08
- **Ticket**: T-20261108-010 (follow-through), U-20261108-002 (adjacent fleet hygiene)
- **Version**: upgrade-project.ts v1.96.0, validate-templates.ts v1.76.0

## 1. Problem

The graft→trail migration flipped the ROOT and TEMPLATE MCP surfaces (2026-11-08:
#1926 root, #1927 templates), but the 16 delivered projects still carry graft-era
MCP registrations on the non-Claude platforms. Sweep result (all 16 projects):
`.gemini/settings.json` ×15, `.codex/config.toml` ×14, `opencode.json` ×15, plus
`.claude/settings.json` ×1 and `.mcp.json` graft entries where present.

Root causes — each surface is stuck for a different delivery-semantics reason, so
no single claim change fixes them:

1. **`.codex/config.toml`** claims `ADD_IF_MISSING` (delivered once, never
   updated) — the trail-era common config will never reach delivered projects.
2. **`.gemini/settings.json`** claims `SYNC` via TEMPLATE TREE SYNC, but every
   project copy is locally modified (project permissions/entries) → the
   evolved-delivery guard CONFLICT-SKIPs it every visit (observed all 16).
3. **`opencode.json`** is the same locally-modified CONFLICT-SKIP class.
4. **`.mcp.json`** is a RETIRED surface (retired-seed rule: upgrades never touch
   it when `.trail/` exists) — project copies with graft entries persist forever.

Manual per-project fixes (as done for `.mcp.json` today) do not scale and do not
help machines that clone/scaffold later.

## 2. Fix

### R1 — corrective pass (upgrade-project v1.96.0)

A new pass, `GRAFT→TRAIL MCP CORRECTIVE`, gated on the migration marker
(`.trail/` exists in the project — the same marker the retired-seed rule uses):

For each surface — `.mcp.json`, `.gemini/settings.json`, `opencode.json`
(JSON), `.codex/config.toml` (TOML):

- **remove** every graft-era server entry (`graft` key / `[mcp_servers.graft]`
  block / graft command or `@nanonets/graft` argv);
- **ensure** a `trail` server entry exists (`command: trail`, `args: [mcp]`)
  — injected when absent, left alone when present;
- **preserve** every other server entry (project MCPs like co-abap's `abap`
  routing and co-newbiz's `co-newbiz` server are never touched);
- record one decision row per corrected file (`CORRECTIVE`, INFO; WARN when a
  graft entry referenced an unresolvable binary — those fail connect anyway);
- idempotent: a clean file is untouched (no decision row, no write);
- TOML handled textually (block split on `[` headers — same parse style as the
  abap parity validator); JSON handled structurally.

The pass runs AFTER the platform-settings syncs so it corrects whatever they
delivered or skipped. Removed-surface semantics stay intact: files that are
retired (`.mcp.json`) get corrected in place rather than re-seeded.

### R2 — template regression guard (validate-templates v1.76.0)

New check `graft-mcp-surfaces`: every template MCP surface
(`templates/**/.gemini/settings.json`, `.codex/config.toml`, `opencode.json`,
`.mcp.json`, `.claude/settings.json`) must contain zero graft-era registrations.
Renaming-documentation prose (CODEX.md, design docs) is not scanned. This pins
the R2.5 flip so a future template cannot re-introduce graft-era registrations.

## 3. Verification

- Unit: `tests/unit/upgrade-graft-mcp-corrective.test.ts` — corrective removes
  graft entries from all four surface shapes, injects trail when absent,
  preserves non-graft servers, is idempotent on clean files, and is gated on
  the `.trail/` marker (no marker → no corrective).
- Live: `upgrade-project Projects/co-price --dry-run` after the fix reports the
  corrective rows for the four surfaces; the 0.31.0 train applies it fleet-wide
  automatically at each project's upgrade visit (no manual per-project work —
  the "other machines" requirement).
- validate-templates: new check green on the current tree; template graft
  reintroduction would fail it.

## 4. Out of scope

- Machine-level binary installs (the trail binary itself remains a per-machine
  install; the vendor's SessionStart hook offers onboarding).
- `.claude/settings.json` hooks-era graft helper entries — already removed at
  root and templates by the 2026-11-01 migration; project copies carry no hook
  graft entries (verified in the sweep).
