#!/usr/bin/env bun
/**
 * apply-tier-normalization.ts — one-shot applier for spec
 * 2026-10-26-model-registry-platform-coverage
 * (docs/designs/2026-10-26-model-registry-platform-coverage-design.md §8.1).
 *
 * Replaces per-platform map-form `tier:` frontmatter blocks in agent files with
 * a single scalar `tier: high|medium|low` line (user ruling 2026-10-26: agent
 * files declare ONE tier; the platform→model mapping is resolved at
 * dispatch/validation time from docs/workspace-schema.json `models`).
 *
 * Scope (default): agents/*.md (root 9) + templates/common/agents/*.md (L1, 2)
 * + templates/<co-variant>/agents/ (L2, 148 non-README). --projects adds
 * Projects/<co-project>/agents/ (L3, 16 projects — one-shot fleet pass, D4).
 * README* and underscore-prefixed partials (_COMMON.md) are always excluded.
 *
 * Transform (surgical — every other frontmatter key and byte is preserved):
 *   - map block, uniform values      -> `tier: <value>`
 *   - map block, mixed values        -> `tier: <claude value>` (design D5;
 *                                       the only intentional signal — the
 *                                       other platforms' values are #723
 *                                       scaffold noise). Collapse is logged
 *                                       with before/after.
 *   - no tier at all, extends-stub whose L1 counterpart
 *     (templates/common/agents/<same-name>.md) declares a tier
 *                                      -> insert `tier: <L1 value>` right
 *                                         after the `extends:` line (the 4
 *                                         co-hr/co-news stubs resolve to
 *                                         medium).
 *   - scalar already                  -> SKIP (idempotent).
 *   - unknown platform key in a block -> SKIP for manual review (validator v2
 *                                       FAILs on these; the applier never
 *                                       guesses).
 *
 * Version metadata (applied files only — skipped files are untouched so the
 * script stays byte-idempotent):
 *   - templates/** (L1/L2): patch-bump top-level frontmatter `version:` and
 *     set top-level `last_updated:` to today, so the upgrade
 *     `SYNC_IF_NEWER: agents/` pass re-delivers them (design §8.4 — delivery
 *     is version-gated on frontmatter version).
 *   - agents/*.md (root): bump top-level `last_updated:` ONLY — root agents
 *     are not delivered to projects, and root agent changes are governed by
 *     the normal review flow, not the version gate.
 *   - `lifecycle:` blocks are never touched (all key anchors are column-0).
 *
 * CRLF-safe (uniform line endings are preserved), UTF-8 enforced.
 *
 * Usage:
 *   bun tests/apply-tier-normalization.ts [--dry-run] [--projects] [--only <glob-or-dir>] [--help]
 *
 * Precedent: tests/apply-pm-bootstrap-agents-md.ts. tests/ placement per
 * AGENTS.md §7 — a one-shot applier is not delivered tooling.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Constants ───────────────────────────────────────────────────────────────

export const PLATFORMS: readonly string[] = [
  'claude', 'gemini', 'antigravity', 'gemini-cli', 'codex', 'hermes', 'zai',
];
export const TIERS: readonly string[] = ['high', 'medium', 'low'];

const L1_AGENTS_DIR = 'templates/common/agents';

// ─── Parsing ─────────────────────────────────────────────────────────────────

/** Strip a trailing `# comment` (a `#` opens a comment only after whitespace). */
function stripComment(raw: string): string {
  const hash = raw.indexOf(' #');
  return (hash === -1 ? raw : raw.slice(0, hash)).trim();
}

function unquote(raw: string): string {
  const t = raw.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

export interface TierDeclaration {
  form: 'scalar' | 'map' | 'none';
  /** Scalar value, or the resolved collapse candidate for uniform maps. */
  value?: string;
  /** map form only: platform -> tier value (comments stripped). */
  platforms?: Record<string, string>;
  /** Global line indices (LF-normalized file): `tier:` line and end (exclusive). */
  startLine?: number;
  endLine?: number;
}

/**
 * Parse the `tier` declaration from frontmatter content (LF-normalized).
 * Returns form 'none' when the file has no frontmatter or no tier at all.
 */
export function parseTierDeclaration(lf: string): TierDeclaration {
  const lines = lf.split('\n');
  if (lines[0] !== '---') return { form: 'none' };
  let closeIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') { closeIdx = i; break; }
  }
  if (closeIdx === -1) return { form: 'none' };

  for (let i = 1; i < closeIdx; i++) {
    const scalar = lines[i].match(/^tier:[ \t]+(.+)$/);
    if (scalar) {
      return { form: 'scalar', value: unquote(stripComment(scalar[1])) };
    }
    if (/^tier:[ \t]*(#.*)?$/.test(lines[i])) {
      const platforms: Record<string, string> = {};
      let j = i + 1;
      for (; j < closeIdx; j++) {
        const m = lines[j].match(/^[ \t]+([A-Za-z][A-Za-z0-9-]*)[ \t]*:[ \t]*(.*)$/);
        if (!m) break;
        platforms[m[1]] = unquote(stripComment(m[2]));
      }
      if (j === i + 1) return { form: 'none' }; // `tier:` with nothing under it
      return { form: 'map', platforms, startLine: i, endLine: j };
    }
  }
  return { form: 'none' };
}

/**
 * Resolve the declared tier of an L1 counterpart file's content: a scalar, a
 * uniform map (its value), or a mixed map (its `claude` value — the D5 rule).
 * Returns null when no valid tier can be resolved.
 */
export function resolveTierFromContent(content: string): string | null {
  const decl = parseTierDeclaration(content);
  if (decl.form === 'scalar') {
    return TIERS.includes(decl.value ?? '') ? (decl.value as string) : null;
  }
  if (decl.form === 'map') {
    const values = Object.values(decl.platforms ?? {});
    if (values.length === 0) return null;
    const uniform = values.every((v) => v === values[0]) ? values[0] : decl.platforms?.['claude'];
    return TIERS.includes(uniform ?? '') ? (uniform as string) : null;
  }
  return null;
}

// ─── Transform ───────────────────────────────────────────────────────────────

export interface TransformOptions {
  /** Resolved tier of the L1 counterpart, for block-less extends-stubs. */
  l1Tier?: string | null;
  /** ISO date (YYYY-MM-DD) written into top-level `last_updated:` on applied files. */
  today: string;
}

export type TransformResult =
  | { status: 'applied'; detail: string; content: string }
  | { status: 'scalar' | 'no-tier' | 'no-stub-tier' | 'unknown-platform' | 'no-claude-value' | 'no-frontmatter'; detail: string };

/** True when the file's frontmatter declares `extends:` (ADR-0033 stub shape). */
function hasExtendsLine(lines: string[], closeIdx: number): number {
  for (let i = 1; i < closeIdx; i++) {
    if (/^extends:[ \t]+\S/.test(lines[i])) return i;
  }
  return -1;
}

function bumpVersionValue(existing: string): string | null {
  const m = existing.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return `${m[1]}.${m[2]}.${Number(m[3]) + 1}`;
}

function quoteLike(raw: string): (v: string) => string {
  const t = raw.trim();
  if (t.startsWith('"')) return (v) => `"${v}"`;
  if (t.startsWith("'")) return (v) => `'${v}'`;
  return (v) => v;
}

/**
 * Apply the version-metadata pass to frontmatter lines [1, closeIdx):
 *  - templates paths: patch-bump `version:` + set `last_updated:` (insert
 *    after the version line when absent, quoted like the version value);
 *  - root paths: set `last_updated:` only (root agents are not delivered).
 * Column-0 anchoring means `lifecycle:` sub-keys are never touched.
 */
function applyVersionMetadata(
  lines: string[],
  closeIdx: number,
  isTemplate: boolean,
  today: string,
): { lines: string[]; versionNote: string; lastUpdatedNote: string } {
  let versionNote = '';
  let lastUpdatedNote = '';
  let versionLineIdx = -1;

  for (let i = 1; i < closeIdx; i++) {
    const vm = lines[i].match(/^(version:)([ \t]*)([^#\n]+?)([ \t]*(?:#.*)?)$/);
    if (vm) {
      versionLineIdx = i;
      if (isTemplate) {
        const bumped = bumpVersionValue(vm[3]);
        if (bumped) {
          const keep = quoteLike(vm[3])(bumped);
          lines[i] = `${vm[1]}${vm[2]}${keep}`;
          versionNote = `version ${unquote(vm[3])} -> ${unquote(keep)}`;
        }
      }
      break;
    }
  }

  let lastUpdatedLineIdx = -1;
  for (let i = 1; i < closeIdx; i++) {
    if (/^last_updated:/.test(lines[i])) { lastUpdatedLineIdx = i; break; }
  }
  if (lastUpdatedLineIdx >= 0) {
    const lm = lines[lastUpdatedLineIdx].match(/^(last_updated:)([ \t]*)([^#\n]+?)([ \t]*(?:#.*)?)$/);
    if (lm) {
      const keep = quoteLike(lm[3])(today);
      lines[lastUpdatedLineIdx] = `${lm[1]}${lm[2]}${keep}`;
      lastUpdatedNote = `last_updated -> ${today}`;
    }
  } else if (versionLineIdx >= 0) {
    // L1 i18n-specialist shape: top-level last_updated absent — insert one
    // next to version (quoted, the dominant template style).
    lines.splice(versionLineIdx + 1, 0, `last_updated: "${today}"`);
    lastUpdatedNote = `last_updated inserted -> ${today}`;
  }
  return { lines, versionNote, lastUpdatedNote };
}

/**
 * Pure transform of one agent file's content. `relPath` decides the version
 * metadata behavior (templates/** gets version+last_updated; root agents
 * get last_updated only). Line-ending style is preserved (uniform CRLF/LF).
 */
export function transformAgentContent(
  relPath: string,
  raw: string,
  opts: TransformOptions,
): TransformResult {
  const hadCrlf = raw.includes('\r\n');
  const lf = hadCrlf ? raw.replace(/\r\n/g, '\n') : raw;

  const lines = lf.split('\n');
  if (lines[0] !== '---') return { status: 'no-frontmatter', detail: 'no YAML frontmatter' };
  let closeIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') { closeIdx = i; break; }
  }
  if (closeIdx === -1) return { status: 'no-frontmatter', detail: 'unterminated frontmatter' };

  const decl = parseTierDeclaration(lf);
  let detail = '';
  let applied = false;

  if (decl.form === 'scalar') {
    return { status: 'scalar', detail: `already scalar (tier: ${decl.value})` };
  }

  if (decl.form === 'map') {
    const platforms = decl.platforms ?? {};
    const unknown = Object.keys(platforms).filter((p) => !PLATFORMS.includes(p));
    if (unknown.length > 0) {
      return {
        status: 'unknown-platform',
        detail: `unknown platform key(s) in tier block: ${unknown.join(', ')} — manual review required`,
      };
    }
    const values = Object.values(platforms);
    const uniform = values.every((v) => v === values[0]);
    let value: string | undefined;
    if (uniform) {
      value = values[0];
      detail = `map block (${values.length} platforms, uniform ${value}) -> tier: ${value}`;
    } else {
      value = platforms['claude'];
      if (!TIERS.includes(value ?? '')) {
        return { status: 'no-claude-value', detail: `mixed block without a claude value — manual review` };
      }
      const before = Object.entries(platforms).map(([p, v]) => `${p}: ${v}`).join(', ');
      detail = `MIXED map {${before}} -> tier: ${value} (claude value, design D5 collapse)`;
    }
    lines.splice(decl.startLine!, decl.endLine! - decl.startLine!, `tier: ${value}`);
    // The block shrank/grew — keep the closing-`---` index valid for the
    // version-metadata pass below (version: can sit after the tier block).
    closeIdx += 1 - (decl.endLine! - decl.startLine!);
    applied = true;
  } else {
    // form 'none' — the extends-stub case (design §6: the 4 co-hr/co-news stubs).
    const extendsIdx = hasExtendsLine(lines, closeIdx);
    if (extendsIdx === -1) {
      return { status: 'no-tier', detail: 'no tier declaration and not an extends-stub — manual review' };
    }
    if (!TIERS.includes(opts.l1Tier ?? '')) {
      return { status: 'no-stub-tier', detail: 'extends-stub but L1 counterpart declares no resolvable tier' };
    }
    lines.splice(extendsIdx + 1, 0, `tier: ${opts.l1Tier}`);
    closeIdx += 1; // insertion shifts the closing fence
    detail = `no tier; extends-stub; L1 counterpart ${L1_AGENTS_DIR}/${basename(relPath)} declares ${opts.l1Tier} -> inserted tier: ${opts.l1Tier}`;
    applied = true;
  }

  if (applied) {
    const isTemplate = relPath.startsWith('templates/');
    const meta = applyVersionMetadata(lines, closeIdx, isTemplate, opts.today);
    const notes: string[] = [];
    if (meta.versionNote) notes.push(meta.versionNote);
    if (meta.lastUpdatedNote) notes.push(meta.lastUpdatedNote);
    if (notes.length > 0) {
      detail += isTemplate
        ? `; ${notes.join(', ')} (SYNC_IF_NEWER re-delivery bump, §8.4)`
        : `; ${notes.join(', ')} (root agent: last_updated only — not delivered)`;
    }
  }

  const out = lines.join('\n');
  return { status: 'applied', detail, content: hadCrlf ? out.replace(/\n/g, '\r\n') : out };
}

// ─── Target collection ───────────────────────────────────────────────────────

function isAgentCandidate(name: string): boolean {
  return name.endsWith('.md') && !name.startsWith('README') && !name.startsWith('_');
}

function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*');
  return new RegExp(`^${escaped}$`);
}

/** Expand the target list; `only` filters by directory prefix or glob. */
export function collectTargets(
  root: string,
  opts: { projects?: boolean; only?: string } = {},
): { all: string[]; rootCount: number; l1Count: number; variantCount: number; projectCount: number } {
  let all: string[] = [];
  const pushDir = (dirRel: string): number => {
    const abs = join(root, dirRel);
    if (!existsSync(abs)) return 0;
    const files = readdirSync(abs).filter(isAgentCandidate).sort()
      .map((f) => `${dirRel}/${f}`);
    all = all.concat(files);
    return files.length;
  };

  const rootCount = pushDir('agents');
  const l1Count = pushDir('templates/common/agents');
  let variantCount = 0;
  const templatesDir = join(root, 'templates');
  if (existsSync(templatesDir)) {
    for (const entry of readdirSync(templatesDir).sort()) {
      if (!entry.startsWith('co-')) continue;
      variantCount += pushDir(`templates/${entry}/agents`);
    }
  }
  let projectCount = 0;
  if (opts.projects) {
    const projectsDir = join(root, 'Projects');
    if (existsSync(projectsDir)) {
      for (const entry of readdirSync(projectsDir).sort()) {
        if (!entry.startsWith('co-')) continue;
        projectCount += pushDir(`Projects/${entry}/agents`);
      }
    }
  }

  if (opts.only) {
    if (opts.only.includes('*')) {
      const re = globToRegExp(opts.only);
      all = all.filter((rel) => re.test(rel));
    } else {
      const prefix = opts.only.replace(/\/+$/, '');
      all = all.filter((rel) => rel === prefix || rel.startsWith(`${prefix}/`));
    }
  }

  return { all, rootCount, l1Count, variantCount, projectCount };
}

// ─── Main ────────────────────────────────────────────────────────────────────

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function help(): void {
  console.log(`apply-tier-normalization.ts — one-shot idempotent tier normalizer (spec 2026-10-26-model-registry-platform-coverage §8.1)

Replaces per-platform map-form \`tier:\` frontmatter blocks with a single scalar
\`tier: high|medium|low\` line. Platform→model resolution lives in
docs/workspace-schema.json \`models\` — agent files stop naming platforms.

Usage:
  bun tests/apply-tier-normalization.ts [--dry-run] [--projects] [--only <glob-or-dir>] [--help]

Scope:
  default   agents/*.md (root) + templates/common/agents/*.md (L1) + templates/co-*/agents/*.md (L2)
  --projects additionally Projects/co-*/agents/*.md (L3, one-shot fleet pass, design D4)
  --only    restrict to a directory prefix (e.g. templates/co-price) or a glob
            (e.g. 'templates/co-*/agents/pm.md'); README* and _partials always excluded

Transform:
  uniform map block            -> tier: <value>
  mixed map block              -> tier: <claude value>  (design D5; logged with before/after)
  no tier + extends-stub whose L1 counterpart (templates/common/agents/<name>.md)
                               -> insert tier: <L1 value> right after \`extends:\`
  scalar already               -> SKIP (idempotent)
  unknown platform key         -> SKIP (manual review; validator v2 FAILs on these)

Version metadata (applied files only; skipped files stay byte-identical):
  templates/** (L1/L2): patch-bump frontmatter \`version:\` AND set \`last_updated:\` to today
                        so the upgrade SYNC_IF_NEWER: agents/ pass re-delivers them (§8.4).
  agents/*.md (root):   bump \`last_updated:\` ONLY — root agents are NOT delivered to projects.
  \`lifecycle:\` blocks are never touched (top-level key anchoring only).

--dry-run prints the per-file plan and writes nothing.`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) { help(); return; }
  const dryRun = args.includes('--dry-run');
  const projects = args.includes('--projects');
  const onlyIdx = args.indexOf('--only');
  const only = onlyIdx !== -1 ? args[onlyIdx + 1] : undefined;

  const today = new Date().toISOString().split('T')[0];
  const { all, rootCount, l1Count, variantCount, projectCount } = collectTargets(ROOT, { projects, only });

  let applied = 0;
  let skipped = 0;
  let collapses = 0;
  let stubInserts = 0;
  let templateBumps = 0;
  let rootBumps = 0;

  for (const rel of all) {
    const abs = join(ROOT, rel);
    const raw = readFileSync(abs, 'utf-8');

    let l1Tier: string | null = null;
    const decl = parseTierDeclaration(raw.replace(/\r\n/g, '\n'));
    if (decl.form === 'none' && /^extends:[ \t]+\S/m.test(raw)) {
      const l1Path = join(ROOT, L1_AGENTS_DIR, basename(rel));
      l1Tier = existsSync(l1Path) ? resolveTierFromContent(readFileSync(l1Path, 'utf-8')) : null;
    }

    const result = transformAgentContent(rel, raw, { l1Tier, today });
    const isTemplate = rel.startsWith('templates/');

    if (result.status === 'applied') {
      const tag = dryRun ? 'WOULD APPLY' : 'APPLIED';
      console.log(`${tag.padEnd(12)} ${rel}\n             - ${result.detail}`);
      applied += 1;
      if (result.detail.includes('MIXED map')) collapses += 1;
      if (result.detail.includes('extends-stub')) stubInserts += 1;
      if (isTemplate) templateBumps += 1; else rootBumps += 1;
      if (!dryRun) writeFileSync(abs, result.content, 'utf-8');
    } else {
      console.log(`${'SKIP'.padEnd(12)} ${rel} (${result.status}) — ${result.detail}`);
      skipped += 1;
    }
  }

  const scope = `scope: root agents ${rootCount} + L1 ${l1Count} + variants ${variantCount}`
    + (projects ? ` + projects ${projectCount}` : '');
  console.log(`
${dryRun ? 'DRY-RUN SUMMARY' : 'SUMMARY'}: planned=${all.length} ${dryRun ? 'wouldApply' : 'applied'}=${applied} skipped=${skipped}
${scope}
co-price-shaped mixed-block collapses (D5 -> claude value): ${collapses}
extends-stub tier insertions: ${stubInserts}
version+last_updated bumped (templates/, SYNC_IF_NEWER re-delivery §8.4): ${templateBumps}
last_updated-only bumped (root agents/*.md — not delivered): ${rootBumps}
Idempotency: re-run reports every transformed file as SKIP (scalar).`);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(`[apply-tier-normalization] FATAL: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}
