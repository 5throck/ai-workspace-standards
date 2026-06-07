#!/usr/bin/env bun
/**
 * layer-filter.ts — Single Layer Filter Engine
 * @version 1.0.0
 * @status active
 *
 * Reads SCRIPTS.md and SKILLS.md layer columns and provides
 * filtering functions for publish-to-template, create-l2-scaffold,
 * validate-templates, and new-project.sh.
 *
 * Layer values:
 *   L0        = workspace root only
 *   L0+L1     = templates/common + all L2 projects (identically)
 *   L0+L1+L2  = variant-specific (common base + co-* override)
 */

import * as fs from "fs";
import * as path from "path";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type LayerValue = "L0" | "L0+L1" | "L0+L1+L2";

// ─────────────────────────────────────────────────────────────────────────────
// Backward-compat mapping
// ─────────────────────────────────────────────────────────────────────────────

function normalizeLayer(raw: string): LayerValue {
  const v = raw.trim();
  if (v === "L0-only" || v === "L0") return "L0";
  if (v === "common" || v === "L0+L1") return "L0+L1";
  if (v === "L0+L1+L2") return "L0+L1+L2";
  // Default unrecognized values to L0+L1 (safe — keeps script in template)
  return "L0+L1";
}

// ─────────────────────────────────────────────────────────────────────────────
// parseScriptLayers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse SCRIPTS.md Registry section and return a Map<scriptName, LayerValue>.
 *
 * Column order (0-based from split on '|', first element is empty):
 *   script | source | version | status | removal-date | security-advisory | layer | pair
 * Dynamically resolves column index from the header row for robustness.
 */
export function parseScriptLayers(
  scriptsMdPath?: string,
): Map<string, LayerValue> {
  const mdPath =
    scriptsMdPath ?? path.join(process.cwd(), "scripts", "SCRIPTS.md");
  const result = new Map<string, LayerValue>();

  let content: string;
  try {
    content = fs.readFileSync(mdPath, "utf8");
  } catch {
    console.warn(`[layer-filter] Could not read SCRIPTS.md at ${mdPath}`);
    return result;
  }

  let inRegistry = false;
  let headerParsed = false;
  let scriptColIndex = -1;
  let layerColIndex = -1;

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();

    if (/^## Registry/.test(line)) {
      inRegistry = true;
      continue;
    }
    if (inRegistry && /^## /.test(line)) break;
    if (!inRegistry) continue;
    if (!line.startsWith("|")) continue;

    if (!headerParsed) {
      const cols = line.split("|").map((c) => c.trim().toLowerCase());
      scriptColIndex = cols.findIndex((c) => c === "script");
      layerColIndex = cols.findIndex((c) => c === "layer");
      if (scriptColIndex >= 0 && layerColIndex >= 0) headerParsed = true;
      continue;
    }

    // Skip separator rows
    if (/^\|[-\s|]+\|$/.test(line)) continue;

    const cols = line.split("|").map((c) => c.trim());
    const scriptCell = cols[scriptColIndex] ?? "";
    const layerCell = cols[layerColIndex] ?? "";

    if (!scriptCell) continue;

    const scriptName = scriptCell.replace(/`/g, "").trim();
    const layer = normalizeLayer(layerCell);
    result.set(scriptName, layer);
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// parseSkillLayers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse SKILLS.md Registry section and return a Map<skillName, LayerValue>.
 *
 * Expected columns: skill | version | status | layer | owner | last_reviewed | removal-date | notes
 * Dynamically resolves column index from header row.
 *
 * Fallback: if SKILLS.md is not found, iterate skills/star/SKILL.md and read
 * the scope: frontmatter field:
 *   scope: workspace -> L0
 *   scope: common   -> L0+L1 (default)
 *   (no scope)      -> L0+L1
 */
export function parseSkillLayers(
  skillsDirPath?: string,
  skillsMdPath?: string,
): Map<string, LayerValue> {
  const mdPath =
    skillsMdPath ?? path.join(process.cwd(), "skills", "SKILLS.md");
  const skillsDir = skillsDirPath ?? path.join(process.cwd(), "skills");
  const result = new Map<string, LayerValue>();

  // Try SKILLS.md first
  if (fs.existsSync(mdPath)) {
    let content: string;
    try {
      content = fs.readFileSync(mdPath, "utf8");
    } catch {
      console.warn(`[layer-filter] Could not read SKILLS.md at ${mdPath}`);
      return _parseSkillLayersFromFrontmatter(skillsDir);
    }

    let inRegistry = false;
    let headerParsed = false;
    let skillColIndex = -1;
    let layerColIndex = -1;

    for (const rawLine of content.split("\n")) {
      const line = rawLine.trim();

      if (/^## Registry/.test(line)) {
        inRegistry = true;
        continue;
      }
      if (inRegistry && /^## /.test(line)) break;
      if (!inRegistry) continue;
      if (!line.startsWith("|")) continue;

      if (!headerParsed) {
        const cols = line.split("|").map((c) => c.trim().toLowerCase());
        skillColIndex = cols.findIndex((c) => c === "skill");
        layerColIndex = cols.findIndex((c) => c === "layer");
        if (skillColIndex >= 0 && layerColIndex >= 0) headerParsed = true;
        continue;
      }

      if (/^\|[-\s|]+\|$/.test(line)) continue;

      const cols = line.split("|").map((c) => c.trim());
      const skillCell = cols[skillColIndex] ?? "";
      const layerCell = cols[layerColIndex] ?? "";

      if (!skillCell) continue;

      const skillName = skillCell.replace(/`/g, "").trim();
      const layer = normalizeLayer(layerCell);
      result.set(skillName, layer);
    }

    if (result.size > 0) return result;
  }

  // Fallback: read SKILL.md frontmatter
  return _parseSkillLayersFromFrontmatter(skillsDir);
}

function _parseSkillLayersFromFrontmatter(skillsDir: string): Map<string, LayerValue> {
  const result = new Map<string, LayerValue>();

  if (!fs.existsSync(skillsDir)) return result;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  } catch {
    return result;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillMdPath = path.join(skillsDir, entry.name, "SKILL.md");
    if (!fs.existsSync(skillMdPath)) continue;

    let content: string;
    try {
      content = fs.readFileSync(skillMdPath, "utf8");
    } catch {
      continue;
    }

    // Read YAML frontmatter block
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    let layer: LayerValue = "L0+L1"; // default
    if (fmMatch) {
      const fmLines = fmMatch[1].split("\n");
      for (const fmLine of fmLines) {
        const scopeMatch = fmLine.match(/^\s*scope\s*:\s*(.+)$/);
        if (scopeMatch) {
          const scope = scopeMatch[1].trim().toLowerCase();
          if (scope === "workspace") layer = "L0";
          else if (scope === "common") layer = "L0+L1";
          break;
        }
      }
    }

    result.set(entry.name, layer);
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Script inclusion helpers
// ─────────────────────────────────────────────────────────────────────────────

let _cachedScriptLayers: Map<string, LayerValue> | null = null;

function _getScriptLayers(layers?: Map<string, LayerValue>): Map<string, LayerValue> {
  if (layers) return layers;
  if (!_cachedScriptLayers) _cachedScriptLayers = parseScriptLayers();
  return _cachedScriptLayers;
}

/** Should this script be included in templates/common (L1)? */
export function includeScriptInL1(
  scriptName: string,
  layers?: Map<string, LayerValue>,
): boolean {
  const layer = getScriptLayer(scriptName, layers);
  return layer === "L0+L1" || layer === "L0+L1+L2";
}

/** Should this script be included when scaffolding an L2 project? */
export function includeScriptInL2(
  scriptName: string,
  layers?: Map<string, LayerValue>,
): boolean {
  const layer = getScriptLayer(scriptName, layers);
  return layer === "L0+L1" || layer === "L0+L1+L2";
}

/** Get the layer value for a specific script. Defaults to L0+L1 if unknown. */
export function getScriptLayer(
  scriptName: string,
  layers?: Map<string, LayerValue>,
): LayerValue {
  const map = _getScriptLayers(layers);

  // Try exact match first
  if (map.has(scriptName)) return map.get(scriptName)!;

  // Try base name match (e.g. "audit.ts" matches "helpers/audit.ts")
  const baseName = path.basename(scriptName);
  for (const [key, val] of map) {
    if (path.basename(key) === baseName) return val;
  }

  return "L0+L1"; // safe default
}

// ─────────────────────────────────────────────────────────────────────────────
// Skill inclusion helpers
// ─────────────────────────────────────────────────────────────────────────────

let _cachedSkillLayers: Map<string, LayerValue> | null = null;

function _getSkillLayers(layers?: Map<string, LayerValue>): Map<string, LayerValue> {
  if (layers) return layers;
  if (!_cachedSkillLayers) _cachedSkillLayers = parseSkillLayers();
  return _cachedSkillLayers;
}

/** Should this skill be included in templates/common (L1)? */
export function includeSkillInL1(
  skillName: string,
  layers?: Map<string, LayerValue>,
): boolean {
  const layer = getSkillLayer(skillName, layers);
  return layer === "L0+L1" || layer === "L0+L1+L2";
}

/** Should this skill be included when scaffolding an L2 project? */
export function includeSkillInL2(
  skillName: string,
  layers?: Map<string, LayerValue>,
): boolean {
  const layer = getSkillLayer(skillName, layers);
  return layer === "L0+L1" || layer === "L0+L1+L2";
}

/** Get the layer value for a specific skill. Defaults to L0+L1 if unknown. */
export function getSkillLayer(
  skillName: string,
  layers?: Map<string, LayerValue>,
): LayerValue {
  const map = _getSkillLayers(layers);
  return map.get(skillName) ?? "L0+L1";
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI mode
// ─────────────────────────────────────────────────────────────────────────────

if (import.meta.main) {
  const args = process.argv.slice(2);
  const format = args.find((a) => a.startsWith("--format="))?.split("=")[1] ?? "list";

  const showScriptsL0Only = args.includes("--scripts-l0-only");
  const showScriptsL0PlusL1 = args.includes("--scripts-l0-plus-l1");
  const showSkillsL0Only = args.includes("--skills-l0-only");

  let names: string[] = [];

  if (showScriptsL0Only) {
    const layers = parseScriptLayers();
    names = [...layers.entries()]
      .filter(([, v]) => v === "L0")
      .map(([k]) => k);
  } else if (showScriptsL0PlusL1) {
    const layers = parseScriptLayers();
    names = [...layers.entries()]
      .filter(([, v]) => v === "L0+L1")
      .map(([k]) => k);
  } else if (showSkillsL0Only) {
    const layers = parseSkillLayers();
    names = [...layers.entries()]
      .filter(([, v]) => v === "L0")
      .map(([k]) => k);
  } else {
    console.error(
      "Usage: bun scripts/helpers/layer-filter.ts [--scripts-l0-only | --scripts-l0-plus-l1 | --skills-l0-only] [--format=list|json]",
    );
    process.exit(1);
  }

  if (format === "json") {
    console.log(JSON.stringify(names, null, 2));
  } else {
    for (const name of names) {
      console.log(name);
    }
  }
}
