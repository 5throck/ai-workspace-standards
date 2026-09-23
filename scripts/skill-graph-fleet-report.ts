#!/usr/bin/env bun
/**
 * skill-graph-fleet-report.ts — Read-only fleet analytics over per-project skill graphs
 * (skill-graph-analytics skill Step 1).
 * @version 1.1.0
 *
 * v1.1.0 (2026-09-23, orphan audit T-20260923-001): adds the ROOT-GRAPH ORPHAN
 *         cross-check to the report + snapshot (`rootOrphans`). A root skill or
 *         agent is an orphan CANDIDATE when it is graph-isolated (zero edges);
 *         each candidate is cross-checked on the other three axes — SKILLS.md
 *         registry row, platform mirrors, workflow-doc references (bounded
 *         corpus) — so the weekly cadence sees DEFINITION + REGISTRY + MIRROR +
 *         REFERENCE side by side instead of a bare isolation list. Snapshot
 *         addition is backward-compatible (old snapshots lack the field).
 *
 * Every variant project carries its own projection of the workspace skill graph
 * (`Projects/<co-x>/docs/skill-graph.json`), but nothing ever consolidates them:
 * skill evolution, fleet convergence, and delivery drift are invisible. This
 * tool answers the weekly diligence question — which skills does the fleet
 * actually carry, which root skills never made it into projects, and what
 * changed since the last snapshot?
 *
 * Per run it:
 *   1. loads the root graph (docs/skill-graph.json) and every project graph
 *      (Projects/<co-x>/docs/skill-graph.json); projects without one are skipped
 *      with a note,
 *   2. counts nodes/edges/skill-nodes per project,
 *   3. builds the skill x project presence matrix (skill id -> which projects'
 *      graphs contain it) with fleet presence counts,
 *   4. lists root-graph skills missing from each project's graph (capped
 *      display in the human report; full list in the snapshot),
 *   5. computes the project-vs-root node-set Jaccard distance per project,
 *   6. diffs against the newest previous snapshot in
 *      memory/skill-graph-metrics/ (NEW / VANISHED skills fleet-wide),
 *   7. ranks the top-10 skills by fleet presence.
 *
 * Output: a human-readable report on stdout plus a machine snapshot written to
 * memory/skill-graph-metrics/snapshot-<YYYY-MM-DD>.json (local calendar date;
 * one snapshot per date — a same-date rerun overwrites). `--json` prints the
 * snapshot JSON instead of the human report.
 *
 * This tool is read-only over its inputs; it writes only the snapshot file.
 * It never modifies any graph, skill, or project.
 *
 * Usage:
 *   bun scripts/skill-graph-fleet-report.ts [--json] [--snapshot-dir <dir>] [--help]
 *
 * Options:
 *   --json              print the snapshot JSON instead of the human report
 *   --snapshot-dir <d>  snapshot output directory (default:
 *                       memory/skill-graph-metrics)
 *
 * Exit codes: 0 (report produced), 1 (zero graphs found / usage error).
 *
 * @module skill-graph-fleet-report
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { localDateISO } from "./lib/local-date.ts";

const VERSION = "1.1.0";

/** Node as stored in docs/skill-graph.json (id/type/layer observed in the wild). */
interface GraphNode {
  id: string;
  type?: string;
  layer?: string;
}

/** Edge as stored in docs/skill-graph.json (from/to/type observed in the wild). */
interface GraphEdge {
  type?: string;
  from?: string;
  to?: string;
}

/** A skill-graph projection: the fields this tool consumes. */
interface SkillGraph {
  nodes?: GraphNode[];
  edges?: GraphEdge[];
}

interface ProjectStats {
  project: string;
  nodes: number;
  edges: number;
  skills: number;
}

interface Snapshot {
  date: string;
  projects: Record<string, { nodes: number; edges: number; skills: number }>;
  fleetPresence: Record<string, number>;
  missingFromProjects: Record<string, string[]>;
  jaccard: Record<string, number>;
  /** v1.1.0: root-graph orphan cross-check (4-way: definition+registry+mirror+reference). */
  rootOrphans?: {
    isolatedSkills: Array<{
      id: string;
      registry: boolean;
      mirrors: string[];
      docRefs: number;
    }>;
    isolatedAgents: string[];
  };
}

function parseArgs(): { json: boolean; snapshotDir: string; help: boolean } {
  const args = process.argv.slice(2);
  let json = false;
  let snapshotDir = join("memory", "skill-graph-metrics");
  let help = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--help" || args[i] === "-h") help = true;
    else if (args[i] === "--json") json = true;
    else if (args[i] === "--snapshot-dir") snapshotDir = args[++i];
  }
  return { json, snapshotDir, help };
}

/** List Projects/co-* directories (sorted), like resync-audit.ts. */
function defaultProjects(): string[] {
  const out: string[] = [];
  if (!existsSync("Projects")) return out;
  for (const e of readdirSync("Projects", { withFileTypes: true })) {
    if (e.isDirectory() && e.name.startsWith("co-")) out.push(join("Projects", e.name));
  }
  return out.sort();
}

/** Load a graph projection file; null when absent or unparseable. */
function loadGraph(path: string): SkillGraph | null {
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8")) as SkillGraph;
    return Array.isArray(parsed.nodes) ? parsed : null;
  } catch {
    return null;
  }
}

function nodeIds(graph: SkillGraph): Set<string> {
  return new Set((graph.nodes ?? []).map((n) => n.id));
}

function skillIds(graph: SkillGraph): Set<string> {
  return new Set((graph.nodes ?? []).filter((n) => n.type === "skill").map((n) => n.id));
}

/**
 * Jaccard DISTANCE between two node-id sets: 1 - |A n B| / |A u B|.
 * 0 = identical node sets, 1 = disjoint. Distance (not similarity) so that
 * bigger numbers read as "more drift".
 */
function jaccardDistance(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : 1 - inter / union;
}

/** Newest snapshot strictly before `beforeDate`, by the date in its filename. */
function findPreviousSnapshot(snapshotDir: string, beforeDate: string): { file: string; date: string; data: Snapshot } | null {
  if (!existsSync(snapshotDir)) return null;
  let best: { file: string; date: string } | null = null;
  for (const f of readdirSync(snapshotDir)) {
    const m = f.match(/^snapshot-(\d{4}-\d{2}-\d{2})\.json$/);
    if (!m) continue;
    const d = m[1];
    if (d >= beforeDate) continue; // today's own (overwritten) file and anything newer never diffs
    if (!best || d > best.date) best = { file: join(snapshotDir, f), date: d };
  }
  if (!best) return null;
  try {
    const data = JSON.parse(readFileSync(best.file, "utf-8")) as Snapshot;
    return { file: best.file, date: best.date, data };
  } catch {
    return null;
  }
}

/**
 * Fleet-wide skill set: skills carried by any project graph plus root-graph
 * skills (root-only skills reach projects via delivery; tracking them keeps
 * the NEW/VANISHED diff honest about root-side additions/removals too).
 * A previous snapshot's root set is recovered from its missingFromProjects
 * union (root skills absent from projects are recorded there in full).
 */
function fleetSkillSet(
  rootSkills: Set<string>,
  projectSkillSets: Map<string, Set<string>>,
  previous?: Snapshot | null,
): { current: Set<string>; previous: Set<string> | null } {
  const current = new Set(rootSkills);
  for (const s of projectSkillSets.values()) for (const id of s) current.add(id);
  if (!previous) return { current, previous: null };
  const prev = new Set(Object.keys(previous.fleetPresence ?? {}));
  for (const list of Object.values(previous.missingFromProjects ?? {})) {
    for (const id of list ?? []) prev.add(id);
  }
  return { current, previous: prev };
}

/**
 * v1.1.0 — Root-graph orphan cross-check. Isolation = zero edges in the root
 * graph. Each isolated root skill/agent is cross-checked on the remaining axes
 * of the 4-way orphan criteria (definition=the node itself, registry, mirror,
 * reference): registry = SKILLS.md row, mirrors = which of the 4 platform
 * skill bases carry the skill, docRefs = occurrences in the bounded workflow-doc
 * corpus (platform/agent context docs + procedures/ + process/).
 */
function analyzeRootOrphans(
  rootGraph: SkillGraph,
): NonNullable<Snapshot["rootOrphans"]> {
  const connected = new Set<string>();
  for (const e of rootGraph.edges ?? []) {
    if (e.from) connected.add(e.from);
    if (e.to) connected.add(e.to);
  }
  const isolated = (rootGraph.nodes ?? []).filter((n) => n.type && !connected.has(n.id));

  const registryPath = join("skills", "SKILLS.md");
  const registry = existsSync(registryPath) ? readFileSync(registryPath, "utf8") : "";
  const MIRROR_BASES = [".claude/skills", ".gemini/skills", ".agents/skills", ".codex/skills"];

  const corpusFiles: string[] = [];
  for (const f of ["AGENTS.md", "CLAUDE.md", "GEMINI.md", "CODEX.md"]) {
    if (existsSync(f)) corpusFiles.push(f);
  }
  const walkCorpus = (dir: string, depth: number): void => {
    if (depth > 3 || !existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walkCorpus(full, depth + 1);
      else if (entry.isFile() && (entry.name.endsWith(".md") || entry.name.endsWith(".yaml"))) corpusFiles.push(full);
    }
  };
  walkCorpus(join("procedures"), 0);
  walkCorpus(join("process"), 0);
  const corpus = corpusFiles.map((f) => {
    try { return readFileSync(f, "utf8").toLowerCase(); } catch { return ""; }
  }).join("\n");

  const isolatedSkills = isolated
    .filter((n) => n.type === "skill" && n.layer === "L0")
    .map((n) => ({
      id: n.id,
      registry: registry.includes(`| \`${n.id}\``),
      mirrors: MIRROR_BASES.filter((b) => existsSync(join(b, n.id, "SKILL.md"))),
      docRefs: corpus.split(n.id.toLowerCase()).length - 1,
    }));
  const isolatedAgents = isolated.filter((n) => n.type === "agent" && n.layer === "L0").map((n) => n.id);

  return { isolatedSkills, isolatedAgents };
}

function markdownReport(
  rootGraph: SkillGraph,
  stats: ProjectStats[],
  skipped: string[],
  presence: Map<string, string[]>,
  missingFromProjects: Record<string, string[]>,
  jaccard: Record<string, number>,
  diff: { newSkills: string[]; vanishedSkills: string[] } | null,
  diffBase: { file: string; date: string } | null,
  orphans: NonNullable<Snapshot["rootOrphans"]> | null,
): string {
  const lines: string[] = [
    `# skill-graph fleet report — ${localDateISO()}`,
    "",
    `Root graph: ${rootGraph.nodes?.length ?? 0} nodes · ${rootGraph.edges?.length ?? 0} edges · ${skillIds(rootGraph).size} skill nodes. Projects covered: ${stats.length}${skipped.length > 0 ? ` (skipped, no graph: ${skipped.join(", ")})` : ""}.`,
    "",
  ];

  // (a) per-project stats + (d) Jaccard distance
  lines.push("## Per-project graph stats", "");
  lines.push("| project | nodes | edges | skill nodes | Jaccard distance vs root |", "|---|---|---|---|---|");
  for (const s of stats) {
    lines.push(`| ${s.project} | ${s.nodes} | ${s.edges} | ${s.skills} | ${jaccard[s.project].toFixed(3)} |`);
  }
  lines.push("");

  // (f) top-10 by fleet presence
  const ranked = [...presence.entries()].sort((a, b) => (b[1].length - a[1].length) || a[0].localeCompare(b[0]));
  const top10 = ranked.slice(0, 10);
  lines.push("## Top skills by fleet presence", "");
  lines.push("| skill | projects carrying it |", "|---|---|");
  for (const [id, projects] of top10) {
    lines.push(`| ${id} | ${projects.length} |`);
  }
  lines.push("");

  // (b) full skill x project presence matrix
  lines.push("## Skill x project presence matrix", "");
  lines.push("| skill | fleet presence | projects |", "|---|---|---|");
  for (const [id, projects] of ranked) {
    lines.push(`| ${id} | ${projects.length} | ${projects.length > 0 ? projects.join(", ") : "(root only)"} |`);
  }
  lines.push("");

  // (c) root skills missing per project (capped display)
  const MISSING_CAP = 15;
  lines.push("## Root skills missing from project graphs", "");
  for (const [project, missing] of Object.entries(missingFromProjects)) {
    if (missing.length === 0) {
      lines.push(`- ${project}: none — carries every root skill`);
      continue;
    }
    const shown = missing.slice(0, MISSING_CAP).join(", ");
    const rest = missing.length > MISSING_CAP ? ` … and ${missing.length - MISSING_CAP} more (see snapshot)` : "";
    lines.push(`- ${project}: ${missing.length} missing — ${shown}${rest}`);
  }
  lines.push("");

  // (e) NEW/VANISHED diff vs previous snapshot
  if (!diff) {
    lines.push("## Fleet diff vs previous snapshot", "");
    lines.push(`No previous snapshot${diffBase ? ` (newest: ${diffBase.file})` : ""} — this run establishes the baseline.`);
    lines.push("");
  } else {
    lines.push(`## Fleet diff vs snapshot ${diffBase?.date ?? "?"} (memory/skill-graph-metrics)`, "");
    lines.push(`- NEW skills (${diff.newSkills.length}): ${diff.newSkills.length > 0 ? diff.newSkills.join(", ") : "—"}`);
    lines.push(`- VANISHED skills (${diff.vanishedSkills.length}): ${diff.vanishedSkills.length > 0 ? diff.vanishedSkills.join(", ") : "—"}`);
    lines.push("");
  }

  // v1.1.0 — root-graph orphan cross-check (4-way: definition+registry+mirror+reference)
  lines.push("## Root-graph orphan candidates (4-way cross-check)", "");
  if (!orphans || (orphans.isolatedSkills.length === 0 && orphans.isolatedAgents.length === 0)) {
    lines.push("None — every root skill and agent carries at least one graph edge.");
    lines.push("");
  } else {
    lines.push("Graph-isolated (zero edges). Cross-axes: registry = SKILLS.md row, mirrors = platform skill bases, refs = workflow-doc corpus mentions.");
    lines.push("Triage: all four axes present → graph-edge gap (file an overrides entry or citation); zero axes → true orphan (retire or wire in).");
    lines.push("");
    if (orphans.isolatedAgents.length > 0) {
      lines.push(`- isolated agents: ${orphans.isolatedAgents.join(", ")}`);
    }
    for (const o of orphans.isolatedSkills) {
      const axes = [
        o.registry ? "registry ✓" : "registry ✗",
        `mirrors ${o.mirrors.length}/4`,
        `refs ${o.docRefs}`,
      ].join(", ");
      lines.push(`- ${o.id}: ${axes}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export async function main(): Promise<void> {
  const { json, snapshotDir, help } = parseArgs();
  if (help) {
    console.log(`skill-graph-fleet-report.ts v${VERSION} — read-only fleet analytics over per-project skill graphs (skill-graph-analytics skill Step 1).

Usage:
  bun scripts/skill-graph-fleet-report.ts [--json] [--snapshot-dir <dir>]

Reads docs/skill-graph.json + Projects/<co-x>/docs/skill-graph.json; writes only
memory/skill-graph-metrics/snapshot-<YYYY-MM-DD>.json (one per date, overwrite
same-date). Read-only over all inputs.`);
    process.exit(0);
  }

  const today = localDateISO();
  const graphPaths: Array<{ name: string; path: string }> = [
    { name: "root", path: join("docs", "skill-graph.json") },
  ];
  for (const project of defaultProjects()) {
    graphPaths.push({ name: project.split(/[\\/]/).pop() ?? project, path: join(project, "docs", "skill-graph.json") });
  }

  const rootGraph = loadGraph(join("docs", "skill-graph.json"));
  const stats: ProjectStats[] = [];
  const skipped: string[] = [];
  const projectSkillSets = new Map<string, Set<string>>();
  const projectNodeSets = new Map<string, Set<string>>();

  for (const g of graphPaths) {
    if (g.name === "root") continue;
    const graph = loadGraph(g.path);
    if (!graph) {
      skipped.push(g.name);
      console.warn(`⚠️  skill-graph-fleet-report: ${g.path} not found or unreadable — skipped.`);
      continue;
    }
    const skillSet = skillIds(graph);
    projectSkillSets.set(g.name, skillSet);
    projectNodeSets.set(g.name, nodeIds(graph));
    stats.push({ project: g.name, nodes: graph.nodes?.length ?? 0, edges: graph.edges?.length ?? 0, skills: skillSet.size });
  }

  const loadedCount = stats.length + (rootGraph ? 1 : 0);
  if (loadedCount === 0) {
    console.error("❌ skill-graph-fleet-report: zero skill graphs found (docs/skill-graph.json and Projects/co-*/docs/skill-graph.json all missing).");
    process.exit(1);
  }

  // (b) skill x project presence matrix with fleet presence counts
  const presence = new Map<string, string[]>();
  const rootSkills = rootGraph ? skillIds(rootGraph) : new Set<string>();
  for (const id of rootSkills) presence.set(id, []);
  for (const [project, skills] of projectSkillSets) {
    for (const id of skills) {
      if (!presence.has(id)) presence.set(id, []);
      presence.get(id)!.push(project);
    }
  }
  const fleetPresence: Record<string, number> = {};
  for (const [id, projects] of presence) fleetPresence[id] = projects.length;

  // (c) root skills missing per project (full list in snapshot)
  const missingFromProjects: Record<string, string[]> = {};
  for (const [project, skills] of projectSkillSets) {
    missingFromProjects[project] = [...rootSkills].filter((id) => !skills.has(id)).sort();
  }

  // (d) Jaccard distance project vs root (node-id sets)
  const jaccard: Record<string, number> = {};
  const rootNodeSet = rootGraph ? nodeIds(rootGraph) : new Set<string>();
  for (const [project, nodes] of projectNodeSets) {
    jaccard[project] = jaccardDistance(nodes, rootNodeSet);
  }

  // (e) NEW/VANISHED diff vs newest previous snapshot
  const previous = findPreviousSnapshot(snapshotDir, today);
  const { current, previous: prevSet } = fleetSkillSet(rootSkills, projectSkillSets, previous?.data);
  const diff = prevSet
    ? {
        newSkills: [...current].filter((id) => !prevSet.has(id)).sort(),
        vanishedSkills: [...prevSet].filter((id) => !current.has(id)).sort(),
      }
    : null;

  const snapshot: Snapshot = {
    date: today,
    projects: Object.fromEntries(stats.map((s) => [s.project, { nodes: s.nodes, edges: s.edges, skills: s.skills }])),
    fleetPresence,
    missingFromProjects,
    jaccard,
  };

  // v1.1.0 — root-graph orphan cross-check
  const orphans = rootGraph ? analyzeRootOrphans(rootGraph) : null;
  if (orphans) snapshot.rootOrphans = orphans;

  mkdirSync(snapshotDir, { recursive: true });
  const snapshotFile = join(snapshotDir, `snapshot-${today}.json`);
  writeFileSync(snapshotFile, JSON.stringify(snapshot, null, 2) + "\n");
  // --json consumers parse stdout as pure JSON: the status line goes to stderr there.
  const statusLine = `📦 snapshot → ${snapshotFile}${previous ? ` (diffed vs snapshot-${previous.date}.json)` : " (baseline — no previous snapshot)"}`;
  if (json) console.error(statusLine);
  else console.log(statusLine);

  if (json) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log(markdownReport(
      rootGraph ?? { nodes: [], edges: [] },
      stats,
      skipped,
      presence,
      missingFromProjects,
      jaccard,
      diff,
      previous ? { file: previous.file, date: previous.date } : null,
      orphans,
    ));
  }
  process.exit(0);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("❌ Fatal skill-graph-fleet-report error:", err);
    process.exit(1);
  });
}
