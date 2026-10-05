#!/usr/bin/env bun
// @version 1.0.0
/**
 * validate-variant-claims.ts — variant contract-truth validator (D6 of
 * docs/designs/2026-10-05-co-deck-review-remediation-design.md; T-20261005-011..014).
 *
 * Closes the ratchet loop for the 24 `script-gap` finding classes in
 * docs/reports/2026-10-05-project-review-scoped-co-deck.md: the machine battery
 * validates structure (existence, parity, registry sync) but not the
 * truthfulness of prose claims and semantic bindings. This validator checks one
 * L2 variant's descriptive surface against its manifests:
 *
 *   a. Roster-count claims    — numeric "N agents" / "N skills" claims (EN + KO)
 *                               in variant.json description, README*.md,
 *                               PROMOTION_CHECKLIST.md, docs/<name>.context.md,
 *                               agents/README.md vs the agents[]/skills[] arrays.
 *   b. theme_manifest truth   — themes/styles/default_theme/default_style vs the
 *                               docs/html-themes/{themes,styles} listings and the
 *                               THEMES.md default claims; the retired
 *                               available/default keys are an error (schema
 *                               migrated per design D3).
 *   c. Status coherence       — stable status ⇒ betaLifecycleSummary must be
 *                               null AND README/README_ko must carry no
 *                               beta/not-for-production blocks AND
 *                               PROMOTION_CHECKLIST.md must not claim a
 *                               pre-promotion status/version.
 *   d. process_manifest paths — stages_file/raci_file/gates_file must exist on
 *                               disk (or be null); evidence_models_dir likewise.
 *   e. Owner validity         — owner_agent/decider_agent/accountable/responsible
 *                               in process/stages.yaml, decisions/gates.yaml,
 *                               governance/raci.yaml and the Owning Agent column
 *                               of docs/phase-definitions.md must be real agents.
 *   f. Scaffold hygiene       — PENDING_REVIEW residue in process/governance/
 *                               decisions YAML of a non-draft variant; gate
 *                               titles truncated against their own criteria text.
 *   g. Phantom skill paths    — skills/<name>/SKILL.md mentions in template docs
 *                               must resolve to the variant's or the inherited
 *                               common skills tree (inherits_common-aware).
 *   h. Deprecated-script refs — script_manifest `status: deprecated` scripts
 *                               must not be referenced by active skills/agent docs.
 *   i. Undeclared imports     — bare-specifier imports of manifest-declared
 *                               scripts must be declared in a resolvable
 *                               package.json (template or common) or be a
 *                               bun/node builtin.
 *   j. AGENTS.md boilerplate  — §7 baseline bullets must be a superset of
 *                               common's, retired invocations absent, §8/§9/§10
 *                               must use the thin-dispatcher pointer form.
 *
 * Each check is independent: one failure never aborts the rest, and a missing
 * input (no html-themes tree, no process_manifest, …) skips that check cleanly.
 *
 * Exit codes: 0 = all checks clean, 1 = one or more findings (or the target
 * template does not exist / variant.json is unreadable).
 *
 * Usage: bun scripts/validate-variant-claims.ts [--template <name>]   # default: co-deck
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as yamlLoad } from 'js-yaml';

const VERSION = '1.0.0';
const WORKSPACE_ROOT = fileURLToPath(new URL('..', import.meta.url));

// ── CLI ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
validate-variant-claims v${VERSION}

Validates a template variant's descriptive claims against its manifests
(contract-truth checks a-j; design D6 of 2026-10-05-co-deck-review-remediation).

Usage:
  bun scripts/validate-variant-claims.ts [--template <name>]   # default: co-deck
  bun scripts/validate-variant-claims.ts --help

Exit codes: 0 = all checks clean, 1 = findings (or bad --template target).
`);
  process.exit(0);
}

const templateIdx = args.indexOf('--template');
if (templateIdx >= 0 && (!args[templateIdx + 1] || args[templateIdx + 1].startsWith('--'))) {
  console.error('❌ --template requires a value, e.g. --template co-deck');
  process.exit(1);
}
const templateName = templateIdx >= 0 ? args[templateIdx + 1] : 'co-deck';
const tpl = join(WORKSPACE_ROOT, 'templates', templateName);
const rel = (p: string): string => relative(WORKSPACE_ROOT, p).replace(/\\/g, '/');

if (!existsSync(tpl)) {
  console.error(`❌ Template not found: templates/${templateName}`);
  process.exit(1);
}

// ── Shared helpers ───────────────────────────────────────────────────────────

interface Finding {
  check: string;
  file: string;
  line?: number;
  message: string;
}

const findings: Finding[] = [];
const add = (check: string, file: string, message: string, line?: number): void => {
  findings.push({ check, file, line, message });
};

function readText(p: string): string | null {
  try {
    return readFileSync(p, 'utf-8');
  } catch {
    return null;
  }
}

/** 1-based line of the first occurrence of `needle` (undefined when absent or text unread). */
function lineOf(text: string | null, needle: string): number | undefined {
  if (!text || !needle) return undefined;
  const idx = text.indexOf(needle);
  if (idx < 0) return undefined;
  return text.slice(0, idx).split('\n').length;
}

function listDirs(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

function parseYamlFile(p: string): { ok: true; data: unknown } | { ok: false; error: string } {
  const raw = readText(p);
  if (raw === null) return { ok: false, error: 'file not found' };
  try {
    return { ok: true, data: yamlLoad(raw) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();

/** Rows of a markdown table line: `| a | b | c |` → ['a','b','c']. */
function splitMdRow(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}

function walkMdFiles(dir: string): string[] {
  const out: string[] = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...walkMdFiles(full));
    else if (e.isFile() && e.name.endsWith('.md')) out.push(full);
  }
  return out.sort();
}

// ── Load variant.json ────────────────────────────────────────────────────────

const variantPath = join(tpl, 'variant.json');
const variantRaw = readText(variantPath);
if (variantRaw === null) {
  console.error(`❌ variant.json not found: ${rel(variantPath)}`);
  process.exit(1);
}
let variant: Record<string, unknown>;
try {
  variant = JSON.parse(variantRaw) as Record<string, unknown>;
} catch (e) {
  console.error(`❌ variant.json is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
}

const agents = Array.isArray(variant.agents)
  ? (variant.agents as Array<Record<string, unknown>>).map((a) => String(a?.name ?? '')).filter(Boolean)
  : [];
const skills = Array.isArray(variant.skills)
  ? (variant.skills as Array<Record<string, unknown>>).map((s) => String(s?.name ?? '')).filter(Boolean)
  : [];
const lifecycle = (variant.lifecycle ?? {}) as Record<string, unknown>;
const status = typeof lifecycle.status === 'string' ? lifecycle.status : typeof variant.status === 'string' ? variant.status : null;

// Roster = declared agents[] ∪ agent files on disk (top level, README excluded).
const roster = new Set<string>(agents);
try {
  for (const f of readdirSync(join(tpl, 'agents'))) {
    if (f.endsWith('.md') && !/^README/i.test(f)) roster.add(f.replace(/\.md$/, ''));
  }
} catch {
  /* agents/ dir absent — manifest roster only */
}

// ── Check a — roster-count claims vs manifests ───────────────────────────────

// "2 common skills" style subset claims are not verifiable against the
// variant's skills[] manifest and are skipped (carve-out noted in the report).
const CLAIM_PATTERNS: Array<{ re: RegExp; kind: 'agents' | 'skills' }> = [
  { re: /\b(\d+)\s+(?:[A-Za-z][\w'-]*\s+){0,3}agents\b/gi, kind: 'agents' },
  { re: /\b(\d+)-agents?\b/gi, kind: 'agents' },
  { re: /(\d+)개\s*에이전트/g, kind: 'agents' },
  { re: /\b(\d+)\s+(?:[A-Za-z][\w'-]*\s+){0,3}skills\b/gi, kind: 'skills' },
  { re: /(\d+)개\s*스킬/g, kind: 'skills' },
];

function scanClaims(
  check: string,
  file: string,
  text: string,
  evidenceLine?: number,
): void {
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    const lineNo = evidenceLine ?? i + 1;
    for (const { re, kind } of CLAIM_PATTERNS) {
      for (const m of line.matchAll(re)) {
        const claimed = parseInt(m[1], 10);
        const actual = kind === 'agents' ? agents.length : skills.length;
        if (Number.isNaN(claimed) || claimed === actual) continue;
        if (/common/i.test(m[0])) continue; // subset claim about common-inherited skills
        add(
          check,
          file,
          `claims "${m[0].trim()}" but ${kind}[] has ${actual}`,
          lineNo,
        );
      }
    }
  });
}

function checkA(): void {
  const CHECK = 'a';
  const claimFiles: Array<[string, boolean]> = [
    // [absolute path, whole-file scan? false = variant.json description scope]
    [join(tpl, 'variant.json'), false],
    [join(tpl, 'README.md'), true],
    [join(tpl, 'README_ko.md'), true],
    [join(tpl, 'PROMOTION_CHECKLIST.md'), true],
    [join(tpl, 'docs', `${templateName}.context.md`), true],
    [join(tpl, 'agents', 'README.md'), true],
  ];
  for (const [p, wholeFile] of claimFiles) {
    if (p === variantPath) {
      const description = typeof variant.description === 'string' ? variant.description : null;
      if (description) {
        scanClaims(CHECK, rel(variantPath), description, lineOf(variantRaw, '"description"'));
      }
      continue;
    }
    const text = readText(p);
    if (text === null) continue; // optional file
    scanClaims(CHECK, rel(p), text);
  }
}

// ── Check b — theme_manifest truth ───────────────────────────────────────────

/** Names from the first markdown table between AUTO-GENERATED markers. */
function markerTableNames(md: string, marker: string): string[] {
  const start = md.indexOf(`<!-- ${marker}:START`);
  const end = md.indexOf(`<!-- ${marker}:END`);
  if (start < 0 || end < 0 || end < start) return [];
  const names: string[] = [];
  for (const line of md.slice(start, end).split('\n')) {
    if (!line.trim().startsWith('|')) continue;
    const cells = splitMdRow(line);
    if (cells.length < 2 || /^-+$/.test(cells[0].replace(/\s/g, ''))) continue;
    const name = cells[0].replace(/[`*]/g, '').trim();
    if (name && name.toLowerCase() !== 'name') names.push(name);
  }
  return names;
}

function setDiff(actual: string[], declared: string[]): { missing: string[]; extra: string[] } {
  const a = new Set(actual);
  const d = new Set(declared);
  return {
    missing: actual.filter((x) => !d.has(x)),
    extra: declared.filter((x) => !a.has(x)),
  };
}

function checkB(): { skipped?: string } {
  const CHECK = 'b';
  const themesDir = join(tpl, 'docs', 'html-themes', 'themes');
  const stylesDir = join(tpl, 'docs', 'html-themes', 'styles');
  if (!existsSync(themesDir) && !existsSync(stylesDir)) {
    return { skipped: 'no docs/html-themes/{themes,styles} tree' };
  }
  const manifest = variant.theme_manifest;
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    add(CHECK, rel(variantPath), `docs/html-themes tree exists but theme_manifest is ${manifest === null ? 'null' : typeof manifest}`);
    return {};
  }
  const m = manifest as Record<string, unknown>;
  const actualThemes = listDirs(themesDir).filter((d) => d !== '_shared');
  const actualStyles = listDirs(stylesDir);

  const hasOld = 'available' in m || 'default' in m;
  const hasNew =
    Array.isArray(m.themes) || Array.isArray(m.styles) ||
    typeof m.default_theme === 'string' || typeof m.default_style === 'string';

  if (hasOld) {
    const available = Array.isArray(m.available) ? m.available.map(String) : [];
    const masquerading = available.filter((x) => actualStyles.includes(x) && !actualThemes.includes(x));
    add(
      CHECK,
      rel(variantPath),
      `theme_manifest uses the retired available/default keys (schema migrated per design D3 — use themes/styles/default_theme/default_style)`,
      lineOf(variantRaw, '"available"'),
    );
    if (masquerading.length > 0) {
      add(
        CHECK,
        rel(variantPath),
        `style names masquerading as themes in available[]: ${masquerading.join(', ')} (actual themes: ${actualThemes.join(', ')})`,
      );
    }
    const legacyDefault = typeof m.default === 'string' ? m.default : null;
    if (legacyDefault && actualStyles.includes(legacyDefault) && !actualThemes.includes(legacyDefault)) {
      add(CHECK, rel(variantPath), `theme_manifest.default "${legacyDefault}" is a style name, not a theme`);
    }
  }
  if (hasNew) {
    if (Array.isArray(m.themes)) {
      const declared = m.themes.map(String);
      const { missing, extra } = setDiff(actualThemes, declared);
      if (missing.length) add(CHECK, rel(variantPath), `themes[] missing actual theme dirs: ${missing.join(', ')}`);
      if (extra.length) add(CHECK, rel(variantPath), `themes[] declares nonexistent themes: ${extra.join(', ')}`);
    }
    if (Array.isArray(m.styles)) {
      const declared = m.styles.map(String);
      const { missing, extra } = setDiff(actualStyles, declared);
      if (missing.length) add(CHECK, rel(variantPath), `styles[] missing actual style dirs: ${missing.join(', ')}`);
      if (extra.length) add(CHECK, rel(variantPath), `styles[] declares nonexistent styles: ${extra.join(', ')}`);
    }
    if (typeof m.default_theme === 'string') {
      if (!actualThemes.includes(m.default_theme)) {
        add(CHECK, rel(variantPath), `default_theme "${m.default_theme}" is not an actual theme (themes/: ${actualThemes.join(', ')})`);
      }
    }
    if (typeof m.default_style === 'string') {
      if (!actualStyles.includes(m.default_style)) {
        add(CHECK, rel(variantPath), `default_style "${m.default_style}" is not an actual style (styles/: ${actualStyles.join(', ')})`);
      }
    }
  }
  if (!hasOld && !hasNew) {
    add(CHECK, rel(variantPath), 'theme_manifest declares no themes/styles/defaults');
  }

  // THEMES.md cross-check: registered rows + default claims.
  const themesMdPath = join(tpl, 'docs', 'html-themes', 'THEMES.md');
  const themesMd = readText(themesMdPath);
  if (themesMd !== null) {
    const registered = markerTableNames(themesMd, 'AUTO-GENERATED-THEME-TABLE');
    if (registered.length > 0 && existsSync(themesDir)) {
      const { missing, extra } = setDiff(actualThemes, registered);
      if (missing.length) add(CHECK, rel(themesMdPath), `THEMES.md theme table missing actual themes: ${missing.join(', ')}`);
      if (extra.length) add(CHECK, rel(themesMdPath), `THEMES.md theme table registers nonexistent themes: ${extra.join(', ')}`);
    }
    const defaultThemeClaim = themesMd.match(/[Dd]efault theme is [`']?([a-z0-9-]+)/i)
      ?? (typeof m.notes === 'string' ? (m.notes as string).match(/[Dd]efault theme is [`']?([a-z0-9-]+)/i) : undefined);
    if (defaultThemeClaim && typeof m.default_theme === 'string' && defaultThemeClaim[1] !== m.default_theme) {
      add(
        CHECK,
        existsSync(themesMdPath) && /[Dd]efault theme is/i.test(themesMd) ? rel(themesMdPath) : rel(variantPath),
        `default-theme claim "${defaultThemeClaim[1]}" ≠ theme_manifest.default_theme "${m.default_theme}"`,
      );
    }
    const defaultStyleClaim = themesMd.match(/[`]([a-z0-9-]+)[`] is the default style/i);
    if (defaultStyleClaim && typeof m.default_style === 'string' && defaultStyleClaim[1] !== m.default_style) {
      add(CHECK, rel(themesMdPath), `default-style claim "${defaultStyleClaim[1]}" ≠ theme_manifest.default_style "${m.default_style}"`);
    }
  }
  return {};
}

// ── Check c — status coherence ───────────────────────────────────────────────

// Korean README_ko.md carries the direct translations of the beta block
// ("베타 변형 — 프로덕션 용도가 아닙니다"), so the KO phrases join the pattern.
const BETA_WORDING_RE = /beta variant|not for production|베타 변형|프로덕션 용도가 아닙/i;

function checkC(): { skipped?: string } {
  const CHECK = 'c';
  if (!status) return { skipped: 'variant.json has no status field' };
  if (status !== 'stable') return {}; // only the stable ⇒ no-beta-residue rule is mechanical
  const beta = variant.betaLifecycleSummary;
  if (beta !== null && beta !== undefined) {
    add(
      CHECK,
      rel(variantPath),
      `lifecycle.status is "stable" but betaLifecycleSummary is non-null (convention: null for stable variants, design D2)`,
      lineOf(variantRaw, '"betaLifecycleSummary"'),
    );
  }
  for (const name of ['README.md', 'README_ko.md']) {
    const p = join(tpl, name);
    const text = readText(p);
    if (text === null) continue;
    text.split('\n').forEach((line, i) => {
      if (BETA_WORDING_RE.test(line)) {
        add(CHECK, rel(p), `stable variant carries beta wording: ${norm(line).slice(0, 90)}`, i + 1);
      }
    });
  }
  const checklistPath = join(tpl, 'PROMOTION_CHECKLIST.md');
  const checklist = readText(checklistPath);
  if (checklist !== null) {
    const statusLine = checklist.match(/^\*{0,2}Current Status:?\*{0,2}\s*(\S+)\s*(\(([^)]*)\))?/im);
    if (statusLine) {
      const claimed = statusLine[1].toLowerCase().replace(/[^a-z]/g, '');
      if (claimed && claimed !== status.toLowerCase()) {
        add(
          CHECK,
          rel(checklistPath),
          `claims "Current Status: ${statusLine[1].trim()}" but variant.json status is "${status}"`,
          lineOf(checklist, statusLine[0].trim()),
        );
      }
      const versionClaim = statusLine[3]?.match(/v?(\d+\.\d+\.\d+)/);
      if (versionClaim && typeof variant.version === 'string' && versionClaim[1] !== variant.version) {
        add(
          CHECK,
          rel(checklistPath),
          `claims version ${versionClaim[1]} but variant.json version is ${variant.version}`,
          lineOf(checklist, statusLine[0].trim()),
        );
      }
    }
  }
  return {};
}

// ── Check d — process_manifest path existence ────────────────────────────────

function checkD(): { skipped?: string } {
  const CHECK = 'd';
  const pm = variant.process_manifest;
  if (!pm || typeof pm !== 'object' || Array.isArray(pm)) {
    return { skipped: 'no process_manifest' };
  }
  const m = pm as Record<string, unknown>;
  const pathFields = ['stages_file', 'raci_file', 'gates_file'] as const;
  for (const field of pathFields) {
    const v = m[field];
    if (v === null || v === undefined) continue; // null = intentionally absent
    if (typeof v !== 'string' || v.trim() === '') {
      add(CHECK, rel(variantPath), `process_manifest.${field} must be a non-empty path or null (got ${JSON.stringify(v)})`);
      continue;
    }
    const abs = join(tpl, v);
    if (!existsSync(abs)) {
      add(CHECK, rel(variantPath), `process_manifest.${field} points at a nonexistent path: ${v}`, lineOf(variantRaw, `"${field}"`));
    }
  }
  const ev = m.evidence_models_dir;
  if (ev !== null && ev !== undefined) {
    if (typeof ev !== 'string' || ev.trim() === '') {
      add(CHECK, rel(variantPath), `process_manifest.evidence_models_dir must be a non-empty dir path or null (got ${JSON.stringify(ev)})`);
    } else {
      const abs = join(tpl, ev);
      if (!existsSync(abs)) {
        add(CHECK, rel(variantPath), `process_manifest.evidence_models_dir points at a nonexistent dir: ${ev}`, lineOf(variantRaw, '"evidence_models_dir"'));
      }
    }
  }
  return {};
}

// ── Check e — owner validity (owners ∈ roster) ───────────────────────────────

function isRosterAgent(name: string): boolean {
  return roster.has(name) || [...roster].some((r) => r.toLowerCase() === name.toLowerCase());
}

function checkE(): void {
  const CHECK = 'e';
  const stagesPath = join(tpl, 'process', 'stages.yaml');
  const gatesPath = join(tpl, 'decisions', 'gates.yaml');
  const raciPath = join(tpl, 'governance', 'raci.yaml');

  const stages = parseYamlFile(stagesPath);
  if (stages.ok && stages.data && typeof stages.data === 'object') {
    const stagesRaw = readText(stagesPath) ?? '';
    const list = (stages.data as Record<string, unknown>).stages;
    if (Array.isArray(list)) {
      for (const s of list) {
        const stage = s as Record<string, unknown>;
        const owner = typeof stage.owner_agent === 'string' ? stage.owner_agent : null;
        if (owner && !isRosterAgent(owner)) {
          add(CHECK, rel(stagesPath), `stage ${String(stage.id ?? '?')} owner_agent "${owner}" is not in the agent roster`, lineOf(stagesRaw, `id: ${String(stage.id ?? '')}`));
        }
      }
    }
  }

  const gates = parseYamlFile(gatesPath);
  if (gates.ok && gates.data && typeof gates.data === 'object') {
    const gatesRaw = readText(gatesPath) ?? '';
    const list = (gates.data as Record<string, unknown>).gates;
    if (Array.isArray(list)) {
      for (const g of list) {
        const gate = g as Record<string, unknown>;
        const decider = typeof gate.decider_agent === 'string' ? gate.decider_agent : null;
        if (decider && !isRosterAgent(decider)) {
          add(CHECK, rel(gatesPath), `gate ${String(gate.id ?? '?')} decider_agent "${decider}" is not in the agent roster`, lineOf(gatesRaw, `id: ${String(gate.id ?? '')}`));
        }
      }
    }
  }

  const raci = parseYamlFile(raciPath);
  if (raci.ok && raci.data && typeof raci.data === 'object') {
    const raciRaw = readText(raciPath) ?? '';
    const rows = (raci.data as Record<string, unknown>).rows;
    if (Array.isArray(rows)) {
      for (const r of rows) {
        const row = r as Record<string, unknown>;
        const activity = typeof row.activity === 'string' ? row.activity : '?';
        const accountable = typeof row.accountable === 'string' ? row.accountable : null;
        if (accountable && !isRosterAgent(accountable)) {
          add(CHECK, rel(raciPath), `RACI accountable "${accountable}" is not in the agent roster (${activity})`, lineOf(raciRaw, `activity: ${activity}`));
        }
        if (Array.isArray(row.responsible)) {
          for (const name of row.responsible.map(String)) {
            if (!isRosterAgent(name)) {
              add(CHECK, rel(raciPath), `RACI responsible "${name}" is not in the agent roster (${activity})`, lineOf(raciRaw, `activity: ${activity}`));
            }
          }
        }
      }
    }
  }

  // docs/phase-definitions.md — Owning Agent(s) column.
  const phasesPath = join(tpl, 'docs', 'phase-definitions.md');
  const phases = readText(phasesPath);
  if (phases !== null) {
    const lines = phases.split('\n');
    const headerIdx = lines.findIndex((l) => /^\|/.test(l.trim()) && /Owning Agent/i.test(l));
    if (headerIdx >= 0) {
      const ownerCol = splitMdRow(lines[headerIdx]).findIndex((c) => /Owning Agent/i.test(c));
      if (ownerCol >= 0) {
        for (let i = headerIdx + 2; i < lines.length; i++) {
          const line = lines[i];
          if (!line.trim().startsWith('|')) break;
          if (/^\|[\s:|-]+\|/.test(line.trim())) continue; // separator row
          const cell = splitMdRow(line)[ownerCol] ?? '';
          for (const piece of cell.split(',')) {
            const name = piece.replace(/[`*]/g, '').trim();
            if (!name) continue;
            if (!isRosterAgent(name)) {
              add(CHECK, rel(phasesPath), `phase-table owner "${name}" is not in the agent roster`, i + 1);
            }
          }
        }
      }
    }
  }
}

// ── Check f — scaffold hygiene (PENDING_REVIEW / truncated gate titles) ──────

const GOVERNANCE_YAML_DIRS = ['process', 'governance', 'decisions'] as const;

function checkF(): void {
  const CHECK = 'f';
  if (status === 'draft') return; // draft variants are allowed scaffold placeholders
  for (const dirName of GOVERNANCE_YAML_DIRS) {
    const dir = join(tpl, dirName);
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const f of entries.filter((e) => /\.ya?ml$/.test(e))) {
      const p = join(dir, f);
      const raw = readText(p);
      if (raw === null) continue;
      const idx = raw.indexOf('PENDING_REVIEW');
      if (idx >= 0) {
        add(CHECK, rel(p), `PENDING_REVIEW residue in a ${status} variant`, raw.slice(0, idx).split('\n').length);
      }
    }
  }

  // Truncated gate titles: the criteria sentence continues past the title's cut point.
  const gatesPath = join(tpl, 'decisions', 'gates.yaml');
  const gates = parseYamlFile(gatesPath);
  if (gates.ok && gates.data && typeof gates.data === 'object') {
    const gatesRaw = readText(gatesPath) ?? '';
    const list = (gates.data as Record<string, unknown>).gates;
    if (Array.isArray(list)) {
      for (const g of list) {
        const gate = g as Record<string, unknown>;
        const title = typeof gate.title === 'string' ? norm(gate.title) : '';
        const criteria = Array.isArray(gate.criteria) ? gate.criteria.map((c) => norm(String(c))) : [];
        const first = criteria[0] ?? '';
        if (title && first && first.length > title.length && first.startsWith(title)) {
          const id = String(gate.id ?? '?');
          add(
            CHECK,
            rel(gatesPath),
            `gate ${id} title is truncated — its criteria sentence continues past it: "...${first.slice(title.length)}"`,
            lineOf(gatesRaw, title),
          );
        }
      }
    }
  }
}

// ── Check g — phantom skill paths ────────────────────────────────────────────

const SKILL_PATH_RE = /skills\/([A-Za-z0-9][\w.-]*)\/SKILL\.md/g;

function checkG(): void {
  const CHECK = 'g';
  const localSkillsDir = join(tpl, 'skills');
  const commonDir = typeof variant.inherits_common === 'string' ? join(WORKSPACE_ROOT, variant.inherits_common) : join(WORKSPACE_ROOT, 'templates', 'common');
  const commonSkillsDir = join(commonDir, 'skills');
  const commonAllowed = variant.inherits_common !== false && existsSync(commonSkillsDir);

  const scanTargets = [
    join(tpl, 'AGENTS.md'),
    join(tpl, 'README.md'),
    join(tpl, 'README_ko.md'),
    join(tpl, 'PROMOTION_CHECKLIST.md'),
    ...walkMdFiles(join(tpl, 'docs')),
  ];
  for (const p of scanTargets) {
    const text = readText(p);
    if (text === null) continue;
    text.split('\n').forEach((line, i) => {
      for (const m of line.matchAll(SKILL_PATH_RE)) {
        const name = m[1];
        const localOk = existsSync(join(localSkillsDir, name, 'SKILL.md'));
        const commonOk = commonAllowed && existsSync(join(commonSkillsDir, name, 'SKILL.md'));
        if (localOk || commonOk) continue;
        add(
          CHECK,
          rel(p),
          `phantom skill path "skills/${name}/SKILL.md" — resolves neither in templates/${templateName}/skills/ nor templates/common/skills/`,
          i + 1,
        );
      }
    });
  }
}

// ── Check h — deprecated-script references in active docs ────────────────────

function checkH(): { skipped?: string } {
  const CHECK = 'h';
  const sm = variant.script_manifest;
  if (!sm || typeof sm !== 'object' || Array.isArray(sm)) {
    return { skipped: 'no script_manifest' };
  }
  const local = (sm as Record<string, unknown>).local;
  if (!Array.isArray(local)) return { skipped: 'script_manifest.local is not a list' };
  const deprecated = local
    .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object' && (e as Record<string, unknown>).status === 'deprecated')
    .map((e) => ({
      name: String(e.name ?? basename(String(e.path ?? '')).replace(/\.[^.]+$/, '')),
      file: String(e.path ?? ''),
    }))
    .filter((e) => e.name && e.file);
  if (deprecated.length === 0) return {};

  const scanTargets: string[] = [];
  try {
    for (const d of readdirSync(join(tpl, 'skills'), { withFileTypes: true })) {
      if (d.isDirectory()) {
        const skillMd = join(tpl, 'skills', d.name, 'SKILL.md');
        if (existsSync(skillMd)) scanTargets.push(skillMd);
      }
    }
  } catch {
    /* no skills dir */
  }
  try {
    for (const f of readdirSync(join(tpl, 'agents'))) {
      if (f.endsWith('.md') && !/^README/i.test(f)) scanTargets.push(join(tpl, 'agents', f));
    }
  } catch {
    /* no agents dir */
  }

  for (const p of scanTargets) {
    const text = readText(p);
    if (text === null) continue;
    text.split('\n').forEach((line, i) => {
      for (const dep of deprecated) {
        if (new RegExp(`\\b${dep.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(line)) {
          add(
            CHECK,
            rel(p),
            `references deprecated script "${dep.file}" (script_manifest status: deprecated) — active docs must not instruct it`,
            i + 1,
          );
        }
      }
    });
  }
  return {};
}

// ── Check i — undeclared bare imports ────────────────────────────────────────

// Node builtins (legacy bare form; `node:`/`bun:` prefixed specifiers are
// handled separately) — base name before any '/'.
const BUILTIN_MODULES = new Set([
  'assert', 'async_hooks', 'buffer', 'child_process', 'cluster', 'console', 'constants',
  'crypto', 'dgram', 'diagnostics_channel', 'dns', 'domain', 'events', 'fs', 'http',
  'http2', 'https', 'inspector', 'module', 'net', 'os', 'path', 'perf_hooks', 'process',
  'punycode', 'querystring', 'readline', 'repl', 'stream', 'string_decoder', 'sys',
  'test', 'timers', 'tls', 'trace_events', 'tty', 'url', 'util', 'v8', 'vm', 'wasi',
  'worker_threads', 'zlib', 'sqlite',
]);

const IMPORT_PATTERNS: RegExp[] = [
  /\bfrom\s+["']([^"']+)["']/g,
  /^import\s+["']([^"']+)["']/g,
  /\bimport\(\s*["']([^"']+)["']\s*\)/g,
  /\brequire\(\s*["']([^"']+)["']\s*\)/g,
];

function extractBareImports(text: string): Array<{ spec: string; line: number }> {
  const out: Array<{ spec: string; line: number }> = [];
  text.split('\n').forEach((line, i) => {
    for (const re of IMPORT_PATTERNS) {
      for (const m of line.matchAll(re)) {
        out.push({ spec: m[1], line: i + 1 });
      }
    }
  });
  return out;
}

function isBuiltin(spec: string): boolean {
  if (spec.startsWith('node:') || spec.startsWith('bun:')) return true;
  return BUILTIN_MODULES.has(spec.split('/')[0]);
}

function declaredDeps(pkgPath: string): Set<string> {
  const declared = new Set<string>();
  const raw = readText(pkgPath);
  if (raw === null) return declared;
  try {
    const pkg = JSON.parse(raw) as Record<string, unknown>;
    for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
      const deps = pkg[section];
      if (deps && typeof deps === 'object' && !Array.isArray(deps)) {
        for (const name of Object.keys(deps as Record<string, unknown>)) declared.add(name);
      }
    }
  } catch {
    /* unparseable package.json — treated as declaring nothing */
  }
  return declared;
}

function checkI(): { skipped?: string } {
  const CHECK = 'i';
  const sm = variant.script_manifest;
  if (!sm || typeof sm !== 'object' || Array.isArray(sm)) {
    return { skipped: 'no script_manifest' };
  }
  const local = (sm as Record<string, unknown>).local;
  if (!Array.isArray(local) || local.length === 0) return { skipped: 'script_manifest.local is empty' };

  const declared = new Set<string>([
    ...declaredDeps(join(tpl, 'package.json')),
    ...declaredDeps(join(WORKSPACE_ROOT, 'templates', 'common', 'package.json')),
  ]);

  for (const entry of local) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const relPath = typeof e.path === 'string' ? e.path : null;
    if (!relPath) continue;
    const abs = join(tpl, relPath);
    if (!existsSync(abs)) continue; // existence is validate-templates' job
    const text = readText(abs);
    if (text === null) continue;
    for (const { spec, line } of extractBareImports(text)) {
      if (spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('#')) continue;
      if (isBuiltin(spec)) continue;
      if (declared.has(spec) || declared.has(spec.split('/')[0])) continue;
      add(
        CHECK,
        rel(abs),
        `bare import "${spec}" is not declared in templates/${templateName}/package.json or templates/common/package.json`,
        line,
      );
    }
  }
  return {};
}

// ── Check j — AGENTS.md boilerplate drift vs common ──────────────────────────

function extractSection(text: string, headerPrefix: string): { body: string; headerLine: number } | null {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.startsWith(headerPrefix));
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) {
      end = i;
      break;
    }
  }
  return { body: lines.slice(start + 1, end).join('\n'), headerLine: start + 1 };
}

function sectionBullets(body: string): Set<string> {
  const bullets = new Set<string>();
  for (const m of body.matchAll(/^\s*-\s*\*\*([^*:]+)\*\*\s*:/gm)) {
    bullets.add(m[1].trim());
  }
  return bullets;
}

function checkJ(): { skipped?: string } {
  const CHECK = 'j';
  const variantAgentsMdPath = join(tpl, 'AGENTS.md');
  const commonAgentsMdPath = join(WORKSPACE_ROOT, 'templates', 'common', 'AGENTS.md');
  const variantMd = readText(variantAgentsMdPath);
  const commonMd = readText(commonAgentsMdPath);
  if (variantMd === null) return { skipped: 'template has no AGENTS.md' };
  if (commonMd === null) return { skipped: 'templates/common/AGENTS.md not found' };

  // §7 baseline bullets: variant must be a superset of common's.
  const v7 = extractSection(variantMd, '## §7');
  const c7 = extractSection(commonMd, '## §7');
  if (v7 && c7) {
    const vBullets = sectionBullets(v7.body);
    const cBullets = sectionBullets(c7.body);
    for (const bullet of cBullets) {
      if (!vBullets.has(bullet)) {
        add(CHECK, rel(variantAgentsMdPath), `§7 is missing the common baseline bullet "${bullet}"`, v7.headerLine);
      }
    }
  }

  // Retired invocations used as live instructions (the corrected phrasing
  // names `/meeting` as retired and is exempt). The lookahead keeps
  // `skills/meeting-facilitation` references from matching as `/meeting`.
  variantMd.split('\n').forEach((line, i) => {
    if (/\/meeting(?![\w-])/.test(line) && !/retired/i.test(line)) {
      add(CHECK, rel(variantAgentsMdPath), `retired "/meeting" invocation used as a live instruction`, i + 1);
    }
  });

  // §8/§9/§10 must use the thin-dispatcher pointer form.
  for (const section of ['## §8', '## §9', '## §10']) {
    const sec = extractSection(variantMd, section);
    if (!sec) continue; // absent section is a validate-templates concern
    const head = sec.body.split('\n').map(norm).filter(Boolean).slice(0, 3);
    if (!head.some((l) => /Moved to|thin-dispatcher/i.test(l))) {
      add(CHECK, rel(variantAgentsMdPath), `${section}: … must use the thin-dispatcher pointer form ("Moved to …", ADR-0090) instead of inline boilerplate`, sec.headerLine);
    }
  }
  return {};
}

// ── Dispatch ─────────────────────────────────────────────────────────────────

interface CheckDef {
  id: string;
  label: string;
  run: () => void | { skipped?: string };
}

const CHECKS: CheckDef[] = [
  { id: 'a', label: 'Roster-count claims vs manifests', run: checkA },
  { id: 'b', label: 'theme_manifest truth (themes/styles/defaults)', run: checkB },
  { id: 'c', label: 'Status coherence (stable ⇒ no beta residue)', run: checkC },
  { id: 'd', label: 'process_manifest path existence', run: checkD },
  { id: 'e', label: 'Owner validity (owners ∈ agent roster)', run: checkE },
  { id: 'f', label: 'Scaffold hygiene (PENDING_REVIEW / truncated titles)', run: checkF },
  { id: 'g', label: 'Phantom skill paths', run: checkG },
  { id: 'h', label: 'Deprecated-script references in active docs', run: checkH },
  { id: 'i', label: 'Undeclared bare imports', run: checkI },
  { id: 'j', label: 'AGENTS.md boilerplate drift vs common', run: checkJ },
];

console.log(`validate-variant-claims v${VERSION} — templates/${templateName}\n`);

const skipped: Array<{ id: string; reason: string }> = [];
const green: string[] = [];
const failed: Array<{ id: string; label: string; count: number }> = [];

for (const c of CHECKS) {
  const before = findings.filter((f) => f.check === c.id).length;
  let result: void | { skipped?: string } | undefined = undefined;
  try {
    result = c.run();
  } catch (e) {
    add(c.id, `templates/${templateName}/`, `check crashed: ${e instanceof Error ? e.message : String(e)}`);
  }
  const after = findings.filter((f) => f.check === c.id).length;
  if (result && result.skipped) {
    skipped.push({ id: c.id, reason: result.skipped });
  } else if (after > before) {
    failed.push({ id: c.id, label: c.label, count: after - before });
  } else {
    green.push(c.id);
  }
}

// Per-check output: findings first (❌ with file:line), then per-check verdicts.
let lastCheck = '';
for (const f of findings) {
  if (f.check !== lastCheck) {
    console.log(`[${f.check}] ${CHECKS.find((c) => c.id === f.check)?.label ?? f.check}`);
    lastCheck = f.check;
  }
  const loc = f.line ? `${f.file}:${f.line}` : f.file;
  console.log(`   ❌ ${loc} — ${f.message}`);
}
if (findings.length > 0) console.log('');

for (const g of green) {
  const label = CHECKS.find((c) => c.id === g)?.label ?? g;
  console.log(`✅ [${g}] ${label} — clean`);
}
for (const s of skipped) {
  console.log(`—  [${s.id}] ${CHECKS.find((c) => c.id === s.id)?.label} — skipped (${s.reason})`);
}

console.log(`\n=== Variant claims summary (templates/${templateName}) ===`);
for (const f of failed) console.log(`  ❌ [${f.id}] ${f.label} — ${f.count} finding(s)`);
for (const g of green) console.log(`  ✅ [${g}] ${CHECKS.find((c) => c.id === g)?.label}`);
for (const s of skipped) console.log(`  —  [${s.id}] ${CHECKS.find((c) => c.id === s.id)?.label} — skipped (${s.reason})`);
console.log(
  `Result: ${failed.length > 0 ? 'FAIL' : 'PASS'} — ${findings.length} finding(s); ` +
  `${green.length}/${CHECKS.length} checks green, ${skipped.length} skipped\n`,
);

if (import.meta.main) {
  process.exit(failed.length > 0 ? 1 : 0);
}
