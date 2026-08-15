#!/usr/bin/env bun
// @version 1.0.0
/**
 * agent-model-gate.ts — PreToolUse gate enforcing the 3-Tier Cost Optimization
 * strategy (CLAUDE.md §6 / AGENTS.md §3.6) on Agent tool dispatches.
 *
 * Root cause this fixes: every agents/*.md file ships `model: inherit`
 * (correct — inherit is the platform-neutral default). When a dispatcher
 * forgets to pass `model` explicitly on the Agent() call, the subagent
 * silently falls back to the PARENT session's model instead of its
 * documented tier — High (opus) and Low (haiku) dispatches are the ones
 * that visibly break, since Medium (sonnet) often matches the parent by
 * coincidence. This hook blocks (ask mode) any Agent() call whose
 * `subagent_type` matches one of the workspace's tiered agents and whose
 * `model` field is missing or empty, telling the caller which alias to add.
 *
 * Triggered by PreToolUse (Claude Code), matcher: "Agent".
 */

import { readFileSync } from 'node:fs';

// Tier registry mirrors AGENTS.md's own tables — keep in sync manually,
// same convention as validate-model-registry.ts for docs/workspace-schema.json.
const AGENT_TIERS: Record<string, { tier: 'High' | 'Medium' | 'Low'; alias: 'opus' | 'sonnet' | 'haiku' }> = {
  pm: { tier: 'High', alias: 'opus' },
  architect: { tier: 'High', alias: 'opus' },
  auditor: { tier: 'Medium', alias: 'sonnet' },
  'lifecycle-manager': { tier: 'Medium', alias: 'sonnet' },
  'automation-engineer': { tier: 'Low', alias: 'haiku' },
  'docs-writer': { tier: 'Medium', alias: 'sonnet' },
  'scaffolding-expert': { tier: 'Low', alias: 'haiku' },
  'security-expert': { tier: 'Medium', alias: 'sonnet' },
};

const VALID_ALIASES = new Set(['sonnet', 'opus', 'haiku', 'fable']);

function main(): void {
  let stdinJson: string;
  try {
    stdinJson = readFileSync(0, 'utf-8');
  } catch {
    process.exit(0);
    return;
  }

  let data: { tool_name?: string; tool_input?: Record<string, unknown> };
  try {
    data = JSON.parse(stdinJson) as typeof data;
  } catch {
    process.exit(0);
    return;
  }

  if (data.tool_name !== 'Agent') {
    process.exit(0);
    return;
  }

  const toolInput = data.tool_input ?? {};
  const subagentType = toolInput.subagent_type as string | undefined;
  const model = toolInput.model as string | undefined;

  // Only gate the workspace's own tiered agents — general-purpose subagents
  // (Explore, Plan, general-purpose, etc.) have no documented tier and are
  // fine to dispatch with model: inherit.
  if (!subagentType || !(subagentType in AGENT_TIERS)) {
    process.exit(0);
    return;
  }

  if (model && VALID_ALIASES.has(model)) {
    process.exit(0);
    return;
  }

  const { tier, alias } = AGENT_TIERS[subagentType];
  const reason =
    `[TIER-GATE] Dispatching '${subagentType}' without an explicit model= param. ` +
    `Its frontmatter is model: inherit, so omitting model here silently runs it on ` +
    `the PARENT session's model instead of its documented ${tier} tier. ` +
    `Add model: "${alias}" to this Agent() call (see CLAUDE.md §6 / AGENTS.md §3.6).`;

  const response = { decision: 'ask' as const, reason };
  process.stdout.write(JSON.stringify(response) + '\n');
  process.exit(0);
}

main();
