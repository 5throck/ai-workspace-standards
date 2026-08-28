#!/usr/bin/env bun
// @version 0.1.0
/**
 * EXPERIMENT — status: experimental in scripts/SCRIPTS.md (registered per the
 * workspace's mandatory script-registry gate, matching the `helpers/agent-promote.ts`
 * precedent for one-off tools). Not wired into dev-sync.ts, not drift-gated,
 * not propagated to templates/common/ (layer: L0 only). Read-only against the repo.
 *
 * Compares the declarative typed-relates_to pilot (ADR-0060 Amendment 3,
 * hand-authored in SKILL.md frontmatter) against a purely inferred graph
 * derived from data that already exists for other reasons — variant.json's
 * skill_manifest.phases[] and each skill's own prerequisites — with zero new
 * frontmatter declared. See docs/designs/2026-08-29-inference-derived-graph-strategy-design.md
 * (ADR-0060 Amendment 4) for why this comparison matters: the declarative
 * pilots (co-consult/co-price/co-deck) were observed to mostly restate what
 * phases/prerequisites already imply, which is the exact anti-pattern
 * Amendment 4's normative rule warns about for inferential graphs — this
 * script checks whether the same holds once inference is actually tried.
 *
 * Usage: bun scripts/experiments/infer-graph-from-phases.ts [--scope <name>]
 * Output: a two-table Markdown comparison printed to stdout. Writes nothing.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter, parseRelatesTo } from '../generate-skill-graph.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..', '..');

const args = process.argv.slice(2);
const scopeIdx = args.indexOf('--scope');
const scope = scopeIdx >= 0 ? args[scopeIdx + 1] : 'co-deck';

const templateDir = join(ROOT, 'templates', scope);
const skillsDir = join(templateDir, 'skills');
const variantJsonPath = join(templateDir, 'variant.json');

if (!existsSync(skillsDir) || !existsSync(variantJsonPath)) {
  console.error(`[FAIL] templates/${scope}/{skills,variant.json} not found`);
  process.exit(1);
}

interface SkillEntry {
  name: string;
  prerequisites?: string;
  relatesTo?: unknown[];
}

const skills = new Map<string, SkillEntry>();
for (const dir of readdirSync(skillsDir, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  const mdPath = join(skillsDir, dir.name, 'SKILL.md');
  if (!existsSync(mdPath)) continue;
  const fm = parseFrontmatter(readFileSync(mdPath, 'utf-8')) as Record<string, unknown> | null;
  const name = (fm?.name as string) ?? dir.name;
  skills.set(name, {
    name,
    prerequisites: fm?.prerequisites as string | undefined,
    relatesTo: fm?.relates_to as unknown[] | undefined,
  });
}

const variant = JSON.parse(readFileSync(variantJsonPath, 'utf-8'));
const manifestEntries: { name: string; phases?: unknown[] }[] =
  variant?.skill_manifest?.variant_specific ?? [];

const phasesByName = new Map<string, number[]>();
const nonNumericPhasesByName = new Map<string, string[]>();
for (const entry of manifestEntries) {
  const numeric: number[] = [];
  const nonNumeric: string[] = [];
  for (const p of entry.phases ?? []) {
    if (typeof p === 'number') numeric.push(p);
    else nonNumeric.push(String(p));
  }
  if (numeric.length > 0) phasesByName.set(entry.name, numeric);
  if (nonNumeric.length > 0) nonNumericPhasesByName.set(entry.name, nonNumeric);
}

// ---------- Declared (Amendment 3, hand-authored relates_to) ----------

interface DeclaredEdge { from: string; type: string; to: string; symmetric?: boolean }
const declared: DeclaredEdge[] = [];
for (const [name, s] of skills) {
  if (!s.relatesTo) continue;
  const mdPath = join(skillsDir, name, 'SKILL.md');
  const relations = parseRelatesTo(s.relatesTo, mdPath);
  for (const rel of relations) {
    declared.push({ from: name, type: rel.type, to: rel.to, symmetric: rel.symmetric });
  }
}

// ---------- Inferred (phases[] + prerequisites only, zero new frontmatter) ----------
//
// v2 filtering, applied after reviewing v1's output (34 edges vs 5 declared —
// bad signal-to-noise): v1's `inferred_follows` (pure minPhase adjacency) was
// dropped entirely — it's redundant with the existing `prerequisites`→`requires`
// edge for direct dependencies, and for indirect ones it produced a fan-out
// (`design` "follows" into all 6 phase-4 skills, when only `html-build` is a
// real direct relation) that added noise, not signal. `inferred_composes_with`
// is kept — it was v1's one clear win (surfaced the real phase-4 cluster that
// the hand-declared pilot only partially captured) — but now excludes
// **cross-cutting skills**: any skill whose phases[] spans more distinct
// phases than half the scope's total distinct phase count (e.g. co-deck's
// `version`, spanning phases 0-6 while most skills span 1-2) is excluded from
// pairing, since a skill present in nearly every phase composes_with
// everything by construction — that's not a meaningful relation, it's an
// artifact of the skill being cross-cutting.

interface InferredEdge { from: string; type: 'inferred_composes_with'; to: string }
const inferred: InferredEdge[] = [];

const names = [...phasesByName.keys()];
const totalDistinctPhases = new Set(names.flatMap((n) => phasesByName.get(n)!)).size;
const crossCuttingThreshold = Math.ceil(totalDistinctPhases / 2);
const crossCutting = names.filter((n) => phasesByName.get(n)!.length > crossCuttingThreshold);
const pairableNames = names.filter((n) => !crossCutting.includes(n));

// inferred_composes_with: share >=1 phase number, symmetric, one edge per unordered pair,
// excluding cross-cutting skills.
const composesPairs = new Set<string>();
for (let i = 0; i < pairableNames.length; i++) {
  for (let j = i + 1; j < pairableNames.length; j++) {
    const a = pairableNames[i], b = pairableNames[j];
    const phasesA = new Set(phasesByName.get(a)!);
    const shared = phasesByName.get(b)!.some((p) => phasesA.has(p));
    if (shared) {
      const key = [a, b].sort().join('|');
      if (!composesPairs.has(key)) {
        composesPairs.add(key);
        inferred.push({ from: a, type: 'inferred_composes_with', to: b });
      }
    }
  }
}

// requires (from prerequisites), for reference only — not counted in either table's totals
const requiresRefs: { from: string; to: string }[] = [];
const knownNames = new Set(skills.keys());
for (const [name, s] of skills) {
  if (!s.prerequisites) continue;
  const text = s.prerequisites;
  const backtickMatches = [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
  const candidates = backtickMatches.length > 0
    ? backtickMatches
    : text.split(',').map((t) => t.trim());
  for (const c of candidates) {
    if (knownNames.has(c) && c !== name) requiresRefs.push({ from: name, to: c });
  }
}

// ---------- Report ----------

console.log(`# Declared vs Inferred Graph Comparison — scope: ${scope} (v2: composes_with only, cross-cutting skills excluded)\n`);
console.log(`Skills discovered: ${skills.size}. Skills with numeric phases[]: ${phasesByName.size}.`);
if (nonNumericPhasesByName.size > 0) {
  console.log(`Not orderable (non-numeric phases, excluded from inference): ${[...nonNumericPhasesByName.keys()].join(', ')}`);
}
if (crossCutting.length > 0) {
  console.log(`Cross-cutting (phases[] spans >${crossCuttingThreshold} of ${totalDistinctPhases} distinct phases, excluded from composes_with pairing): ${crossCutting.join(', ')}`);
}
console.log('');

console.log('## Declared (Amendment 3, hand-authored `relates_to` in SKILL.md frontmatter)\n');
if (declared.length === 0) {
  console.log('_None declared for this scope._\n');
} else {
  console.log('| From | Type | To | Symmetric |');
  console.log('|------|------|----|-----------|');
  for (const e of declared) {
    console.log(`| \`${e.from}\` | ${e.type} | \`${e.to}\` | ${e.symmetric ? 'yes' : ''} |`);
  }
  console.log('');
}

console.log('## Inferred (composes_with only, phases[] minus cross-cutting skills, zero new frontmatter)\n');
if (inferred.length === 0) {
  console.log('_None inferred — no numeric phases[] data for this scope._\n');
} else {
  console.log('| From | Type | To |');
  console.log('|------|------|----|');
  for (const e of inferred) {
    console.log(`| \`${e.from}\` | ${e.type} | \`${e.to}\` |`);
  }
  console.log('');
}

console.log('## Reference: existing `requires` edges (from `prerequisites`, unchanged by either strategy)\n');
if (requiresRefs.length === 0) {
  console.log('_None resolved to a known skill name for this scope._\n');
} else {
  console.log('| From | To |');
  console.log('|------|----|');
  for (const r of requiresRefs) {
    console.log(`| \`${r.from}\` | \`${r.to}\` |`);
  }
  console.log('');
}

console.log(`## Totals\n`);
console.log(`- Declared: ${declared.length} edge(s)`);
console.log(`- Inferred: ${inferred.length} composes_with edge(s) (v2 drops inferred_follows entirely — see comment above)`);
console.log(`- requires (reference): ${requiresRefs.length} edge(s)`);
