#!/usr/bin/env bun
// @version 1.1.0
// new-requirement.ts - Scaffold a new requirement folder under deliverables/ (RTM Stage 1)
// and register it in deliverables/index.md.
//
// Usage:
//   bun scripts/co-abap/new-requirement.ts "<Requirement Title>" [--module SD|MM|FI|CO|PP|LE|CROSS] [--owner "<name>"]
//   bun scripts/co-abap/new-requirement.ts --help
//
// Creates:
//   deliverables/REQ-NNN-<slug>/01_srs.md             (Stage 1 — SRS)
//   deliverables/REQ-NNN-<slug>/05_unit_test_plan.md  (Stage 4 — test plan, filled during the run)
//   deliverables/REQ-NNN-<slug>/06_release_report.md  (Stage 5 — release closure, filled at the end)
//   (copied from deliverables/templates/<file>, placeholders filled with REQ-NNN / title)
//
// Appends a row to the RTM table in deliverables/index.md with Stage 1 / status Draft.
//
// Referenced by: /triage (Step 7 — for requests classified as new functional scope)
// Design: docs/designs/2026-09-26-new-requirement-scaffolding-design.md

import path from "node:path";
import * as fs from "node:fs";

const scriptDir = path.dirname(import.meta.path);
const defaultProjectRoot = path.resolve(scriptDir, "..", "..");

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

const USAGE = `Usage: bun scripts/co-abap/new-requirement.ts "<Requirement Title>" [--module SD|MM|FI|CO|PP|LE|CROSS] [--owner "<name>"]`;

/** Standard documents pre-created for every requirement (Stage 1, 4, 5). */
const SCAFFOLD_FILES = ["01_srs.md", "05_unit_test_plan.md", "06_release_report.md"];

function fill(template: string, reqId: string, title: string): string {
  return template
    .replace(/REQ-NNN/g, reqId)
    .replace(/\[Requirement Title\]/g, title)
    .replace(/\[Requirement Name\]/g, title);
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 40);
}

function nextReqId(deliverablesDir: string): string {
  if (!fs.existsSync(deliverablesDir)) return "REQ-001";
  const existing = fs
    .readdirSync(deliverablesDir)
    .filter((f) => /^REQ-\d{3}-/.test(f))
    .map((f) => parseInt(f.match(/^REQ-(\d{3})-/)![1], 10));
  const maxId = existing.length > 0 ? Math.max(...existing) : 0;
  return `REQ-${(maxId + 1).toString().padStart(3, "0")}`;
}

function insertRtmRow(
  indexContent: string,
  reqId: string,
  title: string,
  module: string,
  owner: string,
  folderName: string
): string {
  // Preserve the file's existing line-ending convention (CRLF on Windows checkouts, LF otherwise).
  const eol = indexContent.includes("\r\n") ? "\r\n" : "\n";
  const row = `| **${reqId}** | ${title} | ${module} | Stage 1 | ${owner} | Draft | [Link](./${folderName}/) |  |  |${eol}`;
  // Match the header separator row regardless of line-ending style.
  const headerRowPattern = /\| :---(?: \| :---)+ \|\r?\n/;
  const match = headerRowPattern.exec(indexContent);
  if (!match) {
    // Fallback: append at end of file if the table shape ever changes
    return indexContent + eol + row;
  }
  const insertAt = match.index + match[0].length;
  return indexContent.slice(0, insertAt) + row + indexContent.slice(insertAt);
}

function scaffoldRequirement(
  projectRoot: string,
  title: string,
  module: string,
  owner: string
): { reqId: string; folderPath: string; scaffolded: string[] } {
  const deliverablesDir = path.join(projectRoot, "deliverables");
  const templatesDir = path.join(deliverablesDir, "templates");
  const indexPath = path.join(deliverablesDir, "index.md");

  const reqId = nextReqId(deliverablesDir);
  const slug = slugify(title);
  const folderName = `${reqId}-${slug}`;
  const folderPath = path.join(deliverablesDir, folderName);

  fs.mkdirSync(folderPath, { recursive: true });

  const scaffolded: string[] = [];
  for (const file of SCAFFOLD_FILES) {
    const templatePath = path.join(templatesDir, file);
    if (!fs.existsSync(templatePath)) {
      console.log(`${YELLOW}⚠️  deliverables/templates/${file} not found — skipped.${RESET}`);
      continue;
    }
    const template = fs.readFileSync(templatePath, "utf-8");
    fs.writeFileSync(path.join(folderPath, file), fill(template, reqId, title), "utf-8");
    scaffolded.push(file);
  }

  if (fs.existsSync(indexPath)) {
    const indexContent = fs.readFileSync(indexPath, "utf-8");
    const updated = insertRtmRow(indexContent, reqId, title, module, owner, folderName);
    fs.writeFileSync(indexPath, updated, "utf-8");
  } else {
    console.log(`${YELLOW}⚠️  deliverables/index.md not found — skipping RTM row insertion.${RESET}`);
  }

  return { reqId, folderPath, scaffolded };
}

/** Flags that take a value — used to exclude "--flag value" pairs from the title. */
const VALUE_FLAGS = ["--module", "--owner"];
const HELP_FLAGS = ["--help", "-h"];

function parseArgs(args: string[]): { title: string; module: string; owner: string } {
  const titleParts: string[] = [];
  let module = "CROSS";
  let owner = "TBD";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--module" && args[i + 1]) {
      module = args[i + 1];
      i++;
    } else if (args[i] === "--owner" && args[i + 1]) {
      owner = args[i + 1];
      i++;
    } else if (!VALUE_FLAGS.includes(args[i]) && !HELP_FLAGS.includes(args[i])) {
      titleParts.push(args[i]);
    }
  }

  return { title: titleParts.join(" ").trim(), module, owner };
}

async function main() {
  const args = process.argv.slice(2);

  if (args.some((a) => HELP_FLAGS.includes(a))) {
    console.log(USAGE);
    console.log("Scaffolds 01_srs.md, 05_unit_test_plan.md, 06_release_report.md and adds the RTM row.");
    return;
  }

  const { title, module, owner } = parseArgs(args);

  if (!title) {
    console.error(`${RED}${USAGE}${RESET}`);
    process.exit(1);
  }

  const { reqId, folderPath, scaffolded } = scaffoldRequirement(defaultProjectRoot, title, module, owner);

  console.log(`${GREEN}✓ Created ${reqId}: ${title}${RESET}`);
  console.log(`  Folder: ${path.relative(defaultProjectRoot, folderPath)}`);
  console.log(`  Scaffolded: ${scaffolded.join(", ") || "(none — templates missing)"}`);
  console.log(`  RTM row added to deliverables/index.md (Stage 1 / Draft).`);
}

if (import.meta.main) {
  main().catch((e) => {
    console.error(`new-requirement: ${e}`);
    process.exit(1);
  });
}

export { main, slugify, nextReqId, insertRtmRow, scaffoldRequirement, parseArgs };
