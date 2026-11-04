#!/usr/bin/env bun
// @version 1.0.0
// ticket-drift.ts — Referenced-id drift check (project-loss-hardening design
// §5.3b, T-20261104-004 item 3): every ticket id CITED in memory/YYYY-MM-DD.md
// (pattern \b[TU]-\d{8}-\d{3,4}\b) must resolve via the ticket store's
// resolveTicketLocation (live stores + both archive directories). The original
// T-20261104-004 filing silently vanished from the store while its id stayed
// cited at memory/2026-11-04.md:175 — a checkable-within-the-session defect
// nobody could detect. Read-only and lock-free by design (the dev-sync step
// runs it FATAL on the path every sync already traverses; `ticket.ts doctor`
// surfaces the same findings as the diagnostic arm). Detection is deliberately
// bounded: only ids matching the citation pattern count — free-text references
// that do not match the id shape are out of scope (design §4-B option C).
//
// L0/L1 delivery note: dev-sync.ts is L0+L1 (byte-identical mirror), so this
// helper ships to templates/common/scripts/helpers. The store module it
// resolves against is L0-only (variant projects carry no ticket.ts and no
// store), so the dependency is loaded through a guarded DYNAMIC import: at L0
// it resolves and the check is fully armed; in a delivered tree the module is
// absent, the load fails, and the check degrades to a documented no-op
// (citation census only, zero findings) instead of false-FATALing every
// variant sync — the step is an L0 surface per the design scope table (§6),
// the L1 mirror carries the code only because its importer is L0+L1.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** One citation pattern match that does not resolve in any store or archive. */
export interface DriftFinding {
  /** The cited ticket id. */
  id: string;
  /** File the citation was found in (as joined from memoryDir, e.g. memory/2026-11-04.md). */
  file: string;
  /** 1-based line number of the citation. */
  line: number;
}

export interface DriftReport {
  /** Total distinct cited ids scanned (deduplicated across files). */
  cited: number;
  /** Cited ids that resolve nowhere — each is a candidate silent-loss event. */
  unresolved: DriftFinding[];
}

/** resolveTicketLocation's shape, structurally typed so this helper never
 * statically depends on the L0-only store module. */
type TicketLocationResolver = (
  serviceDir: string,
  governanceDir: string,
  id: string,
) => unknown;

/** Ticket-id citation shape (same grammar the store enforces at its boundary:
 * T-YYYYMMDD-NNN service/governance tickets and U-YYYYMMDD-NNN upstream
 * requests; 3-4 digit seq, matching TICKET_ID_PATTERN's widened v1.5.0 form). */
const TICKET_ID_CITATION_PATTERN = /\b([TU]-\d{8}-\d{3,4})\b/g;

/** Loads resolveTicketLocation through a guarded dynamic import. At L0 the
 * L0-only store module is present and the check is fully armed; in a delivered
 * L1 tree the module does not exist and the load failure degrades the check to
 * a documented no-op (see the header note). */
async function loadStoreResolver(): Promise<TicketLocationResolver | null> {
  try {
    const mod = (await import('./ticket-store.ts')) as {
      resolveTicketLocation: TicketLocationResolver;
    };
    return mod.resolveTicketLocation;
  } catch {
    return null;
  }
}

/** Scans top-level `memory/*.md` files for ticket-id citations and resolves
 * each against the ticket store (live stores + both archives). A missing
 * memoryDir, serviceDir or governanceDir is not an error: a directory that
 * does not exist simply contributes no citations / no resolutions (variant
 * projects may not have a store yet). Unresolved ids are returned as findings
 * with file+line so triage is mechanical (design §9 risk-table row). */
export async function driftCheck(opts: {
  memoryDir: string;
  serviceDir: string;
  governanceDir: string;
}): Promise<DriftReport> {
  const { memoryDir, serviceDir, governanceDir } = opts;
  // First-seen file:line per distinct id — a repeated citation reports once.
  const cited = new Map<string, { file: string; line: number }>();
  if (existsSync(memoryDir)) {
    for (const entry of readdirSync(memoryDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const filePath = join(memoryDir, entry.name);
      const lines = readFileSync(filePath, 'utf-8').split('\n');
      for (let i = 0; i < lines.length; i++) {
        for (const m of lines[i].matchAll(TICKET_ID_CITATION_PATTERN)) {
          const id = m[1];
          if (!cited.has(id)) cited.set(id, { file: filePath, line: i + 1 });
        }
      }
    }
  }
  const resolve = await loadStoreResolver();
  if (resolve === null) {
    // Delivered tree without the L0-only store machinery: nothing to resolve
    // against, so the check cannot distinguish loss from absence — degrade to
    // a no-op (zero findings) rather than false-FATALing every variant sync.
    return { cited: cited.size, unresolved: [] };
  }
  const unresolved: DriftFinding[] = [];
  for (const [id, where] of cited) {
    try {
      resolve(serviceDir, governanceDir, id);
    } catch {
      unresolved.push({ id, file: where.file, line: where.line });
    }
  }
  return { cited: cited.size, unresolved };
}
