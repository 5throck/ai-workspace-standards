#!/usr/bin/env bun
// @version 1.0.0
// v1.0.0 (2026-10-31, T-20261031-003 — spec
//          docs/designs/2026-10-31-changelog-normalize-design.md): initial.
//          Gate-carried migration path for the dev-sync step 3b CHANGELOG
//          structural-duplicate gate (helpers/changelog-duplicates.ts
//          changelogGateFindings — the findings source this healer consumes,
//          so detector and healer can never disagree about what a defect is).
//          Structure-only repair: duplicate `### <Category>` blocks collapse
//          into the first occurrence's position, and all `[Unreleased]`-family
//          sections (`## [Unreleased]`, dated variants `## [Unreleased]
//          YYYY-MM-DD`) merge into ONE canonical `## [Unreleased]` at the
//          position of the first. Entry lines are never edited; frontmatter
//          (`lang: ko` / `lang_reason: legal`) and the pre-first-`## `
//          preamble are preserved byte-identical. Idempotent
//          (normalize(normalize(x)) == normalize(x)); zero findings means
//          byte-untouched output. CRLF-safe (original line endings preserved).
/**
 * changelog-normalize.ts — CHANGELOG structural normalizer for the dev-sync
 * step 3b gate (T-20261031-003 — spec
 * docs/designs/2026-10-31-changelog-normalize-design.md).
 *
 * The step-3b gate (dev-sync v1.35.0) FAILs on any finding from
 * changelogGateFindings with no migration path; on the 2026-10-31 wave run 6
 * of 11 projects hit it and the wave halted. This script is the healer half
 * of the fail-then-heal loop (design §4): dev-sync detects findings, runs
 * this script in write mode, re-stages, and re-runs the detector to assert
 * zero findings before the gate verdict. Files with zero findings are never
 * touched.
 *
 * Pure core, exported for unit tests:
 *   normalizeChangelog(text): { text, repaired }
 *
 * CLI modes (design §5.7):
 *   bun scripts/changelog-normalize.ts <file>            # write mode (default)
 *   bun scripts/changelog-normalize.ts <file> --dry-run  # print unified diff, write nothing
 *   bun scripts/changelog-normalize.ts <file> --check    # exit 0 when zero findings (read-only)
 *
 * Exit codes: 0 = clean or repairable-and-repaired; 1 = findings would
 * remain after normalization, or file/usage error.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { die } from './lib/error-handling.ts';
import { changelogGateFindings } from './helpers/changelog-duplicates.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Pure core
// ─────────────────────────────────────────────────────────────────────────────

/** Result of one normalization pass. `repaired === false` guarantees `text` is the input verbatim. */
export interface NormalizeResult {
  text: string;
  repaired: boolean;
}

/** One `### <Category>` block inside a release section. */
interface CategoryBlock {
  /** Verbatim heading line of the FIRST occurrence (kept as-is). */
  heading: string;
  /** Detector's matching key: heading text after `### `, trimmed. */
  key: string;
  /** Raw content lines (entries, blanks) following the heading. */
  content: string[];
}

/** Raw pre-category lines and category blocks of one section body. */
interface SectionBlocks {
  pre: string[];
  cats: CategoryBlock[];
}

interface RawSection {
  header: string;
  body: string[];
}

/** The detector's own section-start rule (helpers/changelog-duplicates.ts) — never re-derived here. */
const SECTION_RE = /^##\s+\S/;
/** The detector's own category-heading rule. */
const CATEGORY_RE = /^###\s+\S/;
/** The detector's own `[Unreleased]`-family rule (dated variants are the same logical section). */
const UNRELEASED_RE = /^##\s*\[Unreleased\]/;

/** Canonical heading every `[Unreleased]`-family section merges into. */
const CANONICAL_UNRELEASED = '## [Unreleased]';

function categoryKey(line: string): string {
  return line.replace(/^###\s+/, '').trim();
}

/** Split a CHANGELOG body into preamble + `## ` release sections (detector-equivalent parsing). */
function parseSections(lines: string[]): { preamble: string[]; sections: RawSection[] } {
  const starts: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (SECTION_RE.test(lines[i])) starts.push(i);
  }
  const preamble = starts.length > 0 ? lines.slice(0, starts[0]) : lines.slice();
  const sections: RawSection[] = [];
  for (let s = 0; s < starts.length; s++) {
    const from = starts[s];
    const to = s + 1 < starts.length ? starts[s + 1] : lines.length;
    sections.push({ header: lines[from], body: lines.slice(from + 1, to) });
  }
  return { preamble, sections };
}

/** Parse one section body into raw pre-category lines and category blocks. */
function parseBlocks(body: string[]): SectionBlocks {
  const pre: string[] = [];
  const cats: CategoryBlock[] = [];
  let current: CategoryBlock | null = null;
  for (const line of body) {
    if (CATEGORY_RE.test(line)) {
      current = { heading: line, key: categoryKey(line), content: [] };
      cats.push(current);
      continue;
    }
    if (current) current.content.push(line);
    else pre.push(line);
  }
  return { pre, cats };
}

/**
 * Collapse duplicate category blocks to the first occurrence's position:
 * entries of every later duplicate append under the merged heading in their
 * original relative order. Heading lines of first occurrences are verbatim.
 */
function collapseCategories(blocks: SectionBlocks): SectionBlocks {
  const merged: CategoryBlock[] = [];
  const byKey = new Map<string, CategoryBlock>();
  for (const cat of blocks.cats) {
    const first = byKey.get(cat.key);
    if (first === undefined) {
      byKey.set(cat.key, cat);
      merged.push(cat);
    } else {
      // Both sides are tidied: each block's trailing blank is its separator
      // toward the next heading (structural, not content) — appended entries
      // join the merged block tightly; intra-block blank runs survive.
      first.content = [...tidy(first.content), ...tidy(cat.content)];
    }
  }
  return { pre: blocks.pre, cats: merged };
}

/** True when a section body repeats a category heading (detector-equivalent keying). */
function hasDuplicateCategories(body: string[]): boolean {
  const counts = new Map<string, number>();
  for (const line of body) {
    if (CATEGORY_RE.test(line)) {
      const key = categoryKey(line);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  for (const count of counts.values()) {
    if (count > 1) return true;
  }
  return false;
}

/** Drop edge blanks, collapse interior blank runs to one. Blank-line-only normalization. */
function tidy(lines: string[]): string[] {
  const body = lines.slice();
  while (body.length > 0 && body[0].trim() === '') body.shift();
  while (body.length > 0 && body[body.length - 1].trim() === '') body.pop();
  const out: string[] = [];
  let prevBlank = false;
  for (const line of body) {
    if (line.trim() === '') {
      if (!prevBlank) out.push('');
      prevBlank = true;
    } else {
      out.push(line);
      prevBlank = false;
    }
  }
  return out;
}

/** Canonical emission of a repaired section body (deterministic blank-line layout). */
function emitBlocks(blocks: SectionBlocks): string[] {
  const lines: string[] = [];
  const pre = tidy(blocks.pre);
  lines.push(...pre);
  for (const cat of blocks.cats) {
    lines.push('');
    lines.push(cat.heading);
    const content = tidy(cat.content);
    if (content.length > 0) {
      lines.push('');
      lines.push(...content);
    }
  }
  return tidy(lines);
}

/** Structural repair. Only called when changelogGateFindings(text) is non-empty. */
function repair(text: string): string {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const endsWithNewline = text.endsWith('\n');
  const lines = text.split(/\r?\n/);
  if (endsWithNewline) lines.pop();

  const { preamble, sections } = parseSections(lines);
  if (sections.length === 0) return text; // findings impossible without sections; defensive no-op

  // Merge all [Unreleased]-family sections into one canonical section at the
  // position of the first (detector: dated variants are the same logical
  // section). Released sections are never renamed or reordered.
  const unreleased = sections
    .map((section, index) => ({ section, index }))
    .filter(({ section }) => UNRELEASED_RE.test(section.header.trim()));
  let mergedBlocks: SectionBlocks | null = null;
  if (unreleased.length > 1) {
    mergedBlocks = { pre: [], cats: [] };
    for (const { section } of unreleased) {
      const blocks = parseBlocks(section.body);
      // Tidy per section BEFORE concatenating: each section's trailing blank
      // (its separator toward the next header) is structural, not content —
      // merged groups concatenate tightly; intra-section blank runs survive.
      mergedBlocks.pre.push(...tidy(blocks.pre));
      for (const cat of blocks.cats) {
        mergedBlocks.cats.push({ heading: cat.heading, key: cat.key, content: tidy(cat.content) });
      }
    }
  }

  interface Chunk {
    lines: string[];
    rebuilt: boolean;
  }
  const chunks: Chunk[] = [];
  let mergePlaced = false;
  for (let i = 0; i < sections.length; i++) {
    const isUnreleased = UNRELEASED_RE.test(sections[i].header.trim());
    if (isUnreleased && mergedBlocks !== null) {
      if (!mergePlaced) {
        mergePlaced = true;
        const body = emitBlocks(collapseCategories(mergedBlocks));
        chunks.push({ lines: [CANONICAL_UNRELEASED, ...(body.length > 0 ? ['', ...body] : [])], rebuilt: true });
      }
      continue; // later duplicates are consumed by the merged section
    }
    if (hasDuplicateCategories(sections[i].body)) {
      const body = emitBlocks(collapseCategories(parseBlocks(sections[i].body)));
      chunks.push({ lines: [sections[i].header, ...(body.length > 0 ? ['', ...body] : [])], rebuilt: true });
    } else {
      // Untouched section: byte-identical (header + body verbatim).
      chunks.push({ lines: [sections[i].header, ...sections[i].body], rebuilt: false });
    }
  }

  const out: string[] = [];
  out.push(...preamble);
  let prevRebuilt = false;
  for (const chunk of chunks) {
    if (chunk.rebuilt || prevRebuilt) {
      // Normalize the seam to exactly one blank line (blank-line-only churn).
      while (out.length > 0 && out[out.length - 1].trim() === '') out.pop();
      if (out.length > 0) out.push('');
    }
    out.push(...chunk.lines);
    prevRebuilt = chunk.rebuilt;
  }

  const joined = out.join(eol);
  return endsWithNewline ? joined + eol : joined;
}

/**
 * Normalize a CHANGELOG body. Zero findings → `{ text, repaired: false }`
 * with the input returned byte-identical (the dev-sync zero-write invariant).
 * Any findings → structure-only repair; entry lines and the preamble are
 * preserved; idempotent by construction (repair output has zero findings).
 */
export function normalizeChangelog(text: string): NormalizeResult {
  const findings = changelogGateFindings(text);
  if (findings.length === 0) {
    return { text, repaired: false };
  }
  return { text: repair(text), repaired: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Unified diff (internal, dependency-free — LCS line diff with 3 context lines)
// ─────────────────────────────────────────────────────────────────────────────

function unifiedDiff(before: string, after: string, file: string): string {
  const a = before.split('\n');
  const b = after.split('\n');
  // LCS table (changelog-sized files; O(n*m) is fine here).
  const n = a.length;
  const m = b.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const ops: Array<{ type: ' ' | '-' | '+'; line: string }> = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ type: ' ', line: a[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      ops.push({ type: '-', line: a[i] });
      i++;
    } else {
      ops.push({ type: '+', line: b[j] });
      j++;
    }
  }
  while (i < n) ops.push({ type: '-', line: a[i++] });
  while (j < m) ops.push({ type: '+', line: b[j++] });

  const CONTEXT = 3;
  const hunks: string[] = [];
  let idx = 0;
  while (idx < ops.length) {
    if (ops[idx].type === ' ') {
      idx++;
      continue;
    }
    const start = Math.max(0, idx - CONTEXT);
    let end = idx;
    let trailing = 0;
    let k = idx;
    while (k < ops.length) {
      if (ops[k].type !== ' ') {
        end = k;
        trailing = 0;
      } else {
        trailing++;
        if (trailing > CONTEXT) break;
      }
      k++;
    }
    end = Math.min(ops.length - 1, end + Math.min(trailing, CONTEXT));
    const slice = ops.slice(start, end + 1);
    let aStart = 1;
    let bStart = 1;
    for (let t = 0; t < start; t++) {
      if (ops[t].type !== '+') aStart++;
      if (ops[t].type !== '-') bStart++;
    }
    const aCount = slice.filter((o) => o.type !== '+').length;
    const bCount = slice.filter((o) => o.type !== '-').length;
    hunks.push(
      `@@ -${aStart},${aCount} +${bStart},${bCount} @@\n` +
        slice.map((o) => `${o.type} ${o.line}`).join('\n'),
    );
    idx = end + 1;
  }
  if (hunks.length === 0) return '';
  return `--- a/${file}\n+++ b/${file}\n${hunks.join('\n')}\n`;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI wrapper
// ─────────────────────────────────────────────────────────────────────────────

function printFindings(findings: ReturnType<typeof changelogGateFindings>): void {
  for (const f of findings) {
    console.log(`  • [${f.kind}] ${f.message}`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((a) => a !== '--dry-run' && a !== '--check');
  const dryRun = process.argv.includes('--dry-run');
  const checkOnly = process.argv.includes('--check');
  const file = args[0];

  if (!file || args.length !== 1) {
    die('usage: bun scripts/changelog-normalize.ts <file> [--dry-run | --check]');
  }
  if (!existsSync(file)) {
    die(`file not found: ${file}`);
  }

  const before = readFileSync(file, 'utf-8');
  const findingsBefore = changelogGateFindings(before);

  // --check: read-only operator smoke check — exit 0 when zero findings.
  if (checkOnly) {
    if (findingsBefore.length === 0) {
      console.log(`OK: ${file} — no CHANGELOG structural findings.`);
      process.exit(0);
    }
    console.log(`FAIL: ${file} — ${findingsBefore.length} structural finding(s):`);
    printFindings(findingsBefore);
    process.exit(1);
  }

  const { text: after, repaired } = normalizeChangelog(before);
  const findingsAfter = changelogGateFindings(after);

  if (!repaired) {
    console.log(`OK: ${file} — already clean (0 findings); untouched.`);
    process.exit(0);
  }

  if (dryRun) {
    const diff = unifiedDiff(before, after, file);
    if (diff.length > 0) process.stdout.write(diff);
    if (findingsAfter.length > 0) {
      console.log(`\nFAIL: normalization would leave ${findingsAfter.length} finding(s) — repair by hand.`);
      printFindings(findingsAfter);
      process.exit(1);
    }
    console.log(`\ndry-run: repair possible (${findingsBefore.length} finding(s) would be fixed); nothing written.`);
    process.exit(0);
  }

  // Write mode.
  writeFileSync(file, after, 'utf-8');
  if (findingsAfter.length > 0) {
    console.log(`FAIL: ${file} normalized but ${findingsAfter.length} finding(s) remain — repair by hand.`);
    printFindings(findingsAfter);
    process.exit(1);
  }
  console.log(`OK: ${file} normalized — ${findingsBefore.length} finding(s) repaired (structure-only edit).`);
  process.exit(0);
}

if (import.meta.main) {
  main().catch((e) => die(`changelog-normalize failed: ${e instanceof Error ? e.message : String(e)}`));
}
