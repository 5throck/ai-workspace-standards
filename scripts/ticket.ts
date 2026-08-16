#!/usr/bin/env bun
// @version 1.1.0
// @l2-propagate: false
// ticket.ts — CLI for the Phase A Service Ticket + Kanban system (workspace root only).
// Usage: bun scripts/ticket.ts <command> [args]
// Design: docs/superpowers/specs/2026-07-16-service-ticket-kanban-design.md,
//         docs/designs/2026-08-16-governance-backlog-design.md (not_before / --ready / --kind)

import { resolve, join } from 'node:path';
import { existsSync } from 'node:fs';
import {
  createTicket, listTickets, moveTicket, nextServiceTicket, staleRunningTickets, loadCatalog,
} from './helpers/ticket-store.ts';
import type { Priority, Status, Kind } from './helpers/ticket-schema.ts';

const workspaceRoot = resolve(import.meta.dir, '..');
// Service tickets: ephemeral execution-queue instances (tickets/*.yaml is gitignored — Task 8).
const ticketsDir = join(workspaceRoot, 'tickets');
// Manual (Governance Backlog) tickets: deliberately git-tracked so deferred decisions survive
// across sessions/machines. `tickets/*.yaml` only ignores direct children, not this subdirectory —
// see docs/designs/2026-08-16-governance-backlog-design.md.
const governanceDir = join(ticketsDir, 'governance');
const catalogPath = join(workspaceRoot, 'services.yaml');

/** kind: manual tickets live in governanceDir; kind: service tickets live in ticketsDir.
 * Used by commands (move) that take only an id, not a kind. */
function resolveTicketDir(id: string): string {
  return existsSync(join(governanceDir, `${id}.yaml`)) ? governanceDir : ticketsDir;
}

const [, , cmd, ...rest] = process.argv;

const BOOLEAN_FLAGS = new Set(['manual', 'force', 'json', 'html', 'ready']);

function parseFlags(args: string[]): { positional: string[]; flags: Record<string, string | boolean> } {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const next = args[i + 1];
      if (!BOOLEAN_FLAGS.has(key) && next !== undefined && !next.startsWith('--')) { flags[key] = next; i++; }
      else flags[key] = true;
    } else positional.push(args[i]);
  }
  return { positional, flags };
}

function fail(msg: string): never {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

try {
  switch (cmd) {
    case 'create': {
      const { positional, flags } = parseFlags(rest);
      const priority = (flags.priority as Priority) ?? 'normal';
      if (flags.manual) {
        const title = positional[0];
        if (!title) fail('usage: ticket.ts create --manual "<title>" [--priority low|normal|high|urgent] [--not-before YYYY-MM-DD]');
        const notBefore = flags['not-before'] as string | undefined;
        const t = createTicket(governanceDir, { kind: 'manual', title, priority, not_before: notBefore });
        console.log(`✅ Created manual ticket ${t.id}: ${title}${notBefore ? ` (not before ${notBefore})` : ''}`);
      } else {
        const serviceId = positional[0];
        if (!serviceId) fail('usage: ticket.ts create <service-id> [--priority ...] [--inputs \'{"k":"v"}\']');
        const catalog = loadCatalog(catalogPath);
        if (!catalog.services.some(s => s.id === serviceId)) fail(`unknown service id: ${serviceId} (see services.yaml)`);
        let inputs: Record<string, string> | undefined;
        if (flags.inputs) {
          try { inputs = JSON.parse(flags.inputs as string); }
          catch { fail(`--inputs is not valid JSON: ${flags.inputs}`); }
        }
        const t = createTicket(ticketsDir, { kind: 'service', service: serviceId, priority, inputs });
        console.log(`✅ Created service ticket ${t.id} for '${serviceId}'`);
      }
      break;
    }
    case 'list': {
      const { flags } = parseFlags(rest);
      // --kind and --ready are independent, composable filters (not a bundled mode) — see
      // docs/designs/2026-08-16-governance-backlog-design.md. Service and manual tickets live
      // in separate directories (ephemeral vs. git-tracked); merge both unless --kind narrows it.
      const listFilter = { status: flags.status as Status | undefined, ready: flags.ready === true ? true : undefined };
      const kindFilter = flags.kind as Kind | undefined;
      const tickets = [
        ...(kindFilter === 'manual' ? [] : listTickets(ticketsDir, { ...listFilter, kind: 'service' })),
        ...(kindFilter === 'service' ? [] : listTickets(governanceDir, { ...listFilter, kind: 'manual' })),
      ];
      if (flags.json) console.log(JSON.stringify(tickets, null, 2));
      else for (const t of tickets) console.log(`${t.id}  [${t.status}]  ${t.kind === 'service' ? t.service : t.title}  (${t.priority})${t.not_before ? `  not-before:${t.not_before}` : ''}`);
      break;
    }
    case 'next': {
      const picked = nextServiceTicket(ticketsDir);
      if (!picked) { console.log('No waiting service tickets.'); break; }
      console.log(JSON.stringify(picked, null, 2));
      break;
    }
    case 'move': {
      const { positional, flags } = parseFlags(rest);
      const [id, status] = positional;
      if (!id || !status) fail('usage: ticket.ts move <id> <status> [--force]');
      const moved = moveTicket(resolveTicketDir(id), id, status as Status, { force: Boolean(flags.force), error: flags.error as string | undefined });
      console.log(`✅ ${id} -> ${moved.status}`);
      break;
    }
    case 'doctor': {
      const { flags } = parseFlags(rest);
      let thresholdMinutes = 30;
      if (flags.minutes !== undefined) {
        if (typeof flags.minutes !== 'string' || flags.minutes.trim() === '' || Number.isNaN(Number(flags.minutes))) {
          fail(`--minutes must be a number, got: ${flags.minutes}`);
        }
        thresholdMinutes = Number(flags.minutes);
      }
      const stale = staleRunningTickets(ticketsDir, thresholdMinutes);
      if (stale.length === 0) { console.log('No stale running tickets.'); break; }
      for (const t of stale) console.log(`⚠️  ${t.id} has been running > ${thresholdMinutes}m`);
      break;
    }
    case 'board': {
      const { flags } = parseFlags(rest);
      const tickets = [...listTickets(ticketsDir), ...listTickets(governanceDir)];
      const lanes: Status[] = ['backlog', 'waiting', 'running', 'review', 'done', 'failed'];
      if (flags.html) {
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<title>Ticket Board</title>
<style>body{font-family:sans-serif}.lane{display:inline-block;vertical-align:top;width:180px;margin:8px;padding:8px;border:1px solid #ccc}.card{border:1px solid #999;margin:4px 0;padding:4px;font-size:12px}</style>
</head><body>
${lanes.map(lane => `<div class="lane"><h3>${escapeHtml(lane)}</h3>${tickets.filter(t => t.status === lane).map(t => `<div class="card">${escapeHtml(t.id)}<br>${escapeHtml(t.kind === 'service' ? (t.service ?? '') : (t.title ?? ''))}</div>`).join('')}</div>`).join('')}
</body></html>`;
        console.log(html);
      } else {
        for (const lane of lanes) {
          console.log(`\n## ${lane}`);
          for (const t of tickets.filter(t => t.status === lane)) console.log(`  ${t.id}  ${t.kind === 'service' ? t.service : t.title}`);
        }
      }
      break;
    }
    default:
      console.log('usage: bun scripts/ticket.ts <create|list|next|move|board|doctor> ...');
      process.exit(cmd ? 1 : 0);
  }
} catch (err) {
  console.error(`❌ ${(err as Error).message}`);
  process.exit(1);
}
