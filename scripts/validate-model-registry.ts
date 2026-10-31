#!/usr/bin/env bun
/**
 * validate-model-registry.ts
 * Validates agent tier declarations (agents/*.md frontmatter) against
 * docs/workspace-schema.json `models`, and that the tier→model mapping prose
 * in AGENTS.md §3.6 / CLAUDE.md / GEMINI.md / CODEX.md names exactly the
 * models the registry declares for each tier.
 * Level: L0 | Status: active | @version 2.3.0
 *
 * v2.3.0 (2026-10-31, T-20261031-004 + T-20261031-007 — spec
 *          docs/designs/2026-10-31-registry-platform-vocabulary-design.md §R2.1
 *          + §R2.4): two vocabulary changes. (1) The delivered-side agent scan
 *          (Step 2 of runModelRegistryValidation) is now a bounded recursive
 *          walk (depth cap 6, `_legacy/`/node_modules/dot-dirs/symlinks
 *          skipped, README excluded at every level) so legacy map-form tier
 *          blocks in nested agent trees (e.g. Projects/co-safety
 *          agents/domains/**) FAIL with kind `legacy-block` — the same closed
 *          v2.1.0 matrix, no new WARN class and no transition period; the
 *          template-side equivalent has been recursive since validate-templates
 *          `agent-quality-recursive` (v1.61.0, T-20261027-001), and
 *          upgrade-project's TIER NORMALIZED pass (v1.75.0, T-20261027-005)
 *          remains the sanctioned healer at the next upgrade visit. (2) zcode
 *          joins PLATFORMS (7 → 8) as a registry-only platform (zai/gemini-cli
 *          precedent): models.zcode mirrors the zai GLM ids (the ZCode harness
 *          resolves models via the zai column), no delivery profile, no
 *          ZCODE.md proseTarget — platform vocabulary per design §R2.4.
 *
 * v2.2.0 (2026-10-28, spec docs/designs/2026-10-28-platform-agent-mirror-design.md,
 *          DEC-20261028-06): PLATFORMS is exported — the platform_surfaces
 *          registry block in docs/workspace-schema.json, its sync-agent-mirrors.ts
 *          coverage guard, and the validate-templates shape check all pin their
 *          platform set to this constant (one code SSOT for the platform
 *          vocabulary; a registry row outside it is a shape-check FAIL). No
 *          validation logic changes.
 *
 * v2.1.0 (2026-10-27, T-20261027-003 — ADR-0102 §5 post-soak transition, design
 *          docs/designs/2026-10-26-model-registry-platform-coverage-design.md
 *          §8.3 step 11): the transition WARN classes retire — legacy
 *          per-platform tier blocks (uniform and mixed) FAIL in both contexts
 *          (kind `legacy-block`), and a missing tier declaration FAILs in
 *          delivered contexts too (kind `missing-tier`; L0 keeps
 *          `missing-tier-l0`). The fleet has converged: zero map-form tier
 *          files remain under templates/ (co-safety's nested
 *          agents/domains/** + agents/_shared/** trees remediated by
 *          T-20261027-001, enforced recursively by validate-templates
 *          `agent-quality-recursive`) and the root agents/ roster is fully
 *          scalar. The TIER COVERAGE WARN summary line and the
 *          coverageWarns/legacyBlockCount/missingTierCount report fields are
 *          retired with them — every tier-coverage finding is now a FAIL that
 *          exits 1. §9 transition matrix is closed: scalar valid → OK;
 *          everything else → FAIL.
 *
 * v2.0.0 (2026-10-26, ADR-0102 / T-20261026-018, design
 *          docs/designs/2026-10-26-model-registry-platform-coverage-design.md
 *          §9): scalar tier declaration + transition matrix. Agent frontmatter
 *          declares ONE scalar `tier: high|medium|low`; the platform→model
 *          mapping is resolved from `models` at dispatch/validation time — no
 *          per-platform tier lines, no `# model-id` comments. Both the silent
 *          skips (`tierBlock.size === 0` / `!entry`) are deleted and replaced
 *          by the §9 matrix: scalar valid → OK; scalar invalid → FAIL; legacy
 *          per-platform block → loud per-file WARN ("normalize to
 *          `tier: <value>`"; mixed blocks WARN without the validator picking a
 *          value); unknown platform key in a legacy block → FAIL; missing tier
 *          → FAIL at L0, WARN in delivered contexts (transition — flips to
 *          FAIL post-soak, design D4). Legacy `# model-id` comments are still
 *          checked against `models[platform][tier]` so nothing regresses while
 *          the fleet converges. The bare ✓ PASS line is suppressed whenever a
 *          coverage WARN exists; a distinct TIER COVERAGE WARN summary prints
 *          instead. Exit 1 only on FAIL conditions — delivered contexts stay
 *          0 during transition (audits green while visibly not-clean).
 *          Refactored into import-safe pure functions
 *          (classifyAgentTier / runModelRegistryValidation) for unit tests.
 *
 * v1.5.0 (design 2026-10-23-zai-tier-floor-support): `hermes` and `zai` join
 * PLATFORMS (5 → 7) so both platforms' registry entries and agent frontmatter
 * model comments are validated; the AGENTS.md §3.6 "distinct" prose target
 * now expects the GLM ids. No validation logic changes.
 *
 * v1.4.0 (T-20260916-011): the CODEX.md prose target is now platform-delivery
 * aware. Projects scaffolded without the codex platform carry neither
 * CODEX.md nor .codex/ (new-project.ts §2.7 strips both), and the
 * unconditional read failed their audit with "could not read CODEX.md".
 * The codex target self-skips with a visible note when the platform is not
 * delivered (shared lib/platform-delivery.ts); L0/L1 contexts, where every
 * target file exists, are behaviorally unchanged.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import { partitionProseTargetsByDelivery } from "./lib/platform-delivery.ts";

const WORKSPACE_ROOT = fileURLToPath(new URL("..", import.meta.url))
  .replace(/\/$/, "")
  .replace(/^\/([A-Z]:)/, "$1");

// Exported since v2.2.0: the platform-vocabulary SSOT consumed by the
// platform_surfaces registry consumers (sync-agent-mirrors coverage guard,
// validate-templates shape check, registry unit tests).
export const PLATFORMS = ["claude", "gemini", "antigravity", "gemini-cli", "codex", "hermes", "zai", "zcode"] as const;
type Platform = typeof PLATFORMS[number];

export const VALID_TIERS = ["high", "medium", "low"] as const;

export interface ModelsBlock {
  [platform: string]: {
    [tier: string]: string;
  };
}

interface WorkspaceSchema {
  models?: ModelsBlock;
}

export interface Mismatch {
  file: string;
  platform: string;
  tier: string;
  declaredModel: string;
  expectedModel: string;
}

export interface ProseMismatch {
  file: string;
  message: string;
}

export interface SkippedTarget {
  file: string;
  label: string;
  reason: string;
}

// ── Tier coverage classification (ADR-0102 §9 matrix) ────────────────────────

export type TierForm =
  | "scalar" // tier: <value> — the normalized ADR-0102 form
  | "legacy-uniform" // per-platform map block, every platform the same value
  | "legacy-mixed" // per-platform map block, values differ (no canonical value)
  | "legacy-unknown-platform" // per-platform map block naming a non-registry platform
  | "missing"; // no tier declaration at all

export interface TierClassification {
  form: TierForm;
  /** The canonical declared tier, when one exists (scalar, or legacy uniform). */
  tier?: string;
  /** scalar form only: whether the declared value is one of high|medium|low. */
  valid?: boolean;
  /** legacy-unknown-platform: the offending platform key. */
  platform?: string;
  /** legacy forms: the raw platform→tier map as declared. */
  block?: Record<string, string>;
}

/**
 * Extract frontmatter block (content between first --- markers).
 */
export function extractFrontmatter(content: string): string | null {
  const lines = content.split("\n");
  if (lines[0].trim() !== "---") return null;

  const endIdx = lines.findIndex((line, i) => i > 0 && line.trim() === "---");
  if (endIdx === -1) return null;

  return lines.slice(1, endIdx).join("\n");
}

/**
 * Parse a legacy per-platform tier block from frontmatter.
 * Looks for:
 *   tier:
 *     claude: high        # claude-opus-4-7
 *     antigravity: high   # gemini-3.1-pro (thinking_level="medium")
 *     gemini-cli: high    # gemini-3.1-pro
 */
export function parseTierBlock(
  frontmatter: string,
): Map<string, { tier: string; modelComment: string | null }> {
  const result = new Map<string, { tier: string; modelComment: string | null }>();
  const lines = frontmatter.split("\n");

  let inTierBlock = false;
  for (const line of lines) {
    if (/^tier\s*:/.test(line)) {
      inTierBlock = true;
      continue;
    }

    if (inTierBlock) {
      // Stop at next top-level key (non-indented, non-empty line)
      if (line.trim() !== "" && !/^\s/.test(line)) {
        inTierBlock = false;
        continue;
      }

      // Match platform line: "  claude: high        # claude-opus-4-7"
      const match = line.match(/^\s+([\w-]+)\s*:\s*(\w+)\s*(?:#\s*(.+))?$/);
      if (match) {
        const platform = match[1];
        const tier = match[2];
        const rawComment = match[3]?.trim() ?? null;

        // Extract just the model name from comment (strip parenthetical annotations)
        let modelComment: string | null = null;
        if (rawComment && rawComment.toLowerCase() !== "inherit") {
          // Grab the first token before any space/parenthesis
          const modelMatch = rawComment.match(/^([\w.-]+)/);
          modelComment = modelMatch ? modelMatch[1] : null;
        }

        result.set(platform, { tier, modelComment });
      }
    }
  }

  return result;
}

/**
 * Classify one agent file's tier declaration per the ADR-0102 §9 matrix.
 * Pure — no I/O, CRLF-tolerant. The platform set comes from the registry's
 * `models` block keys; a legacy block naming anything outside it is a
 * legacy-unknown-platform FAIL.
 */
export function classifyAgentTier(content: string, knownPlatforms: readonly string[]): TierClassification {
  const frontmatter = extractFrontmatter(content);
  if (!frontmatter) return { form: "missing" };

  const lines = frontmatter.split("\n").map((l) => l.replace(/\r$/, ""));
  const tierIdx = lines.findIndex((l) => /^tier\s*:/.test(l));
  if (tierIdx === -1) return { form: "missing" };

  const tierLine = lines[tierIdx];
  const inlineValue = tierLine.replace(/^tier\s*:\s*/, "").trim();

  if (inlineValue !== "") {
    // Scalar form. Tolerate an inline trailing comment (`tier: medium  # note`).
    const value = inlineValue.split("#")[0].trim();
    const valid = (VALID_TIERS as readonly string[]).includes(value);
    return { form: "scalar", tier: value, valid };
  }

  // Legacy per-platform block — reuse the v1 parser (keeps model comments).
  const block = parseTierBlock(frontmatter);
  if (block.size === 0) return { form: "missing" };

  const entries: Record<string, string> = {};
  for (const [platform, entry] of block) entries[platform] = entry.tier;

  const unknown = Object.keys(entries).find((p) => !knownPlatforms.includes(p));
  if (unknown !== undefined) {
    return { form: "legacy-unknown-platform", platform: unknown, block: entries };
  }

  const distinct = new Set(Object.values(entries));
  if (distinct.size > 1) return { form: "legacy-mixed", block: entries };

  const tier = [...distinct][0];
  return { form: "legacy-uniform", tier, block: entries };
}

// ── Coverage findings ─────────────────────────────────────────────────────────

export interface CoverageFail {
  relFile: string;
  kind:
    | "invalid-scalar"
    | "invalid-legacy-value"
    | "unknown-platform"
    | "missing-tier-l0"
    | "legacy-block" // v2.1.0: legacy uniform/mixed blocks FAIL (post-soak flip, T-20261027-003)
    | "missing-tier"; // v2.1.0: missing declaration FAILs in delivered contexts too
  message: string;
}

export interface RegistryWarn {
  relFile: string;
  message: string;
}

export interface ModelRegistryReport {
  /** True when CONSTITUTION.md exists at the audited root (L0 context). */
  isWorkspaceRoot: boolean;
  agentFilesChecked: number;
  /** Fatal registry-level errors (unreadable schema, missing models block). */
  fatal?: string;
  coverageFails: CoverageFail[];
  /** Legacy `# model-id` comment mismatches vs models[platform][tier]. */
  modelMismatches: Mismatch[];
  /** Per-entry registry warns ("no model defined for platform/tier"). */
  registryWarns: RegistryWarn[];
  proseMismatches: ProseMismatch[];
  skippedProseTargets: SkippedTarget[];
}

interface ProseTarget {
  file: string;
  label: string;
  platform: Platform | "distinct";
  pattern: RegExp;
  extract?: (region: string) => string[];
}

const TIER_TO_KEY: Record<string, string> = { High: "high", Medium: "medium", Low: "low" };

// Step 8 targets: tier→model mapping prose blocks (AGENTS.md §3.6 / CLAUDE.md /
// GEMINI.md / CODEX.md) vs the registry. AGENTS.md lists the deduped model set
// per tier across all platforms; the platform docs each list their own column.
// This closes the drift class where a registry model rename leaves the prose
// behind — the exact failure that made the PM tier change non-atomic.
// UNCHANGED in v2.0.0 (design D6 — the prose projects `models`, which is
// untouched by the tier normalization).
export const proseTargets: ProseTarget[] = [
  {
    file: "AGENTS.md",
    label: "§3.6 tier-model-mapping",
    platform: "distinct",
    pattern: /^- \*\*(High|Medium|Low)-tier\*\*.*\(([^)]+)\)$/gm,
    extract: (region) => region.split("/").map((t) => t.trim()),
  },
  {
    file: "CLAUDE.md",
    label: "3-Tier mapping",
    platform: "claude",
    pattern: /^- \*\*(High|Medium|Low)-tier\*\* → ([^\s(]+)/gm,
  },
  {
    file: "GEMINI.md",
    label: "3-Tier mapping",
    platform: "gemini",
    pattern: /^- \*\*(High|Medium|Low)-tier\*\* → ([^\s(]+)/gm,
  },
  {
    file: "CODEX.md",
    label: "3-Tier mapping",
    platform: "codex",
    pattern: /^- \*\*(High|Medium|Low)-tier\*\* → ([^\s(]+)/gm,
  },
];

// ── Recursive agent-tree walk (v2.3.0, T-20261031-004) ───────────────────────

/** Depth cap for the recursive agent scan (relative to agents/, inclusive). */
export const AGENT_WALK_MAX_DEPTH = 6;

/** Directory names never descended into during the agent scan. */
const AGENT_WALK_SKIP_DIRS = new Set(["_legacy", "node_modules"]);

/**
 * Collect every `*.md` file under `agents/` (README* excluded at every level)
 * with a bounded recursive walk: depth cap 6, `_legacy`/node_modules/dot-dirs
 * skipped, symlinks never followed (cycle safety). Exported for tests.
 * Throws when the root directory is unreadable (caller maps that to `fatal`).
 */
export function walkAgentTree(agentsDir: string): string[] {
  const files: string[] = [];
  const walk = (dir: string, depth: number): void => {
    if (depth > AGENT_WALK_MAX_DEPTH) return;
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith(".") || AGENT_WALK_SKIP_DIRS.has(entry.name)) continue;
        walk(full, depth + 1);
      } else if (entry.isFile() && entry.name.endsWith(".md") && !entry.name.startsWith("README")) {
        files.push(full);
      }
    }
  };
  walk(agentsDir, 0);
  return files.sort();
}

/**
 * Full validation run against a workspace root. Import-safe and exit-free:
 * returns the structured report; main() owns printing and the exit code.
 */
export function runModelRegistryValidation(workspaceRoot: string): ModelRegistryReport {
  const report: ModelRegistryReport = {
    isWorkspaceRoot: existsSync(join(workspaceRoot, "CONSTITUTION.md")),
    agentFilesChecked: 0,
    coverageFails: [],
    modelMismatches: [],
    registryWarns: [],
    proseMismatches: [],
    skippedProseTargets: [],
  };

  const rel = (abs: string) => relative(workspaceRoot, abs).replace(/\\/g, "/");

  // Step 1: Load and validate workspace-schema.json
  const schemaPath = join(workspaceRoot, "docs", "workspace-schema.json");
  let schema: WorkspaceSchema;
  try {
    schema = JSON.parse(readFileSync(schemaPath, "utf-8")) as WorkspaceSchema;
  } catch (err) {
    report.fatal = `Could not read docs/workspace-schema.json at ${schemaPath} (${(err as Error).message})`;
    return report;
  }

  if (!schema.models) {
    report.fatal = "docs/workspace-schema.json is missing the 'models' block.";
    return report;
  }

  const missingPlatforms = PLATFORMS.filter((p) => !schema.models![p]);
  if (missingPlatforms.length > 0) {
    report.fatal = `workspace-schema.json models block is missing platforms: ${missingPlatforms.join(", ")}`;
    return report;
  }

  const models = schema.models as ModelsBlock;
  const knownPlatforms = Object.keys(models);

  // Step 2: Read all agents/**/*.md files (v2.3.0, T-20261031-004 — recursive
  // arm). Bounded walk, depth cap 6 below agents/; `_legacy/`, node_modules,
  // dot-directories and symlinks are skipped; README* is excluded at every
  // level (not an agent). Nested legacy map-form tier blocks now FAIL with the
  // same closed v2.1.0 matrix as top-level files.
  const agentsDir = join(workspaceRoot, "agents");
  let agentFiles: string[];
  try {
    agentFiles = walkAgentTree(agentsDir);
  } catch (err) {
    report.fatal = `Could not read agents directory at ${agentsDir} (${(err as Error).message})`;
    return report;
  }

  if (agentFiles.length === 0) {
    // Nothing to classify; prose targets still validated below.
  }
  report.agentFilesChecked = agentFiles.length;

  // Step 3: Classify each agent file per the §9 matrix.
  for (const filePath of agentFiles) {
    const relFile = rel(filePath);
    let content: string;
    try {
      content = readFileSync(filePath, "utf-8");
    } catch (err) {
      report.coverageFails.push({
        relFile,
        kind: "missing-tier-l0",
        message: `${relFile}: could not be read (${(err as Error).message})`,
      });
      continue;
    }

    const cls = classifyAgentTier(content, knownPlatforms);

    switch (cls.form) {
      case "scalar": {
        if (!cls.valid) {
          report.coverageFails.push({
            relFile,
            kind: "invalid-scalar",
            message: `${relFile}: tier '${cls.tier}' is not one of high/medium/low — declare 'tier: <high|medium|low>' (ADR-0102)`,
          });
        }
        // Valid scalar → OK. Ruling 2 (2026-10-26): the former L0 parity row
        // against schema agent_tiers is RETIRED — the frontmatter scalar IS
        // the declaration; agent_tiers is gone from the schema.
        break;
      }
      case "legacy-uniform": {
        if (!(VALID_TIERS as readonly string[]).includes(cls.tier ?? "")) {
          report.coverageFails.push({
            relFile,
            kind: "invalid-legacy-value",
            message: `${relFile}: legacy tier block declares '${cls.tier}', which is not one of high/medium/low — normalize to 'tier: <high|medium|low>' (ADR-0102)`,
          });
          break;
        }
        report.coverageFails.push({
          relFile,
          kind: "legacy-block",
          message: `${relFile}: legacy per-platform tier block — normalize to 'tier: ${cls.tier}' (ADR-0102; post-soak flip T-20261027-003: legacy blocks FAIL, the transition WARN retired)`,
        });
        runLegacyModelCommentCheck(relFile, withComments(cls.block ?? {}, content), models, report);
        break;
      }
      case "legacy-mixed": {
        const detail = Object.entries(cls.block ?? {})
          .map(([p, t]) => `${p}: ${t}`)
          .join(", ");
        report.coverageFails.push({
          relFile,
          kind: "legacy-block",
          message: `${relFile}: legacy per-platform tier block with mixed values (${detail}) — normalize to one scalar 'tier: <high|medium|low>' (the validator does not pick a value; ADR-0102)`,
        });
        runLegacyModelCommentCheck(relFile, withComments(cls.block ?? {}, content), models, report);
        break;
      }
      case "legacy-unknown-platform": {
        report.coverageFails.push({
          relFile,
          kind: "unknown-platform",
          message: `${relFile}: legacy tier block declares platform '${cls.platform}', which is not in the registry models block (platforms: ${knownPlatforms.join(", ")})`,
        });
        break;
      }
      case "missing": {
        if (report.isWorkspaceRoot) {
          report.coverageFails.push({
            relFile,
            kind: "missing-tier-l0",
            message: `${relFile}: no tier declaration — add 'tier: <high|medium|low>' (ADR-0102; required at the workspace root)`,
          });
        } else {
          // v2.1.0 (T-20261027-003): the delivered-context transition WARN
          // retired — the fleet converged, so a missing declaration FAILs.
          report.coverageFails.push({
            relFile,
            kind: "missing-tier",
            message: `${relFile}: no tier declaration — add 'tier: <high|medium|low>' (ADR-0102)`,
          });
        }
        break;
      }
    }
  }

  // Step 4: Tier→model mapping prose targets. T-20260916-011: skip targets
  // whose platform/file was not delivered into this context (a codex-opt-out
  // project has neither CODEX.md nor .codex/). Skipped targets are surfaced,
  // never silent.
  const { active: deliveredTargets, skipped: skippedTargets } = partitionProseTargetsByDelivery(
    proseTargets,
    (relPath) => existsSync(join(workspaceRoot, relPath)),
  );
  report.skippedProseTargets = skippedTargets;

  for (const target of deliveredTargets) {
    const filePath = join(workspaceRoot, target.file);
    let content: string;
    try {
      content = readFileSync(filePath, "utf-8");
    } catch {
      report.proseMismatches.push({ file: target.file, message: `could not read ${target.file}` });
      continue;
    }

    const declared: Record<string, string[]> = {};
    for (const match of content.matchAll(target.pattern)) {
      const tierKey = TIER_TO_KEY[match[1]];
      const ids = target.extract
        ? target.extract(match[2]).filter((t) => /^[\w.-]+$/.test(t))
        : [match[2].replace(/`/g, "").trim()];
      declared[tierKey] = ids;
    }

    for (const tier of ["high", "medium", "low"]) {
      const declaredIds = declared[tier];
      if (!declaredIds || declaredIds.length === 0) {
        report.proseMismatches.push({
          file: target.file,
          message: `no tier→model line found for ${tier} tier (${target.label})`,
        });
        continue;
      }
      const expectedIds =
        target.platform === "distinct"
          ? [...new Set(PLATFORMS.map((p) => models[p]?.[tier]).filter(Boolean))].sort()
          : [models[target.platform]?.[tier]].filter((m): m is string => Boolean(m)).sort();
      const declaredSorted = [...declaredIds].sort();
      const matches =
        declaredSorted.length === expectedIds.length &&
        declaredSorted.every((id, i) => id === expectedIds[i]);
      if (!matches) {
        report.proseMismatches.push({
          file: target.file,
          message: `${tier} tier declares [${declaredIds.join(", ")}] but registry says [${expectedIds.join(", ")}] (${target.label})`,
        });
      }
    }
  }

  return report;
}

/**
 * Transition-period legacy check (v1.5.0 behavior, kept for legacy blocks):
 * a `# model-id` comment must match models[platform][tier]. Scalar files have
 * no comments — nothing to check (the model is the registry's, not the
 * agent's, per ADR-0102).
 */
function runLegacyModelCommentCheck(
  relFile: string,
  block: Record<string, { tier: string; modelComment: string | null }>,
  models: ModelsBlock,
  report: ModelRegistryReport,
): void {
  for (const [platform, entry] of Object.entries(block)) {
    const { tier, modelComment } = entry;

    // Skip if no model comment or uses inherit keyword
    if (!modelComment || modelComment.toLowerCase() === "inherit") continue;

    const expectedModel = models[platform]?.[tier];
    if (!expectedModel) {
      report.registryWarns.push({
        relFile,
        message: `No model defined in registry for platform=${platform} tier=${tier} (${relFile})`,
      });
      continue;
    }

    if (modelComment !== expectedModel) {
      report.modelMismatches.push({
        file: relFile,
        platform,
        tier,
        declaredModel: modelComment,
        expectedModel,
      });
    }
  }
}

// Type-compat shim: classifyAgentTier hands the raw map through as
// Record<string, string>; the comment check wants the v1 entry shape. Convert
// by re-parsing the block once (comments only exist on legacy files).
function withComments(
  block: Record<string, string>,
  frontmatter: string,
): Record<string, { tier: string; modelComment: string | null }> {
  const parsed = parseTierBlock(frontmatter);
  const out: Record<string, { tier: string; modelComment: string | null }> = {};
  for (const platform of Object.keys(block)) {
    const entry = parsed.get(platform);
    out[platform] = entry ?? { tier: block[platform], modelComment: null };
  }
  return out;
}

// ── Report printing + exit code ───────────────────────────────────────────────

/**
 * Print the §9 report shape. Exported for tests: the bare ✓ PASS line is
 * printed ONLY when no coverage WARN exists — otherwise the distinct TIER
 * COVERAGE WARN summary prints instead.
 */
export function printReport(report: ModelRegistryReport): void {
  for (const s of report.skippedProseTargets) {
    console.log(`ℹ️  ${s.file} ${s.label}: skipped (${s.reason})`);
  }
  for (const w of report.registryWarns) {
    console.warn(`WARN: ${w.message}`);
  }
  for (const f of report.coverageFails) {
    console.error(`ERROR: ${f.message}`);
  }
  for (const m of report.modelMismatches) {
    console.error(
      `ERROR: ${m.file}\n  platform=${m.platform} tier=${m.tier}: declared="${m.declaredModel}" expected="${m.expectedModel}"`,
    );
  }
  for (const p of report.proseMismatches) {
    console.error(`ERROR: ${p.file}: ${p.message}`);
  }

  if (report.fatal) {
    console.error(`ERROR: ${report.fatal}`);
    return;
  }

  // v2.1.0 (T-20261027-003): the TIER COVERAGE WARN summary retired with the
  // transition WARN classes — every tier-coverage finding is a coverageFail
  // printed as ERROR above; a run either prints the bare ✓ PASS line or FAILs.

  if (
    report.coverageFails.length === 0 &&
    report.modelMismatches.length === 0 &&
    report.proseMismatches.length === 0
  ) {
    console.log("✓ All agent model names + tier→model mapping prose match registry");
  }
}

function main(): void {
  const report = runModelRegistryValidation(WORKSPACE_ROOT);
  printReport(report);

  const failed =
    report.fatal !== undefined ||
    report.coverageFails.length > 0 ||
    report.modelMismatches.length > 0 ||
    report.proseMismatches.length > 0;
  process.exit(failed ? 1 : 0);
}

if (import.meta.main) {
  main();
}
