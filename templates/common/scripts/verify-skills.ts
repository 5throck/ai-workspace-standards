#!/usr/bin/env bun
/**
 * Skill Verification Script
 * @version 1.5.0
 * Verifies all skills in skills/ directory are loadable and properly formatted
 */

import path from "node:path";
import { existsSync, readFileSync, readdirSync } from "node:fs";

const scriptDir = path.dirname(import.meta.path);
export const projectRoot = path.resolve(scriptDir, "..");

/** Flags consumed from argv (U-20261006-002). */
export function parseIndexFlags(argv: string[]): { checkIndex: boolean; writeIndex: boolean; help: boolean } {
  return {
    checkIndex: argv.includes("--check-index"),
    writeIndex: argv.includes("--write-index"),
    help: argv.includes("--help") || argv.includes("-h"),
  };
}

interface SkillCheck {
  name: string;
  path: string;
  status: "PASS" | "FAIL" | "WARN";
  issues: string[];
}

/**
 * Skill metadata for auto-discovery
 * Extracted from frontmatter and content
 */
interface SkillMetadata {
  name: string;
  description: string;
  type: string;
  triggers: string[];
}

/**
 * B-03: Check SKILLS.md for stale 'layer' column in the ## Registry table header.
 * Returns a WARN SkillCheck if the column is found, null otherwise.
 */
async function checkSkillsMdSchema(): Promise<SkillCheck | null> {
  const skillsMdPath = path.join(projectRoot, 'skills', 'SKILLS.md');
  const { existsSync } = await import('node:fs');
  if (!existsSync(skillsMdPath)) return null;

  try {
    const content = await Bun.file(skillsMdPath).text();
    const registryIndex = content.indexOf('## Registry');
    if (registryIndex === -1) return null;

    // Find the first table header line after ## Registry
    const afterRegistry = content.substring(registryIndex);
    const headerMatch = afterRegistry.match(/^\|.+\|/m);
    if (!headerMatch) return null;

    const headerLine = headerMatch[0].toLowerCase();
    if (headerLine.includes('| layer ') || headerLine.includes('| layer|') || headerLine.match(/\|\s*layer\s*\|/)) {
      return {
        name: 'SKILLS.md schema',
        path: skillsMdPath,
        status: 'WARN',
        issues: [
          "SKILLS.md has a stale 'layer' column — this column no longer controls propagation (SKILL.md frontmatter is the SSOT). Run 'bun scripts/upgrade-project.ts <project-path>' to migrate."
        ]
      };
    }
    return null;
  } catch {
    return null;
  }
}

// Catalog sync (2026-08-29, DEC-20260829-02 follow-up): every skills/*/SKILL.md must
// have a Workspace Skills row in skills/SKILLS.md whose version matches frontmatter.
// Workspace-root only: scaffolded projects carry variant-overlay skills that the
// root catalog intentionally does not list.
async function checkSkillsCatalogSync(): Promise<SkillCheck | null> {
  const { existsSync, readdirSync } = await import('node:fs');
  if (!existsSync(path.join(projectRoot, 'templates', 'common'))) return null;
  const skillsMdPath = path.join(projectRoot, 'skills', 'SKILLS.md');
  if (!existsSync(skillsMdPath)) return null;

  const content = await Bun.file(skillsMdPath).text();
  const rows: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const m = line.match(/^\|\s*`([a-z0-9-]+)`\s*\|\s*"?([0-9][0-9.]*)"?\s*\|/);
    if (m) rows[m[1]] = m[2];
  }

  const issues: string[] = [];
  for (const dir of readdirSync(path.join(projectRoot, 'skills'))) {
    const skillMd = path.join(projectRoot, 'skills', dir, 'SKILL.md');
    if (!existsSync(skillMd)) continue;
    const fm = (await Bun.file(skillMd).text()).split('---')[1] ?? '';
    const version = fm.match(/^version:\s*"?([0-9][0-9.]*)"?/m)?.[1];
    if (!version) continue; // frontmatter completeness is validate-skills' domain
    if (!(dir in rows)) {
      issues.push(`skills/SKILLS.md has no row for '${dir}' (frontmatter version ${version}) — add it to the Workspace Skills table`);
    } else if (rows[dir] !== version) {
      issues.push(`skills/SKILLS.md version drift for '${dir}': catalog=${rows[dir]}, SKILL.md=${version} — update the catalog row`);
    }
  }
  if (issues.length === 0) return null;
  return {
    name: 'SKILLS.md catalog sync',
    path: skillsMdPath,
    status: 'FAIL',
    issues,
  };
}

/**
 * L0 ↔ L1 registry parity (T-20261004-021): for a skill rowed in BOTH
 * skills/SKILLS.md and templates/common/skills/SKILLS.md, the version AND the
 * notes/description cell must match. ci-triage's description diverged
 * 2026-10-04 (root gained "; merge-time CI healing loop", common did not) —
 * version-only eyes never see that class. Row shape (both files, 7 columns):
 * | `name` | version | status | owner | last_reviewed | removal-date | notes |
 * Intersection-only: workspace-only and variant-exclusive rows (the L0
 * Variant-Exclusive catalog's 7th column is an owner-variant list, not notes)
 * have no L1 counterpart by DEC-20260829-02 and are skipped naturally.
 */
async function checkRegistryL0L1Parity(): Promise<SkillCheck | null> {
  const l0Path = path.join(projectRoot, 'skills', 'SKILLS.md');
  const l1Path = path.join(projectRoot, 'templates', 'common', 'skills', 'SKILLS.md');
  if (!existsSync(l0Path) || !existsSync(l1Path)) return null;

  const parseRows = async (p: string): Promise<Map<string, { version: string; notes: string }>> => {
    const rows = new Map<string, { version: string; notes: string }>();
    let content = await Bun.file(p).text();
    // The Variant-Exclusive catalog's 7th column is an owner-variant list, not
    // notes — a catalog row (e.g. i18n-audit "co-price only") must never be
    // compared against a same-named L1 common row. Workspace/common tables only.
    const catalogStart = content.match(/^###\s+Variant-Exclusive Skills\b.*(?:\n|$)/m);
    if (catalogStart && catalogStart.index !== undefined) content = content.slice(0, catalogStart.index);
    for (const line of content.split('\n')) {
      if (!/^\|\s*`[a-z0-9-]+`\s*\|/.test(line)) continue; // data rows only (skips header/separator)
      const cells = line.split('|').map((c) => c.trim());
      // leading + trailing splits give 9 cells for a 7-column row
      if (cells.length < 9) continue;
      const name = cells[1].replace(/`/g, '');
      rows.set(name, { version: cells[2], notes: cells[7] });
    }
    return rows;
  };

  const [l0, l1] = await Promise.all([parseRows(l0Path), parseRows(l1Path)]);
  const issues: string[] = [];
  for (const [name, row0] of l0) {
    const row1 = l1.get(name);
    if (!row1) continue; // workspace-only or variant-exclusive — no L1 counterpart by design
    if (row0.version !== row1.version) {
      issues.push(`registry version drift for '${name}': root=${row0.version}, common=${row1.version} — align the two SKILLS.md rows`);
    }
    if (row0.notes !== row1.notes) {
      issues.push(`registry description drift for '${name}': root="${row0.notes}", common="${row1.notes}" — align the two SKILLS.md rows`);
    }
  }
  if (issues.length === 0) return null;
  return {
    name: 'SKILLS.md L0↔L1 parity',
    path: l0Path,
    status: 'FAIL',
    issues,
  };
}

async function main(): Promise<void> {
  console.log("🔍 Verifying Skills\n");

  const checks = await scanSkills();

  // B-03: Check SKILLS.md for stale 'layer' column
  const skillsMdCheck = await checkSkillsMdSchema();
  if (skillsMdCheck) checks.push(skillsMdCheck);

  // Catalog sync: SKILLS.md rows must exist and match frontmatter versions
  const catalogSyncCheck = await checkSkillsCatalogSync();
  if (catalogSyncCheck) checks.push(catalogSyncCheck);

  // T-20261004-021: L0 ↔ L1 registry row parity (version + description)
  const parityCheck = await checkRegistryL0L1Parity();
  if (parityCheck) checks.push(parityCheck);

  for (const check of checks) {
    const icon = check.status === "PASS" ? "✅" : check.status === "WARN" ? "⚠️" : "❌";
    console.log(`${icon} ${check.name}`);
    for (const issue of check.issues) {
      console.log(`   ${issue}`);
    }
  }

  const failed = checks.filter(c => c.status === "FAIL").length;
  const warned = checks.filter(c => c.status === "WARN").length;

  console.log(`\n${checks.length} skills checked`);
  if (failed > 0) {
    console.log(`❌ ${failed} failed`);
    process.exit(1);
  } else if (warned > 0) {
    console.log(`⚠️  ${warned} warnings`);
  } else {
    console.log("✅ All skills verified");
  }

  // Legacy index surface (U-20261006-002): the writer is never implicit.
  // Only a file whose FIRST LINE is exactly "# Skills Index" is generated-format
  // legacy stub — a curated variant index titled "# Skills Index - <variant>"
  // (co-security) or the lifecycle registry ("# SKILLS.md — Skill Lifecycle
  // Registry") is never regenerated. Drift is reported by default (no
  // mutation), gated by --check-index (exit 1), written by --write-index.
  const skillsMdPath = path.join(projectRoot, "skills", "SKILLS.md");
  const onDisk = existsSync(skillsMdPath) ? readFileSync(skillsMdPath, "utf-8") : null;
  if (onDisk === null || isExactLegacyIndex(onDisk)) {
    const generated = renderSkillsIndex(checks);
    const disposition = legacyIndexDisposition(onDisk, generated, parseIndexFlags(process.argv.slice(2)));
    if (disposition.note) console.log(`${disposition.exitCode === 1 ? "⚠️ " : "📝"} ${disposition.note}`);
    if (disposition.write) {
      await Bun.write(skillsMdPath, generated);
      console.log(`📝 Regenerated legacy skills index: ${skillsMdPath}`);
    }
    if (disposition.exitCode !== 0) process.exitCode = disposition.exitCode;
  }
}

async function scanSkills(): Promise<SkillCheck[]> {
  const checks: SkillCheck[] = [];

  // Use native filesystem API for cross-platform compatibility
  async function scanDirectory(dir: string): Promise<string[]> {
    const skillsPath = path.isAbsolute(dir) ? dir : path.join(projectRoot, dir);
    if (!existsSync(skillsPath)) return [];

    // Bun.glob is unavailable in some Bun versions — plain recursive readdir (fixed 2026-08-29)
    // (no encoding option given, so entries are strings — the cast only pins the overload)
    const entries = readdirSync(skillsPath, { recursive: true }) as string[];
    return entries
      .filter((entry) => entry.endsWith("SKILL.md"))
      .map((entry) => path.join(skillsPath, entry));
  }

  const skillFiles = await scanDirectory("skills");
  const commonSkillFiles = await scanDirectory("templates/common/skills");

  for (const skillFile of [...skillFiles, ...commonSkillFiles]) {
    const check = await verifySkill(skillFile);
    checks.push(check);
  }

  // A-03: L1 Orphan Check — L0 skills with l2_propagate: false or scope: workspace
  // must NOT exist in templates/common/skills/
  for (const l0File of skillFiles) {
    try {
      const content = await Bun.file(l0File).text();
      const frontmatterStart = content.indexOf("---");
      const frontmatterEnd = content.indexOf("---", 3);
      if (frontmatterStart === -1 || frontmatterEnd === -1) continue;

      const frontmatter = content.substring(frontmatterStart + 3, frontmatterEnd);

      const l2PropagateMatch = frontmatter.match(/^l2_propagate:\s*(true|false)\b/m);
      const scopeMatch = frontmatter.match(/^scope:\s*(\S+)/m);

      const noPropagate = l2PropagateMatch && l2PropagateMatch[1] === 'false';
      const isWorkspaceScope = scopeMatch && scopeMatch[1].toLowerCase() === 'workspace';

      if (noPropagate || isWorkspaceScope) {
        // Extract skill name from path like .../skills/audit-workspace/SKILL.md
        const skillNameMatch = l0File.match(/skills[/\\]([^/\\]+)[/\\]SKILL\.md$/);
        const skillName = skillNameMatch ? skillNameMatch[1] : null;
        if (!skillName) continue;

        const l1Path = path.join(projectRoot, 'templates', 'common', 'skills', skillName);
        const { existsSync } = await import('node:fs');
        if (existsSync(l1Path)) {
          checks.push({
            name: skillName,
            path: l0File,
            status: 'FAIL',
            issues: [
              `L1 orphan detected: skill has l2_propagate: false or scope: workspace in SKILL.md but exists in templates/common/skills/ — delete templates/common/skills/${skillName}/`
            ]
          });
        }
      }
    } catch {
      // Skip files that cannot be read
    }
  }

  return checks;
}

/**
 * Extract skill metadata for auto-discovery
 * Parses frontmatter and content to generate skill catalog
 */
function extractSkillMetadata(content: string, skillPath: string): SkillMetadata {
  const metadata: SkillMetadata = {
    name: "",
    description: "",
    type: "unknown",
    triggers: []
  };

  // Extract frontmatter
  const frontmatterStart = content.indexOf("---");
  const frontmatterEnd = content.indexOf("---", 3);

  if (frontmatterStart !== -1 && frontmatterEnd !== -1) {
    const frontmatter = content.substring(frontmatterStart + 3, frontmatterEnd);

    const nameMatch = frontmatter.match(/name:\s*(.+)/);
    if (nameMatch) metadata.name = nameMatch[1].trim();

    const descMatch = frontmatter.match(/description:\s*(.+)/);
    if (descMatch) metadata.description = descMatch[1].trim();

    const typeMatch = frontmatter.match(/metadata:\s*\n\s*type:\s*(.+)/);
    if (typeMatch) metadata.type = typeMatch[1].trim();
  }

  // Extract triggers from content
  const triggerMatch = content.match(/(?:## Trigger|When to Use):\s*\n([^#]+)/);
  if (triggerMatch) {
    const triggers = triggerMatch[1].split('\n')
      .map(line => line.trim().replace(/^[-*]\s*/, ''))
      .filter(line => line.length > 0);
    metadata.triggers = triggers;
  }

  return metadata;
}

/**
 * Render the legacy skills index — DETERMINISTIC (U-20261006-002): no
 * wall-clock timestamp, so the rendered bytes only change when the skill set
 * changes and a drift comparison against the file on disk is meaningful.
 */
export function renderSkillsIndex(checks: SkillCheck[]): string {
  let content = "# Skills Index\n\n";
  content += "> Auto-generated by verify-skills.ts. Do not edit manually.\n";
  content += "> Regenerate explicitly: bun scripts/verify-skills.ts --write-index\n";
  content += "> Gate on drift:        bun scripts/verify-skills.ts --check-index\n\n";

  const skillsByType = new Map<string, SkillCheck[]>();

  for (const check of checks) {
    try {
      const fileContent = readFileSync(check.path, "utf-8");
      const metadata = extractSkillMetadata(fileContent, check.path);
      const type = metadata.type || "uncategorized";

      if (!skillsByType.has(type)) {
        skillsByType.set(type, []);
      }
      skillsByType.get(type)!.push(check);
    } catch {
      // Skip files that can't be read
    }
  }

  for (const [type, typeChecks] of skillsByType) {
    content += `## ${type.charAt(0).toUpperCase() + type.slice(1)}\n\n`;
    for (const check of typeChecks) {
      content += `- [${check.name}](skills/${check.name}/SKILL.md)\n`;
    }
    content += "\n";
  }

  return content;
}

/**
 * Exact legacy-index shape (U-20261006-002): the FIRST LINE is exactly
 * "# Skills Index" — the stub this script generates. A curated variant index
 * ("# Skills Index - co-security") or the lifecycle registry
 * ("# SKILLS.md — Skill Lifecycle Registry") is NOT legacy and must never be
 * regenerated by this script.
 */
export function isExactLegacyIndex(content: string): boolean {
  return content.replace(/\r\n/g, "\n").split("\n")[0] === "# Skills Index";
}

export interface IndexFlags {
  checkIndex?: boolean;
  writeIndex?: boolean;
}

/**
 * What to do with a legacy index surface (U-20261006-002). Drift = the file
 * is absent or differs from the deterministic render. Default: report only —
 * the standard battery must never mutate the registry it verifies.
 * --write-index regenerates explicitly; --check-index exits 1 on drift.
 */
export function legacyIndexDisposition(
  onDisk: string | null,
  generated: string,
  flags: IndexFlags,
): { write: boolean; exitCode: 0 | 1; note: string | null } {
  const drifted = onDisk === null || generated !== onDisk.replace(/\r\n/g, "\n");
  if (flags.writeIndex) {
    const note = onDisk === null
      ? "legacy skills index absent — written (--write-index)"
      : drifted
        ? "legacy skills index regenerated (--write-index)"
        : "legacy skills index already up to date (--write-index)";
    return { write: true, exitCode: 0, note };
  }
  if (!drifted) return { write: false, exitCode: 0, note: null };
  const note = onDisk === null
    ? "skills/SKILLS.md is absent — the generated legacy index was NOT written implicitly (use --write-index, or --check-index to gate)"
    : "skills/SKILLS.md is a legacy auto-generated index drifting from the live skill set — NOT rewritten implicitly (use --check-index to gate, --write-index to regenerate)";
  return { write: false, exitCode: flags.checkIndex ? 1 : 0, note };
}

async function verifySkill(skillFile: string): Promise<SkillCheck> {
  const issues: string[] = [];
  let status: "PASS" | "FAIL" | "WARN" = "PASS";

  try {
    const content = await Bun.file(skillFile).text();

    // Check for frontmatter
    if (!content.startsWith("---")) {
      issues.push("Missing frontmatter");
      status = "FAIL";
    } else {
      // Extract frontmatter
      const frontmatterEnd = content.indexOf("---", 3);
      if (frontmatterEnd === -1) {
        issues.push("Invalid frontmatter (missing closing ---)");
        status = "FAIL";
      } else {
        const frontmatter = content.substring(3, frontmatterEnd);

        // Check required fields
        if (!frontmatter.includes("name:")) {
          issues.push("Missing 'name' field");
          status = "FAIL";
        }
        if (!frontmatter.includes("description:")) {
          issues.push("Missing 'description' field");
          status = "WARN";
        }
        if (!frontmatter.includes("metadata:")) {
          issues.push("Missing 'metadata' section");
          status = "WARN";
        }

        // Check l2_propagate field for skills in templates/common/skills/
        if (skillFile.includes('templates/common/skills') || skillFile.includes('templates\\common\\skills')) {
          if (!frontmatter.includes('l2_propagate:')) {
            issues.push('Missing l2_propagate field — add l2_propagate: true or l2_propagate: false to clarify L2 propagation intent');
            if (status !== 'FAIL') status = 'WARN';
          } else {
            const l2Match = frontmatter.match(/^l2_propagate:\s*(true|false)\b/m);
            if (!l2Match) {
              issues.push('Invalid l2_propagate value — must be true or false (boolean, not quoted)');
              if (status !== 'FAIL') status = 'WARN';
            }
          }
        }
      }
    }

    // Check for content after frontmatter
    const contentStart = content.indexOf("---", 3);
    if (contentStart !== -1) {
      const bodyContent = content.substring(contentStart + 3).trim();
      if (bodyContent.length < 50) {
        issues.push("Skill content seems too short");
        status = "WARN";
      }
    }

    const skillName = skillFile.match(/skills\/([^/]+)\//)?.[1] || skillFile;

    return {
      name: skillName,
      path: skillFile,
      status,
      issues
    };
  } catch (error) {
    return {
      name: skillFile,
      path: skillFile,
      status: "FAIL",
      issues: [`Failed to read: ${error}`]
    };
  }
}

if (import.meta.main) {
  await main();
}
