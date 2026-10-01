#!/usr/bin/env bun
// @version 1.0.0
// v1.0.0 (2026-10-01, T-20261001-018): initial validator for the CONSTITUTION §11.0
//           supported-surface registry (ADR-0097 follow-up). Closes the "enforced only
//           by review" honesty gap recorded in ADR-0097 Consequences.
// validate-surface-registry.ts — Verify the §11.0 registry against the filesystem.
//
// Per surface in the §11.0 table (the single source, parsed from context.md):
//   1. the instruction file(s) exist at L0, at L1 (templates/common/), and in every
//      L2 variant overlay (templates/co-*/) — "or delivered at scaffold" is satisfied
//      by every current variant shipping the file;
//   2. the platform directory the surface needs (.claude / .gemini / .agents / .codex /
//      .hermes) ships at the same three layers;
//   3. every skills/<name>/SKILL.md at that layer is mirrored into each SHIPPED
//      platform directory — unless the SKILL.md frontmatter carries `mirror: false`
//      (ADR-0075 sync-exclusion for domain-specific, agent-dispatched skills).
// A gap may be DOCUMENTED in docs/surface-gaps.json ({surface, check, reason,
// fallback, ticket}) — the finding is then a WARN naming the ticket — or is a FAIL.
// The same 8-row table must appear verbatim (row-normalized) in
// templates/common/docs/context.md "Supported Surfaces" (single-source rule).
//
// Exit: 1 on any FAIL; 0 with WARNs. `--strict` additionally exits 1 on WARN.
// Design: docs/designs/2026-10-01-surface-registry-validator-design.md; ADR-0097.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SURFACES_SECTION = '#### 11.0 Supported Surfaces';
const CONTEXT_SECTION = '## Supported Surfaces — Mandatory Coverage';
const PLATFORM_DIRS = ['.claude', '.gemini', '.agents', '.codex', '.hermes'];
/** Surface family → platform directories the family's clients read. */
const FAMILY_DIRS: Record<string, string[]> = {
  Anthropic: ['.claude'],
  Google: ['.gemini', '.agents'],
  OpenAI: ['.codex'],
  'Nous Research': ['.hermes'],
};

export interface SurfaceRow {
  num: number;
  surface: string;
  family: string;
  instructionFiles: string[];
  mcpConfig: string;
}

export interface GapRow {
  surface: string;
  check: string;
  reason: string;
  fallback: string;
  ticket: string;
}

export interface Finding {
  severity: 'WARN' | 'FAIL';
  check: string;
  message: string;
  ticket?: string;
}

/** Extract the 8-row §11.0 table from the CONSTITUTION source. */
export function parseSurfaceRegistry(constitutionMd: string): SurfaceRow[] {
  const section = constitutionMd.indexOf(SURFACES_SECTION);
  if (section === -1) throw new Error(`CONSTITUTION.md: cannot find "${SURFACES_SECTION}"`);
  const rows: SurfaceRow[] = [];
  for (const line of constitutionMd.slice(section).split('\n')) {
    const m = /^\| (\d+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\s*$/.exec(line);
    if (!m) continue;
    const num = Number(m[1]);
    if (!Number.isInteger(num) || num < 1 || num > 8) continue;
    rows.push({
      num,
      surface: m[2].trim(),
      family: m[3].trim(),
      instructionFiles: [...m[4].matchAll(/`([A-Z][A-Z.]*\.md)`/g)].map((x) => x[1]),
      mcpConfig: m[5].trim(),
    });
  }
  if (rows.length !== 8) {
    throw new Error(`CONSTITUTION.md §11.0: expected 8 registry rows, parsed ${rows.length} — the table shape changed; update this parser`);
  }
  return rows;
}

/** Raw §11.0 table rows, normalized — the one-source comparison uses these
 * verbatim (reconstructing rows from parsed cells would drop the parenthetical
 * qualifiers the copy carries, e.g. "`CLAUDE.md` (Code tab, bundled CLI)"). */
export function parseConstitutionRows(constitutionMd: string): string[] {
  const section = constitutionMd.indexOf(SURFACES_SECTION);
  if (section === -1) return [];
  const out: string[] = [];
  for (const line of constitutionMd.slice(section).split('\n')) {
    if (/^\| \d+ \|/.test(line)) out.push(line.replace(/\s+/g, ' ').trim());
    if (out.length >= 8) break;
  }
  return out;
}

/**
 * Instruction files COMPOSED at scaffold time rather than shipped statically in
 * the variant template: new-project.ts copies templates/common/<file> into the
 * project and merges the variant context (AGENTS.md and HERMES.md, by contrast,
 * ship as real files in every templates/co-*). "Exists at L1" is therefore the
 * scaffold-delivery guarantee for these three — an L2 static-existence check would
 * false-FAIL every variant (T-20261001-018 design, "delivered at scaffold").
 */
export const SCAFFOLD_COMPOSED = new Set(['CLAUDE.md', 'GEMINI.md', 'CODEX.md']);

/** Extract the "Supported Surfaces" table rows from a context.md copy. */
export function parseContextTable(contextMd: string): string[] {
  const section = contextMd.indexOf(CONTEXT_SECTION);
  if (section === -1) return [];
  const out: string[] = [];
  for (const line of contextMd.slice(section).split('\n')) {
    if (/^\| \d+ \|/.test(line)) out.push(line.replace(/\s+/g, ' ').trim());
    if (out.length >= 8) break;
  }
  return out;
}

export function loadGaps(rootDir: string): GapRow[] {
  const p = join(rootDir, 'docs', 'surface-gaps.json');
  if (!existsSync(p)) return [];
  try {
    const data = JSON.parse(readFileSync(p, 'utf-8'));
    return Array.isArray(data.gaps) ? data.gaps : [];
  } catch {
    throw new Error('docs/surface-gaps.json is not valid JSON — fix or remove it');
  }
}

function matchGap(gaps: GapRow[], surface: string, check: string): GapRow | undefined {
  return gaps.find((g) => g.surface === surface && (g.check === check || g.check === '*'));
}

function instructionFilesFromRegistry(rows: SurfaceRow[]): string[] {
  return [...new Set(rows.flatMap((r) => r.instructionFiles))].sort();
}

function familiesFromRegistry(rows: SurfaceRow[]): string[] {
  return [...new Set(rows.map((r) => r.family))];
}

/** Platform dirs at least one registry family needs. */
export function requiredPlatformDirs(rows: SurfaceRow[]): string[] {
  return [...new Set(rows.flatMap((r) => FAMILY_DIRS[r.family] ?? []))].sort();
}

/** Frontmatter mirror flag (ADR-0075): `mirror: false` excludes a skill from platform mirrors. */
function isMirrorExcluded(skillMd: string): boolean {
  const m = /^---\n([\s\S]*?)\n---/.exec(skillMd);
  if (!m) return false;
  return /^mirror:\s*false\s*$/m.test(m[1]);
}

export interface CheckOptions {
  rootDir: string;
  registry: SurfaceRow[];
  gaps: GapRow[];
}

function layerFinding(gaps: GapRow[], check: string, surface: string, message: string): Finding {
  const gap = matchGap(gaps, surface, check);
  return gap
    ? { severity: 'WARN', check, message: `${message} — documented gap: ${gap.reason} (fallback: ${gap.fallback})`, ticket: gap.ticket }
    : { severity: 'FAIL', check, message };
}

/** Check instruction files + platform dirs + skill mirroring at one layer root. */
export function checkLayer(opts: CheckOptions, layer: string, root: string, opts2: { checkSkills: boolean } = { checkSkills: true }): Finding[] {
  const findings: Finding[] = [];
  if (!existsSync(root)) {
    return [{ severity: 'FAIL', check: 'layer-missing', message: `${layer}: root ${root} does not exist` }];
  }
  const files = instructionFilesFromRegistry(opts.registry).filter((f) => {
    // Scaffold-composed files are guaranteed by their L1 copy (checked above);
    // a variant template need not carry them statically.
    if (layer.startsWith('L2') && SCAFFOLD_COMPOSED.has(f)) return false;
    return true;
  });
  for (const f of files) {
    const surface = opts.registry.find((r) => r.instructionFiles.includes(f))!.surface;
    if (!existsSync(join(root, f))) {
      findings.push(layerFinding(opts.gaps, 'instruction-file', surface, `${layer}: instruction file ${f} is missing`));
    }
  }
  for (const dir of requiredPlatformDirs(opts.registry)) {
    const family = Object.entries(FAMILY_DIRS).find(([, dirs]) => dirs.includes(dir))![0];
    const surface = opts.registry.find((r) => r.family === family)!.surface;
    if (!existsSync(join(root, dir))) {
      findings.push(layerFinding(opts.gaps, 'platform-dir', surface, `${layer}: platform directory ${dir}/ is missing`));
    }
  }
  if (opts2.checkSkills) {
    const skillsDir = join(root, 'skills');
    if (existsSync(skillsDir)) {
      for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const skillMdPath = join(skillsDir, entry.name, 'SKILL.md');
        if (!existsSync(skillMdPath)) continue;
        const excluded = isMirrorExcluded(readFileSync(skillMdPath, 'utf-8'));
        if (excluded) continue;
        for (const dir of requiredPlatformDirs(opts.registry)) {
          if (!existsSync(join(root, dir, 'skills', entry.name, 'SKILL.md'))) {
            const family = Object.entries(FAMILY_DIRS).find(([, dirs]) => dirs.includes(dir))![0];
            const surface = opts.registry.find((r) => r.family === family)!.surface;
            findings.push(layerFinding(opts.gaps, 'skill-mirror', surface, `${layer}: skill ${entry.name}/ is not mirrored in ${dir}/skills/`));
          }
        }
      }
    }
  }
  return findings;
}

/** Full check: registry parse, one-source sync, L0/L1/L2 coverage. */
export function validateSurfaceRegistry(rootDir: string): Finding[] {
  const constitutionMd = readFileSync(join(rootDir, 'CONSTITUTION.md'), 'utf-8');
  const registry = parseSurfaceRegistry(constitutionMd);
  const gaps = loadGaps(rootDir);
  const findings: Finding[] = [];

  // One-source rule: the L1 context copy must carry the same 8 rows.
  const contextPath = join(rootDir, 'templates', 'common', 'docs', 'context.md');
  if (!existsSync(contextPath)) {
    findings.push({ severity: 'FAIL', check: 'one-source', message: 'templates/common/docs/context.md is missing — the Supported Surfaces table has no L1 delivery' });
  } else {
    const ctxRows = parseContextTable(readFileSync(contextPath, 'utf-8'));
    const constRows = parseConstitutionRows(constitutionMd);
    // Raw-row comparison: both sides normalized (whitespace-collapsed), order kept.
    for (let i = 0; i < constRows.length; i++) {
      if (ctxRows[i] !== constRows[i]) {
        findings.push({ severity: 'FAIL', check: 'one-source', message: `templates/common/docs/context.md Supported Surfaces table drifted from CONSTITUTION §11.0 — row ${i + 1} missing or changed: expected ${constRows[i] ?? '(none)'}, found ${ctxRows[i] ?? '(none)'}` });
      }
    }
  }

  findings.push(...checkLayer({ rootDir, registry, gaps }, 'L0 (workspace root)', rootDir, { checkSkills: false }));
  findings.push(...checkLayer({ rootDir, registry, gaps }, 'L1 (templates/common)', join(rootDir, 'templates', 'common'), { checkSkills: false }));
  const templatesDir = join(rootDir, 'templates');
  for (const entry of readdirSync(templatesDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('co-')) continue;
    findings.push(...checkLayer({ rootDir, registry, gaps }, `L2 (${entry.name})`, join(templatesDir, entry.name), { checkSkills: true }));
  }
  return findings;
}

if (import.meta.main) {
  const rootDir = resolve(import.meta.dir, '..');
  const strict = process.argv.includes('--strict');
  // Self-skip at project (L2) context: the §11.0 registry lives in context.md,
  // which is L0-only (non-propagation rule). Projects run the L0/L1 mirror-parity
  // checks (verify-platform-lifecycle) instead. Same contract as check-upgrade-coverage.
  if (!existsSync(join(rootDir, 'CONSTITUTION.md'))) {
    console.log('skip: no CONSTITUTION.md at this context — §11.0 registry is L0-only');
    process.exit(0);
  }
  let findings: Finding[];
  try {
    findings = validateSurfaceRegistry(rootDir);
  } catch (err) {
    console.error(`[validate-surface-registry] ${(err as Error).message}`);
    process.exit(1);
  }
  const warns = findings.filter((f) => f.severity === 'WARN');
  const fails = findings.filter((f) => f.severity === 'FAIL');
  for (const f of findings) {
    const icon = f.severity === 'FAIL' ? '❌' : '⚠️ ';
    console.log(`${icon} [${f.check}] ${f.message}${f.ticket ? ` (ticket: ${f.ticket})` : ''}`);
  }
  if (findings.length === 0) console.log('✅ §11.0 surface registry: all 8 surfaces covered at L0/L1/L2, mirrors clean, context.md in sync');
  if (fails.length > 0) {
    console.error(`\n${fails.length} undocumented surface gap(s) — document them in docs/surface-gaps.json (surface, check, reason, fallback, ticket) or fix the tree`);
    process.exit(1);
  }
  if (strict && warns.length > 0) {
    console.error(`\n--strict: ${warns.length} documented gap WARN(s) are not allowed in strict mode`);
    process.exit(1);
  }
}
