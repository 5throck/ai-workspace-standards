/**
 * @file team-builder.ts
 * @description Agent team builder script — execution layer for the team-builder skill.
 *   Receives an approved proposal JSON (from skills/team-builder/SKILL.md Step 5) and
 *   executes all agent/skill changes in a fixed, safe order with checkpoint logging.
 * @version 1.2.0
 * @usage bun scripts/team-builder.ts <proposal-json-path> [--dry-run]
 */

import { existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";

// ─── ANSI Colors ────────────────────────────────────────────────────────────

const G = "\x1b[32m"; // green
const Y = "\x1b[33m"; // yellow
const R = "\x1b[31m"; // red
const C = "\x1b[36m"; // cyan
const Z = "\x1b[0m";  // reset

// ─── Interfaces ─────────────────────────────────────────────────────────────

interface AgentToCreate {
  name: string;
  formalName: string;
  tier: { claude: string; gemini?: string; antigravity?: string; "gemini-cli"?: string };
  color: string;
  description: string;
  phases: string[];
  handoffTo: string[];
  handoffFrom: string[];
  requiredSkills: string[];
  rationale: string;
}

interface AgentToConvert {
  currentFile: string;
  newFile: string;
  newFormalName: string;
  roleChanges: string;
  skillsRetained: string[];
  skillsReplaced: string[];
}

interface AgentToDelete {
  name: string;
  skillsToTransfer: Array<{ skill: string; newOwner: string }>;
  rationale: string;
}

interface SkillToCreate {
  name: string;
  owner: string;
  description: string;
  prerequisites: string[];
}

interface SkillToModify {
  name: string;
  changes: string;
}

interface SkillToReassign {
  skill: string;
  fromOwner: string;
  toOwner: string;
}

interface WorkflowPhase {
  phase: string;
  name: string;
  lead: string;
  supporting: string[];
}

interface TeamBuilderProposal {
  version: string;
  timestamp: string;
  teamName: string;
  benchmarkSources: string[];
  changes: {
    agentsToCreate: AgentToCreate[];
    agentsToConvert: AgentToConvert[];
    agentsToDelete: AgentToDelete[];
    skillsToCreate: SkillToCreate[];
    skillsToModify: SkillToModify[];
    skillsToReassign: SkillToReassign[];
    workflowPhases: WorkflowPhase[];
  };
  changeHistoryEntry: string;
  approvedBy: string;
  approvedAt: string;
}

function validateProposal(obj: unknown): { valid: true; proposal: TeamBuilderProposal } | { valid: false; errors: string[] } {
  const errors: string[] = [];
  if (typeof obj !== "object" || obj === null) {
    return { valid: false, errors: ["Root value must be an object"] };
  }
  const p = obj as Record<string, unknown>;

  if (typeof p.version !== "string")       errors.push("Missing or invalid field: version (string)");
  if (typeof p.timestamp !== "string")     errors.push("Missing or invalid field: timestamp (string)");
  if (typeof p.teamName !== "string")      errors.push("Missing or invalid field: teamName (string)");
  if (!Array.isArray(p.benchmarkSources))  errors.push("Missing or invalid field: benchmarkSources (array)");
  if (typeof p.approvedBy !== "string")    errors.push("Missing or invalid field: approvedBy (string)");
  if (typeof p.approvedAt !== "string")    errors.push("Missing or invalid field: approvedAt (string)");

  if (typeof p.changes !== "object" || p.changes === null) {
    errors.push("Missing or invalid field: changes (object)");
  } else {
    const c = p.changes as Record<string, unknown>;
    for (const key of [
      "agentsToCreate", "agentsToConvert", "agentsToDelete",
      "skillsToCreate", "skillsToModify", "skillsToReassign", "workflowPhases",
    ]) {
      if (!Array.isArray(c[key])) errors.push(`changes.${key} must be an array`);
    }
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, proposal: obj as TeamBuilderProposal };
}

interface Checkpoint {
  step: number;
  label: string;
  status: "pending" | "done" | "skipped";
  timestamp?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CWD = process.cwd();
const CHECKPOINT_FILE = join(CWD, "memory", ".team-builder-checkpoint.json");

const STEP_DEFS: Omit<Checkpoint, "status">[] = [
  { step: 6,  label: "Pre-conditions check" },
  { step: 7,  label: "Proactive skill transfer (reassign skills before deletion)" },
  { step: 8,  label: "Delete agents" },
  { step: 9,  label: "Convert agents (rename files + update frontmatter)" },
  { step: 10, label: "Create new agents" },
  { step: 11, label: "Update AGENTS.md" },
  { step: 12, label: "Update workflow documentation" },
  { step: 13, label: "Modify existing skills" },
  { step: 14, label: "Create new skills" },
  { step: 15, label: "Run final validation gate" },
  { step: 16, label: "Record change history in memory/" },
];

// ─── Checkpoint helpers ───────────────────────────────────────────────────────

function initCheckpoints(): Checkpoint[] {
  return STEP_DEFS.map((s) => ({ ...s, status: "pending" as const }));
}

function loadCheckpoints(): Checkpoint[] {
  if (existsSync(CHECKPOINT_FILE)) {
    try {
      const raw = Bun.file(CHECKPOINT_FILE).textSync();
      return JSON.parse(raw) as Checkpoint[];
    } catch {
      return initCheckpoints();
    }
  }
  return initCheckpoints();
}

async function saveCheckpoints(checkpoints: Checkpoint[]): Promise<void> {
  const dir = dirname(CHECKPOINT_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  await Bun.write(CHECKPOINT_FILE, JSON.stringify(checkpoints, null, 2));
}

function markDone(checkpoints: Checkpoint[], step: number): void {
  const cp = checkpoints.find((c) => c.step === step);
  if (cp) {
    cp.status = "done";
    cp.timestamp = new Date().toISOString();
  }
}

function isDone(checkpoints: Checkpoint[], step: number): boolean {
  return checkpoints.find((c) => c.step === step)?.status === "done";
}

// ─── Shell helpers ────────────────────────────────────────────────────────────

function run(cmd: string): { success: boolean; stdout: string; stderr: string } {
  const parts = cmd.split(" ");
  const result = Bun.spawnSync(parts, { cwd: CWD });
  return {
    success: result.exitCode === 0,
    stdout: result.stdout ? new TextDecoder().decode(result.stdout) : "",
    stderr: result.stderr ? new TextDecoder().decode(result.stderr) : "",
  };
}

// ─── File helpers ─────────────────────────────────────────────────────────────

async function readFile(path: string): Promise<string> {
  return await Bun.file(path).text();
}

async function writeFile(path: string, content: string): Promise<void> {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  await Bun.write(path, content);
}

function deleteFile(path: string): void {
  const { unlink } = require("fs");
  try { unlink.call(null, path, () => {}); } catch {}
  // use sync delete
  const { unlinkSync } = require("fs");
  try { unlinkSync(path); } catch {}
}

// ─── Template generators ──────────────────────────────────────────────────────

function generateAgentMd(a: AgentToCreate): string {
  const claudeTier      = a.tier.claude;
  const geminiTier      = a.tier.gemini        ?? a.tier.claude;
  const antigravityTier = a.tier.antigravity   ?? a.tier.claude;
  const geminiCliTier   = a.tier["gemini-cli"] ?? a.tier.claude;
  const phasesYaml = a.phases.map((p) => `  - "${p}"`).join("\n");
  const handoffToYaml = a.handoffTo.length
    ? a.handoffTo.map((h) => `  - ${h}`).join("\n")
    : "  []";
  const handoffFromYaml = a.handoffFrom.length
    ? a.handoffFrom.map((h) => `  - ${h}`).join("\n")
    : "  []";
  const requiredSkillsYaml = a.requiredSkills.length
    ? a.requiredSkills.map((s) => `  - ${s}`).join("\n")
    : "  []";
  const phasesInline = a.phases.join(", ");

  return `---
name: ${a.name}
status: active
formal_name: ${a.formalName}
tier:
  claude: ${claudeTier}
  gemini: ${geminiTier}
  antigravity: ${antigravityTier}
  gemini-cli: ${geminiCliTier}
model: inherit
color: ${a.color}
description: >
  ${a.description}
phases:
${phasesYaml}
handoff_to:
${handoffToYaml}
handoff_from:
${handoffFromYaml}
required_skills:
${requiredSkillsYaml}
---

## Role

You are the ${a.formalName} for **co-consult**. [Role description to be customized after generation.]

## Core Responsibilities

- [Responsibility 1]
- [Responsibility 2]
- [Responsibility 3]

## Meeting Participation

In a \`/meeting\` session, Claude role-plays you inline.

**Voice & Stance:** [Define voice and stance]

## Dispatch Protocol

**Can Lead Phases**: ${phasesInline}
**Can Support In**: []
**Auto-Dispatch To**: N/A
**Tier**: ${claudeTier}
**Communication Style**: async
`;
}

function generateSkillMd(s: SkillToCreate): string {
  const prereqs = s.prerequisites.length ? s.prerequisites.join(", ") : "none";
  return `---
name: ${s.name}
description: >
  ${s.description}
version: 1.0.0
status: active
owner: ${s.owner}
prerequisites: ${prereqs}
---

## Context

[Describe when and why to use this skill]

## When to Use

- [Trigger condition 1]
- [Trigger condition 2]

## Execution Steps

1. [Step 1]
2. [Step 2]

## Output Format

- [Output description]

## Related Skills

- [Related skill names]
`;
}

// ─── Step 6: Pre-conditions ───────────────────────────────────────────────────

async function checkPreconditions(
  proposal: TeamBuilderProposal,
  skipChecks: boolean
): Promise<boolean> {
  if (skipChecks) {
    console.log(`${Y}[WARN] --skip-checks active: bypassing pre-condition checks.${Z}`);
    return true;
  }

  let ok = true;

  // 1. Git working tree clean
  const git = run("git status --porcelain");
  if (!git.success || git.stdout.trim() !== "") {
    console.error(`${R}[FAIL] Git working tree is not clean. Commit or stash changes first.${Z}`);
    if (git.stdout.trim()) console.error(git.stdout.trim());
    ok = false;
  } else {
    console.log(`${G}[PASS] Git working tree is clean.${Z}`);
  }

  // 2. Audit passes
  const audit = run("bun scripts/audit.ts");
  if (!audit.success) {
    console.error(`${R}[FAIL] bun scripts/audit.ts failed. Fix issues before running team-builder.${Z}`);
    if (audit.stdout.trim()) console.error(audit.stdout.slice(0, 500));
    ok = false;
  } else {
    console.log(`${G}[PASS] bun scripts/audit.ts passed.${Z}`);
  }

  // 3. Proposal has approvedBy and approvedAt
  if (!proposal.approvedBy || !proposal.approvedAt) {
    console.error(`${R}[FAIL] Proposal is missing approvedBy or approvedAt fields.${Z}`);
    ok = false;
  } else {
    console.log(`${G}[PASS] Proposal approved by ${proposal.approvedBy} at ${proposal.approvedAt}.${Z}`);
  }

  // 4. Proposal version
  if (proposal.version !== "1.0.0") {
    console.error(`${R}[FAIL] Proposal version must be "1.0.0", got "${proposal.version}".${Z}`);
    ok = false;
  } else {
    console.log(`${G}[PASS] Proposal version is 1.0.0.${Z}`);
  }

  return ok;
}

// ─── Step 7: Proactive skill transfer ────────────────────────────────────────

async function proactiveSkillTransfer(
  proposal: TeamBuilderProposal
): Promise<void> {
  const transfers: SkillToReassign[] = [];

  // Gather transfers from deletions
  for (const del of proposal.changes.agentsToDelete) {
    for (const t of del.skillsToTransfer) {
      transfers.push({
        skill: t.skill,
        fromOwner: del.name,
        toOwner: t.newOwner,
      });
    }
  }

  // Merge explicit reassignments
  for (const r of proposal.changes.skillsToReassign) {
    transfers.push(r);
  }

  if (transfers.length === 0) {
    console.log(`  No skill transfers required.`);
    return;
  }

  for (const t of transfers) {
    const skillDir = join(CWD, "skills", t.skill);
    const skillFile = join(skillDir, "SKILL.md");
    if (!existsSync(skillFile)) {
      console.log(`  ${Y}[WARN] Skill file not found for "${t.skill}", skipping transfer.${Z}`);
      continue;
    }
    let content = await readFile(skillFile);
    content = content.replace(/^owner: .+$/m, `owner: ${t.toOwner}`);
    await writeFile(skillFile, content);
    console.log(`  Reassigned skill "${t.skill}" from ${t.fromOwner} → ${t.toOwner}`);
  }
}

// ─── Step 8: Delete agents ────────────────────────────────────────────────────

async function deleteAgents(proposal: TeamBuilderProposal): Promise<void> {
  for (const del of proposal.changes.agentsToDelete) {
    const agentFile = join(CWD, "agents", `${del.name}.md`);
    if (existsSync(agentFile)) {
      deleteFile(agentFile);
      console.log(`  Deleted agent file: agents/${del.name}.md`);
    } else {
      console.log(`  ${Y}[WARN] Agent file not found: agents/${del.name}.md${Z}`);
    }
  }
}

// ─── Step 9: Convert agents ───────────────────────────────────────────────────

async function convertAgents(proposal: TeamBuilderProposal): Promise<void> {
  for (const conv of proposal.changes.agentsToConvert) {
    const srcPath = join(CWD, conv.currentFile);
    const dstPath = join(CWD, conv.newFile);

    if (!existsSync(srcPath)) {
      console.log(`  ${Y}[WARN] Source agent file not found: ${conv.currentFile}${Z}`);
      continue;
    }

    let content = await readFile(srcPath);

    // Update formal_name
    content = content.replace(
      /^formal_name: .+$/m,
      `formal_name: ${conv.newFormalName}`
    );

    // Replace skills in required_skills frontmatter for replaced skills
    for (const replaced of conv.skillsReplaced) {
      // Remove line referencing replaced skill in frontmatter list
      const lines = content.split("\n");
      const filtered = lines.filter(
        (l) => !(l.trim().startsWith("- ") && l.includes(replaced))
      );
      content = filtered.join("\n");
    }

    // Write to new file path
    await writeFile(dstPath, content);
    console.log(`  Converted agent: ${conv.currentFile} → ${conv.newFile}`);

    // Remove old file if path changed
    if (srcPath !== dstPath && existsSync(srcPath)) {
      deleteFile(srcPath);
      console.log(`  Removed old file: ${conv.currentFile}`);
    }
  }
}

// ─── Step 10: Create new agents ──────────────────────────────────────────────

async function createAgents(proposal: TeamBuilderProposal): Promise<void> {
  for (const agent of proposal.changes.agentsToCreate) {
    const agentFile = join(CWD, "agents", `${agent.name}.md`);
    if (existsSync(agentFile)) {
      console.log(`  ${Y}[WARN] Agent file already exists, overwriting: agents/${agent.name}.md${Z}`);
    }
    const content = generateAgentMd(agent);
    await writeFile(agentFile, content);
    console.log(`  Created agent: agents/${agent.name}.md`);
  }
}

// ─── Step 11: Update AGENTS.md ────────────────────────────────────────────────

async function updateAgentsMd(proposal: TeamBuilderProposal): Promise<void> {
  const agentsMdPath = join(CWD, "AGENTS.md");
  if (!existsSync(agentsMdPath)) {
    console.log(`  ${Y}[WARN] AGENTS.md not found, skipping update.${Z}`);
    return;
  }

  let content = await readFile(agentsMdPath);

  // Remove rows for deleted agents
  for (const del of proposal.changes.agentsToDelete) {
    const lines = content.split("\n");
    const filtered = lines.filter((line) => {
      // Remove table rows that reference this agent name/file
      return !(
        line.includes(`agents/${del.name}.md`) ||
        (line.includes(`| `) && line.toLowerCase().includes(del.name.toLowerCase()) && line.startsWith("|"))
      );
    });
    content = filtered.join("\n");
    console.log(`  Removed AGENTS.md rows for deleted agent: ${del.name}`);
  }

  // Update rows for converted agents
  for (const conv of proposal.changes.agentsToConvert) {
    const oldBasename = conv.currentFile.replace(/^agents\//, "").replace(/\.md$/, "");
    const newBasename = conv.newFile.replace(/^agents\//, "").replace(/\.md$/, "");
    // Replace file path references
    content = content.split(conv.currentFile).join(conv.newFile);
    // Replace name references in table rows
    if (oldBasename !== newBasename) {
      content = content.split(oldBasename).join(newBasename);
    }
    console.log(`  Updated AGENTS.md for converted agent: ${oldBasename} → ${newBasename}`);
  }

  // Add rows for new agents
  for (const agent of proposal.changes.agentsToCreate) {
    const tierLabel = agent.tier.claude;
    const newRow = `| [${agent.name}](agents/${agent.name}.md) | ${agent.formalName} | ${agent.phases.join(", ")} | ${tierLabel} | ${agent.description.slice(0, 60)} |`;

    // Try to append to a relevant tier section or end of roster table
    const tierHeader = `### ${tierLabel.charAt(0).toUpperCase() + tierLabel.slice(1)}-Tier`;
    if (content.includes(tierHeader)) {
      // Find end of that section's table and insert before next header or blank section
      const idx = content.indexOf(tierHeader);
      const afterHeader = content.indexOf("\n", idx);
      // Find next section header after tier header
      const nextHeader = content.indexOf("\n###", afterHeader + 1);
      const insertAt = nextHeader !== -1 ? nextHeader : content.length;
      content = content.slice(0, insertAt) + "\n" + newRow + content.slice(insertAt);
    } else {
      // Append to end of file
      content += "\n" + newRow;
    }
    console.log(`  Added AGENTS.md row for new agent: ${agent.name}`);
  }

  // Update Phase Summary table if workflowPhases provided
  if (proposal.changes.workflowPhases.length > 0) {
    // Build new phase table rows
    for (const wp of proposal.changes.workflowPhases) {
      const supporting = wp.supporting.join(", ");
      const phaseRow = `| ${wp.phase} | ${wp.name} | ${wp.lead} | ${supporting} |`;
      // Replace existing row for this phase if present
      const phaseRegex = new RegExp(`^\\| ${escapeRegex(wp.phase)} \\|.*$`, "m");
      if (phaseRegex.test(content)) {
        content = content.replace(phaseRegex, phaseRow);
        console.log(`  Updated Phase Summary row for phase: ${wp.phase}`);
      }
    }
  }

  await writeFile(agentsMdPath, content);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── Step 12: Update workflow documentation ───────────────────────────────────

async function updateWorkflowDocs(proposal: TeamBuilderProposal): Promise<void> {
  if (proposal.changes.workflowPhases.length === 0) {
    console.log(`  No workflow phase changes.`);
    return;
  }

  // Update docs/phase-definitions.md
  const phaseDefsPath = join(CWD, "docs", "phase-definitions.md");
  if (existsSync(phaseDefsPath)) {
    let content = await readFile(phaseDefsPath);
    for (const wp of proposal.changes.workflowPhases) {
      // Update lead references in phase definitions
      const phaseHeader = `## Phase ${wp.phase}`;
      if (content.includes(phaseHeader)) {
        // Replace Lead: line within this section
        const idx = content.indexOf(phaseHeader);
        const nextIdx = content.indexOf("\n## ", idx + 1);
        const section = nextIdx !== -1
          ? content.slice(idx, nextIdx)
          : content.slice(idx);
        const updated = section.replace(/\*\*Lead\*\*: .+/, `**Lead**: ${wp.lead}`);
        content = nextIdx !== -1
          ? content.slice(0, idx) + updated + content.slice(nextIdx)
          : content.slice(0, idx) + updated;
        console.log(`  Updated phase-definitions.md for phase ${wp.phase}`);
      }
    }
    await writeFile(phaseDefsPath, content);
  } else {
    console.log(`  ${Y}[WARN] docs/phase-definitions.md not found, skipping.${Z}`);
  }

  // Update docs/co-work.context.md if it references agent names
  const contextPath = join(CWD, "docs", "co-work.context.md");
  if (existsSync(contextPath)) {
    let content = await readFile(contextPath);
    let changed = false;
    for (const del of proposal.changes.agentsToDelete) {
      if (content.includes(del.name)) {
        console.log(`  ${Y}[WARN] co-work.context.md references deleted agent "${del.name}" — manual review recommended.${Z}`);
      }
    }
    for (const conv of proposal.changes.agentsToConvert) {
      const oldName = conv.currentFile.replace(/^agents\//, "").replace(/\.md$/, "");
      if (content.includes(oldName)) {
        const newName = conv.newFile.replace(/^agents\//, "").replace(/\.md$/, "");
        content = content.split(oldName).join(newName);
        changed = true;
        console.log(`  Updated co-work.context.md: ${oldName} → ${newName}`);
      }
    }
    if (changed) {
      await writeFile(contextPath, content);
    }
  }
}

// ─── Step 13: Modify existing skills ─────────────────────────────────────────

async function modifySkills(proposal: TeamBuilderProposal): Promise<void> {
  for (const mod of proposal.changes.skillsToModify) {
    const skillFile = join(CWD, "skills", mod.name, "SKILL.md");
    if (!existsSync(skillFile)) {
      console.log(`  ${Y}[WARN] Skill file not found: skills/${mod.name}/SKILL.md${Z}`);
      continue;
    }
    let content = await readFile(skillFile);
    // Append change note at end of file
    const note = `\n<!-- team-builder modification: ${mod.changes} -->\n`;
    content += note;
    await writeFile(skillFile, content);
    console.log(`  Modified skill: ${mod.name} (change note appended — manual edit may be needed)`);
  }
}

// ─── Step 14: Create new skills ──────────────────────────────────────────────

async function createSkills(proposal: TeamBuilderProposal): Promise<void> {
  for (const skill of proposal.changes.skillsToCreate) {
    const skillDir = join(CWD, "skills", skill.name);
    const skillFile = join(skillDir, "SKILL.md");
    if (existsSync(skillFile)) {
      console.log(`  ${Y}[WARN] Skill already exists, overwriting: skills/${skill.name}/SKILL.md${Z}`);
    }
    const content = generateSkillMd(skill);
    await writeFile(skillFile, content);
    console.log(`  Created skill: skills/${skill.name}/SKILL.md`);
  }
}

// ─── Step 15: Validation gate ────────────────────────────────────────────────

async function runValidationGate(): Promise<boolean> {
  let allPass = true;

  const audit = run("bun scripts/audit.ts");
  if (audit.success) {
    console.log(`  ${G}[PASS] bun scripts/audit.ts${Z}`);
  } else {
    console.error(`  ${R}[FAIL] bun scripts/audit.ts${Z}`);
    if (audit.stdout.trim()) console.error(audit.stdout.slice(0, 500));
    allPass = false;
  }

  const skillAudit = run("bun scripts/skill-lifecycle-audit.ts");
  if (skillAudit.success) {
    console.log(`  ${G}[PASS] bun scripts/skill-lifecycle-audit.ts${Z}`);
  } else {
    console.error(`  ${R}[FAIL] bun scripts/skill-lifecycle-audit.ts${Z}`);
    if (skillAudit.stdout.trim()) console.error(skillAudit.stdout.slice(0, 500));
    allPass = false;
  }

  return allPass;
}

// ─── Step 16: Change history ──────────────────────────────────────────────────

async function recordChangeHistory(proposal: TeamBuilderProposal): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const memoryDir = join(CWD, "memory");
  const memoryFile = join(memoryDir, `${today}.md`);

  let existing = "";
  if (existsSync(memoryFile)) {
    existing = await readFile(memoryFile);
  }

  const created = proposal.changes.agentsToCreate.map((a) => a.name).join(", ") || "none";
  const converted = proposal.changes.agentsToConvert.map((a) => a.newFile).join(", ") || "none";
  const deleted = proposal.changes.agentsToDelete.map((a) => a.name).join(", ") || "none";
  const skillsCreated = proposal.changes.skillsToCreate.map((s) => s.name).join(", ") || "none";
  const skillsReassigned = proposal.changes.skillsToReassign
    .map((s) => `${s.skill} (→${s.toOwner})`)
    .join(", ") || "none";

  const entry = `
## Team Builder Execution — ${new Date().toISOString()}

**Proposal**: ${proposal.teamName}
**Approved by**: ${proposal.approvedBy} at ${proposal.approvedAt}

${proposal.changeHistoryEntry}

### Changes Applied
- Agents created: ${created}
- Agents converted: ${converted}
- Agents deleted: ${deleted}
- Skills created: ${skillsCreated}
- Skills reassigned: ${skillsReassigned}
`;

  await writeFile(memoryFile, existing + entry);
  console.log(`  Appended change history to memory/${today}.md`);
}

// ─── Dry-run mode ─────────────────────────────────────────────────────────────

function runDryRun(proposal: TeamBuilderProposal): void {
  console.log(`\n${Y}╔══════════════════════════════════════════════╗`);
  console.log(`║           DRY-RUN MODE — NO CHANGES          ║`);
  console.log(`╚══════════════════════════════════════════════╝${Z}\n`);

  // Skills to reassign
  for (const r of proposal.changes.skillsToReassign) {
    console.log(`${Y}[DRY-RUN] Would reassign skill "${r.skill}": ${r.fromOwner} → ${r.toOwner}${Z}`);
  }
  for (const del of proposal.changes.agentsToDelete) {
    for (const t of del.skillsToTransfer) {
      console.log(`${Y}[DRY-RUN] Would transfer skill "${t.skill}" from ${del.name} → ${t.newOwner}${Z}`);
    }
  }

  // Agents to delete
  for (const del of proposal.changes.agentsToDelete) {
    console.log(`${Y}[DRY-RUN] Would delete: agents/${del.name}.md${Z}`);
  }

  // Agents to convert
  for (const conv of proposal.changes.agentsToConvert) {
    console.log(`${Y}[DRY-RUN] Would rename: ${conv.currentFile} → ${conv.newFile}${Z}`);
    console.log(`${Y}[DRY-RUN] Would update frontmatter in: ${conv.newFile} (formal_name → ${conv.newFormalName})${Z}`);
  }

  // Agents to create
  for (const agent of proposal.changes.agentsToCreate) {
    console.log(`${Y}[DRY-RUN] Would create: agents/${agent.name}.md${Z}`);
  }

  // AGENTS.md
  const agentsChanges =
    proposal.changes.agentsToCreate.length +
    proposal.changes.agentsToConvert.length +
    proposal.changes.agentsToDelete.length;
  if (agentsChanges > 0) {
    console.log(`${Y}[DRY-RUN] Would update: AGENTS.md (${agentsChanges} rows changed)${Z}`);
  }

  // Workflow docs
  if (proposal.changes.workflowPhases.length > 0) {
    console.log(`${Y}[DRY-RUN] Would update: docs/phase-definitions.md (${proposal.changes.workflowPhases.length} phases)${Z}`);
    console.log(`${Y}[DRY-RUN] Would review: docs/co-work.context.md for agent name references${Z}`);
  }

  // Skills to modify
  for (const mod of proposal.changes.skillsToModify) {
    console.log(`${Y}[DRY-RUN] Would modify: skills/${mod.name}/SKILL.md (${mod.changes})${Z}`);
  }

  // Skills to create
  for (const skill of proposal.changes.skillsToCreate) {
    console.log(`${Y}[DRY-RUN] Would create: skills/${skill.name}/SKILL.md${Z}`);
  }

  // Validation
  console.log(`${Y}[DRY-RUN] Would run: bun scripts/audit.ts${Z}`);
  console.log(`${Y}[DRY-RUN] Would run: bun scripts/skill-lifecycle-audit.ts${Z}`);

  // Memory
  const today = new Date().toISOString().slice(0, 10);
  console.log(`${Y}[DRY-RUN] Would append to: memory/${today}.md (change history entry)${Z}`);

  console.log(`\n${Y}Dry-run complete. No files were written.${Z}\n`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`
${C}team-builder.ts${Z} — Agent team builder execution layer

${G}Usage:${Z}
  bun scripts/team-builder.ts <proposal-json-path> [--dry-run] [--skip-checks]

${G}Arguments:${Z}
  <proposal-json-path>   Path to approved TeamBuilderProposal JSON file (required)
  --dry-run              Preview all changes without executing any file operations
  --skip-checks          Bypass pre-condition checks (emergency use only)
  --help, -h             Show this help message

${G}Examples:${Z}
  bun scripts/team-builder.ts docs/proposals/team-v2.json
  bun scripts/team-builder.ts docs/proposals/team-v2.json --dry-run
  bun scripts/team-builder.ts docs/proposals/team-v2.json --skip-checks
`);
    process.exit(0);
  }

  const dryRun = args.includes("--dry-run");
  const skipChecks = args.includes("--skip-checks");
  const proposalArg = args.find((a) => !a.startsWith("--"));

  if (!proposalArg) {
    console.error(`${R}[ERROR] No proposal JSON path provided.${Z}`);
    console.error(`Usage: bun scripts/team-builder.ts <proposal-json-path> [--dry-run]`);
    process.exit(1);
  }

  const proposalPath = join(CWD, proposalArg);
  if (!existsSync(proposalPath)) {
    console.error(`${R}[ERROR] Proposal file not found: ${proposalPath}${Z}`);
    process.exit(1);
  }

  // Load proposal
  let proposal: TeamBuilderProposal;
  try {
    const raw = await Bun.file(proposalPath).text();
    const parsed = JSON.parse(raw);
    const validation = validateProposal(parsed);
    if (!validation.valid) {
      console.error(`${R}[ERROR] Invalid proposal JSON:${Z}`);
      for (const err of validation.errors) console.error(`  - ${err}`);
      process.exit(1);
    }
    proposal = validation.proposal;
  } catch (e) {
    console.error(`${R}[ERROR] Failed to parse proposal JSON: ${e}${Z}`);
    process.exit(1);
  }

  // Dry-run short-circuit
  if (dryRun) {
    runDryRun(proposal);
    return;
  }

  // Load or init checkpoints
  const checkpoints = loadCheckpoints();

  console.log(`\n${C}╔══════════════════════════════════════════════╗`);
  console.log(`║         team-builder.ts — Execution          ║`);
  console.log(`╚══════════════════════════════════════════════╝${Z}`);
  console.log(`Proposal  : ${proposal.teamName}`);
  console.log(`Approved  : ${proposal.approvedBy} @ ${proposal.approvedAt}`);
  console.log(`Timestamp : ${new Date().toISOString()}\n`);

  // ── Step 6 ────────────────────────────────────────────────────────────────
  if (!isDone(checkpoints, 6)) {
    console.log(`${C}[Step 6] ${STEP_DEFS[0].label}${Z}`);
    const ok = await checkPreconditions(proposal, skipChecks);
    if (!ok) {
      console.error(`${R}[ABORT] Pre-conditions failed. Fix issues and re-run.${Z}`);
      await saveCheckpoints(checkpoints);
      process.exit(1);
    }
    markDone(checkpoints, 6);
    await saveCheckpoints(checkpoints);
  } else {
    console.log(`${Y}[Step 6] Skipped (already done)${Z}`);
  }

  // ── Step 7 ────────────────────────────────────────────────────────────────
  if (!isDone(checkpoints, 7)) {
    console.log(`${C}[Step 7] ${STEP_DEFS[1].label}${Z}`);
    try {
      await proactiveSkillTransfer(proposal);
      markDone(checkpoints, 7);
      await saveCheckpoints(checkpoints);
    } catch (e) {
      console.error(`${R}[ERROR] Step 7 failed: ${e}${Z}`);
      await saveCheckpoints(checkpoints);
      process.exit(1);
    }
  } else {
    console.log(`${Y}[Step 7] Skipped (already done)${Z}`);
  }

  // ── Step 8 ────────────────────────────────────────────────────────────────
  if (!isDone(checkpoints, 8)) {
    console.log(`${C}[Step 8] ${STEP_DEFS[2].label}${Z}`);
    try {
      await deleteAgents(proposal);
      markDone(checkpoints, 8);
      await saveCheckpoints(checkpoints);
    } catch (e) {
      console.error(`${R}[ERROR] Step 8 failed: ${e}${Z}`);
      await saveCheckpoints(checkpoints);
      process.exit(1);
    }
  } else {
    console.log(`${Y}[Step 8] Skipped (already done)${Z}`);
  }

  // ── Step 9 ────────────────────────────────────────────────────────────────
  if (!isDone(checkpoints, 9)) {
    console.log(`${C}[Step 9] ${STEP_DEFS[3].label}${Z}`);
    try {
      await convertAgents(proposal);
      markDone(checkpoints, 9);
      await saveCheckpoints(checkpoints);
    } catch (e) {
      console.error(`${R}[ERROR] Step 9 failed: ${e}${Z}`);
      await saveCheckpoints(checkpoints);
      process.exit(1);
    }
  } else {
    console.log(`${Y}[Step 9] Skipped (already done)${Z}`);
  }

  // ── Step 10 ───────────────────────────────────────────────────────────────
  if (!isDone(checkpoints, 10)) {
    console.log(`${C}[Step 10] ${STEP_DEFS[4].label}${Z}`);
    try {
      await createAgents(proposal);
      markDone(checkpoints, 10);
      await saveCheckpoints(checkpoints);
    } catch (e) {
      console.error(`${R}[ERROR] Step 10 failed: ${e}${Z}`);
      await saveCheckpoints(checkpoints);
      process.exit(1);
    }
  } else {
    console.log(`${Y}[Step 10] Skipped (already done)${Z}`);
  }

  // ── Step 11 ───────────────────────────────────────────────────────────────
  if (!isDone(checkpoints, 11)) {
    console.log(`${C}[Step 11] ${STEP_DEFS[5].label}${Z}`);
    try {
      await updateAgentsMd(proposal);
      markDone(checkpoints, 11);
      await saveCheckpoints(checkpoints);
    } catch (e) {
      console.error(`${R}[ERROR] Step 11 failed: ${e}${Z}`);
      await saveCheckpoints(checkpoints);
      process.exit(1);
    }
  } else {
    console.log(`${Y}[Step 11] Skipped (already done)${Z}`);
  }

  // ── Step 12 ───────────────────────────────────────────────────────────────
  if (!isDone(checkpoints, 12)) {
    console.log(`${C}[Step 12] ${STEP_DEFS[6].label}${Z}`);
    try {
      await updateWorkflowDocs(proposal);
      markDone(checkpoints, 12);
      await saveCheckpoints(checkpoints);
    } catch (e) {
      console.error(`${R}[ERROR] Step 12 failed: ${e}${Z}`);
      await saveCheckpoints(checkpoints);
      process.exit(1);
    }
  } else {
    console.log(`${Y}[Step 12] Skipped (already done)${Z}`);
  }

  // ── Step 13 ───────────────────────────────────────────────────────────────
  if (!isDone(checkpoints, 13)) {
    console.log(`${C}[Step 13] ${STEP_DEFS[7].label}${Z}`);
    try {
      await modifySkills(proposal);
      markDone(checkpoints, 13);
      await saveCheckpoints(checkpoints);
    } catch (e) {
      console.error(`${R}[ERROR] Step 13 failed: ${e}${Z}`);
      await saveCheckpoints(checkpoints);
      process.exit(1);
    }
  } else {
    console.log(`${Y}[Step 13] Skipped (already done)${Z}`);
  }

  // ── Step 14 ───────────────────────────────────────────────────────────────
  if (!isDone(checkpoints, 14)) {
    console.log(`${C}[Step 14] ${STEP_DEFS[8].label}${Z}`);
    try {
      await createSkills(proposal);
      markDone(checkpoints, 14);
      await saveCheckpoints(checkpoints);
    } catch (e) {
      console.error(`${R}[ERROR] Step 14 failed: ${e}${Z}`);
      await saveCheckpoints(checkpoints);
      process.exit(1);
    }
  } else {
    console.log(`${Y}[Step 14] Skipped (already done)${Z}`);
  }

  // ── Step 15 ───────────────────────────────────────────────────────────────
  if (!isDone(checkpoints, 15)) {
    console.log(`${C}[Step 15] ${STEP_DEFS[9].label}${Z}`);
    const passed = await runValidationGate();
    if (!passed) {
      console.error(`${R}[FAIL] Validation gate did not pass. Fix issues, then re-run (step 15 will retry).${Z}`);
      await saveCheckpoints(checkpoints);
      process.exit(1);
    }
    markDone(checkpoints, 15);
    await saveCheckpoints(checkpoints);
  } else {
    console.log(`${Y}[Step 15] Skipped (already done)${Z}`);
  }

  // ── Step 16 ───────────────────────────────────────────────────────────────
  if (!isDone(checkpoints, 16)) {
    console.log(`${C}[Step 16] ${STEP_DEFS[10].label}${Z}`);
    try {
      await recordChangeHistory(proposal);
      markDone(checkpoints, 16);
      await saveCheckpoints(checkpoints);
    } catch (e) {
      console.error(`${R}[ERROR] Step 16 failed: ${e}${Z}`);
      await saveCheckpoints(checkpoints);
      process.exit(1);
    }
  } else {
    console.log(`${Y}[Step 16] Skipped (already done)${Z}`);
  }

  // ── Cleanup & Summary ─────────────────────────────────────────────────────
  try {
    const { unlinkSync } = require("fs");
    if (existsSync(CHECKPOINT_FILE)) unlinkSync(CHECKPOINT_FILE);
  } catch {}

  console.log(`\n${G}╔══════════════════════════════════════════════╗`);
  console.log(`║         team-builder.ts — COMPLETE           ║`);
  console.log(`╚══════════════════════════════════════════════╝${Z}`);
  console.log(`${G}Team: ${proposal.teamName}${Z}`);
  console.log(`Agents created  : ${proposal.changes.agentsToCreate.map((a) => a.name).join(", ") || "none"}`);
  console.log(`Agents converted: ${proposal.changes.agentsToConvert.map((a) => a.newFile).join(", ") || "none"}`);
  console.log(`Agents deleted  : ${proposal.changes.agentsToDelete.map((a) => a.name).join(", ") || "none"}`);
  console.log(`Skills created  : ${proposal.changes.skillsToCreate.map((s) => s.name).join(", ") || "none"}`);
  console.log(`Skills reassigned: ${proposal.changes.skillsToReassign.map((s) => s.skill).join(", ") || "none"}`);
  console.log(`\n${G}All steps complete. Run /sync to commit changes.${Z}\n`);
}

main().catch((e) => {
  console.error(`${R}[FATAL] Unhandled error: ${e}${Z}`);
  process.exit(1);
});
