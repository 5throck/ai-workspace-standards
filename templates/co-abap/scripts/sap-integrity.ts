#!/usr/bin/env bun
/**
 * sap-integrity.ts — human CLI for the SAP safety integrity manifest.
 *
 * Usage: bun scripts/sap-integrity.ts init      create the HMAC key (if missing) and sign the manifest
 *        bun scripts/sap-integrity.ts sign      re-sign after a reviewed change to the policy or enforcement code
 *        bun scripts/sap-integrity.ts verify    read-only check (exit 1 on mismatch); safe for agents
 *        bun scripts/sap-integrity.ts verify-audit   verify the HMAC chain of memory/audit/sap-actions-*.jsonl
 * Options: --root <dir> (workspace whose config/sap-action-policy.json is covered; default: this repo)
 *
 * The manifest (~/.config/co-abap/manifests/<repo-hash>.json) holds SHA-256 hashes of the policy and of
 * sap-action-lib.ts, sap-mcp-proxy.ts, sap-approve.ts, the gate/audit hooks and this script, HMAC-signed with
 * ~/.config/co-abap/approval.key. init/sign read a confirmation from /dev/tty (type "sign").
 * When the manifest does not match, the proxy only allows hardcoded read-only calls.
 *
 * @version 1.0.0
 */

import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  auditDir, computeHashes, ensureKey, loadKey, manifestPath, signManifest, verifyAuditFile, verifyIntegrity,
} from './lib/sap-action-lib.ts';
import { osUser, ttyPrompt, type Prompt } from './sap-approve.ts';

const CODE_DIR = resolve(import.meta.dir, '..');

export function run(argv: string[], codeDir: string = CODE_DIR, now: Date = new Date(), prompt: Prompt = ttyPrompt): { code: number; out: string } {
  const lines: string[] = [];
  const out = (s: string) => lines.push(s);
  const done = (code: number) => ({ code, out: lines.join('\n') });
  let root = codeDir;
  let cmd: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root') root = resolve(argv[++i] ?? root);
    else if (!argv[i].startsWith('-') && !cmd) cmd = argv[i];
    else { out(`unknown argument ${argv[i]}`); return done(2); }
  }
  if (cmd === 'verify') {
    const r = verifyIntegrity(root, codeDir);
    out(r.ok ? `integrity OK (${manifestPath(root)})` : `integrity FAILED: ${r.reason}`);
    return done(r.ok ? 0 : 1);
  }
  if (cmd === 'verify-audit') {
    const key = loadKey(root);
    if (!key) { out('approval key unavailable'); return done(1); }
    let bad = 0;
    let files: string[] = [];
    try { files = readdirSync(auditDir(root)).filter((f) => /^sap-actions-.*\.jsonl$/.test(f)).sort(); } catch { /* none */ }
    for (const f of files) {
      const r = verifyAuditFile(join(auditDir(root), f), key);
      out(`${f}: ${r.ok ? 'OK' : `BROKEN at line ${r.badLine} (${r.reason})`}`);
      if (!r.ok) bad++;
    }
    if (!files.length) out('no audit files');
    return done(bad ? 1 : 0);
  }
  if (cmd === 'init' || cmd === 'sign') {
    const hashes = computeHashes(root, codeDir).files;
    const prev = verifyIntegrity(root, codeDir);
    out(`Signing integrity manifest for ${root}`);
    for (const [k, h] of Object.entries(hashes)) out(`  ${h.slice(0, 16)}  ${k}${prev.mismatched.includes(k) ? '   (CHANGED)' : ''}`);
    out('Review these files (git diff) before signing: a signed manifest makes the proxy trust them.');
    const typed = prompt('\nType "sign" to sign the manifest: ');
    if (typed === null) { out('refusing: no interactive terminal (/dev/tty) available; signing is for humans.'); return done(3); }
    if (typed !== 'sign') { out('aborted.'); return done(3); }
    try {
      ensureKey(root);
      const m = signManifest(root, codeDir, osUser(), now);
      out(`signed ${manifestPath(root)} at ${m.signedAt} by ${m.signer}`);
      return done(0);
    } catch (e) { out(`cannot sign: ${(e as Error).message}`); return done(1); }
  }
  out('usage: bun scripts/sap-integrity.ts init|sign|verify|verify-audit [--root <dir>]');
  return done(2);
}

if (import.meta.main) {
  const r = run(process.argv.slice(2));
  console.log(r.out);
  process.exit(r.code);
}
