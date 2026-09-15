#!/usr/bin/env bun
/**
 * validate-model-registry.ts
 * Validates that all agents/*.md frontmatter model comments match docs/workspace-schema.json models block,
 * and that the tier→model mapping prose in AGENTS.md §3.6 / CLAUDE.md / GEMINI.md / CODEX.md
 * names exactly the models the registry declares for each tier.
 * Level: L0 | Status: active | @version 1.3.0
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { die } from "./lib/error-handling.ts";

const WORKSPACE_ROOT = new URL("..", import.meta.url).pathname
  .replace(/\/$/, "")
  .replace(/^\/([A-Z]:)/, "$1");

interface ModelsBlock {
  [platform: string]: {
    [tier: string]: string;
  };
}

interface WorkspaceSchema {
  models?: ModelsBlock;
}

interface Mismatch {
  file: string;
  platform: string;
  tier: string;
  declaredModel: string;
  expectedModel: string;
}

const PLATFORMS = ["claude", "gemini", "antigravity", "gemini-cli", "codex"] as const;
type Platform = typeof PLATFORMS[number];

/**
 * Extract frontmatter block (content between first --- markers).
 */
function extractFrontmatter(content: string): string | null {
  const lines = content.split("\n");
  if (lines[0].trim() !== "---") return null;

  const endIdx = lines.findIndex((line, i) => i > 0 && line.trim() === "---");
  if (endIdx === -1) return null;

  return lines.slice(1, endIdx).join("\n");
}

/**
 * Parse the tier block from frontmatter.
 * Looks for:
 *   tier:
 *     claude: high        # claude-opus-4-7
 *     antigravity: high   # gemini-3.1-pro (thinking_level="medium")
 *     gemini-cli: high    # gemini-3.1-pro
 */
function parseTierBlock(frontmatter: string): Map<string, { tier: string; modelComment: string | null }> {
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

// --- Main ---

// Step 1: Load and validate workspace-schema.json
const schemaPath = join(WORKSPACE_ROOT, "docs", "workspace-schema.json");
// Definite-assignment assertions: `die()` exits in main mode; in module mode the
// else-branch only logs and falls through exactly as before (a later property
// access throws, unchanged from the prior runtime behavior).
let schema!: WorkspaceSchema;
try {
  schema = JSON.parse(readFileSync(schemaPath, "utf-8"));
} catch (err) {
  if (import.meta.main) {
    die(`Could not read docs/workspace-schema.json at ${schemaPath}`, 1);
  } else {
    console.error(`ERROR: Could not read docs/workspace-schema.json at ${schemaPath}`);
  }
}

if (!schema.models) {
  if (import.meta.main) {
    die("docs/workspace-schema.json is missing the 'models' block.", 1);
  } else {
    console.error("ERROR: docs/workspace-schema.json is missing the 'models' block.");
  }
}

const missingPlatforms = PLATFORMS.filter((p) => !schema.models![p]);
if (missingPlatforms.length > 0) {
  if (import.meta.main) {
    die(`workspace-schema.json models block is missing platforms: ${missingPlatforms.join(", ")}`, 1);
  } else {
    console.error(`ERROR: workspace-schema.json models block is missing platforms: ${missingPlatforms.join(", ")}`);
  }
}

const models = schema.models as ModelsBlock;

// Step 2: Read all agents/*.md files
const agentsDir = join(WORKSPACE_ROOT, "agents");
let agentFiles!: string[]; // see note above on definite-assignment assertions
try {
  agentFiles = readdirSync(agentsDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => join(agentsDir, f));
} catch (err) {
  if (import.meta.main) {
    die(`Could not read agents directory at ${agentsDir}`, 1);
  } else {
    console.error(`ERROR: Could not read agents directory at ${agentsDir}`);
  }
}

if (agentFiles.length === 0) {
  console.log("✓ No agent files found. Nothing to validate.");
  if (import.meta.main) {
    process.exit(0);
  }
}

// Step 3-7: Validate each agent
const mismatches: Mismatch[] = [];

for (const filePath of agentFiles) {
  const content = readFileSync(filePath, "utf-8");
  const frontmatter = extractFrontmatter(content);

  if (!frontmatter) continue;

  const tierBlock = parseTierBlock(frontmatter);
  if (tierBlock.size === 0) continue;

  for (const platform of PLATFORMS) {
    const entry = tierBlock.get(platform);
    if (!entry) continue;

    const { tier, modelComment } = entry;

    // Skip if no model comment or uses inherit keyword
    if (!modelComment || modelComment.toLowerCase() === "inherit") continue;

    const expectedModel = models[platform]?.[tier];
    if (!expectedModel) {
      console.warn(`WARN: No model defined in registry for platform=${platform} tier=${tier} (${filePath})`);
      continue;
    }

    if (modelComment !== expectedModel) {
      mismatches.push({
        file: filePath,
        platform,
        tier,
        declaredModel: modelComment,
        expectedModel,
      });
    }
  }
}

// Step 8: Tier→model mapping prose blocks (AGENTS.md §3.6 / CLAUDE.md / GEMINI.md / CODEX.md)
// vs the registry. AGENTS.md lists the deduped model set per tier across all
// platforms; the platform docs each list their own column. This closes the
// drift class where a registry model rename leaves the prose behind — the
// exact failure that made the PM tier change non-atomic.
interface ProseTarget {
  file: string;
  label: string;
  platform: Platform | "distinct";
  pattern: RegExp;
  extract?: (region: string) => string[];
}

const TIER_TO_KEY: Record<string, string> = { High: "high", Medium: "medium", Low: "low" };

const proseTargets: ProseTarget[] = [
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

interface ProseMismatch {
  file: string;
  message: string;
}
const proseMismatches: ProseMismatch[] = [];

for (const target of proseTargets) {
  const filePath = join(WORKSPACE_ROOT, target.file);
  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    proseMismatches.push({ file: target.file, message: `could not read ${target.file}` });
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
      proseMismatches.push({
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
      proseMismatches.push({
        file: target.file,
        message: `${tier} tier declares [${declaredIds.join(", ")}] but registry says [${expectedIds.join(", ")}] (${target.label})`,
      });
    }
  }
}

if (mismatches.length === 0 && proseMismatches.length === 0) {
  console.log("✓ All agent model names + tier→model mapping prose match registry");
  if (import.meta.main) {
    process.exit(0);
  }
} else {
  for (const m of mismatches) {
    console.error(
      `ERROR: ${m.file}\n  platform=${m.platform} tier=${m.tier}: declared="${m.declaredModel}" expected="${m.expectedModel}"`
    );
  }
  for (const p of proseMismatches) {
    console.error(`ERROR: ${p.file}: ${p.message}`);
  }
  if (import.meta.main) {
    process.exit(1);
  }
}
