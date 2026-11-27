/**
 * country-scoped-agents.ts
 *
 * Pure planning helpers for pruning country-scoped common AGENTS from non-matching
 * scaffolds (design 2026-11-12-common-agents-for-common-skills, Q4). The registry is
 * docs/workspace-schema.json `country_scoped_assets.agents` ({ "<agent>": "<COUNTRY>" });
 * the filesystem work stays in scripts/helpers/prune-country-scoped-assets.ts.
 *
 * @version 1.2.0
 * v1.2.0 (2026-11-28, T-20261127-010 follow-up): +1 pure helper
 *         scrubAgentDetailBlocks — scrubs the managed NON-link forms a
 *         regenerated roster carries for a pruned agent (VARIANT-AGENT-DETAILS
 *         section + VARIANT-PHASE-GATE/VARIANT-DISPATCH-TRIGGERS backticked
 *         rows). The link-line scrub alone left 2 dangling references per
 *         pruned agent on a region-neutral co-deck scaffold once
 *         regenerate-agents-md v1.6.0 rostered country-scoped agents.
 *         Consumers: prune-country-scoped-assets v0.6.0 (scaffold pass),
 *         upgrade-project v1.126.0 (DOCS_MERGE post-scrub).
 * v1.1.0 (T-20261112-005, spec docs/designs/2026-11-14-country-scoped-agents-registry-and-prune-design.md
 *         R1): registry moved into the schema pair (see the block below the header).
 * v1.0.0 (2026-11-12, CA-3+AE-3): initial — agentsToPrune / agentPrunePaths / scrubAgentReferenceLines.
 */

/** v1.1.0 (T-20261112-005, spec docs/designs/2026-11-14-country-scoped-agents-registry-and-prune-design.md
 *          R1): the registry moved INTO the schema pair (docs/workspace-schema.json +
 *          templates/common/docs/workspace-schema.json — hand-maintained) under
 *          `country_scoped_assets.agents`; the constant is gone. `loadCountryScopedAgents`
 *          reads it (default: the repo-root schema; explicit path for tests); a missing
 *          `agents` key yields {} (vacuously clean); malformed JSON throws (fail-closed,
 *          same posture as the other schema readers). The pure helpers below are
 *          unchanged and take the registry as an argument.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_SCHEMA_PATH = resolve(import.meta.dir, "../../docs/workspace-schema.json");

export function loadCountryScopedAgents(schemaPath: string = DEFAULT_SCHEMA_PATH): Record<string, string> {
  const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as {
    country_scoped_assets?: { agents?: Record<string, string> };
  };
  return schema.country_scoped_assets?.agents ?? {};
}

/** True when an asset scoped to `scopedCountry` must be removed for `targetCountry` ("none" / "" = region-neutral). */
export function isPrunedForCountry(targetCountry: string, scopedCountry: string): boolean {
  if (targetCountry === "none" || targetCountry === "") return true;
  return targetCountry !== scopedCountry;
}

/** Registry entries whose country does not match the target country. */
export function agentsToPrune(
  registryAgents: Record<string, string>,
  targetCountry: string,
): Array<{ name: string; scopedCountry: string }> {
  return Object.entries(registryAgents)
    .filter(([, scoped]) => isPrunedForCountry(targetCountry, scoped))
    .map(([name, scopedCountry]) => ({ name, scopedCountry }));
}

/** Project-relative files that make up one delivered common agent (SSOT, Claude mirror, lifecycle record). */
export function agentPrunePaths(name: string): string[] {
  return [`agents/${name}.md`, `.claude/agents/${name}.md`, `docs/lifecycle/agents/${name}.md`];
}

/** Drop AGENTS.md roster lines that link a pruned agent file. */
export function scrubAgentReferenceLines(
  text: string,
  prunedNames: readonly string[],
): { output: string; removed: number } {
  if (prunedNames.length === 0) return { output: text, removed: 0 };
  const lines = text.split("\n");
  const kept = lines.filter((line) => !prunedNames.some((n) => line.includes(`agents/${n}.md`)));
  return { output: kept.join("\n"), removed: lines.length - kept.length };
}

/**
 * v1.2.0 (T-20261127-010 follow-up): scrub the NON-link forms a regenerated
 * roster carries for a pruned agent. `scrubAgentReferenceLines` only removes
 * lines mentioning `agents/<name>.md`; the managed VARIANT-AGENT-DETAILS
 * section (`### <name>` header + its Field/Value table) and the
 * VARIANT-PHASE-GATE / VARIANT-DISPATCH-TRIGGERS data rows (backticked name,
 * no file link) survive it — observed live on a region-neutral co-deck
 * scaffold after regenerate-agents-md v1.6.0 put public-data-analyst into the
 * template roster (2 dangling references per pruned agent). Two passes:
 *   1. details-section removal — from a `### <name>` heading whose name is
 *      pruned, through (not including) the next heading (`#`-prefixed) or
 *      `<!-- VARIANT-` marker line;
 *   2. backticked-name table rows — any line carrying `` `<name>` `` exactly.
 * Pure; consumers (prune-country-scoped-assets scaffold pass, upgrade-project
 * DOCS_MERGE post-scrub) own the file I/O.
 */
export function scrubAgentDetailBlocks(
  text: string,
  prunedNames: readonly string[],
): { output: string; removed: number } {
  if (prunedNames.length === 0) return { output: text, removed: 0 };
  const pruned = new Set(prunedNames);
  const lines = text.split("\n");
  const kept: string[] = [];
  let removed = 0;
  let inPrunedSection = false;
  for (const line of lines) {
    const heading = line.match(/^###\s+(.+?)\s*$/);
    if (heading && pruned.has(heading[1])) {
      inPrunedSection = true;
      removed++;
      continue;
    }
    if (inPrunedSection) {
      // Section ends at the next heading (any level) or a VARIANT-* marker.
      if (/^#{1,6}\s/.test(line) || /^<!--\s*VARIANT-/.test(line)) {
        inPrunedSection = false;
      } else {
        removed++;
        continue;
      }
    }
    const backtick = line.match(/`([a-z0-9-]+)`/);
    if (backtick && pruned.has(backtick[1]) && line.includes("|")) {
      removed++;
      continue;
    }
    kept.push(line);
  }
  return { output: kept.join("\n"), removed };
}
