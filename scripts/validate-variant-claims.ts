#!/usr/bin/env bun
// @version 1.5.0
// v1.5.0 (2026-10-08, T-20261006-006): the calibration-sensitive pure helpers
//          (splitMdRow, markerTableNames, setDiff, extractBareImports,
//          isBuiltin, lineOf, isRosterAgent) are exported for unit tests
//          (tests/unit/validate-variant-claims.test.ts pins them). Behavior
//          unchanged.
/**
 * validate-variant-claims.ts — variant contract-truth validator (D6 of
 * docs/designs/2026-10-05-co-deck-review-remediation-design.md; T-20261005-011..014;
 * batch 2 per D9 of docs/designs/2026-10-05-consult-abap-develop-review-remediation-design.md,
 * T-20261005-022; batch 3 + F4 calibration per T-20261005-019).
 *
 * Closes the ratchet loop for the 24 `script-gap` finding classes in
 * docs/reports/2026-10-05-project-review-scoped-co-deck.md and the 16 batch-2
 * candidates in docs/reports/2026-10-05-project-review-scoped-co-consult-co-abap-co-develop.md:
 * the machine battery validates structure (existence, parity, registry sync) but
 * not the truthfulness of prose claims and semantic bindings. This validator
 * checks one L2 variant's descriptive surface against its manifests:
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
 *   k. Checklist criteria     — stable ⇒ no Pending/TBD promotion-criteria rows
 *                               in PROMOTION_CHECKLIST.md (rows citing ADR-0099
 *                               are resolved), and the Review History section
 *                               must exist and be non-empty. (D9 item 1)
 *   l. Migration attestation  — stable promotion within 30 days of created_at
 *                               (or a migration-worded lastTransition) requires
 *                               an ADR-0099 attestation row in Review History.
 *                               (D9 item 2)
 *   m. Lifecycle record       — docs/lifecycle/templates/<name>.md numeric
 *                               agent/skill claims and "All N … present (…)"
 *                               name lists vs the agents[]/skills[] arrays.
 *                               (D9 item 3)
 *   n. Roster table rows      — positively-identified agent/skill markdown
 *                               tables in README.md, README_ko.md,
 *                               agents/README.md, docs/<name>.context.md vs the
 *                               roster/skill universes; the README and
 *                               agents-README surfaces additionally assert
 *                               agent completeness (context.md tables may be
 *                               pipeline-scoped). (D9 item 4)
 *   o. Skill↔agent binding    — skill_manifest.used_by_agents ⊇ each agent's
 *                               required_skills frontmatter (missing = error;
 *                               the reverse direction = warning only). (D9 item 5)
 *   p. Spawn targets          — script-extension string literals in
 *                               script_manifest.local scripts (spawn/exec family
 *                               targets) must resolve to existing files under
 *                               the template's layout conventions. (D9 item 6)
 *   q. Cross-layer imports    — relative imports escaping scripts/<variant>/
 *                               must resolve in templates/common/scripts/
 *                               (post-scaffold flat-sync contract); flagged
 *                               only when the common target is missing. (D9 item 8)
 *   r. Checklist cited keys   — variant.json keys cited in PROMOTION_CHECKLIST
 *                               (e.g. `phaseAComplete: true`) must exist. (D9 item 9)
 *   s. SCRIPTS.md flags       — bracketed `[--flag <arg>]`/`[--flag]` tokens in the
 *                               variant SCRIPTS.md usage column must appear in the
 *                               manifest script's source (argv-parsing string match).
 *                               Batch 3 (T-20261005-019).
 *   t. Settings hook lint     — .claude/settings.json hook entries must use the
 *                               hooks:[{type:"command",...}] wrapper (a bare
 *                               `command` is the co-abap malformed class);
 *                               duplicate (event, matcher, command) triples are
 *                               warnings. Batch 3 (T-20261005-019).
 *
 * Check p is calibrated (v1.3.0): spawn-target literals must look like paths —
 * no whitespace, plus a `/`/`\` separator or a plausible bare script basename —
 * and comments are stripped before scanning, so quoted prose sentences
 * ("enforced the same way by safety-audit.ts") and whole command strings
 * ("bun scripts/x/safety-audit.ts") no longer flag.
 *
 * Roster/claim calibration (v1.4.0, F4 triage of co-safety): the agent-file
 * roster walk is RECURSIVE (nested `_shared/**` and `domains/**` trees are
 * roster members; their top-level-only manifest scope is documented per
 * T-20260912-014), and numeric "N agents" claims are truthful when they match
 * the manifest length OR the on-disk agent-definition-file count (extends
 * stubs excluded — delivery pointers are not definitions). Check n recognizes
 * table headers only at a table start, so a tool-mapping data row
 * (`| Agent | agent_manager / … |`) no longer poisons the rows after it.
 *
 * Each check is independent: one failure never aborts the rest, and a missing
 * input (no html-themes tree, no process_manifest, …) skips that check cleanly.
 * Warnings (⚠️) are informational and never affect the exit code.
 *
 * Exit codes: 0 = all checks clean, 1 = one or more findings (or the target
 * template does not exist / variant.json is unreadable).
 *
 * Usage: bun scripts/validate-variant-claims.ts [--template <name>]   # default: co-deck
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as yamlLoad } from 'js-yaml';

const VERSION = '1.5.0';
const WORKSPACE_ROOT = fileURLToPath(new URL('..', import.meta.url));

// ── CLI ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
validate-variant-claims v${VERSION}

Validates a template variant's descriptive claims against its manifests
(contract-truth checks a-t; design D6 of 2026-10-05-co-deck-review-remediation
+ batch-2 D9 of 2026-10-05-consult-abap-develop-review-remediation
+ batch-3 T-20261005-019).

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

// Warnings are informational (e.g. check o's reverse direction) — printed but
// never counted as findings and never affecting the exit code.
const warnings: Finding[] = [];
const warn = (check: string, file: string, message: string, line?: number): void => {
  warnings.push({ check, file, line, message });
};

function readText(p: string): string | null {
  try {
    return readFileSync(p, 'utf-8');
  } catch {
    return null;
  }
}

/** 1-based line of the first occurrence of `needle` (undefined when absent or text unread). */
export function lineOf(text: string | null, needle: string): number | undefined {
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
export function splitMdRow(line: string): string[] {
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

// Roster = declared agents[] ∪ agent files on disk. The disk walk is RECURSIVE
// (v1.4.0 calibration, F4 triage of co-safety): variants like co-safety ship
// nested agent trees (agents/_shared/**, agents/domains/{functional,industry}/**)
// whose manifest scope is documented in their agents/README.md (T-20260912-014)
// — nested files are roster members for owner-validity, phantom-row and
// completeness checks. README* files are not agents.
const roster = new Set<string>(agents);
// Numeric-claim truth count (v1.4.0): agent DEFINITION files on disk. An
// extends file (ADR-0033 `extends:` frontmatter) is a delivery pointer, not a
// definition — UNLESS it declares `variant_overrides:` (substantive variant
// deltas resolved at scaffold/adopt time; the co-safety pm.md CSO-override
// form). So co-safety counts 40 (39 flat/self-contained + pm.md override),
// excluding the pure common-delivered i18n-specialist pointer.
let agentDefFileCount = 0;
try {
  const walkAgents = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        walkAgents(full);
      } else if (e.isFile() && e.name.endsWith('.md') && !/^README/i.test(e.name)) {
        roster.add(e.name.replace(/\.md$/, ''));
        const text = readFileSync(full, 'utf-8');
        const fm = text.split('---')[1] ?? '';
        const isExtendsStub = /^extends:\s*\S+/m.test(fm);
        if (!isExtendsStub || /variant_overrides:/.test(fm)) agentDefFileCount++;
      }
    }
  };
  walkAgents(join(tpl, 'agents'));
} catch {
  /* agents/ dir absent — manifest roster only */
}
// Every count a numeric agents-claim may truthfully match (v1.4.0).
const AGENT_COUNT_TRUTHS = new Set<number>([agents.length, agentDefFileCount].filter((n) => n > 0));

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
        // v1.4.0: an agents claim is truthful when it matches the manifest
        // length OR the on-disk agent-definition-file count (nested rosters;
        // T-20260912-014 manifest scope). Skills stay manifest-scoped.
        const truthful = kind === 'agents'
          ? AGENT_COUNT_TRUTHS.has(claimed)
          : claimed === skills.length;
        if (Number.isNaN(claimed) || truthful) continue;
        if (/common/i.test(m[0])) continue; // subset claim about common-inherited skills
        add(
          check,
          file,
          `claims "${m[0].trim()}" but ${kind === 'agents'
            ? `agents[] has ${agents.length} and ${agentDefFileCount} agent definition files ship on disk`
            : `skills[] has ${skills.length}`}`,
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
export function markerTableNames(md: string, marker: string): string[] {
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

export function setDiff(actual: string[], declared: string[]): { missing: string[]; extra: string[] } {
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

export function isRosterAgent(name: string): boolean {
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
  'assert', 'async_hooks', 'buffer', 'bun', 'child_process', 'cluster', 'console', 'constants',
  'crypto', 'dgram', 'diagnostics_channel', 'dns', 'domain', 'events', 'fs', 'http',
  'http2', 'https', 'inspector', 'module', 'net', 'os', 'path', 'perf_hooks', 'process',
  'punycode', 'querystring', 'readline', 'repl', 'stream', 'string_decoder', 'sys',
  'test', 'timers', 'tls', 'trace_events', 'tty', 'url', 'util', 'v8', 'vm', 'wasi',
  'worker_threads', 'zlib', 'sqlite',
]);
// The bare 'bun' entry above is a runtime builtin (Bun's shell `$` tag and
// globals) — clearing co-abap's 4 import false positives (T-20261005-030,
// D9 item 7 of the consult/abap/develop remediation design).

const IMPORT_PATTERNS: RegExp[] = [
  /\bfrom\s+["']([^"']+)["']/g,
  /^import\s+["']([^"']+)["']/g,
  /\bimport\(\s*["']([^"']+)["']\s*\)/g,
  /\brequire\(\s*["']([^"']+)["']\s*\)/g,
];

export function extractBareImports(text: string): Array<{ spec: string; line: number }> {
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

export function isBuiltin(spec: string): boolean {
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

// ── Shared markdown-section helpers (checks k–r) ─────────────────────────────

/** Body of the first `## ` section whose header line matches `headerRe`. */
function extractMdSection(text: string, headerRe: RegExp): { body: string; headerLine: number } | null {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => headerRe.test(l));
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i])) {
      end = i;
      break;
    }
  }
  return { body: lines.slice(start + 1, end).join('\n'), headerLine: start + 1 };
}

/** True when a split markdown row is the `|---|---|` separator. */
function isTableSeparator(cells: string[]): boolean {
  return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c.replace(/\s/g, '')));
}

/**
 * Parse the parenthesized name list of a "All N agents/skills present (…)"
 * record line. Names start after a ':' annotation when present (co-deck's
 * "1 PM + 10 slide-pipeline …: pm, version, …" shape) and stop at the first
 * ';' clause (co-deck's "; common provides handbook + …" annex). A list
 * trailing in "etc." is partial: members are still ⊆-checked, but equality is
 * not asserted.
 */
function parseLifecycleNameList(paren: string): { names: string[]; complete: boolean } {
  let content = paren;
  const colonIdx = content.indexOf(':');
  if (colonIdx >= 0) content = content.slice(colonIdx + 1);
  content = content.split(';')[0];
  const pieces = content.split(',').map((p) => p.replace(/[`*]/g, '').trim()).filter(Boolean);
  const partial = pieces.some((p) => /^(?:etc|…)$/i.test(p) || p.includes('...'));
  const names: string[] = [];
  for (const p of pieces) {
    if (!/\s/.test(p) && /^[a-z0-9][a-z0-9_-]*$/i.test(p)) names.push(p.toLowerCase());
  }
  return { names, complete: !partial && names.length === pieces.length };
}

// ── Check k — checklist criteria vs status ───────────────────────────────────

function checkK(): { skipped?: string } {
  const CHECK = 'k';
  if (status !== 'stable') return { skipped: 'variant is not stable' };
  const checklistPath = join(tpl, 'PROMOTION_CHECKLIST.md');
  const checklist = readText(checklistPath);
  if (checklist === null) return { skipped: 'no PROMOTION_CHECKLIST.md' };

  const criteria = extractMdSection(checklist, /^## .*Promotion Criteria/i);
  if (criteria) {
    const lines = criteria.body.split('\n');
    let statusCol = -1;
    let headerIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].trim().startsWith('|')) continue;
      const cells = splitMdRow(lines[i]);
      const idx = cells.findIndex((c) => /^status$/i.test(c.replace(/[`*]/g, '').trim()));
      if (idx >= 0) {
        statusCol = idx;
        headerIdx = i;
        break;
      }
    }
    if (statusCol >= 0) {
      for (let i = headerIdx + 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim().startsWith('|')) continue;
        const cells = splitMdRow(line);
        if (isTableSeparator(cells)) continue;
        const statusCell = (cells[statusCol] ?? '').replace(/[`*]/g, '').trim();
        const criterion = (cells[1] ?? '?').replace(/[`*]/g, '').trim();
        // "N/A per ADR-0099 — migration fast-track" rows are resolved
        // admissions (design D1/D9) — only unmet states are findings here.
        if (statusCell === '' || /pending|tbd|todo|blocked/i.test(statusCell)) {
          add(
            CHECK,
            rel(checklistPath),
            `stable variant has an unresolved promotion-criteria row — "${criterion}" status is "${statusCell || '(empty)'}"`,
            criteria.headerLine + 1 + i,
          );
        }
      }
    }
  }

  const history = extractMdSection(checklist, /^## Review History/i);
  if (!history) {
    add(CHECK, rel(checklistPath), 'stable variant checklist has no "## Review History" section');
  } else {
    const dataRows = history.body
      .split('\n')
      .filter((l) => l.trim().startsWith('|'))
      .filter((l) => {
        const cells = splitMdRow(l);
        if (isTableSeparator(cells)) return false;
        return !/^date$/i.test((cells[0] ?? '').replace(/[`*]/g, '').trim());
      });
    if (dataRows.length === 0) {
      add(CHECK, rel(checklistPath), 'stable variant checklist has an empty Review History', history.headerLine);
    }
  }
  return {};
}

// ── Check l — migration attestation (ADR-0099) ───────────────────────────────

function checkL(): { skipped?: string } {
  const CHECK = 'l';
  const promotedOn = typeof lifecycle.stablePromotedOn === 'string' ? lifecycle.stablePromotedOn : null;
  if (!promotedOn) return { skipped: 'no lifecycle.stablePromotedOn' };
  const lastTransition = typeof lifecycle.lastTransition === 'string' ? lifecycle.lastTransition : '';

  const createdAt = typeof variant.created_at === 'string' ? variant.created_at.slice(0, 10) : null;
  const pMs = Date.parse(promotedOn);
  let shortWindow = false;
  if (createdAt && !Number.isNaN(pMs)) {
    const cMs = Date.parse(createdAt);
    if (!Number.isNaN(cMs) && Math.abs(pMs - cMs) <= 30 * 24 * 60 * 60 * 1000) shortWindow = true;
  }
  const migration = /migrat/i.test(lastTransition);
  if (!shortWindow && !migration) return { skipped: 'promotion not short-window/migration' };

  const checklistPath = join(tpl, 'PROMOTION_CHECKLIST.md');
  const checklist = readText(checklistPath);
  const history = checklist === null ? null : extractMdSection(checklist, /^## Review History/i);
  const attested = history !== null && /ADR-0099/i.test(history.body);
  if (!attested) {
    const basis = shortWindow
      ? `within 30 days of created_at (${createdAt} → ${promotedOn})`
      : `via migration ("${lastTransition}")`;
    add(
      CHECK,
      checklist === null ? rel(variantPath) : rel(checklistPath),
      `variant promoted to stable ${basis} but the checklist Review History carries no ADR-0099 attestation row (migration fast-track admission, ADR-0099)`,
      history ? history.headerLine : undefined,
    );
  }
  return {};
}

// ── Check m — root lifecycle-record claims ───────────────────────────────────

function checkM(): { skipped?: string } {
  const CHECK = 'm';
  const recordPath = join(WORKSPACE_ROOT, 'docs', 'lifecycle', 'templates', `${templateName}.md`);
  const record = readText(recordPath);
  if (record === null) return { skipped: 'no docs/lifecycle/templates/<name>.md record' };

  const arrays: Record<'agents' | 'skills', Set<string>> = {
    agents: new Set(agents.map((a) => a.toLowerCase())),
    skills: new Set(skills.map((s) => s.toLowerCase())),
  };

  record.split('\n').forEach((line, i) => {
    // First numeric roster claim on the line anchors the name-list cross-check.
    let claim: { kind: 'agents' | 'skills'; claimed: number; text: string } | null = null;
    for (const { re, kind } of CLAIM_PATTERNS) {
      for (const m of line.matchAll(re)) {
        const claimed = parseInt(m[1], 10);
        // v1.4.0: same dual truth as check a — manifest length or the on-disk
        // agent-definition-file count.
        const truthful = kind === 'agents'
          ? AGENT_COUNT_TRUTHS.has(claimed)
          : claimed === skills.length;
        if (!Number.isNaN(claimed) && !truthful && !/common/i.test(m[0])) {
          add(CHECK, rel(recordPath), `claims "${m[0].trim()}" but ${kind === 'agents'
            ? `agents[] has ${agents.length} and ${agentDefFileCount} agent definition files ship on disk`
            : `skills[] has ${skills.length}`}`, i + 1);
        }
        if (!claim) claim = { kind, claimed, text: m[0] };
      }
    }
    if (!claim) return;
    const parenMatch = line.match(/\(([^)]*)\)/);
    if (!parenMatch) return;
    const { names, complete } = parseLifecycleNameList(parenMatch[1]);
    const arr = arrays[claim.kind];
    for (const n of names) {
      if (!arr.has(n)) {
        add(CHECK, rel(recordPath), `lifecycle record names "${n}" but it is not in ${claim.kind}[]`, i + 1);
      }
    }
    // A complete list of exactly the claimed size must equal the manifest set.
    if (complete && names.length === claim.claimed && names.length !== arr.size) {
      const extras = [...arr].filter((x) => !names.includes(x));
      add(
        CHECK,
        rel(recordPath),
        `lifecycle record claims all ${claim.claimed} ${claim.kind} but omits from its list: ${extras.join(', ')}`,
        i + 1,
      );
    }
  });
  return {};
}

// ── Check n — roster table-row completeness ──────────────────────────────────

function checkN(): void {
  const CHECK = 'n';
  const rosterLower = new Set([...roster].map((r) => r.toLowerCase()));
  const commonDir = typeof variant.inherits_common === 'string'
    ? join(WORKSPACE_ROOT, variant.inherits_common)
    : join(WORKSPACE_ROOT, 'templates', 'common');
  // Skill universe for table rows: variant skills[] + inherited common skills +
  // L0 skills (reachable via platform mirrors like `.claude/skills/…`).
  const skillUniverse = new Set<string>([
    ...skills.map((s) => s.toLowerCase()),
    ...listDirs(join(commonDir, 'skills')).map((s) => s.toLowerCase()),
    ...listDirs(join(WORKSPACE_ROOT, 'skills')).map((s) => s.toLowerCase()),
  ]);

  // [surface, assertCompleteness] — context.md tables may be pipeline-scoped
  // (co-deck's VARIANT-INJECT table lists pipeline agents only), so completeness
  // is asserted for the README*/agents-README roster surfaces only. Phantom-row
  // detection runs on every positively-identified row of every surface.
  const surfaces: Array<[string, boolean]> = [
    ['README.md', true],
    ['README_ko.md', true],
    ['agents/README.md', true],
    [join('docs', `${templateName}.context.md`), false],
  ];

  for (const [surfaceName, assertCompleteness] of surfaces) {
    const p = join(tpl, surfaceName);
    const text = readText(p);
    if (text === null) continue;
    const lines = text.split('\n');
    const agentIds = new Set<string>();
    const skillIds = new Set<string>();
    let tableKind: 'agents' | 'skills' | null = null;
    let fileCol = -1;
    let prevWasTableRow = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim().startsWith('|')) {
        tableKind = null;
        prevWasTableRow = false;
        continue;
      }
      const cells = splitMdRow(line);
      if (isTableSeparator(cells)) {
        prevWasTableRow = true;
        continue;
      }
      const first = cells[0].replace(/[`*]/g, '').trim().toLowerCase();
      // v1.4.0 calibration (F4 triage of co-safety): a header row is only
      // recognized at a table START (the previous line is not a table row).
      // A data row like `| Agent | agent_manager / invoke_subagent |` inside a
      // tool-mapping table must not flip tableKind to "agents" and poison the
      // rows that follow it.
      const atTableStart = !prevWasTableRow;
      if (atTableStart && (first === 'agent' || first === '에이전트')) {
        tableKind = 'agents';
        fileCol = cells.findIndex((c) => /^file$/i.test(c.replace(/[`*]/g, '').trim()));
        prevWasTableRow = true;
        continue;
      }
      if (atTableStart && (first === 'skill' || first === '스킬')) {
        tableKind = 'skills';
        fileCol = cells.findIndex((c) => /^file$|^directory$/i.test(c.replace(/[`*]/g, '').trim()));
        prevWasTableRow = true;
        continue;
      }
      prevWasTableRow = true;
      if (!tableKind) continue;

      // Positively-identified rows only: a File/Directory-column entry
      // (agents/README, context) or a kebab-case id cell (README tables).
      let id: string | null = null;
      const display = cells[0].replace(/[`*]/g, '').trim();
      if (fileCol >= 0) {
        const cell = cells[fileCol] ?? '';
        const m = tableKind === 'agents'
          ? cell.match(/([A-Za-z0-9_-]+)\.md/)
          : cell.match(/skills\/([A-Za-z0-9_-]+)/);
        if (m) id = m[1];
      } else if (!/\s/.test(display) && /^[a-z0-9][a-z0-9_-]*$/i.test(display)) {
        id = display;
      }
      if (!id) continue; // display-name row in a non-File table — not roster-identified
      const idLower = id.toLowerCase();
      if (tableKind === 'agents') {
        agentIds.add(idLower);
        if (!rosterLower.has(idLower)) {
          add(CHECK, rel(p), `agent-table row "${id}" is not in the agent roster (case-insensitive match on agents[]/agent files)`, i + 1);
        }
      } else {
        skillIds.add(idLower);
        if (!skillUniverse.has(idLower)) {
          add(CHECK, rel(p), `skill-table row "${id}" is not in skills[] or the inherited common/L0 skill sets`, i + 1);
        }
      }
    }
    if (assertCompleteness && agentIds.size > 0) {
      for (const member of rosterLower) {
        if (!agentIds.has(member)) {
          add(
            CHECK,
            rel(p),
            `roster agent "${member}" has no row in ${surfaceName} agent tables (completeness asserted for README*/agents-README surfaces; case-insensitive tolerance)`,
          );
        }
      }
    }
  }
}

// ── Check o — used_by_agents ⊇ required_skills ───────────────────────────────

/** required_skills frontmatter of an agent file (inline array or block list). */
function parseAgentRequiredSkills(agentPath: string): { skills: string[]; line?: number } {
  const text = readText(agentPath);
  if (text === null) return { skills: [] };
  const fmBlock = text.split('---')[1] ?? '';
  const clean = (s: string): string => s.trim().replace(/^['"]|['"]$/g, '');
  const inline = fmBlock.match(/^required_skills:\s*\[([^\]]*)\]/m);
  if (inline) {
    return {
      skills: inline[1].split(',').map(clean).filter(Boolean),
      line: lineOf(text, 'required_skills'),
    };
  }
  const block = fmBlock.match(/^required_skills:\s*$/m);
  if (block) {
    const out: string[] = [];
    for (const l of fmBlock.slice((block.index ?? 0) + block[0].length).split('\n')) {
      const item = l.match(/^\s+-\s+(.+)$/);
      if (!item) break;
      out.push(clean(item[1]));
    }
    return { skills: out.filter(Boolean), line: lineOf(text, 'required_skills') };
  }
  return { skills: [] };
}

function checkO(): { skipped?: string } {
  const CHECK = 'o';
  const sm = variant.skill_manifest;
  const variantSpecific = sm && typeof sm === 'object' && !Array.isArray(sm)
    ? (sm as Record<string, unknown>).variant_specific
    : null;
  if (!Array.isArray(variantSpecific) || variantSpecific.length === 0) {
    return { skipped: 'no skill_manifest.variant_specific' };
  }

  const usedBy = new Map<string, Set<string>>();
  for (const entry of variantSpecific) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.name !== 'string' || !e.name) continue;
    const list = Array.isArray(e.used_by_agents) ? e.used_by_agents.map(String).map((a) => a.toLowerCase()) : [];
    usedBy.set(e.name, new Set(list));
  }
  if (usedBy.size === 0) return { skipped: 'skill_manifest.variant_specific has no usable entries' };

  const requiredBy = new Map<string, { skills: string[]; line?: number }>();
  for (const agentName of roster) {
    const p = join(tpl, 'agents', `${agentName}.md`);
    if (!existsSync(p)) continue;
    requiredBy.set(agentName.toLowerCase(), parseAgentRequiredSkills(p));
  }

  for (const [agentLower, req] of requiredBy) {
    for (const skillName of req.skills) {
      const used = usedBy.get(skillName);
      if (!used) continue; // common/L0 or untracked skill — no manifest side to verify
      if (agentLower === skillName.toLowerCase()) continue; // namesake self-pair: the skill IS the agent's own tool
      if (!used.has(agentLower)) {
        add(
          CHECK,
          rel(join(tpl, 'agents', `${agentLower}.md`)),
          `agent "${agentLower}" requires skill "${skillName}" (frontmatter) but skill_manifest.used_by_agents omits it`,
          req.line,
        );
      }
    }
  }
  // Reverse direction (used_by_agents ⊃ required_skills) is a legal surplus —
  // informational warning only.
  for (const [skillName, used] of usedBy) {
    for (const agentLower of used) {
      const req = requiredBy.get(agentLower);
      if (req && !req.skills.some((s) => s.toLowerCase() === skillName.toLowerCase())) {
        warn(
          CHECK,
          rel(variantPath),
          `skill "${skillName}" lists agent "${agentLower}" in used_by_agents but the agent's required_skills does not include it (informational)`,
        );
      }
    }
  }
  return {};
}

// ── Check p — spawn-target existence ─────────────────────────────────────────

// Requires a non-empty basename — bare ".ts" (extension watch lists) is not a target.
const SPAWN_TARGET_EXT_RE = /[A-Za-z0-9_-]\.(?:py|sh|mjs|ts)$/i;
// Import statements are checks i/q's lane — their literals are not spawn targets.
const IMPORT_STATEMENT_RE = /\bfrom\s*['"]|^\s*import\s|\brequire\(\s*['"]|\bimport\(\s*['"]/;
// A join()/resolve() call anchored at the script's own directory: walking its
// string-literal arguments statically resolves the spawn target.
const ANCHORED_JOIN_RE = /\b(?:join|resolve)\s*\(\s*(?:scriptDir|dirname\(\s*(?:import\.meta\.\w+|__filename)\s*\)|__dirname|import\.meta\.(?:dir|url|path))/i;
// v1.3.0 calibration (template-quality batch 3): a spawn-target literal must
// LOOK like a path. A quoted prose sentence ("enforced the same way by
// safety-audit.ts" — co-safety safety-audit.ts:567) carries whitespace; a
// whole command string ("bun scripts/co-safety/safety-audit.ts") does too.
// A path must be whitespace-free and carry a separator; a bare token is only
// accepted as a plausible script basename (extension enforced by
// SPAWN_TARGET_EXT_RE, charset below).
const WHITESPACE_RE = /\s/;
const BARE_BASENAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function looksLikePathLiteral(lit: string): boolean {
  if (WHITESPACE_RE.test(lit)) return false;
  if (lit.includes('/') || lit.includes('\\')) return true;
  return BARE_BASENAME_RE.test(lit);
}

/**
 * v1.3.0 calibration: strip comments before literal scanning so quoted prose
 * inside comments never becomes a spawn-target candidate ("where cheap" — a
 * line-based pass, line count preserved so reported line numbers stay exact).
 * Handles `//` line comments (URL-safe: a `//` preceded by something other
 * than line start/whitespace, like `https://`, is kept), block comments
 * (state across lines), and full-line `#` comments for py/sh. Inline
 * `#` in py/sh is deliberately left alone — a `#` can sit inside a string
 * literal, and the observed prose class lives in full-line comments.
 */
function stripCommentLines(text: string, ext: string): string[] {
  const hashLang = ext === '.py' || ext === '.sh';
  const out: string[] = [];
  let inBlock = false;
  for (const line of text.split('\n')) {
    let s = line;
    if (inBlock) {
      const end = s.indexOf('*/');
      if (end < 0) {
        out.push('');
        continue;
      }
      s = ' '.repeat(end + 2) + s.slice(end + 2);
      inBlock = false;
    }
    if (hashLang) {
      if (/^\s*#/.test(s)) s = '';
    } else {
      const open = s.indexOf('/*');
      if (open >= 0) {
        const close = s.indexOf('*/', open + 2);
        if (close >= 0) {
          s = s.slice(0, open) + ' '.repeat(close + 2 - open) + s.slice(close + 2);
        } else {
          s = s.slice(0, open);
          inBlock = true;
        }
      }
      if (!inBlock) {
        const m = s.match(/(?:^|\s)\/\/.*$/);
        if (m && m.index !== undefined) s = s.slice(0, m.index);
      }
    }
    out.push(s);
  }
  return out;
}

function checkP(): { skipped?: string } {
  const CHECK = 'p';
  const sm = variant.script_manifest;
  if (!sm || typeof sm !== 'object' || Array.isArray(sm)) {
    return { skipped: 'no script_manifest' };
  }
  const local = (sm as Record<string, unknown>).local;
  if (!Array.isArray(local) || local.length === 0) return { skipped: 'script_manifest.local is empty' };

  for (const entry of local) {
    if (!entry || typeof entry !== 'object') continue;
    const relPath = typeof (entry as Record<string, unknown>).path === 'string'
      ? (entry as Record<string, unknown>).path as string
      : null;
    if (!relPath) continue;
    const abs = join(tpl, relPath);
    if (!existsSync(abs)) continue; // existence is validate-templates' job
    const text = readText(abs);
    if (text === null) continue;
    const scriptDir = dirname(abs);

    stripCommentLines(text, extname(abs)).forEach((line, i) => {
      if (IMPORT_STATEMENT_RE.test(line)) return;
      for (const m of line.matchAll(/['"]([^'"\n]+)['"]/g)) {
        const lit = m[1];
        if (!SPAWN_TARGET_EXT_RE.test(lit)) continue;
        if (!looksLikePathLiteral(lit)) continue;
        if (lit.startsWith('/') || lit.includes('://') || lit.includes('${')) continue;

        if (/\b(?:join|resolve)\s*\(/.test(line)) {
          if (!ANCHORED_JOIN_RE.test(line)) continue; // runtime-anchored base (e.g. join(projectDir, …)) — not a template target
          // Walk the quoted segments of the script-dir-anchored call.
          let cur = scriptDir;
          let walked = false;
          for (const seg of line.slice(line.indexOf('(') + 1).matchAll(/['"]([^'"]*)['"]/g)) {
            const s = seg[1];
            if (s === '..') {
              cur = dirname(cur);
              walked = true;
            } else if (s !== '.' && s !== '') {
              cur = join(cur, s);
              walked = true;
            }
          }
          if (walked) {
            if (!existsSync(cur)) {
              add(CHECK, rel(abs), `spawn/exec target "${lit}" resolves to missing file ${rel(cur)} (script-dir-anchored join/resolve walk)`, i + 1);
            }
            continue;
          }
        }

        // Fallback candidates: template-root-relative (scaffold cwd), script-dir
        // relative, and the scripts/<variant>/ → <template>/python/ conventions.
        const candidates = [
          join(tpl, lit),
          resolve(scriptDir, lit),
          resolve(scriptDir, '..', 'python', lit),
          resolve(scriptDir, '..', '..', 'python', lit),
        ];
        if (candidates.some((c) => existsSync(c))) continue;
        add(
          CHECK,
          rel(abs),
          `spawn/exec target literal "${lit}" resolves to no existing file (tried template root, script dir, and python/ conventions)`,
          i + 1,
        );
      }
    });
  }
  return {};
}

// ── Check q — cross-layer relative imports ───────────────────────────────────

function checkQ(): { skipped?: string } {
  const CHECK = 'q';
  const sm = variant.script_manifest;
  if (!sm || typeof sm !== 'object' || Array.isArray(sm)) {
    return { skipped: 'no script_manifest' };
  }
  const local = (sm as Record<string, unknown>).local;
  if (!Array.isArray(local) || local.length === 0) return { skipped: 'script_manifest.local is empty' };
  const commonScriptsDir = join(WORKSPACE_ROOT, 'templates', 'common', 'scripts');

  for (const entry of local) {
    if (!entry || typeof entry !== 'object') continue;
    const relPath = typeof (entry as Record<string, unknown>).path === 'string'
      ? (entry as Record<string, unknown>).path as string
      : null;
    if (!relPath) continue;
    const abs = join(tpl, relPath);
    if (!existsSync(abs)) continue;
    const text = readText(abs);
    if (text === null) continue;
    const scriptDir = dirname(abs);

    for (const { spec, line } of extractBareImports(text)) {
      if (!spec.startsWith('.')) continue; // bare specifiers are check i's lane
      const resolved = resolve(scriptDir, spec);
      if (resolved === scriptDir || resolved.startsWith(scriptDir + '/')) continue; // in-variant sibling import
      // Import escapes scripts/<variant>/. Post-scaffold flat-sync delivers the
      // target either from the template itself (already on disk) or as a common
      // flat script — flag only when neither holds (D9 item 8).
      if (existsSync(resolved)) continue;
      const base = basename(resolved);
      if (existsSync(join(commonScriptsDir, base))) continue;
      add(
        CHECK,
        rel(abs),
        `relative import "${spec}" escapes scripts/${basename(dirname(abs))}/ and its scaffold target is missing in templates/common/scripts/${base} (post-scaffold flat-sync contract)`,
        line,
      );
    }
  }
  return {};
}

// ── Check r — checklist cited variant.json keys ──────────────────────────────

function checkR(): { skipped?: string } {
  const CHECK = 'r';
  const checklistPath = join(tpl, 'PROMOTION_CHECKLIST.md');
  const checklist = readText(checklistPath);
  if (checklist === null) return { skipped: 'no PROMOTION_CHECKLIST.md' };

  const keyExists = (path: string[]): boolean => {
    let cur: unknown = variant;
    for (const seg of path) {
      if (cur === null || typeof cur !== 'object' || !(seg in (cur as Record<string, unknown>))) return false;
      cur = (cur as Record<string, unknown>)[seg];
    }
    return true;
  };

  checklist.split('\n').forEach((line, i) => {
    if (!/variant\.json/i.test(line)) return;
    for (const m of line.matchAll(/`([^`]+)`/g)) {
      let token = m[1].trim();
      if (token === 'variant.json') continue; // the citation anchor, not a key
      const hadArrayForm = token.endsWith('[]');
      if (hadArrayForm) token = token.slice(0, -2);
      const valueAnnotated = /:\s/.test(token);
      if (valueAnnotated) token = token.split(':')[0].trim();
      if (!/^[a-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)*$/.test(token)) continue;
      // Qualifying citation forms: `key: value` annotation, `key[]` array
      // form, a dotted path, or the `variant.json` → `key` arrow chain. Bare
      // tokens (skill names, prose) on the same line are not key citations.
      const arrowCited = new RegExp(
        `\`variant\.json\`\\s*(?:→|->)\\s*\`${token.replace(/\./g, '\\.')}\``,
      ).test(line);
      if (!valueAnnotated && !hadArrayForm && !token.includes('.') && !arrowCited) continue;
      if (!keyExists(token.split('.'))) {
        add(CHECK, rel(checklistPath), `PROMOTION_CHECKLIST cites variant.json key "${token}" which does not exist`, i + 1);
      }
    }
  });
  return {};
}

// ── Check s — SCRIPTS.md documented flags exist in the script source ─────────

function checkS(): { skipped?: string } {
  const CHECK = 's';
  const sm = variant.script_manifest;
  if (!sm || typeof sm !== 'object' || Array.isArray(sm)) {
    return { skipped: 'no script_manifest' };
  }
  const local = (sm as Record<string, unknown>).local;
  if (!Array.isArray(local) || local.length === 0) return { skipped: 'script_manifest.local is empty' };

  // Variant SCRIPTS.md location: scripts/<variant>/SCRIPTS.md (co-deck layout)
  // or scripts/SCRIPTS.md.
  let scriptsMdPath: string | null = null;
  for (const cand of [join(tpl, 'scripts', templateName, 'SCRIPTS.md'), join(tpl, 'scripts', 'SCRIPTS.md')]) {
    if (existsSync(cand)) {
      scriptsMdPath = cand;
      break;
    }
  }
  if (!scriptsMdPath) return { skipped: 'no variant SCRIPTS.md' };
  const scriptsMd = readText(scriptsMdPath);
  if (scriptsMd === null) return { skipped: 'SCRIPTS.md unreadable' };

  // Usage table: the header row carrying a (cli-)usage column defines it; rows
  // are keyed by the script filename in the first column. Table shapes vary
  // across variants (cli-usage / Usage; some variants document no usage column
  // at all — those skip cleanly, undocumented rows are a registry-sync gap for
  // validate-templates, not this check).
  let usageCol = -1;
  const usageRows = new Map<string, string>();
  for (const line of scriptsMd.split('\n')) {
    if (!line.trim().startsWith('|')) continue;
    const cells = splitMdRow(line);
    const ui = cells.findIndex((c) => /^(?:cli-)?usage$/i.test(c.replace(/[`*]/g, '').trim()));
    if (ui >= 0) {
      usageCol = ui;
      continue;
    }
    if (usageCol < 0) continue;
    if (isTableSeparator(cells)) continue;
    const name = (cells[0] ?? '').replace(/[`*]/g, '').trim();
    if (/\.(?:ts|mjs|py|sh)$/i.test(name)) usageRows.set(basename(name), cells[usageCol] ?? '');
  }
  if (usageCol < 0) return { skipped: 'SCRIPTS.md documents no usage column' };

  let checkedFlags = 0;
  for (const entry of local) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    if (e.status === 'deprecated') continue; // deprecated docs may lag intentionally (check h's lane)
    const relPath = typeof e.path === 'string' ? e.path : null;
    if (!relPath) continue;
    const abs = join(tpl, relPath);
    if (!existsSync(abs)) continue;
    const usage = usageRows.get(basename(relPath));
    if (usage === undefined) continue; // not documented in the usage table — nothing to verify
    // Bracketed usage tokens only: `[--flag <arg>]` / `[--flag]`; the first
    // token of a bracket is the flag, `<args>` and bare `[output_dir]` are
    // positional placeholders.
    const flags = new Set<string>();
    for (const m of usage.matchAll(/\[([^\]]+)\]/g)) {
      const tok = m[1].trim().split(/\s+/)[0];
      if (tok.startsWith('--')) flags.add(tok);
    }
    if (flags.size === 0) continue;
    const src = readText(abs);
    if (src === null) continue;
    checkedFlags += flags.size;
    for (const flag of flags) {
      // String match over the source is the accepted argv-parsing proxy
      // (batch-3 scope, T-20261005-019 — the co-consult hwpx-generate --output
      // bug class: the doc promised a flag the script never parsed).
      if (!src.includes(flag)) {
        add(
          CHECK,
          rel(abs),
          `SCRIPTS.md usage documents flag ${flag} but the script never references it (documented-flag drift)`,
          lineOf(scriptsMd, basename(relPath)),
        );
      }
    }
  }
  if (checkedFlags === 0) return { skipped: 'no bracketed flags documented in the usage column' };
  return {};
}

// ── Check t — .claude/settings.json hook lint ────────────────────────────────

function checkT(): { skipped?: string } {
  const CHECK = 't';
  const settingsPath = join(tpl, '.claude', 'settings.json');
  if (!existsSync(settingsPath)) return { skipped: 'no .claude/settings.json' };
  const raw = readText(settingsPath);
  if (raw === null) return { skipped: 'settings.json unreadable' };
  let settings: unknown;
  try {
    settings = JSON.parse(raw);
  } catch (e) {
    add(CHECK, rel(settingsPath), `settings.json is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
    return {};
  }
  const hooks = (settings as Record<string, unknown>).hooks;
  if (!hooks || typeof hooks !== 'object' || Array.isArray(hooks)) {
    return { skipped: 'settings.json declares no hooks object' };
  }

  const triples = new Map<string, number>();
  for (const [event, entries] of Object.entries(hooks as Record<string, unknown>)) {
    if (!Array.isArray(entries)) {
      add(CHECK, rel(settingsPath), `hooks.${event} must be an array of matcher entries (got ${typeof entries})`);
      continue;
    }
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      const e = entry as Record<string, unknown>;
      // Wrapper contract: { matcher, hooks: [{ type: "command", command }] }.
      // A `command` directly on the entry (no hooks wrapper) is the malformed
      // co-abap PostToolUse class — the hook runner silently drops it.
      if (typeof e.command === 'string' && !Array.isArray(e.hooks)) {
        add(
          CHECK,
          rel(settingsPath),
          `hooks.${event} entry carries a bare "command" without the hooks:[{type:"command",...}] wrapper (co-abap class — the hook never runs; wrap it, design D11)`,
        );
        continue;
      }
      if (!Array.isArray(e.hooks)) continue;
      for (const hook of e.hooks) {
        if (!hook || typeof hook !== 'object' || Array.isArray(hook)) continue;
        const h = hook as Record<string, unknown>;
        if (h.type !== 'command' || typeof h.command !== 'string') {
          add(
            CHECK,
            rel(settingsPath),
            `hooks.${event} hook entry must be { type: "command", command: <string> } (got type=${JSON.stringify(h.type ?? null)}, command=${typeof h.command})`,
          );
          continue;
        }
        const key = `${event}|${typeof e.matcher === 'string' ? e.matcher : ''}|${h.command}`;
        triples.set(key, (triples.get(key) ?? 0) + 1);
      }
    }
  }
  // Duplicates are hygiene, not breakage — warning only (design D11 dedupe).
  for (const [key, count] of triples) {
    if (count <= 1) continue;
    const [event, matcher, command] = key.split('|');
    warn(
      CHECK,
      rel(settingsPath),
      `duplicate hook: ${event}${matcher ? ` (matcher ${matcher})` : ''} → ${command} appears ${count} times (dedupe to one per (event, matcher, command), design D11)`,
    );
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
  { id: 'k', label: 'Checklist criteria vs status (stable ⇒ no Pending rows)', run: checkK },
  { id: 'l', label: 'Migration attestation (ADR-0099 row)', run: checkL },
  { id: 'm', label: 'Root lifecycle-record claims vs variant.json', run: checkM },
  { id: 'n', label: 'Roster table-row completeness (README surfaces + phantom rows)', run: checkN },
  { id: 'o', label: 'used_by_agents ⊇ required_skills', run: checkO },
  { id: 'p', label: 'Spawn-target existence (script literals)', run: checkP },
  { id: 'q', label: 'Cross-layer relative imports resolve in common', run: checkQ },
  { id: 'r', label: 'PROMOTION_CHECKLIST cited variant.json keys exist', run: checkR },
  { id: 's', label: 'SCRIPTS.md documented flags exist in script source', run: checkS },
  { id: 't', label: '.claude/settings.json hook lint (wrapper contract, duplicates)', run: checkT },
];

console.log(`validate-variant-claims v${VERSION} — templates/${templateName}\n`);

const skipped: Array<{ id: string; reason: string }> = [];
const green: string[] = [];
const failed: Array<{ id: string; label: string; count: number }> = [];

for (const c of CHECKS) {
  const before = findings.filter((f) => f.check === c.id).length;
  const beforeWarn = warnings.filter((w) => w.check === c.id).length;
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

// Per-check output: findings first (❌ with file:line), then warnings (⚠️,
// informational), then per-check verdicts.
let lastCheck = '';
for (const f of findings) {
  if (f.check !== lastCheck) {
    console.log(`[${f.check}] ${CHECKS.find((c) => c.id === f.check)?.label ?? f.check}`);
    lastCheck = f.check;
  }
  const loc = f.line ? `${f.file}:${f.line}` : f.file;
  console.log(`   ❌ ${loc} — ${f.message}`);
}
if (findings.length > 0 && warnings.length > 0) console.log('');
for (const w of warnings) {
  if (w.check !== lastCheck) {
    console.log(`[${w.check}] ${CHECKS.find((c) => c.id === w.check)?.label ?? w.check} (warnings)`);
    lastCheck = w.check;
  }
  const loc = w.line ? `${w.file}:${w.line}` : w.file;
  console.log(`   ⚠️  ${loc} — ${w.message}`);
}
if (warnings.length > 0) console.log('');

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
  `Result: ${failed.length > 0 ? 'FAIL' : 'PASS'} — ${findings.length} finding(s)` +
  `${warnings.length > 0 ? `, ${warnings.length} warning(s)` : ''}; ` +
  `${green.length}/${CHECKS.length} checks green, ${skipped.length} skipped\n`,
);

if (import.meta.main) {
  process.exit(failed.length > 0 ? 1 : 0);
}
