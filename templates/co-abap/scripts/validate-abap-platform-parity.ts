#!/usr/bin/env bun
/**
 * Platform Parity Validator
 * @version 1.1.0
 *
 * v1.1.0 (2026-10-11, T-20261011-008/T-20261011-013, spec
 *           docs/designs/2026-10-11-backlog-batch-2-design.md): promoted from the
 *           co-abap project (v1.0.0, design
 *           2026-10-10-cross-platform-parity-design.md) with profile-aware
 *           adaptation for scaffolded projects: surfaces a platform profile may
 *           legitimately omit (.codex/** on non-codex profiles, instruction files
 *           of unselected platforms, skill mirrors, config/commands) are SKIPPED
 *           when absent and enforced when present. Universal surfaces (.mcp.json,
 *           .claude/settings.json, .gemini/settings.json, .agents/mcp.json,
 *           config/platforms/*) stay fail-on-missing.
 *
 * Checks cross-platform parity (docs/designs/2026-10-10-cross-platform-parity-design.md):
 *   (a) rendered commands are in sync with config/commands (render-commands --check)
 *   (b) every platform MCP config routes `abap` through sap-mcp-proxy.ts, no direct vsp server entry
 *   (c) instruction files contain the required parity sections (data-driven, SECTIONS below)
 *   (d) skills mirrors are identical to skills/
 *   (e) docs/workspace-schema.json has high/medium/low model mappings for all platforms
 *   (f) deny-rules: every platform config contains every entry of config/platforms/protected-paths.json
 *       (or lists it under platforms.<p>.manual with a documented reason)
 *
 * Usage: bun scripts/validate-abap-platform-parity.ts [--root <dir>]
 */

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
// render-commands is loaded lazily in checkCommands: the command SSOT
// (config/commands/) is optional in this template — a static import would crash
// module load where the surface is absent.


export interface CheckResult { id: string; ok: boolean; problems: string[] }

/** MCP configs that must route `abap` through the proxy. */
export const MCP_CONFIGS: Array<{ file: string; kind: 'json' | 'toml' | 'yaml' }> = [
  { file: '.mcp.json', kind: 'json' },
  { file: '.codex/config.toml', kind: 'toml' },
  { file: '.gemini/settings.json', kind: 'json' },
  { file: '.agents/mcp.json', kind: 'json' },
  { file: 'config/platforms/hermes-mcp.example.yaml', kind: 'yaml' },
];

/**
 * Required sections for every instruction file; extend this table, not the code.
 * Template delta vs the project validator (v1.0.0): the variant instruction
 * surfaces that CARRY the sections are AGENTS.md (universal — every profile) and
 * HERMES.md (variant overlay; checked when the hermes profile is installed). The
 * per-platform CLAUDE/CODEX/GEMINI files compose from the common managed blocks,
 * which do not carry the SAP sections until the follow-up instruction-content
 * release — they are enforced when present, skipped when absent (profile-aware
 * checkInstructions below).
 */
export const INSTRUCTION_FILES = ['AGENTS.md', 'HERMES.md', 'CLAUDE.md', 'CODEX.md', 'GEMINI.md'];
export const SECTIONS: Array<{ id: string; description: string; pattern: RegExp }> = [
  { id: 'sap-safety-proxy', description: 'SAP safety via sap-mcp-proxy', pattern: /sap-mcp-proxy/ },
  { id: 'parallel-dispatch', description: 'parallel dispatch mechanism', pattern: /parallel[^\n]{0,80}dispatch|dispatch[^\n]{0,80}parallel|dispatch-parallel/i },
  { id: 'approval-cli', description: 'approval CLI (sap-approve)', pattern: /sap-approve/ },
];

export const SKILL_MIRRORS = ['.claude/skills', '.codex/skills', '.gemini/skills', '.agents/skills', '.hermes/skills'];
export const SCHEMA_PLATFORMS = ['claude', 'codex', 'gemini', 'gemini-cli', 'antigravity', 'hermes'];
const TIERS = ['high', 'medium', 'low'];

const isProxy = (s: string) => /sap-mcp-proxy/.test(s);
const isVspToken = (s: string) => /^vsp(\.exe)?$/.test(basename(s.trim().replace(/^["']|["']$/g, '')));

function checkServerArgv(name: string, argv: string[], problems: string[], file: string): void {
  const viaProxy = argv.some(isProxy);
  if (name === 'abap' && !viaProxy) problems.push(`${file}: abap server does not route through sap-mcp-proxy.ts`);
  if (!viaProxy && argv.some(isVspToken)) problems.push(`${file}: server "${name}" launches vsp directly`);
}

export function checkMcp(root: string): CheckResult {
  const problems: string[] = [];
  for (const { file, kind } of MCP_CONFIGS) {
    const abs = join(root, file);
    // Profile-aware: `.codex/**` is stripped on non-codex profiles
    // (PROFILE_OWNED_PATHS). Universal MCP surfaces stay fail-on-missing.
    if (!existsSync(abs)) {
      if (file.startsWith('.codex/')) continue;
      problems.push(`${file}: missing`);
      continue;
    }
    const text = readFileSync(abs, 'utf-8');
    try {
      if (kind === 'json') {
        const servers = JSON.parse(text).mcpServers ?? {};
        if (!servers.abap) problems.push(`${file}: no abap server entry`);
        for (const [n, v] of Object.entries<any>(servers)) checkServerArgv(n, [String(v.command ?? ''), ...(v.args ?? []).map(String)], problems, file);
      } else if (kind === 'toml') {
        const blocks = text.split(/^\[(?:\[)?/m).slice(1).map(b => ({ header: b.split('\n')[0], body: b }));
        const abap = blocks.find(b => /^mcp_servers\.abap\]/.test(b.header));
        if (!abap) problems.push(`${file}: no [mcp_servers.abap] entry`);
        for (const b of blocks) {
          const m = b.header.match(/^mcp_servers\.([A-Za-z0-9_-]+)\]/);
          if (m) checkServerArgv(m[1], b.body.split(/[\s,\[\]"']+/).filter(Boolean), problems, file);
        }
      } else {
        const lines = text.split('\n');
        const idx = lines.findIndex(l => /^\s*abap:\s*$/.test(l));
        if (idx < 0) { problems.push(`${file}: no abap server entry`); continue; }
        const indent = lines[idx].match(/^\s*/)![0].length;
        const body: string[] = [];
        for (let i = idx + 1; i < lines.length && (lines[i].trim() === '' || lines[i].match(/^\s*/)![0].length > indent); i++) body.push(lines[i]);
        const toks = body.join(' ').split(/[\s,\[\]"']+/).filter(Boolean);
        checkServerArgv('abap', toks, problems, file);
        // Any other server block launching vsp directly
        const rest = [...lines.slice(0, idx), ...lines.slice(idx + 1 + body.length)].filter(l => !l.trim().startsWith('#')).join(' ');
        const others = rest.split(/[\s,\[\]"']+/).filter(Boolean);
        if (!others.some(isProxy) && others.some(isVspToken)) problems.push(`${file}: a server launches vsp directly`);
      }
    } catch (e) {
      problems.push(`${file}: cannot parse (${e instanceof Error ? e.message : e})`);
    }
  }
  return { id: 'mcp-proxy-routing', ok: problems.length === 0, problems };
}

export function checkInstructions(root: string): CheckResult {
  const problems: string[] = [];
  for (const f of INSTRUCTION_FILES) {
    const abs = join(root, f);
    // Profile-aware: an unselected platform's instruction file is absent by design
    // (PROFILE_OWNED_PATHS strips it at scaffold/adopt). Enforce only what exists.
    if (!existsSync(abs)) continue;
    const text = readFileSync(abs, 'utf-8');
    for (const s of SECTIONS) if (!s.pattern.test(text)) problems.push(`${f}: missing section "${s.description}" (${s.id})`);
  }
  return { id: 'instruction-sections', ok: problems.length === 0, problems };
}

/** Hashes files inside skill directories only (root-level index/manifest files are mirror-specific). */
function treeHashes(dir: string, base = dir, out: Record<string, string> = {}): Record<string, string> {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) treeHashes(p, base, out);
    else if (dir !== base) out[p.slice(base.length + 1)] = createHash('sha1').update(readFileSync(p)).digest('hex');
  }
  return out;
}

export function checkSkills(root: string): CheckResult {
  const problems: string[] = [];
  const src = join(root, 'skills');
  if (!existsSync(src)) return { id: 'skills-mirrors', ok: false, problems: ['skills/: missing'] };
  const want = treeHashes(src);
  for (const m of SKILL_MIRRORS) {
    const abs = join(root, m);
    // Profile-aware: a platform mirror the install does not carry is absent by
    // design; enforce parity for the mirrors that exist.
    if (!existsSync(abs)) continue;
    const got = treeHashes(abs);
    const missing = Object.keys(want).filter(k => !(k in got));
    const extra = Object.keys(got).filter(k => !(k in want));
    const differ = Object.keys(want).filter(k => k in got && got[k] !== want[k]);
    const fmt = (l: string[]) => l.slice(0, 3).join(', ') + (l.length > 3 ? ` (+${l.length - 3})` : '');
    if (missing.length) problems.push(`${m}: ${missing.length} file(s) missing vs skills/: ${fmt(missing)}`);
    if (extra.length) problems.push(`${m}: ${extra.length} extra file(s): ${fmt(extra)}`);
    if (differ.length) problems.push(`${m}: ${differ.length} file(s) differ: ${fmt(differ)}`);
  }
  return { id: 'skills-mirrors', ok: problems.length === 0, problems };
}

export function checkSchema(root: string): CheckResult {
  const problems: string[] = [];
  const f = join(root, 'docs', 'workspace-schema.json');
  // Profile-aware: docs/workspace-schema.json ships from the common template, so a
  // bare variant template tree lacks it — skip there, enforce in scaffolded projects.
  if (!existsSync(f)) return { id: 'schema-models', ok: true, problems: [] };
  const models = JSON.parse(readFileSync(f, 'utf-8')).models ?? {};
  for (const p of SCHEMA_PLATFORMS) {
    for (const t of TIERS) if (!models[p] || typeof models[p][t] !== 'string' || !models[p][t]) problems.push(`models.${p}.${t} missing`);
  }
  return { id: 'schema-models', ok: problems.length === 0, problems };
}

export async function checkCommands(root: string): Promise<CheckResult> {
  // Profile-aware: projects/installs without the command SSOT skip this check
  // (render-commands imports config/commands which the base template does not ship).
  if (!existsSync(join(root, 'config', 'commands'))) {
    return { id: 'commands-rendered', ok: true, problems: [] };
  }
  try {
    // Resolve render-commands against the TARGET root (this validator may run from a
    // template checkout against a project tree, or vice versa).
    const renderer = join(root, 'scripts', 'render-commands.ts');
    if (!existsSync(renderer)) {
      return { id: 'commands-rendered', ok: false, problems: [`scripts/render-commands.ts: missing (required by config/commands)`] };
    }
    const { sync } = (await import(pathToFileURL(renderer).href)) as { sync: (root: string, write: boolean) => string[] };
    const drift = sync(root, false);
    return { id: 'commands-rendered', ok: drift.length === 0, problems: drift };
  } catch (e) {
    return { id: 'commands-rendered', ok: false, problems: [e instanceof Error ? e.message : String(e)] };
  }
}

// ---- (f) deny-rules ---------------------------------------------------------------------------

interface ProtectedSet {
  commands: Array<{ id: string; claude: string[]; gemini: string[]; codex: string[][] }>;
  paths: Array<{ id: string; pattern: string; noRead?: boolean }>;
  platforms: Record<string, { files: string[]; manual: Record<string, string> }>;
}

/** A manual note applies to an entry by id, or to a whole class via `cmd:*` / `path:*`. */
function manualNote(set: ProtectedSet, platform: string, kind: 'cmd' | 'path', id: string): string | undefined {
  const m = set.platforms[platform]?.manual ?? {};
  const note = m[id] ?? m[`${kind}:*`];
  return note && note.trim().length >= 20 ? note : undefined;
}

export function checkDenyRules(root: string): CheckResult {
  const problems: string[] = [];
  const f = join(root, 'config', 'platforms', 'protected-paths.json');
  if (!existsSync(f)) return { id: 'deny-rules', ok: false, problems: ['config/platforms/protected-paths.json: missing'] };
  let set: ProtectedSet;
  try { set = JSON.parse(readFileSync(f, 'utf-8')); } catch (e) { return { id: 'deny-rules', ok: false, problems: [`protected-paths.json: cannot parse (${e instanceof Error ? e.message : e})`] }; }
  const read = (rel: string): string | undefined => { const a = join(root, rel); return existsSync(a) ? readFileSync(a, 'utf-8') : undefined; };
  const need = (platform: string, kind: 'cmd' | 'path', id: string, ok: boolean, label: string, where: string) => {
    if (!ok && !manualNote(set, platform, kind, id)) problems.push(`${platform}: ${where} lacks ${label} (entry ${id}; add it or document a manual step)`);
  };

  // Claude: permissions.deny
  const ct = read('.claude/settings.json');
  if (ct === undefined) problems.push('.claude/settings.json: missing');
  else {
    let have = new Set<string>();
    try { have = new Set<string>((JSON.parse(ct).permissions?.deny ?? []).map(String)); } catch { problems.push('.claude/settings.json: cannot parse'); }
    for (const c of set.commands) for (const e of c.claude) need('claude', 'cmd', c.id, have.has(e), e, '.claude/settings.json permissions.deny');
    for (const p of set.paths) {
      for (const tool of ['Edit', 'Write', 'MultiEdit']) need('claude', 'path', p.id, have.has(`${tool}(${p.pattern})`), `${tool}(${p.pattern})`, '.claude/settings.json permissions.deny');
      if (p.noRead) need('claude', 'path', p.id, have.has(`Read(${p.pattern})`), `Read(${p.pattern})`, '.claude/settings.json permissions.deny');
    }
  }

  // Gemini: settings.json + sample (denyList, tools.exclude, policy), .geminiignore for reads
  for (const rel of ['.gemini/settings.json', '.gemini/settings.json.sample']) {
    const text = read(rel);
    if (text === undefined) { problems.push(`${rel}: missing`); continue; }
    let j: any; try { j = JSON.parse(text); } catch { problems.push(`${rel}: cannot parse`); continue; }
    const have = new Set<string>([...(j['terminal.denyList'] ?? []), ...(j.tools?.exclude ?? [])].map(String));
    for (const c of set.commands) for (const e of c.gemini) need('gemini', 'cmd', c.id, have.has(e), e, `${rel} denyList/tools.exclude`);
    if (j['terminal.executionPolicy'] === undefined || /^(auto|turbo)$/i.test(String(j['terminal.executionPolicy']))) problems.push(`${rel}: terminal.executionPolicy must not be Auto/Turbo (use Off)`);
  }
  const gi = read('.geminiignore');
  for (const p of set.paths) {
    const readable = !!p.noRead && !p.pattern.startsWith('~');
    need('gemini', 'path', p.id, readable && gi !== undefined && gi.split('\n').includes(p.pattern), p.pattern, '.geminiignore (read side only)');
  }

  // Codex: execpolicy rules + sandbox/approval settings (profile-aware: the whole
  // .codex/ surface is absent on non-codex profiles — skip, don't fail).
  const rules = read('.codex/rules/default.rules');
  const codexPresent = existsSync(join(root, '.codex'));
  if (rules === undefined && codexPresent) problems.push('.codex/rules/default.rules: missing');
  else if (rules !== undefined) for (const c of set.commands) for (const pre of c.codex) {
    const line = `prefix_rule(pattern=${JSON.stringify(pre)}, decision="forbidden"`;
    need('codex', 'cmd', c.id, rules.includes(line), line, '.codex/rules/default.rules');
  }
  const toml = read('.codex/config.toml');
  if (toml !== undefined) {
    if (!/^sandbox_mode\s*=\s*"(read-only|workspace-write)"/m.test(toml)) problems.push('.codex/config.toml: sandbox_mode must be read-only or workspace-write');
    if (!/^approval_policy\s*=\s*"(untrusted|on-request|on-failure)"/m.test(toml)) problems.push('.codex/config.toml: approval_policy must be untrusted, on-request or on-failure (not never)');
  }
  if (codexPresent) for (const p of set.paths) need('codex', 'path', p.id, false, 'a path deny', '.codex/');

  // Hermes: approvals.mode manual in the example config
  const hy = read('config/platforms/hermes-mcp.example.yaml') ?? '';
  if (!/^approvals:\s*\n\s+mode:\s*manual\s*$/m.test(hy)) problems.push('config/platforms/hermes-mcp.example.yaml: approvals.mode must be manual');

  // Manual-step platforms: every entry needs a documented note, and the doc must reference the json
  // Manual-step platforms: the SSOT's platforms.<p>.manual notes must document
  // every entry (this validates the SSOT, not the platform surface), and the
  // setup doc must reference the SSOT.
  for (const [platform, doc] of [['hermes', 'docs/platform-setup/hermes.md'], ['antigravity', 'docs/platform-setup/antigravity.md']] as const) {
    const t = read(doc);
    if (t === undefined) problems.push(`${doc}: missing`);
    else if (!t.includes('protected-paths.json')) problems.push(`${doc}: must reference config/platforms/protected-paths.json`);
    for (const c of set.commands) need(platform, 'cmd', c.id, false, 'a deny entry', 'platform config');
    for (const p of set.paths) need(platform, 'path', p.id, false, 'a deny entry', 'platform config');
  }
  return { id: 'deny-rules', ok: problems.length === 0, problems };
}

export async function runAll(root: string): Promise<CheckResult[]> {
  return [await checkCommands(root), checkMcp(root), checkInstructions(root), checkSkills(root), checkSchema(root), checkDenyRules(root)];
}

if (import.meta.main) {
  const i = process.argv.indexOf('--root');
  const root = resolve(i >= 0 ? process.argv[i + 1] : join(import.meta.dir, '..'));
  const results = await runAll(root);
  for (const r of results) {
    console.log(`[${r.ok ? 'PASS' : 'FAIL'}] ${r.id}`);
    for (const p of r.problems) console.log(`    - ${p}`);
  }
  const failed = results.filter(r => !r.ok).length;
  console.log(`Platform parity: ${failed === 0 ? 'PASS' : 'FAIL'} (${failed} failing check(s))`);
  process.exit(failed === 0 ? 0 : 1);
}
