#!/usr/bin/env bun
// @version 1.9.1
// v1.9.1 (2026-10-04): provenance comment path updated — docs/superpowers/specs moved under docs/archive/superpowers (docs consolidation).
// v1.9.0 (2026-10-04, spec docs/designs/2026-10-04-ticket-archive-design.md): `archive`
//           subcommand — a done ticket dwells >= 7 days (--days N) then moves into
//           <store>/archive (service: tickets/archive, governance: tickets/governance/archive).
//           Dry-run by default, --apply executes, --restore <id> reverses one move.
//           `list --archived` scans the archive directories; ids resolve through the store's
//           archive fallback so `show` keeps working after archiving; doctor reports the count.
// v1.8.0 (2026-10-02, T-20261002-010 M10): list — upstream listings sort flagged tickets first, mark them [FLAGGED], and print inbox/ready/flagged counts (design §9 L3).
// v1.7.0 (2026-10-01, T-20261001-017): `show` falls back to readTicketRaw when schema
//           validation fails — a corrupt/hand-edited ticket renders with a loud banner
//           instead of an opaque schema error (repair path for the upstream flow).
// v1.6.0 (2026-10-01, T-20261001-016): `triage` and `resolve` subcommands — PM writes
//           upstream.triage / upstream.resolution without hand-editing YAML (§3.12);
//           TICKET_WORKSPACE_ROOT env is a test seam (pattern: UPSTREAM_INSTALL_HOME).
// v1.5.2 (2026-10-01, security review): boundary escaping runs on an NFKC-folded copy and neutralizes
//           angle-bracket lookalikes that NFKC does not fold.
// v1.5.1 (2026-10-01): boundary-tag escaping is case-insensitive, whitespace-tolerant and
//           escapes every `<untrusted-upstream-request` variant; opening tag carries id/project/flagged
//           attributes (design §9 L3); non-upstream `title` guarded in show.
// @l2-propagate: false
// ticket.ts — CLI for the Phase A Service Ticket + Kanban system (workspace root only).
// Usage: bun scripts/ticket.ts <command> [args]
//   move <id>: <id> may be bare (resolved against both stores; ambiguous ids error)
//   or explicitly prefixed as service/<id> / governance/<id> (T-20261001-009).
//   show <id>: display full ticket with upstream request boundary tags when present.
// Design: docs/archive/superpowers/specs/2026-07-16-service-ticket-kanban-design.md,
//         docs/designs/2026-08-16-governance-backlog-design.md (not_before / --ready / --kind),
//         docs/designs/2026-10-01-upstream-request-mcp-design.md (§14.1)

import { resolve, join, dirname } from 'node:path';
import {
  createTicket, listTickets, moveTicket, nextServiceTicket, staleRunningTickets, loadCatalog, DEFAULT_ATTEMPTS_CAP,
  resolveTicketLocation, readTicket, readTicketRaw, setUpstreamTriage, setUpstreamResolution,
  archiveDirFor, archiveCandidates, archiveTickets, restoreTicket, DEFAULT_ARCHIVE_DAYS,
} from './helpers/ticket-store.ts';
import { dump } from 'js-yaml';
import type { Priority, Status, Kind, Ticket } from './helpers/ticket-schema.ts';

// Test seam (T-20261001-016): TICKET_WORKSPACE_ROOT redirects the tickets/ root for
// subprocess CLI tests — same pattern as the installer's UPSTREAM_INSTALL_HOME.
// Never set it in normal operation; the default is always the script's own workspace.
const workspaceRoot = process.env.TICKET_WORKSPACE_ROOT
  ? resolve(process.env.TICKET_WORKSPACE_ROOT)
  : resolve(import.meta.dir, '..');
// Service tickets: ephemeral execution-queue instances (tickets/*.yaml is gitignored — Task 8).
const ticketsDir = join(workspaceRoot, 'tickets');
// Manual (Governance Backlog) tickets: deliberately git-tracked so deferred decisions survive
// across sessions/machines. `tickets/*.yaml` only ignores direct children, not this subdirectory —
// see docs/designs/2026-08-16-governance-backlog-design.md.
const governanceDir = join(ticketsDir, 'governance');
const catalogPath = join(workspaceRoot, 'services.yaml');

/** kind: manual tickets live in governanceDir; kind: service tickets live in ticketsDir.
 * Used by commands (move) that take only an id, not a kind. Delegates to the
 * store-level resolver (T-20261001-009): a bare id present in BOTH stores is
 * ambiguous and errors; `service/<id>` / `governance/<id>` pick one explicitly. */
function resolveTicketDir(id: string): { dir: string; id: string } {
  const loc = resolveTicketLocation(ticketsDir, governanceDir, id);
  return { dir: loc.dir, id: loc.id };
}

const [, , cmd, ...rest] = process.argv;

const BOOLEAN_FLAGS = new Set(['manual', 'force', 'json', 'html', 'ready', 'confirm-reviewed', 'archived', 'apply']);

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

/** Angle-bracket lookalikes that NFKC leaves untouched (NFKC itself folds U+FF1C/FF1E, U+FE64/FE65). */
const OPEN_LOOKALIKES = /[\u2039\u27E8\u27EA\u276E\u2329\u3008\u300A\u276C\u29FC\u02C2\u1438\u2770\uFF1C\uFE64]/g;
const CLOSE_LOOKALIKES = /[\u203A\u27E9\u27EB\u276F\u232A\u3009\u300B\u276D\u29FD\u02C3\u1433\u2771\uFF1E\uFE65]/g;

function escapeBoundaryTags(s: string): string {
  // Display-only fold: compatibility forms (fullwidth etc.) become ASCII so they cannot dodge the
  // tag match; lookalike brackets are neutralized outright. Then any boundary tag variant is escaped.
  const folded = s.normalize('NFKC').replace(OPEN_LOOKALIKES, '&lt;').replace(CLOSE_LOOKALIKES, '&gt;');
  return folded.replace(/<(\s*\/?\s*untrusted-upstream-request)/gi, '&lt;$1');
}

function formatUpstreamBlock(ticket: Ticket): string {
  if (!ticket.upstream) return '';
  const u = ticket.upstream;
  const lines: string[] = [];

  if (u.flagged) lines.push('🚩 FLAGGED - needs human review');

  lines.push(`<untrusted-upstream-request id="${ticket.id}" project="${u.project}" flagged="${u.flagged}">`);
  lines.push(`Project: ${u.project || 'unknown'}`);
  lines.push(`Layer: ${u.suspected_layer}`);
  lines.push(`Triage: ${u.triage}`);
  if (u.triage_reasons && u.triage_reasons.length > 0) {
    lines.push(`Reasons: ${u.triage_reasons.join(', ')}`);
  }
  lines.push('');
  lines.push('Symptom:');
  lines.push(escapeBoundaryTags(u.symptom));
  lines.push('');
  if (u.affected_paths && u.affected_paths.length > 0) {
    lines.push(`Affected paths: ${u.affected_paths.join(', ')}`);
    lines.push('');
  }
  if (u.repro) {
    lines.push('Repro:');
    lines.push(escapeBoundaryTags(u.repro));
    lines.push('');
  }
  if (u.local_workaround_diff) {
    lines.push('Local workaround:');
    lines.push(escapeBoundaryTags(u.local_workaround_diff));
    lines.push('');
  }
  lines.push(`</untrusted-upstream-request>`);

  return lines.join('\n');
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
      const upstreamOnly = flags.upstream === true;
      // --archived swaps the scan sources from the live stores to their archive
      // directories (design 2026-10-04-ticket-archive-design.md); the default
      // listing is unchanged and shows only live tickets.
      const archivedMode = flags.archived === true;
      let tickets = archivedMode
        ? [
          ...(kindFilter === 'manual' ? [] : listTickets(archiveDirFor(ticketsDir))),
          ...(kindFilter === 'service' ? [] : listTickets(archiveDirFor(governanceDir))),
        ]
        : [
          ...(kindFilter === 'manual' ? [] : listTickets(ticketsDir, { ...listFilter, kind: 'service' })),
          ...(kindFilter === 'service' ? [] : listTickets(governanceDir, { ...listFilter, kind: 'manual' })),
        ];
      if (upstreamOnly) {
        tickets = tickets.filter(t => t.upstream !== undefined);
      }
      if (flags.json) console.log(JSON.stringify(tickets, null, 2));
      else {
        // M10 (design §9 L3): flagged tickets sort first and carry a [FLAGGED] prefix;
        // upstream listings end with triage counts.
        const upstream = tickets.filter(t => t.upstream !== undefined);
        if (upstreamOnly && upstream.length > 0) {
          tickets = [...tickets].sort((a, b) => Number(b.upstream?.flagged ?? false) - Number(a.upstream?.flagged ?? false) || a.id.localeCompare(b.id));
        }
        for (const t of tickets) {
          const flaggedMarker = t.upstream?.flagged ? ' [FLAGGED]' : '';
          console.log(`${t.id}  [${t.status}]  ${t.kind === 'service' ? t.service : t.title}  (${t.priority})${t.not_before ? `  not-before:${t.not_before}` : ''}${flaggedMarker}${archivedMode ? '  [ARCHIVED]' : ''}`);
        }
        if (upstreamOnly && upstream.length > 0) {
          const inbox = upstream.filter(t => t.upstream!.triage === 'inbox').length;
          const ready = upstream.filter(t => t.upstream!.triage === 'ready').length;
          console.log(`\n${upstream.length} upstream ticket(s): ${inbox} inbox, ${ready} ready, ${upstream.filter(t => t.upstream!.flagged).length} flagged`);
        }
      }
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
      if (!id || !status) fail('usage: ticket.ts move <id> <status> [--force] [--error "<text>"] [--result "<text>"]');
      // T-20260912-023: closing a ticket requires a non-empty outcome summary.
      // Deliberately NOT bypassable by --force — a forced done without a result
      // would defeat the audit trail the requirement exists to guarantee.
      if (status === 'done') {
        const result = flags.result;
        if (typeof result !== 'string' || result.trim() === '') {
          fail('usage: ticket.ts move <id> done --result "<text>" — moving to done requires a non-empty --result outcome summary (--force does not bypass this)');
        }
      }
      const { dir, id: bareId } = resolveTicketDir(id);
      const moved = moveTicket(dir, bareId, status as Status, { force: Boolean(flags.force), error: flags.error as string | undefined, result: flags.result as string | undefined });
      console.log(`✅ ${id} -> ${moved.status}`);
      break;
    }
    case 'show': {
      const { positional } = parseFlags(rest);
      const id = positional[0];
      if (!id) fail('usage: ticket.ts show <id>');
      const { dir, id: bareId } = resolveTicketDir(id);
      let ticket: Ticket;
      try {
        ticket = readTicket(dir, bareId);
      } catch (err) {
        // T-20261001-017: a corrupt/hand-edited ticket must be visible for repair,
        // not just a schema error. Raw YAML is PM- or requester-authored content —
        // boundary-tag escaped. `doctor` still reports it once repaired fields validate.
        const raw = readTicketRaw(dir, bareId);
        console.log(`\n🚨 CORRUPT TICKET — failed schema validation: ${(err as Error).message}`);
        console.log('   Raw YAML below (NOT validated — repair by hand, then re-check with `bun scripts/ticket.ts show`):');
        console.log(escapeBoundaryTags(dump(raw)));
        break;
      }
      console.log(`\n📋 Ticket: ${ticket.id}`);
      console.log(`   Status: ${ticket.status}`);
      console.log(`   Kind: ${ticket.kind}`);
      console.log(`   Priority: ${ticket.priority}`);
      if (ticket.kind === 'service') {
        console.log(`   Service: ${ticket.service}`);
      } else {
        console.log(`   Title: ${ticket.title}`);
      }
      console.log(`   Created: ${ticket.created_at}`);
      if (ticket.not_before) console.log(`   Not before: ${ticket.not_before}`);
      if (ticket.upstream) {
        console.log('\n--- Upstream Request ---');
        console.log(formatUpstreamBlock(ticket));
      }
      console.log('');
      break;
    }
    case 'triage': {
      // T-20261001-016 — PM triage of an upstream request (§3.12 steps 3/5).
      const { positional, flags } = parseFlags(rest);
      const [id, verdict] = positional;
      if (!id || (verdict !== 'inbox' && verdict !== 'ready')) {
        fail('usage: ticket.ts triage <U-id> <inbox|ready> [--confirm-reviewed] — ready on a flagged ticket requires --confirm-reviewed');
      }
      const { dir, id: bareId } = resolveTicketDir(id);
      const t = setUpstreamTriage(dir, bareId, verdict, { confirmReviewed: flags['confirm-reviewed'] === true });
      console.log(`✅ ${id}: upstream.triage=${verdict}, status=${t.status}`);
      break;
    }
    case 'resolve': {
      // T-20261001-016 — record the PM resolution and close (§3.12 step 8).
      const { positional, flags } = parseFlags(rest);
      const id = positional[0];
      const outcome = flags.outcome as string | undefined;
      const summary = flags.summary as string | undefined;
      const prUrl = flags['pr-url'] as string | undefined;
      const templateVersion = flags['template-version'] as string | undefined;
      if (!id || !outcome || typeof summary !== 'string' || summary.trim() === '') {
        fail('usage: ticket.ts resolve <U-id> --outcome <fixed|rejected|local-only|duplicate> --summary "<text>" [--pr-url <url>] [--template-version <ver>|unreleased]');
      }
      if (!['fixed', 'rejected', 'local-only', 'duplicate'].includes(outcome)) {
        fail(`--outcome must be fixed | rejected | local-only | duplicate (got: ${outcome})`);
      }
      if (prUrl !== undefined && !/^https:\/\/\S+$/.test(prUrl)) {
        fail(`--pr-url must be an https URL (got: ${prUrl})`);
      }
      const { dir, id: bareId } = resolveTicketDir(id);
      const t = setUpstreamResolution(
        dir,
        bareId,
        { outcome: outcome as 'fixed' | 'rejected' | 'local-only' | 'duplicate', pr_url: prUrl, template_version: templateVersion, summary },
        summary,
      );
      console.log(`✅ ${id}: outcome=${outcome}, status=${t.status}, resolution recorded`);
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
      // Scan BOTH ticket populations: the service dir and the manual
      // governance dir — a stuck manual `running` ticket was previously
      // invisible to the staleness check (T-20260926-020e).
      const stale = [
        ...staleRunningTickets(ticketsDir, thresholdMinutes),
        ...staleRunningTickets(governanceDir, thresholdMinutes),
      ];
      if (stale.length === 0) { console.log('No stale running tickets.'); }
      for (const t of stale) console.log(`⚠️  ${t.id} has been running > ${thresholdMinutes}m`);
      // Retry-budget visibility (T-20260926-021): tickets at/over the
      // attempts cap are escalation candidates — the store refuses to
      // re-queue them past the cap, so they need a human decision.
      const capped = [...listTickets(ticketsDir), ...listTickets(governanceDir)]
        .filter(t => t.status !== 'done' && t.attempts >= DEFAULT_ATTEMPTS_CAP);
      if (capped.length === 0) {
        if (stale.length === 0) console.log(`No tickets at/over the retry cap (${DEFAULT_ATTEMPTS_CAP}).`);
      } else {
        console.log(`\nTickets at/over the retry cap (${DEFAULT_ATTEMPTS_CAP}) — escalate or dispose:`);
        for (const t of capped) console.log(`🚧  ${t.id} attempts=${t.attempts} [${t.status}] ${t.kind === 'service' ? t.service : (t.title ?? '').slice(0, 80)}`);
      }
      // Archive visibility (design 2026-10-04-ticket-archive-design.md): archived
      // tickets leave the live stores, so state them here instead of staying silent.
      const archivedCount = listTickets(archiveDirFor(ticketsDir)).length + listTickets(archiveDirFor(governanceDir)).length;
      if (archivedCount > 0) {
        console.log(`\n${archivedCount} archived ticket(s) in tickets/archive and tickets/governance/archive — list with 'list --archived'.`);
      }
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
    case 'archive': {
      // v1.9.0 (design 2026-10-04-ticket-archive-design.md): done tickets leave the
      // live stores after a dwell of DEFAULT_ARCHIVE_DAYS. Dry-run by default —
      // governance tickets are git-tracked, so the operator reviews the plan first.
      const { flags } = parseFlags(rest);
      if (flags.restore !== undefined) {
        const id = String(flags.restore);
        const loc = resolveTicketLocation(ticketsDir, governanceDir, id);
        if (!loc.archived) fail(`${loc.id} is not archived — it is live in ${loc.dir === governanceDir ? 'tickets/governance' : 'tickets'}`);
        // Archived ids resolve to the archive dir (review C1); the live store is its parent.
        const storeDir = dirname(loc.dir);
        restoreTicket(storeDir, loc.id);
        console.log(`✅ ${loc.id} restored: ${loc.dir} -> ${storeDir === governanceDir ? 'tickets/governance' : 'tickets'}`);
        break;
      }
      let days = DEFAULT_ARCHIVE_DAYS;
      if (flags.days !== undefined) {
        if (typeof flags.days !== 'string' || !/^\d+$/.test(flags.days)) {
          fail(`--days must be a non-negative integer, got: ${flags.days}`);
        }
        days = Number(flags.days);
      }
      const stores = [
        { label: 'tickets/governance', dir: governanceDir },
        { label: 'tickets', dir: ticketsDir },
      ];
      const plans = stores.map(s => ({ ...s, list: archiveCandidates(s.dir, days) }));
      const total = plans.reduce((n, p) => n + p.list.length, 0);
      if (total === 0) {
        console.log(`No tickets done >= ${days}d to archive.`);
        break;
      }
      const apply = flags.apply === true;
      for (const p of plans) {
        for (const c of p.list) {
          const label = c.ticket.kind === 'service' ? (c.ticket.service ?? '') : (c.ticket.title ?? '');
          console.log(`${apply ? '📦' : '[dry-run]'}  ${p.label}/${c.ticket.id}  done ${Math.floor(c.ageDays)}d ago  ${label.slice(0, 80)}`);
        }
      }
      if (!apply) {
        console.log(`\n${total} ticket(s) eligible (done >= ${days}d). Re-run with --apply to archive.`);
        break;
      }
      for (const p of plans) archiveTickets(p.dir, days);
      console.log(`\n✅ archived ${total} ticket(s) (done >= ${days}d). tickets/governance/archive is git-tracked — commit the renames.`);
      break;
    }
    default:
      console.log('usage: bun scripts/ticket.ts <create|list|show|next|move|triage|resolve|board|doctor|archive> ...');
      process.exit(cmd ? 1 : 0);
  }
} catch (err) {
  console.error(`❌ ${(err as Error).message}`);
  process.exit(1);
}
