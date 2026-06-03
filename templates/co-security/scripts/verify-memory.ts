#!/usr/bin/env bun
/**
 * verify-memory.ts — Memory Log Format Verifier
 * @version 1.0.0
 *
 * Validates that memory/*.md session logs follow the mandatory 4-section format
 * and that MEMORY.md index is in sync with actual files on disk.
 *
 * Usage:
 *   bun scripts/verify-memory.ts --verify    # CI / pre-commit: fail on violations
 *   bun scripts/verify-memory.ts --report    # Human-readable status report
 *
 * Exit codes:
 *   0 = all checks passed
 *   1 = format violations or orphaned files detected
 */

import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";

// ── Configuration ────────────────────────────────────────────────────────────

const REQUIRED_SECTIONS = [
  "## Session Summary",
  "## Changes",
  "## Decisions",
  "## Open Issues",
];

// Files that are exempt from 4-section format (meetings, ADRs, index)
const EXEMPT_PATTERNS = [
  /^MEMORY\.md$/,
  /^meeting-/,
  /^adr-/,
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}-.*-meeting/,
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function isExempt(filename: string): boolean {
  return EXEMPT_PATTERNS.some((p) => p.test(filename));
}

function getMemoryDir(): string {
  // Resolve from script location upward to workspace root
  let dir = import.meta.dir;
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, "memory");
    if (existsSync(candidate)) return candidate;
    dir = join(dir, "..");
  }
  // Fallback: cwd/memory
  return join(process.cwd(), "memory");
}

function parseMemoryIndex(content: string): Set<string> {
  const registered = new Set<string>();
  const lines = content.split("\n");
  for (const line of lines) {
    // Match markdown link patterns: [filename](filename) or [date](date.md)
    const match = line.match(/\[([^\]]+)\]\(([^)]+\.md)\)/g);
    if (match) {
      for (const m of match) {
        const inner = m.match(/\(([^)]+)\)/);
        if (inner) registered.add(inner[1]);
      }
    }
  }
  return registered;
}

interface SessionEntry {
  heading: string;
  startLine: number;
  missingSections: string[];
}

function validateSessionFile(filepath: string): SessionEntry[] {
  const content = readFileSync(filepath, "utf-8");
  const entries: SessionEntry[] = [];

  // Split by --- separator to get individual entries
  const blocks = content.split(/\n---\n/);

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    // Find the first ## heading (session entry heading)
    const headingMatch = trimmed.match(/^## (.+)/m);
    if (!headingMatch) continue;
    const heading = headingMatch[1].trim();

    // Check for required sections
    const missing: string[] = [];
    for (const section of REQUIRED_SECTIONS) {
      if (!trimmed.includes(section)) {
        missing.push(section);
      }
    }

    if (missing.length > 0) {
      entries.push({ heading, startLine: 0, missingSections: missing });
    }
  }

  return entries;
}

// ── Verify Mode ──────────────────────────────────────────────────────────────

function verify(explicitFiles?: string[]): boolean {
  let passed = true;
  const errors: string[] = [];
  const warnings: string[] = [];

  const memDir = getMemoryDir();
  if (!existsSync(memDir)) {
    console.log("ℹ️  memory/ directory not found — nothing to verify");
    return true;
  }

  const memoryMdPath = join(memDir, "MEMORY.md");

  // If explicit files provided (e.g. from pre-commit staged list), check only those
  let allFiles: string[];
  if (explicitFiles && explicitFiles.length > 0) {
    allFiles = explicitFiles
      .map((f) => f.replace(/^memory\//, ""))
      .filter((f) => f.endsWith(".md") && existsSync(join(memDir, f)) && !f.includes("archive"));
  } else {
    allFiles = readdirSync(memDir).filter((f) => f.endsWith(".md") && !f.includes("archive"));
  }

  const sessionFiles = allFiles.filter(
    (f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f)
  );
  const otherFiles = allFiles.filter(
    (f) => !isExempt(f) && !/^\d{4}-\d{2}-\d{2}\.md$/.test(f)
  );

  // Check 1: Format validation for session files
  // When explicit files are provided (pre-commit mode), only check the LAST entry
  // (new entries are appended; existing committed entries are not re-validated)
  const lastEntryOnly = explicitFiles !== undefined && explicitFiles.length > 0;

  for (const file of sessionFiles) {
    const filepath = join(memDir, file);
    if (lastEntryOnly) {
      // Only validate the last entry (most recently appended)
      const content = readFileSync(filepath, "utf-8");
      const blocks = content.split(/\n---\n/);
      const lastBlock = blocks[blocks.length - 1]?.trim();
      if (!lastBlock) continue;

      const headingMatch = lastBlock.match(/^## (.+)/m);
      if (!headingMatch) continue;
      const heading = headingMatch[1].trim();

      const missing = REQUIRED_SECTIONS.filter((s) => !lastBlock.includes(s));
      if (missing.length > 0) {
        errors.push(
          `Format violation in \`${file}\` — latest entry "${heading}" missing sections: ${missing.join(", ")}`
        );
      }
    } else {
      const violations = validateSessionFile(filepath);
      for (const v of violations) {
        errors.push(
          `Format violation in \`${file}\` — entry "${v.heading}" missing sections: ${v.missingSections.join(", ")}`
        );
      }
    }
  }

  // Check 2: Format validation for non-exempt non-session files
  for (const file of otherFiles) {
    const filepath = join(memDir, file);
    const violations = validateSessionFile(filepath);
    for (const v of violations) {
      warnings.push(
        `Format warning in \`${file}\` — entry "${v.heading}" missing sections: ${v.missingSections.join(", ")}`
      );
    }
  }

  // Check 3: Orphaned files (on disk but not in MEMORY.md Sessions section)
  if (existsSync(memoryMdPath)) {
    const indexContent = readFileSync(memoryMdPath, "utf-8");
    const registered = parseMemoryIndex(indexContent);

    for (const file of sessionFiles) {
      if (!registered.has(file)) {
        warnings.push(
          `Orphaned session file: \`${file}\` — not registered in MEMORY.md Sessions section`
        );
      }
    }
  } else {
    warnings.push("MEMORY.md not found — run `bash scripts/sync-md.sh` to initialize");
  }

  // Output
  console.log(`\n=== verify-memory.ts ===`);
  console.log(`Memory dir: ${memDir}`);
  console.log(`Session files: ${sessionFiles.length}\n`);

  if (warnings.length > 0) {
    for (const w of warnings) console.warn(`⚠️  ${w}`);
    console.log();
  }

  if (errors.length > 0) {
    for (const e of errors) console.error(`❌ ${e}`);
    console.log(`\n❌ ${errors.length} error(s) found — fix format violations before committing`);
    passed = false;
  } else {
    console.log(
      `✅ Memory format valid (${sessionFiles.length} session files, ${warnings.length} warning(s))`
    );
  }

  return passed;
}

// ── Report Mode ──────────────────────────────────────────────────────────────

function report(): void {
  const memDir = getMemoryDir();
  if (!existsSync(memDir)) {
    console.log("ℹ️  memory/ directory not found");
    return;
  }

  const allFiles = readdirSync(memDir).filter((f) => f.endsWith(".md"));
  const sessionFiles = allFiles
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .sort();
  const meetingFiles = allFiles.filter((f) => f.startsWith("meeting-")).sort();
  const adrFiles = allFiles.filter((f) => f.startsWith("adr-")).sort();

  console.log(`\n=== Memory Log Report ===`);
  console.log(`Date: ${new Date().toISOString().slice(0, 10)}`);
  console.log(`Dir:  ${memDir}\n`);

  console.log(`📅 Sessions (${sessionFiles.length})`);
  for (const f of sessionFiles) {
    const violations = validateSessionFile(join(memDir, f));
    const marker = violations.length > 0 ? "❌" : "✅";
    const note = violations.length > 0 ? ` — ${violations.length} format issue(s)` : "";
    console.log(`   ${marker} ${f}${note}`);
  }

  if (meetingFiles.length > 0) {
    console.log(`\n🗣️  Meetings (${meetingFiles.length})`);
    for (const f of meetingFiles) console.log(`   📋 ${f}`);
  }

  if (adrFiles.length > 0) {
    console.log(`\n📐 ADRs (${adrFiles.length})`);
    for (const f of adrFiles) console.log(`   📄 ${f}`);
  }

  console.log();
}

// ── Entry Point ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
// Any non-flag arguments are treated as explicit file paths to check
const fileArgs = args.filter((a) => !a.startsWith("--"));

if (args.includes("--report")) {
  report();
} else if (args.includes("--verify") || args.length === 0 || fileArgs.length > 0) {
  const ok = verify(fileArgs.length > 0 ? fileArgs : undefined);
  process.exit(ok ? 0 : 1);
} else {
  console.error(`Usage: bun scripts/verify-memory.ts [--verify | --report] [file...]`);
  process.exit(1);
}
