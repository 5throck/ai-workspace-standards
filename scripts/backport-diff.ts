#!/usr/bin/env bun
/**
 * backport-diff.ts — 5-surface backport candidate differ for committed
 * Projects/co-* LOCAL-WORK (project-resync skill Step 2 support).
 * @version 1.0.2
 *
 * v1.0.2 (2026-09-25, ADR-0088 W2): the .hermes platform mirror joins the
 *         skills-classification regex (five-mirror parity).
 *
 * Supports the Step 2 human backport review: after a project's LOCAL-WORK is
 * committed (Step 1), this tool diffs the committed range over the project's
 * files and maps each changed file to its best-matching template source per
 * the 5-surface method. The resulting candidate table feeds the Step 2
 * judgment report (promoted / stays-project / discarded-stale) — this tool
 * never promotes anything itself.
 *
 * Read-only sibling of resync-audit.ts and evidence-backport-scan.ts:
 * it NEVER writes into templates/, Projects/, or anywhere else.
 *
 * Surfaces (docs/designs/2026-08-28-project-template-backport-design.md,
 * §Method — the 5-surface definition):
 *   1. skills   — project skills/<name>/ vs template skills/
 *   2. scripts  — project core scripts vs L0/L1/L2 canonical
 *   3. helpers  — project scripts/helpers/* vs templates/common/scripts/helpers/
 *   4. context  — docs/<variant>.context.md, docs/context.md, CLAUDE.md
 *   5. agents   — name-level roster comparison
 * Anything else is surface "other" (engagement content — stays-project).
 *
 * Counterpart resolution is nearest delivery source first: variant L2
 * (templates/co-<x>/) → common L1 (templates/common/) → L0 workspace root.
 *
 * Divergence direction (base content vs HEAD content vs counterpart):
 *   - project-ahead   — project moved, counterpart still equals base content
 *                       (project work awaiting promotion)
 *   - template-ahead  — project file equals base while the counterpart moved
 *   - both-changed    — project and counterpart both moved (compare by hand)
 *   - in-sync         — HEAD content already equals the counterpart
 *                       (already promoted; no action)
 *   - project-only    — no source counterpart exists (new file; prime
 *                       backport candidate)
 *
 * Usage:
 *   bun scripts/backport-diff.ts --project <co-name>
 *                                [--surfaces all|skills|scripts|helpers|context|agents]
 *                                [--base <commit>] [--json] [--help]
 *
 * Options:
 *   --project <p>    project name (co-<x>) or path (repeatable; default: all
 *                    Projects/co-* directories)
 *   --surfaces <s>   comma-separated surface filter (default: all, which
 *                    includes "other")
 *   --base <commit>  diff base (default: HEAD~1 — pass the pre-work revision,
 *                    e.g. the last template-upgrade commit, when the cycle's
 *                    local work spans several commits)
 *   --json           print the report as JSON instead of markdown
 *
 * Exit codes: 0 (report produced, incl. "no local work"), 1 (usage/setup error).
 *
 * Design of record: docs/designs/2026-08-28-project-template-backport-design.md §Method
 * Safety: report-only per ADR-0031 Principle 5 — drift reporting is the
 * sanctioned direction; automated sibling/template sync is forbidden.
 *
 * @module backport-diff
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const VERSION = "1.0.2";

type Surface = "skills" | "scripts" | "helpers" | "context" | "agents" | "other";
type Direction = "project-ahead" | "template-ahead" | "both-changed" | "in-sync" | "project-only";

interface DiffRow {
  file: string;
  surface: Surface;
  counterpart: string | null;
  direction: Direction;
  added: number;
  removed: number;
  note?: string;
}

interface ProjectReport {
  project: string;
  variant: string | null;
  branch: string;
  base: string;
  changedFiles: number;
  rows: DiffRow[];
}

// ---------------------------------------------------------------------------
// CLI plumbing
// ---------------------------------------------------------------------------

const SURFACES: Surface[] = ["skills", "scripts", "helpers", "context", "agents", "other"];

function parseArgs(): {
  projects: string[];
  surfaces: Set<Surface>;
  base?: string;
  json: boolean;
  help: boolean;
} {
  const args = process.argv.slice(2);
  const projects: string[] = [];
  let surfaces: Set<Surface> | null = null;
  let base: string | undefined;
  let json = false;
  let help = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--help" || args[i] === "-h") help = true;
    else if (args[i] === "--json") json = true;
    else if (args[i] === "--base") base = args[++i];
    else if (args[i] === "--surfaces") {
      surfaces = new Set<Surface>();
      for (const raw of (args[++i] ?? "").split(",")) {
        const s = raw.trim() as Surface;
        if (!SURFACES.includes(s)) {
          console.error(`backport-diff: unknown surface '${raw}' (valid: ${SURFACES.join(", ")})`);
          process.exit(1);
        }
        surfaces.add(s);
      }
    } else if (args[i] === "--project") projects.push(args[++i]);
    else projects.push(args[i]);
  }
  return { projects, surfaces: surfaces ?? new Set<Surface>(SURFACES), base, json, help };
}

function git(projectPath: string, args: string[]): string {
  const r = spawnSync("git", ["-C", projectPath, ...args], { encoding: "utf-8" });
  return (r.stdout ?? "").toString().trim();
}

/** Content of `relFile` at `rev`, or null when the file does not exist there. */
function gitShow(projectPath: string, rev: string, relFile: string): string | null {
  const r = spawnSync("git", ["-C", projectPath, "show", `${rev}:${relFile}`], { encoding: "utf-8" });
  if (r.status !== 0) return null;
  return (r.stdout ?? "").toString().replace(/\r\n/g, "\n");
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

/** Accept both a bare co-<x> name and a path; default to the whole fleet. */
function resolveProjects(requested: string[]): string[] {
  if (requested.length === 0) return defaultProjects();
  return requested.map((p) => {
    if (p.includes("/") || p.includes("\\")) return p;
    const underProjects = join("Projects", p);
    return existsSync(underProjects) ? underProjects : p;
  });
}

/** Variant name for a project path (Projects/co-x → co-x), if that variant exists. */
function variantName(projectPath: string): string | null {
  const base = projectPath.split(/[\\/]/).pop() ?? "";
  return existsSync(join("templates", base)) ? base : null;
}

// ---------------------------------------------------------------------------
// 5-surface mapping (exported for unit tests)
// ---------------------------------------------------------------------------

/** Surface classification of a project-relative file (5-surface method). */
export function surfaceFor(relFile: string): Surface {
  if (relFile.startsWith("skills/")) return "skills";
  // Platform skill mirrors (.claude/.gemini/.agents/.codex/.hermes) carry the same
  // skill content — count them toward the skills surface (template-delivered
  // prefixes per resync-audit.ts).
  if (/^\.(?:claude|gemini|agents|codex|hermes)\/skills\//.test(relFile)) return "skills";
  if (relFile.startsWith("scripts/helpers/")) return "helpers";
  if (relFile.startsWith("scripts/")) return "scripts";
  if (relFile.startsWith("agents/")) return "agents";
  if (relFile === "CLAUDE.md" || relFile === "docs/context.md" || /^docs\/[^/]+\.context\.md$/.test(relFile)) {
    return "context";
  }
  return "other";
}

/**
 * Ordered source-surface candidates for a project-relative file, nearest
 * delivery source first (variant L2 → common L1 → L0 root). Context docs
 * additionally map docs/context.md to the variant's <variant>.context.md.
 */
export function counterpartCandidates(relFile: string, variant: string | null): string[] {
  const roots: string[] = [];
  if (variant) roots.push(join("templates", variant));
  roots.push(join("templates", "common"));
  roots.push(""); // L0 workspace root
  const candidates: string[] = [];
  const push = (rel: string) => {
    for (const root of roots) {
      // Normalize to forward slashes: on Windows join() emits backslashes and
      // the emitted candidates must match the POSIX-style paths used by git
      // output and the report (T-20260922-001 follow-up, Windows CI failure).
      const candidate = root ? join(root, rel).replace(/\\/g, "/") : rel;
      if (!candidates.includes(candidate)) candidates.push(candidate);
    }
  };
  if (relFile === "docs/context.md" && variant) {
    push(["docs", `${variant}.context.md`].join("/"));
  }
  push(relFile);
  return candidates;
}

function resolveCounterpart(relFile: string, variant: string | null): string | null {
  for (const candidate of counterpartCandidates(relFile, variant)) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Divergence direction from the three content snapshots (any may be null:
 * base/head absent means deleted in the range; counterpart absent means a
 * project-only file).
 */
export function directionFor(
  baseContent: string | null,
  headContent: string | null,
  counterpartContent: string | null,
): Direction {
  if (headContent === null) return "project-ahead"; // deleted in the range
  if (counterpartContent === null) return "project-only";
  if (headContent === counterpartContent) return "in-sync";
  if (baseContent !== null && counterpartContent === baseContent) return "project-ahead";
  if (baseContent !== null && headContent === baseContent) return "template-ahead";
  return "both-changed";
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

const DIRECTION_LEGEND =
  "Directions: project-ahead = project work awaiting promotion · template-ahead = counterpart moved alone · " +
  "both-changed = compare by hand · in-sync = already promoted · project-only = new file (prime backport candidate).";

function markdownReport(reports: ProjectReport[]): string {
  const lines: string[] = [
    `# backport-diff report — ${new Date().toISOString().slice(0, 10)}`,
    "",
    "5-surface candidate table for the Step 2 backport review",
    "(docs/designs/2026-08-28-project-template-backport-design.md). Read-only:",
    "the human judgment promotes — this tool never writes (ADR-0031 Principle 5).",
    DIRECTION_LEGEND,
    "",
  ];
  for (const p of reports) {
    lines.push(
      `## ${p.project} (${p.base}..HEAD)`,
      "",
      `- branch: \`${p.branch}\` · variant: \`${p.variant ?? "(none)"}\` · changed files: ${p.changedFiles}`,
      "",
    );
    if (p.rows.length === 0) {
      lines.push("No files matching the requested surfaces in this range.", "");
      continue;
    }
    lines.push("| path | surface | source counterpart | direction | +added | -removed | note |", "|---|---|---|---|---|---|---|");
    for (const r of p.rows) {
      lines.push(
        `| ${r.file} | ${r.surface} | ${r.counterpart ?? "—"} | ${r.direction} | ${r.added} | ${r.removed} | ${r.note ?? "—"} |`,
      );
    }
    lines.push("");
  }
  return lines.join("\n");
}

function numstat(projectPath: string, base: string, relFile: string): [number, number] {
  const out = git(projectPath, ["diff", "--numstat", `${base}..HEAD`, "--", relFile]);
  const first = out.split("\n")[0] ?? "";
  const [a, b] = first.split("\t");
  const added = Number.parseInt(a ?? "-", 10);
  const removed = Number.parseInt(b ?? "-", 10);
  return [Number.isNaN(added) ? 0 : added, Number.isNaN(removed) ? 0 : removed];
}

export async function main(): Promise<void> {
  const { projects, surfaces, base, json, help } = parseArgs();
  if (help) {
    console.log(`backport-diff.ts v${VERSION} — 5-surface backport candidate differ (project-resync Step 2 support).

Usage:
  bun scripts/backport-diff.ts --project <co-name> [--surfaces all|skills|scripts|helpers|context|agents] [--base <commit>] [--json]

Default projects: all Projects/co-*. Default base: HEAD~1 (pass the pre-work
revision for multi-commit local work). Read-only — never writes.`);
    process.exit(0);
  }
  const targets = resolveProjects(projects);
  if (targets.length === 0) {
    console.error("backport-diff: no Projects/co-* directories found and no --project given.");
    process.exit(1);
  }

  const reports: ProjectReport[] = [];
  for (const project of targets) {
    if (!existsSync(join(project, ".git"))) {
      console.warn(`⚠️  backport-diff: ${project} is not a git repo — skipped.`);
      continue;
    }
    const resolvedBase = base ?? "HEAD~1";
    const verify = spawnSync("git", ["-C", project, "rev-parse", "--verify", `${resolvedBase}^{commit}`], {
      encoding: "utf-8",
    });
    if (verify.status !== 0) {
      console.error(`❌ backport-diff: base '${resolvedBase}' does not resolve in ${project} — pass --base <commit>.`);
      process.exit(1);
    }
    const variant = variantName(project);
    const branch = git(project, ["rev-parse", "--abbrev-ref", "HEAD"]) || "?";
    const changed = git(project, ["diff", "--name-only", `${resolvedBase}..HEAD`]).split("\n").filter(Boolean);
    if (changed.length === 0) {
      console.log(`backport-diff: ${project} — no local work in ${resolvedBase}..HEAD (nothing to diff).`);
      continue;
    }
    const rows: DiffRow[] = [];
    for (const relFile of changed) {
      const surface = surfaceFor(relFile);
      if (!surfaces.has(surface)) continue;
      const counterpart = resolveCounterpart(relFile, variant);
      const baseContent = gitShow(project, resolvedBase, relFile);
      const headContent = gitShow(project, "HEAD", relFile);
      const counterpartContent = counterpart && existsSync(counterpart)
        ? readFileSync(counterpart, "utf-8").replace(/\r\n/g, "\n")
        : null;
      const [added, removed] = numstat(project, resolvedBase, relFile);
      rows.push({
        file: relFile,
        surface,
        counterpart: counterpart ? relative(process.cwd(), counterpart) : null,
        direction: directionFor(baseContent, headContent, counterpartContent),
        added,
        removed,
        note: headContent === null ? "deleted in range" : undefined,
      });
    }
    reports.push({ project, variant, branch, base: resolvedBase, changedFiles: changed.length, rows });
  }

  if (reports.length === 0) {
    console.log("backport-diff: no local work across the requested project(s).");
    process.exit(0);
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
    console.error("❌ Fatal backport-diff error:", err);
    process.exit(1);
  });
}
