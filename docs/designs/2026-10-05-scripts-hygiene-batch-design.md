# Scripts Hygiene Batch Design (SCRIPTS.md Tail Dedup + Language-Validator Multi-Backtick Spans)

- **Date**: 2026-10-05
- **Status**: Implemented (2026-10-05 — delivered with the SCRIPTS.md dedup, the validator hardening, and the regression test in the same change set; tickets T-20261005-003/-004)
- **Owner**: Automation Engineer (design + implementation); both findings surfaced during the 2026-10-05 country-prune scrub session
- **Spec id**: `2026-10-05-scripts-hygiene-batch-design` (registry: `docs/specs/registry.json`, source: `manual`)
- **Related tickets**: T-20261005-003 (SCRIPTS.md fragment dedup), T-20261005-004 (double-backtick inline-code stripping); T-20261005-002 (registry hand-splice pattern — adjacent hygiene context)
- **Related ADRs**: ADR-0072 (language policy enforcement), ADR-0074 (Universal Design Gate)

---

## 1. Summary

Two hygiene defects found on 2026-10-05, fixed in one batch:

1. `scripts/SCRIPTS.md` carries **three full duplicate copies of its document tail** — each duplicate = footer (`*Last updated: 2026-09-20 …*`) + a registry-row dump + `## Layer Classification Framework` + `## Ownership Layers` + `## Lifecycle States` + `## Guide` (per-script entries) + `## Version Bump Policy` — occupying lines 698–2043 of 2043. All duplicate registry rows verified to be a subset of the live `## Registry` (zero unique content). Fix: truncate the file after the first footer (line 697), which already carries the current update entry.
2. `scripts/validate-md-language.ts` strips inline code with `` /`[^`]+`/g ``, which cannot parse CommonMark **double-backtick inline code** (`` `x` ``). A double-backtick span leaves stray delimiter runs whose global pairing shifts, swallowing or unmasking Korean elsewhere in the file — observed as a language-gate false positive on an English-only CHANGELOG entry (PR #1423 session). Fix: consume multi-backtick spans (lazy `` … `` match) before the single-backtick pass; extract the stripping into an exported pure function and pin both directions with a unit test.

## 2. Background

### 2.1 SCRIPTS.md fragments (T-20261005-003)

Boundary map (line numbers pre-fix): footers at 696/697, 1128/1129, 1610/1611, 2042/2043; duplicated tail sections at 727–1117, 1209–1599, 1641–2031. The duplicates' registry rows (`names()` set comparison) are a strict subset of the live registry; footer dates (2026-09-20) are stale relative to the live footer. Provenance consistent with the hand-splice/append conflict class documented in T-20261005-002: tail copies accreted through repeated non-idempotent updates.

Consumer scope audit (why deletion is behavior-neutral):

| Consumer | Parses |
|----------|--------|
| `verify-scripts.ts --verify` | `## Registry` section only |
| `helpers/write-scripts-snapshot.ts` | regex anchored on the first `## Registry` |
| `generate-scripts-readme.ts` | first `## Guide` → first `## Version Bump Policy` |

None reads past the first copy. `generate-version-manifest.ts` reads scripts' `@version` headers, not SCRIPTS.md sections.

### 2.2 Language-validator spans (T-20261005-004)

`analyzeFile()` strips allowlist regions, then fences (```` /```[\s\S]*?```/g ````), then `` /`[^`]+`/g ``, then link syntax, before the Korean test. The single-span regex requires ≥1 non-backtick char between delimiters, so a double-backtick opener leaves its two backticks unpaired; the regex then consumes a stray pairing (`"Backtick-space-backtick"` etc.) and the global pairing parity flips for the remainder of the file. Korean tokens intentionally wrapped in inline code in historical CHANGELOG entries (e.g. `` `순우리말` ``-style references) sit at the exposure boundary: with shifted parity they leak into the scanned text and the file fails. Verified empirically during PR #1423: HEAD's CHANGELOG passes, adding one double-backtick entry fails, rewording the same entry with single-backtick markup passes.

## 3. Design

### 3.1 SCRIPTS.md dedup

Keep lines 1–697 (through the live footer carrying the 2026-10-05 entry); delete 698–2043. No content moves — the surviving file ends: `## Version Bump Policy` → `---` → footer. The three consumers above are re-run as the acceptance check.

### 3.2 Validator hardening

New exported pure helper in `scripts/validate-md-language.ts`:

```
stripCodeForLanguageScan(content) =
  content
    .replace(/```[\s\S]*?```/g, "")   // fenced blocks (unchanged, first)
    .replace(/``[\s\S]*?``/g, "")     // NEW: multi-backtick spans, lazy
    .replace(/`[^`]+`/g, "")          // single-backtick spans (unchanged)
    .replace(/\[[^\]]+\]\([^)]+\)/g, ""); // links (unchanged)
```

Ordering is the fix: multi-backtick delimiters are consumed whole, so the single-span pass sees balanced pairs again. Single-span semantics (including cross-line spans) are unchanged; files without double-backtick spans are unaffected (the new pass is a no-op there). `analyzeFile()` is exported alongside the helper so the regression test calls the real analysis path instead of re-implementing the regexes.

Known accepted edge: quadruple-backtick fences and literal ``` inside a single-backtick span are outside CommonMark-normal usage in this repo and stay unhandled; the fix targets the observed failure class, not full CommonMark parsing.

### 3.3 Regression test

`tests/unit/validate-md-language-code-spans.test.ts` (bun:test) pins:

1. `stripCodeForLanguageScan` removes a double-backtick span containing Korean;
2. `analyzeFile` returns `null` (pass) for a CHANGELOG-style fixture whose only Korean sits inside double-backtick inline code;
3. `analyzeFile` still fails Korean in plain prose (no declaration);
4. The PR #1423 shape: an entry with double-backtick markup plus an older entry whose Korean lives in single-backtick spans → passes (parity no longer flips).

## 4. Verification

1. `bun test tests/unit/validate-md-language-code-spans.test.ts` — new tests pass.
2. `bun scripts/validate-md-language.ts` — no violations on the repo (CHANGELOG unchanged from #1423 state, which previously failed the gate when the double-backtick variant was present).
3. `bun scripts/verify-scripts.ts --verify`, `bun scripts/generate-scripts-readme.ts` (regenerated output unchanged), `bun scripts/helpers/write-scripts-snapshot.ts` consumers — pass.
4. `bun scripts/typecheck.ts` — 0 errors; `bun scripts/audit.ts --spec-check` — all checks passed.

## 5. Non-goals

- No CommonMark-conformant span parser (the two-pass lazy strip covers repo usage).
- No rewrite of the duplicated tail content into tooling (the live sections stay hand-maintained; a generator for SCRIPTS.md is a separate, larger decision).
- Registry-row note drift inside the deleted copies is simply removed, not reconciled.
