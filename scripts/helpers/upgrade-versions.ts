// @version 1.0.0
// scripts/helpers/upgrade-versions.ts
// Pure version-extraction and frontmatter-merge helpers for upgrade-project.ts.
// Extracted so the version-detection logic is unit-testable (the CLI script's
// top-level imperative body cannot be imported safely).
//
// Usage (in upgrade-project.ts):
//   import { extractScriptVersion, preserveLifecycleFrontmatter } from "./helpers/upgrade-versions.ts";

import { existsSync, readFileSync } from "node:fs";

/**
 * Extract a script's version from its header.
 * Priority: `// @version X.Y.Z` line comment (established convention), then
 * JSDoc block style `* @version X.Y.Z` (used by security-validator.ts, whose
 * version lived in a JSDoc block and was silently never detected — see
 * docs/designs/upgrade-project-content-sync-plan.md §알려진 한계).
 */
export function extractScriptVersion(filePath: string): string {
  if (!existsSync(filePath)) return "";
  const content = readFileSync(filePath, "utf8");
  const lineVersion = content.split("\n").find(l => /^\s*\/\/\s*@version\s+\d/.test(l));
  if (lineVersion) return lineVersion.match(/(\d+\.\d+\.\d+)/)?.[1] ?? "";
  return content.match(/^\s*\*\s*@version\s+(\d+\.\d+\.\d+)/m)?.[1] ?? "";
}

/**
 * Preserve a project-local `lifecycle:` frontmatter block when overwriting an
 * agent with the template version. L3 projects track agent lifecycle governance
 * (phase, created, last_updated, governance → docs/lifecycle/agents/*.md) in
 * frontmatter the template does not carry — a blind overwrite would lose it.
 * Returns template content with the project's lifecycle block re-inserted (or
 * the template content unchanged when the project file has no lifecycle block).
 */
export function preserveLifecycleFrontmatter(tplContent: string, projContent: string): string {
  // Locate the `lifecycle:` key inside the project's YAML frontmatter block.
  const lines = projContent.split("\n");
  const lifecycleIdx = lines.findIndex(l => /^lifecycle:\s*$/.test(l));
  if (lifecycleIdx === -1) return tplContent;

  // Collect the indented keys that belong to the lifecycle block.
  const block: string[] = ["lifecycle:"];
  for (let i = lifecycleIdx + 1; i < lines.length; i++) {
    if (/^\s{2,}\S/.test(lines[i])) block.push(lines[i]);
    else break;
  }
  if (block.length === 1) return tplContent;

  const lifecycleBlock = block.join("\n");
  const tplLines = tplContent.split("\n");
  // Insert before the closing `---` of the template frontmatter.
  let closingIdx = -1;
  for (let i = 1; i < tplLines.length; i++) {
    if (tplLines[i].trim() === "---") { closingIdx = i; break; }
  }
  if (closingIdx === -1) return tplContent;
  tplLines.splice(closingIdx, 0, lifecycleBlock);
  return tplLines.join("\n");
}
