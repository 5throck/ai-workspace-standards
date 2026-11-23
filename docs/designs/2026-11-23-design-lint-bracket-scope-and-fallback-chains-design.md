# design-lint Bracket-Utility Scope Restore + var() Fallback-Chain Support

- **Date**: 2026-11-23
- **Status**: implemented (this landing)
- **Source**: U-20261123-001 (upstream request from co-newbiz)
- **Tier**: L0 (`scripts/design-lint.ts` + its unit suites; the L1 mirror `templates/common/scripts/design-lint.ts` publishes via the sync pipeline)

## Problem

design-lint's `token-role-misuse` sub-check (introduced v2.4.0, T-20261029-004) carries one false-positive class and one blind spot, both confirmed in the 2026-11-23 co-newbiz scan of record (exit 1, 146 token-role-misuse fails):

- **G1 — false positive (131 sites)**: `TEXT_COLOR_DECL` matched the `[color:` fragment inside Tailwind arbitrary-value bracket utilities. The v2.4.0 guard `(^|[^\w-])` excludes the `-` of compound properties (`background-color`, `border-color`) but accepts `[`, so `border-[color:var(--x-border)]` / `bg-[color:var(--x-bg)]` parsed as text-color declarations and flagged border-/bg-role tokens as text-color misuse — contradicting the rule's own documented scope ("non-text color declarations (background-color, border-color, custom-property definitions) are out of scope", v2.4.0 header). The matcher regex is byte-identical since v2.4.0 (commit 87b688b6f): the class surfaced when fleet projects adopted bracket-utility styling at scale, not in a v2.4.0→v2.5.0 behavior delta (v2.5.0 added only the `--allow` passthrough).
- **G2 — blind spot (observed at co-newbiz `app/web-next/components/wacc/BetaPanel.tsx:412`)**: the var() matcher anchored on the close paren (`var\(\s*(--[A-Za-z0-9-]+)\s*\)`), so any var() carrying a fallback escaped. In `var(--warning,var(--warning-fg,var(--muted-fg)))` (text-color context) only the innermost `--muted-fg` was detected (an allowed fg token) — the bare status head `--warning`, the actually-effective value, was invisible.

## Decision

1. **G1 — scope restore**: `TEXT_COLOR_DECL` becomes `(?<![\w-])(?<!\[)color\s*:\s*([^;}]*)(?=[;}]|$)` — a `[`-preceded `color:` never reads as a text declaration (the compound-property guard gains a bracket arm as a second negative lookbehind; capture semantics unchanged). A dedicated matcher `(?<![\w-])text-\[color\s*:\s*([^\]]*)\]` keeps the TEXT arm of bracket utilities in scope: only the `text-` utility carries text-color semantics, so `text-[color:var(--x-border)]` still fires as a text-role check while `border-`/`bg-`/`ring-[color:…]` stay out of scope per the documented v2.4.0 rule.
2. **G2 — fallback chains**: the var() matcher becomes `var\(\s*(--[A-Za-z0-9-]+)` — head-of-var capture with the close-paren anchor dropped. Every `var(` occurrence is matched independently, so nested fallback chains need no paren-depth parser: `var(--a,var(--b,var(--c)))` yields `--a`, `--b`, `--c`, and each level is role-checked. Intended strict-superset effect: heads that were invisible before (any var() with a fallback, e.g. `var(--x,)` or an unclosed `var(--x`) are now detected; no previously-detected reference is lost.
3. **Version**: 2.5.0 → 2.6.0 — minor bump: behavior changes in both directions (new detections and a silenced false-positive class).

## Acceptance

Unit-pinned in `tests/unit/design-lint-token-role.test.ts` (5 tests, +2 regression cases, real-CLI harness reused unchanged):

- `border-[color:var(--x-border)]`, `bg-[color:var(--x-bg)]`, `ring-[color:var(--warning)]` produce zero token-role-misuse findings (the 131-site class);
- `text-[color:var(--success-border)]` fires; `text-[color:var(--success-fg)]` stays clean (bracket TEXT arm still checked);
- plain `color: var(--success-bg)` still fires — simple `var(--x)` behavior unchanged (v2.4.0 contract);
- `color: var(--warning,var(--warning-fg,var(--muted-fg)))` fires exactly `--warning`; forbidden roles at any chain depth fire (`var(--card-bg, var(--success-border))` → both heads); all-allowed chains stay clean.

`tests/unit/design-lint-cli.test.ts` version pins advance to v2.6.0 (test file v1.2.0).

## Landing

Commit `fix(design-lint): bracket-utility scope restore + var() fallback-chain support (U-20261123-001)` via the sync pipeline from an isolated worktree (branch `pr/20261123-design-lint-bracket-fallback`, cut from origin/main a0859a190); PR merged on green CI. Registry: `bun scripts/spec-register.ts --file docs/designs/2026-11-23-design-lint-bracket-scope-and-fallback-chains-design.md --source manual --status implemented` (this doc). `scripts/SCRIPTS.md` design-lint.ts row advances to 2.6.0; `docs/VERSION_MANIFEST.md` regenerates in-pipeline (step 4.7); the L1 mirror (`templates/common/scripts/design-lint.ts`) publishes via propagate-to-templates (step 4.5).

## Out of scope

- Role checking of non-text utilities' bracket values (`bg-[color:var(--x-border)]` — border token in a bg slot): v2.4.0's documented scope keeps all non-text declarations out of scope; a bg/border-role rule would be a new check, not a bugfix.
- `text-[var(--x)]` (Tailwind color-inference shorthand without the explicit `color:` key): never detected before, stays undetected; a follow-up may extend if the fleet adopts the shorthand.
- `audit.ts` checkDesignLint wiring, exemption/allowlist semantics, and the `--allow` passthrough: unchanged.
