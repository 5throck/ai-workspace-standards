---
schemaVersion: 1.0.0
spec-id: platform-flag-all-rename
---

# `--platform` Flag: `both` → `all` Rename + Codex Support Drift Fix — 2026-09-20

## 1. Overview

`scripts/new-project.ts` was updated (T-20260912-022, ADR-0077) to accept
`--platform codex` as a fourth value alongside `claude|antigravity|both`,
with real delivery behavior (codex-primary keeps `CODEX.md`/`.codex/`,
legacy profiles drop them unless opted in). `both` never included `codex` —
it only ever meant "claude + antigravity". Three sibling
scripts/helpers reuse the same flag/type and either never picked up
`codex` at all, or kept the confusing "two platforms called both" naming
now that a third platform exists. This lands the rename `both` → `all`
with its meaning expanded to genuinely cover all three platforms, and
fixes the drift where `upgrade-project.ts` silently lacked `codex` support.

## 2. Problem

- `scripts/upgrade-project.ts` validation (`['claude', 'antigravity', 'both']`)
  and its `MERGE_FILES`/`COMMANDS_DIRS` gates had no `codex` branch at all —
  upgrading a codex-scaffolded project never merged `CODEX.md`.
- `scripts/test-new-project.ts` Test 8 only asserted `CLAUDE.md`/`GEMINI.md`
  for the "both" case, with no codex-specific coverage.
- `scripts/helpers/scaffold-markers.ts`'s `deriveNewProjectDelivery()`
  (root + `templates/common/` mirror) mirrors `new-project.ts`'s delivery
  logic for the `simulate-pipeline`/parity-test consumers; its `PlatformProfile`
  type and CODEX exclusion gate needed to move in lockstep with the rename
  or dry-run predictions would drift from real scaffold output.
- Separately (found during the same review): `docs/context.md` claimed
  `AGENTS.md` is "auto-loaded by Claude Code" — inaccurate; it is only
  reachable because `CLAUDE.md`/`GEMINI.md`/`CODEX.md` explicitly link to
  it. Same inaccurate claim duplicated in `templates/co-safety/agents/README.md`.

## 3. Design

- Rename the flag value `both` → `all` everywhere it appears as this specific
  `PlatformProfile` (`claude|antigravity|codex|all`), and expand `all`'s
  delivery meaning to keep every platform's files (`CLAUDE.md`, `GEMINI.md`,
  `CODEX.md`, `.codex/`) — previously `both` only kept the first two.
- Add the missing `codex` value to `upgrade-project.ts` (validation, usage
  strings, a new `CODEX.md` MERGE branch).
- Extend `test-new-project.ts` Test 8 with a `codex`-specific branch and a
  four-file assertion for `all`.
- Keep `scripts/helpers/scaffold-markers.ts` and its `templates/common/`
  mirror byte-identical (confirmed via diff before/after) since one is a
  synced copy of the other.
- Explicitly did NOT touch unrelated same-named `both` flags in other
  scripts (`generate-version-manifest.ts`'s command/skill parity field,
  `validate-platform-parity.ts`'s settings.json parity field,
  `scan-l3-project.ts`'s `platformScope`, `generate-l3-readme.ts`'s
  `locale`, `scaffold-industry.ts`'s `language`, `md-to-report.ts`'s
  `format`) — different domains, same word, verified by reading each.
- Fixed the `docs/context.md` / `templates/co-safety/agents/README.md`
  doc claim to say `AGENTS.md` is linked from the platform entry files,
  not auto-loaded.

## 4. Verification

- `bun scripts/new-project.ts <name> --platform all` scaffolds all four
  platform artifacts; `--platform claude` regression-checked unchanged.
- `bun scripts/test-new-project.ts <name> --platform all|codex` — new
  Test 8 branches pass.
- `bun scripts/upgrade-project.ts <path> --platform all --dry-run` — `CODEX.md`
  now appears in the MERGE plan.
- `bun scripts/test-scaffold-delivery-parity.ts` — delivery-tree parity
  holds after the rename.
- `bun scripts/lifecycle-sync-audit.ts` — 0 errors after SCRIPTS.md/lifecycle
  record version sync.

## 5. Breaking Change

No backward-compat alias for `--platform both` was added (none requested).
Any external script or CI job passing `--platform both` to `new-project.ts`,
`upgrade-project.ts`, or `test-new-project.ts` must switch to `--platform all`.
