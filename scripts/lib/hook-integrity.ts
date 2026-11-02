// @version 1.0.0
/**
 * hook-integrity.ts — the canonical-vs-delivered scripts/hooks/ comparison
 *
 * Single derivation (v1.0.0, 2026-11-02, Phase 4 remediation follow-up) of the
 * hook-dir comparison that BOTH consumers had started to fork:
 *   - scripts/hub-bootstrap.ts (VALIDATED gate check 2, design §4.4 — blocking)
 *   - scripts/hub-probe.ts (observable signal 2, design §3.5 — probe verdict)
 * The 2026-11-02 fleet drill exposed two false-positive classes in the raw
 * byte diff, and fixing them only in hub-bootstrap would have left the probe
 * reporting DIVERGENT (which §3.5 auto-forces the next AVAILABLE declaration
 * to DEGRADED) for the exact same non-divergence:
 *
 *   1. Root-only test fixtures — scripts/hooks/_test-*.ts are internal test
 *      helper modules (no @version header; SCRIPTS.md registers them as
 *      internal test fixtures; lifecycle Check A treats them as version-
 *      unvalidatable). They are NEVER delivered: every hub/project clone
 *      legitimately lacks them. Excluded from BOTH sides via
 *      /^_test-.*\.ts$/ so their root-only presence can never read as
 *      divergence in any hub.
 *   2. The sanctioned CONSTITUTION.md→context.md comment scrub
 *      (scripts/lib/constitution-scrub.ts, §7.5 Non-Propagation) — the L1
 *      delivery source ships comment-text-scrubbed copies, so the raw diff
 *      between root canonical and any correctly-delivered clone reports
 *      "hook differs" forever (the drill's gateguard-fact-force.ts
 *      "one-comment diff"). Fingerprints normalize BOTH sides through the
 *      shared scrub before hashing; the scrub is idempotent and, for code
 *      files, comment-only — functional changes (string literals, code,
 *      headers) still fail byte-exactly.
 *
 * Line-ending normalization stays part of the fingerprint (hub-bootstrap
 * v1.2.0): a core.autocrlf=true Windows checkout must not read as divergence.
 *
 * Consumers:
 *   - scripts/hub-bootstrap.ts (blocking VALIDATED gate check 2)
 *   - scripts/hub-probe.ts (read-only weekly probe, hooks_integrity signal)
 *
 * Tests: tests/unit/hub-bootstrap.test.ts (gate pass/fail E2E, scrub
 * tolerance), tests/unit/hub-probe-sidecars.test.ts if present.
 *
 * @license MIT
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { scrubConstitutionRefs } from './constitution-scrub.ts';

/** Root-only test fixtures (hub-bootstrap v1.5.0): never delivered, excluded
 * from BOTH sides of every canonical comparison this lib performs. */
export const TEST_FIXTURE_RE = /^_test-.*\.ts$/;

/** Fingerprint one hook file (v1.6.0 semantics): CRLF→LF normalized, then the
 * sanctioned CONSTITUTION.md→context.md comment scrub applied, then sha256.
 * The scrub is idempotent, so an already-scrubbed delivered copy hashes
 * unchanged; the code-file scrub rules leave functional string literals
 * untouched, so a real code change still fails the compare. */
export function hookContentFingerprint(p: string): string {
  const normalized = scrubConstitutionRefs(readFileSync(p, 'utf-8').replace(/\r\n/g, '\n'), p);
  return createHash('sha256').update(normalized, 'utf-8').digest('hex');
}

/** Fingerprint a scripts/hooks/ dir into { posixKey → fingerprint }, with the
 * _test-* fixtures excluded from BOTH sides. Keys are ALWAYS posix-style
 * ('/' separators, no drive letter) so the comparison is separator-neutral on
 * Windows. Returns an empty map when the dir is absent (callers decide
 * whether absence is a violation — the blocking gate refuses, the probe
 * names the signal). */
export function fingerprintHookDir(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  if (!existsSync(dir)) return out;
  const walk = (d: string, prefix: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      const key = prefix + e.name;
      if (e.isDirectory()) walk(p, `${key}/`);
      else if (!TEST_FIXTURE_RE.test(key)) out.set(key, hookContentFingerprint(p));
    }
  };
  walk(dir, '');
  return out;
}

/** The canonical-vs-delivered diff (hub-bootstrap v1.5.0/v1.6.0 semantics,
 * message-compatible): returns violation strings; empty = clean. Absence of
 * either side is a typed refusal, never a silent pass. */
export function hookDirViolations(canonicalDir: string, deliveredDir: string): string[] {
  const violations: string[] = [];
  if (!existsSync(canonicalDir)) return [`canonical ${canonicalDir} is missing — cannot diff (refusing to validate)`];
  if (!existsSync(deliveredDir)) return [`delivered tree carries no scripts/hooks/ directory — the canonical hooks must ship with the hub`];
  const a = fingerprintHookDir(canonicalDir);
  const b = fingerprintHookDir(deliveredDir);
  for (const [f, content] of a) {
    if (!b.has(f)) violations.push(`hook missing in clone: scripts/hooks/${f}`);
    else if (b.get(f) !== content) violations.push(`hook differs from canonical: scripts/hooks/${f}`);
  }
  for (const f of b.keys()) {
    if (!a.has(f)) violations.push(`extra hook not in canonical: scripts/hooks/${f}`);
  }
  return violations;
}
