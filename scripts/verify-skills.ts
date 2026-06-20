#!/usr/bin/env bun
/**
 * Skill Verification Script
 * @version 1.2.0
 * Verifies all skills in skills/ directory are loadable and properly formatted
 */

import path from "node:path";

const scriptDir = path.dirname(import.meta.path);
const projectRoot = path.resolve(scriptDir, "..");

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

async function main(): Promise<void> {
  console.log("🔍 Verifying Skills\n");

  const checks = await scanSkills();

  // B-03: Check SKILLS.md for stale 'layer' column
  const skillsMdCheck = await checkSkillsMdSchema();
  if (skillsMdCheck) checks.push(skillsMdCheck);

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

  // Generate skills index
  await generateSkillsIndex(checks);
}

async function scanSkills(): Promise<SkillCheck[]> {
  const checks: SkillCheck[] = [];

  // Use native filesystem API for cross-platform compatibility
  async function scanDirectory(dir: string): Promise<string[]> {
    const files: string[] = [];
    const skillsPath = path.isAbsolute(dir) ? dir : path.join(projectRoot, dir);

    for await (const entry of Bun.glob(`${skillsPath}/**/*`)) {
      if (entry.endsWith("SKILL.md")) {
        files.push(entry);
      }
    }
    return files;
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
 * Generate SKILLS.md index from discovered skills
 */
async function generateSkillsIndex(checks: SkillCheck[]): Promise<void> {
  const indexPath = path.join(projectRoot, "skills", "SKILLS.md");
  let content = "# Skills Index\n\n";
  content += "> Auto-generated by verify-skills.ts. Do not edit manually.\n\n";
  content += `Generated: ${new Date().toISOString()}\n\n`;

  const skillsByType = new Map<string, SkillCheck[]>();

  for (const check of checks) {
    try {
      const fileContent = await Bun.file(check.path).text();
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

  await Bun.write(indexPath, content);
  console.log(`\n📝 Generated skills index: ${indexPath}`);
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

main();
