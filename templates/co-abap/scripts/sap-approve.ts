#!/usr/bin/env bun
/**
 * sap-approve.ts — human CLI that turns a pending SAP request (written by sap-mcp-proxy.ts) into a
 * single-use, HMAC-signed approval in ~/.config/co-abap/approvals/<repo-hash>/ (outside the workspace),
 * or signs a dispatch grant for a whole parallel run.
 *
 * Usage: bun scripts/sap-approve.ts <id>                 approve one pending call
 *        bun scripts/sap-approve.ts <id> --deny          reject a pending call
 *        bun scripts/sap-approve.ts --list               list pending calls
 *        bun scripts/sap-approve.ts --grant <runId>      approve a dispatch run (every row's scope)
 *        bun scripts/sap-approve.ts --revoke-grant <grantId>
 *
 * Approving reads the confirmation from the controlling terminal (/dev/tty, or CONIN$ on Windows), never from
 * stdin, and requires typing the first 6 characters of the id. The approver is the OS user (not an argument).
 * The HMAC key (~/.config/co-abap/approval.key, 0600) is created on first use.
 * Residual risk: an agent running as the same OS user with an unrestricted shell can read the key or drive a pty.
 * Design: docs/designs/2026-10-10-cross-platform-parity-design.md (Phase 1)
 *
 * @version 2.1.0
 */

import { closeSync, openSync, readSync, writeSync } from 'node:fs';
import { userInfo } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  appendAudit, ensureKey, grantApproval, listPending, loadPolicy, readEvidence, readGrantRequest, readPending,
  removePending, revokeGrant, signGrant, type GrantRequest, type PendingRequest,
} from './lib/sap-action-lib.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Reads one confirmation line from the human. Returns null when no terminal is available. */
export type Prompt = (question: string) => string | null;

/** Prompt on the controlling terminal, bypassing stdin/stdout redirection. */
export const ttyPrompt: Prompt = (question) => {
  const [inPath, outPath] = process.platform === 'win32' ? ['\\\\.\\CONIN$', '\\\\.\\CONOUT$'] : ['/dev/tty', '/dev/tty'];
  let fin: number | undefined; let fout: number | undefined;
  try {
    fin = openSync(inPath, 'r');
    fout = openSync(outPath, 'w');
    writeSync(fout, question);
    const buf = Buffer.alloc(1);
    let line = '';
    while (line.length < 256) {
      const n = readSync(fin, buf, 0, 1, null);
      if (n <= 0) break;
      const c = buf.toString('utf-8');
      if (c === '\n') break;
      if (c !== '\r') line += c;
    }
    return line.trim();
  } catch { return null; } finally {
    for (const fd of [fin, fout]) if (fd !== undefined) try { closeSync(fd); } catch { /* closed */ }
  }
};

export const osUser = (): string => { try { return userInfo().username; } catch { return 'unknown'; } };

export function describe(p: PendingRequest): string {
  return [
    `id        : ${p.id}`, `tool      : ${p.tool}  (class ${p.class})`, `target    : ${p.target || '(none)'}`,
    `object    : ${p.object ?? '(n/a)'}`, `package   : ${p.package ?? '(n/a)'}`, `client    : ${p.clientId}`, `reason    : ${p.reason}`,
    `input hash: ${p.inputHash.slice(0, 16)}...`, `requested : ${p.requestedAt} by ${p.actor}`, `expires   : ${p.expires}`,
  ].join('\n');
}

export function describeGrant(g: GrantRequest): string {
  const lines = [`grant id  : ${g.grantId}`, `run       : ${g.runId}`, `expires   : ${g.expiresAt}`, `requested : ${g.requestedAt}`, ''];
  for (const r of g.rows) {
    lines.push(`row ${r.row}  max class ${r.maxClass}`,
      `  actions : ${r.actions.join(', ')}`,
      `  packages: ${r.packages.join(', ') || '(none)'}`,
      `  objects : ${r.objects.join(', ') || '(none)'}`);
    for (const [kind, list] of [['action', r.actions], ['package', r.packages], ['object', r.objects]] as const) {
      for (const w of list.filter((x) => x.includes('*'))) lines.push(`  WARNING: wildcard ${kind} "${w}" matches more than one name`);
    }
    if (r.maxClass === 'R3') lines.push('  WARNING: max class R3 — privileged actions listed explicitly above are allowed without further approval');
  }
  return lines.join('\n');
}

function confirm(prompt: Prompt, id: string, out: (s: string) => void): boolean {
  const typed = prompt(`\nType the first 6 characters of the id (${id.slice(0, 2)}....) to approve, anything else to abort: `);
  if (typed === null) { out('refusing: no interactive terminal (/dev/tty) available; approvals are for humans.'); return false; }
  if (typed !== id.slice(0, 6)) { out('aborted: confirmation did not match.'); return false; }
  return true;
}

export function run(argv: string[], root: string = ROOT, now: Date = new Date(), prompt: Prompt = ttyPrompt): { code: number; out: string } {
  const lines: string[] = [];
  const out = (s: string) => lines.push(s);
  const done = (code: number) => ({ code, out: lines.join('\n') });
  let id: string | undefined; let list = false; let deny = false; let grantRun: string | undefined; let revoke: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--list') list = true;
    else if (a === '--deny') deny = true;
    else if (a === '--grant') grantRun = argv[++i];
    else if (a === '--revoke-grant') revoke = argv[++i];
    else if (!a.startsWith('-')) id = a;
    else { out(`unknown option ${a}`); return done(2); }
  }
  const who = osUser();
  if (list) {
    const live = listPending(root).filter((p) => Date.parse(p.expires) > now.getTime());
    if (!live.length) out('no pending SAP approval requests');
    for (const p of live) out(`${p.id}  ${p.class} ${p.tool}  ${p.target || '-'}  client ${p.clientId}  expires ${p.expires}`);
    return done(0);
  }
  if (revoke) {
    try { revokeGrant(revoke, root); out(`revoked dispatch grant ${revoke}`); return done(0); } catch (e) { out(`cannot revoke: ${(e as Error).message}`); return done(1); }
  }
  if (grantRun) {
    const g = readGrantRequest(root, grantRun);
    if (!g) { out(`no valid grant request for run ${grantRun}`); return done(1); }
    out('Approving dispatch run (all rows):'); out(describeGrant(g));
    try { ensureKey(root); } catch (e) { out(`cannot initialise approval key: ${(e as Error).message}`); return done(1); }
    if (!confirm(prompt, g.grantId, out)) return done(3);
    try {
      const s = signGrant(root, grantRun, who, now);
      try {
        appendAudit(root, { ts: now.toISOString(), sessionId: 'approve-cli', actor: who, tool: 'dispatch-grant', class: 'grant', decision: 'grant_signed',
          inputHash: s.grantId.padEnd(64, '0'), approver: who, profile: 'proxy', grantId: s.grantId, reason: `run ${s.runId}, ${s.rows.length} row(s)` });
      } catch { /* best effort */ }
      out(`\nGrant ${s.grantId} signed by ${who}, valid until ${s.expiresAt}. Revoke early with: bun scripts/sap-approve.ts --revoke-grant ${s.grantId}`);
      return done(0);
    } catch (e) { out(`cannot sign grant: ${(e as Error).message}`); return done(1); }
  }
  if (!id) { out('usage: bun scripts/sap-approve.ts <id> [--deny] | --list | --grant <runId> | --revoke-grant <grantId>'); return done(2); }
  const p = readPending(root, id);
  if (!p) { out(`no valid pending request ${id}`); return done(1); }
  if (deny) {
    removePending(root, id);
    try {
      appendAudit(root, { ts: now.toISOString(), sessionId: 'approve-cli', actor: who, tool: p.tool, class: p.class, decision: 'denied_by_human',
        object: p.object, package: p.package, inputHash: p.inputHash, profile: 'proxy', reason: 'pending request rejected', clientId: p.clientId });
    } catch { /* best effort */ }
    out(`rejected and removed pending request ${id}`);
    return done(0);
  }
  const policy = loadPolicy(root);
  out('Approving:'); out(describe(p));
  if (p.tool === 'ReleaseTransport') {
    const ev = readEvidence(root);
    const missing = Object.entries(ev).filter(([, e]) => e.transport && p.target && e.transport.toLowerCase() === p.target.toLowerCase() && e.status !== 'passed');
    if (missing.length) out(`WARNING: ${missing.length} tracked object(s) lack passed QA evidence; the proxy will still deny the release until they pass.`);
  }
  if (!confirm(prompt, id, out)) return done(3);
  try {
    const a = grantApproval(root, policy, id, who, now);
    try {
      appendAudit(root, { ts: now.toISOString(), sessionId: 'approve-cli', actor: who, tool: p.tool, class: p.class, decision: 'approval_granted',
        object: p.object, package: p.package, inputHash: p.inputHash, approver: who, profile: 'proxy', clientId: p.clientId });
    } catch { /* best effort */ }
    out(`\nApproved by ${who}. Single use, bound to this exact input and client, valid until ${a.expires}. The agent may now repeat the identical call.`);
    return done(0);
  } catch (e) {
    out(`cannot approve: ${(e as Error).message}`);
    return done(1);
  }
}

if (import.meta.main) {
  const r = run(process.argv.slice(2));
  console.log(r.out);
  process.exit(r.code);
}
