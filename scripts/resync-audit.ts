#!/usr/bin/env bun
/**
 * resync-audit.ts — Provenance audit of uncommitted content in Projects/co-*
 * (project-resync skill Step 0).
 * @version 1.0.0
 *
 * Before any project sync pushes local work to GitHub, this tool answers the
 * diligence question: is each dirty/untracked file CURRENT work worth
 * committing, or STALE RESIDUE of an older upgrade that the next upgrade will
 * re-deliver fresh?
 *
 * Per project it:
 *   1. enumerates modified + untracked files (git status --porcelain),
 *   2. records each file's mtime (dated provenance),
 *   3. classifies template-delivered files by comparing the dirty content
 *      against the workspace source of truth:
 *        - dirty content == L0/L1/L2 source  → STALE-RESIDUE
 *          (an older sync wave; DISCARD + let upgrade re-deliver)
 *        - divergent from HEAD and not equal to any source → LOCAL-WORK
 *          (candidate COMMIT; feeds the backport review)
 *        - unresolvable → KEEP (default-safe; human review)
 *   4. emits a markdown audit report (per-project verdict tables), with
 *      optional JSON and a local snapshot tarball of DISCARD candidates.
 *
 * This tool never modifies the working tree and never pushes. Verdicts are
 * advisory; the operator applies them only after review.
 *
 * Usage:
 *   bun scripts/resync-audit.ts [--project <path>]... [--json]
 *                               [--snapshot-dir <dir>] [--help]
 *
 * Options:
 *   --project <path>    project root to audit (repeatable; default: all
 *                       Projects/co-* directories)
 *   --json              print the report as JSON instead of markdown
 *   --snapshot-dir <d>  write a tarball of DISCARD-candidate files into <d>
 *                       (one tarball per project; local only)
 *
 * Exit codes: 0 (report produced), 1 (usage/setup error).
 *
 * @module resync-audit
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const VERSION = "1.0.0";

interface FileRow {
  file: string;
  state: "modified" | "untracked";
  mtime: string;
  verdict: "STALE-RESIDUE" | "LOCAL-WORK" | "KEEP";
  basis: string;
}

interface ProjectReport {
  project: string;
  branch: string;
  remote: string;
  dirtyCount: number;
  rows: FileRow[];
  groups: Array<{ group: string; verdict: string; files: string[]; note: string }>;
}

function parseArgs(): { projects: string[]; json: boolean; snapshotDir?: string; help: boolean } {
  const args = process.argv.slice(2);
  const projects: string[] = [];
  let json = false;
  let snapshotDir: string | undefined;
  let help = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--help" || args[i] === "-h") help = true;
    else if (args[i] === "--json") json = true;
    else if (args[i] === "--snapshot-dir") snapshotDir = args[++i];
    else if (args[i] === "--project") projects.push(args[++i]);
    else projects.push(args[i]);
  }
  return { projects, json, snapshotDir, help };
}

function git(projectPath: string, args: string[]): string {
  const r = spawnSync("git", ["-C", projectPath, ...args], { encoding: "utf-8" });
  return (r.stdout ?? "").toString().trim();
}

function defaultProjects(): string[] {
  const out: string[] = [];
  const dir = resolve("Projects");
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory() && e.name.startsWith("co-")) out.push(join("Projects", e.name));
  }
  return out.sort();
}

/** Variant name for a project path (Projects/co-x → co-x), if that variant exists. */
function variantName(projectPath: string): string | null {
  const base = projectPath.split(/[\\/]/).pop() ?? "";
  return existsSync(join("templates", base)) ? base : null;
}

/**
 * Candidate source-of-truth files for a given project-relative file.
 * A template-delivered file under skills/, .claude/, .gemini/, .agents/,
 * scripts/, agents/, docs/ mirrors a workspace path relative to a root:
 *   - L0 root (for workspace-level assets like skills/, scripts/, agents/)
 *   - templates/common (L1)
 *   - templates/<variant> (L2)
 */
function sourceCandidates(projectPath: string, relFile: string): string[] {
  const variant = variantName(projectPath);
  const candidates: string[] = [];
  for (const root of ["", "templates/common", variant ? join("templates", variant) : null]) {
    if (root === null) continue;
    const candidate = root ? join(root, relFile) : relFile;
    if (existsSync(candidate)) candidates.push(candidate);
  }
  return candidates;
}

/** Prefixes whose files are considered template-delivered (sync waves). */
const TEMPLATE_DELIVERED_PREFIXES = [
  "skills/", ".claude/", ".gemini/", ".agents/", "scripts/", "agents/",
  "docs/constitution/", "docs/context.md",
];

function walkProjectDir(dir: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  if (statSync(dir).isFile()) return [dir];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...walkProjectDir(full));
    else out.push(full);
  }
  return out;
}

function isTemplateDelivered(relFile: string): boolean {
  return TEMPLATE_DELIVERED_PREFIXES.some((p) => relFile.startsWith(p));
}

/**
 * True when every line of `older` appears in `newer` (multiset containment) and
 * `newer` has extra lines — i.e. the project copy is an OLDER REVISION of the
 * current source (typical: a newer template added fields/sections).
 */
function isOlderRevision(older: string, newer: string): boolean {
  const a = older.split("\n").map((l) => l.trimEnd()).filter((l) => l.trim().length > 0);
  const b = newer.split("\n").map((l) => l.trimEnd()).filter((l) => l.trim().length > 0);
  if (b.length <= a.length) return false;
  const counts = new Map<string, number>();
  for (const l of b) counts.set(l, (counts.get(l) ?? 0) + 1);
  for (const l of a) {
    const c = counts.get(l) ?? 0;
    if (c === 0) return false;
    counts.set(l, c - 1);
  }
  return true;
}

function classify(projectPath: string, relFile: string, state: "modified" | "untracked"): FileRow {
  const abs = join(projectPath, relFile);
  let mtime = "";
  try {
    mtime = statSync(abs).mtime.toISOString().slice(0, 10);
  } catch { /* vanished mid-audit */ }

  const row: FileRow = { file: relFile, state, mtime, verdict: "KEEP", basis: "default-safe: unresolvable → KEEP" };

  if (state === "modified") {
    const head = git(projectPath, ["show", `HEAD:${relFile}`]);
    if (!head) {
      row.basis = "modified with no HEAD version (added-then-modified) → KEEP";
      return row;
    }
    const dirty = readFileSync(abs, "utf-8").replace(/\r\n/g, "\n");
    if (dirty === head.replace(/\r\n/g, "\n")) {
      row.verdict = "STALE-RESIDUE";
      row.basis = "content equals HEAD (whitespace/EOL churn)";
      return row;
    }
    const sources = sourceCandidates(projectPath, relFile);
    if (isTemplateDelivered(relFile) && sources.length > 0) {
      for (const src of sources) {
        const srcContent = readFileSync(src, "utf-8").replace(/\r\n/g, "\n");
        if (dirty === srcContent) {
          row.verdict = "STALE-RESIDUE";
          row.basis = `content equals current template source (${src})`;
          return row;
        }
        if (isOlderRevision(dirty, srcContent)) {
          row.verdict = "STALE-RESIDUE";
          row.basis = `older revision of ${src} (source adds ${srcContent.split("\n").length - dirty.split("\n").length} line(s))`;
          return row;
        }
      }
      row.verdict = "LOCAL-WORK";
      row.basis = `diverges from HEAD and ${sources.length} template source(s)`;
      return row;
    }
    row.verdict = "LOCAL-WORK";
    row.basis = "modified non-template file";
    return row;
  }

  // untracked
  if (isTemplateDelivered(relFile)) {
    const sources = sourceCandidates(projectPath, relFile);
    if (sources.length > 0) {
      const dirty = readFileSync(abs, "utf-8").replace(/\r\n/g, "\n");
      for (const src of sources) {
        const srcContent = readFileSync(src, "utf-8").replace(/\r\n/g, "\n");
        if (dirty === srcContent) {
          row.verdict = "STALE-RESIDUE";
          row.basis = `untracked but equals current template source (${src})`;
          return row;
        }
        if (isOlderRevision(dirty, srcContent)) {
          row.verdict = "STALE-RESIDUE";
          row.basis = `older revision of ${src} (untracked)`;
          return row;
        }
      }
      row.verdict = "LOCAL-WORK";
      row.basis = `untracked, diverges from ${sources.length} template source(s)`;
      return row;
    }
    row.verdict = "LOCAL-WORK";
    row.basis = "untracked template-area file with no source counterpart";
    return row;
  }
  row.verdict = "LOCAL-WORK";
  row.basis = "untracked non-template file";
  return row;
}

/** Collapse file rows into reviewable groups by top-level directory. */
function groupRows(rows: FileRow[]): ProjectReport["groups"] {
  const byGroup = new Map<string, FileRow[]>();
  for (const r of rows) {
    const parts = r.file.split("/");
    const group = parts.length > 1 ? `${parts[0]}/${parts[1] ?? ""}*` : r.file;
    if (!byGroup.has(group)) byGroup.set(group, []);
    byGroup.get(group)!.push(r);
  }
  return [...byGroup.entries()].map(([group, rs]) => {
    const verdicts = new Set(rs.map((r) => r.verdict));
    const verdict = verdicts.size === 1 ? [...verdicts][0] : "MIXED";
    const mtimes = rs.map((r) => r.mtime).filter(Boolean).sort();
    return {
      group,
      verdict,
      files: rs.map((r) => r.file),
      note: `${rs.length} file(s), dated ${mtimes[0] ?? "?"} → ${mtimes[mtimes.length - 1] ?? "?"}; ${verdict === "MIXED" ? "review individually" : rs[0].basis}`,
    };
  });
}

function snapshotDiscardables(projectPath: string, rows: FileRow[], snapshotDir: string): string | null {
  const discard = rows.filter((r) => r.verdict === "STALE-RESIDUE").map((r) => r.file);
  if (discard.length === 0) return null;
  const name = projectPath.split(/[\\/]/).pop() ?? "project";
  mkdirSync(snapshotDir, { recursive: true });
  const tarball = resolve(join(snapshotDir, `${name}-discard-snapshot-${new Date().toISOString().slice(0, 10)}.tar.gz`));
  const listFile = tarball.replace(/\.tar\.gz$/, ".filelist");
  writeList(listFile, discard);
  const r = spawnSync("tar", ["-czf", tarball, "-C", projectPath, "-T", listFile], { encoding: "utf-8" });
  if (r.status !== 0) return null;
  return tarball;
}

function writeList(listFile: string, files: string[]): void {
  writeFileSync(listFile, files.join("\n"));
}

function markdownReport(reports: ProjectReport[]): string {
  const lines: string[] = [
    `# resync-audit report — ${new Date().toISOString().slice(0, 10)}`,
    "",
    `Verdicts: STALE-RESIDUE = discard (upgrade re-delivers) · LOCAL-WORK = commit candidate · KEEP = default-safe.`,
    "",
  ];
  for (const p of reports) {
    lines.push(`## ${p.project}`, "");
    lines.push(`- branch: \`${p.branch}\` · remote: \`${p.remote || "(none)"}\` · dirty files: ${p.dirtyCount}`, "");
    lines.push("| group | verdict | note |", "|---|---|---|");
    for (const g of p.groups) {
      lines.push(`| ${g.group} | ${g.verdict} | ${g.note} |`);
    }
    lines.push("");
    if (p.groups.some((g) => g.verdict === "MIXED")) {
      lines.push("### MIXED groups — per-file detail", "");
      lines.push("| file | state | mtime | verdict | basis |", "|---|---|---|---|---|");
      for (const g of p.groups) {
        if (g.verdict !== "MIXED") continue;
        for (const r of p.rows.filter((x) => g.files.includes(x.file))) {
          lines.push(`| ${r.file} | ${r.state} | ${r.mtime} | ${r.verdict} | ${r.basis} |`);
        }
      }
      lines.push("");
    }
  }
  return lines.join("\n");
}

export async function main(): Promise<void> {
  const { projects, json, snapshotDir, help } = parseArgs();
  if (help) {
    console.log(`resync-audit.ts v${VERSION} — provenance audit of uncommitted project content (project-resync Step 0).

Usage:
  bun scripts/resync-audit.ts [--project <path>]... [--json] [--snapshot-dir <dir>]

Default projects: all Projects/co-*. Never modifies the tree, never pushes.`);
    process.exit(0);
  }
  const targets = projects.length > 0 ? projects : defaultProjects();
  if (targets.length === 0) {
    console.error("resync-audit: no Projects/co-* directories found and no --project given.");
    process.exit(1);
  }

  const reports: ProjectReport[] = [];
  for (const project of targets) {
    if (!existsSync(join(project, ".git"))) {
      console.warn(`⚠️  resync-audit: ${project} is not a git repo — skipped.`);
      continue;
    }
    const branch = git(project, ["rev-parse", "--abbrev-ref", "HEAD"]) || "?";
    const remoteRaw = git(project, ["remote", "get-url", "origin"]);
    const porcelain = git(project, ["status", "--porcelain"]);
    const rows: FileRow[] = [];
    for (const line of porcelain.split("\n").filter(Boolean)) {
      const state = line.startsWith("??") ? "untracked" : "modified";
      let relFile = line.slice(3).trim();
      if (relFile.includes("→")) continue; // renames: audit post-move
      relFile = relFile.replace(/^"(.*)"$/, "$1");
      if (state === "untracked" && relFile.endsWith("/")) {
        // untracked directory: expand to its files
        for (const f of walkProjectDir(join(project, relFile))) {
          rows.push(classify(project, relative(project, f).split("\\").join("/"), "untracked"));
        }
        continue;
      }
      rows.push(classify(project, relFile, state));
    }
    const report: ProjectReport = {
      project,
      branch,
      remote: remoteRaw,
      dirtyCount: rows.length,
      rows,
      groups: groupRows(rows),
    };
    if (snapshotDir) {
      const tarball = snapshotDiscardables(project, rows, snapshotDir);
      if (tarball) console.log(`📦 DISCARD snapshot for ${project} → ${relative(process.cwd(), tarball)}`);
    }
    reports.push(report);
  }

  if (json) {
    console.log(JSON.stringify(reports, null, 2));
  } else {
    console.log(markdownReport(reports));
  }
  process.exit(0);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("❌ Fatal resync-audit error:", err);
    process.exit(1);
  });
}
