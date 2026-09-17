#!/usr/bin/env bun
/**
 * lint-instructions.ts — advisory sentence-length probe for ADR-0079
 * instruction text (ticket T-20260917-011; design
 * docs/designs/2026-09-17-instruction-lint-probe-design.md).
 * @version 1.0.0
 *
 * Scans requirement/acceptance sections inside markdown files and flags
 * sentences over the ADR-0079 descriptive limit (25 words). Enforces
 * nothing: the probe never blocks a commit. ADR-0079 keeps enforcement
 * advisory; wiring this into a gate would contradict Decision ¶4.
 *
 * Scope (prototype): requirement sections — headings containing
 * "requirement" or "acceptance" (levels 2-4) — inside docs/designs/*.md
 * by default. Fenced code blocks, table lines, and heading lines are
 * skipped. Bullets and numbered list items are treated as instruction
 * carriers and checked like prose.
 *
 * Known heuristic limits (accepted for an advisory probe): sentence
 * splitting over-splits after abbreviations ("e.g."), which only
 * under-reports; passive voice and idioms are out of scope.
 *
 * Usage:
 *   bun scripts/lint-instructions.ts               (default: docs/designs)
 *   bun scripts/lint-instructions.ts --dir <path>  scan another markdown root
 *   bun scripts/lint-instructions.ts --strict      exit 1 when findings exist
 *   bun scripts/lint-instructions.ts --help
 *
 * Exit codes: 0 (clean or findings without --strict), 1 (--strict with
 * findings), 2 (usage/IO error).
 *
 * @module lint-instructions
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const VERSION = '1.0.0';
const WORD_LIMIT = 25;
const REQUIREMENT_HEADING = /requirement|acceptance/i;
const LIST_MARKER = /^\s*(?:[-*+]|\d+[.)])\s+/;

export interface Finding {
  file: string;
  line: number;
  words: number;
  text: string;
}

interface Section {
  heading: string;
  level: number;
  startLine: number; // 0-based, line after the heading
  endLine: number; // 0-based, exclusive
}

/** Split markdown text into lines. */
function lines(text: string): string[] {
  return text.split(/\r?\n/);
}

/** Heading level of a markdown ATX heading line, or 0 when not a heading. */
function headingLevel(line: string): number {
  const m = /^(#{1,6})\s+/.exec(line);
  return m ? m[1].length : 0;
}

/** True when the heading line names a requirement/acceptance section. */
export function isRequirementHeading(line: string): boolean {
  const level = headingLevel(line);
  return level >= 2 && level <= 4 && REQUIREMENT_HEADING.test(line);
}

/** Collect the line ranges of requirement sections in a document. */
export function extractRequirementSections(text: string): Section[] {
  const ls = lines(text);
  const sections: Section[] = [];
  for (let i = 0; i < ls.length; i++) {
    const level = headingLevel(ls[i]);
    if (level < 2 || level > 4 || !REQUIREMENT_HEADING.test(ls[i])) continue;
    let end = ls.length;
    for (let j = i + 1; j < ls.length; j++) {
      const next = headingLevel(ls[j]);
      if (next > 0 && next <= level) {
        end = j;
        break;
      }
    }
    sections.push({ heading: ls[i], level, startLine: i + 1, endLine: end });
  }
  return sections;
}

/** Strip list markers and inline-code backticks, collapse whitespace. */
function normalize(text: string): string {
  return text
    .replace(LIST_MARKER, '')
    .replace(/`([^`]*)`/g, '$1')
    .trim();
}

/** Count whitespace-separated words. */
export function countWords(sentence: string): number {
  const t = normalize(sentence);
  if (t === '') return 0;
  return t.split(/\s+/).length;
}

/**
 * Split a line into sentences: a terminator (. ! ?) at a token end
 * followed by whitespace. Abbreviations like "e.g." over-split — the
 * probe under-reports rather than false-positives, which is the safe
 * direction for an advisory tool.
 */
export function splitSentences(line: string): string[] {
  const t = normalize(line);
  if (t === '') return [];
  const parts = t.split(/(?<=[.!?])(?=\s+\S)/);
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

/**
 * Lint one document: findings carry 1-based line numbers (as printed)
 * and the normalized sentence text, truncated by the caller.
 */
export function lintDocument(text: string): Omit<Finding, 'file'>[] {
  const ls = lines(text);
  const findings: Omit<Finding, 'file'>[] = [];
  const sections = extractRequirementSections(text);
  for (const section of sections) {
    let inFence = false;
    for (let i = section.startLine; i < section.endLine; i++) {
      const raw = ls[i];
      if (/^\s*```/.test(raw)) {
        inFence = !inFence;
        continue;
      }
      if (inFence) continue;
      if (headingLevel(raw) > 0) continue;
      if (/^\s*\|/.test(raw)) continue; // table rows: structured data
      for (const sentence of splitSentences(raw)) {
        const words = countWords(sentence);
        if (words > WORD_LIMIT) {
          findings.push({ line: i + 1, words, text: sentence });
        }
      }
    }
  }
  return findings;
}

/** Recursively collect .md files under a root (skips dot-directories). */
function collectMarkdown(root: string): string[] {
  const out: string[] = [];
  if (!statSync(root).isDirectory()) {
    return root.endsWith('.md') ? [root] : [];
  }
  for (const entry of readdirSync(root)) {
    if (entry.startsWith('.')) continue;
    const full = join(root, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...collectMarkdown(full));
    else if (entry.endsWith('.md')) out.push(full);
  }
  return out.sort();
}

function printHelp(): void {
  console.log(`lint-instructions.ts v${VERSION} — ADR-0079 advisory sentence-length probe

Usage:
  bun scripts/lint-instructions.ts [--dir <path>] [--strict] [--help]

Default scan root: docs/designs. Scans requirement/acceptance sections and
reports sentences over ${WORD_LIMIT} words as WARN lines. Exit 0 unless --strict.`);
}

function main(): number {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    printHelp();
    return 0;
  }
  const strict = args.includes('--strict');
  const dirIdx = args.indexOf('--dir');
  const root = dirIdx >= 0 ? args[dirIdx + 1] : 'docs/designs';
  if (!root || !existsSync(root)) {
    console.error(`ERROR: scan root not found: ${root}`);
    return 2;
  }

  const files = collectMarkdown(root);
  const all: Finding[] = [];
  for (const file of files) {
    for (const f of lintDocument(readFileSync(file, 'utf-8'))) {
      all.push({ file: relative(process.cwd(), file), ...f });
    }
  }

  const byFile = new Map<string, Finding[]>();
  for (const f of all) {
    const list = byFile.get(f.file) ?? [];
    list.push(f);
    byFile.set(f.file, list);
  }
  for (const [file, list] of byFile) {
    console.log(`\nWARN ${file}: ${list.length} over-limit sentence(s) (> ${WORD_LIMIT} words)`);
    for (const f of list) {
      const preview = f.text.length > 90 ? `${f.text.slice(0, 90)}...` : f.text;
      console.log(`  WARN ${f.file}:${f.line} (${f.words} words): ${preview}`);
    }
  }
  console.log(
    `\n${files.length} file(s) scanned, ${all.length} over-limit sentence(s)` +
      (all.length > 0 ? ` — advisory WARN (ADR-0079 enforcement stays advisory)` : ''),
  );
  if (strict && all.length > 0) return 1;
  return 0;
}

// Test-only import support: run main() only when executed directly.
if (import.meta.main) {
  process.exit(main());
}
