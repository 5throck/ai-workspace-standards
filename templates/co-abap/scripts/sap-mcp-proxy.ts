#!/usr/bin/env bun
/**
 * sap-mcp-proxy.ts — platform-neutral stdio MCP proxy in front of vsp; the single SAP enforcement point.
 *
 * Usage: bun scripts/sap-mcp-proxy.ts [--vsp ./vsp] [--root <dir>] [--max-class R0|R1|R2|R3] [-- [<vsp-command>] <vsp args...>]
 *
 * Strict JSON-RPC: only initialize, notifications/initialized, notifications/cancelled, ping, tools/list,
 * tools/call and responses are accepted. Non-JSON lines, batches, unknown or case-variant keys are rejected,
 * and every forwarded message is re-serialized from validated fields. `tools/call` is classified with
 * scripts/lib/sap-action-lib.ts (same logic as hooks/sap-action-gate.ts):
 *   allow -> forwarded, response captured, audit + QA evidence recorded (hooks/sap-action-audit.ts `record`)
 *   deny  -> MCP tool result isError=true; never forwarded
 *   ask   -> isError "APPROVAL_REQUIRED id=<id>"; a human runs `bun scripts/sap-approve.ts <id>` in their own
 *            terminal, the agent repeats the identical call, which is then forwarded once (single use).
 * Approvals are HMAC-verified (key outside the workspace) and bound to tool, target, input hash and client.
 * Integrity: the policy and enforcement code must match a human-signed manifest (bun scripts/sap-integrity.ts);
 * on mismatch only hardcoded read-only calls pass (fail closed for R1+).
 * Dispatch grant: env SAP_DISPATCH_GRANT + SAP_DISPATCH_ROW => calls inside the human-signed row scope are allowed
 * (multi-use until expiry/revoke); everything else is denied. Audit lines carry grantId + grantRow.
 * Dispatch argv (env may not reach the proxy on every client): --dispatch-child, --dispatch-mode read|write,
 *   --dispatch-grant <id>, --dispatch-row <row> (must agree with env when both set). A dispatch child without any
 *   ceiling, or in write mode without a grant, is capped at R0.
 * A bunfig.toml preload outside the signed manifest (cwd/root/code dir) makes the proxy refuse to start.
 * Max class: --max-class and env SAP_PROXY_MAX_CLASS; the stricter wins (env can only lower). Default R3.
 * Shutdown (SIGTERM/SIGINT or client stdin close): new tools/call get a JSON-RPC error, in-flight calls get up
 * to 8s to finish (audit/evidence written), then vsp stdin is closed, vsp is sent SIGTERM and the proxy exits.
 * Fail safe: an internal error never allows a call. HARNESS_PROFILE is ignored.
 * Design: docs/designs/2026-10-10-cross-platform-parity-design.md (Phase 1)
 *
 * @version 2.1.0
 */

import { spawn } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { evaluate } from './hooks/sap-action-gate.ts';
import { record } from './hooks/sap-action-audit.ts';
import {
  NEEDS_APPROVAL, TOOL_PREFIX, appendAudit, bunPreloads, canonicalRoot, approvalId, consumeProxyApproval, derivePackage, effectiveInput,
  globMatch, inputHash, isHyperfocused, isInside, keyState, loadPolicy, normClient, objectKey, readEvidence,
  resolveHyperfocused, targetOf, validatePolicy, verifyGrant, verifyIntegrity, writePending,
  type Cls, type HookInput, type Policy,
} from './lib/sap-action-lib.ts';

const SESSION = `proxy-${Date.now().toString(36)}-${process.pid}`;
const PROFILE = 'proxy';
/** Directory holding the enforcement code (this repo), used for the integrity manifest. */
export const CODE_DIR = resolve(import.meta.dir, '..');
export const DRAIN_MS = 7_500;

type Json = Record<string, any>;

export interface Verdict {
  kind: 'allow' | 'deny' | 'approval' | 'approved';
  text?: string; id?: string; approver?: string; cls: string; tool: string; reason: string;
}

const toolResult = (id: unknown, text: string) =>
  ({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }], isError: true } });
const rpcError = (id: unknown, code: number, message: string) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });

// ---------------------------------------------------------------------------
// Max class
// ---------------------------------------------------------------------------

const RANK: Record<string, number> = { R0: 0, R1: 1, R2: 2, R3: 3 };
export const isCls = (v: unknown): v is Cls => typeof v === 'string' && v in RANK;

/** Stricter of the argv value and env SAP_PROXY_MAX_CLASS. A malformed env value fails closed to R0. */
export function effectiveMaxClass(argv: Cls | undefined, envVal: string | undefined): Cls {
  let max: Cls = argv ?? 'R3';
  if (envVal !== undefined && envVal.trim() !== '') {
    const e = envVal.trim().toUpperCase();
    const ev: Cls = isCls(e) ? e : 'R0';
    if (RANK[ev] < RANK[max]) max = ev;
  }
  return max;
}

/** Calls that stay allowed while the integrity check fails: hardcoded, independent of the (possibly edited) policy. */
const DEGRADED_HF_ACTIONS = new Set(['read', 'search', 'grep', 'revisions', 'info', 'help']);
function degradedReadOnly(name: string, args: Json): boolean {
  if (name.toLowerCase() === 'sap') {
    const a = args?.action === undefined && args?.target === undefined && args?.params === undefined ? 'info' : args?.action;
    return typeof a === 'string' && DEGRADED_HF_ACTIONS.has(a.trim().toLowerCase());
  }
  return /^(Get|Search|List)[A-Za-z]*$/.test(name);
}

// ---------------------------------------------------------------------------
// Decision
// ---------------------------------------------------------------------------

/** grant: dispatch child (env SAP_DISPATCH_GRANT + SAP_DISPATCH_ROW); calls outside the row scope are denied, never asked. */
export interface DecideOpts { maxClass?: Cls; clientId?: string; codeDir?: string; grant?: { id?: string; row?: string; conflict?: string } }

/** Decide one tools/call. Pure w.r.t. the wire; touches only the audit store and the secure approval store. */
export function decide(params: Json, root: string, actor: string, now: Date = new Date(), opts: DecideOpts = {}): Verdict {
  const name = typeof params?.name === 'string' ? params.name : '';
  const args = params?.arguments ?? {};
  const clientId = normClient(opts.clientId ?? actor);
  const integ = verifyIntegrity(root, opts.codeDir ?? CODE_DIR);
  const maxClass: Cls = integ.ok ? (opts.maxClass ?? 'R3') : 'R0';
  const hook: HookInput = { session_id: SESSION, tool_name: TOOL_PREFIX + name, tool_input: args, cwd: root, agent_name: actor };
  let policy: Policy | undefined;
  let res: { decision: string; reason: string; cls: string; tool: string };
  try {
    policy = integ.policyText !== undefined ? validatePolicy(JSON.parse(integ.policyText)) : loadPolicy(root);
    if (!name) throw new Error('tools/call without a tool name');
    res = evaluate(hook, root, now, policy);
  } catch (e) {
    res = { decision: 'ask', cls: '?', tool: name || '?', reason: `gate error, failing safe: ${(e as Error).message}` };
  }
  if (res.decision === 'deny' && res.reason === NEEDS_APPROVAL) res = { ...res, decision: 'ask' };
  // Ceiling: integrity failure (R0 + hardcoded read-only set) or --max-class / SAP_PROXY_MAX_CLASS.
  if (!integ.ok && res.decision !== 'deny' && !(res.cls === 'R0' && res.decision === 'allow' && degradedReadOnly(name, args))) {
    res = { ...res, decision: 'deny', reason: `SAP safety integrity check failed (${integ.reason}); only read-only calls are allowed until a human re-signs with: bun scripts/sap-integrity.ts sign` };
  } else if (res.decision !== 'deny' && (isCls(res.cls) ? RANK[res.cls] > RANK[maxClass] : maxClass !== 'R3')) {
    res = { ...res, decision: 'deny', reason: `class ${res.cls} exceeds this proxy's maximum class ${maxClass}` };
  }
  let ti: Record<string, unknown> = {};
  let hash = '';
  let target = '';
  let hf: ReturnType<typeof resolveHyperfocused> | undefined;
  try {
    ti = effectiveInput(args);
    hash = inputHash(args);
    if (policy && isHyperfocused(hook.tool_name!)) {
      hf = resolveHyperfocused(args, policy);
      target = hf.approvalTarget ?? '';
    } else {
      target = targetOf(ti) ?? '';
    }
  } catch { /* hash stays empty: approvals cannot match */ }

  // Dispatch child: the human approved the run once; inside the row scope => allow, anything else => deny.
  const grant = opts.grant;
  if (grant && (grant.id || grant.row || grant.conflict) && res.decision !== 'deny') {
    if (grant.conflict) {
      res = { ...res, decision: 'deny', reason: `dispatch grant misconfigured (${grant.conflict})` };
    } else if (!grant.id || !grant.row) {
      res = { ...res, decision: 'deny', reason: 'dispatch grant misconfigured (SAP_DISPATCH_GRANT and SAP_DISPATCH_ROW must both be set)' };
    } else {
      const objects = hf ? [...hf.keys, ...hf.objects] : [objectKey(ti)].filter((x): x is string => !!x);
      let packages = hf ? [...hf.packages] : [derivePackage(ti, {})].filter((x): x is string => !!x);
      if (!packages.length) {
        const ev = readEvidence(root);
        packages = objects.map((o) => ev[o]?.package).filter((x): x is string => !!x);
      }
      const g = verifyGrant(grant.id, grant.row, { tool: res.tool, cls: res.cls, packages, objects }, root, now);
      res = g.allow ? { ...res, decision: 'allow', reason: g.reason } : { ...res, decision: 'deny', reason: `${g.reason}; outside the approved dispatch scope (dispatch children cannot request approvals)` };
    }
  }
  const base = { cls: res.cls, tool: res.tool, reason: res.reason };

  const audit = (decision: string) => {
    try {
      appendAudit(root, {
        ts: now.toISOString(), sessionId: SESSION, actor, tool: res.tool, class: res.cls, decision,
        object: hf?.keys[0] ?? objectKey(ti), package: hf?.packages[0] ?? derivePackage(ti, readEvidence(root)),
        inputHash: hash || inputHash({}), profile: PROFILE, reason: res.reason, clientId,
        ...(grant?.id ? { grantId: grant.id, grantRow: grant.row } : {}),
      });
    } catch { /* logging must not change the decision */ }
  };

  if (res.decision === 'allow') return { kind: 'allow', ...base };
  if (res.decision === 'deny') {
    audit('deny');
    return { kind: 'deny', ...base, text: `DENIED by SAP safety gate [${res.cls} ${res.tool}]: ${res.reason}. The call was not sent to SAP.` };
  }
  // ask: a previously granted, MAC-valid, exactly matching approval for this client is consumed here
  try {
    if (policy && hash) {
      const a = consumeProxyApproval(root, res.tool, target, hash, clientId, now);
      if (a) return { kind: 'approved', ...base, approver: a.approver, id: a.id };
    }
  } catch { /* fall through to a new request */ }
  if (!hash) {
    audit('deny');
    return { kind: 'deny', ...base, text: `DENIED by SAP safety gate [${res.cls} ${res.tool}]: ${res.reason}; input could not be hashed. The call was not sent to SAP.` };
  }
  const id = approvalId(res.tool, target, hash, clientId);
  try {
    if (!policy) throw new Error('policy unavailable');
    const ks = keyState(root);
    if (!ks.key) throw new Error(ks.error ?? 'approval key unavailable');
    writePending(root, policy, {
      id, tool: res.tool, target, class: res.cls, inputHash: hash, reason: res.reason, actor, clientId,
      object: hf?.keys[0] ?? objectKey(ti), package: hf?.packages[0],
    }, now);
  } catch (e) {
    audit('deny');
    return { kind: 'deny', ...base, text: `DENIED by SAP safety gate [${res.cls} ${res.tool}]: ${res.reason}; approval request could not be stored (${(e as Error).message}). The call was not sent to SAP.` };
  }
  audit('approval_required');
  return {
    kind: 'approval', id, ...base,
    text: `APPROVAL_REQUIRED id=${id}\n[${res.cls} ${res.tool}] ${res.reason}.\nThis call was not sent to SAP. A human must approve it in their own terminal by running:\n  bun scripts/sap-approve.ts ${id}\n(they confirm by typing the first 6 characters of the id), then repeat the identical call (single use, input- and client-bound, expires in minutes). Agents must never run sap-approve.ts.`,
  };
}

// ---------------------------------------------------------------------------
// Strict JSON-RPC validation (client -> vsp)
// ---------------------------------------------------------------------------

const TOP_KEYS = new Set(['jsonrpc', 'id', 'method', 'params', 'result', 'error']);
export const ALLOWED_METHODS = new Set(['initialize', 'notifications/initialized', 'notifications/cancelled', 'ping', 'tools/list', 'tools/call']);
const CALL_KEYS = new Set(['name', 'arguments', '_meta']);
const ARG_RESERVED = ['action', 'target', 'params'];
const PARAMS_FORBIDDEN = ['action', 'target'];

export type Checked =
  | { kind: 'forward'; msg: Json }
  | { kind: 'reject'; id: unknown; code: number; message: string }
  | { kind: 'drop'; reason: string };

const isObj = (v: unknown): v is Json => !!v && typeof v === 'object' && !Array.isArray(v);
const idValid = (id: unknown) => typeof id === 'string' || (typeof id === 'number' && Number.isFinite(id));

function keyCollision(o: Json): string | undefined {
  const seen = new Map<string, string>();
  for (const k of Object.keys(o)) {
    const l = k.toLowerCase();
    if (seen.has(l)) return `${seen.get(l)}/${k}`;
    seen.set(l, k);
  }
  return undefined;
}

/** Validates SAP tool arguments: no case-variant reserved keys, no nested action/target in params. */
export function checkArguments(args: unknown): string | null {
  if (!isObj(args)) return 'arguments must be an object';
  const c = keyCollision(args);
  if (c) return `case-variant duplicate keys in arguments (${c})`;
  for (const k of Object.keys(args)) {
    if (ARG_RESERVED.includes(k.toLowerCase()) && k !== k.toLowerCase()) return `case-variant key "${k}" in arguments`;
  }
  let p: unknown = args.params;
  if (typeof p === 'string') { try { p = JSON.parse(p); } catch { return null; } }
  if (isObj(p)) {
    const pc = keyCollision(p);
    if (pc) return `case-variant duplicate keys in params (${pc})`;
    for (const k of Object.keys(p)) if (PARAMS_FORBIDDEN.includes(k.toLowerCase())) return `params must not contain "${k}"`;
  }
  return null;
}

export function checkClientMessage(line: string): Checked {
  let m: unknown;
  try { m = JSON.parse(line); } catch { return { kind: 'reject', id: null, code: -32700, message: 'parse error: not JSON' }; }
  if (Array.isArray(m)) return { kind: 'reject', id: null, code: -32600, message: 'batch requests are not supported' };
  if (!isObj(m)) return { kind: 'reject', id: null, code: -32600, message: 'invalid request' };
  const hasId = 'id' in m;
  const id = hasId && idValid(m.id) ? m.id : null;
  const bad = (message: string, code = -32600): Checked => (hasId ? { kind: 'reject', id, code, message } : { kind: 'drop', reason: message });
  const extra = Object.keys(m).filter((k) => !TOP_KEYS.has(k));
  if (extra.length) return bad(`unknown keys: ${extra.join(', ')}`);
  if (m.jsonrpc !== '2.0') return bad('jsonrpc must be "2.0"');
  if (hasId && !idValid(m.id)) return { kind: 'reject', id: null, code: -32600, message: 'id must be a string or number' };
  if (m.method === undefined) {
    // response to a server-initiated request
    if (!hasId || 'params' in m || ('result' in m) === ('error' in m)) return bad('invalid response');
    return { kind: 'forward', msg: 'result' in m ? { jsonrpc: '2.0', id: m.id, result: m.result } : { jsonrpc: '2.0', id: m.id, error: m.error } };
  }
  if ('result' in m || 'error' in m) return bad('request must not carry result/error');
  if (typeof m.method !== 'string' || !ALLOWED_METHODS.has(m.method)) return bad(`method not allowed: ${String(m.method)}`, -32601);
  if ('params' in m && !isObj(m.params)) return bad('params must be an object', -32602);
  const isNotification = m.method.startsWith('notifications/');
  if (isNotification && hasId) return bad('notification must not carry an id');
  if (!isNotification && !hasId) return { kind: 'drop', reason: `${m.method} without id` };
  if (m.method === 'tools/call') {
    const p = m.params ?? {};
    const ex = Object.keys(p).filter((k) => !CALL_KEYS.has(k));
    if (ex.length) return bad(`unknown tools/call params keys: ${ex.join(', ')}`, -32602);
    if (typeof p.name !== 'string' || !p.name) return bad('tools/call without a tool name', -32602);
    const args = p.arguments === undefined ? {} : p.arguments;
    const why = checkArguments(args);
    if (why) return bad(why, -32602);
    const params: Json = { name: p.name, arguments: args };
    if (isObj(p._meta)) params._meta = p._meta;
    return { kind: 'forward', msg: { jsonrpc: '2.0', id: m.id, method: 'tools/call', params } };
  }
  const out: Json = { jsonrpc: '2.0', method: m.method };
  if (hasId) out.id = m.id;
  if ('params' in m) out.params = m.params;
  return { kind: 'forward', msg: out };
}

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

export interface ProxyArgs {
  vsp: string; vspArgs: string[]; root: string; maxClass?: Cls;
  dispatchGrant?: string; dispatchRow?: string; dispatchChild: boolean; dispatchMode?: string;
}

export function parseArgs(argv: string[]): ProxyArgs {
  let vsp = './vsp';
  // default root: the canonical repo root (main checkout even when this file runs from a git worktree)
  let root = canonicalRoot(resolve(import.meta.dir, '..'));
  const out: Omit<ProxyArgs, 'vsp' | 'vspArgs' | 'root'> = { dispatchChild: false };
  let rest: string[] = [];
  const fail = (m: string): never => { throw new Error(m); };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') { rest = argv.slice(i + 1); break; }
    if (a === '--vsp') vsp = argv[++i] ?? vsp;
    else if (a === '--root') root = resolve(argv[++i] ?? root);
    else if (a === '--max-class') {
      const v = (argv[++i] ?? '').toUpperCase();
      if (!isCls(v)) fail('--max-class must be R0, R1, R2 or R3');
      out.maxClass = v as Cls;
    } else if (a === '--dispatch-grant') out.dispatchGrant = (argv[++i] ?? '').trim() || fail('--dispatch-grant needs a value');
    else if (a === '--dispatch-row') out.dispatchRow = (argv[++i] ?? '').trim() || fail('--dispatch-row needs a value');
    else if (a === '--dispatch-child') out.dispatchChild = true;
    else if (a === '--dispatch-mode') {
      const m = (argv[++i] ?? '').trim().toLowerCase();
      if (m !== 'read' && m !== 'write') fail('--dispatch-mode must be read or write');
      out.dispatchMode = m;
    }
  }
  if (rest.length && !rest[0].startsWith('-')) { vsp = rest[0]; rest = rest.slice(1); }
  return { vsp, vspArgs: rest, root, ...out };
}

export interface DispatchConfig { maxClass: Cls; grant?: { id?: string; row?: string; conflict?: string } }

/**
 * Combines argv and env (env vars may not reach the proxy on every client, so both are accepted):
 * - ceiling: stricter of --max-class and SAP_PROXY_MAX_CLASS; a dispatch child with no ceiling at all gets R0,
 *   and a dispatch child in write mode without a grant is capped at R0 (non-R0 denied).
 * - grant/row: --dispatch-grant/--dispatch-row and SAP_DISPATCH_GRANT/SAP_DISPATCH_ROW must agree when both are given.
 */
export function resolveDispatch(a: Pick<ProxyArgs, 'maxClass' | 'dispatchGrant' | 'dispatchRow' | 'dispatchChild' | 'dispatchMode'>, env: NodeJS.ProcessEnv): DispatchConfig {
  const envMax = env.SAP_PROXY_MAX_CLASS?.trim() ? env.SAP_PROXY_MAX_CLASS : undefined;
  let maxClass = effectiveMaxClass(a.maxClass, envMax);
  const child = a.dispatchChild || /^(1|true|yes)$/i.test(env.SAP_DISPATCH_CHILD ?? '');
  const mode = a.dispatchMode ?? env.SAP_DISPATCH_MODE?.trim().toLowerCase();
  const eg = env.SAP_DISPATCH_GRANT?.trim() || undefined;
  const er = env.SAP_DISPATCH_ROW?.trim() || undefined;
  let conflict: string | undefined;
  if (a.dispatchGrant && eg && a.dispatchGrant !== eg) conflict = 'dispatch grant differs between argv and env';
  if (a.dispatchRow && er && a.dispatchRow !== er) conflict = 'dispatch row differs between argv and env';
  const id = a.dispatchGrant ?? eg;
  const row = a.dispatchRow ?? er;
  if (child && a.maxClass === undefined && envMax === undefined) maxClass = 'R0';
  if (child && mode === 'write' && !id) maxClass = 'R0';
  const grant = id || row || conflict ? { id, row, ...(conflict ? { conflict } : {}) } : undefined;
  return { maxClass, grant };
}

/** Refuse to run when a bunfig.toml preload could inject code outside the signed manifest. */
export function preloadRefusal(cwd: string, root: string, codeDir: string, integrityOk: boolean): string | null {
  const signed = new Set([realOr(join(root, 'bunfig.toml')), realOr(join(codeDir, 'bunfig.toml'))]);
  for (const dir of new Set([cwd, root, codeDir])) {
    const f = join(dir, 'bunfig.toml');
    if (!bunPreloads(f).length) continue;
    if (!signed.has(realOr(f))) return `bunfig.toml preload in ${dir} is not covered by the integrity manifest; refusing to run`;
    if (!integrityOk) return `bunfig.toml preload in ${dir} with a failed integrity check; refusing to run`;
  }
  return null;
}
const realOr = (p: string) => { try { return realpathSync(p); } catch { return resolve(p); } };

/** Safety ceiling every client gets (mirrors .mcp.json). .env and the client env can only narrow it. */
export const SAFE_DEFAULTS: Record<string, string> = {
  SAP_MODE: 'hyperfocused',
  SAP_ALLOWED_PACKAGES: 'Z*,$TMP,$ZADT_VSP,$VSP_ADT',
  SAP_FEATURE_ABAPGIT: 'off',
  SAP_FEATURE_TRANSPORT: 'off',
  SAP_FEATURE_UI5: 'off',
  SAP_FEATURE_RAP: 'off',
};

/** Minimal dotenv parser (KEY=VALUE, optional quotes, `export ` prefix, # comments). Values are never logged. */
export function parseDotenv(src: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of src.split(/\r?\n/)) {
    const m = raw.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if (/^(["']).*\1$/.test(v) && v.length >= 2) v = v.slice(1, -1);
    else v = v.replace(/\s+#.*$/, '');
    out[m[1]] = v;
  }
  return out;
}

const splitList = (s: string | undefined) => (s ?? '').split(',').map((x) => x.trim()).filter(Boolean);
const isOn = (v: string | undefined) => !!v && /^(on|true|1|yes)$/i.test(v.trim());

/**
 * vsp environment. Non-safety keys: non-empty process env wins, then <root>/.env. Safety keys are a ceiling:
 * SAP_ALLOWED_PACKAGES is the requested list intersected with the defaults and policy.allowedPackages;
 * SAP_FEATURE_* stay off unless requested and listed in policy.vspFeatures.allowOn; SAP_MODE is hyperfocused.
 * HARNESS_* is never taken from .env, and HARNESS_PROFILE is removed.
 */
export function buildVspEnv(root: string, base: NodeJS.ProcessEnv, policy?: Policy): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...base };
  delete env.HARNESS_PROFILE;
  let dot: Record<string, string> = {};
  try { dot = parseDotenv(readFileSync(join(root, '.env'), 'utf-8')); } catch { /* no .env */ }
  if (!policy) { try { policy = loadPolicy(root); } catch { /* strictest ceiling below */ } }
  const requested = (k: string) => (env[k] ? env[k] : dot[k]);
  for (const [k, v] of Object.entries(dot)) {
    if (k.startsWith('HARNESS_') || k.startsWith('SAP_FEATURE_') || k in SAFE_DEFAULTS) continue;
    if (!env[k]) env[k] = v;
  }
  env.SAP_MODE = SAFE_DEFAULTS.SAP_MODE;
  const ceiling = splitList(SAFE_DEFAULTS.SAP_ALLOWED_PACKAGES)
    .filter((d) => !policy || policy.allowedPackages.some((p) => globMatch(p, d)));
  const req = splitList(requested('SAP_ALLOWED_PACKAGES'));
  const within = (pat: string) => ceiling.some((c) => globMatch(c, pat)) && (!policy || policy.allowedPackages.some((p) => globMatch(p, pat)));
  const narrowed = req.filter(within);
  env.SAP_ALLOWED_PACKAGES = (req.length && narrowed.length ? narrowed : ceiling).join(',') || '$TMP';
  const allowOn = new Set(policy?.vspFeatures?.allowOn ?? []);
  const featureKeys = new Set([...Object.keys(SAFE_DEFAULTS), ...Object.keys(env), ...Object.keys(dot)].filter((k) => k.startsWith('SAP_FEATURE_')));
  for (const k of featureKeys) env[k] = allowOn.has(k) && isOn(requested(k)) ? 'on' : 'off';
  return env;
}

/** Redacts credential-like values from vsp stderr. */
export function makeRedactor(env: NodeJS.ProcessEnv): (s: string) => string {
  const secrets = Object.entries(env)
    .filter(([k, v]) => /(PASS|SECRET|TOKEN|KEY|COOKIE|AUTH|CREDENTIAL)/i.test(k) && typeof v === 'string' && v.length >= 4)
    .map(([, v]) => v as string).sort((a, b) => b.length - a.length);
  return (s: string) => {
    let out = s;
    for (const v of secrets) out = out.split(v).join('***');
    out = out.replace(/\b(Basic|Bearer)\s+[A-Za-z0-9+/=._-]{6,}/g, '$1 ***');
    out = out.replace(/(password|passwd|pwd|secret|token|cookie|sap-password)(["']?\s*[:=]\s*["']?)[^\s"'&,;]+/gi, '$1$2***');
    return out;
  };
}

/** Refuse the repository's own ./vsp in CI / test runs (tests must use a stub vsp and a temp root). */
export function vspRefusal(cmd: string, codeDir: string, env: NodeJS.ProcessEnv): string | null {
  if (!(env.CI || env.NODE_ENV === 'test')) return null;
  for (const n of ['vsp', 'vsp.exe']) {
    const p = join(codeDir, n);
    if (resolve(cmd) === p || (isInside(cmd, codeDir) && isInside(p, cmd))) return `refusing to launch ${p} while CI or NODE_ENV=test is set; use --root <temp> and a stub vsp`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Wire handling
// ---------------------------------------------------------------------------

function main(): void {
  let args: ProxyArgs;
  try { args = parseArgs(process.argv.slice(2)); } catch (e) { process.stderr.write(`sap-mcp-proxy: ${(e as Error).message}\n`); process.exit(2); }
  const { vsp, vspArgs, root } = args;
  const { maxClass, grant: grantCfg } = resolveDispatch(args, process.env);
  const grant = grantCfg ?? {};
  const env = buildVspEnv(root, process.env);
  for (const k of ['SAP_PROXY_MAX_CLASS', 'SAP_DISPATCH_GRANT', 'SAP_DISPATCH_ROW', 'SAP_DISPATCH_CHILD', 'SAP_DISPATCH_MODE']) delete env[k];
  delete process.env.HARNESS_PROFILE; // the in-process gate must not see the retired manual profile
  const defaultVsp = join(root, process.platform === 'win32' ? 'vsp.exe' : 'vsp');
  const cmd = vsp === './vsp' ? defaultVsp : vsp.includes('/') || vsp.includes('\\') ? resolve(root, vsp) : vsp;
  const refusal = vspRefusal(cmd, CODE_DIR, process.env);
  if (refusal) { process.stderr.write(`sap-mcp-proxy: ${refusal}\n`); process.exit(126); }
  const integ = verifyIntegrity(root, CODE_DIR);
  const pre = preloadRefusal(process.cwd(), root, CODE_DIR, integ.ok);
  if (pre) { process.stderr.write(`sap-mcp-proxy: ${pre}\n`); process.exit(126); }
  if (!integ.ok) process.stderr.write(`sap-mcp-proxy: integrity check failed (${integ.reason}). Only read-only calls are allowed until a human runs: bun scripts/sap-integrity.ts sign\n`);
  const redact = makeRedactor(env);
  const child = spawn(cmd, vspArgs, { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
  let actor = 'main';
  let clientId: string | undefined;
  const inflight = new Map<string, { params: Json; approver?: string; decision: string; started: Date }>();
  let childAlive = true;
  let draining = false;

  const toClient = (msg: unknown) => process.stdout.write((typeof msg === 'string' ? msg : JSON.stringify(msg)) + '\n');
  const toVsp = (msg: Json) => {
    if (!childAlive || !child.stdin.writable) return false;
    child.stdin.write(JSON.stringify(msg) + '\n');
    return true;
  };

  child.on('error', (e) => {
    process.stderr.write(`sap-mcp-proxy: cannot start ${cmd}: ${e.message}\n`);
    process.exit(127);
  });
  child.stdin.on('error', () => { /* handled by exit */ });

  const handleClient = (line: string) => {
    const c = checkClientMessage(line);
    if (c.kind === 'reject') { toClient(rpcError(c.id, c.code, c.message)); return; }
    if (c.kind === 'drop') return;
    const msg = c.msg;
    if (msg.method === 'initialize' && clientId === undefined) {
      actor = normClient(msg.params?.clientInfo?.name);
      clientId = actor;
    }
    if (msg.method !== 'tools/call') {
      if (!toVsp(msg) && msg.id !== undefined) toClient(rpcError(msg.id, -32000, 'SAP backend (vsp) is not running'));
      return;
    }
    if (draining) { toClient(rpcError(msg.id, -32000, 'SAP proxy is shutting down; the call was not sent.')); return; }
    const key = JSON.stringify(msg.id);
    if (inflight.has(key)) { toClient(rpcError(msg.id, -32600, 'duplicate in-flight request id')); return; }
    let v: Verdict;
    try {
      v = decide(msg.params, root, actor, new Date(), { maxClass, clientId: clientId ?? actor, grant });
    } catch (e) {
      v = { kind: 'deny', cls: '?', tool: '?', reason: 'internal error', text: `DENIED by SAP safety gate: internal error (${(e as Error).message}). The call was not sent to SAP.` };
    }
    if (v.kind === 'deny' || v.kind === 'approval') { toClient(toolResult(msg.id, v.text!)); return; }
    inflight.set(key, { params: msg.params, decision: v.kind === 'approved' ? 'approved' : 'allow', approver: v.approver, started: new Date() });
    if (!toVsp(msg)) {
      inflight.delete(key);
      toClient(toolResult(msg.id, 'SAP backend (vsp) is not running; the call was not sent.'));
    }
  };

  const settle = (msg: any) => {
    const key = msg && typeof msg === 'object' && msg.id !== undefined && (msg.result !== undefined || msg.error !== undefined) ? JSON.stringify(msg.id) : undefined;
    const ctx = key ? inflight.get(key) : undefined;
    if (!key || !ctx) return;
    inflight.delete(key);
    try {
      const name = String(ctx.params?.name ?? '');
      const response = msg.error ? { isError: true, error: msg.error } : msg.result;
      record(
        { session_id: SESSION, tool_name: TOOL_PREFIX + name, tool_input: ctx.params?.arguments ?? {}, tool_response: response, cwd: root, agent_name: actor },
        root, new Date(), { decision: ctx.decision, approver: ctx.approver, profile: PROFILE, clientId, ...(grant.id ? { grantId: grant.id, grantRow: grant.row } : {}) },
      );
    } catch { /* audit must not break the session */ }
  };

  const handleVsp = (line: string) => {
    let msg: any;
    try { msg = JSON.parse(line); } catch { toClient(line); return; }
    if (Array.isArray(msg)) msg.forEach(settle); else settle(msg);
    toClient(line);
    if (draining && inflight.size === 0) finishDrain();
  };

  const pump = (stream: NodeJS.ReadableStream, onLine: (line: string) => void, onEnd: () => void) => {
    const dec = new StringDecoder('utf8');
    let buf = '';
    const flush = (final: boolean) => {
      let i: number;
      while ((i = buf.indexOf('\n')) >= 0) {
        const raw = buf.slice(0, i); buf = buf.slice(i + 1);
        const line = raw.replace(/\r$/, '');
        if (line.trim()) onLine(line);
      }
      if (final && buf.trim()) { onLine(buf.replace(/\r$/, '')); buf = ''; }
    };
    stream.on('data', (c: Buffer | string) => { buf += typeof c === 'string' ? c : dec.write(c); flush(false); });
    stream.on('end', () => { buf += dec.end(); flush(true); onEnd(); });
  };

  let vspOut = false;
  let exitCode: number | null = null;
  let killVsp = false;
  let drainTimer: ReturnType<typeof setTimeout> | undefined;
  let finished = false;
  const maybeExit = () => {
    if (vspOut && exitCode !== null) {
      for (const [k] of inflight) toClient(toolResult(JSON.parse(k), 'SAP backend (vsp) exited before answering.'));
      inflight.clear();
      process.exitCode = exitCode;
      process.stdin.destroy(); // let stdout drain, then exit naturally (process.exit would truncate large output)
    }
  };
  /** In-flight calls are done (or timed out): close vsp stdin, SIGTERM vsp on signal shutdown. */
  function finishDrain() {
    if (finished) return;
    finished = true;
    if (drainTimer) clearTimeout(drainTimer);
    for (const [k, ctx] of inflight) {
      toClient(toolResult(JSON.parse(k), 'SAP proxy shut down before vsp answered; the outcome is unknown.'));
      try {
        appendAudit(root, { ts: new Date().toISOString(), sessionId: SESSION, actor, tool: String(ctx.params?.name ?? '?'), class: '?', decision: 'aborted_on_shutdown', inputHash: inputHashSafe(ctx.params?.arguments), profile: PROFILE, clientId });
      } catch { /* best effort */ }
    }
    inflight.clear();
    try { child.stdin.end(); } catch { /* gone */ }
    if (killVsp) {
      // give vsp a moment to exit on EOF, then SIGTERM, then SIGKILL (total stays under a 10s dispatcher grace)
      setTimeout(() => { if (childAlive) try { child.kill('SIGTERM'); } catch { /* gone */ } }, 500).unref();
      setTimeout(() => { if (childAlive) try { child.kill('SIGKILL'); } catch { /* gone */ } process.exit(process.exitCode ?? 1); }, 1_500).unref();
    }
  }
  const startDrain = (viaSignal: boolean) => {
    if (viaSignal) killVsp = true;
    if (draining) { if (viaSignal && finished && childAlive) { try { child.kill('SIGTERM'); } catch { /* gone */ } } return; }
    draining = true;
    if (inflight.size === 0) { finishDrain(); return; }
    drainTimer = setTimeout(finishDrain, DRAIN_MS);
  };

  pump(child.stdout!, handleVsp, () => { vspOut = true; maybeExit(); });
  pump(child.stderr!, (l) => process.stderr.write(redact(l) + '\n'), () => { /* closed */ });
  child.on('exit', (code, sig) => { childAlive = false; exitCode = code ?? (sig ? (killVsp ? 0 : 1) : 0); maybeExit(); });
  pump(process.stdin, handleClient, () => startDrain(false));
  for (const s of ['SIGTERM', 'SIGINT', 'SIGBREAK', 'SIGHUP'] as const) {
    try { process.on(s, () => startDrain(true)); } catch { /* signal unsupported on this platform */ }
  }
}

function inputHashSafe(v: unknown): string { try { return inputHash(v ?? {}); } catch { return inputHash({}); } }

if (import.meta.main) main();
