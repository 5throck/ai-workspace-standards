#!/usr/bin/env bun
// @version 1.3.0
// v1.3.0 (2026-10-26, ADR-0102 / T-20261026-018, user ruling 2): the tier
//           source moves from schema `agent_tiers` (REMOVED from
//           docs/workspace-schema.json — a root-roster remnant meaningless in
//           delivered projects) to each agents/<name>.md frontmatter: the
//           scalar `tier: high|medium|low` declaration is the single source,
//           with a uniform legacy per-platform block tolerated during the
//           ADR-0102 transition. agents/*.md is the gate's roster now (one
//           small frontmatter read per agent file); an agent with a
//           missing/unparseable/mixed tier is WARN-and-skipped exactly like
//           the old "missing agent_tiers" case. models.claude still comes
//           from the schema (tier→alias derivation).
// v1.2.0 (2026-10-26, T-20261026-009, finding #30): full model IDs are accepted
//           alongside short aliases. 'provider/model' form (e.g. zai/glm-5.3-flash)
//           and any full registry ID known to docs/workspace-schema.json models.*
//           (e.g. claude-opus-5-5) name an explicit model just as precisely as an
//           alias; the gate used to fall through and trip on them with a reason
//           claiming the model param was omitted — factually wrong. A provided but
//           UNRECOGNIZED value still trips, now with a reason that names the value
//           (and calls out model: 'inherit' as the omit-equivalent it is).
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
 * from each agents/<name>.md frontmatter (the ADR-0102 scalar `tier:`
 * declaration — uniform legacy per-platform blocks tolerated during
 * transition), and the Claude Code alias is derived from the matching
 * `models.claude` registry ID (claude-<alias>-<ver> → alias). Tier changes
 * land in the agent file alone and this gate follows automatically.
 *
 * Fail-open policy: if the schema's models.claude is missing/unreadable or
 * an agent file is missing/unparseable/lacks a usable tier, the gate skips
 * (warns on stderr) instead of blocking Agent dispatches — corruption is
 * caught by validate-model-registry.ts and the audit pipeline, not here.
 *
 * Triggered by PreToolUse (Claude Code), matcher: "Agent".
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// fileURLToPath, not URL.pathname: on Windows the pathname keeps a leading slash and
// percent-encoded spaces, producing an unusable root (T-20261002-013; same fix as
// pm-role-bootstrap.ts, PR #1317).
const WORKSPACE_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SCHEMA_PATH = `${WORKSPACE_ROOT}docs/workspace-schema.json`;
const AGENTS_DIR = `${WORKSPACE_ROOT}agents`;

const VALID_ALIASES = new Set(['sonnet', 'opus', 'haiku', 'fable']);
const VALID_TIERS = new Set(['high', 'medium', 'low']);

interface GateEntry {
  tier: string;
  alias: string;
}

interface WorkspaceSchema {
  models?: Record<string, Record<string, string>>;
}

/**
 * Extract the agent's declared tier from an agents/<name>.md file (ADR-0102):
 * the scalar `tier: <value>` form, falling back to a uniform legacy
 * per-platform block during the transition. Returns null when no usable
 * single tier exists (missing key, unparseable frontmatter, or mixed legacy
 * values) — the caller WARN-and-skips.
 */
function extractAgentTier(content: string): string | null {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
  if (!fm) return null;

  // Scalar form first: `tier: medium`
  const scalar = fm[1].match(/^tier\s*:\s*([\w-]+)\s*(?:#.*)?$/m);
  if (scalar) {
    const tier = scalar[1].trim().toLowerCase();
    return VALID_TIERS.has(tier) ? tier : null;
  }

  // Legacy per-platform block: `tier:` + indented `<platform>: <tier>` lines.
  const lines = fm[1].split('\n').map((l) => l.replace(/\r$/, ''));
  const tierIdx = lines.findIndex((l) => /^tier\s*:\s*$/.test(l));
  if (tierIdx === -1) return null;
  const values = new Set<string>();
  for (const line of lines.slice(tierIdx + 1)) {
    if (line.trim() === '') continue;
    if (!/^\s/.test(line)) break; // next top-level key — block ended
    const entry = line.trim().match(/^([\w-]+)\s*:\s*([\w-]+)/);
    if (entry) values.add(entry[2].trim().toLowerCase());
  }
  if (values.size !== 1) return null;
  const tier = [...values][0];
  return VALID_TIERS.has(tier) ? tier : null;
}

/**
 * Build agent→{tier, alias} from the agents/*.md roster + schema models.claude.
 * Returns null (fail-open) when the schema or the roster cannot be read;
 * individual agents with an unusable tier are skipped with a warning.
 */
function loadTierRegistry(): Record<string, GateEntry> | null {
  let schema: WorkspaceSchema;
  try {
    schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf-8')) as WorkspaceSchema;
  } catch (err) {
    console.error(`[TIER-GATE] WARN: cannot read ${SCHEMA_PATH} (${(err as Error).message}); skipping gate`);
    return null;
  }

  const claudeModels = schema.models?.claude;
  if (!claudeModels) {
    console.error('[TIER-GATE] WARN: workspace-schema.json is missing models.claude; skipping gate');
    return null;
  }

  let files: string[];
  try {
    files = readdirSync(AGENTS_DIR).filter((f) => f.endsWith('.md') && !f.startsWith('README'));
  } catch (err) {
    console.error(`[TIER-GATE] WARN: cannot read agents directory ${AGENTS_DIR} (${(err as Error).message}); skipping gate`);
    return null;
  }

  const registry: Record<string, GateEntry> = {};
  for (const file of files) {
    const agent = file.replace(/\.md$/, '');
    let tier: string | null;
    try {
      tier = extractAgentTier(readFileSync(join(AGENTS_DIR, file), 'utf-8'));
    } catch (err) {
      console.error(`[TIER-GATE] WARN: cannot read agents/${file} (${(err as Error).message}); agent not gated`);
      continue;
    }
    if (!tier) {
      console.error(`[TIER-GATE] WARN: no usable tier declaration in agents/${file}; agent not gated`);
      continue;
    }
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

/** T-20261026-009 (finding #30): does this value name a FULL model ID (as opposed
 * to a short alias or garbage)? Two legal shapes: 'provider/model' (any platform's
 * qualified form) and a full registry ID from the workspace model registry
 * (docs/workspace-schema.json models.* values, e.g. 'claude-opus-5-5' or
 * 'glm-5.3'). An unreadable schema returns false — the caller then falls through
 * to the tier gate, which fails open when the schema is unavailable. */
function isFullModelId(model: string): boolean {
  if (model.includes('/')) return true;
  try {
    const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf-8')) as WorkspaceSchema;
    const models = schema.models ?? {};
    return Object.values(models).some((tierMap) =>
      tierMap !== null && typeof tierMap === 'object' && Object.values(tierMap).includes(model));
  } catch {
    return false;
  }
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

  // A full model ID is equally explicit (T-20261026-009, finding #30): accept and
  // skip the tier check entirely.
  if (model && isFullModelId(model)) {
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
  // T-20261026-009 (finding #30): the old single reason claimed the model param
  // was omitted even when it was PRESENT-but-unrecognized (a full model ID used to
  // land here) — factually wrong and misleading to the caller. Two accurate
  // variants now: omitted vs provided-but-unrecognized.
  const reason = model
    ? `[TIER-GATE] Dispatching '${subagentType}' with model="${model}", which is ` +
      `neither a tier alias (${[...VALID_ALIASES].join('/')}) nor a known full model ID. ` +
      (model === 'inherit'
        ? `model: "inherit" is the same as omitting model — the frontmatter's inherit ` +
          `default silently runs this agent on the PARENT session's model instead of its `
        : `An unrecognized model id runs the risk of silently falling back to the parent session's model instead of the `) +
      `documented ${tierLabel} tier. Add model: "${entry.alias}" to this Agent() call ` +
      `(see CLAUDE.md §6 / AGENTS.md §3.6).`
    : `[TIER-GATE] Dispatching '${subagentType}' without an explicit model= param. ` +
      `Its frontmatter is model: inherit, so omitting model here silently runs it on ` +
      `the PARENT session's model instead of its documented ${tierLabel} tier. ` +
      `Add model: "${entry.alias}" to this Agent() call (see CLAUDE.md §6 / AGENTS.md §3.6).`;

  const response = { decision: 'ask' as const, reason };
  process.stdout.write(JSON.stringify(response) + '\n');
  process.exit(0);
}

main();
