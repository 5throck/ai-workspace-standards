#!/usr/bin/env bun
// scripts/co-deck/handbook/validate-handbook.ts
// Unified handbook validator — the single entry point of the toolkit.
// Aggregates every read-only check so a handbook can be validated with one
// command, then deployed with the scripts that ship inside it (scaffold).
//
// Checks:
//   ① Structure  (check-structure.ts)  — tag nesting, pre/copy-btn, nested
//     code-block, stray chars, required scripts, lang, language pairs
//   ② Navigation (validate-nav's 4 checks) — broken links, prev/next symmetry,
//     label↔target match, site-search DOCS sync (skipped if no site-search.js)
//   ③ Tables     (check-tables.ts)     — table column-sizing policy
//   authoring    (check-authoring.ts)  — opt-in: AUTHORING_GUIDELINES §10-§24
//   doctor       (handbook-doctor.ts)  — opt-in: 12 static analysis checks
//
// Usage:
//   bun run scripts/co-deck/handbook/validate-handbook.ts --docs-dir docs
//   bun run scripts/co-deck/handbook/validate-handbook.ts --docs-dir docs --checks all
// Exit code 1 if any check reports issues.

import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { configureDocsDir } from "./nav-utils.ts";
import { checkStructure, type StructureError } from "./check-structure.ts";
import { checkTables, type TableError } from "./check-tables.ts";
import { checkBrokenLinks } from "./check-links.ts";
import { checkSymmetry } from "./check-symmetry.ts";
import { checkLabels } from "./check-labels.ts";
import { checkSearchIndex } from "./check-search.ts";

interface Issue {
  file?: string;
  line?: number;
  detail: string;
}

interface Report {
  name: string;
  issues: Issue[];
}

const args = process.argv.slice(2);
function getArg(name: string, fallback: string): string {
  const idx = args.indexOf(name);
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return fallback;
}

const docsDir = resolve(getArg("--docs-dir", "docs"));
const checksArg = getArg("--checks", "structure,nav,tables");
const checks = checksArg === "all"
  ? ["structure", "nav", "tables", "authoring", "doctor"]
  : checksArg.split(",").map((s) => s.trim()).filter(Boolean);

// Point every check at the target docs dir (nav-utils resolves lazily).
configureDocsDir(docsDir);

const reports: Report[] = [];

function addReport(name: string, issues: Issue[]): void {
  reports.push({ name, issues });
}

// ① Structure (in-process)
if (checks.includes("structure")) {
  addReport(
    "① Structure",
    checkStructure().map((e: StructureError) => ({ file: e.file, line: e.line, detail: e.detail })),
  );
}

// ② Navigation (in-process; check-search skips when site-search.js is absent)
if (checks.includes("nav")) {
  const navIssues: Issue[] = [];
  for (const e of checkBrokenLinks()) navIssues.push({ file: e.file, detail: `${e.href} -> missing` });
  for (const e of checkSymmetry()) navIssues.push({ file: e.fileA, detail: e.detail });
  for (const e of checkLabels()) navIssues.push({ file: e.file, detail: `${e.href} label "${e.label}" vs target "${e.targetTitle}"` });
  for (const e of checkSearchIndex()) navIssues.push({ file: e.path, detail: e.detail });
  addReport("② Navigation", navIssues);
}

// ③ Tables (in-process)
if (checks.includes("tables")) {
  addReport(
    "③ Tables",
    checkTables().map((e: TableError) => ({ file: e.file, line: e.line, detail: `[${e.rule}] ${e.snippet}` })),
  );
}

// authoring / doctor (CLI-oriented tools — run as subprocesses)
function runSubprocess(scriptName: string, label: string): void {
  const scriptPath = join(import.meta.dirname, scriptName);
  const r = spawnSync(process.execPath, [scriptPath, "--project", resolve(docsDir, "..")], {
    encoding: "utf-8",
  });
  const output = `${r.stdout || ""}${r.stderr || ""}`.trim();
  if (r.status !== 0) {
    const lines = output.split("\n").filter((l) => l.trim().length > 0);
    addReport(label, lines.length > 0 ? lines.map((l) => ({ detail: l.trim() })) : [{ detail: `${scriptName} exited ${r.status}` }]);
  } else {
    addReport(label, []);
  }
}

if (checks.includes("authoring")) runSubprocess("check-authoring.ts", "④ Authoring");
if (checks.includes("doctor")) runSubprocess("handbook-doctor.ts", "⑤ Doctor");

// ---- Report ----
let totalIssues = 0;
for (const report of reports) {
  console.log(`\n--- ${report.name} ---`);
  if (report.issues.length === 0) {
    console.log("  ✅ PASS — no issues found");
    continue;
  }
  console.log(`  ❌ FAIL — ${report.issues.length} issue(s):`);
  for (const i of report.issues) {
    const loc = [i.file, i.line ? `:${i.line}` : ""].filter(Boolean).join("") || "?";
    console.log(`  • ${loc}: ${i.detail}`);
  }
  totalIssues += report.issues.length;
}

console.log(`\n${totalIssues === 0 ? "✅ All handbook checks passed!" : `❌ ${totalIssues} issue(s) found`}`);
process.exit(totalIssues > 0 ? 1 : 0);
