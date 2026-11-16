// @version 1.2.0
// v1.2.0 (U-20261116-013, spec docs/designs/2026-11-17-root-machinery-batch-design.md §1):
//           generalize tombstoning from date-session rows to every MEMORY.md link the run
//           breaks. v1.1.0 only tombstoned `[date](date.md)` rows for date-named session
//           logs; non-date files (e.g. meeting-*.md) were archived with no index repair,
//           leaving dangling rows that verify-memory Check 3c could only WARN about
//           forever. Non-date index links whose target is archived in this run are now
//           rewritten to the index's existing manual tombstone token
//           `*(archived — local only)*` (owner default O-6) — the link token only, table
//           pipes/labels/surrounding cells untouched; no repointing (content-equivalent
//           repoints stay a human editorial call; Check 3c remains the WARN backstop for
//           links this script did not create). Date-session rows keep the plain-date
//           tombstone. Pure core (tombstoneIndex) exported for unit pinning.
// v1.1.0 (T-20260917-review): tombstone the archived session's MEMORY.md row.
//           Archiving a session log used to leave its `[date](date.md)` link in
//           memory/MEMORY.md pointing at a deleted file — the verify-memory
//           dead-link regression test then failed on the next CI run (real case:
//           2026-09-09, archived by dev-sync step 3.96b, row left as a link).
//           The row is now rewritten as a link-free tombstone, matching the
//           convention documented at the top of memory/MEMORY.md.
/**
 * Archives memory markdown files older than 7 days and tombstones their
 * memory/MEMORY.md index rows: `[date](date.md)` session rows become plain-text
 * dates, and every other index link broken by the run becomes
 * `*(archived — local only)*` (the index's existing manual tombstone convention).
 * @version 1.2.0
 */
import * as fs from "node:fs";
import * as path from "node:path";

export const TOMBSTONE_TOKEN = "*(archived — local only)*";

export interface TombstoneResult {
  /** The rewritten index content. */
  index: string;
  /** Number of `[date](date.md)` session rows rewritten to plain dates. */
  sessionRows: number;
  /** Number of non-date index links rewritten to TOMBSTONE_TOKEN. */
  links: number;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Pure tombstone rewriter for a MEMORY.md index.
 *
 * - A date-named session row `[date](date.md)` is replaced by the plain date
 *   (the documented link-free tombstone convention for the Sessions section).
 * - Any other `[text](<file>.md)` link whose exact flat target `<file>` was
 *   archived in this run is replaced by TOMBSTONE_TOKEN — the link token only:
 *   table pipes, surrounding cells and other columns are untouched. Links with
 *   path segments or fragment anchors (e.g. `archive/x.md`, `../docs/adr/…`,
 *   `x.md#anchor`) are never matched, so targets outside `memory/` and targets
 *   not archived by this run stay untouched.
 */
export function tombstoneIndex(index: string, archivedSessions: string[], archivedOthers: string[]): TombstoneResult {
  let out = index;
  let sessionRows = 0;
  let links = 0;
  for (const date of archivedSessions) {
    const linkRe = new RegExp(`\\[(${date})\\]\\(${date}\\.md\\)`, "g");
    out = out.replace(linkRe, (_match, d: string) => {
      sessionRows++;
      return d;
    });
  }
  for (const file of archivedOthers) {
    const linkRe = new RegExp(`\\[([^\\]]*)\\]\\(${escapeRegExp(file)}\\)`, "g");
    out = out.replace(linkRe, () => {
      links++;
      return TOMBSTONE_TOKEN;
    });
  }
  return { index: out, sessionRows, links };
}

const memoryDir = "memory";
const archiveDir = path.join(memoryDir, "archive");
const memoryIndexPath = path.join(memoryDir, "MEMORY.md");

function main(): void {
  if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true });
  }

  const files = fs.readdirSync(memoryDir);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Date-named session logs tombstone to plain dates; every other archived file
  // tombstones via the TOMBSTONE_TOKEN link rewrite.
  const archivedSessions: string[] = [];
  const archivedOthers: string[] = [];

  for (const file of files) {
    if (!file.endsWith(".md")) continue;
    if (file === "MEMORY.md") continue;

    const fullPath = path.join(memoryDir, file);
    if (fs.statSync(fullPath).isDirectory()) continue;

    const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})\.md$/);
    let fileDate: Date;
    if (dateMatch) {
      fileDate = new Date(dateMatch[1]);
    } else {
      fileDate = fs.statSync(fullPath).mtime;
    }

    const diffTime = today.getTime() - fileDate.getTime();
    const diffDays = diffTime / (1000 * 3600 * 24);

    if (diffDays > 7) {
      fs.renameSync(fullPath, path.join(archiveDir, file));
      if (dateMatch) archivedSessions.push(dateMatch[1]);
      else archivedOthers.push(file);
      console.log(`Archived ${file}`);
    }
  }

  // Tombstone MEMORY.md rows for everything just archived:
  // - date-named session rows: `[date](date.md)` → plain-text date (link-free
  //   rows are the documented tombstone convention in memory/MEMORY.md);
  // - any other link broken by this run → `*(archived — local only)*` (the
  //   index's existing manual tombstone convention for Meetings/ADR rows).
  if ((archivedSessions.length > 0 || archivedOthers.length > 0) && fs.existsSync(memoryIndexPath)) {
    const index = fs.readFileSync(memoryIndexPath, "utf-8");
    const result = tombstoneIndex(index, archivedSessions, archivedOthers);
    if (result.sessionRows > 0 || result.links > 0) {
      fs.writeFileSync(memoryIndexPath, result.index, "utf-8");
      if (result.sessionRows > 0) console.log(`Tombstoned ${result.sessionRows} session row(s)`);
      if (result.links > 0) console.log(`Tombstoned ${result.links} index link(s)`);
    }
  }
}

if (import.meta.main) main();
