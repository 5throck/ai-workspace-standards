#!/usr/bin/env bun
/**
 * skill-graph-fleet-report.ts — Read-only fleet analytics over per-project skill graphs
 * (skill-graph-analytics skill Step 1).
 * @version 2.6.2 (2026-11-24, backfill invalidation-key fix — loop fix): the
 *          root-backfill staleness key is now `graphHeadSha` (the last commit
 *          that touched the replayed graph path, read via
 *          `git log -1 --format=%H -- <pathspec>`) instead of the repo HEAD.
 *          HEAD was a fixed-point violation: committing the artifact advanced
 *          HEAD, invalidated the file on the next run, and dirtied the tree
 *          again (#2162 → #2164 → #2165). A merge of the artifact does not touch
 *          docs/skill-graph.json, so the second run after a merge skips the
 *          rebuild and leaves a clean tree. A legacy file carrying only
 *          `headSha` reads as stale exactly once, then stabilizes. Page
 *          provenance now says "as of the last commit that changed the skill
 *          graph". Supersedes closed PR #2165.
 * @version 2.6.1 (2026-11-23, Windows CI fix): the root-backfill git operands
 *          (`git log -- <pathspec>` and `git show <sha>:<path>`) are POSIX-shaped
 *          through toGitPath(); a `path.join`-built native path made git reject
 *          the pathspec on Windows ("path 'docs\skill-graph.json' exists on
 *          disk, but not in <sha>"). The recorded backfill `path` field is
 *          normalized to the same git form so the artifact stays byte-identical
 *          across platforms for one HEAD. No behavior change on POSIX hosts.
 * @version 2.6.0 (2026-11-23, spec
 *          docs/designs/2026-11-23-skill-graph-observability-design.md §5+§13):
 *          skill-graph observability extension — (D-A1) additive optional
 *          per-project `agentGraph` snapshot block (agent id+hash table plus
 *          deduped agent-touching edge tuples in index form over a per-project
 *          edge-type enum; legacy snapshots without the block are tolerated —
 *          the page renders explicit "agent tracking begins <date>" notes; every
 *          pre-existing snapshot field stays byte-value-identical); (D-A2)
 *          per-date agent-node and per-edge-type NEW/VANISHED diff classes
 *          computed at render by replaying consecutive snapshots (20-sample
 *          caps, relative links to the snapshot files) plus a sixth **Agents**
 *          tab (agents per project, relationship counts by edge type, newest
 *          relationship changes, and the >=3-project convergence rollup
 *          mirroring the analytics capability rules — report-only, the fleet
 *          report never files tickets) and a small link card to the structure
 *          page; (D-C) the same run emits docs/skill-graph-structure.html
 *          (rides the existing --html/--no-html family, its own independent
 *          WARN island, no new CLI flags): layer composition + hubs as no-JS
 *          inline SVG, a full-root ego explorer with labeled edge types, and
 *          per-variant root/template/project juxtaposition with per-hop layer
 *          vocabulary; (§13 addendum) a deterministic bounded root git-history
 *          backfill step emitting memory/skill-graph-metrics/root-backfill.json
 *          (third WARN island; skips when the recorded headSha matches
 *          `git rev-parse HEAD`; 1,000-commit replay cap aborts with a WARN;
 *          consumed by both pages — commit-granularity root agent/edge timeline
 *          with a visible "backfilled from git history" provenance marker).
 *          Byte-compat: pre-existing snapshot fields and the --json stdout
 *          shape are unchanged apart from the additive agentGraph block; both
 *          pages remain deterministic (no wall-clock markers).
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
 * snapshot write (both modes; see the @version 2.5.0 entry). v2.6.0 emits the
 * graph-structure companion page docs/skill-graph-structure.html in the same
 * runs (independent WARN island) and maintains the root git-history backfill
 * memory/skill-graph-metrics/root-backfill.json (skipped when fresh at the
 * last commit that changed the graph path — v2.6.2; not at HEAD).
 *
 * This tool is read-only over its inputs; it writes only the snapshot file,
 * the two generated pages, and the root-backfill file (emission failures are
 * WARN-only and never affect the snapshot or the exit code).
 * It never modifies any graph, skill, or project.
 *
 * Usage:
 *   bun scripts/skill-graph-fleet-report.ts [--json] [--snapshot-dir <dir>]
 *       [--html <path>] [--no-html] [--help]
 *
 * Options:
 *   --json              print the snapshot JSON instead of the human report
 *   --snapshot-dir <d>  snapshot output directory (default:
 *                       memory/skill-graph-metrics; root-backfill.json lives
 *                       here too)
 *   --html <path>       history-page output path override (default:
 *                       docs/skill-graph-history.html; parents auto-created)
 *   --no-html           skip the page emissions and the backfill step
 *                       (snapshot still written)
 *
 * Exit codes: 0 (report produced), 1 (zero graphs found / usage error).
 *
 * @module skill-graph-fleet-report
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { checkoutBranch, filterTransientCheckouts } from "./lib/git-aware-scan.ts";
import { gitCleanEnv } from "./lib/git-env.ts";
import { listFleetProjects } from "./lib/fleet.ts";
import { localDateISO } from "./lib/local-date.ts";
import { PLATFORM_MIRROR_DIRS } from "./lib/platforms.ts";
import { capabilityOf, loadSkillGraph, nameOf, upgradeSkillGraph } from "./lib/skill-graph-compat.ts";
import type { SkillGraphNodeV2, SkillGraphV2 } from "./lib/skill-graph-compat.ts";

const VERSION = "2.6.2";

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

/**
 * v2.6.0 (D-A1, additive optional per-project snapshot block, design
 * docs/designs/2026-11-23-skill-graph-observability-design.md §5.1): compact
 * projection of one graph's agent surface. `n` rows are `[id, content_hash|null]`
 * — agent nodes first (ids carry the `agent:` kind prefix), then the deduped
 * non-agent endpoints referenced by the stored edges (hash slot null for them,
 * so agents are exactly the rows whose id starts with `agent:`). `t` is the
 * edge-type enum; `e` tuples are `[agentIdx, otherIdx, typeIdx]` over agent-
 * touching edges (at least one agent endpoint, either direction), deduped.
 * Measured ~52 KB across the 17-member fleet — ~+35% on the current snapshot
 * (design §5.1). Absent from every legacy snapshot: every consumer that does
 * not know the block ignores it.
 */
export interface AgentGraphProjection {
  n: Array<[string, string | null]>;
  t: string[];
  e: Array<[number, number, number]>;
}

/** Per-project snapshot entry: the three legacy scalars (byte-value-identical
 *  since v1) plus the optional v2.6.0 agentGraph projection (D-A1). */
interface ProjectEntry {
  nodes: number;
  edges: number;
  skills: number;
  /** v2.6.0 (additive, optional): agent id+hash table + agent-touching edge tuples. */
  agentGraph?: AgentGraphProjection;
}

interface ProjectStats {
  project: string;
  nodes: number;
  edges: number;
  skills: number;
}

interface Snapshot {
  date: string;
  projects: Record<string, ProjectEntry>;
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

// ── v2.6.0 — agent-graph observability (design docs/designs/2026-11-23-skill-graph-observability-design.md §5.1-§5.3) ──

/**
 * v2.6.0 snapshot serializer: the file keeps the v2.5.0 indent-2 formatting for
 * every pre-existing field (byte-value-identical output for them), while each
 * new agentGraph block is spliced in COMPACTLY — matching the design §5.1
 * sketch (inline tuple arrays) and keeping the added bytes near the measured
 * ~52 KB projection instead of the ~2x indent-2 inflation. Deterministic:
 * placeholders are derived from project names (fleet basenames, `co-*`), the
 * spliced content is the block's own compact JSON.
 */
export function serializeSnapshot(snapshot: Snapshot): string {
  const blocks = new Map<string, string>();
  const placeholdered = {
    ...snapshot,
    projects: Object.fromEntries(
      Object.entries(snapshot.projects ?? {}).map(([project, entry]) => {
        if (!entry?.agentGraph) return [project, entry];
        blocks.set(project, JSON.stringify(entry.agentGraph));
        const { agentGraph, ...scalars } = entry;
        void agentGraph;
        return [project, { ...scalars, agentGraph: `@@agentGraph:${project}@@` }];
      }),
    ),
  };
  let text = JSON.stringify(placeholdered, null, 2);
  for (const [project, block] of blocks) {
    // The `"agentGraph":` key already precedes the quoted placeholder value in
    // the indent-2 text — splice in ONLY the compact block object.
    text = text.replace(`"@@agentGraph:${project}@@"`, block);
  }
  return text + "\n";
}

/** Sample cap for per-edge-type NEW/VANISHED tuple listings (AC1: <= 20 samples + "+N more"). */
export const AGENT_SAMPLE_CAP = 20;

/** Cap per learning-candidate class in the rollup callout (byte-budget guard;
 *  totals carry the uncapped counts). */
export const ROLLUP_CAP = 40;

/** v2.6.0 — extract the AgentGraphProjection of one graph (pure; the snapshot
 *  writer and the git-history backfill share this one encoder). Agents first
 *  in `n`, then deduped non-agent counterpart rows; `e` tuples dedupe on
 *  (from, to, type) with the agent endpoint always at index 0. */
export function extractAgentGraph(graph: SkillGraph): AgentGraphProjection {
  const n: Array<[string, string | null]> = [];
  const agentIdx = new Map<string, number>();
  for (const node of graph.nodes ?? []) {
    if (node.type !== "agent") continue;
    agentIdx.set(node.id, n.length);
    n.push([node.id, typeof node.content_hash === "string" && node.content_hash ? node.content_hash : null]);
  }
  const extraIdx = new Map<string, number>();
  const t: string[] = [];
  const typeIdx = new Map<string, number>();
  const e: Array<[number, number, number]> = [];
  const seen = new Set<string>();
  const indexOfOther = (id: string): number => {
    const asAgent = agentIdx.get(id);
    if (asAgent !== undefined) return asAgent;
    let idx = extraIdx.get(id);
    if (idx === undefined) {
      idx = n.length;
      extraIdx.set(id, idx);
      n.push([id, null]);
    }
    return idx;
  };
  for (const edge of graph.edges ?? []) {
    const fromAgent = typeof edge.from === "string" && agentIdx.has(edge.from);
    const toAgent = typeof edge.to === "string" && agentIdx.has(edge.to);
    if (!fromAgent && !toAgent) continue;
    const key = `${edge.from}|${edge.to}|${edge.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    let ti = typeIdx.get(edge.type);
    if (ti === undefined) {
      ti = t.length;
      typeIdx.set(edge.type, ti);
      t.push(edge.type);
    }
    const agentEnd = fromAgent ? (edge.from as string) : (edge.to as string);
    const otherEnd = fromAgent ? (edge.to as string) : (edge.from as string);
    e.push([agentIdx.get(agentEnd)!, indexOfOther(otherEnd), ti]);
  }
  return { n, t, e };
}

/** Bare (scope-normalized) name of a graph node id: the last `/` segment —
 *  `agent:root/architect` -> `architect`, `skill:common/k-dart` -> `k-dart`.
 *  Project graphs mint ids that keep the ORIGINAL scope (`agent:root/...`), so
 *  bare-name normalization is what lets fleet copies meet (design §5.3). */
export function agentBareName(id: string): string {
  const slash = id.lastIndexOf("/");
  return slash >= 0 ? id.slice(slash + 1) : id;
}

/** Kind prefix of a node id: `agent:root/x` -> `agent`, `skill:root/y` -> `skill`. */
export function agentKindOf(id: string): string {
  const colon = id.indexOf(":");
  return colon >= 0 ? id.slice(0, colon) : "";
}

/** One per-edge-type NEW/VANISHED summary (AC1): tuple count plus up to
 *  AGENT_SAMPLE_CAP representative `[agentId, otherId, project]` tuples. */
export interface AgentEdgeTypeSummary {
  type: string;
  count: number;
  sample: Array<[string, string, string]>;
}

/** v2.6.0 per-date diff classes (D-A2): agent-node NEW/VANISHED ids and
 *  per-edge-type NEW/VANISHED summaries, aggregated fleet-side across projects. */
export interface AgentDiffClasses {
  agentNodes: { added: string[]; removed: string[] };
  agentEdges: { added: AgentEdgeTypeSummary[]; removed: AgentEdgeTypeSummary[] };
}

function projectionAgentIds(blocks: Record<string, AgentGraphProjection | undefined>): Set<string> {
  const out = new Set<string>();
  for (const block of Object.values(blocks)) {
    for (const [id] of block?.n ?? []) if (id.startsWith("agent:")) out.add(id);
  }
  return out;
}

/** Deduped agent-touching tuples of a per-project projection map, keyed
 *  `agent|other|type` -> `{ agent, other, type, project }`. */
interface ProjectionTuple {
  agent: string;
  other: string;
  type: string;
  project: string;
}

function projectionTuples(blocks: Record<string, AgentGraphProjection | undefined>): Map<string, ProjectionTuple> {
  const out = new Map<string, ProjectionTuple>();
  for (const [project, block] of Object.entries(blocks)) {
    for (const [ai, oi, ti] of block?.e ?? []) {
      const agent = block?.n[ai]?.[0];
      const other = block?.n[oi]?.[0];
      const type = block?.t[ti];
      if (agent === undefined || other === undefined || type === undefined) continue;
      out.set(`${agent}|${other}|${type}`, { agent, other, type, project });
    }
  }
  return out;
}

function summarizeAgentEdges(keys: string[], source: Map<string, ProjectionTuple>): AgentEdgeTypeSummary[] {
  const byType = new Map<string, Array<ProjectionTuple>>();
  for (const key of keys) {
    const row = source.get(key);
    if (!row) continue;
    const list = byType.get(row.type);
    if (list) list.push(row);
    else byType.set(row.type, [row]);
  }
  return [...byType.entries()]
    .map(([type, rows]) => ({
      type,
      count: rows.length,
      sample: rows
        .sort(
          (a, b) =>
            a.agent.localeCompare(b.agent) || a.other.localeCompare(b.other) || a.project.localeCompare(b.project),
        )
        .slice(0, AGENT_SAMPLE_CAP)
        .map((r) => [r.agent, r.other, r.project] as [string, string, string]),
    }))
    .sort((a, b) => a.type.localeCompare(b.type));
}

/**
 * v2.6.0 (D-A2) — per-date agent diff classes between two per-project
 * projection maps, replayed at render time (raw projections are stored, never
 * precomputed diffs). A missing block on the PREVIOUS side (legacy snapshot or
 * rollout day) diffs against the empty set — the honest full baseline (AC1:
 * from the first snapshot carrying agentGraph onward every date row carries
 * the classes); both sides missing yields empty classes. Pure and testable.
 */
export function diffAgentGraphs(
  prevProjects: Record<string, AgentGraphProjection | undefined>,
  curProjects: Record<string, AgentGraphProjection | undefined>,
): AgentDiffClasses {
  const prevIds = projectionAgentIds(prevProjects);
  const curIds = projectionAgentIds(curProjects);
  const prevTuples = projectionTuples(prevProjects);
  const curTuples = projectionTuples(curProjects);
  const addedKeys = [...curTuples.keys()].filter((k) => !prevTuples.has(k));
  const removedKeys = [...prevTuples.keys()].filter((k) => !curTuples.has(k));
  return {
    agentNodes: {
      added: [...curIds].filter((id) => !prevIds.has(id)).sort(),
      removed: [...prevIds].filter((id) => !curIds.has(id)).sort(),
    },
    agentEdges: {
      added: summarizeAgentEdges(addedKeys, curTuples),
      removed: summarizeAgentEdges(removedKeys, prevTuples),
    },
  };
}

/** v2.6.0 (D-A3) — fleet-level agent/relationship convergence rollup. Mirrors
 *  the analytics capability rules (skills/skill-graph-analytics/SKILL.md:90-106)
 *  one level up: promotion = same bare agent name on a single content hash in
 *  >= threshold project graphs and absent from the root graph; >= 2 hashes =
 *  reconciliation candidate (never auto-promoted); hash-unknown carries the
 *  analytics third class. Relationship candidates: normalized
 *  (agent, kind, endpoint, edgeType) tuples in >= threshold projects with no
 *  root-graph counterpart. Splits: same normalized agent-endpoint pair carried
 *  under >= 2 edge types across >= 2 projects. Report-only — the fleet report
 *  never files tickets. */
export interface AgentRollup {
  threshold: number;
  promotions: Array<{ name: string; hash: string; projects: string[] }>;
  reconciliations: Array<{ name: string; hashes: Record<string, string[]> }>;
  hashUnknown: string[];
  relationships: Array<{ agent: string; kind: string; endpoint: string; edgeType: string; projects: string[] }>;
  splits: Array<{ agent: string; kind: string; endpoint: string; types: Record<string, string[]> }>;
  /** Uncapped per-class totals (the listed arrays are capped at ROLLUP_CAP). */
  totals: { promotions: number; reconciliations: number; hashUnknown: number; relationships: number; splits: number };
}

/** Root-graph presence keyed the way the rollup joins: bare agent names and
 *  normalized agent-touching relationship tuples. */
function rootAgentIndex(rootGraph: SkillGraph): { names: Set<string>; tuples: Set<string> } {
  const names = new Set<string>();
  const agentIds = new Set<string>();
  for (const node of rootGraph.nodes ?? []) {
    if (node.type !== "agent") continue;
    agentIds.add(node.id);
    names.add(agentBareName(node.id));
  }
  const tuples = new Set<string>();
  for (const edge of rootGraph.edges ?? []) {
    const fromAgent = agentIds.has(edge.from);
    const toAgent = agentIds.has(edge.to);
    if (!fromAgent && !toAgent) continue;
    const agentId = fromAgent ? edge.from : edge.to;
    const otherId = fromAgent ? edge.to : edge.from;
    tuples.add(
      `${agentBareName(agentId)}\u0000${agentKindOf(otherId)}\u0000${agentBareName(otherId)}\u0000${edge.type}`,
    );
  }
  return { names, tuples };
}

export function buildAgentRollup(
  projectBlocks: Record<string, AgentGraphProjection | undefined>,
  rootGraph: SkillGraph | null,
  threshold: number = CONVERGENCE_THRESHOLD,
): AgentRollup {
  const root = rootGraph ? rootAgentIndex(rootGraph) : { names: new Set<string>(), tuples: new Set<string>() };

  // Agent capability convergence (bare name -> per-project hash sets)
  const carriers = new Map<string, string[]>();
  const hashesByProject = new Map<string, Map<string, Set<string | null>>>();
  for (const [project, block] of Object.entries(projectBlocks)) {
    for (const [id, hash] of block?.n ?? []) {
      if (!id.startsWith("agent:")) continue;
      const name = agentBareName(id);
      if (!carriers.has(name)) carriers.set(name, []);
      carriers.get(name)!.push(project);
      if (!hashesByProject.has(name)) hashesByProject.set(name, new Map());
      const perProject = hashesByProject.get(name)!;
      if (!perProject.has(project)) perProject.set(project, new Set());
      perProject.get(project)!.add(hash ?? null);
    }
  }

  const promotions: AgentRollup["promotions"] = [];
  const reconciliations: AgentRollup["reconciliations"] = [];
  const hashUnknown: string[] = [];
  for (const [name, list] of [...carriers.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const distinct = new Set(list.sort());
    if (distinct.size < threshold) continue;
    const hashGroups = new Map<string, string[]>();
    let unknown = false;
    for (const project of distinct) {
      for (const h of hashesByProject.get(name)!.get(project) ?? []) {
        if (h === null) {
          unknown = true;
          continue;
        }
        if (!hashGroups.has(h)) hashGroups.set(h, []);
        hashGroups.get(h)!.push(project);
      }
    }
    if (hashGroups.size >= 2) {
      reconciliations.push({
        name,
        hashes: Object.fromEntries([...hashGroups.entries()].map(([h, ps]) => [h, [...new Set(ps)].sort()])),
      });
    } else if (unknown) {
      hashUnknown.push(name);
    } else if (!root.names.has(name)) {
      const hash = [...hashGroups.keys()][0] ?? "";
      promotions.push({ name, hash, projects: [...distinct] });
    }
  }

  // Relationship convergence + edge-type splits
  const relCarriers = new Map<string, string[]>();
  const relSample = new Map<string, { agent: string; kind: string; endpoint: string; edgeType: string }>();
  const pairTypes = new Map<string, Map<string, Set<string>>>();
  const pairSample = new Map<string, { agent: string; kind: string; endpoint: string }>();
  for (const [project, block] of Object.entries(projectBlocks)) {
    for (const [ai, oi, ti] of block?.e ?? []) {
      const agentId = block?.n[ai]?.[0];
      const otherId = block?.n[oi]?.[0];
      const edgeType = block?.t[ti];
      if (!agentId?.startsWith("agent:") || otherId === undefined || edgeType === undefined) continue;
      const agent = agentBareName(agentId);
      const kind = agentKindOf(otherId);
      const endpoint = agentBareName(otherId);
      const relKey = `${agent}\u0000${kind}\u0000${endpoint}\u0000${edgeType}`;
      if (!relCarriers.has(relKey)) relCarriers.set(relKey, []);
      relCarriers.get(relKey)!.push(project);
      relSample.set(relKey, { agent, kind, endpoint, edgeType });
      const pairKey = `${agent}\u0000${kind}\u0000${endpoint}`;
      if (!pairTypes.has(pairKey)) pairTypes.set(pairKey, new Map());
      const types = pairTypes.get(pairKey)!;
      if (!types.has(edgeType)) types.set(edgeType, new Set());
      types.get(edgeType)!.add(project);
      pairSample.set(pairKey, { agent, kind, endpoint });
    }
  }
  const relationships: AgentRollup["relationships"] = [];
  for (const [key, list] of [...relCarriers.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const distinct = [...new Set(list)].sort();
    if (distinct.length < threshold) continue;
    if (root.tuples.has(key)) continue; // root counterpart exists -> not a learning candidate
    const s = relSample.get(key)!;
    relationships.push({
      agent: s.agent,
      kind: s.kind,
      endpoint: s.endpoint,
      edgeType: s.edgeType,
      projects: distinct,
    });
  }
  const splits: AgentRollup["splits"] = [];
  for (const [key, types] of [...pairTypes.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (types.size < 2) continue;
    const projectCount = new Set([...types.values()].flatMap((s) => [...s])).size;
    if (projectCount < 2) continue; // "carried under different edge types ACROSS projects"
    const s = pairSample.get(key)!;
    splits.push({
      agent: s.agent,
      kind: s.kind,
      endpoint: s.endpoint,
      types: Object.fromEntries([...types.entries()].map(([t, ps]) => [t, [...ps].sort()])),
    });
  }

  const cap = <T>(rows: T[]): T[] => rows.slice(0, ROLLUP_CAP);
  return {
    threshold,
    promotions: cap(promotions),
    reconciliations: cap(reconciliations),
    hashUnknown: cap(hashUnknown.sort()),
    relationships: cap(relationships),
    splits: cap(splits),
    totals: {
      promotions: promotions.length,
      reconciliations: reconciliations.length,
      hashUnknown: hashUnknown.length,
      relationships: relationships.length,
      splits: splits.length,
    },
  };
}

// ── v2.6.0 — root git-history backfill (design §13 addendum) ──

/** Hard maximum of commits replayed per backfill run (~7 s expected ceiling at
 *  the measured ~7 ms/commit); exceeding it aborts the island with a WARN —
 *  raise the constant deliberately, never silently (§13.3). */
export const BACKFILL_MAX_COMMITS = 1000;

/** One backfilled root-graph state (per commit date, newest commit of the date
 *  wins — §13.2 "collapse to one row per commit date"). The projection uses the
 *  same AgentGraphProjection encoding as the snapshot blocks (one encoder,
 *  one escape path); `schema` records the blob's top-level `version` (v1 blobs
 *  lack the field -> 1). */
export interface RootBackfillRow {
  date: string;
  commitCount: number;
  schema: number;
  agents: AgentGraphProjection;
}

/** Durable root git-history backfill series (memory/skill-graph-metrics/
 *  root-backfill.json): deterministic, no wall-clock content — `graphHeadSha` is
 *  content, so a rerun at the same graph commit is byte-identical (AC-A2). The
 *  filename never matches the snapshot-YYYY-MM-DD.json freshness-gate pattern
 *  (AC-A4).
 *
 *  v2.6.2 (loop fix): the invalidation key is `graphHeadSha` — the last commit
 *  that touched the replayed graph path — NOT the repo HEAD. Keying on HEAD was
 *  a fixed-point violation: committing this very artifact advances HEAD, which
 *  invalidated the file on the next run, which dirtied the tree again (the
 *  #2162 → #2164 → #2165 loop). A legacy file carrying only `headSha` reads as
 *  stale exactly once, then stabilizes. */
export interface RootBackfillFile {
  provenance: "git-backfill";
  graphHeadSha: string;
  path: string;
  rows: RootBackfillRow[];
}

/**
 * Convert a repo-relative path into the form git expects for `-- <pathspec>` and
 * `<rev>:<path>` operands.
 *
 * Why this exists: git pathspecs — both the `<rev>:<path>` form of `git show`
 * and the pathspec after `--` in `git log` — are **always POSIX-shaped**, even
 * on Windows. `path.join("docs", "skill-graph.json")` yields `docs\skill-graph.json`
 * on Windows, which git cannot resolve: it fails with "path
 * 'docs\skill-graph.json' exists on disk, but not in <sha>" (observed in the
 * Windows CI leg). Filesystem paths stay native (`join` is correct there); only
 * operands handed to git go through this helper. Idempotent, so callers may pass
 * either a native or an already-normalized path.
 */
export function toGitPath(p: string): string {
  return p.split(/[\\/]+/).join("/");
}

/** Repo HEAD sha via `git -C <dir> rev-parse HEAD`; null when not a repo / git
 *  unavailable / unborn HEAD (the island turns null into one WARN). */
export function readHeadSha(repoDir: string): string | null {
  const res = spawnSync("git", ["-C", repoDir, "rev-parse", "HEAD"], {
    encoding: "buffer",
    env: gitCleanEnv() as NodeJS.ProcessEnv,
  });
  if (res.status !== 0 || !res.stdout) return null;
  const sha = res.stdout.toString("utf8").trim();
  return /^[0-9a-f]{40}$/i.test(sha) ? sha : null;
}

/** The last commit that touched the replayed graph path (not the repo HEAD):
 *  `git -C <dir> log -1 --format=%H -- <gitRelPath>`. Null when git is
 *  unavailable, the path has no history, or the output is not a sha. The
 *  pathspec is POSIX-shaped via toGitPath (Windows-safe). */
export function readGraphHeadSha(repoDir: string, gitRelPath: string): string | null {
  const res = spawnSync("git", ["-C", repoDir, "log", "-1", "--format=%H", "--", toGitPath(gitRelPath)], {
    encoding: "buffer",
    env: gitCleanEnv() as NodeJS.ProcessEnv,
  });
  if (res.status !== 0 || !res.stdout) return null;
  const sha = res.stdout.toString("utf8").trim();
  return /^[0-9a-f]{40}$/i.test(sha) ? sha : null;
}

/** Staleness check (§13.2 rebuild policy, v2.6.2): the recorded `graphHeadSha`
 *  must equal the current graph commit — equal and parseable -> skip. Pure.
 *  A legacy file with only `headSha` has no `graphHeadSha`, so it reads as
 *  stale exactly once (one rebuild rewrites it in the new shape). */
export function backfillIsFresh(
  file: { graphHeadSha?: string } | null | undefined,
  graphHeadSha: string | null,
): boolean {
  if (!graphHeadSha) return false;
  return typeof file?.graphHeadSha === "string" && file.graphHeadSha === graphHeadSha;
}

/**
 * Replay `git log --format=%H%x00%cd --date=short -- <relPath>` and extract one
 * RootBackfillRow per commit DATE (full-blob `git show <sha>:<path>` parse —
 * diff-parsing is rename/format-change-proof this way, §13.2; the newest commit
 * of a date wins, commitCount accumulates). Aborts (throws) when the corpus
 * exceeds `maxCommits` (default BACKFILL_MAX_COMMITS) — the caller's WARN
 * island turns that into one stderr note. Blob parse failures throw (a
 * half-replay must never be persisted). `relPath` is accepted in either native
 * or POSIX form and is converted with toGitPath before reaching git argv.
 */
export async function replayGraphHistory(
  repoDir: string,
  relPath: string,
  opts: { maxCommits?: number } = {},
): Promise<RootBackfillRow[]> {
  const maxCommits = opts.maxCommits ?? BACKFILL_MAX_COMMITS;
  // git operands below are POSIX-shaped on every OS — see toGitPath.
  const gitRelPath = toGitPath(relPath);
  const log = spawnSync("git", ["-C", repoDir, "log", "--format=%H%x00%cd", "--date=short", "--", gitRelPath], {
    encoding: "buffer",
    env: gitCleanEnv() as NodeJS.ProcessEnv,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (log.status !== 0 || !log.stdout) {
    throw new Error(`git log failed for ${gitRelPath}: ${(log.stderr?.toString("utf8") ?? "").trim()}`);
  }
  const commits = log.stdout
    .toString("utf8")
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => {
      const nul = line.indexOf("\0");
      return nul > 0 ? { sha: line.slice(0, nul), date: line.slice(nul + 1) } : null;
    })
    .filter((c): c is { sha: string; date: string } => c !== null);
  if (commits.length > maxCommits) {
    throw new Error(
      `root-backfill replay cap exceeded: ${commits.length} commits > ${maxCommits} — raise BACKFILL_MAX_COMMITS deliberately if the corpus truly grew`,
    );
  }
  const byDate = new Map<string, RootBackfillRow>();
  for (const commit of commits) {
    const show = spawnSync("git", ["-C", repoDir, "show", `${commit.sha}:${gitRelPath}`], {
      encoding: "buffer",
      env: gitCleanEnv() as NodeJS.ProcessEnv,
      maxBuffer: 64 * 1024 * 1024,
    });
    if (show.status !== 0 || !show.stdout) {
      throw new Error(`git show ${commit.sha}:${gitRelPath} failed: ${(show.stderr?.toString("utf8") ?? "").trim()}`);
    }
    let blob: {
      version?: number;
      graph_profile?: string;
      nodes?: Array<Record<string, any>>;
      edges?: Array<Record<string, any>>;
    };
    try {
      blob = JSON.parse(show.stdout.toString("utf8"));
    } catch (err) {
      throw new Error(`blob ${commit.sha} is not parseable JSON: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (!Array.isArray(blob.nodes)) {
      throw new Error(`blob ${commit.sha} carries no nodes array (unexpected graph schema)`);
    }
    const graph = upgradeSkillGraph(blob);
    const row: RootBackfillRow = {
      date: commit.date,
      commitCount: (byDate.get(commit.date)?.commitCount ?? 0) + 1,
      schema: typeof blob.version === "number" ? blob.version : 1,
      agents: extractAgentGraph(graph),
    };
    byDate.set(commit.date, row); // newest commit of the date wins (log is newest-first)
  }
  return [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, row]) => row);
}

/**
 * One-shot semantics (§13.2): the step always rebuilds the FULL series from the
 * graph tip — idempotent and re-runnable by construction. Skips (returns the
 * existing file, rebuilt=false) when the recorded `graphHeadSha` matches the
 * last commit that touched the graph path; otherwise replays and atomically
 * rewrites `filePath`. Throws on non-repo context, cap abort, or any replay
 * failure — the caller's WARN island owns the failure story (previous file
 * stays, stale-honest).
 *
 * v2.6.2: invalidation keys on the GRAPH commit, never on HEAD. Committing the
 * artifact itself (or any unrelated commit) no longer invalidates the file, so
 * the emitted artifact reaches a fixed point: generate → commit → regenerate
 * leaves a clean tree.
 */
export async function ensureRootBackfill(
  repoDir: string,
  relPath: string,
  filePath: string,
  opts: { maxCommits?: number } = {},
): Promise<{ file: RootBackfillFile; rebuilt: boolean }> {
  const graphHeadSha = readGraphHeadSha(repoDir, relPath);
  if (!graphHeadSha) {
    throw new Error(`no commit touches ${toGitPath(relPath)} in this repository — root backfill needs graph history`);
  }
  if (existsSync(filePath)) {
    try {
      const existing = JSON.parse(readFileSync(filePath, "utf-8")) as RootBackfillFile;
      if (backfillIsFresh(existing, graphHeadSha)) return { file: existing, rebuilt: false };
    } catch {
      // malformed existing file -> full rebuild below (overwrite)
    }
  }
  const rows = await replayGraphHistory(repoDir, relPath, opts);
  // `path` records the git (POSIX) form, not the caller's native path: the file
  // is a deterministic artifact and must be byte-identical across platforms for
  // the same graph commit (toGitPath; replayGraphHistory applies the same form).
  const file: RootBackfillFile = { provenance: "git-backfill", graphHeadSha, path: toGitPath(relPath), rows };
  mkdirSync(dirname(filePath), { recursive: true });
  // Compact serialization: the file is a machine artifact whose rows carry full
  // per-date projections (~2 MB on the 340-commit corpus); pretty-printing it
  // would double the git delta on every HEAD advance for zero readability gain.
  writeFileSync(filePath, JSON.stringify(file) + "\n");
  return { file, rebuilt: true };
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
  /** v2.6.0 (D-A2): agent-node + per-edge-type NEW/VANISHED vs the prior
   *  snapshot; null when this snapshot carries no agentGraph block (legacy
   *  dates — the page renders the "agent tracking begins" note instead). */
  agents?: AgentDiffClasses | null;
  /** v2.6.0 (AC1): server-computed relative href to the raw snapshot file
   *  (null for a non-ISO date — the guard lives here, never in client JS). */
  snapshotHref?: string | null;
}

/** v2.6.0: one backfilled root row condensed for page consumption (AC-A1):
 *  commit-granularity date, per-date commit count, blob schema, agent/edge
 *  tuple counts, and the bare-name NEW/VANISHED agent lists vs the prior row
 *  (capped at AGENT_SAMPLE_CAP; computed at render, never stored). */
export interface BackfillPageRow {
  date: string;
  commitCount: number;
  schema: number;
  agents: number;
  edges: number;
  newAgents: string[];
  removedAgents: string[];
}

export interface BackfillSummary {
  /** v2.6.2: the last commit that touched the graph path (not HEAD). */
  graphHeadSha: string;
  rows: BackfillPageRow[];
}

/** v2.6.0: latest-snapshot agent surface for the Agents tab (sections 1-2):
 *  agents per project and agent<->skill relationship counts by edge type,
 *  fleet aggregate + per project. */
export interface AgentsLatest {
  perProject: Record<string, number>;
  relationshipByType: Record<string, number>;
  relationshipByProjectType: Record<string, Record<string, number>>;
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
  /** v2.6.0: first snapshot date carrying any agentGraph block (null when the
   *  whole corpus is legacy counts-only — no fabricated dates, AC1). */
  agentTrackingBegins: string | null;
  /** v2.6.0: latest agent surface (Agents tab sections 1-2); null when the
   *  latest snapshot carries no agentGraph block. */
  agentsLatest: AgentsLatest | null;
  /** v2.6.0 (D-A3): >=3-project convergence rollup (report-only learning
   *  candidates); null when the caller had no projection/root data. */
  rollup: AgentRollup | null;
  /** v2.6.0 (§13): backfilled root timeline (provenance-marked on the page);
   *  null when the backfill island failed or produced no rows. */
  backfill: BackfillSummary | null;
}

/** Condense a RootBackfillFile into page rows with computed bare-name
 *  NEW/VANISHED agent diffs (§13.2: cross-schema rows diff on bare-name
 *  normalization only). Pure. */
export function summarizeBackfill(file: RootBackfillFile | null | undefined): BackfillSummary | null {
  if (!file || !Array.isArray(file.rows) || file.rows.length === 0) return null;
  const rows: BackfillPageRow[] = [];
  let prevAgentNames: Set<string> | null = null;
  for (const row of file.rows) {
    const agentNames = new Set<string>();
    let agentCount = 0;
    for (const [id] of row.agents?.n ?? []) {
      if (!id.startsWith("agent:")) continue;
      agentCount++;
      agentNames.add(agentBareName(id));
    }
    let newAgents: string[] = [];
    let removedAgents: string[] = [];
    const prev = prevAgentNames;
    if (prev !== null) {
      newAgents = [...agentNames]
        .filter((n) => !prev.has(n))
        .sort()
        .slice(0, AGENT_SAMPLE_CAP);
      removedAgents = [...prev]
        .filter((n) => !agentNames.has(n))
        .sort()
        .slice(0, AGENT_SAMPLE_CAP);
    }
    rows.push({
      date: row.date,
      commitCount: row.commitCount,
      schema: row.schema,
      agents: agentCount,
      edges: row.agents?.e?.length ?? 0,
      newAgents,
      removedAgents,
    });
    prevAgentNames = agentNames;
  }
  return { graphHeadSha: file.graphHeadSha, rows };
}

/** Latest agent surface (Agents tab sections 1-2) from one snapshot's
 *  per-project projections. Agent↔skill relationships = stored tuples whose
 *  OTHER endpoint's kind prefix is `skill`. Returns null when the snapshot
 *  carries no agentGraph blocks. Pure. */
function agentsLatestOf(snapshot: Snapshot | null): AgentsLatest | null {
  const perProject: Record<string, number> = {};
  const relationshipByType: Record<string, number> = {};
  const relationshipByProjectType: Record<string, Record<string, number>> = {};
  let any = false;
  for (const [project, entry] of Object.entries(snapshot?.projects ?? {})) {
    const block = entry?.agentGraph;
    if (!block) continue;
    any = true;
    let count = 0;
    for (const [id] of block.n) if (id.startsWith("agent:")) count++;
    perProject[project] = count;
    const byType: Record<string, number> = {};
    for (const [ai, oi, ti] of block.e) {
      const agentId = block.n[ai]?.[0];
      const otherId = block.n[oi]?.[0];
      const type = block.t[ti];
      if (!agentId?.startsWith("agent:") || otherId === undefined || type === undefined) continue;
      if (agentKindOf(otherId) !== "skill") continue;
      byType[type] = (byType[type] ?? 0) + 1;
      relationshipByType[type] = (relationshipByType[type] ?? 0) + 1;
    }
    relationshipByProjectType[project] = byType;
  }
  if (!any) return null;
  return { perProject, relationshipByType, relationshipByProjectType };
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
 * scan. v2.6.0 adds the agent replay: per-date agent-node + per-edge-type
 * NEW/VANISHED classes computed from the raw `agentGraph` projections (rows
 * whose snapshot lacks the block — every legacy date — carry `agents: null`),
 * the first tracking date, the latest agent surface, and pass-through of the
 * rollup + backfill the caller computed. Pure: identical inputs → identical
 * model → byte-identical page.
 */
export function buildHistoryModel(
  snapshots: Snapshot[],
  fleetInfo: FleetInfoInput,
  tickets: HistoryTicket[] = [],
  extras: { rollup?: AgentRollup | null; backfill?: RootBackfillFile | null } = {},
): HistoryModel {
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const SNAPSHOT_HREF_RE = /^\d{4}-\d{2}-\d{2}$/;
  const hrefOf = (date: string): string | null =>
    SNAPSHOT_HREF_RE.test(date) ? `../memory/skill-graph-metrics/snapshot-${date}.json` : null;
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
    // v2.6.0: agent replay — a snapshot carrying any agentGraph block diffs
    // against the prior snapshot's blocks (a legacy prior side = the honest
    // full baseline: everything NEW); a blockless snapshot carries null.
    let agents: AgentDiffClasses | null = null;
    const curBlocks: Record<string, AgentGraphProjection | undefined> = {};
    const prevBlocks: Record<string, AgentGraphProjection | undefined> = {};
    for (const [project, entry] of Object.entries(s.projects ?? {})) curBlocks[project] = entry?.agentGraph;
    for (const [project, entry] of Object.entries(sorted[i - 1]?.projects ?? {}))
      prevBlocks[project] = entry?.agentGraph;
    if (Object.values(curBlocks).some((b) => b !== undefined)) {
      agents = diffAgentGraphs(prevBlocks, curBlocks);
    }
    return {
      date: s.date,
      projects: s.projects ?? {},
      classes,
      newSkills,
      vanishedSkills,
      agents,
      snapshotHref: hrefOf(s.date),
    };
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
  const beginRow = series.find((r) => r.agents !== null) ?? null;
  return {
    fleet: { count: fleetInfo.count, members },
    series,
    gaps,
    latest,
    tickets,
    agentTrackingBegins: beginRow?.date ?? null,
    agentsLatest: agentsLatestOf(latestSnap),
    rollup: extras.rollup ?? null,
    backfill: summarizeBackfill(extras.backfill),
  };
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
a.tab-link{text-decoration:none;display:inline-block}
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
<button class="tab-btn" data-tab="agents" type="button">Agents</button>
<button class="tab-btn" data-tab="divergence" type="button">Divergence</button>
<button class="tab-btn" data-tab="gaps" type="button">Delivery gaps</button>
<button class="tab-btn" data-tab="tickets" type="button">Tickets</button>
<a class="tab-btn tab-link" href="skill-graph-structure.html" title="Graph-structure companion page">Structure</a>
</nav>
</header>
<main>
<section id="tab-overview" class="tab active"></section>
<section id="tab-timeline" class="tab"></section>
<section id="tab-agents" class="tab"></section>
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
var TABS = ["overview", "timeline", "agents", "divergence", "gaps", "tickets"];
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

// v2.6.0: the per-row snapshot hrefs are computed SERVER-side (regex-guarded
// there; see buildHistoryModel's snapshotHref) — full data for any date is one
// relative navigation away (CSP default-src 'none' governs resource loads, not
// navigation). The client never synthesizes URLs from model content.

function countTable(pairs, valueHeader, nameHeader) {
  var table = el("table");
  var thead = el("thead");
  var hr = el("tr");
  [nameHeader || "name", valueHeader].forEach(function (h) { hr.appendChild(el("th", "", h)); });
  thead.appendChild(hr);
  table.appendChild(thead);
  var tbody = el("tbody");
  pairs.forEach(function (p) {
    var tr = el("tr", "row");
    tr.setAttribute("data-search", p[0].toLowerCase());
    tr.appendChild(el("td", "", p[0]));
    tr.appendChild(el("td", "", String(p[1])));
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  return table;
}

function sortedPairs(rec) {
  return Object.keys(rec || {}).map(function (k) { return [k, rec[k]]; })
    .sort(function (a, b) { return b[1] - a[1] || (a[0] < b[0] ? -1 : 1); });
}

function edgeSummaryBlock(summaries, kindLabel, href) {
  var wrap = el("div");
  var head = el("h3", "", kindLabel);
  if (href) {
    var link = el("a", "muted", "full snapshot \\u2192");
    link.setAttribute("href", href);
    head.appendChild(document.createTextNode(" "));
    head.appendChild(link);
  }
  wrap.appendChild(head);
  if (!summaries || summaries.length === 0) {
    wrap.appendChild(el("p", "muted", "\\u2014"));
    return wrap;
  }
  summaries.forEach(function (s) {
    var det = document.createElement("details");
    det.className = "group row";
    var sum = el("summary");
    sum.appendChild(el("span", "cap", s.type));
    sum.appendChild(el("span", "count", String(s.count)));
    det.appendChild(sum);
    var chips = el("div", "chips");
    s.sample.forEach(function (t) {
      var chipEl = chip(t[0] + " \\u2194 " + t[1] + " (" + t[2] + ")");
      chipEl.setAttribute("data-search", (t[0] + " " + t[1] + " " + t[2]).toLowerCase());
      chips.appendChild(chipEl);
    });
    if (s.count > s.sample.length) {
      chips.appendChild(el("span", "muted", "and " + (s.count - s.sample.length) + " more"));
    }
    det.appendChild(chips);
    wrap.appendChild(det);
  });
  return wrap;
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

function renderAgents() {
  var ag = sections.agents;
  ag.textContent = "";
  ag.appendChild(el("h2", "", "Agent tracking"));
  if (MODEL.agentTrackingBegins) {
    ag.appendChild(el("p", "muted", "Agent tracking begins " + MODEL.agentTrackingBegins + " \\u2014 earlier dates record skill capabilities only (legacy snapshots carry no agentGraph block)."));
  } else {
    ag.appendChild(el("p", "muted", "No snapshot in this corpus carries an agentGraph block yet \\u2014 agent tracking starts with the next emission."));
  }

  // (1) agents per project + (2) relationship counts by edge type (latest snapshot)
  var latest = MODEL.agentsLatest;
  if (latest) {
    ag.appendChild(el("h2", "", "Agents per project (latest snapshot " + MODEL.latest.date + ")"));
    ag.appendChild(countTable(sortedPairs(latest.perProject), "agents", "project"));
    ag.appendChild(el("h2", "", "Agent\\u2194skill relationships by edge type (fleet aggregate)"));
    ag.appendChild(countTable(sortedPairs(latest.relationshipByType), "relationships", "edge type"));
    ag.appendChild(el("h2", "", "Agent\\u2194skill relationships per project"));
    Object.keys(latest.relationshipByProjectType).sort().forEach(function (p) {
      var det = document.createElement("details");
      det.className = "group row";
      var sum = el("summary");
      sum.appendChild(el("span", "cap", p));
      det.appendChild(sum);
      det.appendChild(countTable(sortedPairs(latest.relationshipByProjectType[p]), "relationships", "edge type"));
      det.setAttribute("data-search", p.toLowerCase());
      ag.appendChild(det);
    });
  } else {
    ag.appendChild(el("p", "muted", "Latest snapshot carries no agentGraph block."));
  }

  // (3) newest relationship changes (reverse-chron feed of the per-date classes)
  ag.appendChild(el("h2", "", "Newest relationship changes (snapshot-sourced, newest first)"));
  var feedRows = MODEL.series.filter(function (r) { return r.agents !== null && r.agents !== undefined; });
  if (feedRows.length === 0) {
    ag.appendChild(el("p", "muted", "No agentGraph diffs recorded yet."));
  }
  for (var fi = feedRows.length - 1; fi >= 0; fi--) {
    var row = feedRows[fi];
    var grp = el("div", "group row");
    grp.setAttribute("data-search", row.date.toLowerCase());
    var head = el("h3", "", row.date);
    var href = row.snapshotHref;
    if (href) {
      var link = el("a", "muted", "full snapshot \\u2192");
      link.setAttribute("href", href);
      head.appendChild(document.createTextNode(" "));
      head.appendChild(link);
    }
    grp.appendChild(head);
    var nodeLine = el("p", "", "");
    nodeLine.appendChild(el("span", "cap", "agent nodes "));
    nodeLine.appendChild(document.createTextNode("added " + row.agents.agentNodes.added.length + ", removed " + row.agents.agentNodes.removed.length));
    grp.appendChild(nodeLine);
    if (row.agents.agentNodes.added.length > 0) {
      var addChips = el("div", "chips");
      row.agents.agentNodes.added.forEach(function (id) { addChips.appendChild(chip(id)); });
      grp.appendChild(addChips);
    }
    if (row.agents.agentNodes.removed.length > 0) {
      var remChips = el("div", "chips");
      row.agents.agentNodes.removed.forEach(function (id) { remChips.appendChild(chip(id)); });
      grp.appendChild(remChips);
    }
    grp.appendChild(edgeSummaryBlock(row.agents.agentEdges.added, "Edges added by type", row.snapshotHref));
    grp.appendChild(edgeSummaryBlock(row.agents.agentEdges.removed, "Edges removed by type", row.snapshotHref));
    ag.appendChild(grp);
  }

  // (A1) backfilled root timeline — commit-granularity, provenance-marked
  ag.appendChild(el("h2", "", "Root timeline (backfilled from git history)"));
  if (MODEL.backfill && MODEL.backfill.rows.length > 0) {
    ag.appendChild(el("p", "muted", "Backfilled from git history \\u2014 commit-granularity only (intra-commit-day states never existed; stale windows replay as repeated identical states, not interpolated gaps). Provenance: " + MODEL.backfill.graphHeadSha.slice(0, 12) + " (as of the last commit that changed the skill graph)."));
    var bfTable = el("table");
    var bthead = el("thead");
    var bhr = el("tr");
    ["date", "commits", "schema", "agents", "edges", "new agents", "removed agents", "provenance"].forEach(function (h) { bhr.appendChild(el("th", "", h)); });
    bthead.appendChild(bhr);
    bfTable.appendChild(bthead);
    var btbody = el("tbody");
    for (var bi = MODEL.backfill.rows.length - 1; bi >= 0; bi--) {
      var brow = MODEL.backfill.rows[bi];
      var btr = el("tr", "row");
      btr.setAttribute("data-search", brow.date.toLowerCase());
      btr.appendChild(el("td", "mono", brow.date));
      btr.appendChild(el("td", "", String(brow.commitCount)));
      btr.appendChild(el("td", "", String(brow.schema)));
      btr.appendChild(el("td", "", String(brow.agents)));
      btr.appendChild(el("td", "", String(brow.edges)));
      var tdNewA = el("td");
      if (brow.newAgents.length === 0) tdNewA.appendChild(el("span", "muted", "\\u2014"));
      else brow.newAgents.forEach(function (n) { tdNewA.appendChild(chip(n)); });
      btr.appendChild(tdNewA);
      var tdRemA = el("td");
      if (brow.removedAgents.length === 0) tdRemA.appendChild(el("span", "muted", "\\u2014"));
      else brow.removedAgents.forEach(function (n) { tdRemA.appendChild(chip(n)); });
      btr.appendChild(tdRemA);
      var tdProv = el("td");
      tdProv.appendChild(el("span", "badge", "backfilled"));
      btr.appendChild(tdProv);
      btbody.appendChild(btr);
    }
    bfTable.appendChild(btbody);
    ag.appendChild(bfTable);
  } else {
    ag.appendChild(el("p", "muted", "No backfilled root history available \\u2014 showing snapshot-sourced days only."));
  }

  // (D-A3) learning-candidates callout (report-only; filing belongs to the resync skill + human triage)
  var rollup = MODEL.rollup;
  ag.appendChild(el("h2", "", "Learning candidates (>= " + (rollup ? rollup.threshold : 3) + " projects, report-only \\u2014 the fleet report never files tickets)"));
  if (!rollup) {
    ag.appendChild(el("p", "muted", "No rollup computed for this run."));
    return;
  }
  function rollupGroup(title, rows, render) {
    ag.appendChild(el("h3", "", title));
    if (!rows || rows.length === 0) {
      ag.appendChild(el("p", "muted", "\\u2014"));
      return;
    }
    var table = el("table");
    var thead = el("thead");
    var hr2 = el("tr");
    var headers = render.headers;
    headers.forEach(function (h) { hr2.appendChild(el("th", "", h)); });
    thead.appendChild(hr2);
    table.appendChild(thead);
    var tbody2 = el("tbody");
    rows.forEach(function (r) {
      var tr = el("tr", "row");
      tr.setAttribute("data-search", render.search(r).toLowerCase());
      render.cells(r).forEach(function (cell) { tr.appendChild(el("td", "", cell)); });
      tbody2.appendChild(tr);
    });
    table.appendChild(tbody2);
    ag.appendChild(table);
  }
  function hashGroupsLine(rec) {
    return Object.keys(rec).map(function (h) { return h.slice(0, 8) + ": " + rec[h].join(", "); }).join(" \\u00b7 ");
  }
  rollupGroup(
    "Agent capability convergence \\u2014 promotion candidates (single hash, absent from root): " + rollup.promotions.length + (rollup.totals.promotions > rollup.promotions.length ? " (showing " + rollup.promotions.length + " of " + rollup.totals.promotions + ")" : ""),
    rollup.promotions,
    {
      headers: ["agent", "hash", "projects"],
      cells: function (r) { return [r.name, r.hash.slice(0, 8), r.projects.join(", ")]; },
      search: function (r) { return r.name + " " + r.projects.join(" "); },
    },
  );
  rollupGroup(
    "Agent capability divergence \\u2014 reconciliation candidates, never auto-promoted: " + rollup.reconciliations.length + (rollup.totals.reconciliations > rollup.reconciliations.length ? " (showing " + rollup.reconciliations.length + " of " + rollup.totals.reconciliations + ")" : ""),
    rollup.reconciliations,
    {
      headers: ["agent", "hash groups"],
      cells: function (r) { return [r.name, hashGroupsLine(r.hashes)]; },
      search: function (r) { return r.name; },
    },
  );
  rollupGroup(
    "Agent capability hash-unknown: " + rollup.hashUnknown.length,
    rollup.hashUnknown.map(function (n) { return { name: n }; }),
    {
      headers: ["agent"],
      cells: function (r) { return [r.name]; },
      search: function (r) { return r.name; },
    },
  );
  rollupGroup(
    "Relationship convergence \\u2014 learning candidates (absent from root): " + rollup.relationships.length + (rollup.totals.relationships > rollup.relationships.length ? " (showing " + rollup.relationships.length + " of " + rollup.totals.relationships + ")" : ""),
    rollup.relationships,
    {
      headers: ["agent", "edge type", "endpoint", "projects"],
      cells: function (r) { return [r.agent, r.edgeType, r.kind + ":" + r.endpoint, r.projects.join(", ")]; },
      search: function (r) { return r.agent + " " + r.endpoint + " " + r.edgeType + " " + r.projects.join(" "); },
    },
  );
  rollupGroup(
    "Edge-type splits \\u2014 divergence-style candidates: " + rollup.splits.length + (rollup.totals.splits > rollup.splits.length ? " (showing " + rollup.splits.length + " of " + rollup.totals.splits + ")" : ""),
    rollup.splits,
    {
      headers: ["agent", "endpoint", "types (projects)"],
      cells: function (r) { return [r.agent, r.kind + ":" + r.endpoint, hashGroupsLine(r.types)]; },
      search: function (r) { return r.agent + " " + r.endpoint; },
    },
  );
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
renderAgents();
renderDivergence();
renderGaps();
renderTickets();
activate("overview");
})();
</script>
</body>
</html>`;
}

// ── v2.6.0 — graph-structure companion page (design docs/designs/2026-11-23-skill-graph-observability-design.md §5.5) ──

/** Hub list cap (structure facts by degree, NOT centrality scoring — non-goal §4). */
export const HUB_CAP = 20;

/** Top-N capability differences per juxtaposition direction (design §5.5 content 3). */
export const JUXTAPOSITION_CAP = 10;

export interface StructureColumn {
  /** Human source label, e.g. "root layer slice" or "templates/co-x/docs/skill-graph.json". */
  source: string;
  /** The column's own hop layer vocabulary (measured from the data, never assumed). */
  vocabulary: string;
  nodes: number;
  edges: number;
  byType: Record<string, number>;
}

export interface StructureVariant {
  variant: string;
  root: StructureColumn;
  template: StructureColumn | null;
  project: StructureColumn | null;
  /** Capabilities present in the project but not the template (top JUXTAPOSITION_CAP + more). */
  projectOnly: { names: string[]; more: number };
  /** Capabilities present in the template but not the project. */
  templateOnly: { names: string[]; more: number };
}

export interface StructureModel {
  root: { nodes: number; edges: number };
  /** Compact explorer payload: node ids in graph order (index = node index). */
  labels: string[];
  /** Node-type enum (first-seen order). */
  types: string[];
  /** Layer enum (first-seen order). */
  layers: string[];
  /** Flat [typeIdx, layerIdx] per node. */
  meta: number[];
  /** Edge-type enum (first-seen order). */
  edgeTypes: string[];
  /** Numeric adjacency [fromIdx, toIdx, typeIdx] over ALL root edges. */
  adj: Array<[number, number, number]>;
  /** Layer composition (L0, common, then variant:* alphabetically). */
  layerMatrix: Array<{ layer: string; total: number; byType: Record<string, number> }>;
  edgeDistribution: Array<{ type: string; count: number }>;
  /** Top hubs by degree (structure facts, not scores; cap HUB_CAP). */
  hubs: Array<{ id: string; degree: number }>;
  /** Per-variant three-column juxtaposition. */
  variants: StructureVariant[];
  /** Root agent/edge count-over-time from the git-history backfill (null when absent). */
  backfill: {
    /** v2.6.2: last commit that changed the skill graph (not HEAD). */
    graphHeadSha: string;
    rows: Array<{ date: string; commitCount: number; schema: number; agents: number; edges: number }>;
  } | null;
}

/** Bare capability names (skill+agent nodes) of one graph, sorted — the
 *  juxtaposition diff key. */
function capabilityBareNames(graph: SkillGraph): Set<string> {
  const out = new Set<string>();
  for (const node of graph.nodes ?? []) {
    if (node.type !== "skill" && node.type !== "agent") continue;
    out.add(capabilityOf(node));
  }
  return out;
}

function columnOf(graph: SkillGraph, source: string, inducedIds?: Set<string>): StructureColumn {
  const nodes = graph.nodes ?? [];
  const byType: Record<string, number> = {};
  const kept = inducedIds ? nodes.filter((n) => inducedIds.has(n.id)) : nodes;
  for (const n of kept) byType[n.type] = (byType[n.type] ?? 0) + 1;
  const idSet = inducedIds ?? new Set(nodes.map((n) => n.id));
  let edges = 0;
  for (const e of graph.edges ?? []) {
    if (idSet.has(e.from) && idSet.has(e.to)) edges++;
  }
  const vocab = [...new Set(kept.map((n) => n.layer))].sort().join(" · ") || "(none)";
  return { source, vocabulary: vocab, nodes: kept.length, edges, byType };
}

/**
 * v2.6.0 (D-C) — structure-page model: full-root compact payload (labels +
 * enums + numeric adjacency, measured ~89 KB), layer composition, degree hubs,
 * per-variant root/template/project juxtaposition with per-hop vocabulary, and
 * the backfill count-over-time series. Pure: identical inputs → identical
 * model → byte-identical page (AC13).
 */
export function buildStructureModel(
  rootGraph: SkillGraph,
  templateGraphs: Record<string, SkillGraph | null>,
  projectGraphs: Record<string, SkillGraph | null>,
  backfill: RootBackfillFile | null,
): StructureModel {
  const nodes = rootGraph.nodes ?? [];
  const edges = rootGraph.edges ?? [];
  const labels = nodes.map((n) => n.id);
  const types: string[] = [];
  const layers: string[] = [];
  const typeIdx = new Map<string, number>();
  const layerIdx = new Map<string, number>();
  const meta: number[] = [];
  const enumOf = (list: string[], index: Map<string, number>, value: string): number => {
    let idx = index.get(value);
    if (idx === undefined) {
      idx = list.length;
      index.set(value, idx);
      list.push(value);
    }
    return idx;
  };
  for (const n of nodes) {
    meta.push(enumOf(types, typeIdx, n.type), enumOf(layers, layerIdx, n.layer));
  }
  const edgeTypes: string[] = [];
  const edgeTypeIdx = new Map<string, number>();
  const adj: Array<[number, number, number]> = [];
  const nodePos = new Map<string, number>();
  nodes.forEach((n, i) => nodePos.set(n.id, i));
  for (const e of edges) {
    const from = nodePos.get(e.from);
    const to = nodePos.get(e.to);
    if (from === undefined || to === undefined) continue;
    adj.push([from, to, enumOf(edgeTypes, edgeTypeIdx, e.type)]);
  }

  const layerOrder = (a: string, b: string): number => {
    const rank = (l: string): number => (l === "L0" ? 0 : l === "common" ? 1 : l.startsWith("variant:") ? 2 : 3);
    return rank(a) - rank(b) || a.localeCompare(b);
  };
  const byLayer = new Map<string, Record<string, number>>();
  for (const n of nodes) {
    const slot = byLayer.get(n.layer) ?? {};
    slot[n.type] = (slot[n.type] ?? 0) + 1;
    byLayer.set(n.layer, slot);
  }
  const layerMatrix = [...byLayer.entries()]
    .sort((a, b) => layerOrder(a[0], b[0]))
    .map(([layer, slot]) => ({
      layer,
      total: Object.values(slot).reduce((a, b) => a + b, 0),
      byType: slot,
    }));

  const dist = new Map<string, number>();
  for (const e of edges) dist.set(e.type, (dist.get(e.type) ?? 0) + 1);
  const edgeDistribution = [...dist.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));

  const degree = new Map<string, number>();
  for (const e of edges) {
    degree.set(e.from, (degree.get(e.from) ?? 0) + 1);
    degree.set(e.to, (degree.get(e.to) ?? 0) + 1);
  }
  const hubs = [...degree.entries()]
    .map(([id, d]) => ({ id, degree: d }))
    .sort((a, b) => b.degree - a.degree || a.id.localeCompare(b.id))
    .slice(0, HUB_CAP);

  const rootVocab = [...new Set(nodes.map((n) => n.layer))].sort(layerOrder).join(" · ");
  const variantNames = [...new Set(nodes.map((n) => n.layer).filter((l) => l.startsWith("variant:")))]
    .map((l) => l.slice("variant:".length))
    .sort();
  const variants: StructureVariant[] = variantNames.map((variant) => {
    const sliceId = `variant:${variant}`;
    const sliceIds = new Set(nodes.filter((n) => n.layer === sliceId).map((n) => n.id));
    const rootCol = columnOf(rootGraph, `root layer slice (layer == ${sliceId})`, sliceIds);
    rootCol.vocabulary = rootVocab; // the slice inherits the root hop's vocabulary
    const template = templateGraphs[variant] ?? null;
    const project = projectGraphs[variant] ?? null;
    const templateCol = template ? columnOf(template, `templates/${variant}/docs/skill-graph.json`) : null;
    const projectCol = project ? columnOf(project, `Projects/${variant}/docs/skill-graph.json`) : null;
    const diff = (a: Set<string> | null, b: Set<string> | null): { names: string[]; more: number } => {
      if (!a || !b) return { names: [], more: 0 };
      const only = [...a].filter((x) => !b.has(x)).sort();
      return { names: only.slice(0, JUXTAPOSITION_CAP), more: Math.max(0, only.length - JUXTAPOSITION_CAP) };
    };
    return {
      variant,
      root: rootCol,
      template: templateCol,
      project: projectCol,
      projectOnly: diff(
        capabilityBareNames(project ?? { version: 2, nodes: [], edges: [] }),
        capabilityBareNames(template ?? { version: 2, nodes: [], edges: [] }),
      ),
      templateOnly: diff(
        capabilityBareNames(template ?? { version: 2, nodes: [], edges: [] }),
        capabilityBareNames(project ?? { version: 2, nodes: [], edges: [] }),
      ),
    };
  });

  const backfillRows = (backfill?.rows ?? []).map((r) => ({
    date: r.date,
    commitCount: r.commitCount,
    schema: r.schema,
    agents: r.agents?.n?.filter(([id]) => id.startsWith("agent:")).length ?? 0,
    edges: r.agents?.e?.length ?? 0,
  }));

  return {
    root: { nodes: nodes.length, edges: edges.length },
    labels,
    types,
    layers,
    meta,
    edgeTypes,
    adj,
    layerMatrix,
    edgeDistribution,
    hubs,
    variants,
    backfill: backfillRows.length > 0 ? { graphHeadSha: backfill?.graphHeadSha ?? "", rows: backfillRows } : null,
  };
}

/** Deterministic horizontal SVG bar row (no-JS visible layer composition). */
function svgBar(label: string, count: number, max: number, fillVar: string): string {
  const width = max > 0 ? Math.max(2, Math.round((count / max) * 380)) : 2;
  return `<div class="barrow"><span class="barlabel">${escapeHtml(label)}</span><svg width="440" height="18" role="img" aria-label="${escapeHtml(label)}: ${count}"><rect x="0" y="3" width="${width}" height="12" style="fill:${fillVar}"></rect><text x="${width + 6}" y="14" class="bartext">${count}</text></svg></div>`;
}

/** Deterministic SVG count-over-time line (backfill series; both series drawn
 *  against their own maxima — structure facts, not calibrated axes). */
function svgTrendLine(rows: Array<{ date: string; agents: number; edges: number }>): string {
  const n = rows.length;
  const w = 720;
  const h = 140;
  const point = (i: number, v: number, max: number): string =>
    `${Math.round((i / Math.max(1, n - 1)) * (w - 20)) + 10},${h - 10 - Math.round((v / Math.max(1, max)) * (h - 30))}`;
  const maxA = Math.max(...rows.map((r) => r.agents), 1);
  const maxE = Math.max(...rows.map((r) => r.edges), 1);
  const lineA = rows.map((r, i) => point(i, r.agents, maxA)).join(" ");
  const lineE = rows.map((r, i) => point(i, r.edges, maxE)).join(" ");
  const first = rows[0];
  const last = rows[n - 1];
  return `<svg width="${w}" height="${h}" role="img" aria-label="root agent and agent-touching edge counts over backfilled git history">
<polyline points="${lineA}" style="fill:none;stroke:var(--accent);stroke-width:2"></polyline>
<polyline points="${lineE}" style="fill:none;stroke:var(--ok);stroke-width:2"></polyline>
<text x="10" y="12" class="bartext">agents max ${maxA}</text>
<text x="120" y="12" class="bartext">edges max ${maxE}</text>
<text x="10" y="${h - 2}" class="bartext">${escapeHtml(first.date)}</text>
<text x="${w - 90}" y="${h - 2}" class="bartext">${escapeHtml(last.date)}</text>
</svg>`;
}

/**
 * v2.6.0 (D-C) — the structure page: one deterministic template-literal
 * document, CSP default-src 'none' + unsafe-inline style/script (the explorer
 * needs JS), zero external references, data inlined as a \\u003c-escaped JSON
 * block, every server-rendered dynamic string through escapeHtml. Sections:
 * (1) layer composition + edge distribution + hubs as inline SVG (no-JS
 * visible), (2) root agent/edge count-over-time from the backfill, (3) the
 * searchable full-root ego explorer with edge-type labels, (4) per-variant
 * three-column juxtaposition.
 */
export function renderStructurePage(model: StructureModel): string {
  const layerRows = model.layerMatrix
    .map((row) => svgBar(`${row.layer}`, row.total, model.layerMatrix[0]?.total ?? 1, "var(--accent)"))
    .join("\n");
  const distMax = model.edgeDistribution[0]?.count ?? 1;
  const distRows = model.edgeDistribution.map((row) => svgBar(row.type, row.count, distMax, "var(--ok)")).join("\n");
  const hubRows = model.hubs
    .map((hub) => `<tr><td class="mono">${escapeHtml(hub.id)}</td><td>${hub.degree}</td></tr>`)
    .join("\n");
  const trend = model.backfill && model.backfill.rows.length > 1 ? svgTrendLine(model.backfill.rows) : "";
  const trendNote = model.backfill
    ? `<p class="muted">Root agent/edge counts over the backfilled git history (commit-granularity; as of the last commit that changed the skill graph, ${escapeHtml(model.backfill.graphHeadSha.slice(0, 12))}) — backfilled from git history; intra-commit-day states never existed.</p>${trend}`
    : `<p class="muted">No backfilled root history available (the backfill step did not run or found no rows).</p>`;
  const variantBlocks = model.variants
    .map((v) => {
      const colCell = (col: StructureColumn | null, fallback: string): string => {
        if (!col) return `<td>${escapeHtml(fallback)}</td>`;
        const topTypes = Object.entries(col.byType)
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .slice(0, 5)
          .map(([t, c]) => `${escapeHtml(t)} ${c}`)
          .join(", ");
        return `<td><strong>${col.nodes}</strong> nodes / <strong>${col.edges}</strong> edges<br><span class="mono small">${topTypes}</span><br><span class="muted small">vocab: ${escapeHtml(col.vocabulary)}</span></td>`;
      };
      const diffList = (names: string[], more: number): string =>
        names.length === 0 && more === 0
          ? '<span class="muted small">—</span>'
          : `<span class="mono small">${names.map((nm) => escapeHtml(nm)).join(", ")}</span>${more > 0 ? `<span class="muted small"> +${more} more</span>` : ""}`;
      return `<details class="group"><summary><span class="cap">${escapeHtml(v.variant)}</span><span class="count">${v.root.nodes} / ${v.template?.nodes ?? "—"} / ${v.project?.nodes ?? "—"}</span></summary>
<table><thead><tr><th>root (${escapeHtml(v.root.source)})</th><th>template</th><th>project</th></tr></thead>
<tbody><tr>${colCell(v.root, "no root slice")}${colCell(v.template, `templates/${escapeHtml(v.variant)}/docs/skill-graph.json missing`)}${colCell(v.project, `Projects/${escapeHtml(v.variant)}/docs/skill-graph.json missing`)}</tr></tbody></table>
<p class="small">Project-only capabilities (top ${JUXTAPOSITION_CAP}): ${diffList(v.projectOnly.names, v.projectOnly.more)}</p>
<p class="small">Template-only capabilities (top ${JUXTAPOSITION_CAP}): ${diffList(v.templateOnly.names, v.templateOnly.more)}</p>
</details>`;
    })
    .join("\n");
  const payload = {
    labels: model.labels,
    types: model.types,
    layers: model.layers,
    meta: model.meta,
    edgeTypes: model.edgeTypes,
    adj: model.adj,
  };
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Skill-Graph Structure</title>
<style>
:root{--bg:#f6f7f9;--fg:#1c2430;--muted:#5b6673;--card:#ffffff;--border:#d5dae1;--accent:#2563eb;--ok:#15803d;--chip:#e8edf3}
@media (prefers-color-scheme: dark){:root{--bg:#12161c;--fg:#dce3ec;--muted:#8b96a5;--card:#1a2028;--border:#2b333e;--accent:#5b9dff;--ok:#4ade80;--chip:#232b35}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}
header{padding:16px 20px;border-bottom:1px solid var(--border)}
h1{margin:0 0 6px;font-size:20px}
h2{font-size:15px;margin:20px 0 8px}
h3{font-size:13px;margin:12px 0 6px}
main{padding:16px 20px 40px;max-width:1100px}
.muted{color:var(--muted)}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.small{font-size:12px}
.barrow{display:flex;align-items:center;gap:8px;margin:2px 0}
.barlabel{min-width:190px;font-size:12px;color:var(--muted)}
.bartext{font:11px system-ui;fill:var(--fg)}
table{border-collapse:collapse;width:100%;margin:8px 0;background:var(--card);border:1px solid var(--border);border-radius:8px}
th,td{text-align:left;padding:6px 10px;border-bottom:1px solid var(--border);vertical-align:top}
th{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.04em}
tr:last-child td{border-bottom:none}
.group{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:8px 12px;margin:8px 0}
details.group>summary{cursor:pointer;display:flex;align-items:center;gap:8px}
.count{background:var(--chip);border-radius:10px;padding:1px 8px;font-size:12px}
#explorer .controls{display:flex;gap:8px;margin:8px 0}
#explorer input{flex:1;max-width:520px;padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--card);color:var(--fg)}
#results{list-style:none;margin:0;padding:0;max-height:200px;overflow-y:auto}
#results li{padding:4px 8px;cursor:pointer;border-bottom:1px solid var(--border);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px}
#results li:hover{background:var(--chip)}
#ego{margin-top:10px}
.edge-row{padding:3px 0;border-bottom:1px solid var(--border);font-size:13px}
.edge-type{display:inline-block;background:var(--chip);border:1px solid var(--border);border-radius:10px;padding:0 8px;font-size:11px;margin:0 4px}
.nodelink{cursor:pointer;text-decoration:underline}
</style>
</head>
<body>
<header>
<h1>Skill-Graph Structure</h1>
<p class="muted">Root graph ${model.root.nodes} nodes · ${model.root.edges} edges · ${model.edgeTypes.length} edge types. Companion to the <a href="skill-graph-history.html">fleet history dashboard</a> — generated deterministically by <span class="mono">scripts/skill-graph-fleet-report.ts</span> v2.6.0.</p>
</header>
<main>
<section id="composition">
<h2>Layer composition (node-type × layer, inline SVG — visible without JavaScript)</h2>
${layerRows}
<h2>Edge-type distribution</h2>
${distRows}
<h2>Top hubs by degree (top ${HUB_CAP} — degree counts, not scored centrality)</h2>
<table><thead><tr><th>node</th><th>degree</th></tr></thead><tbody>
${hubRows}
</tbody></table>
</section>
<section id="agentline">
<h2>Root agent/edge counts over time (git-history backfill)</h2>
${trendNote}
</section>
<section id="explorer">
<h2>Ego-graph explorer (1-hop neighborhood, labeled edge types)</h2>
<div class="controls"><input id="q" type="search" placeholder="Search a node id (e.g. skill:root/meeting-facilitation)" aria-label="Search nodes"></div>
<ul id="results"></ul>
<div id="ego"></div>
</section>
<section id="juxtaposition">
<h2>Layer juxtaposition per variant (root slice / template / project — counts, not topology)</h2>
<p class="muted small">Each column states its own hop layer vocabulary. Differences are capability-level bare names, top ${JUXTAPOSITION_CAP} each with +N more.</p>
${variantBlocks}
</section>
</main>
<script id="structure-data" type="application/json">${JSON.stringify(payload).replace(/</g, "\\u003c")}</script>
<script>
(function () {
"use strict";
var DATA = JSON.parse(document.getElementById("structure-data").textContent);
var LABELS = DATA.labels, META = DATA.meta, TYPES = DATA.types, LAYERS = DATA.layers, ETYPES = DATA.edgeTypes, ADJ = DATA.adj;
var neighbors = {};
ADJ.forEach(function (t) {
  var from = t[0], to = t[1], type = t[2];
  if (!neighbors[from]) neighbors[from] = [];
  neighbors[from].push({ other: to, type: ETYPES[type], dir: "out" });
  if (to !== from) {
    if (!neighbors[to]) neighbors[to] = [];
    neighbors[to].push({ other: from, type: ETYPES[type], dir: "in" });
  }
});
function el(tag, cls, text) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
var q = document.getElementById("q");
var results = document.getElementById("results");
var ego = document.getElementById("ego");
function select(idx) {
  ego.textContent = "";
  var label = LABELS[idx];
  var typeIdx = META[idx * 2], layerIdx = META[idx * 2 + 1];
  var head = el("h3", "", label);
  ego.appendChild(head);
  ego.appendChild(el("p", "muted small", "type: " + TYPES[typeIdx] + " · layer: " + LAYERS[layerIdx] + " · degree: " + ((neighbors[idx] || []).length)));
  var list = neighbors[idx] || [];
  if (list.length === 0) {
    ego.appendChild(el("p", "muted", "Isolated node (zero edges)."));
    return;
  }
  list.sort(function (a, b) { return a.type < b.type ? -1 : a.type > b.type ? 1 : LABELS[a.other] < LABELS[b.other] ? -1 : 1; });
  list.forEach(function (edgeR) {
    var row = el("div", "edge-row");
    var dirTxt = edgeR.dir === "out" ? "\\u2192" : "\\u2190";
    row.appendChild(document.createTextNode(dirTxt + " "));
    var badge = el("span", "edge-type", edgeR.type);
    row.appendChild(badge);
    row.appendChild(document.createTextNode(" "));
    var other = el("span", "nodelink", LABELS[edgeR.other]);
    other.addEventListener("click", function () { select(edgeR.other); });
    row.appendChild(other);
    ego.appendChild(row);
  });
}
q.addEventListener("input", function () {
  var query = q.value.trim().toLowerCase();
  results.textContent = "";
  if (query.length < 2) return;
  var shown = 0;
  for (var i = 0; i < LABELS.length && shown < 30; i++) {
    if (LABELS[i].toLowerCase().indexOf(query) !== -1) {
      var li = el("li", "", LABELS[i]);
      li.addEventListener("click", function (idx) { return function () { select(idx); results.textContent = ""; }; }(i));
      results.appendChild(li);
      shown++;
    }
  }
  if (shown === 0) results.appendChild(el("li", "muted", "no matching node"));
});
select(0);
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
and the graph-structure companion docs/skill-graph-structure.html (override
--html <path>, disable both with --no-html; each emission failure is WARN-only)
and the root git-history backfill memory/skill-graph-metrics/root-backfill.json
(skipped when fresh at the last commit that changed the graph path; replay cap
1000 commits aborts with a WARN).
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
  // v2.6.0 (D-A1): per-project agent projections (same load pass) + the loaded
  // graphs themselves for the structure page's juxtaposition column.
  const projectAgentGraphs = new Map<string, AgentGraphProjection>();
  const loadedGraphs = new Map<string, SkillGraph>();
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
    projectAgentGraphs.set(g.name, extractAgentGraph(graph));
    loadedGraphs.set(g.name, graph);
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
    // v2.6.0 (D-A1): the three legacy scalars stay byte-value-identical; each
    // entry gains the optional agentGraph projection (AC2 additive-only).
    projects: Object.fromEntries(
      stats.map((s) => [
        s.project,
        {
          nodes: s.nodes,
          edges: s.edges,
          skills: s.skills,
          agentGraph: projectAgentGraphs.get(s.project),
        },
      ]),
    ),
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
  writeFileSync(snapshotFile, serializeSnapshot(snapshot));
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
  // v2.6.0 — three independent WARN islands: (0) the §13 root git-history
  // backfill (feeds BOTH pages), (1) the history page, (2) the structure page —
  // one island failing never suppresses the others, and every failure is
  // WARN-only (snapshot, --json stdout, and the exit code are never affected).
  if (!noHtml) {
    // Island 0 — root backfill (§13.2, v2.6.2 key): skip when the recorded
    // graphHeadSha matches the last commit that changed the graph path;
    // otherwise one bounded full replay. Lives beside the snapshots.
    let backfill: RootBackfillFile | null = null;
    const backfillPath = join(snapshotDir, "root-backfill.json");
    try {
      // Native path is fine here: ensureRootBackfill/replayGraphHistory convert
      // it to a POSIX git pathspec (toGitPath) — required on Windows.
      const ensured = await ensureRootBackfill(process.cwd(), join("docs", "skill-graph.json"), backfillPath);
      backfill = ensured.file;
      const bfLine = ensured.rebuilt
        ? `⛏ root backfill → ${backfillPath} (${backfill.rows.length} commit dates replayed)`
        : `⛏ root backfill fresh at graph tip ${backfill.graphHeadSha.slice(0, 12)} — skipped (${backfillPath})`;
      if (json) console.error(bfLine);
      else console.log(bfLine);
    } catch (err) {
      console.warn(
        `⚠️ root backfill failed (${err instanceof Error ? err.message : String(err)}) — snapshot and both pages are unaffected; the Agents tab renders snapshot-sourced days only`,
      );
    }

    // Island 1 — history page.
    const outPath = htmlPath ?? join("docs", "skill-graph-history.html");
    const warnEmission = (reason: string, err: unknown): void => {
      console.warn(
        `⚠️ history page generation failed (${reason}): ${err instanceof Error ? err.message : String(err)} — snapshot is unaffected`,
      );
    };
    let page: string | null = null;
    try {
      const rollupBlocks: Record<string, AgentGraphProjection | undefined> = {};
      for (const [project, entry] of Object.entries(snapshot.projects)) rollupBlocks[project] = entry.agentGraph;
      page = renderHistoryPage(
        buildHistoryModel(
          loadSnapshots(snapshotDir),
          fleetInfo,
          scanSkillGraphTickets(join("tickets", "governance"), join("tickets", "governance", "archive")),
          { rollup: buildAgentRollup(rollupBlocks, rootGraph), backfill },
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

    // Island 2 — structure page (D-C): independent try/WARN; rides the same
    // --html/--no-html family, no new CLI flags (design §5.5).
    if (rootGraph) {
      try {
        const structPath = join(dirname(outPath), "skill-graph-structure.html");
        const variantNames = [
          ...new Set((rootGraph.nodes ?? []).map((n) => n.layer).filter((l) => l.startsWith("variant:"))),
        ].sort();
        const templateGraphs: Record<string, SkillGraph | null> = {};
        for (const v of variantNames) templateGraphs[v] = loadGraph(join("templates", v, "docs", "skill-graph.json"));
        const projectGraphs: Record<string, SkillGraph | null> = {};
        for (const v of variantNames) projectGraphs[v] = loadedGraphs.get(v) ?? null;
        const structPage = renderStructurePage(buildStructureModel(rootGraph, templateGraphs, projectGraphs, backfill));
        mkdirSync(dirname(structPath), { recursive: true });
        writeFileSync(structPath, structPage);
        const structLine = `🗺 structure page → ${structPath} (${Buffer.byteLength(structPage, "utf8")} bytes)`;
        if (json) console.error(structLine);
        else console.log(structLine);
      } catch (err) {
        console.warn(
          `⚠️ structure page generation failed: ${err instanceof Error ? err.message : String(err)} — snapshot and history page are unaffected`,
        );
      }
    } else {
      console.warn("⚠️ structure page skipped: root graph (docs/skill-graph.json) unavailable this run.");
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
