#!/usr/bin/env bun
// new-requirement.ts - Scaffold a new requirement folder under deliverables/ (RTM Stage 1)
// and register it in deliverables/index.md.
//
// Usage:
//   bun scripts/new-requirement.ts "<Requirement Title>" [--module SD|MM|FI|CO|PP|LE|CROSS] [--owner "<name>"]
//
// Creates:
//   deliverables/REQ-NNN-<slug>/01_srs.md   (copied from deliverables/templates/01_srs.md,
//                                             placeholders filled with REQ-NNN / title)
// Appends a row to the RTM table in deliverables/index.md with Stage 1 / status Draft.
//
// Referenced by: /triage (Step 7 — for requests classified as new functional scope)

import path from "node:path";
import * as fs from "node:fs";

const scriptDir = path.dirname(import.meta.path);
const defaultProjectRoot = path.resolve(scriptDir, "..");

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

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
): { reqId: string; folderPath: string } {
  const deliverablesDir = path.join(projectRoot, "deliverables");
  const templatesDir = path.join(deliverablesDir, "templates");
  const indexPath = path.join(deliverablesDir, "index.md");

  const reqId = nextReqId(deliverablesDir);
  const slug = slugify(title);
  const folderName = `${reqId}-${slug}`;
  const folderPath = path.join(deliverablesDir, folderName);

  fs.mkdirSync(folderPath, { recursive: true });

  const srsTemplatePath = path.join(templatesDir, "01_srs.md");
  const srsTemplate = fs.existsSync(srsTemplatePath)
    ? fs.readFileSync(srsTemplatePath, "utf-8")
    : "# Software Requirements Specification (SRS)\n## [REQ-NNN] [Requirement Title]\n";

  const filled = srsTemplate
    .replace(/REQ-NNN/g, reqId)
    .replace(/\[Requirement Title\]/g, title)
    .replace(/\[Requirement Name\]/g, title);

  fs.writeFileSync(path.join(folderPath, "01_srs.md"), filled, "utf-8");

  if (fs.existsSync(indexPath)) {
    const indexContent = fs.readFileSync(indexPath, "utf-8");
    const updated = insertRtmRow(indexContent, reqId, title, module, owner, folderName);
    fs.writeFileSync(indexPath, updated, "utf-8");
  } else {
    console.log(`${YELLOW}⚠️  deliverables/index.md not found — skipping RTM row insertion.${RESET}`);
  }

  return { reqId, folderPath };
}

/** Flags that take a value — used to exclude "--flag value" pairs from the title. */
const VALUE_FLAGS = ["--module", "--owner"];

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
    } else if (!VALUE_FLAGS.includes(args[i])) {
      titleParts.push(args[i]);
    }
  }

  return { title: titleParts.join(" ").trim(), module, owner };
}

async function main() {
  const args = process.argv.slice(2);
  const { title, module, owner } = parseArgs(args);

  if (!title) {
    console.error(`${RED}Usage: bun scripts/new-requirement.ts "<Requirement Title>" [--module SD|MM|FI|CO|PP|LE|CROSS] [--owner "<name>"]${RESET}`);
    process.exit(1);
  }

  const { reqId, folderPath } = scaffoldRequirement(defaultProjectRoot, title, module, owner);

  console.log(`${GREEN}✓ Created ${reqId}: ${title}${RESET}`);
  console.log(`  Folder: ${path.relative(defaultProjectRoot, folderPath)}`);
  console.log(`  Stage 1 (01_srs.md) scaffolded — fill in Business Analysis details.`);
  console.log(`  RTM row added to deliverables/index.md (Stage 1 / Draft).`);
}

if (import.meta.main) {
  main().catch((e) => {
    console.error(`new-requirement: ${e}`);
    process.exit(1);
  });
}

export { main, slugify, nextReqId, insertRtmRow, scaffoldRequirement, parseArgs };
