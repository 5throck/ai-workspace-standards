#!/usr/bin/env bun
/**
 * design-lint.ts — Token SSOT compliance lint (runnable companion to the
 * token-usage-lint skill).
 * @version 1.0.0
 *
 * Scans UI source files for hardcoded design values that bypass the tokens.json
 * SSOT: raw hex colors, rgb()/rgba()/hsl()/hsla() literals, and raw px lengths.
 * Implements the detection rules, exempt paths, and classification scheme
 * documented in skills/token-usage-lint/SKILL.md.
 *
 * Findings are classified:
 *   false-positive          URL fragments / anchor ids / non-styling hex — never a failure
 *   one-off (documented)    value carries a design-token-exempt: <reason> comment — never a failure
 *   should-be-token         everything else — FAILS the lint (exit 1)
 *
 * Inline suppression: append a `design-token-exempt: <reason>` comment on the
 * same line as the literal (CSS block comments and JS line comments both work).
 *
 * Exempt paths (never scanned): generated compiler output dirs (generated/),
 * tokens.json / tokens.css / tokens.ts, node_modules/, dist/, .git/.
 *
 * Usage:
 *   bun scripts/design-lint.ts [paths...]            (default: ./playground/src ./src)
 *   bun scripts/design-lint.ts --dir <path> ...      explicit scan roots
 *   bun scripts/design-lint.ts --help
 *
 * Exit codes: 0 (clean or only false positives / documented one-offs), 1 (should-be-token findings).
 *
 * @module design-lint
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const VERSION = "1.0.0";

/** Scanned file extensions */
const SCAN_EXTENSIONS = new Set([".css", ".ts", ".tsx", ".js", ".jsx", ".html", ".vue", ".svelte"]);

/** Directory names never scanned */
const EXCLUDED_DIRS = new Set(["node_modules", "dist", "build", ".git", "generated"]);

/** File basenames never scanned (compiler outputs + SSOT) */
const EXCLUDED_FILES = new Set(["tokens.json", "tokens.css", "tokens.ts"]);

/** Detection patterns: [name, regex, falsePositivePredicate] */
const PATTERNS: Array<{ name: string; regex: RegExp; falsePositive?: (match: string, line: string) => boolean }> = [
  {
    name: "hex-color",
    // 3-8 digit hex literal; URL fragments and anchor ids are filtered by the check below
    regex: /#[0-9a-fA-F]{3,8}\b/g,
    falsePositive: (match, line) =>
      /(?:href|src)\s*=\s*["']#/.test(line) && !/(?:color|background|border|fill|stroke)/i.test(line),
  },
  {
    name: "color-function",
    regex: /\b(?:rgba?|hsla?)\([^)]*\)/g,
  },
  {
    name: "raw-px-length",
    // raw px lengths; 0px/1px are tolerated (zero-value, hairline borders)
    regex: /(?<![\w-])\d+(?:\.\d+)?px\b/g,
    falsePositive: (match) => match === "0px" || match === "1px",
  },
];

const EXEMPT_COMMENT = "design-token-exempt:";

interface Finding {
  file: string;
  line: number;
  pattern: string;
  match: string;
  classification: "false-positive" | "one-off (documented)" | "should-be-token";
  suppression?: string;
}

function parseArgs(): { dirs: string[]; help: boolean } {
  const args = process.argv.slice(2);
  const dirs: string[] = [];
  let help = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--help" || args[i] === "-h") help = true;
    else if (args[i] === "--dir") dirs.push(args[++i]);
    else dirs.push(args[i]);
  }
  return { dirs, help };
}

function printHelp(): void {
  console.log(`design-lint.ts v${VERSION} — token SSOT compliance lint

Usage:
  bun scripts/design-lint.ts [paths...]        scan roots (default: ./playground/src ./src)
  bun scripts/design-lint.ts --dir <path>      explicit scan root (repeatable)
  bun scripts/design-lint.ts --help

Detection: raw hex colors, rgb()/rgba()/hsl()/hsla() literals, raw px lengths
(exemptions: 0px/1px, URL fragments, files/paths listed in the header).

Suppression: append "design-token-exempt: <reason>" on the same line.

Exit codes: 0 = clean, 1 = should-be-token findings.`);
}

function* walkFiles(dir: string): Generator<string> {
  if (!existsSync(dir)) return;
  const stat = statSync(dir);
  if (stat.isFile()) {
    yield dir;
    return;
  }
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      yield* walkFiles(full);
    } else if (entry.isFile()) {
      if (EXCLUDED_FILES.has(entry.name)) continue;
      const dot = entry.name.lastIndexOf(".");
      if (dot === -1 || !SCAN_EXTENSIONS.has(entry.name.slice(dot))) continue;
      yield full;
    }
  }
}

function extractExemption(line: string): string | undefined {
  const idx = line.indexOf(EXEMPT_COMMENT);
  if (idx === -1) return undefined;
  return line.slice(idx + EXEMPT_COMMENT.length).trim();
}

function lintFile(file: string, root: string): Finding[] {
  const findings: Finding[] = [];
  let content: string;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    return findings;
  }
  const lines = content.split(/\r?\n/);
  lines.forEach((line, i) => {
    const exemption = extractExemption(line);
    for (const { name, regex, falsePositive } of PATTERNS) {
      for (const m of line.matchAll(regex)) {
        let classification: Finding["classification"];
        if (falsePositive?.(m[0], line)) {
          classification = "false-positive";
        } else if (exemption) {
          classification = "one-off (documented)";
        } else {
          classification = "should-be-token";
        }
        findings.push({
          file: relative(root, file) || file,
          line: i + 1,
          pattern: name,
          match: m[0],
          classification,
          suppression: exemption,
        });
      }
    }
  });
  return findings;
}

export async function main(): Promise<void> {
  const { dirs, help } = parseArgs();
  if (help) {
    printHelp();
    process.exit(0);
  }

  const roots = dirs.length > 0 ? dirs : ["./playground/src", "./src"].filter((d) => existsSync(d));
  if (roots.length === 0) {
    console.log("design-lint: no scan roots found (looked for ./playground/src, ./src) — nothing to do.");
    process.exit(0);
  }

  const all: Finding[] = [];
  for (const root of roots) {
    if (!existsSync(root)) {
      console.warn(`⚠️  design-lint: scan root "${root}" does not exist — skipped.`);
      continue;
    }
    for (const file of walkFiles(root)) {
      all.push(...lintFile(file, root));
    }
  }

  const shouldCount = all.filter((f) => f.classification === "should-be-token").length;
  const oneOffCount = all.filter((f) => f.classification === "one-off (documented)").length;
  const falsePosCount = all.filter((f) => f.classification === "false-positive").length;

  if (all.length > 0) {
    console.log("| file:line | pattern | match | classification | note |");
    console.log("|---|---|---|---|---|");
    for (const f of all) {
      console.log(`| ${f.file}:${f.line} | ${f.pattern} | ${f.match} | ${f.classification} | ${f.suppression ?? ""} |`);
    }
  }

  const verdict = shouldCount > 0 ? "NEEDS REMEDIATION" : "CLEAN";
  console.log(
    `design-lint v${VERSION}: ${all.length} finding(s) (${shouldCount} should-be-token, ${oneOffCount} one-off, ${falsePosCount} false positive) - ${verdict}`
  );

  process.exit(shouldCount > 0 ? 1 : 0);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("❌ Fatal design-lint error:", err);
    process.exit(1);
  });
}
