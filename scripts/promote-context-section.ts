#!/usr/bin/env bun
// @version 1.0.0
// promote-context-section.ts — Promote a section duplicated across several variants'
// docs/<variant>.context.md into the shared templates/common/docs/context.md (ADR-0050
// Part 3). Executes the decision half of the Context Commonization Review process;
// scripts/audit.ts's checkVariantContextCommonization() is the detection half.
//
// Usage:
//   bun scripts/promote-context-section.ts --heading "<heading text>" --variants co-a,co-b[,co-c...]
//     [--source <variant>] [--after-heading "<heading text>"] [--dry-run]
//
// What this script does NOT do (by design — see skills/context-commonization-review/SKILL.md):
//   - It does not decide WHETHER a section should be promoted — that's an architect judgment
//     call per ADR-0050 Part 3 (nearly-universal → promote here; subset-only → extract to a
//     shared skill instead; run checkVariantContextCommonization() first to find candidates).
//   - It does not update already-scaffolded Projects/*/docs/<variant>.context.md files —
//     removing a section from templates/<variant>/ only fixes future scaffolds and stops the
//     drift check from re-flagging it; existing projects keep the old text until someone
//     upgrades them (see the printed reminder at the end).

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitIntoSections, normalizeHeading, computeLineOverlapSimilarity, getContentLines } from './helpers/context-sections.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, '..');
const TEMPLATES_DIR = path.join(WORKSPACE_ROOT, 'templates');
const COMMON_CONTEXT_MD = path.join(WORKSPACE_ROOT, 'templates', 'common', 'docs', 'context.md');

function fail(msg: string): never {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

// ── Argument parsing ────────────────────────────────────────────────────────────
interface Args {
  heading: string;
  variants: string[];
  source: string | null;
  afterHeading: string | null;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Args {
  let heading = '';
  let variants: string[] = [];
  let source: string | null = null;
  let afterHeading: string | null = null;
  let dryRun = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--heading') heading = argv[++i] ?? '';
    else if (a === '--variants') variants = (argv[++i] ?? '').split(',').map(v => v.trim()).filter(Boolean);
    else if (a === '--source') source = argv[++i] ?? null;
    else if (a === '--after-heading') afterHeading = argv[++i] ?? null;
    else if (a === '--dry-run') dryRun = true;
  }

  if (!heading) fail('Missing --heading "<heading text>". Usage: bun scripts/promote-context-section.ts --heading "<text>" --variants co-a,co-b [--source <variant>] [--after-heading "<text>"] [--dry-run]');
  if (variants.length < 2) fail('--variants needs at least 2 comma-separated variant names (a promotion by definition consolidates more than one copy).');

  return { heading, variants, source, afterHeading, dryRun };
}

const args = parseArgs(process.argv.slice(2));
const dryTag = args.dryRun ? '[DRY RUN] ' : '';
const targetHeading = normalizeHeading(args.heading);

// ── Locate the section in each variant's docs/<variant>.context.md ─────────────
interface Found {
  variant: string;
  filePath: string;
  headingLine: string;
  body: string;
  fullContent: string;
}

const found: Found[] = [];
for (const variant of args.variants) {
  const filePath = path.join(TEMPLATES_DIR, variant, 'docs', `${variant}.context.md`);
  if (!fs.existsSync(filePath)) fail(`No such file: ${path.relative(WORKSPACE_ROOT, filePath)} (is "${variant}" a valid templates/co-* variant?)`);
  const fullContent = fs.readFileSync(filePath, 'utf8');
  const section = splitIntoSections(fullContent).find(s => s.heading === targetHeading);
  if (!section) fail(`Heading "${args.heading}" not found in ${path.relative(WORKSPACE_ROOT, filePath)}. Run 'bun scripts/audit.ts' to see current candidate headings.`);
  found.push({ variant, filePath, headingLine: section.headingLine, body: section.body, fullContent });
}

// ── Pick canonical content, show what will happen ───────────────────────────────
const canonical = args.source
  ? found.find(f => f.variant === args.source) ?? fail(`--source "${args.source}" is not in --variants.`)
  : found[0];

console.log(`🔍 Promoting "${args.heading}" from ${found.length} variant(s): ${args.variants.join(', ')}`);
console.log(`   Canonical content source: ${canonical.variant}\n`);

for (const f of found) {
  const sim = f === canonical ? 1 : computeLineOverlapSimilarity(canonical.body, f.body);
  const label = f === canonical ? '(canonical)' : `(${(sim * 100).toFixed(1)}% overlap with canonical)`;
  console.log(`--- ${f.variant} ${label} ---`);
  console.log(f.body.split('\n').slice(0, 8).join('\n'));
  if (f.body.split('\n').length > 8) console.log('    …');
  console.log('');
  // Any divergence from canonical — not just low overlap — needs a human look: a variant
  // may have deliberately different wording (e.g. a different commit-type convention) that
  // reads as "83% similar" but would be a real regression to silently discard.
  if (sim < 1 && f !== canonical) {
    const canonicalLines = getContentLines(canonical.body);
    const variantLines = getContentLines(f.body);
    const onlyInVariant = [...variantLines].filter(l => !canonicalLines.has(l));
    const onlyInCanonical = [...canonicalLines].filter(l => !variantLines.has(l));
    console.log(`  ⚠️  ${f.variant} is not identical to canonical (${(sim * 100).toFixed(1)}% overlap) — promoting will discard these ${f.variant}-only lines:`);
    for (const l of onlyInVariant.slice(0, 6)) console.log(`       - ${l}`);
    if (onlyInVariant.length > 6) console.log(`       … and ${onlyInVariant.length - 6} more`);
    if (onlyInCanonical.length > 0) {
      console.log(`     and ${f.variant} would gain these lines it doesn't currently have:`);
      for (const l of onlyInCanonical.slice(0, 6)) console.log(`       + ${l}`);
      if (onlyInCanonical.length > 6) console.log(`       … and ${onlyInCanonical.length - 6} more`);
    }
    console.log('');
  }
}

// ── Insert into templates/common/docs/context.md ────────────────────────────────
if (!fs.existsSync(COMMON_CONTEXT_MD)) fail(`Common context.md not found: ${path.relative(WORKSPACE_ROOT, COMMON_CONTEXT_MD)}`);
const commonContent = fs.readFileSync(COMMON_CONTEXT_MD, 'utf8');
const commonSections = splitIntoSections(commonContent);
if (commonSections.some(s => s.heading === targetHeading)) {
  fail(`docs/context.md already has a "${args.heading}" section — nothing to promote (or pick a different --heading).`);
}

const insertionTarget = args.afterHeading ? normalizeHeading(args.afterHeading) : 'lifecycle management';
const commonLines = commonContent.split('\n');
let insertAt = -1;
for (let i = 0; i < commonLines.length; i++) {
  if (/^#{2,3}\s+/.test(commonLines[i]) && normalizeHeading(commonLines[i]) === insertionTarget) {
    insertAt = i;
    break;
  }
}
if (insertAt === -1) {
  fail(`Could not find insertion point "${args.afterHeading ?? '## Lifecycle Management'}" in docs/context.md. Pass --after-heading "<existing heading text>" to pick a valid one.`);
}

const promotedBlock = `${canonical.headingLine}\n\n${canonical.body}\n\n`;
const newCommonLines = [...commonLines.slice(0, insertAt), ...promotedBlock.split('\n'), ...commonLines.slice(insertAt)];
let newCommonContent = newCommonLines.join('\n');

// Bump the version footer: "*context.md version: X.Y — description*" → X.(Y+1)
const versionMatch = newCommonContent.match(/\*context\.md version:\s*(\d+)\.(\d+)(?:\s*—[^*]*)?\*/);
if (versionMatch) {
  const [full, major, minor] = versionMatch;
  const newVersion = `${major}.${Number(minor) + 1}`;
  const newFooter = `*context.md version: ${newVersion} — promoted "${args.heading}" section from ${found.length} variants (${args.variants.join(', ')})*`;
  newCommonContent = newCommonContent.replace(full, newFooter);
  console.log(`📌 docs/context.md version footer: ${major}.${minor} → ${newVersion}`);
} else {
  console.log('  ⚠️  No "*context.md version: X.Y*" footer found — version not bumped, add one manually.');
}

if (!args.dryRun) fs.writeFileSync(COMMON_CONTEXT_MD, newCommonContent, 'utf8');
console.log(`${dryTag}WROTE: templates/common/docs/context.md (inserted after "${args.afterHeading ?? 'Lifecycle Management'}")`);

// ── Remove the section from each variant file ────────────────────────────────────
for (const f of found) {
  const escaped = f.headingLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const sectionRegex = new RegExp(`\\n?${escaped}\\n[\\s\\S]*?(?=\\n#{2,3}\\s|$)`);
  const updated = f.fullContent.replace(sectionRegex, '\n');
  if (!args.dryRun) fs.writeFileSync(f.filePath, updated, 'utf8');
  console.log(`${dryTag}REMOVED: "${args.heading}" section from ${path.relative(WORKSPACE_ROOT, f.filePath)}`);
}

console.log('');
console.log('⚠️  Next steps (not automated by this script):');
console.log('  1. Run: bun scripts/audit.ts — confirm the heading no longer shows as a commonization candidate.');
console.log('  2. Already-scaffolded Projects/*/docs/<variant>.context.md still carry the old duplicated section —');
console.log('     removing it from templates/<variant>/ only fixes future scaffolds. For existing projects, either');
console.log('     manually remove the now-redundant section from their docs/<variant>.context.md, or accept the');
console.log('     duplication until their next unrelated edit touches that section.');
console.log('  3. For each existing project of the affected variants: bun scripts/upgrade-project.ts <path> --dry-run');
console.log('     to pick up the new docs/context.md content (VARIANT_DOCS_SYNC).');
if (args.dryRun) console.log('\nDry run complete — no files written.');
