#!/usr/bin/env bun
/**
 * regenerate-agents-md.ts
 * @version 1.6.0
 *
 * v1.6.0 (2026-11-28, T-20261127-010, spec docs/designs/2026-11-28-common-agent-roster-regen-design.md):
 *         --variant rosters list the DELIVERED agent set, not just the variant's
 *         own agents. new-project copyDir(commonDir) delivers every
 *         templates/common/agents/*.md into the project (agents/_COMMON.md is
 *         removed post-copy as L1-only — NEW_PROJECT_L1_ONLY_AGENTS; pm.md is
 *         excluded by the roster convention; the variant overlay wins on name
 *         collision). regenerate-agents-md --variant now scans
 *         templates/common/agents/ and appends the common-only agents (sorted,
 *         variant-listed names deduped) after the variant agents, so a fresh
 *         scaffold's agent-lifecycle-audit Check 5 (delivered agent missing
 *         from the AGENTS.md roster) is clean. Country-scoped common agents
 *         (public-data-analyst, docs/workspace-schema.json
 *         country_scoped_assets.agents) STAY in the template roster — the
 *         template ships the superset and scaffold-time
 *         prune-country-scoped-assets v0.5.0 scrubs the roster row for
 *         non-matching countries (design
 *         2026-11-12-common-agents-for-common-skills Q4; same principle as the
 *         §6 skill-table superset note below). --source mode is unchanged: it
 *         already scans the project's agents/ dir, which carries the delivered
 *         common copies.
 *
 * v1.5.0 (2026-11-11, U-20261111-003 from co-deck, spec
 *         docs/designs/2026-11-11-co-deck-upstream-fixes-design.md §U-003): three
 *         defects that made the regen path unusable on a real variant.
 *         (1) Tier: a flat `tier: low` frontmatter key was ignored (only the
 *         nested `tier:\n  claude:` form was read), so every flat-tier agent
 *         rendered as the "medium" default. The flat key is now the fallback.
 *         (2) Role: a bare category token (`role: specialist`, inherited from
 *         the L1 i18n-specialist) was printed verbatim as the role text. A
 *         single-word role now falls back to the description (minus its
 *         `Use when:` trailer and wrapping quotes).
 *         (3) Static content: the target AGENTS.md was always rebuilt from the
 *         L1 common template, discarding every variant-authored line outside
 *         the VARIANT-* blocks (~425 lines in co-deck). When the target already
 *         carries any VARIANT-*-START/END marker pair, the present managed
 *         blocks are rewritten in place (absent blocks are reported, not
 *         invented). A target with no markers, or an explicit
 *         `--from-template`, keeps the original full rebuild (the
 *         l3-to-variant-pipeline auto-fix passes `--from-template`).
 *
 * v1.4.0 (2026-10-29, U-20261028-009): VARIANT-PHASE-GATE blocks emit the same
 *         header+separator shape as the sibling VARIANT-DISPATCH-TRIGGERS block
 *         (bare data rows shipped headerless tables), and empty agent phases
 *         render the defined "Phase —" placeholder instead of the unresolved
 *         "Phase ?" (phase pinning is an owner call, not a generator default).
 *
 * v1.2.0 (2026-09-26, tier-extraction hygiene): strip inline YAML
 *         comments in tier.* extraction (`medium # claude-sonnet-5-0` →
 *         `medium`) — a commented tier value leaked the comment into the
 *         generated AGENTS.md roster rows.
 *
 * Regenerates variant AGENTS.md from the L1 common template with variant-specific
 * VARIANT-*-START/END blocks filled in from agent frontmatter.
 *
 * Usage:
 *   bun scripts/regenerate-agents-md.ts --variant co-consult
 *   bun scripts/regenerate-agents-md.ts --all
 *   bun scripts/regenerate-agents-md.ts --dry-run --variant co-work
 *   bun scripts/regenerate-agents-md.ts --source Projects/co-hr   # L3 source, in place
 *
 * Problem solved: Variants generated before the §-numbered AGENTS.md structure
 * was introduced lack VARIANT-*-START/END markers, so l3-to-variant-pipeline.ts
 * injection has no anchors to replace. This script regenerates from scratch.
 * v1.1.0 adds --source <dir>: regenerate an L3 project's AGENTS.md in place
 * (roster scanned from <dir>/agents/*.md — L3 sources have no variant.json
 * `agents` array), used by the pipeline's --auto-fix-agents-md for sources
 * outside templates/.
 */

import * as fs from "node:fs";
import * as path from "node:path";

const TEMPLATES_DIR = "templates";
const COMMON_AGENTS_TEMPLATE = path.join(TEMPLATES_DIR, "common", "AGENTS.md");
// v1.6.0 (T-20261127-010): the delivery source for the common agents every
// project receives at new-project instantiation (copyDir(commonDir)).
const COMMON_AGENTS_DIR = path.join(TEMPLATES_DIR, "common", "agents");

interface AgentMeta {
  name: string;
  file: string;
  tier: string;
  phases: string;
  role: string;
  description: string;
}

export function parseSimpleFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const result: Record<string, string> = {};
  const lines = match[1].split("\n");
  let currentKey = "";
  let inBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // tier.claude extraction (strip inline YAML comments: `medium # claude-sonnet-5-0`)
    if (line.match(/^\s+claude:\s+(.+)/)) {
      const m = line.match(/^\s+claude:\s+(.+)/);
      if (m) result["tier.claude"] = m[1].replace(/\s+#.*$/, "").trim();
    }
    // simple key: value (strip inline YAML comments)
    const simple = line.match(/^(\w[\w-]*):\s+(.+)/);
    if (simple && !inBlock) {
      currentKey = simple[1];
      result[currentKey] = simple[2]
        .replace(/\s+#.*$/, "")
        .trim()
        .replace(/^>-?\s*/, "");
    }
    // multi-line description block (starts with >)
    const blockStart = line.match(/^(\w[\w-]*):\s*>-?$/);
    if (blockStart) {
      currentKey = blockStart[1];
      inBlock = true;
      result[currentKey] = "";
      continue;
    }
    if (inBlock) {
      if (line.match(/^\s+/) || line === "") {
        result[currentKey] = (result[currentKey] + " " + line.trim()).trim();
      } else {
        inBlock = false;
      }
    }
    // phases: [1, 2]
    const phasesMatch = line.match(/^phases:\s*(.+)/);
    if (phasesMatch) result["phases"] = phasesMatch[1].trim();
  }
  return result;
}

/** Strip wrapping YAML quotes and the trailing `Use when: ...` trigger list. */
export function cleanDescription(raw: string | undefined): string {
  if (!raw) return "";
  let d = raw.trim();
  if ((d.startsWith("'") && d.endsWith("'")) || (d.startsWith('"') && d.endsWith('"'))) {
    d = d.slice(1, -1).trim();
  }
  return d
    .replace(/\s*Use when:.*$/s, "")
    .replace(/\.$/, "")
    .trim();
}

/**
 * U-20261111-003 (1): nested `tier:\n  claude: <t>` wins; the flat `tier: <t>`
 * key is the fallback (co-deck agents declare the flat form). "medium" only
 * when neither exists.
 */
export function resolveTier(fm: Record<string, string>): string {
  const flat = (fm["tier"] ?? "").trim();
  return (fm["tier.claude"] || flat || "medium").toLowerCase();
}

/**
 * U-20261111-003 (2): a single-token role (`specialist`, `orchestrator`) is a
 * category, not role text — fall back to the cleaned description.
 */
export function resolveRole(fm: Record<string, string>, agentName: string): string {
  const role = (fm["role"] ?? "").trim();
  const description = cleanDescription(fm["description"]);
  if (role && /\s/.test(role)) return role;
  return description || role || agentName;
}

function readAgentMeta(agentsDir: string, rel: string): AgentMeta {
  const agentFile = path.join(agentsDir, `${rel}.md`);
  const content = fs.readFileSync(agentFile, "utf-8");
  const fm = parseSimpleFrontmatter(content);
  const name = rel.includes("/") ? rel.slice(rel.lastIndexOf("/") + 1) : rel;

  const tier = resolveTier(fm);
  const phasesRaw = fm["phases"] || "";
  // Convert [1, 2] → "1, 2"
  const phases = phasesRaw.replace(/[\[\]]/g, "").replace(/,\s*/g, ", ");
  const role = resolveRole(fm, name);
  const description = cleanDescription(fm["description"]) || role;

  return {
    name,
    file: `agents/${rel}.md`,
    tier,
    phases,
    role,
    description,
  };
}

/**
 * v1.6.0 (T-20261127-010): agent names delivered from the common template's
 * agents/ directory. Mirrors the new-project delivery rule (copyDir(commonDir)):
 * every *.md file is an agent EXCEPT pm.md (variant pm wins; excluded from the
 * roster by convention) and `_`-prefixed partials (agents/_COMMON.md is removed
 * post-copy as L1-only — NEW_PROJECT_L1_ONLY_AGENTS). Country-scoped common
 * agents (public-data-analyst) are INCLUDED: the template AGENTS.md ships the
 * superset roster and scaffold-time prune-country-scoped-assets scrubs the row
 * for non-matching countries. Sorted for stable output.
 */
export function scanCommonAgentNames(commonAgentsDir: string): string[] {
  if (!fs.existsSync(commonAgentsDir)) return [];
  return fs
    .readdirSync(commonAgentsDir)
    .filter((f) => f.endsWith(".md") && !f.startsWith("_") && f !== "pm.md")
    .map((f) => f.replace(/\.md$/, ""))
    .sort();
}

/**
 * v1.6.0 (T-20261127-010): every agent file the variant's own agents/ tree
 * delivers, as relpaths under agents/ sans the .md suffix. RECURSIVE on
 * purpose: nested trees (co-safety's agents/domains/, agents/_shared/) are
 * delivered by the variant overlay whole and validate-templates
 * (findUndeclaredAgents) documents the contract that nested agents are
 * "indexed via the variant's AGENTS.md" — so a regenerated roster must
 * re-index them, not silently drop them. pm.md and README* excluded. Sorted
 * for stable output.
 */
export function scanVariantTreeAgentFiles(variantAgentsDir: string): string[] {
  if (!fs.existsSync(variantAgentsDir)) return [];
  const out: string[] = [];
  const walk = (dir: string, prefix: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        walk(path.join(dir, e.name), prefix ? `${prefix}/${e.name}` : e.name);
      } else if (e.isFile() && e.name.endsWith(".md") && e.name !== "pm.md" && !e.name.startsWith("README")) {
        out.push(prefix ? `${prefix}/${e.name.replace(/\.md$/, "")}` : e.name.replace(/\.md$/, ""));
      }
    }
  };
  walk(variantAgentsDir, "");
  return out.sort();
}

export interface RosterEntry {
  /** Short agent name (basename) — the roster row's bold label. */
  name: string;
  /** Path under agents/ sans .md — renders as `agents/<rel>.md` links. */
  rel: string;
  /** Which agents/ dir the metadata is read from at delivery. */
  source: "variant" | "common";
}

/**
 * v1.6.0 (T-20261127-010): the delivered roster for a variant, in three
 * ordered groups —
 *   1. the variant's declared agents (variant.json, pm dropped by the roster
 *      convention; declared order preserved so existing rows keep positions),
 *   2. the variant tree's undeclared agents (nested trees, sorted by relpath —
 *      delivered by the overlay and indexed via AGENTS.md),
 *   3. the common-only agents (sorted; a name the variant itself ships
 *      dedupes to the variant entry — at delivery the variant overlay copy
 *      wins, so the variant file is the one the roster must describe).
 * Duplicate-name-safe: the same basename delivered twice (declared flat +
 * nested tree copy) is emitted once per distinct relpath, never twice.
 */
export function buildVariantRoster(declaredNames: string[], treeFiles: string[], commonNames: string[]): RosterEntry[] {
  const declared = declaredNames.filter((n) => n !== "pm");
  const declaredSet = new Set(declared);
  const treeOnly = treeFiles.filter((rel) => {
    if (rel === "pm" || rel.endsWith("/pm")) return false; // roster convention
    if (declaredSet.has(rel)) return false;
    const base = rel.includes("/") ? rel.slice(rel.lastIndexOf("/") + 1) : rel;
    return !declaredSet.has(base);
  });
  const treeOnlyBases = new Set(treeOnly.map((rel) => (rel.includes("/") ? rel.slice(rel.lastIndexOf("/") + 1) : rel)));
  const commonOnly = commonNames.filter((n) => n !== "pm" && !declaredSet.has(n) && !treeOnlyBases.has(n));
  const entries: RosterEntry[] = [
    ...declared.map((n) => ({ name: n, rel: n, source: "variant" as const })),
    ...treeOnly.map((rel) => ({
      name: rel.includes("/") ? rel.slice(rel.lastIndexOf("/") + 1) : rel,
      rel,
      source: "variant" as const,
    })),
    ...commonOnly.map((n) => ({ name: n, rel: n, source: "common" as const })),
  ];
  return entries;
}

function deriveDispatchTriggers(agent: AgentMeta): string[] {
  // Derive sensible dispatch triggers from agent name and role
  const name = agent.name.replace(/-/g, " ");
  const role = agent.role.toLowerCase();
  const triggers: string[] = [`"${name}"`];

  // Add role-based triggers
  if (role.includes("research") || role.includes("analysis") || role.includes("investigation")) {
    triggers.push('"research"', '"analyze"', '"investigate"');
  }
  if (role.includes("design")) {
    triggers.push('"design"', '"create design"');
  }
  if (role.includes("document") || role.includes("write") || role.includes("writer")) {
    triggers.push('"write"', '"document"', '"draft"');
  }
  if (role.includes("strategy") || role.includes("strategic")) {
    triggers.push('"strategy"', '"strategic analysis"');
  }
  if (role.includes("security") || role.includes("pentest") || role.includes("vulnerability")) {
    triggers.push('"security"', '"pentest"', '"vulnerability"');
  }
  if (role.includes("prototype") || role.includes("build")) {
    triggers.push('"prototype"', '"build"');
  }
  if (role.includes("report")) {
    triggers.push('"report"', '"write report"');
  }
  if (role.includes("patch") || role.includes("remediation")) {
    triggers.push('"patch"', '"remediate"', '"fix vulnerability"');
  }
  if (role.includes("communication") || role.includes("narrative")) {
    triggers.push('"communicate"', '"presentation"', '"narrative"');
  }
  if (role.includes("ux") || role.includes("user research")) {
    triggers.push('"user research"', '"usability"', '"ux"');
  }
  if (role.includes("visual") || role.includes("typography") || role.includes("font")) {
    triggers.push('"visual"', '"typography"', '"font"');
  }
  if (role.includes("microsoft") || role.includes("ms365") || role.includes("365")) {
    triggers.push('"microsoft 365"', '"sharepoint"', '"teams"', '"outlook"');
  }
  if (role.includes("threat") || role.includes("stride") || role.includes("attack")) {
    triggers.push('"threat model"', '"stride"', '"attack surface"');
  }
  if (role.includes("red team") || role.includes("attack methodology")) {
    triggers.push('"red team"', '"attack"', '"exploitation"');
  }
  if (role.includes("delivery") || role.includes("coordinator") || role.includes("schedule")) {
    triggers.push('"schedule"', '"coordinate"', '"track progress"');
  }
  if (role.includes("change management") || role.includes("transformation")) {
    triggers.push('"change management"', '"organizational transformation"', '"stakeholder"');
  }
  if (role.includes("industry") || role.includes("competitive") || role.includes("regulatory")) {
    triggers.push('"industry"', '"market landscape"', '"competitive analysis"');
  }
  if (role.includes("subject matter") || role.includes("functional expertise")) {
    triggers.push('"sme"', '"subject matter"', '"functional expertise"');
  }
  if (role.includes("solution") || role.includes("architecture")) {
    triggers.push('"solution design"', '"architecture"', '"technical solution"');
  }
  if (role.includes("workstream") || role.includes("team coordination")) {
    triggers.push('"workstream"', '"track deliverables"', '"team coordination"');
  }
  if (role.includes("data") || role.includes("statistical") || role.includes("model")) {
    triggers.push('"data analysis"', '"statistics"', '"data model"');
  }
  if (role.includes("service designer") || role.includes("customer journey")) {
    triggers.push('"service design"', '"customer journey"', '"service map"');
  }

  // Dedupe and limit
  return [...new Set(triggers)].slice(0, 5);
}

function derivePhaseGateRow(agent: AgentMeta): string {
  // U-20261028-009: empty phases render the defined "Phase —" placeholder,
  // never the unresolved "Phase ?" (pinning the phases is an owner call).
  const phasesDisplay = agent.phases ? `Phase ${agent.phases}` : "Phase —";
  const tierCap = agent.tier.charAt(0).toUpperCase() + agent.tier.slice(1);
  return `| ${agent.role.split(",")[0].trim()} | ${phasesDisplay} | \`${agent.name}\` | ${tierCap} | |`;
}

function deriveRoleBoundaryRow(agent: AgentMeta): string {
  const task = agent.role.split(".")[0].trim();
  return `| ${task} | \`${agent.name}\` | \`pm\` |`;
}

function generateVariantBlocks(agents: AgentMeta[]): Record<string, string> {
  // VARIANT-AGENTS
  const agentRows = agents
    .map((a) => {
      const tierCap = a.tier.charAt(0).toUpperCase() + a.tier.slice(1);
      return `| **${a.name}** | [\`${a.file}\`](${a.file}) | ${tierCap} | ${a.role} |`;
    })
    .join("\n");

  // VARIANT-AGENT-DETAILS
  const agentDetails = agents
    .map((a) => {
      return `### ${a.name}\n\n| Field | Value |\n|-------|-------|\n| **File** | [\`${a.file}\`](${a.file}) |\n| **Tier** | ${a.tier} |\n| **Phases** | ${a.phases || "—"} |\n| **Role** | ${a.role} |`;
    })
    .join("\n\n");

  // VARIANT-DISPATCH-TRIGGERS
  const triggerRows = agents
    .map((a) => {
      const triggers = deriveDispatchTriggers(a).join(", ");
      const phasesDisplay = a.phases ? `Phase ${a.phases.split(",")[0].trim()}` : "—";
      return `| \`${a.name}\` | ${phasesDisplay} | ${triggers} |`;
    })
    .join("\n");
  const dispatchTriggers = `| Agent | Phase | Dispatch Trigger |\n|-------|-------|------------------|\n${triggerRows}`;

  // VARIANT-PHASE-GATE — U-20261028-009: emit the same header+separator shape
  // as the sibling VARIANT-DISPATCH-TRIGGERS block (:213-216); bare data rows
  // directly after the START marker shipped headerless tables into every
  // regenerated AGENTS.md.
  const phaseGateRows = agents.map((a) => derivePhaseGateRow(a)).join("\n");
  const phaseGate = `| Deliverable Type | Phase | Required Agent | Tier | Notes |\n|------------------|-------|----------------|------|-------|\n${phaseGateRows}`;

  // VARIANT-SUBAGENT-ROSTER
  const rosterRows = agents
    .map((a) => {
      const tierCap = a.tier.charAt(0).toUpperCase() + a.tier.slice(1);
      const parallelizable = a.phases && a.phases.includes(",") ? "sequential (phase-ordered)" : "❌ serial";
      return `| ${a.name} | \`${a.file}\` | ${tierCap} | ${parallelizable} | ✅ within phase scope |`;
    })
    .join("\n");

  // VARIANT-ROLE-BOUNDARY
  const roleBoundaryRows = agents.map((a) => deriveRoleBoundaryRow(a)).join("\n");

  return {
    "VARIANT-AGENTS": agentRows,
    "VARIANT-AGENT-DETAILS": agentDetails,
    "VARIANT-DISPATCH-TRIGGERS": dispatchTriggers,
    "VARIANT-PHASE-GATE": phaseGate,
    "VARIANT-SUBAGENT-ROSTER": rosterRows,
    "VARIANT-ROLE-BOUNDARY": roleBoundaryRows,
  };
}

export const VARIANT_BLOCK_KEYS = [
  "VARIANT-AGENTS",
  "VARIANT-AGENT-DETAILS",
  "VARIANT-DISPATCH-TRIGGERS",
  "VARIANT-PHASE-GATE",
  "VARIANT-SUBAGENT-ROSTER",
  "VARIANT-ROLE-BOUNDARY",
] as const;

/** VARIANT-* keys whose START/END marker pair is present in `content`. */
export function presentVariantMarkers(content: string): string[] {
  return VARIANT_BLOCK_KEYS.filter(
    (k) => content.includes(`<!-- ${k}-START -->`) && content.includes(`<!-- ${k}-END -->`),
  );
}

/**
 * U-20261111-003 (3): choose the base document. An existing target carrying at
 * least one VARIANT-* marker pair is updated in place — present blocks are
 * rewritten, static content is preserved, and absent blocks are reported (not
 * invented). A target with no markers, or --from-template, uses the L1 common
 * template as the base (full rebuild — the script's original purpose).
 */
export function selectBase(existing: string | null, template: string, fromTemplate: boolean): string {
  if (!fromTemplate && existing !== null && presentVariantMarkers(existing).length > 0) return existing;
  return template;
}

export function injectBlocks(template: string, blocks: Record<string, string>): string {
  let result = template;
  for (const [key, content] of Object.entries(blocks)) {
    const startMarker = `<!-- ${key}-START -->`;
    const endMarker = `<!-- ${key}-END -->`;
    const startIdx = result.indexOf(startMarker);
    const endIdx = result.indexOf(endMarker);
    if (startIdx === -1 || endIdx === -1) {
      console.warn(
        `  ⚠️  Marker not found: ${key}-START/END — block skipped (--from-template rebuilds with all markers)`,
      );
      continue;
    }
    const before = result.slice(0, startIdx + startMarker.length);
    const after = result.slice(endIdx);
    result = `${before}\n${content}\n${after}`;
  }
  return result;
}

function regenerateVariant(variantName: string, dryRun: boolean, fromTemplate: boolean): void {
  const variantDir = path.join(TEMPLATES_DIR, variantName);
  const variantJson = path.join(variantDir, "variant.json");
  const outputPath = path.join(variantDir, "AGENTS.md");

  if (!fs.existsSync(variantDir)) {
    console.error(`  ❌ Variant directory not found: ${variantDir}`);
    return;
  }
  if (!fs.existsSync(variantJson)) {
    console.error(`  ❌ variant.json not found: ${variantJson}`);
    return;
  }

  const variant = JSON.parse(fs.readFileSync(variantJson, "utf-8"));
  // v1.6.0 (T-20261127-010): roster = declared agents + variant-tree agents +
  // delivered common agents (see buildVariantRoster for the grouping rules).
  const declared: string[] = (variant.agents ?? [])
    .map((a: { name: string }) => a.name)
    .filter((n: string) => n !== "pm");
  const roster = buildVariantRoster(
    declared,
    scanVariantTreeAgentFiles(path.join(variantDir, "agents")),
    scanCommonAgentNames(COMMON_AGENTS_DIR),
  );

  console.log(`\n📦 Regenerating AGENTS.md for ${variantName}`);
  console.log(`   Agents: ${roster.map((e) => e.rel).join(", ")}`);

  // Read agent metadata — variant agents from the variant's own agents/
  // (overlay-wins at delivery), common-only agents from templates/common/agents/.
  const agents: AgentMeta[] = [];
  for (const entry of roster) {
    const agentsDir = entry.source === "variant" ? path.join(variantDir, "agents") : COMMON_AGENTS_DIR;
    const agentFile = path.join(agentsDir, `${entry.rel}.md`);
    if (!fs.existsSync(agentFile)) {
      console.warn(`  ⚠️  Agent file not found: ${agentFile} — skipping`);
      continue;
    }
    agents.push(readAgentMeta(agentsDir, entry.rel));
  }

  // Read L1 template; an existing fully-marked AGENTS.md is updated in place
  const template = fs.readFileSync(COMMON_AGENTS_TEMPLATE, "utf-8");
  const existing = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, "utf-8") : null;
  const base = selectBase(existing, template, fromTemplate);
  console.log(`   Mode: ${base === template ? "full rebuild from L1 template" : "in-place managed-block update"}`);

  // Generate variant-specific blocks
  const blocks = generateVariantBlocks(agents);

  // Inject into the chosen base
  const generated = injectBlocks(base, blocks);

  if (dryRun) {
    console.log(`\n--- DRY RUN: Would write to ${outputPath} ---`);
    console.log(generated.slice(0, 500) + "\n...");
    return;
  }

  fs.writeFileSync(outputPath, generated, "utf-8");
  console.log(`  ✅ Written: ${outputPath}`);
}

/**
 * Regenerate an L3 source project's AGENTS.md in place.
 * L3 sources (Projects/<name>/) have no variant.json `agents` array, so the
 * roster is derived by scanning agents/*.md (pm.md excluded, same rule as
 * regenerateVariant). Reuses the same L1 template + block pipeline.
 */
/**
 * L3-only §6 hygiene: the L1 common §6 skills table also lists L0-only
 * skills (l2_propagate:false — create-variant, promote-variant,
 * simulate-pipeline, …) that are never delivered to a project, and a
 * regenerated L3 AGENTS.md carrying those rows fails the project audit's
 * stale-§6-skill-path check. Keep a skills-table row only when the
 * referenced skill directory actually exists in the L3 source. (--variant
 * mode is unaffected: an L2 template deliberately ships the superset
 * table; scaffold/upgrade own the project-level sweep.)
 */
function pruneUndeliveredSkillRows(generated: string, sourceDir: string): string {
  return generated
    .split("\n")
    .filter((line) => {
      const m = line.match(/^\| `[^`]+` \| `skills\/([^/`]+)\/`/);
      if (!m) return true;
      return fs.existsSync(path.join(sourceDir, "skills", m[1], "SKILL.md"));
    })
    .join("\n");
}

function regenerateSource(sourceDir: string, dryRun: boolean, fromTemplate: boolean): void {
  const agentsDir = path.join(sourceDir, "agents");
  if (!fs.existsSync(agentsDir)) {
    console.error(`  ❌ agents/ directory not found: ${agentsDir}`);
    if (import.meta.main) {
      process.exit(1);
    }
    return;
  }

  // v1.6.0 (T-20261127-010): recursive tree scan — an L3 project's agents/ dir
  // carries the delivered tree (variant agents + nested trees + the common
  // copies), and the roster must index all of it. pm.md and README* excluded
  // by the roster convention.
  const allAgentRels: string[] = scanVariantTreeAgentFiles(agentsDir);

  console.log(`\n📦 Regenerating AGENTS.md for L3 source ${sourceDir}`);
  console.log(`   Agents: ${allAgentRels.join(", ")}`);

  const agents: AgentMeta[] = [];
  for (const rel of allAgentRels) {
    agents.push(readAgentMeta(path.join(sourceDir, "agents"), rel));
  }

  const template = fs.readFileSync(COMMON_AGENTS_TEMPLATE, "utf-8");
  const outputPath = path.join(sourceDir, "AGENTS.md");
  const existing = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, "utf-8") : null;
  const base = selectBase(existing, template, fromTemplate);
  const inPlace = base !== template;
  console.log(`   Mode: ${inPlace ? "in-place managed-block update" : "full rebuild from L1 template"}`);
  const blocks = generateVariantBlocks(agents);
  const injected = injectBlocks(base, blocks);
  // The §6 skill-row prune targets the L1 superset table; an in-place update
  // leaves the project's own static content untouched.
  const generated = inPlace ? injected : pruneUndeliveredSkillRows(injected, sourceDir);

  if (dryRun) {
    console.log(`\n--- DRY RUN: Would write to ${outputPath} ---`);
    console.log(generated.slice(0, 500) + "\n...");
    return;
  }

  fs.writeFileSync(outputPath, generated, "utf-8");
  console.log(`  ✅ Written: ${outputPath}`);
}

// CLI entry point (guarded so unit tests can import the pure helpers)
if (import.meta.main) {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");
  const allFlag = args.includes("--all");
  const fromTemplate = args.includes("--from-template");
  const variantIdx = args.indexOf("--variant");
  const variantName = variantIdx !== -1 ? args[variantIdx + 1] : null;
  const sourceIdx = args.indexOf("--source");
  const sourceDir = sourceIdx !== -1 ? args[sourceIdx + 1] : null;

  const MISALIGNED_VARIANTS = ["co-consult", "co-work", "co-security", "co-design"];

  if (!COMMON_AGENTS_TEMPLATE || !fs.existsSync(COMMON_AGENTS_TEMPLATE)) {
    console.error(`❌ L1 template not found: ${COMMON_AGENTS_TEMPLATE}`);
    if (import.meta.main) {
      process.exit(1);
    }
  }

  if (allFlag) {
    for (const v of MISALIGNED_VARIANTS) {
      regenerateVariant(v, isDryRun, fromTemplate);
    }
  } else if (sourceDir) {
    regenerateSource(path.resolve(sourceDir), isDryRun, fromTemplate);
  } else if (variantName) {
    regenerateVariant(variantName, isDryRun, fromTemplate);
  } else {
    console.log(`Usage:
  bun scripts/regenerate-agents-md.ts --variant <name>   # Single variant
  bun scripts/regenerate-agents-md.ts --all              # All misaligned variants
  bun scripts/regenerate-agents-md.ts --source <dir>     # L3 source, in place
  bun scripts/regenerate-agents-md.ts --dry-run --all    # Preview without writing
  --from-template  force a full rebuild from the L1 template (default: in-place
                   managed-block update when the target has VARIANT-* markers;
                   use --from-template to add missing marker blocks)

Misaligned variants: ${MISALIGNED_VARIANTS.join(", ")}`);
    if (import.meta.main) {
      process.exit(0);
    }
  }
}
