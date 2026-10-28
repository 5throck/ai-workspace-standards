#!/usr/bin/env bun
/**
 * apply-model-field-removal.ts — one-shot applier for spec
 * 2026-10-28-platform-agent-mirror-design §4.4 (PR-2, template sweep).
 *
 * Deletes the top-level `model:` line from agent frontmatter wherever a flat
 * scalar `tier:` exists. Agent files declare ONE tier (ADR-0102); the
 * platform→model mapping is resolved at dispatch/validation/generation time
 * from docs/workspace-schema.json `models` — the platform-neutral SSOT never
 * names a model. (Claude Code mirrors are generated WITH the model field by
 * scripts/sync-agent-mirrors.ts; the field is only removed from the SSOT.)
 *
 * Scope (default): agents/*.md (root — 0 expected, swept in PR-1; verified,
 * not assumed) + templates/common/agents/*.md (L1, 2) + templates/<co-variant>/
 * agents/ (L2, enumerated by readdir at execution time — the design's filing-
 * time count of 146 carriers is never hardcoded). README* and underscore-
 * prefixed partials (_COMMON.md) are always excluded.
 *
 * Transform (surgical — every other frontmatter key and byte is preserved):
 *   - `model:` line + scalar `tier:`  -> model line deleted.
 *   - `model:` line + map-form `tier:` block
 *                                     -> REPORTED and left untouched (the
 *                                        ADR-0102 path owns map blocks; there
 *                                        should be none — V2/V3 verified
 *                                        every carrier is scalar).
 *   - `model:` line + no tier at all  -> REPORTED and left untouched.
 *   - no `model:` line                -> SKIP (idempotent no-op; file untouched
 *                                        so reruns stay byte-idempotent).
 *
 * Version metadata (applied files only — skipped files are untouched so the
 * script stays byte-idempotent; identical mechanics to the
 * tests/apply-tier-normalization.ts precedent):
 *   - templates/** (L1/L2): patch-bump top-level frontmatter `version:` and
 *     set top-level `last_updated:` to today, so the upgrade
 *     `SYNC_IF_NEWER: agents/` pass re-delivers them (ADR-0102 §8.4
 *     mechanics — delivery is version-gated on frontmatter version).
 *   - agents/*.md (root): bump top-level `last_updated:` ONLY — root agents
 *     are not delivered to projects (root has 0 carriers after PR-1, so this
 *     arm is expected to see no work; verified, not assumed).
 *   - `lifecycle:` blocks are never touched (all key anchors are column-0;
 *     `lifecycle.last_updated` is a different field).
 *
 * CRLF-safe (uniform line endings are preserved), UTF-8 enforced.
 *
 * Usage:
 *   bun tests/apply-model-field-removal.ts [--dry-run] [--only <glob-or-dir>] [--help]
 *
 * Precedent: tests/apply-tier-normalization.ts (tests/ placement per
 * AGENTS.md §7 — a one-shot applier is not delivered tooling, no SCRIPTS.md
 * row, matching how apply-tier-normalization.ts is registered).
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  /** Scalar value (comments stripped, quotes kept verbatim for reporting). */
  value?: string;
  /** map form only: platform -> tier value (comments stripped). */
  platforms?: Record<string, string>;
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
      return { form: 'map', platforms };
    }
  }
  return { form: 'none' };
}

// ─── Transform ───────────────────────────────────────────────────────────────

export interface TransformOptions {
  /** ISO date (YYYY-MM-DD) written into top-level `last_updated:` on applied files. */
  today: string;
}

export type TransformResult =
  | { status: 'applied'; detail: string; content: string }
  | { status: 'map-tier' | 'no-tier' | 'no-model' | 'no-frontmatter'; detail: string };

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

  // Top-level `model:` line inside the frontmatter only (column-0 anchored,
  // so indented keys and body occurrences are never touched).
  let modelLineIdx = -1;
  let modelValue = '';
  for (let i = 1; i < closeIdx; i++) {
    const mm = lines[i].match(/^model:[ \t]+(.+)$/);
    if (mm) {
      modelLineIdx = i;
      modelValue = unquote(stripComment(mm[1]));
      break;
    }
  }
  if (modelLineIdx === -1) {
    return { status: 'no-model', detail: 'no top-level model: line in frontmatter' };
  }

  const decl = parseTierDeclaration(lf);
  if (decl.form === 'map') {
    const before = Object.entries(decl.platforms ?? {}).map(([p, v]) => `${p}: ${v}`).join(', ');
    return {
      status: 'map-tier',
      detail: `legacy map-form tier block {${before}} — REPORTED, left untouched (ADR-0102 path owns map blocks)`,
    };
  }
  if (decl.form === 'none') {
    return { status: 'no-tier', detail: 'model: present but no tier declaration — REPORTED, left untouched' };
  }

  // Scalar tier + model line -> delete the model line.
  lines.splice(modelLineIdx, 1);
  closeIdx -= 1; // deletion shifts the closing-`---` index
  let detail = `deleted model: ${modelValue} (tier: ${decl.value})`;

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
  opts: { only?: string } = {},
): { all: string[]; rootCount: number; l1Count: number; variantCount: number } {
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

  if (opts.only) {
    if (opts.only.includes('*')) {
      const re = globToRegExp(opts.only);
      all = all.filter((rel) => re.test(rel));
    } else {
      const prefix = opts.only.replace(/\/+$/, '');
      all = all.filter((rel) => rel === prefix || rel.startsWith(`${prefix}/`));
    }
  }

  return { all, rootCount, l1Count, variantCount };
}

// ─── Main ────────────────────────────────────────────────────────────────────

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function help(): void {
  console.log(`apply-model-field-removal.ts — one-shot idempotent model-field remover
(spec 2026-10-28-platform-agent-mirror-design §4.4, PR-2 template sweep)

Deletes the top-level \`model:\` frontmatter line from agent files wherever a
flat scalar \`tier:\` exists. Platform→model resolution lives in
docs/workspace-schema.json \`models\` (ADR-0102 single-declaration principle);
Claude Code mirrors get the model field at generation time
(scripts/sync-agent-mirrors.ts), never in the platform-neutral SSOT.

Usage:
  bun tests/apply-model-field-removal.ts [--dry-run] [--only <glob-or-dir>] [--help]

Scope:
  default   agents/*.md (root; 0 carriers expected post-PR-1 — verified)
            + templates/common/agents/*.md (L1)
            + templates/co-*/agents/*.md (L2, enumerated at execution time)
  --only    restrict to a directory prefix (e.g. templates/co-safety) or a glob
            (e.g. 'templates/co-*/agents/pm.md'); README* and _partials always excluded

Transform:
  model: line + scalar tier   -> model line deleted
  model: line + map-form tier -> REPORTED, left untouched (ADR-0102 path)
  model: line + no tier       -> REPORTED, left untouched
  no model: line              -> SKIP (idempotent no-op)

Version metadata (applied files only; skipped files stay byte-identical):
  templates/** (L1/L2): patch-bump frontmatter \`version:\` AND set top-level
                        \`last_updated:\` to today so the upgrade
                        SYNC_IF_NEWER: agents/ pass re-delivers them (§8.4).
  agents/*.md (root):   bump \`last_updated:\` ONLY — root agents are NOT
                        delivered to projects.
  \`lifecycle:\` blocks are never touched (top-level key anchoring only).

--dry-run prints the per-file plan and writes nothing.`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) { help(); return; }
  const dryRun = args.includes('--dry-run');
  const onlyIdx = args.indexOf('--only');
  const only = onlyIdx !== -1 ? args[onlyIdx + 1] : undefined;

  const today = new Date().toISOString().split('T')[0];
  const { all, rootCount, l1Count, variantCount } = collectTargets(ROOT, { only });

  let applied = 0;
  let skipped = 0;
  let reported = 0;
  let templateBumps = 0;
  let rootBumps = 0;

  for (const rel of all) {
    const abs = join(ROOT, rel);
    const raw = readFileSync(abs, 'utf-8');
    const result = transformAgentContent(rel, raw, { today });
    const isTemplate = rel.startsWith('templates/');

    if (result.status === 'applied') {
      const tag = dryRun ? 'WOULD APPLY' : 'APPLIED';
      console.log(`${tag.padEnd(12)} ${rel}\n             - ${result.detail}`);
      applied += 1;
      if (isTemplate) templateBumps += 1; else rootBumps += 1;
      if (!dryRun) writeFileSync(abs, result.content, 'utf-8');
    } else if (result.status === 'no-model') {
      console.log(`${'SKIP'.padEnd(12)} ${rel} (${result.status}) — ${result.detail}`);
      skipped += 1;
    } else {
      console.log(`${'REPORT'.padEnd(12)} ${rel} (${result.status}) — ${result.detail}`);
      reported += 1;
    }
  }

  const scope = `scope: root agents ${rootCount} + L1 ${l1Count} + variants ${variantCount}`;
  console.log(`
${dryRun ? 'DRY-RUN SUMMARY' : 'SUMMARY'}: planned=${all.length} ${dryRun ? 'wouldApply' : 'applied'}=${applied} skipped=${skipped} reportedForManualReview=${reported}
${scope}
version+last_updated bumped (templates/, SYNC_IF_NEWER re-delivery §8.4): ${templateBumps}
last_updated-only bumped (root agents/*.md — not delivered): ${rootBumps}
Idempotency: re-run reports every transformed file as SKIP (no model: line).`);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(`[apply-model-field-removal] FATAL: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}
