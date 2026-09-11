#!/usr/bin/env bun
// @version 1.0.0
// check-upgrade-coverage.ts — Upgrade coverage validator (2026-09-11-upgrade-policy-coverage-design.md D6).
// Walks the effective template tree (variant overlay over templates/common, scaffold parity) via
// scripts/lib/upgrade-policy.ts, resolves the upgrade claim for every file, and reports the
// classification matrix. Complements the policy lib's deny-list inversion: it makes the coverage
// of the upgrade pipeline visible and gates on the failure modes that historically created
// silent gaps.
//
// Usage:
//   bun scripts/check-upgrade-coverage.ts [--variant <name>] [--strict] [--json]
//
// --strict exits non-zero when:
//   1. a template file's claim cannot be resolved (defensive; the default fallback makes this
//      a structural invariant),
//   2. a delivery-claimed file contains {{placeholder}} tokens (would ship unsubstituted
//      template text into projects; docs/README*.template.md are allowlisted — they ship
//      verbatim unrendered by design),
//   3. a variant template carries docs/context.md (WS-07 contamination — common is the SSOT),
//   4. a JSON_MERGE target fails JSON.parse.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  TEMPLATE_TREE_SYNC_PASS,
  PLACEHOLDER_ALLOWLIST,
  isDeliveryPolicy,
  iterEffectiveTemplateFiles,
  resolveClaim,
  type UpgradeClaim,
} from './lib/upgrade-policy.ts';

const workspaceRoot = resolve(import.meta.dir, '..');
const templatesRoot = join(workspaceRoot, 'templates');
const commonDir = join(templatesRoot, 'common');

// ── Args ───────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let variantFilter = '';
let strict = false;
let jsonOut = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--variant') variantFilter = args[++i] ?? '';
  else if (args[i] === '--strict') strict = true;
  else if (args[i] === '--json') jsonOut = true;
  else if (args[i] === '--help' || args[i] === '-h') {
    console.log('Usage: bun scripts/check-upgrade-coverage.ts [--variant <name>] [--strict] [--json]');
    process.exit(0);
  }
}

// Scaffold placeholder convention (scripts/helpers/substitute-placeholders.ts): {{UPPER_SNAKE}}.
// Code files (.js/.ts) are excluded — template literals and template-renderer code legitimately
// contain brace sequences (e.g. scripts/helpers/template-utils.ts documents {{KEY}} itself).
const PLACEHOLDER_EXTENSIONS = new Set(['.md', '.json', '.yml', '.yaml', '.txt', '.html', '.css']);
const PLACEHOLDER_TOKEN = /\{\{\s*[A-Z][A-Z0-9_]+\s*\}\}/;

function listVariants(): string[] {
  return readdirSync(templatesRoot, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name)
    .filter(n => n.startsWith('co-'))
    .sort();
}

const violations: Array<{ variant: string; rel: string; check: string; detail: string }> = [];
const rows: Array<{ variant: string; rel: string; source: string; policy: string; pass: string }> = [];

const variants = variantFilter ? [variantFilter] : listVariants();
if (variants.length === 0) {
  console.error(`No variant templates found under ${templatesRoot}`);
  process.exit(1);
}

for (const variant of variants) {
  const variantDir = join(templatesRoot, variant);
  if (!existsSync(variantDir)) {
    console.error(`Unknown variant template: ${variant}`);
    process.exit(1);
  }

  // Check 3 — WS-07: a variant must never carry its own docs/context.md
  if (existsSync(join(variantDir, 'docs', 'context.md'))) {
    violations.push({ variant, rel: 'docs/context.md', check: 'WS-07', detail: 'variant template carries docs/context.md — common is the SSOT (VARIANT_OVERLAY_SKIP)' });
  }

  for (const { rel, source, abs } of iterEffectiveTemplateFiles(commonDir, existsSync(variantDir) ? variantDir : null)) {
    const claim: UpgradeClaim = resolveClaim(rel, variant);
    if (!claim || !claim.policy || !claim.pass) {
      violations.push({ variant, rel, check: 'unresolved-claim', detail: 'resolveClaim returned no usable claim' });
      continue;
    }
    rows.push({ variant, rel, source, policy: claim.policy, pass: claim.pass });

    // Check 2 — placeholder tokens in delivered files
    const ext = rel.slice(rel.lastIndexOf('.')).toLowerCase();
    if (isDeliveryPolicy(claim.policy) && !PLACEHOLDER_ALLOWLIST.has(rel) && PLACEHOLDER_EXTENSIONS.has(ext)) {
      try {
        if (statSync(abs).size < 2_000_000 && PLACEHOLDER_TOKEN.test(readFileSync(abs, 'utf8'))) {
          violations.push({ variant, rel, check: 'placeholder', detail: `delivery policy ${claim.policy} but file contains an {{UPPER_SNAKE}} placeholder token` });
        }
      } catch { /* unreadable file — not a coverage concern */ }
    }

    // Check 4 — JSON_MERGE targets must be valid JSON
    if (claim.policy === 'JSON_MERGE') {
      try { JSON.parse(readFileSync(abs, 'utf8')); } catch (err) {
        violations.push({ variant, rel, check: 'json-parse', detail: `JSON_MERGE target is not valid JSON: ${(err as Error).message}` });
      }
    }
  }
}

// ── Report ─────────────────────────────────────────────────────────────────────
if (jsonOut) {
  console.log(JSON.stringify({ variants, violations, files: rows }, null, 2));
} else {
  const byPass = new Map<string, number>();
  for (const r of rows) byPass.set(r.pass, (byPass.get(r.pass) ?? 0) + 1);
  console.log('Upgrade coverage matrix (effective template tree, variant overlay over common)');
  console.log('============================================================================');
  for (const [pass, count] of [...byPass.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${pass.padEnd(36)} ${String(count).padStart(5)}`);
  }
  console.log(`  ${'TOTAL'.padEnd(36)} ${String(rows.length).padStart(5)}`);
  const tts = rows.filter(r => r.pass === TEMPLATE_TREE_SYNC_PASS);
  if (tts.length > 0) {
    console.log(`\n${TEMPLATE_TREE_SYNC_PASS} delivers (default policy):`);
    for (const r of tts) console.log(`  [${r.policy.padEnd(10)}] (${r.variant}) ${r.rel}`);
  }
  if (violations.length > 0) {
    console.log('\nViolations:');
    for (const v of violations) console.log(`  ✗ (${v.variant}) ${v.rel} — ${v.check}: ${v.detail}`);
  } else {
    console.log('\nNo violations.');
  }
}

if (strict && violations.length > 0) {
  console.error(`\ncheck-upgrade-coverage: FAIL — ${violations.length} violation(s)`);
  process.exit(1);
}
