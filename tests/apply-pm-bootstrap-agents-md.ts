#!/usr/bin/env bun
/**
 * apply-pm-bootstrap-agents-md.ts — one-shot applier for spec
 * 2026-10-22-pm-role-bootstrap-agents-md (docs/designs/2026-10-22-pm-role-bootstrap-agents-md-design.md).
 *
 * Inserts (1) a disclaimer exception line and (2) the "§0: PM Role Bootstrap"
 * section into every AGENTS.md at L0, templates/common (L1), templates/co-*
 * (L2), and Projects/co-* (L3). Idempotent: files already carrying the §0
 * heading are skipped. --dry-run prints the plan without writing.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DRY = process.argv.includes('--dry-run');

const EXCEPTION_LINE =
  '> **Exception**: §0 (PM Role Bootstrap) below **is** a binding behavioral instruction for the current session — on every platform, including tools that auto-load only this file.';

const SECTION = `## §0: PM Role Bootstrap (binding on all platforms)

> **🚨 Binding instruction — every tool, every session**: Unlike the registry above, this section **is** directed at you, the AI agent reading this file. It applies on every platform, including tools that auto-load only this file and never see \`CLAUDE.md\` / \`GEMINI.md\` / \`CODEX.md\` / \`HERMES.md\`.

1. **Role**: You ARE the PM agent for this session. Before your first response, Read [\`agents/pm.md\`](agents/pm.md) with the Read tool and follow it at all times. Re-read it after context is cleared or compacted.
2. **Governance enforcement**: All multi-step tasks (2+ files or 2+ sequential steps) must strictly adhere to the PM Gateway workflow: display the execution plan table first (task | agent | tier | model | platform), only then dispatch specialist agents, and never bypass the PM workflow — direct specialist invocation is forbidden.
3. **PM execution scope**: PM is an escalation gateway, not an executor — it never performs Write/Edit on any file except \`memory/*.md\` and \`CHANGELOG.md\`.
4. **Q&A exemption**: Single-turn Q&A and read-only analysis need no execution plan table. Multi-step work always does.
5. **Precedence**: \`CLAUDE.md\`, \`GEMINI.md\`, \`CODEX.md\`, and \`HERMES.md\` carry the same role declaration for their platforms; where your platform does not auto-load them, this section is the authoritative declaration.`.split('\n');

function targets(): string[] {
  const list: string[] = ['AGENTS.md', 'templates/common/AGENTS.md'];
  for (const dir of ['templates', 'Projects']) {
    const abs = join(ROOT, dir);
    if (!existsSync(abs)) continue;
    for (const entry of readdirSync(abs).sort()) {
      if (!entry.startsWith('co-')) continue;
      const rel = join(dir, entry, 'AGENTS.md');
      if (existsSync(join(ROOT, rel))) list.push(rel);
    }
  }
  return list;
}

function apply(rel: string): string {
  const abs = join(ROOT, rel);
  const lines = readFileSync(abs, 'utf-8').split('\n');
  if (lines.some((l) => l.startsWith('## §0: PM Role Bootstrap'))) return 'SKIP (already has §0)';
  const start = lines.findIndex((l) => /^> \*\*(?:🚨|⚠️)?\s*For AI tools reading this file\*\*/.test(l));
  if (start === -1) return 'SKIP (no disclaimer anchor)';
  let end = start;
  while (end + 1 < lines.length && lines[end + 1].startsWith('>')) end += 1;
  const next = [...lines.slice(0, end + 1), EXCEPTION_LINE, '', ...SECTION, ...lines.slice(end + 1)];
  if (!DRY) writeFileSync(abs, next.join('\n'), 'utf-8');
  return DRY ? 'WOULD APPLY' : 'APPLIED';
}

let applied = 0;
let skipped = 0;
for (const rel of targets()) {
  const result = apply(rel);
  console.log(`${result.padEnd(16)} ${rel}`);
  if (result.startsWith('APPLIED') || result.startsWith('WOULD')) applied += 1;
  else skipped += 1;
}
console.log(`\n${DRY ? 'dry-run: ' : ''}applied=${applied} skipped=${skipped}`);
