// @version 1.2.0
// scripts/helpers/upgrade-versions.ts
// Pure version-extraction and frontmatter-merge helpers for upgrade-project.ts.
// Extracted so the version-detection logic is unit-testable (the CLI script's
// top-level imperative body cannot be imported safely).
//
// Usage (in upgrade-project.ts):
//   import { extractScriptVersion, preserveLifecycleFrontmatter, bumpFrontmatterLastUpdated } from "./helpers/upgrade-versions.ts";
//
// v1.2.0 (2026-10-29, spec docs/designs/2026-10-29-delivery-bookkeeping-engine-
//          design.md, DEC-20261029-01): two additions. (A1)
//          bumpNestedLifecycleLastUpdated — the change-date re-stamp primitive
//          for the nested `lifecycle:` block: the v1.1.0 primitive explicitly
//          skipped nested dates, so a version-gated delivery that moved an
//          agent's `version` left `lifecycle.last_updated` honestly wrong
//          (co-abap read-only-analyst.md claimed 2026-10-10 for content the
//          engine changed 2026-10-27) and every wave re-added lifecycle-audit
//          staleness warnings. Mirrors bumpFrontmatterLastUpdated's contract
//          with inverted scope (nested key only; the top-level key,
//          last_reviewed, and the rest of the block are never touched; no
//          injection). (A3) scaffoldChangelogEntry — the pure half of the
//          opt-in --changelog-entry flag: inserts one editable chore(upgrade)
//          bullet at the top of the project CHANGELOG's first [Unreleased]
//          section (creates the section after the title when absent),
//          idempotent per template version.
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

/**
 * Re-stamp the NESTED `last_updated:` key inside a markdown file's `lifecycle:`
 * frontmatter block with the delivery date (spec
 * 2026-10-29-delivery-bookkeeping-engine, design A1 — the change-date half of
 * the DEC-20261029-01 split: `last_updated` means "when the content last
 * changed" and the engine owns it, at the top level (bumpFrontmatterLastUpdated)
 * AND inside the lifecycle block). Contract mirrors bumpFrontmatterLastUpdated
 * with inverted scope:
 *  - No frontmatter block, no column-0 `lifecycle:` block, or no indented
 *    `last_updated:` key inside the block → unchanged (bump only where the key
 *    exists — never injects a key or a block).
 *  - Nested value already equals `date` → unchanged (idempotent).
 *  - ONLY the nested key moves: the top-level `last_updated`, `last_reviewed`,
 *    `created`, `phase`, `governance`, and every other lifecycle key are never
 *    touched; comment lines (`#`) inside the block are skipped.
 * Returns { text, bumped } — bumped is true only when the output differs.
 */
export function bumpNestedLifecycleLastUpdated(
  text: string,
  date: string,
): { text: string; bumped: boolean } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { text, bumped: false };
  const fm = text.match(/^---(\r?\n)([\s\S]*?)\r?\n---/);
  if (!fm) return { text, bumped: false };
  const eol = fm[1]; // the frontmatter's own boundary EOL — reused verbatim on rebuild
  const lines = fm[2].split("\n");
  let inLifecycle = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // CRLF-safe: split("\n") leaves the CR on each line, and `.` in a regex
    // does not match \r — compare and rewrite the CR-stripped line, then
    // re-attach the CR so each line's EOL style survives byte-for-byte.
    const crlf = line.endsWith("\r");
    const bare = crlf ? line.slice(0, -1) : line;
    if (/^lifecycle:\s*$/.test(bare)) { inLifecycle = true; continue; }
    if (!inLifecycle) continue;
    if (/^[^\s#]/.test(bare)) { inLifecycle = false; continue; } // block ended (column-0 key)
    const m = bare.match(/^(\s+)last_updated:(\s*)(\S.*)?$/);
    if (!m) continue; // other lifecycle keys (phase, created, governance, …) stay verbatim
    if (m[3] === date) return { text, bumped: false };
    lines[i] = `${m[1]}last_updated:${m[2]}${date}${crlf ? "\r" : ""}`;
    // Replacer function — a literal replacement (a `$&`/`$'` sequence in some
    // other frontmatter line must not be interpreted as a replace pattern).
    return { text: text.replace(fm[0], () => `---${eol}${lines.join("\n")}${eol}---`), bumped: true };
  }
  return { text, bumped: false };
}

/**
 * Scaffold one editable upgrade entry into a project CHANGELOG's first
 * `## [Unreleased]` section (spec 2026-10-29-delivery-bookkeeping-engine,
 * design A3 — the pure half of upgrade-project's opt-in `--changelog-entry`
 * flag). Contract:
 *  - Entry shape (the fleet's established chore(upgrade) convention):
 *    `- **[<date>]**: chore(upgrade): template sync v<templateVersion> (<n>
 *    file(s) delivered; engine-scaffolded — edit or merge before commit; see
 *    templates/CHANGELOG.md v<templateVersion>)`
 *  - Inserted as the FIRST bullet of the first `## [Unreleased]` section
 *    (prefix match, so `## [Unreleased] 2026-09-01` also matches).
 *  - No `## [Unreleased]` section → one is created after the leading `# `
 *    title block (or at the top when the file has no title).
 *  - Idempotent: a section that already carries a `template sync
 *    v<templateVersion>` line is left unchanged (changed = false).
 *  - CRLF-aware: the file's dominant line ending is preserved.
 *  - Invalid date or empty templateVersion → unchanged.
 * Returns { text, changed } — changed is true only when the output differs.
 */
export function scaffoldChangelogEntry(
  text: string,
  opts: { date: string; templateVersion: string; deliveredCount: number },
): { text: string; changed: boolean } {
  const { date, templateVersion, deliveredCount } = opts;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !templateVersion.trim()) return { text, changed: false };
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const entry = `- **[${date}]**: chore(upgrade): template sync v${templateVersion} (${deliveredCount} file(s) delivered; engine-scaffolded — edit or merge before commit; see templates/CHANGELOG.md v${templateVersion})`;
  const lines = text.split(eol);
  const sectionIdx = lines.findIndex((l) => /^## \[Unreleased\]/.test(l));
  if (sectionIdx !== -1) {
    // Idempotency: an entry for THIS template version already in the section → skip.
    const sectionEnd = lines.findIndex((l, i) => i > sectionIdx && /^## /.test(l));
    const section = lines.slice(sectionIdx + 1, sectionEnd === -1 ? lines.length : sectionEnd);
    if (section.some((l) => l.includes(`template sync v${templateVersion}`))) {
      return { text, changed: false };
    }
    lines.splice(sectionIdx + 1, 0, entry);
    // Keep a blank line between the scaffolded bullet and the following content.
    const after = lines[sectionIdx + 2];
    if (after !== undefined && after.trim() !== "") lines.splice(sectionIdx + 2, 0, "");
    return { text: lines.join(eol), changed: true };
  }
  // No [Unreleased] section — create one after the leading `# ` title block.
  let insertAt = 0;
  if (/^# /.test(lines[0] ?? "")) {
    insertAt = 1;
    while (insertAt < lines.length && lines[insertAt].trim() === "") insertAt++;
  }
  const created = ["## [Unreleased]", "", entry, ""];
  lines.splice(insertAt, 0, ...created);
  // Leave a blank line before the content that followed the title block.
  const next = lines[insertAt + created.length];
  if (next !== undefined && next.trim() !== "") lines.splice(insertAt + created.length, 0, "");
  return { text: lines.join(eol), changed: true };
}
