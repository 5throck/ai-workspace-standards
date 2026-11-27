#!/usr/bin/env bun
// @version 1.0.0
// audit-fail-count-accounting.test.ts — audit.ts v2.69.0 Fail-then-increment
// double-count sweep pins (DEC-20261118-01 direct fix, no ticket).
//
// Five check sites kept an `errors += <counter>` epilogue after reporting via
// Fail() — which already increments — so N failures were counted 2N in the
// summary. Same class as the audit 2.68.0 §3.5 BOM accounting fix (see
// tests/unit/encoding-utils-bom-scan.test.ts). Sites:
//   1. §3.7 homoglyph          (`errors += homoglyphErrors`)
//   2. §3.8 zero-width         (`errors += zwErrors`)
//   3. agent-state sync        (`errors += syncErrors`)
//   4. variant-skill-sections  (`errors += allFailures.length`)
//   5. agent Required Tools    (`errors += missingSection`)
// Fail() is now the sole increment everywhere; the per-file overflow lines
// ("... and N more") are one Fail() call each, so the §3.7/§3.8 gate counters
// count calls, not occurrences. Pins:
//   - detector count-exactness: a fixture with N confusables yields exactly N
//     detector matches (the audit side renders min(N,5) per-item Fails plus one
//     overflow Fail when N > 5 — verified live: old binary 7 vs fixed 6 failed
//     checks on an identical 1-homoglyph fixture; 17 vs 11 for 6 homoglyphs);
//   - live-source pins: no epilogue literal survives on an executable line
//     (comment-stripped, nul-lint-invariant precedent).
// Fixture roots are passed explicitly (no process.cwd() root consts — the
// hermetic-test-roots arm contract).

import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { detectHomoglyphs, detectZeroWidthChars } from "../../scripts/lib/encoding-utils.ts";

const AUDIT_TS = join(import.meta.dir, "..", "..", "scripts", "audit.ts");

describe("detector count-exactness — homoglyph/zero-width (v2.69.0 sweep)", () => {
  test("N confusable characters yield exactly N homoglyph matches (1:1 Fail basis)", () => {
    // 3 Cyrillic confusables (U+0430 U+043E U+0435) in one file → 3 per-item
    // Fail() calls (N ≤ 5, no overflow line) → exactly 3 errors after the fix.
    // Written as escapes so this file itself passes the §3.7 homoglyph scan.
    const content = "cryst\u0430l \u043Everview: numb\u0435r\n";
    expect(detectHomoglyphs(content)).toHaveLength(3);
  });

  test("overflow arithmetic: 6 matches → 5 shown + 1 overflow = 6 Fail() calls", () => {
    const content = "\u0430 \u0431 \u0432 \u0433 \u0434 \u0435\n"; // 6 Cyrillic confusables
    const matches = detectHomoglyphs(content);
    expect(matches).toHaveLength(6);
    // One Fail() call per shown match (capped at 5) plus one overflow call.
    const failCalls = Math.min(matches.length, 5) + (matches.length > 5 ? 1 : 0);
    expect(failCalls).toBe(6); // matches the live repro: old summary counted 6 Fail + 6 epilogue
  });

  test("zero-width: FAIL-class matches counted per call, benign codepoints are WARN-only", () => {
    const content = "a\u200Bb\u200Bc\uFEFF\n"; // 2 FAIL-class (ZWSP) + 1 benign (BOM)
    const matches = detectZeroWidthChars(content);
    expect(matches).toHaveLength(3);
    const BENIGN = new Set(["U+FEFF", "U+2060"]);
    const failClass = matches.filter((m) => !BENIGN.has(m.codePoint));
    expect(failClass).toHaveLength(2); // exactly 2 Fail() calls (benign BOM is a Warn, never counted)
  });
});

describe("live-source pins — audit.ts Fail-sole-increment accounting (encoding-utils-bom-scan precedent)", () => {
  const source = readFileSync(AUDIT_TS, "utf-8");
  // Comment lines (changelog entries legitimately name the deleted literals)
  // are stripped — the invariant is about executable lines.
  const code = source
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("//"))
    .join("\n");

  test("no `errors += homoglyphErrors` epilogue (§3.7 homoglyph)", () => {
    expect(code.includes("errors += homoglyphErrors")).toBe(false);
  });

  test("no `errors += zwErrors` epilogue (§3.8 zero-width)", () => {
    expect(code.includes("errors += zwErrors")).toBe(false);
  });

  test("no `errors += syncErrors` epilogue (agent-state sync)", () => {
    expect(code.includes("errors += syncErrors")).toBe(false);
  });

  test("no `errors += allFailures.length` epilogue (variant-skill-sections)", () => {
    expect(code.includes("errors += allFailures.length")).toBe(false);
  });

  test("no `errors += missingSection` epilogue (agent Required Tools)", () => {
    expect(code.includes("errors += missingSection")).toBe(false);
  });

  test("overflow gate counters count Fail() calls, not occurrences", () => {
    // §3.7: the old `homoglyphErrors += matches.length` summed occurrences while
    // the overflow line was a single Fail() call; now per-call.
    expect(code.includes("homoglyphErrors += matches.length")).toBe(false);
    expect(code.includes("homoglyphErrors++;")).toBe(true);
    // §3.8: same alignment for the zero-width overflow line.
    expect(code.includes("zwErrors += matches.length - 5")).toBe(false);
    expect(code.includes("zwErrors++;")).toBe(true);
  });

  test("version header is at least the v2.69.0 sweep (accounting fix present)", () => {
    // v2.70.0 (T-20261118-002) added the mirror-parity early-signal arm; the
    // accounting fix shipped in 2.69.0, so pin the floor, not the exact header.
    // v2.71.0 (T-20261123-008 intent) added the snapshot-freshness gate.
    // v2.72.0 (T-20261127-006) added the release-drift-since-tag check — the
    // floor pin became a numeric floor so the enumeration stops growing.
    const minor = Number(/\/\/ @version 2\.(\d+)\.0/.exec(source)?.[1] ?? 0);
    expect(minor).toBeGreaterThanOrEqual(69);
  });
});
