#!/usr/bin/env bun
/**
 * adoption-provenance.ts — source-variant adoption residue detection (T-20261120-001)
 *
 * An adopted project (scripts/adopt-project.ts) receives the ADOPTION variant's own
 * skills and, in the field, keeps a variant.json declaring them. When the project is
 * later re-based to a different variant (upgrade-project --variant <T>) and its
 * variant.json identity is flipped away from the adoption variant, those source-variant
 * skills are adoption residue: nothing in the registry-driven VARIANT-SCOPE SKILL PRUNE
 * (docs/workspace-schema.json variant_scoped_skills) covers them, so they survived
 * re-base in the QuickDL case (U-20261119-002) and needed manual `git rm` across
 * skills/ + 5 platform mirrors.
 *
 * Provenance carrier (design docs/designs/2026-11-20-adoption-gaps-batch-design.md):
 * the decisions file adopt-project already writes post-delivery
 * (.claude/adopt-project-decisions.json, field-proven — it survives the settling pass,
 * which removes the seeded variant.json precisely when foreign skills were seeded).
 * A marker inside variant.json was rejected for that reason.
 *
 * Fail-safe contract (the arm that consumes `selectSourceVariantPruneCandidates`):
 * a skill is a prune candidate only when it is PROVEN source-variant-seeded AND not
 * declared for the target variant AND not PROJECT_STATE-authored — every filter
 * independently blocks guessing, and any missing/malformed input yields no candidates.
 *
 * @version 1.0.0
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface AdoptionProvenance {
  /** The variant adoption ran under (decisions.variant — the SOURCE of the delivered skills). */
  sourceVariant: string;
  /** The project's own adopted skills (decisions.plan.foreignSkills) — never residue. */
  foreignSkills: string[];
}

export interface PruneSelection {
  /** Skills that passed every proof filter — safe to prune (SSOT + platform mirrors). */
  prune: string[];
  /** Skills considered but kept, each with the blocking reason (audit trail). */
  keep: Array<{ skill: string; reason: string }>;
}

/**
 * Load the adoption provenance from a project's decisions file. Returns null when the
 * file is absent or anything inside is missing/malformed — callers must treat null as
 * "not adopted here" (never guess).
 */
export function loadAdoptionProvenance(projectDir: string): AdoptionProvenance | null {
  const path = join(projectDir, ".claude", "adopt-project-decisions.json");
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, "utf-8")) as {
      variant?: unknown;
      plan?: { foreignSkills?: unknown };
    };
    if (typeof raw.variant !== "string" || !raw.variant) return null;
    const foreign = Array.isArray(raw.plan?.foreignSkills)
      ? raw.plan.foreignSkills.filter((s): s is string => typeof s === "string" && s.length > 0)
      : [];
    return { sourceVariant: raw.variant, foreignSkills: foreign };
  } catch {
    return null;
  }
}

/**
 * Identity-flip gate. Returns:
 *   true  — the project variant.json declares a DIFFERENT name than the adoption variant
 *   false — it still self-declares the adoption variant (manifest-seeded KEEP applies)
 *   null  — identity unknowable (no variant.json / no name / unparsable) → never prune
 */
export function isAdoptionIdentityFlipped(projectVariantName: string | null, sourceVariant: string): boolean | null {
  if (projectVariantName === null || projectVariantName === "") return null;
  return projectVariantName !== sourceVariant;
}

/**
 * Skill names declared by a variant template's variant.json content:
 * `skills[].name` ∪ `skill_manifest.variant_specific[].name`. Pure over the raw JSON
 * text so both template reads and unit tests share one parser. Malformed content → [].
 */
export function declaredSkillNames(variantJsonContent: string): string[] {
  try {
    const vj = JSON.parse(variantJsonContent) as {
      skills?: Array<{ name?: unknown }>;
      skill_manifest?: { variant_specific?: Array<{ name?: unknown }> };
    };
    const out = new Set<string>();
    for (const s of Array.isArray(vj.skills) ? vj.skills : []) {
      if (typeof s?.name === "string" && s.name) out.add(s.name);
    }
    const specific = Array.isArray(vj.skill_manifest?.variant_specific) ? vj.skill_manifest.variant_specific : [];
    for (const s of specific) {
      if (typeof s?.name === "string" && s.name) out.add(s.name);
    }
    return [...out].sort();
  } catch {
    return [];
  }
}

export interface ResidueSelectionInputs {
  provenance: AdoptionProvenance;
  /** Current project variant.json `name` (post-flip identity). null = unknowable. */
  projectVariantName: string | null;
  /** The --variant target of the running upgrade. */
  targetVariant: string;
  /** Skills the CURRENT project variant.json declares (PROJECT_STATE authority). */
  projectManifestSkills: ReadonlySet<string>;
  /** Skills present in the project (skills/ SSOT dirs ∪ platform-mirror dirs). */
  presentSkills: ReadonlySet<string>;
  /** Skills declared by templates/<sourceVariant>/variant.json (proven-seeded set). */
  sourceDeclaredSkills: ReadonlySet<string>;
  /** Skills declared by templates/<targetVariant>/variant.json ([] when self-declared). */
  targetDeclaredSkills: ReadonlySet<string>;
  /** Skills with a templates/common/skills/ counterpart (common-owned, never residue). */
  commonSkills: ReadonlySet<string>;
}

/**
 * Select source-variant adoption-residue prune candidates. Pure. A skill reaches
 * `prune` only when EVERY filter holds:
 *   (1) declared by the SOURCE variant template          — proven source-variant-seeded
 *   (2) present in the project                           — there is something to prune
 *   (3) NOT in the current project variant.json manifest — not PROJECT_STATE-authored
 *   (4) NOT in provenance.foreignSkills                  — not a project's own adopted skill
 *   (5) NOT declared by the TARGET variant template      — not declared for the target
 *   (6) NOT common-owned                                 — the common delivery owns it
 * Everything else lands in `keep` with the blocking reason (decision-log audit trail).
 */
export function selectSourceVariantPruneCandidates(inputs: ResidueSelectionInputs): PruneSelection {
  const prune: string[] = [];
  const keep: PruneSelection["keep"] = [];
  for (const skill of [...inputs.sourceDeclaredSkills].sort()) {
    if (!inputs.presentSkills.has(skill)) {
      keep.push({ skill, reason: "not present in the project (no SSOT dir, no mirror dir)" });
      continue;
    }
    if (inputs.projectManifestSkills.has(skill)) {
      keep.push({
        skill,
        reason: "declared in the current project variant.json skill_manifest (PROJECT_STATE-authored)",
      });
      continue;
    }
    if (inputs.provenance.foreignSkills.includes(skill)) {
      keep.push({ skill, reason: "recorded as a project-adopted foreign skill in the adoption decisions" });
      continue;
    }
    if (inputs.targetDeclaredSkills.has(skill)) {
      keep.push({ skill, reason: "declared by the target variant template" });
      continue;
    }
    if (inputs.commonSkills.has(skill)) {
      keep.push({ skill, reason: "common-owned (templates/common/skills counterpart) — the common delivery owns it" });
      continue;
    }
    prune.push(skill);
  }
  return { prune, keep };
}

/**
 * Directory names under `dir` (directories only, sorted). Missing dir → [].
 * Used by the upgrade arm to resolve the template skill sets and the project's
 * present-skill universe.
 */
export function listSkillDirNames(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}
