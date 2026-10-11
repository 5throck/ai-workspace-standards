/**
 * sap-action-lib.ts — Shared logic for the SAP write safety gate and audit hooks.
 * Design: docs/designs/2026-10-10-sap-write-safety-gate-design.md
 * Used by hooks/sap-action-gate.ts (PreToolUse) and hooks/sap-action-audit.ts (PostToolUse).
 * Audit records store hashes only: never source text, SQL rows, tokens or credentials.
 *
 * Also hosts the proxy approval store (pending requests, single-use approvals) shared by
 * sap-mcp-proxy.ts and sap-approve.ts, and the secure store outside the workspace:
 *   ~/.config/co-abap/approval.key                 HMAC key (0600), created by a human CLI on first use
 *   ~/.config/co-abap/pending/<repo-hash>/<id>.json   MAC'd pending requests (written by the proxy)
 *   ~/.config/co-abap/approvals/<repo-hash>/<id>.json MAC'd single-use approvals (written by sap-approve.ts)
 *   ~/.config/co-abap/manifests/<repo-hash>.json      HMAC-signed integrity manifest (sap-integrity.ts)
 * Evidence entries and audit lines are HMAC'd with the same key (audit lines form a hash chain).
 * Residual risk: an agent running as the same OS user with unrestricted shell can read the key.
 *
 * @version 2.1.0
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  appendFileSync, chmodSync, closeSync, existsSync, fstatSync, mkdirSync, openSync, readFileSync, readSync,
  readdirSync, realpathSync, renameSync, statSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';

export const TOOL_PREFIX = 'mcp__abap__';
/** Gate deny reason for a privileged (R3) call that merely lacks an approval; the proxy turns it into APPROVAL_REQUIRED. */
export const NEEDS_APPROVAL = 'privileged action without approval';
export type Cls = 'R0' | 'R1' | 'R2' | 'R3';
export type Decision = 'allow' | 'ask' | 'deny';

export interface Policy {
  version: number;
  classes: Record<Cls, string[]>;
  r3Patterns: string[];
  defaultUnknown: 'ask';
  allowedPackages: string[];
  runQuery: { selectOnly: boolean };
  /** Only ttlMinutes is honoured. The approval directory is hardcoded outside the workspace (never read from policy). */
  approval: { ttlMinutes?: number };
  release: { requireEvidence: boolean };
  /** SAP_FEATURE_* keys a local .env / client env may turn on (default: none; everything stays off). */
  vspFeatures?: { allowOn: string[] };
  hyperfocused?: HfPolicy;
}

/** Hyperfocused-mode (single `SAP` tool) action map; data lives in config/sap-action-policy.json. */
export interface HfSub {
  class: Cls; canonical?: string; evidence?: string[];
  evidenceIfParam?: Record<string, string[]>; write?: boolean;
}
export interface HfAction {
  class: Cls; sql?: boolean; subFrom?: string[]; subDefault?: string; defaultNeedsTarget?: boolean;
  unknown?: 'default' | 'ask' | 'r3pattern'; sub?: Record<string, Cls | HfSub>;
}
/** Escalates an R2 hyperfocused call to R3 (UI5/BSP deploys, SRVB publish). Data in the policy file. */
export interface HfEscalation {
  label: string; actions: string[]; subs?: string[]; keyTypes?: string[];
  paramsTruthy?: string[]; paramsWordKeys?: string[]; paramsWords?: string;
  valueKeys?: string[]; valuePatterns?: string[];
}
export interface HfPolicy {
  escalations?: HfEscalation[];
  actions: Record<string, Cls | HfAction>;
  packageKeys: string[]; urlTypes: Record<string, string>; limuTypes: Record<string, string>;
}

export interface HookInput {
  session_id?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_response?: unknown;
  cwd?: string;
  agent_type?: string;
  agent_name?: string;
}

export interface Evidence {
  lastWriteTs?: string;
  package?: string;
  transport?: string;
  chain: Record<string, { ts: string; result: 'pass' | 'fail' }>;
  status: 'pending' | 'passed' | 'failed';
  /** Set by readEvidence when the stored entry's MAC did not verify (it is then treated as pending). */
  unverified?: boolean;
}

export const CHAIN = ['SyntaxCheck', 'RunUnitTests', 'GetCodeCoverage', 'RunATCCheck'] as const;

// ---------------------------------------------------------------------------
// Policy (hand-validated; no external schema dependency)
// ---------------------------------------------------------------------------

const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

export function validatePolicy(raw: unknown): Policy {
  const p = raw as any;
  const fail = (m: string): never => { throw new Error(`invalid policy: ${m}`); };
  if (!p || typeof p !== 'object') fail('not an object');
  if (typeof p.version !== 'number') fail('version');
  for (const c of ['R0', 'R1', 'R2', 'R3']) if (!isStrArr(p.classes?.[c])) fail(`classes.${c}`);
  if (p.r3Patterns !== undefined && !isStrArr(p.r3Patterns)) fail('r3Patterns');
  for (const s of p.r3Patterns ?? []) new RegExp(s);
  if (p.defaultUnknown !== 'ask') fail('defaultUnknown');
  if (!isStrArr(p.allowedPackages) || p.allowedPackages.length === 0) fail('allowedPackages');
  if (typeof p.runQuery?.selectOnly !== 'boolean') fail('runQuery.selectOnly');
  if (!p.approval || typeof p.approval !== 'object') fail('approval');
  if (p.approval.ttlMinutes !== undefined && (typeof p.approval.ttlMinutes !== 'number' || !(p.approval.ttlMinutes > 0) || p.approval.ttlMinutes > 60)) fail('approval.ttlMinutes');
  if (p.approval.dir !== undefined || p.approval.envVar !== undefined) fail('approval.dir/envVar are no longer supported (approvals live outside the workspace)');
  if (typeof p.release?.requireEvidence !== 'boolean') fail('release');
  if (p.vspFeatures !== undefined && !isStrArr(p.vspFeatures?.allowOn)) fail('vspFeatures.allowOn');
  if (p.hyperfocused !== undefined) {
    const h = p.hyperfocused;
    const isCls = (c: unknown) => c === 'R0' || c === 'R1' || c === 'R2' || c === 'R3';
    if (!h || typeof h.actions !== 'object' || !isStrArr(h.packageKeys)) fail('hyperfocused');
    if (typeof h.urlTypes !== 'object' || typeof h.limuTypes !== 'object') fail('hyperfocused maps');
    if (h.escalations !== undefined) {
      if (!Array.isArray(h.escalations)) fail('hyperfocused.escalations');
      for (const e of h.escalations) {
        if (typeof e?.label !== 'string' || !isStrArr(e.actions)) fail('hyperfocused.escalations entry');
        for (const k of ['subs', 'keyTypes', 'paramsTruthy', 'paramsWordKeys', 'valueKeys', 'valuePatterns']) {
          if (e[k] !== undefined && !isStrArr(e[k])) fail(`hyperfocused.escalations.${k}`);
        }
        for (const rx of e.valuePatterns ?? []) new RegExp(rx, 'i');
        if (e.paramsWords !== undefined) new RegExp(e.paramsWords, 'i');
      }
    }
    for (const [a, v] of Object.entries<any>(h.actions)) {
      if (!(isCls(v) || isCls(v?.class))) fail(`hyperfocused.actions.${a}`);
      for (const [n, sv] of Object.entries<any>(v?.sub ?? {})) {
        if (!(isCls(sv) || isCls(sv?.class))) fail(`hyperfocused.actions.${a}.sub.${n}`);
      }
    }
  }
  return { ...p, r3Patterns: p.r3Patterns ?? [] } as Policy;
}

export function loadPolicy(root: string): Policy {
  return validatePolicy(JSON.parse(readFileSync(join(root, 'config', 'sap-action-policy.json'), 'utf-8')));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, canonical((v as any)[k])]));
  }
  return v;
}
export const inputHash = (input: unknown): string => sha256(JSON.stringify(canonical(input ?? {})));

export function firstString(input: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = input[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

/** Tool input, with hyperfocused-mode `params` merged in when present. */
export function effectiveInput(input: unknown): Record<string, unknown> {
  const base = input && typeof input === 'object' ? { ...(input as Record<string, unknown>) } : {};
  const params = base.params;
  // params only fill keys the top level does not set: a nested key can never override the top-level action/target.
  if (params && typeof params === 'object' && !Array.isArray(params)) {
    for (const [k, v] of Object.entries(params as Record<string, unknown>)) if (!(k in base)) base[k] = v;
  }
  return base;
}

/** Short tool name; hyperfocused-mode `SAP` tool resolves to its `action`. */
export function resolveToolName(toolName: string, input: Record<string, unknown>): string {
  const short = toolName.slice(TOOL_PREFIX.length);
  if (short.toLowerCase() === 'sap' && typeof input.action === 'string' && input.action.trim()) {
    return input.action.trim();
  }
  return short;
}

export function classify(name: string, policy: Policy): Cls | null {
  const lower = name.toLowerCase();
  for (const c of ['R3', 'R2', 'R1', 'R0'] as Cls[]) {
    if (policy.classes[c].some((t) => t.toLowerCase() === lower)) return c;
  }
  if (policy.r3Patterns.some((p) => new RegExp(p, 'i').test(name))) return 'R3';
  return null;
}

export const objectKey = (input: Record<string, unknown>): string | undefined => {
  const v = firstString(input, ['object_url', 'objectUrl', 'url', 'uri', 'object', 'object_name', 'objectName', 'name']);
  if (!v) return undefined;
  try { return decodeURIComponent(v).toLowerCase(); } catch { return v.toLowerCase(); }
};

export const targetOf = (input: Record<string, unknown>): string | undefined =>
  firstString(input, ['transport', 'transport_number', 'transportNumber', 'request', 'number']) ?? objectKey(input);

export function globMatch(pattern: string, value: string): boolean {
  const re = new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$', 'i');
  return re.test(value);
}

export function derivePackage(input: Record<string, unknown>, evidence: Record<string, Evidence>): string | undefined {
  const direct = firstString(input, ['package', 'devclass', 'package_name', 'packageName']);
  if (direct) return direct;
  const key = objectKey(input);
  if (key) {
    const m = key.match(/\/packages\/([^/?#]+)/);
    if (m) return m[1].toUpperCase();
    if (evidence[key]?.package) return evidence[key].package;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Hyperfocused mode: SAP { action, target, params }
// ---------------------------------------------------------------------------

export const isHyperfocused = (toolName: string): boolean =>
  toolName.startsWith(TOOL_PREFIX) && toolName.slice(TOOL_PREFIX.length).toLowerCase() === 'sap';

export interface HfResolved {
  cls: Cls | null;
  /** Name used for approvals and the audit log, e.g. `edit`, `system.delete_transport`, `ReleaseTransport`. */
  tool: string;
  action: string;
  sub?: string;
  deny?: string;
  ask?: string;
  evidence: string[];
  write: boolean;
  /** Normalized object identities ("TYPE NAME"), used as evidence-store keys. */
  keys: string[];
  packages: string[];
  transport?: string;
  /** Target for single-use approvals. */
  approvalTarget?: string;
  /** Transport objects named in the call (add/remove/move). */
  objects: string[];
  rawSql?: string[];
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

function hfParams(raw: Record<string, unknown>): Record<string, unknown> {
  let p = raw.params;
  if (typeof p === 'string') { try { p = JSON.parse(p); } catch { p = undefined; } }
  return p && typeof p === 'object' && !Array.isArray(p) ? (p as Record<string, unknown>) : {};
}

/** "CLAS ZCL_A", "CLAS/OC ZCL_A", an ADT URL or "R3TR PROG ZX" to a normalized "TYPE NAME" key. */
export function normalizeObjectKey(v: string, hf?: HfPolicy): string | undefined {
  const t = v.trim();
  if (!t) return undefined;
  if (t.startsWith('/')) {
    let u = t.toLowerCase();
    try { u = decodeURIComponent(u); } catch { /* keep raw */ }
    const m = u.match(/^\/sap\/bc\/adt\/(.+?)(?:[?#].*)?$/);
    if (m) {
      for (const [prefix, type] of Object.entries(hf?.urlTypes ?? {})) {
        const mm = m[1].match(new RegExp('^' + prefix.replace(/[.+?^${}()|[\]\\]/g, '\\$&') + '/([^/]+)'));
        if (mm) return `${type} ${mm[1].toUpperCase()}`;
      }
    }
    return u;
  }
  const parts = t.split(/\s+/);
  if (parts.length === 3 && /^(R3TR|LIMU)$/i.test(parts[0])) {
    const type = parts[1].toUpperCase();
    return `${hf?.limuTypes?.[type] ?? type} ${parts[2].toUpperCase()}`;
  }
  const m = t.match(/^([A-Za-z]{3,4})(?:\/[A-Za-z]+)?\s+(\S+)$/);
  return m ? `${m[1].toUpperCase()} ${m[2].toUpperCase()}` : undefined;
}

function hfKeys(target: string | undefined, p: Record<string, unknown>, hf?: HfPolicy): string[] {
  const out: string[] = [];
  const add = (v: unknown) => { const s = str(v); const k = s ? normalizeObjectKey(s, hf) : undefined; if (k && !out.includes(k)) out.push(k); };
  if (target && /\s/.test(target)) add(target);
  for (const k of ['object_url', 'object_uri', 'class_url', 'source_url', 'url', 'object']) add(p[k]);
  const ot = str(p.object_type), on = str(p.name) ?? str(p.object_name);
  if (ot && on) add(`${ot} ${on}`);
  if (str(p.class_name)) add(`CLAS ${str(p.class_name)}`);
  if (str(p.program_name)) add(`PROG ${str(p.program_name)}`);
  const fp = str(p.file_path)?.match(/([^/\\]+)\.([a-z]{3,4})\.[^/\\]*$/i);
  if (fp) add(`${fp[2]} ${fp[1]}`);
  return out;
}

const isOff = (v: unknown): boolean => v === undefined || v === null || v === false || v === 0 || v === '' || (typeof v === 'string' && /^(false|0|no)$/i.test(v.trim()));

/** First escalation rule that matches an R2 hyperfocused call, or undefined. Fail-safe: only ever raises the class. */
function matchEscalation(
  hf: HfPolicy, action: string, sub: string | undefined, target: string | undefined,
  keys: string[], p: Record<string, unknown>,
): HfEscalation | undefined {
  const types = new Set<string>(keys.map((k) => k.split(' ')[0].toUpperCase()));
  const t0 = target?.trim().split(/\s+/)[0]?.split('/')[0]?.toUpperCase();
  if (t0) types.add(t0);
  for (const k of ['object_type', 'objtype', 'objType']) {
    const v = str(p[k]); if (v) types.add(v.split('/')[0].toUpperCase());
  }
  for (const e of hf.escalations ?? []) {
    if (!e.actions.includes(action)) continue;
    if (e.subs && !(sub && e.subs.includes(sub))) continue;
    if (e.keyTypes?.some((t) => types.has(t.toUpperCase()))) {
      if (!e.paramsTruthy && !e.paramsWords) return e;
      if (e.paramsTruthy?.some((k) => !isOff(p[k]))) return e;
      if (e.paramsWords && e.paramsWordKeys?.some((k) => typeof p[k] === 'string' && new RegExp(e.paramsWords!, 'i').test((p[k] as string).trim()))) return e;
    }
    if (e.valuePatterns?.length) {
      const vals = [target, ...(e.valueKeys ?? []).map((k) => p[k])].flatMap((v) => listOf(v));
      if (vals.some((v) => e.valuePatterns!.some((rx) => new RegExp(rx, 'i').test(v)))) return e;
    }
  }
  return undefined;
}

function listOf(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string' && !!x.trim()).map((x) => x.trim());
  const s = str(v);
  return s ? [s] : [];
}

/** Resolve a hyperfocused `SAP` call to a risk class using policy.hyperfocused. */
export function resolveHyperfocused(raw: unknown, policy: Policy): HfResolved {
  const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const p = hfParams(input);
  const target = str(input.target);
  const base: HfResolved = { cls: null, tool: 'SAP', action: '', evidence: [], write: true, keys: [], packages: [], objects: [] };
  const hf = policy.hyperfocused;
  if (!hf) return { ...base, ask: 'policy has no hyperfocused map' };
  // SAP() with no arguments is documented as "info".
  const rawAction = input.action === undefined && !target && Object.keys(p).length === 0 ? 'info' : input.action;
  if (typeof rawAction !== 'string' || !rawAction.trim()) return { ...base, ask: 'SAP action missing or not a string' };
  const action = rawAction.trim().toLowerCase();
  const out: HfResolved = { ...base, action, tool: action };
  const entry = Object.prototype.hasOwnProperty.call(hf.actions, action) ? hf.actions[action] : undefined;
  if (!entry) return { ...out, ask: `unclassified SAP action "${action}"` };
  const cfg: HfAction = typeof entry === 'string' ? { class: entry } : entry;

  out.keys = hfKeys(target, p, hf);
  out.transport = firstString(p, ['transport', 'transport_number', 'transportNumber', 'request']);
  for (const k of hf.packageKeys) {
    for (const v of listOf(p[k])) for (const piece of v.split(',')) if (piece.trim()) out.packages.push(piece.trim());
  }
  const tparts = target?.split(/\s+/) ?? [];
  if (!out.packages.length && tparts[0]?.toUpperCase() === 'DEVC' && tparts[1]) out.packages.push(tparts[1]);
  if (!out.packages.length && target?.toUpperCase() === 'DEVC' && str(p.name)) out.packages.push(str(p.name)!);
  for (const k of ['objects', 'object']) for (const o of listOf(p[k])) {
    const nk = normalizeObjectKey(o, hf); if (nk) out.objects.push(nk);
  }

  let cls: Cls = cfg.class;
  let sub: HfSub | undefined;
  if (cfg.sql) {
    // query: a single SELECT is R0, anything else is denied. A statement in params wins over target.
    const stmts = ['sql_query', 'sql', 'query', 'statement'].map((k) => str(p[k])).filter((x): x is string => !!x);
    const tw = target?.toUpperCase();
    if (stmts.length === 0 && target && tw !== 'SQL' && !/^TABL_CONTENTS\b/.test(tw!)) stmts.push(target);
    if (stmts.length === 0 && tw === 'SQL') return { ...out, cls: 'R0', deny: 'query rejected: SQL target without a SQL string' };
    for (const sql of stmts) {
      const bad = inspectQuery(sql);
      if (bad) return { ...out, cls: 'R0', deny: `query rejected: ${bad}` };
    }
    if (stmts.length === 0 && !/^TABL_CONTENTS\b/.test(tw ?? '')) return { ...out, ask: 'query without a table or SQL statement' };
    out.cls = 'R0';
    return out;
  }
  if (cfg.subFrom) {
    let name: string | undefined;
    for (const k of cfg.subFrom) {
      const v = k === 'target' ? (target && !/\s/.test(target) ? target : undefined) : str(p[k]);
      if (v) { name = v.toLowerCase(); break; }
    }
    if (!name && cfg.subDefault && (!cfg.defaultNeedsTarget || target)) name = cfg.subDefault;
    const known = name && cfg.sub && Object.prototype.hasOwnProperty.call(cfg.sub, name) ? cfg.sub[name] : undefined;
    if (known) {
      sub = typeof known === 'string' ? { class: known } : known;
      cls = sub.class;
      out.sub = name;
      out.tool = `${action}.${name}`;
      if (sub.canonical) out.tool = sub.canonical;
    } else if (cfg.unknown === 'ask' || (cfg.unknown === 'r3pattern' && !(name && policy.r3Patterns.some((r) => new RegExp(r, 'i').test(name!))))) {
      return { ...out, ask: `unclassified SAP ${action} sub-type${name ? ` "${name}"` : ''}` };
    } else if (cfg.unknown === 'r3pattern') {
      cls = 'R3'; out.sub = name; out.tool = `${action}.${name}`;
    }
  }
  if (cls === 'R2') {
    const esc = matchEscalation(hf, action, out.sub, target, out.keys, p);
    if (esc) { cls = 'R3'; out.tool = `${out.tool}.${esc.label}`; }
  }
  out.cls = cls;
  out.write = sub?.write ?? true;
  if (sub) {
    out.evidence = [...(sub.evidence ?? [])];
    for (const [param, steps] of Object.entries(sub.evidenceIfParam ?? {})) {
      if (p[param] === true || p[param] === 'true') for (const st of steps) if (!out.evidence.includes(st)) out.evidence.push(st);
    }
  }
  out.approvalTarget = out.transport ?? out.keys[0] ?? str(p.service_name) ?? str(p.file_path) ?? str(p.function) ?? str(p.report) ?? target ?? str(p.job);
  return out;
}

// ---------------------------------------------------------------------------
// RunQuery inspection
// ---------------------------------------------------------------------------

const FORBIDDEN_SQL = /\b(INSERT|UPDATE|DELETE|MODIFY|COMMIT|CALL|DROP|CREATE|ALTER|TRUNCATE|MERGE|UPSERT|GRANT|REVOKE|EXEC|EXECUTE)\b/i;

/** Returns null when the query is a single read-only SELECT, else a deny reason. */
export function inspectQuery(sql: unknown): string | null {
  if (typeof sql !== 'string') return 'RunQuery without a SQL string';
  let out = '';
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (c === '-' && sql[i + 1] === '-') { while (i < sql.length && sql[i] !== '\n') i++; out += ' '; continue; }
    if (c === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2);
      if (end < 0) return 'unterminated comment';
      i = end + 1; out += ' '; continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      const end = sql.indexOf(c, i + 1);
      if (end < 0) return 'unterminated quote';
      out += c + c; i = end; continue;
    }
    out += c;
  }
  // ABAP full-line comments (`*` in column 1)
  out = out.split('\n').filter((l) => !l.startsWith('*')).join('\n').trim().replace(/;+\s*$/, '').trim();
  if (!out) return 'empty query';
  if (out.includes(';')) return 'multiple statements';
  if (!/^SELECT\b/i.test(out)) return 'only SELECT is allowed';
  const bad = out.match(FORBIDDEN_SQL);
  if (bad) return `forbidden keyword ${bad[1].toUpperCase()}`;
  return null;
}

// ---------------------------------------------------------------------------
// Secure store outside the workspace: HMAC key, approvals, pending requests, manifest
// ---------------------------------------------------------------------------

/** Home directory (HOME wins so tests can point it at a temp dir). */
export const homeDir = (): string => process.env.HOME || process.env.USERPROFILE || homedir();
export const secureDir = (): string => join(homeDir(), '.config', 'co-abap');

/** realpath that also works for paths that do not exist yet (resolves the nearest existing ancestor). */
function realish(p: string): string {
  const abs = resolve(p);
  const rest: string[] = [];
  let cur = abs;
  for (;;) {
    try { return join(realpathSync(cur), ...rest.reverse()); } catch { /* walk up */ }
    const up = dirname(cur);
    if (up === cur) return abs;
    rest.push(basename(cur));
    cur = up;
  }
}
export function isInside(child: string, parent: string): boolean {
  const r = relative(realish(parent), realish(child));
  return r === '' || (!r.startsWith('..') && !isAbsolute(r));
}
const canonCache = new Map<string, string>();
/**
 * Canonical repository root: for a git worktree, the main checkout (parent of `git rev-parse --git-common-dir`),
 * so worktree children share the main repo's key-scoped stores (manifest, approvals, grants). Non-git dirs map to themselves.
 */
export function canonicalRoot(dir: string): string {
  const abs = realish(dir);
  const hit = canonCache.get(abs);
  if (hit) return hit;
  let out = abs;
  try {
    const r = spawnSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: abs, encoding: 'utf-8', timeout: 3000, env: { PATH: process.env.PATH ?? '', HOME: homeDir() } });
    const common = r.status === 0 ? r.stdout.trim() : '';
    if (common && basename(common) === '.git') {
      const top = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: abs, encoding: 'utf-8', timeout: 3000, env: { PATH: process.env.PATH ?? '', HOME: homeDir() } });
      const here = top.status === 0 ? realish(top.stdout.trim()) : abs;
      // only remap when `dir` is the top of a checkout (main or worktree), never for arbitrary subdirectories
      if (here === abs) out = realish(dirname(common));
    }
  } catch { /* not git */ }
  canonCache.set(abs, out);
  return out;
}
export const repoHash = (root: string): string => sha256(canonicalRoot(root)).slice(0, 16);

/** Throws when the secure store would live inside the workspace (agent-writable). */
export function assertSecureStore(root: string): void {
  if (isInside(secureDir(), root)) throw new Error(`secure store ${secureDir()} is inside the workspace ${root}; refusing`);
}

/** Key path: ~/.config/co-abap/approval.key, or CO_ABAP_APPROVAL_KEY when it is an absolute path under the home directory. */
export function keyPath(root?: string): string {
  const o = process.env.CO_ABAP_APPROVAL_KEY;
  let p = join(secureDir(), 'approval.key');
  if (o) {
    if (!isAbsolute(o) || !isInside(o, homeDir())) throw new Error('CO_ABAP_APPROVAL_KEY must be an absolute path under the home directory');
    p = resolve(o);
  }
  if (root && isInside(p, root)) throw new Error('approval key must not live inside the workspace');
  return p;
}

export interface KeyState { key?: Buffer; error?: string }

/** Loads the HMAC key without creating it. Never throws. */
export function keyState(root?: string): KeyState {
  try {
    if (root) assertSecureStore(root);
    const p = keyPath(root);
    if (!existsSync(p)) return { error: `approval key ${p} not initialised (a human runs: bun scripts/sap-integrity.ts init)` };
    const st = statSync(p);
    if (process.platform !== 'win32') {
      if ((st.mode & 0o077) !== 0) return { error: `approval key ${p} must be mode 0600` };
      if (typeof process.getuid === 'function' && st.uid !== process.getuid()) return { error: `approval key ${p} is not owned by the current user` };
    }
    const hex = readFileSync(p, 'utf-8').trim();
    if (!/^[0-9a-f]{64}$/.test(hex)) return { error: `approval key ${p} is malformed` };
    return { key: Buffer.from(hex, 'hex') };
  } catch (e) { return { error: (e as Error).message }; }
}
export const loadKey = (root?: string): Buffer | null => keyState(root).key ?? null;
export function requireKey(root?: string): Buffer {
  const s = keyState(root);
  if (!s.key) throw new Error(s.error ?? 'approval key unavailable');
  return s.key;
}

/** Human CLIs only (sap-approve.ts, sap-integrity.ts): create the key (0600) if it does not exist yet. */
export function ensureKey(root?: string): Buffer {
  const s = keyState(root);
  if (s.key) return s.key;
  if (root) assertSecureStore(root);
  const p = keyPath(root);
  if (existsSync(p)) throw new Error(s.error ?? `approval key ${p} unusable`);
  mkdirSync(dirname(p), { recursive: true, mode: 0o700 });
  writeFileSync(p, randomBytes(32).toString('hex') + '\n', { mode: 0o600, flag: 'wx' });
  try { chmodSync(p, 0o600); } catch { /* best effort on win32 */ }
  return requireKey(root);
}

export const hmac = (key: Buffer, msg: string): string => createHmac('sha256', key).update(msg).digest('hex');
export function macEqual(a: unknown, b: string): boolean {
  if (typeof a !== 'string' || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
const canonJson = (v: unknown): string => JSON.stringify(canonical(v));

// ---------------------------------------------------------------------------
// Evidence store (entries HMAC'd), audit log (HMAC hash chain)
// ---------------------------------------------------------------------------

export const auditDir = (root: string) => join(root, 'memory', 'audit');

const evidenceMac = (key: Buffer, k: string, e: Evidence): string => {
  const { mac: _m, unverified: _u, ...rest } = e as Evidence & { mac?: string };
  return hmac(key, `e1|${k}|${canonJson(rest)}`);
};

/**
 * Reads the evidence store. Entries whose MAC is missing or wrong (hand-edited, or no key) are downgraded to
 * `pending` with an empty chain; their transport is kept so they still block a release.
 */
export function readEvidence(root: string): Record<string, Evidence> {
  let raw: any;
  try { raw = JSON.parse(readFileSync(join(auditDir(root), 'sap-evidence.json'), 'utf-8')); } catch { return {}; }
  if (!raw || typeof raw !== 'object') return {};
  const key = loadKey(root);
  const out: Record<string, Evidence> = {};
  for (const [k, e] of Object.entries<any>(raw)) {
    if (!e || typeof e !== 'object') continue;
    if (key && macEqual(e.mac, evidenceMac(key, k, e))) {
      const { mac: _m, ...rest } = e;
      out[k] = { ...rest, chain: rest.chain && typeof rest.chain === 'object' ? rest.chain : {} };
    } else {
      out[k] = { chain: {}, status: 'pending', unverified: true, ...(typeof e.transport === 'string' ? { transport: e.transport } : {}) };
    }
  }
  return out;
}

export function writeEvidence(root: string, ev: Record<string, Evidence>): void {
  mkdirSync(auditDir(root), { recursive: true });
  const key = loadKey(root);
  const signed: Record<string, unknown> = {};
  for (const [k, e] of Object.entries(ev)) {
    const { unverified: _u, ...rest } = e;
    signed[k] = key ? { ...rest, mac: evidenceMac(key, k, rest) } : rest;
  }
  const f = join(auditDir(root), 'sap-evidence.json');
  writeFileSync(f + '.tmp', JSON.stringify(signed, null, 2));
  renameSync(f + '.tmp', f);
}

export function recomputeStatus(e: Evidence): Evidence['status'] {
  if (Object.values(e.chain).some((c) => c.result === 'fail' && (!e.lastWriteTs || c.ts > e.lastWriteTs))) return 'failed';
  const ok = CHAIN.every((t) => e.chain[t]?.result === 'pass' && (!e.lastWriteTs || e.chain[t].ts > e.lastWriteTs));
  return ok ? 'passed' : 'pending';
}

export interface AuditRecord {
  ts: string; sessionId: string; actor: string; tool: string; class: string; decision: string;
  object?: string; package?: string; inputHash: string; beforeHash?: string; afterHash?: string;
  qaResult?: string; approver?: string; transport?: string; profile: string; reason?: string;
  taskId?: string; specId?: string; clientId?: string; grantId?: string; grantRow?: string;
}

function lastLine(file: string): string | undefined {
  let fd: number | undefined;
  try {
    fd = openSync(file, 'r');
    const size = fstatSync(fd).size;
    if (!size) return undefined;
    const n = Math.min(size, 256 * 1024);
    const buf = Buffer.alloc(n);
    readSync(fd, buf, 0, n, size - n);
    const lines = buf.toString('utf-8').split('\n').filter((l) => l.trim());
    return lines.at(-1);
  } catch { return undefined; } finally { if (fd !== undefined) closeSync(fd); }
}

const auditMac = (key: Buffer, rec: Record<string, unknown>): string => hmac(key, `a1|${canonJson(rec)}`);

/** Appends one audit line. Each line carries `prev` (sha256 of the previous raw line) and `mac` (HMAC over the line). */
export function appendAudit(root: string, rec: AuditRecord): void {
  mkdirSync(auditDir(root), { recursive: true });
  const taskId = process.env.HARNESS_TASK_ID?.trim();
  const specId = process.env.HARNESS_SPEC_ID?.trim();
  const file = join(auditDir(root), `sap-actions-${rec.ts.slice(0, 7)}.jsonl`);
  const prevLine = lastLine(file);
  const full: Record<string, unknown> = {
    ...rec, ...(taskId ? { taskId } : {}), ...(specId ? { specId } : {}), prev: prevLine ? sha256(prevLine) : 'genesis',
  };
  for (const k of Object.keys(full)) if (full[k] === undefined) delete full[k];
  const key = loadKey(root);
  if (key) full.mac = auditMac(key, full);
  appendFileSync(file, JSON.stringify(full) + '\n');
}

/** Verifies one audit JSONL file's hash chain and MACs. Returns the 1-based first bad line, or 0 when intact. */
export function verifyAuditFile(file: string, key: Buffer): { ok: boolean; badLine: number; reason?: string } {
  const lines = readFileSync(file, 'utf-8').split('\n').filter((l) => l.trim());
  let prev = 'genesis';
  for (let i = 0; i < lines.length; i++) {
    let rec: any;
    try { rec = JSON.parse(lines[i]); } catch { return { ok: false, badLine: i + 1, reason: 'not JSON' }; }
    if (rec.prev !== prev) return { ok: false, badLine: i + 1, reason: 'chain broken (line removed, inserted or reordered)' };
    const { mac, ...rest } = rec;
    if (!macEqual(mac, auditMac(key, rest))) return { ok: false, badLine: i + 1, reason: 'MAC mismatch' };
    prev = sha256(lines[i]);
  }
  return { ok: true, badLine: 0 };
}

/** The manual profile is retired (D3): one policy applies to every client, so the profile is a constant label. */
export const profileOf = (): string => 'hooked';
export const actorOf = (i: HookInput): string => i.agent_name || i.agent_type || 'main';

// ---------------------------------------------------------------------------
// Proxy approval store (outside the workspace):
//   ~/.config/co-abap/pending/<repo-hash>/<id>.json    written by the proxy, MAC'd
//   ~/.config/co-abap/approvals/<repo-hash>/<id>.json  written only by the human CLI sap-approve.ts, MAC'd
// id = hash(tool, target, normalized input hash, client): an approval cannot be replayed for another input or client.
// The proxy verifies the MAC before the atomic rename that consumes it.
// ---------------------------------------------------------------------------

export const DEFAULT_APPROVAL_TTL_MIN = 15;
export const pendingDir = (root: string) => join(secureDir(), 'pending', repoHash(root));
export const approvalsDir = (root: string) => join(secureDir(), 'approvals', repoHash(root));
export const approvalTtlMs = (policy: Policy): number => {
  const m = policy.approval.ttlMinutes;
  return (typeof m === 'number' && m > 0 ? m : DEFAULT_APPROVAL_TTL_MIN) * 60_000;
};

export const normClient = (c: unknown): string =>
  typeof c === 'string' && /^[A-Za-z0-9._@ -]{1,64}$/.test(c.trim()) ? c.trim() : 'unknown';

export function approvalId(tool: string, target: string | undefined, hash: string, clientId: string): string {
  return sha256(`${tool.toLowerCase()}\0${(target ?? '').toLowerCase()}\0${hash}\0${normClient(clientId)}`).slice(0, 16);
}

export interface PendingRequest {
  id: string; tool: string; target: string; class: string; inputHash: string; reason: string; clientId: string;
  object?: string; package?: string; requestedAt: string; expires: string; actor: string; mac?: string;
}
export interface ProxyApproval {
  id: string; tool: string; target: string; class: string; inputHash: string; clientId: string;
  approver: string; approvedAt: string; expires: string; mac?: string;
}

const pendingMsg = (p: PendingRequest) => `p1|${canonJson({ ...p, mac: undefined })}`;
/** MAC message for an approval: id|tool|target|inputHash|approver|expires|clientId (+ class). */
export const approvalMsg = (a: ProxyApproval) =>
  ['a1', a.id, a.tool, a.target, a.inputHash, a.approver, a.expires, a.clientId, a.class].join('|');

const idOk = (id: string) => /^[0-9a-f]{16}$/.test(id);

export function writePending(root: string, policy: Policy, req: Omit<PendingRequest, 'requestedAt' | 'expires' | 'mac'>, now: Date): PendingRequest {
  assertSecureStore(root);
  const key = requireKey(root);
  const full: PendingRequest = { ...req, clientId: normClient(req.clientId), requestedAt: now.toISOString(), expires: new Date(now.getTime() + approvalTtlMs(policy)).toISOString() };
  full.mac = hmac(key, pendingMsg(full));
  mkdirSync(pendingDir(root), { recursive: true, mode: 0o700 });
  const f = join(pendingDir(root), `${req.id}.json`);
  writeFileSync(f + '.tmp', JSON.stringify(full, null, 2), { mode: 0o600 });
  renameSync(f + '.tmp', f);
  return full;
}

/** Reads a pending request; null when absent, malformed or its MAC does not verify. */
export function readPending(root: string, id: string): PendingRequest | null {
  if (!idOk(id)) return null;
  const key = loadKey(root);
  if (!key) return null;
  try {
    const p = JSON.parse(readFileSync(join(pendingDir(root), `${id}.json`), 'utf-8')) as PendingRequest;
    if (!p || p.id !== id || !macEqual(p.mac, hmac(key, pendingMsg(p)))) return null;
    return p;
  } catch { return null; }
}

export function listPending(root: string): PendingRequest[] {
  try {
    return readdirSync(pendingDir(root)).filter((f) => f.endsWith('.json'))
      .map((f) => readPending(root, f.slice(0, -5))).filter((x): x is PendingRequest => !!x);
  } catch { return []; }
}

export function removePending(root: string, id: string): void {
  if (idOk(id)) try { unlinkSync(join(pendingDir(root), `${id}.json`)); } catch { /* already gone */ }
}

/** Human-side step: turn a (MAC-verified) pending request into a signed single-use approval. */
export function grantApproval(root: string, policy: Policy, id: string, approver: string, now: Date): ProxyApproval {
  assertSecureStore(root);
  const key = requireKey(root);
  const p = readPending(root, id);
  if (!p) throw new Error(`no valid pending request ${id}`);
  if (Date.parse(p.expires) <= now.getTime()) throw new Error(`pending request ${id} expired at ${p.expires}; repeat the call to create a new one`);
  if (approvalId(p.tool, p.target, p.inputHash, p.clientId) !== p.id) throw new Error(`pending request ${id} is inconsistent (id does not match its content)`);
  const a: ProxyApproval = {
    id: p.id, tool: p.tool, target: p.target, class: p.class, inputHash: p.inputHash, clientId: p.clientId, approver,
    approvedAt: now.toISOString(), expires: new Date(now.getTime() + approvalTtlMs(policy)).toISOString(),
  };
  a.mac = hmac(key, approvalMsg(a));
  mkdirSync(approvalsDir(root), { recursive: true, mode: 0o700 });
  const f = join(approvalsDir(root), `${id}.json`);
  writeFileSync(f + '.tmp', JSON.stringify(a, null, 2), { mode: 0o600 });
  renameSync(f + '.tmp', f);
  removePending(root, id);
  return a;
}

/** Verify the MAC, then atomically consume a matching approval (rename into used/). Returns it, or null. */
export function consumeProxyApproval(
  root: string, tool: string, target: string | undefined, hash: string, clientId: string, now: Date,
): ProxyApproval | null {
  try { assertSecureStore(root); } catch { return null; }
  const key = loadKey(root);
  if (!key) return null;
  const client = normClient(clientId);
  const id = approvalId(tool, target, hash, client);
  const f = join(approvalsDir(root), `${id}.json`);
  let a: ProxyApproval;
  try { a = JSON.parse(readFileSync(f, 'utf-8')); } catch { return null; }
  if (!a || typeof a !== 'object' || !macEqual(a.mac, hmac(key, approvalMsg(a)))) return null;
  if (a.id !== id || a.inputHash !== hash || a.clientId !== client || a.tool.toLowerCase() !== tool.toLowerCase()
    || (a.target ?? '').toLowerCase() !== (target ?? '').toLowerCase()) return null;
  if (!(Date.parse(a.expires) > now.getTime())) return null;
  const usedDir = join(approvalsDir(root), 'used');
  try {
    mkdirSync(usedDir, { recursive: true, mode: 0o700 });
    renameSync(f, join(usedDir, `${id}.${now.getTime()}.json`));
  } catch { return null; } // lost the race or cannot consume: never allow
  return a;
}

// ---------------------------------------------------------------------------
// Integrity manifest: SHA-256 of the policy and the enforcement code, HMAC-signed by a human (sap-integrity.ts)
// ---------------------------------------------------------------------------

/*
 * NOTE (tamper-evidence only): integrity is self-verified. The proxy that runs the check is itself one of the
 * covered files, and the HMAC key is readable by the same OS user. The manifest detects edits made after a human
 * signed it (policy reclassification, lib edits, bun preload injection); it cannot stop a same-UID attacker who
 * rewrites the proxy and re-signs with the key. Full closure needs a separate OS user for the proxy and key.
 */
/** Files under the workspace root (policy, bun config) and under the proxy's code directory (enforcement code). */
export const INTEGRITY_ROOT_FILES = ['config/sap-action-policy.json', 'bunfig.toml', 'package.json'];
export const INTEGRITY_CODE_FILES = [
  'scripts/lib/sap-action-lib.ts', 'scripts/sap-mcp-proxy.ts', 'scripts/sap-approve.ts',
  'scripts/hooks/sap-action-gate.ts', 'scripts/hooks/sap-action-audit.ts', 'scripts/sap-integrity.ts',
  'bunfig.toml', 'package.json',
];

/** `preload` entries of a bunfig.toml (string or array form), resolved against its directory. */
export function bunPreloads(bunfigPath: string): string[] {
  let t: string;
  try { t = readFileSync(bunfigPath, 'utf-8'); } catch { return []; }
  const out: string[] = [];
  for (const m of t.matchAll(/^\s*preload\s*=\s*(\[[^\]]*\]|"[^"]*"|'[^']*')/gm)) {
    for (const q of m[1].matchAll(/["']([^"']+)["']/g)) out.push(resolve(dirname(bunfigPath), q[1]));
  }
  return out;
}
export const manifestPath = (root: string) => join(secureDir(), 'manifests', `${repoHash(root)}.json`);

export interface Manifest { v: 1; root: string; codeDir: string; files: Record<string, string>; signedAt: string; signer: string; mac?: string }

export function computeHashes(root: string, codeDir: string): { files: Record<string, string>; policyText?: string } {
  const files: Record<string, string> = {};
  let policyText: string | undefined;
  for (const f of INTEGRITY_ROOT_FILES) {
    try {
      const t = readFileSync(join(root, f), 'utf-8');
      if (f === 'config/sap-action-policy.json') policyText = t;
      files[`root:${f}`] = sha256(t);
    } catch { files[`root:${f}`] = 'missing'; }
  }
  for (const f of INTEGRITY_CODE_FILES) {
    try { files[`code:${f}`] = sha256(readFileSync(join(codeDir, f), 'utf-8')); } catch { files[`code:${f}`] = 'missing'; }
  }
  for (const pre of new Set([...bunPreloads(join(root, 'bunfig.toml')), ...bunPreloads(join(codeDir, 'bunfig.toml'))])) {
    try { files[`preload:${pre}`] = sha256(readFileSync(pre, 'utf-8')); } catch { files[`preload:${pre}`] = 'missing'; }
  }
  return { files, policyText };
}

const manifestMsg = (m: Manifest) => `m1|${canonJson({ ...m, mac: undefined })}`;

export function signManifest(root: string, codeDir: string, signer: string, now: Date): Manifest {
  assertSecureStore(root);
  const key = requireKey(root);
  const m: Manifest = { v: 1, root: canonicalRoot(root), codeDir: canonicalRoot(codeDir), files: computeHashes(root, codeDir).files, signedAt: now.toISOString(), signer };
  m.mac = hmac(key, manifestMsg(m));
  const p = manifestPath(root);
  mkdirSync(dirname(p), { recursive: true, mode: 0o700 });
  writeFileSync(p + '.tmp', JSON.stringify(m, null, 2), { mode: 0o600 });
  renameSync(p + '.tmp', p);
  return m;
}

export interface IntegrityResult { ok: boolean; reason: string; mismatched: string[]; policyText?: string }

/** Verifies the signed manifest against the current files. Never throws. */
export function verifyIntegrity(root: string, codeDir: string): IntegrityResult {
  const { files, policyText } = computeHashes(root, codeDir);
  const fail = (reason: string, mismatched: string[] = []): IntegrityResult => ({ ok: false, reason, mismatched, policyText });
  try { assertSecureStore(root); } catch (e) { return fail((e as Error).message); }
  const ks = keyState(root);
  if (!ks.key) return fail(ks.error ?? 'approval key unavailable');
  let m: Manifest;
  try { m = JSON.parse(readFileSync(manifestPath(root), 'utf-8')); } catch {
    return fail(`no signed integrity manifest for ${root} (a human runs: bun scripts/sap-integrity.ts init)`);
  }
  if (!m || !macEqual(m.mac, hmac(ks.key, manifestMsg(m)))) return fail('integrity manifest signature is invalid');
  if (m.codeDir !== canonicalRoot(codeDir)) return fail(`integrity manifest was signed for code dir ${m.codeDir}`);
  const mismatched = Object.keys({ ...files, ...m.files }).filter((k) => files[k] !== m.files?.[k]);
  if (mismatched.length) return fail(`files changed since the manifest was signed: ${mismatched.map((k) => k.replace(/^(root|code|preload):/, '')).join(', ')}`, mismatched);
  return { ok: true, reason: 'ok', mismatched: [], policyText };
}

// ---------------------------------------------------------------------------
// Dispatch grants: a human approves a whole parallel run once (sap-approve.ts --grant <runId>); child proxies
// (env SAP_DISPATCH_GRANT + SAP_DISPATCH_ROW) then allow calls inside their row's scope until expiry/revoke.
//   ~/.config/co-abap/grants/<repo-hash>/request-<runId>.json  unsigned request (written by the dispatcher)
//   ~/.config/co-abap/grants/<repo-hash>/<grantId>.json        HMAC-signed grant (written only by sap-approve.ts)
//   ~/.config/co-abap/grants/<repo-hash>/<grantId>.revoked     revocation marker
// ---------------------------------------------------------------------------

export const GRANT_MAX_HOURS = 12;
export interface GrantRow { row: string; packages: string[]; objects: string[]; actions: string[]; maxClass: Cls }
export interface GrantRequest { v: 1; runId: string; grantId: string; rows: GrantRow[]; expiresAt: string; requestedAt: string }
export interface Grant extends GrantRequest { approver: string; approvedAt: string; mac?: string }
export interface GrantCall { tool: string; cls: string; packages: string[]; objects: string[] }

const DEFAULT_CODE_ROOT = resolve(import.meta.dir, '..', '..');
const hasGlob = (s: string) => s.includes('*');
const runIdOk = (s: unknown): s is string => typeof s === 'string' && /^[A-Za-z0-9._-]{1,64}$/.test(s);
const grantIdOk = (s: unknown): s is string => typeof s === 'string' && /^[0-9a-f]{16}$/.test(s);
export const grantsDir = (root: string) => join(secureDir(), 'grants', repoHash(root));
const CLS_RANK: Record<string, number> = { R0: 0, R1: 1, R2: 2, R3: 3 };

function normRows(rows: unknown): GrantRow[] {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('grant request needs at least one row');
  return rows.map((r: any, i) => {
    const row = String(r?.row ?? i + 1);
    if (!/^[A-Za-z0-9._-]{1,32}$/.test(row)) throw new Error(`row ${i}: invalid row id`);
    for (const k of ['packages', 'objects', 'actions']) if (r?.[k] !== undefined && !isStrArr(r[k])) throw new Error(`row ${row}: ${k} must be a string array`);
    const maxClass = r?.maxClass ?? 'R0';
    if (!(maxClass in CLS_RANK)) throw new Error(`row ${row}: maxClass must be R0..R3`);
    const actions = (r.actions ?? []).map((a: string) => a.trim()).filter(Boolean);
    if (!actions.length) throw new Error(`row ${row}: actions must list at least one action`);
    const packages = (r.packages ?? []).map((s: string) => s.trim()).filter(Boolean);
    const objects = (r.objects ?? []).map((s: string) => s.trim()).filter(Boolean);
    const starOnly = (s: string) => /^[*\s]+$/.test(s);
    if (actions.some(starOnly)) throw new Error(`row ${row}: a bare "*" action is not allowed; list actions`);
    if (packages.some(starOnly)) throw new Error(`row ${row}: a bare "*" package is not allowed`);
    if (objects.some(starOnly)) throw new Error(`row ${row}: a bare "*" object is not allowed`);
    if (CLS_RANK[maxClass] > 1 && objects.some(hasGlob)) throw new Error(`row ${row}: object globs are not allowed when maxClass is above R1`);
    return { row, packages, objects, actions, maxClass };
  });
}

/** Dispatcher side: write an (unsigned) grant request for a human to approve. Returns the grant id. */
export function createGrantRequest(
  req: { runId: string; rows: Array<Partial<GrantRow> & { row: string | number }>; expiresAt: string },
  root: string = DEFAULT_CODE_ROOT, now: Date = new Date(),
): GrantRequest {
  assertSecureStore(root);
  if (!runIdOk(req?.runId)) throw new Error('runId must match [A-Za-z0-9._-]{1,64}');
  const rows = normRows(req.rows);
  const exp = Date.parse(req.expiresAt);
  if (!Number.isFinite(exp) || exp <= now.getTime()) throw new Error('expiresAt must be in the future');
  if (exp - now.getTime() > GRANT_MAX_HOURS * 3600_000) throw new Error(`expiresAt must be within ${GRANT_MAX_HOURS}h`);
  const expiresAt = new Date(exp).toISOString();
  const grantId = sha256(`g1|${req.runId}|${canonJson(rows)}|${expiresAt}|${now.toISOString()}`).slice(0, 16);
  const g: GrantRequest = { v: 1, runId: req.runId, grantId, rows, expiresAt, requestedAt: now.toISOString() };
  mkdirSync(grantsDir(root), { recursive: true, mode: 0o700 });
  const f = join(grantsDir(root), `request-${req.runId}.json`);
  writeFileSync(f + '.tmp', JSON.stringify(g, null, 2), { mode: 0o600 });
  renameSync(f + '.tmp', f);
  return g;
}

export function readGrantRequest(root: string, runId: string): GrantRequest | null {
  if (!runIdOk(runId)) return null;
  try {
    const g = JSON.parse(readFileSync(join(grantsDir(root), `request-${runId}.json`), 'utf-8'));
    if (g?.runId !== runId || !grantIdOk(g.grantId)) return null;
    return { ...g, rows: normRows(g.rows) };
  } catch { return null; }
}

const grantMsg = (g: Grant) => `g1|${canonJson({ ...g, mac: undefined })}`;

/** Human side (sap-approve.ts --grant): sign the request. */
export function signGrant(root: string, runId: string, approver: string, now: Date): Grant {
  assertSecureStore(root);
  const key = requireKey(root);
  const r = readGrantRequest(root, runId);
  if (!r) throw new Error(`no valid grant request for run ${runId}`);
  if (Date.parse(r.expiresAt) <= now.getTime()) throw new Error(`grant request for run ${runId} already expired`);
  const g: Grant = { ...r, approver, approvedAt: now.toISOString() };
  g.mac = hmac(key, grantMsg(g));
  const f = join(grantsDir(root), `${g.grantId}.json`);
  writeFileSync(f + '.tmp', JSON.stringify(g, null, 2), { mode: 0o600 });
  renameSync(f + '.tmp', f);
  try { unlinkSync(join(grantsDir(root), `request-${runId}.json`)); } catch { /* gone */ }
  return g;
}

export function revokeGrant(grantId: string, root: string = DEFAULT_CODE_ROOT): void {
  if (!grantIdOk(grantId)) throw new Error('invalid grant id');
  mkdirSync(grantsDir(root), { recursive: true, mode: 0o700 });
  writeFileSync(join(grantsDir(root), `${grantId}.revoked`), new Date().toISOString());
  try { unlinkSync(join(grantsDir(root), `${grantId}.json`)); } catch { /* gone */ }
}


/** Child proxy side: is this call inside the signed grant's row scope? */
export function verifyGrant(
  grantId: string, row: string, call: GrantCall, root: string = DEFAULT_CODE_ROOT, now: Date = new Date(),
): { allow: boolean; reason: string } {
  const no = (reason: string) => ({ allow: false, reason: `dispatch grant: ${reason}` });
  try { assertSecureStore(root); } catch (e) { return no((e as Error).message); }
  if (!grantIdOk(grantId)) return no('invalid grant id');
  const key = loadKey(root);
  if (!key) return no('approval key unavailable');
  if (existsSync(join(grantsDir(root), `${grantId}.revoked`))) return no('revoked');
  let g: Grant;
  try { g = JSON.parse(readFileSync(join(grantsDir(root), `${grantId}.json`), 'utf-8')); } catch { return no('not found or not approved'); }
  if (!g || g.grantId !== grantId || !macEqual(g.mac, hmac(key, grantMsg(g)))) return no('signature invalid');
  if (!(Date.parse(g.expiresAt) > now.getTime())) return no(`expired at ${g.expiresAt}`);
  const r = g.rows.find((x) => x.row === row);
  if (!r) return no(`row ${row} is not in the grant`);
  if (!(call.cls in CLS_RANK) || CLS_RANK[call.cls] > CLS_RANK[r.maxClass]) return no(`class ${call.cls} exceeds row ${row} max class ${r.maxClass}`);
  const tool = call.tool.toLowerCase();
  const listed = call.cls === 'R3'
    ? r.actions.some((a) => !hasGlob(a) && a.toLowerCase() === tool)
    : r.actions.some((a) => globMatch(a, call.tool));
  if (!listed) return no(`action ${call.tool} is not listed for row ${row}${call.cls === 'R3' ? ' (R3 actions must be listed explicitly)' : ''}`);
  const ids = call.objects.length + call.packages.length;
  if (ids === 0) return call.cls === 'R0' ? { allow: true, reason: `dispatch grant ${grantId} row ${row}` } : no('call has no determinable object or package');
  const pkgOk = (p: string) => r.packages.some((x) => globMatch(x, p));
  const badPkg = call.packages.find((p) => !pkgOk(p));
  if (badPkg) return no(`package ${badPkg} outside row ${row} scope`);
  // Caller-supplied packages never authorise an existing object: every object must match row.objects.
  // Package-only authorisation is limited to create-type actions (the object does not exist yet).
  const createType = /^create(\.|$)/i.test(call.tool);
  const objOk = (o: string) => r.objects.some((x) => globMatch(x, o)) || (createType && call.packages.length > 0 && call.packages.every(pkgOk));
  const badObj = call.objects.find((o) => !objOk(o));
  if (badObj) return no(`object ${badObj} outside row ${row} scope`);
  return { allow: true, reason: `dispatch grant ${grantId} row ${row}` };
}

/** The signed grant for a run, only if it exists, its MAC verifies, it is unexpired and not revoked; else null. */
export function findGrantByRun(root: string, runId: string, now: Date = new Date()): Grant | null {
  if (!runIdOk(runId)) return null;
  try { assertSecureStore(root); } catch { return null; }
  const key = loadKey(root);
  if (!key) return null;
  let names: string[] = [];
  try { names = readdirSync(grantsDir(root)).filter((f) => /^[0-9a-f]{16}\.json$/.test(f)); } catch { return null; }
  for (const f of names) {
    let g: Grant;
    try { g = JSON.parse(readFileSync(join(grantsDir(root), f), 'utf-8')); } catch { continue; }
    if (!g || g.runId !== runId || `${g.grantId}.json` !== f) continue;
    if (!macEqual(g.mac, hmac(key, grantMsg(g)))) continue;
    if (!(Date.parse(g.expiresAt) > now.getTime())) continue;
    if (existsSync(join(grantsDir(root), `${g.grantId}.revoked`))) continue;
    return g;
  }
  return null;
}
