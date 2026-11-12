/**
 * country-scoped-agents.ts
 *
 * Pure planning helpers for pruning country-scoped common AGENTS from non-matching
 * scaffolds (design 2026-11-12-common-agents-for-common-skills, Q4). The registry is
 * docs/workspace-schema.json `country_scoped_assets.agents` ({ "<agent>": "<COUNTRY>" });
 * the filesystem work stays in scripts/helpers/prune-country-scoped-assets.ts.
 *
 * @version 1.0.0
 * v1.0.0 (2026-11-12, CA-3+AE-3): initial — agentsToPrune / agentPrunePaths / scrubAgentReferenceLines.
 */

/** Country-scoped common agents: the agent owns only skills registered under that country. */
export const COUNTRY_SCOPED_AGENTS: Readonly<Record<string, string>> = { "public-data-analyst": "KR" };

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
