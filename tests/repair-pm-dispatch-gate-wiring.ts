#!/usr/bin/env bun
/**
 * repair-pm-dispatch-gate-wiring.ts — one-shot L3 settings repair for spec
 * 2026-10-17-pm-dispatch-gate-design §7 (Addendum 2026-10-22 drift findings).
 *
 * - Projects/co-newbiz/.claude/settings.json: restore the managed PreToolUse
 *   gate entry deleted by an uncommitted working-tree edit (HEAD form restored,
 *   first PreToolUse position, matcher "Agent").
 * - Projects/co-learning/.claude/settings.json: append the same entry.
 * - Projects/co-learning/.gemini/settings.json: append the BeforeTool gate group
 *   (fleet form: matcher-less group, timeout 5000, same as templates/common).
 *
 * Idempotent: files already carrying a pm-dispatch-gate command under the target
 * event are skipped. --dry-run prints the plan without writing.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DRY = process.argv.includes('--dry-run');

const CLAUDE_ENTRY = {
  matcher: 'Agent',
  hooks: [
    {
      type: 'command',
      command: 'bun scripts/hooks/pm-dispatch-gate.ts',
      timeout: 10,
      statusMessage: 'Checking PM dispatch policy...',
    },
  ],
};

const GEMINI_GROUP = {
  hooks: [
    {
      type: 'command',
      command: 'bun scripts/hooks/pm-dispatch-gate.ts',
      timeout: 5000,
    },
  ],
};

interface Job {
  rel: string;
  event: string;
  entry: unknown;
  position: 'first' | 'append';
}

const JOBS: Job[] = [
  { rel: 'Projects/co-newbiz/.claude/settings.json', event: 'PreToolUse', entry: CLAUDE_ENTRY, position: 'first' },
  { rel: 'Projects/co-learning/.claude/settings.json', event: 'PreToolUse', entry: CLAUDE_ENTRY, position: 'first' },
  { rel: 'Projects/co-learning/.gemini/settings.json', event: 'BeforeTool', entry: GEMINI_GROUP, position: 'append' },
];

function hasGate(groups: Array<Record<string, unknown>>): boolean {
  return groups.some((g) =>
    Array.isArray(g.hooks) &&
    (g.hooks as Array<Record<string, unknown>>).some(
      (h) => typeof h.command === 'string' && h.command.includes('pm-dispatch-gate'),
    ),
  );
}

let repaired = 0;
for (const job of JOBS) {
  const abs = join(ROOT, job.rel);
  const doc = JSON.parse(readFileSync(abs, 'utf-8')) as { hooks?: Record<string, unknown> };
  doc.hooks ??= {};
  const list = Array.isArray(doc.hooks[job.event])
    ? (doc.hooks[job.event] as Array<Record<string, unknown>>)
    : (doc.hooks[job.event] = []);
  if (hasGate(list)) {
    console.log(`SKIP (already wired)  ${job.rel} ${job.event}`);
    continue;
  }
  if (job.position === 'first') list.unshift(job.entry);
  else list.push(job.entry);
  if (!DRY) writeFileSync(abs, `${JSON.stringify(doc, null, 2)}\n`, 'utf-8');
  console.log(`${DRY ? 'WOULD REPAIR' : 'REPAIRED'}          ${job.rel} ${job.event} (${job.position})`);
  repaired += 1;
}
console.log(`\n${DRY ? 'dry-run: ' : ''}repaired=${repaired} skipped=${JOBS.length - repaired}`);
