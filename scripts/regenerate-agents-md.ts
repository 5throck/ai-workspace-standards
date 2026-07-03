#!/usr/bin/env bun
/**
 * regenerate-agents-md.ts
 * @version 1.0.1
 *
 * Regenerates variant AGENTS.md from the L1 common template with variant-specific
 * VARIANT-*-START/END blocks filled in from agent frontmatter.
 *
 * Usage:
 *   bun scripts/regenerate-agents-md.ts --variant co-consult
 *   bun scripts/regenerate-agents-md.ts --all
 *   bun scripts/regenerate-agents-md.ts --dry-run --variant co-work
 *
 * Problem solved: Variants generated before the §-numbered AGENTS.md structure
 * was introduced lack VARIANT-*-START/END markers, so l2-to-variant-pipeline.ts
 * injection has no anchors to replace. This script regenerates from scratch.
 */

import * as fs from 'fs';
import * as path from 'path';

const TEMPLATES_DIR = 'templates';
const COMMON_AGENTS_TEMPLATE = path.join(TEMPLATES_DIR, 'common', 'AGENTS.md');

interface AgentMeta {
  name: string;
  file: string;
  tier: string;
  phases: string;
  role: string;
  description: string;
}

function parseSimpleFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const result: Record<string, string> = {};
  const lines = match[1].split('\n');
  let currentKey = '';
  let inBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // tier.claude extraction
    if (line.match(/^\s+claude:\s+(.+)/)) {
      const m = line.match(/^\s+claude:\s+(.+)/);
      if (m) result['tier.claude'] = m[1].trim();
    }
    // simple key: value
    const simple = line.match(/^(\w[\w-]*):\s+(.+)/);
    if (simple && !inBlock) {
      currentKey = simple[1];
      result[currentKey] = simple[2].trim().replace(/^>-?\s*/, '');
    }
    // multi-line description block (starts with >)
    const blockStart = line.match(/^(\w[\w-]*):\s*>-?$/);
    if (blockStart) {
      currentKey = blockStart[1];
      inBlock = true;
      result[currentKey] = '';
      continue;
    }
    if (inBlock) {
      if (line.match(/^\s+/) || line === '') {
        result[currentKey] = (result[currentKey] + ' ' + line.trim()).trim();
      } else {
        inBlock = false;
      }
    }
    // phases: [1, 2]
    const phasesMatch = line.match(/^phases:\s*(.+)/);
    if (phasesMatch) result['phases'] = phasesMatch[1].trim();
  }
  return result;
}

function readAgentMeta(variantDir: string, agentName: string): AgentMeta {
  const agentFile = path.join(variantDir, 'agents', `${agentName}.md`);
  const content = fs.readFileSync(agentFile, 'utf-8');
  const fm = parseSimpleFrontmatter(content);

  const tier = fm['tier.claude'] || 'medium';
  const phasesRaw = fm['phases'] || '';
  // Convert [1, 2] → "1, 2"
  const phases = phasesRaw.replace(/[\[\]]/g, '').replace(/,\s*/g, ', ');
  const role = fm['role'] || fm['description'] || agentName;
  const description = fm['description'] || role;

  return {
    name: agentName,
    file: `agents/${agentName}.md`,
    tier,
    phases,
    role,
    description,
  };
}

function deriveDispatchTriggers(agent: AgentMeta): string[] {
  // Derive sensible dispatch triggers from agent name and role
  const name = agent.name.replace(/-/g, ' ');
  const role = agent.role.toLowerCase();
  const triggers: string[] = [`"${name}"`];

  // Add role-based triggers
  if (role.includes('research') || role.includes('analysis') || role.includes('investigation')) {
    triggers.push('"research"', '"analyze"', '"investigate"');
  }
  if (role.includes('design')) {
    triggers.push('"design"', '"create design"');
  }
  if (role.includes('document') || role.includes('write') || role.includes('writer')) {
    triggers.push('"write"', '"document"', '"draft"');
  }
  if (role.includes('strategy') || role.includes('strategic')) {
    triggers.push('"strategy"', '"strategic analysis"');
  }
  if (role.includes('security') || role.includes('pentest') || role.includes('vulnerability')) {
    triggers.push('"security"', '"pentest"', '"vulnerability"');
  }
  if (role.includes('prototype') || role.includes('build')) {
    triggers.push('"prototype"', '"build"');
  }
  if (role.includes('report')) {
    triggers.push('"report"', '"write report"');
  }
  if (role.includes('patch') || role.includes('remediation')) {
    triggers.push('"patch"', '"remediate"', '"fix vulnerability"');
  }
  if (role.includes('communication') || role.includes('narrative')) {
    triggers.push('"communicate"', '"presentation"', '"narrative"');
  }
  if (role.includes('ux') || role.includes('user research')) {
    triggers.push('"user research"', '"usability"', '"ux"');
  }
  if (role.includes('visual') || role.includes('typography') || role.includes('font')) {
    triggers.push('"visual"', '"typography"', '"font"');
  }
  if (role.includes('microsoft') || role.includes('ms365') || role.includes('365')) {
    triggers.push('"microsoft 365"', '"sharepoint"', '"teams"', '"outlook"');
  }
  if (role.includes('threat') || role.includes('stride') || role.includes('attack')) {
    triggers.push('"threat model"', '"stride"', '"attack surface"');
  }
  if (role.includes('red team') || role.includes('attack methodology')) {
    triggers.push('"red team"', '"attack"', '"exploitation"');
  }
  if (role.includes('delivery') || role.includes('coordinator') || role.includes('schedule')) {
    triggers.push('"schedule"', '"coordinate"', '"track progress"');
  }
  if (role.includes('change management') || role.includes('transformation')) {
    triggers.push('"change management"', '"organizational transformation"', '"stakeholder"');
  }
  if (role.includes('industry') || role.includes('competitive') || role.includes('regulatory')) {
    triggers.push('"industry"', '"market landscape"', '"competitive analysis"');
  }
  if (role.includes('subject matter') || role.includes('functional expertise')) {
    triggers.push('"sme"', '"subject matter"', '"functional expertise"');
  }
  if (role.includes('solution') || role.includes('architecture')) {
    triggers.push('"solution design"', '"architecture"', '"technical solution"');
  }
  if (role.includes('workstream') || role.includes('team coordination')) {
    triggers.push('"workstream"', '"track deliverables"', '"team coordination"');
  }
  if (role.includes('data') || role.includes('statistical') || role.includes('model')) {
    triggers.push('"data analysis"', '"statistics"', '"data model"');
  }
  if (role.includes('service designer') || role.includes('customer journey')) {
    triggers.push('"service design"', '"customer journey"', '"service map"');
  }

  // Dedupe and limit
  return [...new Set(triggers)].slice(0, 5);
}

function derivePhaseGateRow(agent: AgentMeta): string {
  const phasesDisplay = agent.phases ? `Phase ${agent.phases}` : 'Phase ?';
  const tierCap = agent.tier.charAt(0).toUpperCase() + agent.tier.slice(1);
  return `| ${agent.role.split(',')[0].trim()} | ${phasesDisplay} | \`${agent.name}\` | ${tierCap} | |`;
}

function deriveRoleBoundaryRow(agent: AgentMeta): string {
  const task = agent.role.split('.')[0].trim();
  return `| ${task} | \`${agent.name}\` | \`pm\` |`;
}

function generateVariantBlocks(agents: AgentMeta[]): Record<string, string> {
  // VARIANT-AGENTS
  const agentRows = agents.map(a => {
    const tierCap = a.tier.charAt(0).toUpperCase() + a.tier.slice(1);
    return `| **${a.name}** | [\`${a.file}\`](${a.file}) | ${tierCap} | ${a.role} |`;
  }).join('\n');

  // VARIANT-AGENT-DETAILS
  const agentDetails = agents.map(a => {
    return `### ${a.name}\n\n| Field | Value |\n|-------|-------|\n| **File** | [\`${a.file}\`](${a.file}) |\n| **Tier** | ${a.tier} |\n| **Phases** | ${a.phases || '—'} |\n| **Role** | ${a.role} |`;
  }).join('\n\n');

  // VARIANT-DISPATCH-TRIGGERS
  const triggerRows = agents.map(a => {
    const triggers = deriveDispatchTriggers(a).join(', ');
    const phasesDisplay = a.phases ? `Phase ${a.phases.split(',')[0].trim()}` : '—';
    return `| \`${a.name}\` | ${phasesDisplay} | ${triggers} |`;
  }).join('\n');
  const dispatchTriggers = `| Agent | Phase | Dispatch Trigger |\n|-------|-------|------------------|\n${triggerRows}`;

  // VARIANT-PHASE-GATE
  const phaseGateRows = agents.map(a => derivePhaseGateRow(a)).join('\n');
  const phaseGate = phaseGateRows;

  // VARIANT-SUBAGENT-ROSTER
  const rosterRows = agents.map(a => {
    const tierCap = a.tier.charAt(0).toUpperCase() + a.tier.slice(1);
    const parallelizable = a.phases && a.phases.includes(',') ? 'sequential (phase-ordered)' : '❌ serial';
    return `| ${a.name} | \`${a.file}\` | ${tierCap} | ${parallelizable} | ✅ within phase scope |`;
  }).join('\n');

  // VARIANT-ROLE-BOUNDARY
  const roleBoundaryRows = agents.map(a => deriveRoleBoundaryRow(a)).join('\n');

  return {
    'VARIANT-AGENTS': agentRows,
    'VARIANT-AGENT-DETAILS': agentDetails,
    'VARIANT-DISPATCH-TRIGGERS': dispatchTriggers,
    'VARIANT-PHASE-GATE': phaseGate,
    'VARIANT-SUBAGENT-ROSTER': rosterRows,
    'VARIANT-ROLE-BOUNDARY': roleBoundaryRows,
  };
}

function injectBlocks(template: string, blocks: Record<string, string>): string {
  let result = template;
  for (const [key, content] of Object.entries(blocks)) {
    const startMarker = `<!-- ${key}-START -->`;
    const endMarker = `<!-- ${key}-END -->`;
    const startIdx = result.indexOf(startMarker);
    const endIdx = result.indexOf(endMarker);
    if (startIdx === -1 || endIdx === -1) {
      console.warn(`  ⚠️  Marker not found: ${key}-START/END in template`);
      continue;
    }
    const before = result.slice(0, startIdx + startMarker.length);
    const after = result.slice(endIdx);
    result = `${before}\n${content}\n${after}`;
  }
  return result;
}

function regenerateVariant(variantName: string, dryRun: boolean): void {
  const variantDir = path.join(TEMPLATES_DIR, variantName);
  const variantJson = path.join(variantDir, 'variant.json');
  const outputPath = path.join(variantDir, 'AGENTS.md');

  if (!fs.existsSync(variantDir)) {
    console.error(`  ❌ Variant directory not found: ${variantDir}`);
    return;
  }
  if (!fs.existsSync(variantJson)) {
    console.error(`  ❌ variant.json not found: ${variantJson}`);
    return;
  }

  const variant = JSON.parse(fs.readFileSync(variantJson, 'utf-8'));
  const allAgentNames: string[] = (variant.agents ?? [])
    .map((a: { name: string }) => a.name)
    .filter((n: string) => n !== 'pm');

  console.log(`\n📦 Regenerating AGENTS.md for ${variantName}`);
  console.log(`   Agents: ${allAgentNames.join(', ')}`);

  // Read agent metadata
  const agents: AgentMeta[] = [];
  for (const name of allAgentNames) {
    const agentFile = path.join(variantDir, 'agents', `${name}.md`);
    if (!fs.existsSync(agentFile)) {
      console.warn(`  ⚠️  Agent file not found: ${agentFile} — skipping`);
      continue;
    }
    agents.push(readAgentMeta(variantDir, name));
  }

  // Read L1 template
  const template = fs.readFileSync(COMMON_AGENTS_TEMPLATE, 'utf-8');

  // Generate variant-specific blocks
  const blocks = generateVariantBlocks(agents);

  // Inject into template
  const generated = injectBlocks(template, blocks);

  if (dryRun) {
    console.log(`\n--- DRY RUN: Would write to ${outputPath} ---`);
    console.log(generated.slice(0, 500) + '\n...');
    return;
  }

  fs.writeFileSync(outputPath, generated, 'utf-8');
  console.log(`  ✅ Written: ${outputPath}`);
}

// CLI entry point
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const allFlag = args.includes('--all');
const variantIdx = args.indexOf('--variant');
const variantName = variantIdx !== -1 ? args[variantIdx + 1] : null;

const MISALIGNED_VARIANTS = ['co-consult', 'co-work', 'co-security', 'co-design'];

if (!COMMON_AGENTS_TEMPLATE || !fs.existsSync(COMMON_AGENTS_TEMPLATE)) {
  console.error(`❌ L1 template not found: ${COMMON_AGENTS_TEMPLATE}`);
  if (import.meta.main) {
    process.exit(1);
  }
}

if (allFlag) {
  for (const v of MISALIGNED_VARIANTS) {
    regenerateVariant(v, isDryRun);
  }
} else if (variantName) {
  regenerateVariant(variantName, isDryRun);
} else {
  console.log(`Usage:
  bun scripts/regenerate-agents-md.ts --variant <name>   # Single variant
  bun scripts/regenerate-agents-md.ts --all              # All misaligned variants
  bun scripts/regenerate-agents-md.ts --dry-run --all    # Preview without writing

Misaligned variants: ${MISALIGNED_VARIANTS.join(', ')}`);
  if (import.meta.main) {
    process.exit(0);
  }
}
