#!/usr/bin/env bun
/**
 * validate-model-registry.ts
 * Validates that all agents/*.md frontmatter model comments match docs/workspace-schema.json models block.
 * Level: L0 | Status: active | @version 1.0.1
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

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

const PLATFORMS = ["claude", "antigravity", "gemini-cli"] as const;
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
let schema: WorkspaceSchema;
try {
  schema = JSON.parse(readFileSync(schemaPath, "utf-8"));
} catch (err) {
  console.error(`ERROR: Could not read docs/workspace-schema.json at ${schemaPath}`);
  process.exit(1);
}

if (!schema.models) {
  console.error("ERROR: docs/workspace-schema.json is missing the 'models' block.");
  process.exit(1);
}

const missingPlatforms = PLATFORMS.filter((p) => !schema.models![p]);
if (missingPlatforms.length > 0) {
  console.error(`ERROR: workspace-schema.json models block is missing platforms: ${missingPlatforms.join(", ")}`);
  process.exit(1);
}

const models = schema.models as ModelsBlock;

// Step 2: Read all agents/*.md files
const agentsDir = join(WORKSPACE_ROOT, "agents");
let agentFiles: string[];
try {
  agentFiles = readdirSync(agentsDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => join(agentsDir, f));
} catch (err) {
  console.error(`ERROR: Could not read agents directory at ${agentsDir}`);
  process.exit(1);
}

if (agentFiles.length === 0) {
  console.log("✓ No agent files found. Nothing to validate.");
  process.exit(0);
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

if (mismatches.length === 0) {
  console.log("✓ All agent model names match registry");
  process.exit(0);
} else {
  for (const m of mismatches) {
    console.error(
      `ERROR: ${m.file}\n  platform=${m.platform} tier=${m.tier}: declared="${m.declaredModel}" expected="${m.expectedModel}"`
    );
  }
  process.exit(1);
}
