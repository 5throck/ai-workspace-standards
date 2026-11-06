# Design: bounded gitleaks test-fixture allowlist rule (T-20261103-007)

**Date**: 2026-11-03 (code landed same day; this design doc retro-registered 2026-11-06)
**Status**: implemented
**Scope**: `.github/gitleaks-full.toml` — one additive `[[allowlists]]` entry (+18 lines, the file's final block)
**Tickets**: T-20261103-007
**Landing**: PR #1840 (merged 2026-11-03)
**Normative body**: `docs/decisions/DEC-20261103-03.md` — this design doc is a
thin promotion stub; the decision record IS the design. Read it for the policy
choice (PM adjudication, gate-moment ruling per ADR-0061), the exact regex
bounds, the alternatives rejected, the verification and negative-control
evidence, the residual-risk acceptance, the attached conditions, and the
rollback procedure. This stub does not duplicate that text.

> Retro-registration note: this document backfills design paperwork for
> already-landed code per the D8 batch adjudication
> (`docs/reports/2026-11-06-d8-batch-adjudication.md` §B3, retro-backfill
> remedy; the adjudication row itself recommended exactly this promotion).
> No code changes ride this registration.

## What the rule permits

One `[[allowlists]]` entry with `condition = "and"` requiring BOTH:

1. **PATH — test files only** (repo-relative, per-project window-scan
   convention): `^tests/.*\.test\.(ts|tsx|js|mjs)$`. Prose, config and env
   paths never match. Root-relative `Projects/<x>/tests/...` forms are
   already covered by the pre-existing `Projects/[^/]+/tests/.*$` path entry.
2. **SHAPE — one of exactly two credential-rejecting fixture families**:
   the `pw-` throwaway-password shape (literal prefix, 1-4 lowercase-alnum
   hyphen-separated segments of ≤16 chars, optional terminal 2-8 digit group)
   and the `s` SSOT-stage-key shape (`s` + 1-3 digits + `.` + 1-28
   lowercase/underscore chars). Character classes admit only
   `[a-z0-9-.]`, so schemes/URLs, bearer tokens, JWT/base64 and long hex runs
   are structurally rejected — the positive shape is the rejector (RE2, no
   negative lookahead needed).

## What keeps it from becoming a blanket exemption

- **Shape-gated, not path-only**: the config header forbids path-based
  blanket excludes; credential-shaped material in test paths still reports
  (negative control verified: high-entropy apiKey, bearer JWT, scheme-prefixed
  base64 and 64-char hex remain flagged under the new config — DEC §3/§4).
- **Additive**: the per-file exact-value entries (T-20261028-009,
  T-20261030-005) and the per-file s-shape entry (T-20261029-006)
  deliberately STAY; this entry subsumes the class going forward.
- **Bounds are load-bearing** (DEC condition 1): any future fixture family
  needing a third shape or wider bounds is a NEW decision record, never an
  in-place widening.
- **Rollback** (DEC consequences): delete the T-20261103-007
  `[[allowlists]]` block from `.github/gitleaks-full.toml`; the per-file
  entries above it remain correct on their own.
- **Residual risk is stated, bounded and voidable** (DEC consequences +
  condition 3): a REAL credential that is itself pw-shaped or s-shaped inside
  a test file would be suppressed — same trade-off class as the pre-existing
  `Projects/[^/]+/tests/.*$` entry; if that ever happens the acceptance is
  void (rotate, revisit bounds).

## Verification

Carried by the DEC (§ "Verification evidence", 2026-11-03, gitleaks 8.30.1 —
the version pinned by weekly-health-check.yml): flagged-commit clean check;
full-history footprint 101 → 22 findings with all 79 suppressed findings
generic-api-key in `tests/unit/*.test.ts` and all 30 unique suppressed
secrets shape-matched (`NewPass-98765` remains reported); non-test visibility
preserved; negative control; the documented pre-existing `--no-git` file-skip
quirk (shape gating operative in git-mode — the mode that flags this class).

## Platform Impact

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | None (CI scanner config, platform-neutral) | N/A |
| Antigravity (GEMINI.md) | None (CI scanner config, platform-neutral) | N/A |
| templates/common | None (`.github/gitleaks-full.toml` is L0-only, not template-managed) | N/A |

## Tickets / evidence

- Ticket: `tickets/governance/T-20261103-007` (source ticket; PM policy
  choice recorded per ADR-0061)
- Governing decision record: `docs/decisions/DEC-20261103-03.md`
- Structural-fix directive: `tickets/governance/T-20261030-005` (5th
  occurrence of the class triggered policy (a))
- Landing PR: #1840 (merged 2026-11-03)
- Adjudication: `docs/reports/2026-11-06-d8-batch-adjudication.md` §B3 row 2
