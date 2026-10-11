#!/usr/bin/env bun
/**
 * sap-action-gate.ts — PreToolUse gate for vsp MCP tools (matcher `mcp__abap__.*`).
 * Classifies each call R0-R3 per config/sap-action-policy.json and emits a
 * permissionDecision (allow | ask | deny). Fails safe: any internal error,
 * malformed stdin or invalid policy yields `ask`, never a silent allow.
 * Denied calls are logged here because PostToolUse does not fire for them.
 * Design: docs/designs/2026-10-10-sap-write-safety-gate-design.md
 *
 * R3 calls never allow here: single-use approvals are owned by the MCP proxy (HMAC-verified, outside the
 * workspace), so evaluate() reports NEEDS_APPROVAL and the proxy consumes a matching signed approval.
 *
 * @version 3.0.0 (advisory; enforcement in the MCP proxy; legacy session approval files removed)
 */

import {
  NEEDS_APPROVAL, TOOL_PREFIX, classify, derivePackage, effectiveInput, firstString,
  globMatch, inspectQuery, isHyperfocused, loadPolicy, readEvidence, resolveHyperfocused,
  resolveToolName,
  type Cls, type Decision, type HfResolved, type HookInput, type Evidence, type Policy,
} from '../lib/sap-action-lib.ts';

export interface GateResult { decision: Decision; reason: string; cls: string; tool: string }

/** `preloaded` lets the proxy pass the policy it already integrity-checked (avoids a re-read race). */
export function evaluate(input: HookInput, root: string, now: Date = new Date(), preloaded?: Policy): GateResult {
  void now;
  const toolName = input.tool_name ?? '';
  if (!toolName.startsWith(TOOL_PREFIX)) {
    return { decision: 'ask', cls: '?', tool: toolName, reason: 'unexpected tool name for SAP gate' };
  }
  const ti = effectiveInput(input.tool_input);
  const tool = resolveToolName(toolName, ti);
  let policy: Policy;
  try { policy = preloaded ?? loadPolicy(root); } catch (e) {
    return { decision: 'ask', cls: '?', tool, reason: `policy unavailable (${(e as Error).message})` };
  }
  if (isHyperfocused(toolName)) return evaluateHyperfocused(input, root, policy, now);
  const cls = classify(tool, policy);
  if (!cls) return { decision: 'ask', cls: '?', tool, reason: 'unclassified tool' };
  const r = (decision: Decision, reason: string): GateResult => ({ decision, reason, cls, tool });
  const evidence = readEvidence(root);

  switch (cls as Cls) {
    case 'R0': {
      if (tool.toLowerCase() === 'runquery' && policy.runQuery.selectOnly) {
        const sql = firstString(ti, ['query', 'sql', 'sql_query', 'sqlQuery', 'statement']);
        const bad = inspectQuery(sql);
        if (bad) return r('deny', `RunQuery rejected: ${bad}`);
      }
      return r('allow', 'read-only');
    }
    case 'R1':
      return r('allow', 'QA execution (evidence recorded by audit hook)');
    case 'R2': {
      const pkg = derivePackage(ti, evidence);
      if (!pkg) return r('ask', 'source write; target package not determinable');
      if (!policy.allowedPackages.some((p) => globMatch(p, pkg))) {
        return r('deny', `package ${pkg} is outside the allowlist`);
      }
      return r('ask', `source write to package ${pkg} requires confirmation`);
    }
    case 'R3': {
      if (tool.toLowerCase() === 'releasetransport') {
        if (policy.release.requireEvidence) {
          const objs = ti.objects;
          if (!Array.isArray(objs) || objs.length === 0 || !objs.every((o) => typeof o === 'string' && o.trim())) {
            return r('deny', 'release requires the full list of transport objects');
          }
          const missing = (objs as string[]).filter((o) => {
            let k = o.trim().toLowerCase();
            try { k = decodeURIComponent(k); } catch { /* keep raw */ }
            return evidence[k]?.status !== 'passed';
          });
          if (missing.length) return r('deny', `${missing.length} object(s) lack passed QA evidence`);
        }
      }
      return r('deny', NEEDS_APPROVAL);
    }
  }
}

function evaluateHyperfocused(input: HookInput, root: string, policy: Policy, _now: Date): GateResult {
  const h: HfResolved = resolveHyperfocused(input.tool_input, policy);
  const cls = h.cls ?? '?';
  const r = (decision: Decision, reason: string): GateResult => ({ decision, reason, cls, tool: h.tool });
  if (h.deny) return r('deny', h.deny);
  if (h.ask || !h.cls) return r('ask', h.ask ?? 'unclassified tool');
  const evidence = readEvidence(root);
  switch (h.cls) {
    case 'R0': return r('allow', 'read-only');
    case 'R1': return r('allow', 'QA execution (evidence recorded by audit hook)');
    case 'R2': {
      let pkgs = h.packages;
      if (!pkgs.length) {
        const ev = h.keys.map((k) => evidence[k]?.package).filter((x): x is string => !!x);
        pkgs = ev;
      }
      if (!pkgs.length) return r('ask', 'source write; target package not determinable');
      const bad = pkgs.find((p) => !policy.allowedPackages.some((a) => globMatch(a, p)));
      if (bad) return r('deny', `package ${bad} is outside the allowlist`);
      return r('ask', `source write to package ${pkgs.join(', ')} requires confirmation`);
    }
    case 'R3': {
      if (h.tool === 'ReleaseTransport') {
        if (policy.release.requireEvidence) {
          if (!h.transport) return r('deny', 'release requires params.transport');
          const objs = releaseObjects(h, evidence);
          if (!objs.length) return r('deny', 'release requires tracked transport objects (none recorded for this transport)');
          const missing = objs.filter((k) => evidence[k]?.status !== 'passed');
          if (missing.length) return r('deny', `${missing.length} object(s) lack passed QA evidence`);
        }
      }
      return r('deny', NEEDS_APPROVAL);
    }
  }
}

/** Objects that must carry passed evidence: those named in the call plus every object recorded against the transport. */
function releaseObjects(h: HfResolved, evidence: Record<string, Evidence>): string[] {
  const set = new Set<string>(h.objects);
  const t = h.transport?.toLowerCase();
  for (const [k, e] of Object.entries(evidence)) if (t && e.transport?.toLowerCase() === t) set.add(k);
  return [...set];
}

/**
 * Advisory output (D1): the SAP MCP proxy (scripts/sap-mcp-proxy.ts) is the single enforcement point for every
 * client, so this hook never asks or denies on its own. It only reports what the policy would decide, and is no
 * longer registered in .claude/settings.json (kept for manual diagnostics: `echo '{...}' | bun scripts/hooks/sap-action-gate.ts`).
 */
function emit(decision: Decision, reason: string): void {
  const note = decision === 'allow'
    ? `advisory: ${reason}`
    : `advisory: policy would ${decision} this call (${reason}); the SAP MCP proxy enforces it`;
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow', permissionDecisionReason: note },
  }) + '\n');
}

async function main(): Promise<void> {
  let input: HookInput = {};
  let root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  try {
    input = JSON.parse(await Bun.stdin.text());
    if (!input || typeof input !== 'object') throw new Error('stdin is not an object');
    root = input.cwd || root;
    const res = evaluate(input, root);
    emit(res.decision, `${res.cls}: ${res.reason}`);
  } catch (e) {
    emit('ask', `gate error: ${(e as Error).message}`);
  }
}

if (import.meta.main) await main();
