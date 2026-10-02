#!/usr/bin/env bun
// @version 1.0.0
// v1.0.0 (2026-10-02, T-20261002-008): governance docs may only name ticket.ts
//           subcommands that exist (review H1 doc-command lint — the §3.12 rewrite
//           shipped `ticket.ts resolve` while the CLI had no such command once, and
//           nothing caught it). Scans the PM-gateway workflow doc and agents/pm.md
//           (L0 + templates/common copies) for `ticket.ts <token>` references and
//           fails on any token that is not a real subcommand.
// @l2-propagate: false
// Design: docs/designs/2026-10-02-upstream-review-backlog-remediations-design.md §B3

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = resolve(SCRIPT_DIR, '..');

/** Extract the subcommand set from ticket.ts's own usage line — the CLI is the SSOT;
 * this lint never hardcodes the list. */
export function ticketSubcommands(ticketTsSource: string): Set<string> {
  const m = /usage: bun scripts\/ticket\.ts <([^>]+)>/.exec(ticketTsSource);
  if (!m) throw new Error('[validate-ticket-doc-commands] could not find the usage line in ticket.ts');
  return new Set(m[1].split('|').map((s) => s.trim()));
}

export interface DocCommandFinding {
  file: string;
  line: number;
  token: string;
}

/** Every `ticket.ts <token>` reference in the given content; tokens are matched as
 * lowercase word chars + dashes (the shape of every real subcommand). */
export function scanTicketDocCommands(content: string): Array<{ line: number; token: string }> {
  const out: Array<{ line: number; token: string }> = [];
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    for (const m of line.matchAll(/ticket\.ts\s+([a-z][a-z0-9-]*)/g)) {
      out.push({ line: idx + 1, token: m[1] });
    }
  });
  return out;
}

export function validateDocCommands(files: Array<{ path: string; content: string }>, subcommands: Set<string>): DocCommandFinding[] {
  const findings: DocCommandFinding[] = [];
  for (const { path, content } of files) {
    for (const { line, token } of scanTicketDocCommands(content)) {
      if (!subcommands.has(token)) findings.push({ file: path, line, token });
    }
  }
  return findings;
}

function main(): void {
  const ticketTs = readFileSync(join(WORKSPACE_ROOT, 'scripts', 'ticket.ts'), 'utf-8');
  const subcommands = ticketSubcommands(ticketTs);
  const docPaths = [
    'docs/governance/agents/pm-gateway-workflow.md',
    'agents/pm.md',
    'templates/common/docs/governance/agents/pm-gateway-workflow.md',
    'templates/common/agents/pm.md',
  ].map((p) => join(WORKSPACE_ROOT, p));
  const files = docPaths
    .filter((p) => existsSync(p))
    .map((p) => ({ path: p, content: readFileSync(p, 'utf-8') }));
  const findings = validateDocCommands(files, subcommands);
  if (findings.length > 0) {
    console.error(`❌ ticket.ts doc-command lint: ${findings.length} reference(s) to non-existent subcommands:`);
    for (const f of findings) console.error(`   ${f.file}:${f.line} — ticket.ts ${f.token}`);
    console.error(`   Existing subcommands: ${[...subcommands].join(', ')}`);
    process.exit(1);
  }
  const refs = files.reduce((n, f) => n + scanTicketDocCommands(f.content).length, 0);
  console.log(`✅ ticket.ts doc-command lint: ${refs} reference(s) across ${files.length} governance doc(s) — all name real subcommands.`);
}

if (import.meta.main) main();
