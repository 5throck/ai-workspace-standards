#!/usr/bin/env bun
/**
 * sap-action-audit.ts — PostToolUse hook for vsp MCP tools (matcher `mcp__abap__.*`).
 * Appends an audit record (hashes only), updates the evidence store
 * (memory/audit/sap-evidence.json, entries HMAC-signed). R3 approvals are consumed by the MCP proxy only.
 * Never throws and never blocks: a failure here must not break the session.
 * Design: docs/designs/2026-10-10-sap-write-safety-gate-design.md
 *
 * @version 2.0.0
 */

import {
  CHAIN, TOOL_PREFIX, actorOf, appendAudit, classify, derivePackage, effectiveInput,
  firstString, inputHash, isHyperfocused, loadPolicy, objectKey, profileOf, readEvidence, recomputeStatus,
  resolveHyperfocused, resolveToolName, sha256, writeEvidence, type Evidence, type HookInput,
} from '../lib/sap-action-lib.ts';

const FAIL_RE = /"success"\s*:\s*false|"isError"\s*:\s*true|\b[1-9]\d*\s+(failed|failures|errors?)\b|\b(failed|failures|errors?)\s*[:=]\s*[1-9]|syntax error|not activated/i;

export function qaResultOf(response: unknown): 'pass' | 'fail' {
  if (response && typeof response === 'object' && (response as any).isError === true) return 'fail';
  const text = typeof response === 'string' ? response : JSON.stringify(response ?? '');
  return FAIL_RE.test(text) ? 'fail' : 'pass';
}

/** Overrides used by the MCP proxy, which owns approvals and runs for every client. */
export interface RecordOpts { decision?: string; approver?: string; profile?: string; clientId?: string; grantId?: string; grantRow?: string }

function recordHyperfocused(input: HookInput, root: string, now: Date, opts: RecordOpts = {}): void {
  const policy = loadPolicy(root);
  const h = resolveHyperfocused(input.tool_input, policy);
  const ti = effectiveInput(input.tool_input);
  const cls = h.cls ?? '?';
  const ts = now.toISOString();
  const evidence = readEvidence(root);
  const decision = 'allow';
  let qaResult: string | undefined;
  const approver: string | undefined = undefined;
  const pkg = h.packages[0] ?? h.keys.map((k) => evidence[k]?.package).find(Boolean);

  if (cls === 'R2') {
    const keys = h.tool === 'system.add_transport_object' || h.tool === 'system.remove_transport_object' ? h.objects : h.keys;
    let changed = false;
    for (const key of keys) {
      const e: Evidence = evidence[key] ?? { chain: {}, status: 'pending' };
      if (h.write) e.lastWriteTs = ts;
      if (pkg) e.package = pkg;
      if (h.transport && h.tool !== 'system.remove_transport_object') e.transport = h.transport;
      if (h.tool === 'system.remove_transport_object' && e.transport === h.transport) delete e.transport;
      e.status = recomputeStatus(e);
      evidence[key] = e;
      changed = true;
    }
    if (changed) writeEvidence(root, evidence);
  } else if (cls === 'R1') {
    qaResult = qaResultOf(input.tool_response);
    let changed = false;
    for (const step of h.evidence) {
      for (const key of h.keys) {
        const e: Evidence = evidence[key] ?? { chain: {}, status: 'pending' };
        e.chain[step] = { ts, result: qaResult as 'pass' | 'fail' };
        e.status = recomputeStatus(e);
        evidence[key] = e;
        changed = true;
      }
    }
    if (changed) writeEvidence(root, evidence);
  }

  const src = firstString(ti, ['source', 'new_string', 'content']);
  const before = firstString(ti, ['old_string', 'old_source']);
  const resp = input.tool_response as any;
  const respSrc = typeof resp?.source === 'string' ? resp.source : undefined;
  appendAudit(root, {
    ts, sessionId: input.session_id ?? 'unknown', actor: actorOf(input), tool: h.tool, class: cls, decision: opts.decision ?? decision,
    object: h.keys[0], package: pkg, inputHash: inputHash(ti),
    beforeHash: before ? sha256(before) : undefined,
    afterHash: src ? sha256(src) : respSrc ? sha256(respSrc) : undefined,
    qaResult, approver: opts.approver ?? approver, transport: h.transport, profile: opts.profile ?? profileOf(), clientId: opts.clientId, grantId: opts.grantId, grantRow: opts.grantRow,
  });
}

export function record(input: HookInput, root: string, now: Date = new Date(), opts: RecordOpts = {}): void {
  if (!(input.tool_name ?? '').startsWith(TOOL_PREFIX)) return;
  if (isHyperfocused(input.tool_name!)) return recordHyperfocused(input, root, now, opts);
  const ti = effectiveInput(input.tool_input);
  const tool = resolveToolName(input.tool_name!, ti);
  const policy = loadPolicy(root);
  const cls = classify(tool, policy) ?? '?';
  const ts = now.toISOString();
  const key = objectKey(ti);
  const evidence = readEvidence(root);
  const pkg = derivePackage(ti, evidence);
  const transport = firstString(ti, ['transport', 'transport_number', 'transportNumber', 'request']);
  const decision = 'allow';
  let qaResult: string | undefined;
  const approver: string | undefined = undefined;

  if (cls === 'R2' && key) {
    const e: Evidence = evidence[key] ?? { chain: {}, status: 'pending' };
    if (tool.toLowerCase() === 'activate' || tool.toLowerCase() === 'addtotransport') {
      if (transport) e.transport = transport;
    } else {
      e.lastWriteTs = ts;
    }
    if (pkg) e.package = pkg;
    if (transport) e.transport = transport;
    e.status = recomputeStatus(e);
    evidence[key] = e;
    writeEvidence(root, evidence);
  } else if (cls === 'R1') {
    qaResult = qaResultOf(input.tool_response);
    const step = CHAIN.find((c) => c.toLowerCase() === tool.toLowerCase());
    if (step && key) {
      const e: Evidence = evidence[key] ?? { chain: {}, status: 'pending' };
      e.chain[step] = { ts, result: qaResult as 'pass' | 'fail' };
      e.status = recomputeStatus(e);
      evidence[key] = e;
      writeEvidence(root, evidence);
    }
  }

  const src = firstString(ti, ['source', 'new_string', 'content']);
  const before = firstString(ti, ['old_string', 'old_source']);
  const resp = input.tool_response as any;
  const respSrc = typeof resp?.source === 'string' ? resp.source : undefined;
  appendAudit(root, {
    ts, sessionId: input.session_id ?? 'unknown', actor: actorOf(input), tool, class: cls, decision: opts.decision ?? decision,
    object: key, package: pkg, inputHash: inputHash(ti),
    beforeHash: before ? sha256(before) : undefined,
    afterHash: src ? sha256(src) : respSrc ? sha256(respSrc) : undefined,
    qaResult, approver: opts.approver ?? approver, transport, profile: opts.profile ?? profileOf(), clientId: opts.clientId, grantId: opts.grantId, grantRow: opts.grantRow,
  });
}

async function main(): Promise<void> {
  try {
    const input = JSON.parse(await Bun.stdin.text()) as HookInput;
    record(input, input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd());
  } catch { /* never block the session */ }
}

if (import.meta.main) await main();
