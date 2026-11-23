#!/usr/bin/env bun
/**
 * skill-graph-fleet-report.ts — Read-only fleet analytics over per-project skill graphs
 * (skill-graph-analytics skill Step 1).
 * @version 2.5.0 (2026-11-23, spec
 *          docs/designs/2026-11-23-skill-graph-history-report-design.md §5.1-§5.3):
 *          auto-emitted HTML history dashboard — every successful report run
 *          (markdown or --json; the daily --json runner is the primary emitter)
 *          regenerates a single self-contained page over the full snapshot
 *          history at docs/skill-graph-history.html (override with --html <path>,
 *          disable with --no-html; parents auto-created). The page inlines a
 *          compact projection (per-date class counts + NEW/VANISHED replay,
 *          latest convergence/delivery-gap/fan-in/orphan detail, dynamic fleet
 *          coverage with transient-absent annotation, governance-ticket scan) as
 *          a \\u003c-escaped JSON data block rendered client-side — five tabs,
 *          in-page search, light/dark toggle, CSP
 *          default-src 'none' + unsafe-inline style/script, zero external
 *          references, deterministic output (no wall-clock markers). Emission is
 *          WARN-only (one stderr WARN on any build/write failure; exit code and
 *          the snapshot are never affected; no partial HTML is left behind).
 *          Governance-ticket reader implements folded (>-) and literal (|)
 *          block scalars over tickets/governance/*.yaml + archive. Byte-compat:
 *          snapshot writes and --json stdout are unchanged from v2.4.0.
 * @version 2.4.0 (2026-11-07, spec
 *          docs/designs/2026-11-07-fleet-membership-ssot-design.md §5,
 *          DEC-20261107-01): fleet membership SSOT — defaultProjects()
 *          derives the fleet through lib/fleet.ts listFleetProjects()
 *          (Projects/co-* minus the docs/fleet-membership.json exclusions;
 *          co-abap-plugin out — no snapshot row, no convergence denominator
 *          participation, A4). Transient-checkout filtering (v2.3.0) is
 *          composed on top unchanged. Additive; report shape untouched.
 * @version 2.3.0 (2026-11-03, T-20261103-004): git-aware fleet discovery —
 *          defaultProjects() excludes transient PR working checkouts (a
 *          Projects/ checkout on a `pr/*` branch, e.g. the gitignored
 *          co-newbiz-pr-disable-register on `pr/disable-register`) so they no
 *          longer leak into committed snapshots as phantom fleet members.
 *          Projects/ is gitignored wholesale, so branch evidence (not
 *          check-ignore) is the discriminator; exclusion is positive-evidence
 *          only (main/detached/non-git stay included, fail-open). Skipped
 *          checkouts are warned to stderr. Shared helpers in
 *          scripts/lib/git-aware-scan.ts; filterTransientCheckouts exported
 *          pure for unit coverage (tests/unit/git-aware-scan.test.ts).
 * @version 2.2.0
 *
 * v2.2.0 (2026-11-01, design docs/designs/2026-11-01-hub-consolidation-design.md §9/Phase 0):
 *          adds the FAN-IN classification (`fanIn2`, threshold 2): capabilities (skills +
 *          agents only — scripts are not graph nodes) carried by >= 2 DISTINCT project
 *          graphs, the hub-candidacy substrate. Purely additive: the convergence threshold
 *          (3) and every prior field are untouched. Snapshot gains an additive `fanIn2`
 *          field; the report gains a fan-in table plus a hub-candidate asset breakout
 *          (co-develop / co-design / co-security) listing each hub's assets with fan-in >= 2.
 *
 * v2.1.0 (2026-10-09, T-20261009-008, design docs/designs/2026-10-09-skill-graph-triage-hardening-design.md D1-D3):
 *          HERMES.md joins the docRef corpus (5 bases); isolated agents carry the same
 *          4-way axes as skills; same-capability edge attribution — L0 nodes whose
 *          same-name scoped copies hold the edges report under rootOrphans.carriedByScoped
 *          instead of flagging as isolated (the 2026-10-09 architect/standup-synthesizer
 *          false-positive class).
 *
 * v2.0.0 (2026-10-08, design docs/designs/2026-10-08-skill-graph-v2-scoped-identity-design.md §3.3,
 *         ADR-0060 Amendment 11): graphs load through scripts/lib/skill-graph-compat.ts (v1 and v2
 *         mixed fleets) and the presence matrix, missing-from-project lists, Jaccard distance and
 *         NEW/VANISHED diff are keyed by CAPABILITY (frontmatter `capability`, default = name; v1
 *         graphs derive it from the bare id) instead of the raw node id. Adds the convergence
 *         classification (threshold 3 projects, preserved): `converged` (single content hash),
 *         `convergence-with-divergence` (>= 2 hashes, reconciliation candidate, not auto-promoted)
 *         and `hash-unknown` (presence confirmed but a v1 project graph carries no hashes). The
 *         union of the three equals the pre-v2 "present in >= 3 projects" set (regression-pinned).
 *         Snapshot gains an additive `convergence` field; fleetPresence keeps its shape.
 * v1.1.1 (2026-09-24, spec docs/designs/2026-09-24-platform-ssot-constant-design.md):
 *         behavior-neutral constant adoption — the MIRROR_BASES literal becomes
 *         PLATFORM_MIRROR_DIRS (./lib/platforms.ts). NO behavior change.
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
 * snapshot JSON instead of the human report. v2.5.0 additionally auto-emits the
 * history dashboard docs/skill-graph-history.html after every successful
 * snapshot write (both modes; see the @version 2.5.0 entry).
 *
 * This tool is read-only over its inputs; it writes only the snapshot file and
 * the generated history page (HTML emission failure is WARN-only and never
 * affects the snapshot or the exit code).
 * It never modifies any graph, skill, or project.
 *
 * Usage:
 *   bun scripts/skill-graph-fleet-report.ts [--json] [--snapshot-dir <dir>]
 *       [--html <path>] [--no-html] [--help]
 *
 * Options:
 *   --json              print the snapshot JSON instead of the human report
 *   --snapshot-dir <d>  snapshot output directory (default:
 *                       memory/skill-graph-metrics)
 *   --html <path>       history-page output path override (default:
 *                       docs/skill-graph-history.html; parents auto-created)
 *   --no-html           skip the history-page emission (snapshot still written)
 *
 * Exit codes: 0 (report produced), 1 (zero graphs found / usage error).
 *
 * @module skill-graph-fleet-report
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { checkoutBranch, filterTransientCheckouts } from "./lib/git-aware-scan.ts";
import { listFleetProjects } from "./lib/fleet.ts";
import { localDateISO } from "./lib/local-date.ts";
import { PLATFORM_MIRROR_DIRS } from "./lib/platforms.ts";
import { capabilityOf, loadSkillGraph, nameOf } from "./lib/skill-graph-compat.ts";
import type { SkillGraphNodeV2, SkillGraphV2 } from "./lib/skill-graph-compat.ts";

const VERSION = "2.5.0";

/** Convergence threshold: a capability carried by >= this many project graphs is a candidate. */
export const CONVERGENCE_THRESHOLD = 3;

/** v2.2.0 (hub-consolidation design §9): fan-in threshold — a capability (skill/agent)
 *  carried by >= this many DISTINCT project graphs is fan-in-qualifying (hub candidacy). */
export const FAN_IN_THRESHOLD = 2;

/** v2.2.0: the designated hub candidates whose fan-in-qualifying assets the report
 *  breaks out (design docs/designs/2026-11-01-hub-consolidation-design.md §9 / Phase 0
 *  evidence for the hub-selection record). */
export const HUB_CANDIDATES = ["co-develop", "co-design", "co-security"] as const;

/** A skill-graph projection (v1 or v2 file, always read through the compat loader). */
type SkillGraph = SkillGraphV2;

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
  /** v2.0.0: capability-keyed convergence classification (threshold = CONVERGENCE_THRESHOLD). */
  convergence?: ConvergenceResult;
  /** v2.2.0 (additive): fan-in classification (skills + agents, threshold = FAN_IN_THRESHOLD),
   *  the hub-candidacy substrate (2026-11-01-hub-consolidation design §9). */
  fanIn2?: FanIn2Result;
  /** v1.1.0: root-graph orphan cross-check (4-way: definition+registry+mirror+reference).
   *  v2.1.0: isolatedAgents carries the same axes as skills; carriedByScoped lists L0
   *  nodes whose same-name scoped copies hold the edges (v2 re-attribution, not isolation). */
  rootOrphans?: {
    isolatedSkills: Array<{
      id: string;
      registry: boolean;
      mirrors: string[];
      docRefs: number;
    }>;
    isolatedAgents: Array<{
      id: string;
      registry: boolean;
      mirrors: string[];
      docRefs: number;
    }>;
    carriedByScoped: string[];
  };
}

export interface ConvergenceResult {
  threshold: number;
  /** Present in >= threshold projects, single content hash across all of them. */
  converged: string[];
  /** Present in >= threshold projects with >= 2 distinct content hashes. */
  convergenceWithDivergence: Array<{ capability: string; hashes: Record<string, string[]> }>;
  /** Present in >= threshold projects but >= 1 project graph (v1) carries no hash. */
  hashUnknown: string[];
}

/** v2.2.0 (hub-consolidation design §9): fan-in classification over `skill:`/`agent:`
 *  capability keys. Capability entries carry the fan-in count and the sorted carrier list. */
export interface FanIn2Result {
  threshold: number;
  /** Capabilities with fan-in >= threshold, sorted by fan-in desc then capability. */
  capabilities: Array<{ capability: string; fanIn: number; projects: string[] }>;
}

/** Per project: capability -> content hashes of its skill nodes (null = unknown, e.g. v1 graph). */
export function skillCapabilities(graph: SkillGraph): Map<string, Set<string | null>> {
  const out = new Map<string, Set<string | null>>();
  for (const n of graph.nodes ?? []) {
    if (n.type !== "skill") continue;
    const cap = capabilityOf(n);
    if (!out.has(cap)) out.set(cap, new Set());
    out.get(cap)!.add(typeof n.content_hash === "string" && n.content_hash ? n.content_hash : null);
  }
  return out;
}

/**
 * Classify capabilities by fleet convergence (design §3.3). Pure: input is the per-project
 * capability -> hashes map; only project graphs count (root is the source, not a project).
 */
export function classifyConvergence(
  projects: Map<string, Map<string, Set<string | null>>>,
  threshold: number = CONVERGENCE_THRESHOLD,
): ConvergenceResult {
  const carriers = new Map<string, string[]>();
  for (const [project, caps] of projects) {
    for (const cap of caps.keys()) {
      if (!carriers.has(cap)) carriers.set(cap, []);
      carriers.get(cap)!.push(project);
    }
  }
  const result: ConvergenceResult = { threshold, converged: [], convergenceWithDivergence: [], hashUnknown: [] };
  for (const [cap, list] of [...carriers.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (list.length < threshold) continue;
    const byHash = new Map<string, string[]>();
    let unknown = false;
    for (const project of list.sort()) {
      for (const h of projects.get(project)!.get(cap)!) {
        if (h === null) {
          unknown = true;
          continue;
        }
        if (!byHash.has(h)) byHash.set(h, []);
        byHash.get(h)!.push(project);
      }
    }
    if (byHash.size >= 2) {
      result.convergenceWithDivergence.push({ capability: cap, hashes: Object.fromEntries(byHash) });
    } else if (unknown) {
      result.hashUnknown.push(cap);
    } else {
      result.converged.push(cap);
    }
  }
  return result;
}

/**
 * v2.2.0 — Fan-in capability keys of one graph: `skill:<capability>` / `agent:<capability>`
 * (same key shape as nodeKey). Skills and agents ONLY — scripts are not graph nodes
 * (hub-consolidation design §9: script fan-in is not graph-derivable), phases are not
 * capabilities.
 */
export function fanInCapabilityKeys(graph: SkillGraph): Set<string> {
  const out = new Set<string>();
  for (const n of graph.nodes ?? []) {
    if (n.type !== "skill" && n.type !== "agent") continue;
    const k = nodeKey(n);
    if (k !== null) out.add(k);
  }
  return out;
}

/**
 * v2.2.0 — Classify capabilities by fan-in (design docs/designs/2026-11-01-hub-consolidation-design.md
 * §9). Pure: input is per-project capability-key sets; only project graphs count (root is the
 * source, not a consumer). A capability carried by >= `threshold` DISTINCT project graphs is
 * fan-in-qualifying. Additive to the convergence classification (threshold 3 stays untouched).
 */
export function classifyFanIn2(projects: Map<string, Set<string>>, threshold: number = FAN_IN_THRESHOLD): FanIn2Result {
  const carriers = new Map<string, string[]>();
  for (const [project, keys] of projects) {
    for (const key of keys) {
      const list = carriers.get(key);
      if (list) list.push(project);
      else carriers.set(key, [project]);
    }
  }
  const capabilities = [...carriers.entries()]
    .filter(([, list]) => list.length >= threshold)
    .map(([capability, list]) => ({ capability, fanIn: list.length, projects: [...list].sort() }))
    .sort((a, b) => b.fanIn - a.fanIn || a.capability.localeCompare(b.capability));
  return { threshold, capabilities };
}

/**
 * v2.2.0 — Assets (capability keys) of `project` that are fan-in-qualifying, sorted.
 * A project's own carriership counts toward its assets' fan-in, so an asset qualifies
 * for a hub candidate when at least one OTHER project also carries it.
 */
export function hubQualifyingAssets(project: string, fanIn2: FanIn2Result): string[] {
  return fanIn2.capabilities
    .filter((c) => c.projects.includes(project))
    .map((c) => c.capability)
    .sort();
}

export interface FleetReportArgs {
  json: boolean;
  snapshotDir: string;
  help: boolean;
  /** v2.5.0: --html <path> override; null = default docs/skill-graph-history.html. */
  htmlPath: string | null;
  /** v2.5.0: --no-html (skips the emission entirely; wins over --html). */
  noHtml: boolean;
}

/**
 * v2.5.0: exported (argv-injectable) for unit coverage of the --html/--no-html
 * surface; unknown arguments stay ignored (v2.4.0 semantics unchanged).
 */
export function parseArgs(argv: string[] = process.argv.slice(2)): FleetReportArgs {
  let json = false;
  let snapshotDir = join("memory", "skill-graph-metrics");
  let help = false;
  let htmlPath: string | null = null;
  let noHtml = false;
  const usageExit = (flag: string): never => {
    console.error(`❌ skill-graph-fleet-report: ${flag} requires a value (usage error).`);
    process.exit(1);
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--help" || argv[i] === "-h") help = true;
    else if (argv[i] === "--json") json = true;
    else if (argv[i] === "--snapshot-dir") {
      const val = argv[++i];
      if (val === undefined) usageExit("--snapshot-dir");
      snapshotDir = val;
    } else if (argv[i] === "--no-html") noHtml = true;
    else if (argv[i] === "--html") {
      const val = argv[++i];
      if (val === undefined) usageExit("--html");
      htmlPath = val;
    }
  }
  return { json, snapshotDir, help, htmlPath, noHtml };
}

/**
 * Fleet members (sorted), minus transient PR working checkouts (T-20261103-004
 * — see filterTransientCheckouts in scripts/lib/git-aware-scan.ts).
 * Fleet membership SSOT (design docs/designs/2026-11-07-fleet-membership-ssot-design.md
 * §5, DEC-20261107-01): Projects/co-* minus the docs/fleet-membership.json
 * exclusions, derived exclusively through lib/fleet.ts (the sole membership
 * path — no co- prefix filter here). Transient-checkout semantics unchanged.
 * v2.5.0: also returns the skipped transient checkouts so the history page can
 * annotate absentees ("transient PR checkout") honestly (same derivation, no
 * second scan).
 */
function defaultProjects(): { projects: string[]; skipped: Array<{ name: string; branch: string }> } {
  const candidates = listFleetProjects();
  const { projects, skipped } = filterTransientCheckouts(candidates, checkoutBranch);
  for (const s of skipped) {
    console.warn(
      `⚠️  skill-graph-fleet-report: ${s.name} is a transient PR working checkout (branch ${s.branch}) — excluded from fleet discovery (T-20261103-004).`,
    );
  }
  return { projects, skipped };
}

/** Load a graph projection file (v1 or v2) as a v2 view; null when absent or unparseable. */
function loadGraph(path: string): SkillGraph | null {
  return loadSkillGraph(path);
}

/**
 * Cross-graph node key: skills/agents join on capability (v1 bare ids and v2 scoped ids meet);
 * phase nodes are skipped (v1 graphs never had them as nodes); everything else is its id.
 */
function nodeKey(n: SkillGraphNodeV2): string | null {
  if (n.type === "phase") return null;
  if (n.type === "skill" || n.type === "agent") return `${n.type}:${capabilityOf(n)}`;
  return n.id;
}

function nodeIds(graph: SkillGraph): Set<string> {
  const out = new Set<string>();
  for (const n of graph.nodes ?? []) {
    const k = nodeKey(n);
    if (k !== null) out.add(k);
  }
  return out;
}

/** Skill capabilities (the presence-matrix key; equals the bare skill id for v1 graphs). */
function skillIds(graph: SkillGraph): Set<string> {
  return new Set(skillCapabilities(graph).keys());
}

function skillNodeCount(graph: SkillGraph): number {
  return (graph.nodes ?? []).filter((n) => n.type === "skill").length;
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
function findPreviousSnapshot(
  snapshotDir: string,
  beforeDate: string,
): { file: string; date: string; data: Snapshot } | null {
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
 * reference): registry = SKILLS.md row (skills) or the VERSION_MANIFEST row /
 * lifecycle record (agents), mirrors = which of the 5 platform skill bases
 * carry the skill (skills) or the root agents/ directory (agents), docRefs =
 * occurrences in the bounded workflow-doc corpus (platform/agent context docs +
 * procedures/ + process/).
 *
 * v2.1.0 (T-20261009-008, design docs/designs/2026-10-09-skill-graph-triage-hardening-design.md D3):
 * same-capability edge attribution — an L0 node whose same-name scoped copies
 * hold ≥1 edge is NOT isolated (v2 re-attributed the edges at scope time); the
 * name is reported under carriedByScoped instead of the isolated lists.
 */
function analyzeRootOrphans(rootGraph: SkillGraph): NonNullable<Snapshot["rootOrphans"]> {
  const edgeTouch = new Map<string, number>();
  for (const e of rootGraph.edges ?? []) {
    if (e.from) edgeTouch.set(e.from, (edgeTouch.get(e.from) ?? 0) + 1);
    if (e.to) edgeTouch.set(e.to, (edgeTouch.get(e.to) ?? 0) + 1);
  }
  const connected = new Set<string>(edgeTouch.keys());
  // v2: the root graph carries every variant's scoped copy; the orphan cross-check is about the
  // workspace-root (L0) assets, matched by bare name against registry/mirrors/doc corpus.
  // D3: scoped copies holding edges attribute to their bare name.
  const scopedEdgesByName = new Map<string, number>();
  for (const n of rootGraph.nodes ?? []) {
    if (n.type === "phase" || n.layer === "L0") continue;
    const touch = edgeTouch.get(n.id) ?? 0;
    if (touch > 0) scopedEdgesByName.set(nameOf(n), (scopedEdgesByName.get(nameOf(n)) ?? 0) + touch);
  }
  const isolated = (rootGraph.nodes ?? []).filter(
    (n) => n.type && n.layer === "L0" && !connected.has(n.id) && !(scopedEdgesByName.get(nameOf(n)) ?? 0),
  );
  const carriedByScoped = (rootGraph.nodes ?? [])
    .filter(
      (n) =>
        n.type &&
        n.type !== "phase" &&
        n.layer === "L0" &&
        !connected.has(n.id) &&
        (scopedEdgesByName.get(nameOf(n)) ?? 0) > 0,
    )
    .map((n) => nameOf(n));

  const registryPath = join("skills", "SKILLS.md");
  const registry = existsSync(registryPath) ? readFileSync(registryPath, "utf8") : "";
  const agentsRegistry = existsSync(join("docs", "VERSION_MANIFEST.md"))
    ? readFileSync(join("docs", "VERSION_MANIFEST.md"), "utf8")
    : "";
  const agentRegistered = (name: string): boolean =>
    agentsRegistry.includes(`\`${name}\``) || existsSync(join("docs", "lifecycle", "agents", `${name}.md`));
  const MIRROR_BASES = PLATFORM_MIRROR_DIRS;

  const corpusFiles: string[] = [];
  for (const f of ["AGENTS.md", "CLAUDE.md", "GEMINI.md", "CODEX.md", "HERMES.md"]) {
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
  const corpus = corpusFiles
    .map((f) => {
      try {
        return readFileSync(f, "utf8").toLowerCase();
      } catch {
        return "";
      }
    })
    .join("\n");

  const isolatedSkills = isolated
    .filter((n) => n.type === "skill" && n.layer === "L0")
    .map((n) => ({
      id: nameOf(n),
      registry: registry.includes(`| \`${nameOf(n)}\``),
      mirrors: MIRROR_BASES.filter((b) => existsSync(join(b, nameOf(n), "SKILL.md"))),
      docRefs: corpus.split(nameOf(n).toLowerCase()).length - 1,
    }));
  const isolatedAgents = isolated
    .filter((n) => n.type === "agent" && n.layer === "L0")
    .map((n) => ({
      id: nameOf(n),
      registry: agentRegistered(nameOf(n)),
      mirrors: existsSync(join("agents", `${nameOf(n)}.md`)) ? ["agents/"] : [],
      docRefs: corpus.split(nameOf(n).toLowerCase()).length - 1,
    }));

  return { isolatedSkills, isolatedAgents, carriedByScoped };
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
  convergence: ConvergenceResult | null = null,
  v1Projects: string[] = [],
  fanIn2: FanIn2Result | null = null,
  hubEvidence: Record<string, string[] | null> = {},
): string {
  const lines: string[] = [
    `# skill-graph fleet report — ${localDateISO()}`,
    "",
    `Root graph: ${rootGraph.nodes?.length ?? 0} nodes · ${rootGraph.edges?.length ?? 0} edges · ${skillNodeCount(rootGraph)} skill nodes. Projects covered: ${stats.length}${skipped.length > 0 ? ` (skipped, no graph: ${skipped.join(", ")})` : ""}.`,
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
  const ranked = [...presence.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
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

  // v2.0.0 — convergence by capability (threshold preserved at 3 project graphs)
  if (convergence) {
    const total =
      convergence.converged.length + convergence.convergenceWithDivergence.length + convergence.hashUnknown.length;
    lines.push(`## Skill convergence by capability (>= ${convergence.threshold} projects)`, "");
    lines.push(
      `${total} capabilities are carried by >= ${convergence.threshold} project graphs: ${convergence.converged.length} converged (single content hash), ${convergence.convergenceWithDivergence.length} convergence-with-divergence (>= 2 hashes), ${convergence.hashUnknown.length} hash-unknown.`,
    );
    if (v1Projects.length > 0) {
      lines.push(
        "",
        `Hash-unknown means presence is confirmed by capability but at least one carrier is a v1 project graph (no content hashes) — projects on v1: ${v1Projects.join(", ")}. Divergence becomes computable once \`upgrade-project\` delivers the v2 generator.`,
      );
    }
    lines.push("");
    lines.push(
      `- converged (${convergence.converged.length}): ${convergence.converged.length > 0 ? convergence.converged.join(", ") : "—"}`,
    );
    lines.push(
      `- hash-unknown (${convergence.hashUnknown.length}): ${convergence.hashUnknown.length > 0 ? convergence.hashUnknown.join(", ") : "—"}`,
    );
    lines.push("");
    lines.push("### Convergence with divergence (reconciliation candidates — not auto-promoted)", "");
    if (convergence.convergenceWithDivergence.length === 0) {
      lines.push("None.");
    } else {
      lines.push("| capability | hash groups (hash: projects) |", "|---|---|");
      for (const d of convergence.convergenceWithDivergence) {
        const groups = Object.entries(d.hashes)
          .map(([h, ps]) => `${h.slice(0, 8)}: ${ps.join(", ")}`)
          .join(" · ");
        lines.push(`| ${d.capability} | ${groups} |`);
      }
    }
    lines.push("");
  }

  // v2.2.0 — fan-in >= 2 classification (hub-candidacy substrate, 2026-11-01-hub-consolidation §9)
  if (fanIn2) {
    lines.push(`## Fan-in >= ${fanIn2.threshold} by capability (hub-candidacy substrate)`, "");
    lines.push(
      `${fanIn2.capabilities.length} capabilities (skills + agents) are carried by >= ${fanIn2.threshold} distinct project graphs. Scripts are not graph nodes — script fan-in is tracked via the hub registry's declared consumers[], not measured here.`,
    );
    lines.push("");
    lines.push("| capability | fan-in | projects |", "|---|---|---|");
    for (const c of fanIn2.capabilities) {
      lines.push(`| ${c.capability} | ${c.fanIn} | ${c.projects.join(", ")} |`);
    }
    lines.push("");
    lines.push("### Hub-candidate assets with fan-in >= 2 (hub-selection evidence)", "");
    for (const hub of HUB_CANDIDATES) {
      const assets = hubEvidence[hub];
      if (assets === null || assets === undefined) {
        lines.push(`- ${hub}: no project graph loaded — no evidence this run`);
      } else {
        lines.push(`- ${hub}: ${assets.length} qualifying assets${assets.length > 0 ? ` — ${assets.join(", ")}` : ""}`);
      }
    }
    lines.push("");
  }

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
    lines.push(
      `No previous snapshot${diffBase ? ` (newest: ${diffBase.file})` : ""} — this run establishes the baseline.`,
    );
    lines.push("");
  } else {
    lines.push(`## Fleet diff vs snapshot ${diffBase?.date ?? "?"} (memory/skill-graph-metrics)`, "");
    lines.push(
      `- NEW skills (${diff.newSkills.length}): ${diff.newSkills.length > 0 ? diff.newSkills.join(", ") : "—"}`,
    );
    lines.push(
      `- VANISHED skills (${diff.vanishedSkills.length}): ${diff.vanishedSkills.length > 0 ? diff.vanishedSkills.join(", ") : "—"}`,
    );
    lines.push("");
  }

  // v1.1.0 — root-graph orphan cross-check (4-way: definition+registry+mirror+reference)
  // v2.1.0 — agent axes + carriedByScoped attribution (T-20261009-008)
  lines.push("## Root-graph orphan candidates (4-way cross-check)", "");
  const orphanCount = orphans ? orphans.isolatedSkills.length + orphans.isolatedAgents.length : 0;
  if (!orphans || (orphanCount === 0 && orphans.carriedByScoped.length === 0)) {
    lines.push("None — every root skill and agent carries at least one graph edge.");
    lines.push("");
  } else {
    if (orphans.carriedByScoped.length > 0) {
      lines.push(
        `Carried by scoped copies (v2 edge re-attribution — NOT isolated): ${orphans.carriedByScoped.join(", ")}`,
      );
      lines.push("");
    }
    if (orphanCount > 0) {
      lines.push(
        "Graph-isolated (zero edges, no scoped-copy attribution). Cross-axes: registry = SKILLS.md row (skills) or VERSION_MANIFEST/lifecycle record (agents), mirrors = platform skill bases (skills) or root agents/ (agents), refs = workflow-doc corpus mentions.",
      );
      lines.push(
        "Triage: all four axes present → graph-edge gap (file an overrides entry or citation); zero axes → true orphan (retire or wire in).",
      );
      lines.push("");
      if (orphans.isolatedAgents.length > 0) {
        lines.push("- isolated agents:");
        for (const o of orphans.isolatedAgents) {
          const axes = [
            o.registry ? "registry ✓" : "registry ✗",
            o.mirrors.length > 0 ? "agents/ ✓" : "agents/ ✗",
            `refs ${o.docRefs}`,
          ].join(", ");
          lines.push(`  - ${o.id}: ${axes}`);
        }
      }
      for (const o of orphans.isolatedSkills) {
        const axes = [
          o.registry ? "registry ✓" : "registry ✗",
          `mirrors ${o.mirrors.length}/5`,
          `refs ${o.docRefs}`,
        ].join(", ");
        lines.push(`- ${o.id}: ${axes}`);
      }
      lines.push("");
    }
  }
  return lines.join("\n");
}

// ── v2.5.0 — history dashboard (design docs/designs/2026-11-23-skill-graph-history-report-design.md §5.2-§5.3) ──

/** escapeHtml per the ticket.ts board --html precedent (scripts/ticket.ts:173-180):
 *  & < > " ' all escaped, so the helper is safe inside text and inside attributes alike. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** v2.5.0: a fleet member matching a governance ticket whose title mentions skill-graph. */
export interface HistoryTicket {
  id: string;
  title: string;
  status: string;
  priority: string;
  /** Which store the ticket came from (live wins when an id exists in both). */
  source: "live" | "archive";
  /** Title carries the runner's `skill-graph:` NEW-id ticket convention. */
  runnerFiled: boolean;
}

export interface FleetInfoInput {
  /** Total fleet-membership SSOT size (listFleetProjects(), incl. transient-absent members). */
  count: number;
  /** Member NAMES (not Projects/ paths), sorted. */
  members: string[];
  /** Members whose checkout sits on a transient `pr/*` branch this run. */
  transientAbsent: string[];
}

export interface HistorySeriesRow {
  date: string;
  projects: Record<string, { nodes: number; edges: number; skills: number }>;
  classes: { converged: number; divergent: number; unknown: number };
  newSkills: string[];
  vanishedSkills: string[];
}

export interface HistoryGap {
  /** First missing calendar day (strictly between two snapshot dates). */
  from: string;
  /** Last missing calendar day. */
  to: string;
  days: number;
}

export interface HistoryModel {
  fleet: { count: number; members: Array<{ name: string; transientAbsent: boolean }> };
  /** Sorted by date ascending. */
  series: HistorySeriesRow[];
  /** Missing-day ranges derived from the series — never hardcoded. */
  gaps: HistoryGap[];
  latest: {
    date: string;
    convergence: {
      converged: string[];
      convergenceWithDivergence: Array<{ capability: string; hashes: Record<string, string[]> }>;
      hashUnknown: string[];
    };
    missingFromProjects: Record<string, string[]>;
    fanIn2: FanIn2Result | null;
    rootOrphans: Snapshot["rootOrphans"] | null;
  };
  tickets: HistoryTicket[];
}

/**
 * Minimal YAML scalar reader for governance tickets (design §5.3): extracts the
 * requested TOP-LEVEL scalar fields, implementing folded (`>` / `>`+chomp) and
 * literal (`|`+chomp) block scalars — never line-grep. Plain and quoted
 * single-line scalars are supported; nested structures (history:, upstream:)
 * are skipped because their keys are indented and never match the indent-0
 * key line. Unknown keys are ignored.
 */
export function extractTicketScalars(src: string, keys: string[]): Record<string, string> {
  const lines = src.split(/\r?\n/);
  const out: Record<string, string> = {};
  const wanted = new Set(keys);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^([A-Za-z_][A-Za-z0-9_-]*):(?:[ \t]+(.*))?[ \t]*$/);
    if (!m || !wanted.has(m[1]) || m[1] in out) continue;
    const inline = (m[2] ?? "").trim();
    if (inline === "") continue; // indented follow-up lines = nested structure, not our scalars
    const bm = inline.match(/^([>|])([0-9]*)([+-]?)(?:[ \t]+(.*))?$/);
    if (bm) {
      out[m[1]] = readBlockScalar(lines, i + 1, bm[1] === ">", bm[3]);
      continue;
    }
    out[m[1]] = unquoteYamlScalar(inline);
  }
  return out;
}

function unquoteYamlScalar(s: string): string {
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1);
  if (s.length >= 2 && s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1).replace(/''/g, "'");
  return s;
}

/** Chomping: `-` strips trailing newlines, default (clip) leaves a single one, `+` keeps all.
 *  Titles are display strings, so clip is normalized to trimEnd (a trailing newline is never
 *  meaningful for contains/prefix matching). */
function trimChomped(s: string, chomp: string): string {
  if (chomp === "+") return s;
  return s.replace(/\n+$/, "").trimEnd();
}

/**
 * Block-scalar body reader: collects the indented (or blank) lines after the
 * header, strips the first-content-line indentation, then folds (>) or keeps
 * literal (|). Folding: single newline between equally-indented lines → space;
 * a run of n blank lines → n newlines; a more-indented line keeps literal
 * newlines around itself.
 */
function readBlockScalar(lines: string[], start: number, folded: boolean, chomp: string): string {
  const body: string[] = [];
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") {
      body.push("");
      continue;
    }
    if (!/^[ \t]/.test(line)) break; // dedented to indent-0 → block ended
    body.push(line);
  }
  let contentIndent = -1;
  for (const line of body) {
    if (line.trim() === "") continue;
    contentIndent = (line.match(/^[ \t]+/)?.[0] ?? "").length;
    break;
  }
  if (contentIndent < 0) return ""; // empty block
  // `.length` must bind to the Math.min RESULT (the indent width actually stripped),
  // not to Math.min's numeric return (whose .length is undefined → slice(0) → no strip).
  const stripped = body.map((l) =>
    l === "" ? "" : l.slice(Math.min(contentIndent, (l.match(/^[ \t]+/)?.[0] ?? "").length)),
  );
  if (!folded) return trimChomped(stripped.join("\n"), chomp);
  let out = "";
  let blanks = 0;
  let prevMore = false;
  let started = false;
  for (const line of stripped) {
    if (line === "") {
      blanks++;
      continue;
    }
    const more = /^[ \t]/.test(line);
    if (!started) out = line;
    else if (blanks > 0) out += "\n".repeat(blanks) + line;
    else if (prevMore || more) out += "\n" + line;
    else out += " " + line;
    blanks = 0;
    prevMore = more;
    started = true;
  }
  return trimChomped(out, chomp);
}

/**
 * v2.5.0 — governance ticket scan for the Tickets tab (design §5.3): read-only
 * over `liveDir` (tickets/governance) and `archiveDir` (…/archive) *.yaml
 * files; a title containing `skill-graph` (case-insensitive) matches; titles
 * starting with `skill-graph:` are the runner's NEW-id tickets (runnerFiled).
 * Sorted by id descending (newest first); live wins when an id exists in both
 * stores. Absent directories → empty contribution, no error. The id comes from
 * the `id:` field or, when the line-oriented reader finds none (e.g. the
 * flow-style single-line `{id: U-…, title: …}` archived U-tickets whose keys
 * never start a line), from the filename (`U-YYYYMMDD-NNN.yaml` → `U-…`);
 * scalar styles plain / quoted / folded `>` / literal `|` are supported for
 * top-level keys. A file with no extractable id (field AND ticket-shaped
 * filename) AND no title is malformed → skipped with a stderr note (WARN
 * posture — never fails the run).
 */
export function scanSkillGraphTickets(liveDir: string, archiveDir: string): HistoryTicket[] {
  const rows: HistoryTicket[] = [];
  const seen = new Set<string>();
  const scan = (dir: string, source: "live" | "archive"): void => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (!e.isFile() || !e.name.endsWith(".yaml")) continue;
      const path = join(dir, e.name);
      let raw: string;
      try {
        raw = readFileSync(path, "utf-8");
      } catch (err) {
        console.warn(
          `⚠️  skill-graph-fleet-report: unreadable ticket file skipped: ${path} (${err instanceof Error ? err.message : String(err)})`,
        );
        continue;
      }
      const fields = extractTicketScalars(raw, ["id", "title", "status", "priority"]);
      const filenameId = e.name.replace(/\.yaml$/, "");
      const filenameCarriesId = /^[A-Z]-\d{8}-\d{3,4}$/.test(filenameId);
      if (!fields.id && !fields.title && !filenameCarriesId) {
        console.warn(`⚠️  skill-graph-fleet-report: malformed ticket file skipped (no id/title found): ${path}`);
        continue;
      }
      const id = fields.id ?? filenameId;
      if (seen.has(id)) continue; // live store wins over an archived duplicate
      seen.add(id);
      const title = (fields.title ?? "").trim();
      if (!title.toLowerCase().includes("skill-graph")) continue;
      rows.push({
        id,
        title,
        status: fields.status ?? "",
        priority: fields.priority ?? "",
        source,
        runnerFiled: title.toLowerCase().startsWith("skill-graph:"),
      });
    }
  };
  scan(liveDir, "live");
  scan(archiveDir, "archive");
  return rows.sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
}

const DAY_MS = 86_400_000;

/** Calendar-day ranges strictly between consecutive snapshot dates (sorted, deduped input). */
export function deriveGaps(dates: string[]): HistoryGap[] {
  const sorted = [...new Set(dates)].sort();
  const out: HistoryGap[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prevMs = Date.parse(`${sorted[i - 1]}T00:00:00Z`);
    const curMs = Date.parse(`${sorted[i]}T00:00:00Z`);
    const days = Math.round((curMs - prevMs) / DAY_MS) - 1;
    if (days <= 0) continue;
    const from = new Date(prevMs + DAY_MS).toISOString().slice(0, 10);
    const to = new Date(curMs - DAY_MS).toISOString().slice(0, 10);
    out.push({ from, to, days });
  }
  return out;
}

/** Fleet-wide skill universe of one snapshot (same reconstruction as the live
 *  fleetSkillSet: fleetPresence keys ∪ the missingFromProjects lists). */
function snapshotSkillUniverse(s: Snapshot): Set<string> {
  const out = new Set(Object.keys(s.fleetPresence ?? {}));
  for (const list of Object.values(s.missingFromProjects ?? {})) {
    for (const id of list ?? []) out.add(id);
  }
  return out;
}

/** Parse every snapshot-YYYY-MM-DD.json in the dir, sorted by date (filename-authoritative).
 *  A malformed snapshot throws — the caller's WARN wrapper turns that into one stderr note. */
function loadSnapshots(snapshotDir: string): Snapshot[] {
  if (!existsSync(snapshotDir)) return [];
  const rows: Snapshot[] = [];
  for (const f of readdirSync(snapshotDir)) {
    const m = f.match(/^snapshot-(\d{4}-\d{2}-\d{2})\.json$/);
    if (!m) continue;
    let data: Snapshot;
    try {
      data = JSON.parse(readFileSync(join(snapshotDir, f), "utf-8")) as Snapshot;
    } catch (err) {
      throw new Error(`malformed snapshot ${f}: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (!data.date) data.date = m[1];
    rows.push(data);
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * v2.5.0 — compact projection over the snapshot history (design §5.2): per-date
 * class counts + pairwise NEW/VANISHED replay (snapshots do not store
 * historical diffs), derived gap ranges, latest-snapshot detail, dynamic fleet
 * coverage with the transient-absent annotation, and the governance-ticket
 * scan. Pure: identical inputs → identical model → byte-identical page.
 */
export function buildHistoryModel(
  snapshots: Snapshot[],
  fleetInfo: FleetInfoInput,
  tickets: HistoryTicket[] = [],
): HistoryModel {
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const series: HistorySeriesRow[] = sorted.map((s, i) => {
    const conv = s.convergence;
    const classes = {
      converged: conv?.converged.length ?? 0,
      divergent: conv?.convergenceWithDivergence.length ?? 0,
      unknown: conv?.hashUnknown.length ?? 0,
    };
    let newSkills: string[] = [];
    let vanishedSkills: string[] = [];
    if (i > 0) {
      const prev = snapshotSkillUniverse(sorted[i - 1]);
      const cur = snapshotSkillUniverse(s);
      newSkills = [...cur].filter((id) => !prev.has(id)).sort();
      vanishedSkills = [...prev].filter((id) => !cur.has(id)).sort();
    }
    return { date: s.date, projects: s.projects ?? {}, classes, newSkills, vanishedSkills };
  });
  const gaps = deriveGaps(series.map((r) => r.date));
  const latestSnap = sorted[sorted.length - 1] ?? null;
  const latest: HistoryModel["latest"] = {
    date: latestSnap?.date ?? "",
    convergence: {
      converged: latestSnap?.convergence?.converged ?? [],
      convergenceWithDivergence: latestSnap?.convergence?.convergenceWithDivergence ?? [],
      hashUnknown: latestSnap?.convergence?.hashUnknown ?? [],
    },
    missingFromProjects: latestSnap?.missingFromProjects ?? {},
    fanIn2: latestSnap?.fanIn2 ?? null,
    rootOrphans: latestSnap?.rootOrphans ?? null,
  };
  const present = new Set(Object.keys(latestSnap?.projects ?? {}));
  const members = fleetInfo.members.map((name) => ({
    name,
    transientAbsent: !present.has(name) && fleetInfo.transientAbsent.includes(name),
  }));
  return { fleet: { count: fleetInfo.count, members }, series, gaps, latest, tickets };
}

/** Full page as one deterministic string; write only after it is fully built (design §5.1). */
export function renderHistoryPage(model: HistoryModel): string {
  const lastRow = model.series[model.series.length - 1];
  const presentCount = lastRow ? Object.keys(lastRow.projects).length : 0;
  const noscriptSummary =
    `Snapshot ${escapeHtml(model.latest.date)}: ${escapeHtml(String(presentCount))}/${escapeHtml(String(model.fleet.count))}` +
    ` fleet members covered; convergence ` +
    `${escapeHtml(String(model.latest.convergence.converged.length))} converged / ` +
    `${escapeHtml(String(model.latest.convergence.convergenceWithDivergence.length))} divergent / ` +
    `${escapeHtml(String(model.latest.convergence.hashUnknown.length))} hash-unknown; ` +
    `${escapeHtml(String(model.tickets.length))} matching governance tickets. ` +
    `Enable JavaScript for the full dashboard.`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Skill-Graph Fleet History</title>
<style>
:root{--bg:#f6f7f9;--fg:#1c2430;--muted:#5b6673;--card:#ffffff;--border:#d5dae1;--accent:#2563eb;--ok:#15803d;--warn:#b45309;--unk:#64748b;--chip:#e8edf3;--hatch:#c9d2dc}
:root[data-theme="light"]{--bg:#f6f7f9;--fg:#1c2430;--muted:#5b6673;--card:#ffffff;--border:#d5dae1;--accent:#2563eb;--ok:#15803d;--warn:#b45309;--unk:#64748b;--chip:#e8edf3;--hatch:#c9d2dc}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#12161c;--fg:#dce3ec;--muted:#8b96a5;--card:#1a2028;--border:#2b333e;--accent:#5b9dff;--ok:#4ade80;--warn:#fbbf24;--unk:#94a3b8;--chip:#232b35;--hatch:#39434f}}
:root[data-theme="dark"]{--bg:#12161c;--fg:#dce3ec;--muted:#8b96a5;--card:#1a2028;--border:#2b333e;--accent:#5b9dff;--ok:#4ade80;--warn:#fbbf24;--unk:#94a3b8;--chip:#232b35;--hatch:#39434f}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}
header{padding:16px 20px 0;border-bottom:1px solid var(--border)}
h1{margin:0 0 8px;font-size:20px}
.controls{display:flex;gap:8px;align-items:center;margin-bottom:10px}
.controls input{flex:1;max-width:520px;padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--card);color:var(--fg)}
.controls button{padding:6px 12px;border:1px solid var(--border);border-radius:6px;background:var(--card);color:var(--fg);cursor:pointer}
#tabs{display:flex;gap:4px;flex-wrap:wrap}
.tab-btn{padding:7px 14px;border:1px solid var(--border);border-bottom:none;border-radius:6px 6px 0 0;background:var(--card);color:var(--muted);cursor:pointer;font:inherit}
.tab-btn.active{color:var(--fg);font-weight:600;border-bottom:1px solid var(--card);margin-bottom:-1px}
main{padding:16px 20px 40px}
.tab{display:none}
.tab.active{display:block}
.muted{color:var(--muted)}
.stats{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0}
.stat{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:10px 16px;min-width:130px}
.stat-v{font-size:22px;font-weight:700}
.stat-l{color:var(--muted);font-size:12px}
.absent .row{background:var(--card);border:1px solid var(--border);border-radius:6px;padding:5px 10px;margin:4px 0;color:var(--warn)}
h2{font-size:15px;margin:18px 0 8px}
.trend{display:flex;align-items:flex-end;gap:3px;height:56px;padding:6px;background:var(--card);border:1px solid var(--border);border-radius:8px;overflow-x:auto}
.tcol{display:flex;align-items:flex-end;gap:1px}
.tcol i{width:7px;display:block;border-radius:1px}
.tcol i.c{background:var(--ok)}.tcol i.d{background:var(--warn)}.tcol i.u{background:var(--unk)}
.strip{display:flex;height:20px;border:1px solid var(--border);border-radius:6px;overflow:hidden}
.strip .tick{background:var(--accent)}
.strip .gap{background:repeating-linear-gradient(45deg,var(--hatch),var(--hatch) 4px,var(--bg) 4px,var(--bg) 8px)}
table{border-collapse:collapse;width:100%;margin:8px 0;background:var(--card);border:1px solid var(--border);border-radius:8px}
th,td{text-align:left;padding:6px 10px;border-bottom:1px solid var(--border);vertical-align:top}
th{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.04em}
tr:last-child td{border-bottom:none}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.chips{display:flex;flex-wrap:wrap;gap:4px;margin:4px 0}
.chip{display:inline-block;background:var(--chip);border:1px solid var(--border);border-radius:10px;padding:1px 8px;font-size:12px}
.chip.hash{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.chip.proj{background:transparent}
.cap{font-weight:600}
.hashline{display:flex;align-items:center;gap:4px;flex-wrap:wrap;margin:2px 0}
.group{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:8px 12px;margin:8px 0}
.count{background:var(--chip);border-radius:10px;padding:1px 8px;font-size:12px;margin-left:8px}
details.group>summary{cursor:pointer;display:flex;align-items:center}
details.group[open]>summary{margin-bottom:6px}
.badge{display:inline-block;background:var(--accent);color:#fff;border-radius:10px;padding:1px 8px;font-size:11px;white-space:nowrap}
.hidden{display:none}
</style>
</head>
<body>
<header>
<h1>Skill-Graph Fleet History</h1>
<div class="controls">
<input id="search" type="search" placeholder="Search this tab: capability, project, hash, skill id, ticket id or title" aria-label="Search active tab">
<button id="theme-toggle" type="button" aria-label="Toggle light or dark theme">Theme</button>
</div>
<nav id="tabs" aria-label="Report tabs">
<button class="tab-btn active" data-tab="overview" type="button">Overview</button>
<button class="tab-btn" data-tab="timeline" type="button">Timeline</button>
<button class="tab-btn" data-tab="divergence" type="button">Divergence</button>
<button class="tab-btn" data-tab="gaps" type="button">Delivery gaps</button>
<button class="tab-btn" data-tab="tickets" type="button">Tickets</button>
</nav>
</header>
<main>
<section id="tab-overview" class="tab active"></section>
<section id="tab-timeline" class="tab"></section>
<section id="tab-divergence" class="tab"></section>
<section id="tab-gaps" class="tab"></section>
<section id="tab-tickets" class="tab"></section>
</main>
<noscript><p class="muted">${noscriptSummary}</p></noscript>
<script id="report-data" type="application/json">${JSON.stringify(model).replace(/</g, "\\u003c")}</script>
<script>
(function () {
"use strict";
var MODEL = JSON.parse(document.getElementById("report-data").textContent);
function el(tag, cls, text) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
function chip(text, cls) { return el("span", cls ? "chip " + cls : "chip", text); }
function dayAfter(iso) { var d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); }
function dayBefore(iso) { var d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); }
function dayDiff(a, b) { return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000); }
function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + "\\u2026" : s; }

// theme: default follows prefers-color-scheme; the toggle flips and persists (design §5.2)
var THEME_KEY = "sgf-history-theme";
function setTheme(t) {
  document.documentElement.setAttribute("data-theme", t);
  try { localStorage.setItem(THEME_KEY, t); } catch (err) { /* storage unavailable: non-persistent theme */ }
}
try {
  var saved = localStorage.getItem(THEME_KEY);
  if (saved === "dark" || saved === "light") document.documentElement.setAttribute("data-theme", saved);
} catch (err) { /* ignore */ }
function currentTheme() {
  var attr = document.documentElement.getAttribute("data-theme");
  if (attr === "dark" || attr === "light") return attr;
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
document.getElementById("theme-toggle").addEventListener("click", function () {
  setTheme(currentTheme() === "dark" ? "light" : "dark");
});

// tabs
var TABS = ["overview", "timeline", "divergence", "gaps", "tickets"];
var sections = {};
TABS.forEach(function (t) { sections[t] = document.getElementById("tab-" + t); });
var active = "overview";
function activate(name) {
  active = name;
  document.querySelectorAll(".tab-btn").forEach(function (b) {
    b.classList.toggle("active", b.getAttribute("data-tab") === name);
  });
  TABS.forEach(function (t) { sections[t].classList.toggle("active", t === name); });
  applySearch();
}
document.querySelectorAll(".tab-btn").forEach(function (b) {
  b.addEventListener("click", function () { activate(b.getAttribute("data-tab")); });
});

// search: filters rows of the ACTIVE tab only (design §5.2)
var searchInput = document.getElementById("search");
function applySearch() {
  var q = searchInput.value.trim().toLowerCase();
  sections[active].querySelectorAll("[data-search]").forEach(function (row) {
    var hay = row.getAttribute("data-search");
    row.classList.toggle("hidden", q !== "" && hay.indexOf(q) === -1);
  });
}
searchInput.addEventListener("input", applySearch);

function statCard(value, label) {
  var c = el("div", "stat");
  c.appendChild(el("div", "stat-v", value));
  c.appendChild(el("div", "stat-l", label));
  return c;
}

function renderOverview() {
  var ov = sections.overview;
  ov.textContent = "";
  var presentSet = {};
  // present = projects carried by the latest series row (a member absent there
  // is a transient PR checkout or had no graph this run)
  var lastRow = MODEL.series[MODEL.series.length - 1];
  var present = lastRow ? Object.keys(lastRow.projects) : [];
  present.forEach(function (p) { presentSet[p] = true; });
  var head = el("div", "stats");
  head.appendChild(statCard(present.length + " / " + MODEL.fleet.count, "fleet members covered"));
  head.appendChild(statCard(String(MODEL.latest.convergence.converged.length), "converged"));
  head.appendChild(statCard(String(MODEL.latest.convergence.convergenceWithDivergence.length), "divergent"));
  head.appendChild(statCard(String(MODEL.latest.convergence.hashUnknown.length), "hash-unknown"));
  ov.appendChild(head);
  ov.appendChild(el("p", "muted", "Latest snapshot: " + MODEL.latest.date));
  var absent = MODEL.fleet.members.filter(function (m) { return !presentSet[m.name]; });
  if (absent.length > 0) {
    ov.appendChild(el("h2", "", "Absent members"));
    var ab = el("div", "absent");
    absent.forEach(function (m) {
      var reason = m.transientAbsent ? "absent: transient PR checkout" : "absent: no graph this run";
      var row = el("div", "row", m.name + " \\u2014 " + reason);
      row.setAttribute("data-search", (m.name + " " + reason).toLowerCase());
      ab.appendChild(row);
    });
    ov.appendChild(ab);
  }
  var maxClass = 1;
  MODEL.series.forEach(function (r) {
    maxClass = Math.max(maxClass, r.classes.converged, r.classes.divergent, r.classes.unknown);
  });
  ov.appendChild(el("h2", "", "Convergence class counts over time"));
  var strip = el("div", "trend");
  MODEL.series.forEach(function (r) {
    var col = el("div", "tcol");
    col.setAttribute("title", r.date + " \\u2014 converged " + r.classes.converged + ", divergent " + r.classes.divergent + ", hash-unknown " + r.classes.unknown);
    [["c", r.classes.converged], ["d", r.classes.divergent], ["u", r.classes.unknown]].forEach(function (pair) {
      var bar = el("i", pair[0]);
      bar.style.height = Math.max(2, Math.round((pair[1] / maxClass) * 48)) + "px";
      col.appendChild(bar);
    });
    strip.appendChild(col);
  });
  ov.appendChild(strip);
  var totals = { nodes: 0, edges: 0, skills: 0 };
  present.forEach(function (p) {
    var s = lastRow.projects[p];
    totals.nodes += s.nodes; totals.edges += s.edges; totals.skills += s.skills;
  });
  ov.appendChild(el("h2", "", "Latest totals (sum over covered projects)"));
  var tot = el("div", "stats");
  tot.appendChild(statCard(String(totals.nodes), "graph nodes"));
  tot.appendChild(statCard(String(totals.edges), "graph edges"));
  tot.appendChild(statCard(String(totals.skills), "skill nodes"));
  ov.appendChild(tot);
}

function renderTimeline() {
  var tl = sections.timeline;
  tl.textContent = "";
  tl.appendChild(el("h2", "", "Snapshot axis (hatched = no snapshot that day)"));
  var dates = MODEL.series.map(function (r) { return r.date; });
  if (dates.length > 0) {
    var first = dates[0];
    var last = dates[dates.length - 1];
    var strip = el("div", "strip");
    var segments = [];
    var cursor = first;
    MODEL.gaps.forEach(function (g) {
      if (g.from > cursor) segments.push({ kind: "tick", start: cursor, days: dayDiff(cursor, g.from), end: dayBefore(g.from) });
      segments.push({ kind: "gap", start: g.from, days: g.days, end: g.to });
      cursor = dayAfter(g.to);
    });
    if (cursor <= last) segments.push({ kind: "tick", start: cursor, days: dayDiff(cursor, dayAfter(last)), end: last });
    segments.forEach(function (s) {
      var seg = el("div", s.kind);
      seg.style.flexGrow = String(s.days);
      seg.setAttribute("title", s.kind === "tick"
        ? (s.days > 1 ? "snapshots " + s.start + " .. " + s.end : "snapshot " + s.start)
        : "gap " + s.start + " .. " + s.end + " (" + s.days + " days, no snapshot)");
      strip.appendChild(seg);
    });
    tl.appendChild(strip);
  }
  tl.appendChild(el("h2", "", "Per-date fleet diff (NEW / VANISHED skills)"));
  var table = el("table");
  var thead = el("thead");
  var hr = el("tr");
  ["date", "new skills", "vanished skills"].forEach(function (h) { hr.appendChild(el("th", "", h)); });
  thead.appendChild(hr);
  table.appendChild(thead);
  var tbody = el("tbody");
  for (var i = MODEL.series.length - 1; i >= 0; i--) {
    var r = MODEL.series[i];
    var tr = el("tr", "row");
    tr.setAttribute("data-search", (r.date + " " + r.newSkills.join(" ") + " " + r.vanishedSkills.join(" ")).toLowerCase());
    tr.appendChild(el("td", "mono", r.date));
    var tdNew = el("td");
    if (r.newSkills.length === 0) tdNew.appendChild(el("span", "muted", "\\u2014"));
    else r.newSkills.forEach(function (s) { tdNew.appendChild(chip(s)); });
    tr.appendChild(tdNew);
    var tdVan = el("td");
    if (r.vanishedSkills.length === 0) tdVan.appendChild(el("span", "muted", "\\u2014"));
    else r.vanishedSkills.forEach(function (s) { tdVan.appendChild(chip(s)); });
    tr.appendChild(tdVan);
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  tl.appendChild(table);
}

function renderDivergence() {
  var dv = sections.divergence;
  dv.textContent = "";
  var conv = MODEL.latest.convergence;
  dv.appendChild(el("h2", "", "Convergence with divergence (" + conv.convergenceWithDivergence.length + ") \\u2014 reconciliation candidates, not auto-promoted"));
  conv.convergenceWithDivergence.forEach(function (g) {
    var grp = el("div", "group row");
    var hay = g.capability;
    grp.appendChild(el("div", "cap", g.capability));
    Object.keys(g.hashes).forEach(function (h) {
      var line = el("div", "hashline");
      line.appendChild(chip(h.slice(0, 8), "hash"));
      g.hashes[h].forEach(function (p) {
        line.appendChild(chip(p, "proj"));
        hay += " " + h + " " + p;
      });
      grp.appendChild(line);
    });
    grp.setAttribute("data-search", hay.toLowerCase());
    dv.appendChild(grp);
  });
  dv.appendChild(el("h2", "", "Converged (" + conv.converged.length + ") \\u2014 single content hash"));
  var chips = el("div", "chips");
  conv.converged.forEach(function (c) {
    var cp = chip(c);
    cp.setAttribute("data-search", c.toLowerCase());
    chips.appendChild(cp);
  });
  dv.appendChild(chips);
  dv.appendChild(el("h2", "", "Hash-unknown (" + conv.hashUnknown.length + ") \\u2014 at least one carrier is a v1 graph"));
  var chipsU = el("div", "chips");
  conv.hashUnknown.forEach(function (c) {
    var cp = chip(c);
    cp.setAttribute("data-search", c.toLowerCase());
    chipsU.appendChild(cp);
  });
  dv.appendChild(chipsU);
}

function renderGaps() {
  var gp = sections.gaps;
  gp.textContent = "";
  gp.appendChild(el("h2", "", "Root skills missing from project graphs (latest snapshot)"));
  var entries = Object.keys(MODEL.latest.missingFromProjects).map(function (p) {
    return { project: p, missing: MODEL.latest.missingFromProjects[p] || [] };
  }).sort(function (a, b) { return b.missing.length - a.missing.length || (a.project < b.project ? -1 : 1); });
  entries.forEach(function (e) {
    var det = document.createElement("details");
    det.className = "group row";
    var sum = el("summary");
    sum.appendChild(el("span", "cap", e.project));
    sum.appendChild(el("span", "count", String(e.missing.length)));
    det.appendChild(sum);
    var list = el("div", "chips");
    e.missing.forEach(function (s) { list.appendChild(chip(s)); });
    det.appendChild(list);
    det.setAttribute("data-search", (e.project + " " + e.missing.join(" ")).toLowerCase());
    gp.appendChild(det);
  });
}

function renderTickets() {
  var tk = sections.tickets;
  tk.textContent = "";
  tk.appendChild(el("h2", "", "Governance tickets mentioning skill-graph (live + archive, newest first)"));
  if (MODEL.tickets.length === 0) {
    tk.appendChild(el("p", "muted", "No governance ticket title mentions skill-graph."));
    return;
  }
  var table = el("table");
  var thead = el("thead");
  var hr = el("tr");
  ["id", "title", "status", "priority", "source", "filed"].forEach(function (h) { hr.appendChild(el("th", "", h)); });
  thead.appendChild(hr);
  table.appendChild(thead);
  var tbody = el("tbody");
  MODEL.tickets.forEach(function (t) {
    var tr = el("tr", "row");
    tr.setAttribute("data-search", (t.id + " " + t.title + " " + t.status + " " + t.priority + " " + t.source).toLowerCase());
    tr.appendChild(el("td", "mono", t.id));
    tr.appendChild(el("td", "", truncate(t.title, 140)));
    tr.appendChild(el("td", "", t.status));
    tr.appendChild(el("td", "", t.priority));
    tr.appendChild(el("td", "", t.source));
    var tdF = el("td");
    if (t.runnerFiled) tdF.appendChild(el("span", "badge", "runner-filed"));
    tr.appendChild(tdF);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  tk.appendChild(table);
}

renderOverview();
renderTimeline();
renderDivergence();
renderGaps();
renderTickets();
activate("overview");
})();
</script>
</body>
</html>`;
}

export async function main(): Promise<void> {
  const { json, snapshotDir, help, htmlPath, noHtml } = parseArgs();
  if (help) {
    console.log(`skill-graph-fleet-report.ts v${VERSION} — read-only fleet analytics over per-project skill graphs (skill-graph-analytics skill Step 1).

Usage:
  bun scripts/skill-graph-fleet-report.ts [--json] [--snapshot-dir <dir>] [--html <path>] [--no-html]

Reads docs/skill-graph.json + Projects/<co-x>/docs/skill-graph.json; writes only
memory/skill-graph-metrics/snapshot-<YYYY-MM-DD>.json (one per date, overwrite
same-date) plus the auto-emitted history dashboard docs/skill-graph-history.html
(override --html <path>, disable --no-html; emission failure is WARN-only).
Read-only over all inputs.`);
    process.exit(0);
  }

  const fleet = defaultProjects();
  const fleetInfo = {
    count: fleet.projects.length + fleet.skipped.length,
    members: [...fleet.projects, ...fleet.skipped.map((s) => s.name)].map((p) => p.split(/[\\/]/).pop() ?? p).sort(),
    transientAbsent: fleet.skipped.map((s) => s.name.split(/[\\/]/).pop() ?? s.name),
  };

  const today = localDateISO();
  const graphPaths: Array<{ name: string; path: string }> = [{ name: "root", path: join("docs", "skill-graph.json") }];
  for (const project of fleet.projects) {
    graphPaths.push({ name: project.split(/[\\/]/).pop() ?? project, path: join(project, "docs", "skill-graph.json") });
  }

  const rootGraph = loadGraph(join("docs", "skill-graph.json"));
  const stats: ProjectStats[] = [];
  const skipped: string[] = [];
  const projectSkillSets = new Map<string, Set<string>>();
  const projectNodeSets = new Map<string, Set<string>>();
  const projectCaps = new Map<string, Map<string, Set<string | null>>>();
  // v2.2.0: fan-in substrate — per-project skill:/agent: capability keys (same load pass, no re-walk)
  const projectFanInKeys = new Map<string, Set<string>>();
  const v1Projects: string[] = [];

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
    projectCaps.set(g.name, skillCapabilities(graph));
    projectFanInKeys.set(g.name, fanInCapabilityKeys(graph));
    if (graph.upgradedFrom === 1) v1Projects.push(g.name);
    stats.push({
      project: g.name,
      nodes: graph.nodes?.length ?? 0,
      edges: graph.edges?.length ?? 0,
      skills: skillNodeCount(graph),
    });
  }

  const loadedCount = stats.length + (rootGraph ? 1 : 0);
  if (loadedCount === 0) {
    console.error(
      "❌ skill-graph-fleet-report: zero skill graphs found (docs/skill-graph.json and Projects/co-*/docs/skill-graph.json all missing).",
    );
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
    convergence: classifyConvergence(projectCaps),
    // v2.2.0 (additive): fan-in classification — the hub-selection evidence
    fanIn2: classifyFanIn2(projectFanInKeys),
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

  // v2.5.0 — history dashboard emission (design
  // docs/designs/2026-11-23-skill-graph-history-report-design.md §5.1): runs in
  // BOTH modes (the daily --json runner is the primary emitter); any failure is
  // exactly one stderr WARN — the snapshot is the primary artifact, the page a
  // courtesy render — and the run continues to its normal exit. The full page
  // string is built before the single write, so no partial HTML is ever left
  // behind (a stale page is honest; a missing one is not an error signal).
  if (!noHtml) {
    const outPath = htmlPath ?? join("docs", "skill-graph-history.html");
    const warnEmission = (reason: string, err: unknown): void => {
      console.warn(
        `⚠️ history page generation failed (${reason}): ${err instanceof Error ? err.message : String(err)} — snapshot is unaffected`,
      );
    };
    let page: string | null = null;
    try {
      page = renderHistoryPage(
        buildHistoryModel(
          loadSnapshots(snapshotDir),
          fleetInfo,
          scanSkillGraphTickets(join("tickets", "governance"), join("tickets", "governance", "archive")),
        ),
      );
    } catch (err) {
      warnEmission("model-build", err);
    }
    if (page !== null) {
      try {
        mkdirSync(dirname(outPath), { recursive: true });
        writeFileSync(outPath, page);
        const htmlLine = `🗂 history page → ${outPath} (${Buffer.byteLength(page, "utf8")} bytes)`;
        if (json) console.error(htmlLine);
        else console.log(htmlLine);
      } catch (err) {
        warnEmission("page-write", err);
      }
    }
  }

  if (json) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    // v2.2.0: hub-candidate asset evidence — null marks a hub project with no graph loaded
    const hubEvidence: Record<string, string[] | null> = {};
    for (const hub of HUB_CANDIDATES) {
      hubEvidence[hub] =
        snapshot.fanIn2 && projectFanInKeys.has(hub) ? hubQualifyingAssets(hub, snapshot.fanIn2) : null;
    }
    console.log(
      markdownReport(
        rootGraph ?? { version: 2, nodes: [], edges: [] },
        stats,
        skipped,
        presence,
        missingFromProjects,
        jaccard,
        diff,
        previous ? { file: previous.file, date: previous.date } : null,
        orphans,
        snapshot.convergence ?? null,
        v1Projects,
        snapshot.fanIn2 ?? null,
        hubEvidence,
      ),
    );
  }
  process.exit(0);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("❌ Fatal skill-graph-fleet-report error:", err);
    process.exit(1);
  });
}
