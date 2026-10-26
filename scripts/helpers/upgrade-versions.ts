// @version 1.1.0
// scripts/helpers/upgrade-versions.ts
// Pure version-extraction and frontmatter-merge helpers for upgrade-project.ts.
// Extracted so the version-detection logic is unit-testable (the CLI script's
// top-level imperative body cannot be imported safely).
//
// Usage (in upgrade-project.ts):
//   import { extractScriptVersion, preserveLifecycleFrontmatter, bumpFrontmatterLastUpdated } from "./helpers/upgrade-versions.ts";
//
// v1.1.0 (2026-10-27, U-20261026-009): bumpFrontmatterLastUpdated — the pure
//          re-stamp primitive behind upgrade-project's post-delivery re-stamp
//          step. Template-upgrade deliveries mechanically rewrite agent bodies
//          but never advanced the frontmatter last_updated date, so
//          agent-lifecycle-audit reported stale-date warnings after every
//          upgrade wave (8/9 agent files warned as of 2026-10-26).

import { existsSync, readFileSync } from "node:fs";

/**
 * Extract a script's version from its header.
 * Priority: `// @version X.Y.Z` line comment (established convention), then any
 * other `@version X.Y.Z` occurrence — JSDoc block (` * @version 1.1.0`),
 * inline JSDoc, or mid-line header (` * Level: L0 | Status: active | @version 1.1.0`).
 * Files using these styles (e.g. security-validator.ts, qa-gate.ts,
 * validate-model-registry.ts) were silently treated as "no version" and never
 * synced — see docs/designs/upgrade-project-content-sync-plan.md, Known Limitations.
 */
export function extractScriptVersion(filePath: string): string {
  if (!existsSync(filePath)) return "";
  const content = readFileSync(filePath, "utf8");
  const lineVersion = content.split("\n").find(l => /^\s*\/\/\s*@version\s+\d/.test(l));
  if (lineVersion) return lineVersion.match(/(\d+\.\d+\.\d+)/)?.[1] ?? "";
  return content.match(/@version\s+(\d+\.\d+\.\d+)/)?.[1] ?? "";
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

  // If the template frontmatter already carries a `lifecycle:` block, replace it
  // in place with the project's block. Appending a second block would create a
  // duplicate YAML key — parsers take last-key-wins, silently discarding the
  // project's newer governance data (2026-09-25 co-abap review, finding #1).
  const tplLifecycleIdx = tplLines.findIndex(l => /^lifecycle:\s*$/.test(l));
  if (tplLifecycleIdx !== -1) {
    let tplBlockEnd = tplLifecycleIdx + 1;
    while (tplBlockEnd < tplLines.length && /^\s{2,}\S/.test(tplLines[tplBlockEnd])) tplBlockEnd++;
    tplLines.splice(tplLifecycleIdx, tplBlockEnd - tplLifecycleIdx, ...block);
    return tplLines.join("\n");
  }

  // Insert before the closing `---` of the template frontmatter.
  let closingIdx = -1;
  for (let i = 1; i < tplLines.length; i++) {
    if (tplLines[i].trim() === "---") { closingIdx = i; break; }
  }
  if (closingIdx === -1) return tplContent;
  tplLines.splice(closingIdx, 0, lifecycleBlock);
  return tplLines.join("\n");
}

/**
 * Re-stamp the TOP-LEVEL `last_updated:` key in a markdown file's YAML
 * frontmatter with the delivery date (U-20261026-009). Contract:
 *  - No frontmatter block, or no column-0 `last_updated:` key → unchanged
 *    (bump only where the frontmatter key exists — never inject one).
 *  - Key already equals `date` → unchanged (idempotent).
 *  - Nested keys (e.g. `  last_updated:` inside a `lifecycle:` block) are
 *    NEVER touched — the L3 governance lifecycle block is preserved verbatim
 *    (same scope as preserveLifecycleFrontmatter); only the top-level date
 *    moves, per the ticket evidence (top-level `last_updated` disagrees with
 *    the last delivery commit after every upgrade wave).
 * Returns { text, bumped } — bumped is true only when the output differs.
 */
export function bumpFrontmatterLastUpdated(
  text: string,
  date: string,
): { text: string; bumped: boolean } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { text, bumped: false };
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return { text, bumped: false };
  const lines = fm[1].split("\n");
  let inLifecycle = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^lifecycle:\s*$/.test(line)) { inLifecycle = true; continue; }
    if (inLifecycle) {
      if (/^[^\s#]/.test(line)) inLifecycle = false;
      else continue; // still inside the lifecycle block — leave nested dates alone
    }
    const m = line.match(/^last_updated:(\s*)(\S.*)?$/);
    if (!m) continue;
    if (m[2] === date) return { text, bumped: false };
    lines[i] = `last_updated:${m[1]}${date}`;
    return { text: text.replace(fm[0], `---\n${lines.join("\n")}\n---`), bumped: true };
  }
  return { text, bumped: false };
}
