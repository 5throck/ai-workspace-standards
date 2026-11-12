# Upstream Fleet Triage Batch — 2026-11-12 (U-20261112-006 / -008 / -012)

**Status**: implemented
**Source**: manual (workspace-root PM triage of 20 U-20261112-* fleet upstream requests, per pm-gateway-workflow §3.12)
**Scope**: three verified, small, mechanical defects reported by fleet projects; one batch PR.

## Problem statements (independently verified against origin/main)

### U-20261112-006 (co-safety) — sanctioned root-file lists stale

The standard-root-file allow-lists omit files the template system itself delivers:
`AGENTS.md` §7 File Organization (root L0 and L1 template copies) lists only
README/CHANGELOG/AGENTS/SECURITY; `templates/common/docs/context.md` "Standard Root Files"
includes CLAUDE/GEMINI/CODEX/HERMES but omits `README_ko.md` (delivered by
`templates/README_ko.md` and variant templates; present at project roots). Policy text
contradicts delivered layout.

**Fix**: extend both lists to the delivered set — AGENTS.md §7 (root + common template)
now lists `CLAUDE.md, GEMINI.md, CODEX.md, HERMES.md, README_ko.md`; docs/context.md adds
`README_ko.md`. Doc-only; no code path reads these lists.

### U-20261112-008 (co-security) — dead config key in delivered settings

`templates/common/.claude/settings.json` carried `"footerLinksRegexes": []` with no
consumer anywhere in `scripts/` or template tooling (grep across repo: zero readers;
variant templates carry their own populated copies for local tooling, out of scope).
Dead key propagated to variants on upgrade.

**Fix**: remove the key from the L1 template source. Key was last in the JSON object, so
the preceding `}` closing the `hooks` object loses its trailing comma (valid JSON,
verified by parse).

### U-20261112-012 (co-abap) — zero-line-ending files classified "mixed"

`scripts/lib/encoding-utils.ts` `detectEncoding`: when `crlfCount === 0 && lfCount === 0`
(single-line / minified JSON fixtures), the final `else` branch labeled the file `"mixed"`,
and `audit.ts` printed the factually wrong "CRLF/Mixed line endings … use LF only" WARN.
Verified by the ticket's byte-scan reasoning and code reading: with no CR and no LF bytes
the content cannot be CRLF or mixed.

**Fix**: add an explicit zero-count branch classifying the content as `"lf"` (nothing is
CRLF ⇒ LF-compliant). Type union unchanged; consumers (`audit.ts:704`,
`helpers/scan-l3-project.ts:227`) key off `crlf`/`mixed` values only, so no consumer
changes.

## Alternatives considered

- U-012: a distinct `"none"` result — rejected for this batch: widens the type union and
  requires consumer updates; `"lf"` is semantically correct (LF-compliant) and zero-risk.
- U-008: wiring the key to a consumer — rejected: no consumer requirement exists; removal
  is the minimal honest state.
- U-006: marking the pointers as root-only instead of extending lists — not applicable
  here (that alternative belongs to U-20261112-002's dangling-pointer problem, which is
  design-class and stays in the queue).

## Out of scope (remains in triage queue)

All other U-20261112-* tickets: design-class (delivery-pipeline, new audit dimensions,
content restoration), already-fixed-at-source (U-001, U-005), L3-local (U-004),
cross-project duplicate (U-003 → U-20261112-010), security-flagged (U-009 — human
review), governance-control touch (U-20261112-020 — user sign-off required per §3.12).

## Verification

- `bun scripts/spec-register.ts --file <this doc> --source manual --status implemented`
  registered before `/sync`; sync-time spec-check passes on this registry entry.
- JSON validity of edited settings.json re-checked post-edit.
- Full audit battery runs in CI on the PR; no gates bypassed.

## Addendum (2026-11-13, PR #1991 CI follow-up)

ubuntu-latest E2E (`scripts/test-new-project.ts`) failed Test 27 AC3: the test pinned the
scaffolded `docs/context.md` version footer at the pre-batch literal `2.15`, while this
batch's footer bump (required by the validate-templates content-changed gate) moved the
template to `2.16`. Diagnosis: the template/product change is correct; the E2E expectation
was wrong-shaped — a literal pin that has now broken on two consecutive footer bumps
(2.14→2.15 via U-20261112-002, 2.15→2.16 via this batch). Fix: Test 27 AC3 now derives the
expected version from `templates/common/docs/context.md` at run time (scaffolded footer
must equal the template's current footer version), which is the actual acceptance
criterion and ends the bump-breakage class. `test-new-project.ts` 1.11.1 → 1.12.0;
L0 SCRIPTS.md registry row updated (script is L0-only, not mirrored). Local E2E re-run:
41/41 passed.
