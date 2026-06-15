#!/usr/bin/env bun
/**
 * agent-override-merge.ts — Merge variant-specific agent section overrides into project agents.
 *
 * Reads variant.json from the variant template directory, then for each agent_override
 * with type "additive", merges variant-specific VARIANT-SECTION blocks into the common
 * skeleton written to the project directory.
 *
 * @version 1.0.0
 *
 * Usage:
 *   bun scripts/lib/agent-override-merge.ts <commonDir> <variantDir> <projectDir>
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';

const [,, commonDir, variantDir, projectDir] = process.argv;

if (!commonDir || !variantDir || !projectDir) {
  console.error('Usage: agent-override-merge.ts <commonDir> <variantDir> <projectDir>');
  process.exit(1);
}

const variantJsonPath = join(variantDir, 'variant.json');
if (!existsSync(variantJsonPath)) process.exit(0);

const variant = JSON.parse(readFileSync(variantJsonPath, 'utf8'));
const overrides: Record<string, { type?: string }> = variant.agent_overrides || {};

function parseFrontmatter(content: string): { fm: Record<string, unknown>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { fm: {}, body: content };
  try {
    return { fm: (yaml.load(match[1]) as Record<string, unknown>) || {}, body: content.slice(match[0].length) };
  } catch {
    return { fm: {}, body: content };
  }
}

const headingMap: Record<string, string> = {
  'agent-roster': 'Agent Roster',
  'governance-workflow': 'Governance Workflow',
  'dispatch-protocol': 'Dispatch Protocol',
};

for (const [agentName, override] of Object.entries(overrides)) {
  if (override.type !== 'additive') continue;

  const skeletonFile = join(commonDir, 'agents', agentName + '.md');
  const variantFile = join(variantDir, 'agents', agentName + '.md');
  const outFile = join(projectDir, 'agents', agentName + '.md');

  if (!existsSync(skeletonFile) || !existsSync(variantFile) || !existsSync(outFile)) continue;

  const variantContent = readFileSync(variantFile, 'utf8');
  if (variantContent.match(/^---\n[\s\S]*?^extends:/m)) {
    console.log('  [SKIP-ADDITIVE] agents/' + agentName + '.md (uses extends pattern)');
    continue;
  }

  const skeleton = readFileSync(skeletonFile, 'utf8');
  const { fm: skelFm, body: skelBody } = parseFrontmatter(skeleton);
  const { fm: varFm, body: varBody } = parseFrontmatter(variantContent);

  const mergedFm = { ...skelFm, ...varFm };
  const hasFm = Object.keys(mergedFm).length > 0;
  const fmStr = hasFm ? '---\n' + (yaml.dump(mergedFm) as string).trimEnd() + '\n---\n' : '';
  let merged = fmStr + skelBody;

  // Parse variant body sections
  const allSections: Record<string, string> = {};
  const lines = varBody.split('\n');
  let cur: string | null = null;
  let curLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (cur) allSections[cur] = curLines.join('\n');
      cur = line.slice(3).trim();
      curLines = [line];
    } else if (cur) {
      curLines.push(line);
    }
  }
  if (cur) allSections[cur] = curLines.join('\n');

  merged = merged.replace(
    /<!-- VARIANT-SECTION: ([\w-]+) -->([\s\S]*?)<!-- END VARIANT-SECTION -->/g,
    (_m, id: string) => {
      const h = headingMap[id];
      return h && allSections[h] ? allSections[h] : '';
    }
  );

  writeFileSync(outFile, merged, 'utf8');
  console.log('  [SECTION-MERGE] agents/' + agentName + '.md');
}
