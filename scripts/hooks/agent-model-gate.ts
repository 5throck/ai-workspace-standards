#!/usr/bin/env bun
// @version 1.1.0
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
 * `subagent_type` matches a tiered agent and whose `model` field is
 * missing or empty, telling the caller which alias to add.
 *
 * The tier registry is NOT hardcoded here: agent→tier is read at runtime
 * from docs/workspace-schema.json `agent_tiers` (the SSOT), and the Claude
 * Code alias is derived from the matching `models.claude` registry ID
 * (claude-<alias>-<ver> → alias). Tier changes therefore land in the schema
 * alone and this gate follows automatically.
 *
 * Fail-open policy: if the schema is missing, unreadable, or structurally
 * incomplete, the gate skips (warns on stderr) instead of blocking Agent
 * dispatches — schema corruption is caught by validate-model-registry.ts
 * and the audit pipeline, not here.
 *
 * Triggered by PreToolUse (Claude Code), matcher: "Agent".
 */

import { readFileSync } from 'node:fs';

const WORKSPACE_ROOT = new URL('../..', import.meta.url).pathname;
const SCHEMA_PATH = `${WORKSPACE_ROOT}docs/workspace-schema.json`;

const VALID_ALIASES = new Set(['sonnet', 'opus', 'haiku', 'fable']);

interface GateEntry {
  tier: string;
  alias: string;
}

interface WorkspaceSchema {
  agent_tiers?: Record<string, string>;
  models?: { claude?: Record<string, string> };
}

/**
 * Build agent→{tier, alias} from the schema SSOT. Returns null (fail-open)
 * when the schema cannot be read or lacks the required blocks; individual
 * agents with an unusable tier are skipped with a warning.
 */
function loadTierRegistry(): Record<string, GateEntry> | null {
  let schema: WorkspaceSchema;
  try {
    schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf-8')) as WorkspaceSchema;
  } catch (err) {
    console.error(`[TIER-GATE] WARN: cannot read ${SCHEMA_PATH} (${(err as Error).message}); skipping gate`);
    return null;
  }

  const agentTiers = schema.agent_tiers;
  const claudeModels = schema.models?.claude;
  if (!agentTiers || !claudeModels) {
    console.error('[TIER-GATE] WARN: workspace-schema.json is missing agent_tiers or models.claude; skipping gate');
    return null;
  }

  const registry: Record<string, GateEntry> = {};
  for (const [agent, tier] of Object.entries(agentTiers)) {
    const registryId = claudeModels[tier];
    const alias = registryId?.split('-')[1];
    if (!registryId || !alias || !VALID_ALIASES.has(alias)) {
      console.error(`[TIER-GATE] WARN: no valid claude alias derivable for tier '${tier}' (agent '${agent}'); agent not gated`);
      continue;
    }
    registry[agent] = { tier, alias };
  }
  return registry;
}

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

  // An explicit valid alias is always acceptable — no schema I/O needed.
  if (model && VALID_ALIASES.has(model)) {
    process.exit(0);
    return;
  }

  // Only gate the workspace's tiered agents — general-purpose subagents
  // (Explore, Plan, general-purpose, etc.) have no documented tier and are
  // fine to dispatch with model: inherit.
  if (!subagentType) {
    process.exit(0);
    return;
  }

  const entry = loadTierRegistry()?.[subagentType];
  if (!entry) {
    process.exit(0);
    return;
  }

  const tierLabel = entry.tier.charAt(0).toUpperCase() + entry.tier.slice(1);
  const reason =
    `[TIER-GATE] Dispatching '${subagentType}' without an explicit model= param. ` +
    `Its frontmatter is model: inherit, so omitting model here silently runs it on ` +
    `the PARENT session's model instead of its documented ${tierLabel} tier. ` +
    `Add model: "${entry.alias}" to this Agent() call (see CLAUDE.md §6 / AGENTS.md §3.6).`;

  const response = { decision: 'ask' as const, reason };
  process.stdout.write(JSON.stringify(response) + '\n');
  process.exit(0);
}

main();
