/**
 * skills-registry.ts — parse and reconcile project-side `skills/SKILLS.md`
 * registry tables (T-20260922-001).
 *
 * Project SKILLS.md files come in several shapes this module deliberately
 * supports:
 *   - a single `## Registry` table (the original format),
 *   - `## Registry` headings that appear more than once (observed in
 *     Projects/co-newbiz — the second heading is a duplication artifact),
 *   - category-sectioned tables (`## Process`, `## Domain`, … — observed in
 *     co-abap/co-consult) where skill rows live under arbitrary `## ` sections.
 *
 * Because of that variety, rows are detected by SHAPE (a table row whose first
 * cell is a backticked skill name and whose second cell looks like a version),
 * not by section heading. All emitted/parsed cell values are quote-stripped so
 * quoted `"date"`/`"version"` cells never survive a reconcile (T-20260922-001).
 *
 * @version 1.0.0
 */

export interface SkillRegistryRow {
  skill: string;
  version: string;
  status: string;
  owner: string;
  lastReviewed: string;
  removalDate: string;
  notes: string;
  lineIdx: number;
}

/** Strip one layer of symmetric double/single quotes from a table cell. */
export function stripCellQuotes(cell: string): string {
  const t = cell.trim();
  if (t.length >= 2 && ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")))) {
    return t.slice(1, -1).trim();
  }
  return t;
}

function looksLikeVersion(cell: string): boolean {
  return /^\d+\.\d+(\.\d+)?/.test(stripCellQuotes(cell));
}

function splitRow(line: string): string[] {
  return line.split('|').map((c) => c.trim());
}

function isTableRow(line: string): boolean {
  return line.trimStart().startsWith('|');
}

/**
 * Scan every line of a SKILLS.md for skill-registry rows (shape-based, any
 * section). Returns rows keyed by skill name (later duplicates overwrite —
 * the last listing wins) plus the index of the last skill-row line, which is
 * the insertion point for missing rows.
 */
export function parseSkillRegistryRows(content: string): {
  rows: Map<string, SkillRegistryRow>;
  lastSkillRowIdx: number;
} {
  const rows = new Map<string, SkillRegistryRow>();
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  let lastSkillRowIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    if (!isTableRow(lines[i])) continue;
    const cells = splitRow(lines[i]);
    if (cells.length < 4) continue;
    const nameMatch = cells[1].match(/^`([^`]+)`$/);
    if (!nameMatch) continue;
    if (!looksLikeVersion(cells[2])) continue; // header row / separator / other tables
    const skill = nameMatch[1];
    rows.set(skill, {
      skill,
      version: stripCellQuotes(cells[2]),
      status: stripCellQuotes(cells[3]),
      owner: stripCellQuotes(cells[4]),
      lastReviewed: stripCellQuotes(cells[5]),
      removalDate: stripCellQuotes(cells[6] ?? '—'),
      notes: stripCellQuotes(cells[7] ?? '—'),
      lineIdx: i,
    });
    lastSkillRowIdx = i;
  }

  return { rows, lastSkillRowIdx };
}

/**
 * Build one SKILLS.md table row. Values are quote-stripped; empty optional
 * cells render as `—` so quoted or empty date cells can never be emitted
 * (T-20260922-001).
 */
export function buildSkillRegistryRow(opts: {
  skill: string;
  version: string;
  status?: string;
  owner?: string;
  lastReviewed?: string;
  removalDate?: string;
  notes?: string;
}): string {
  const clean = (v: string | undefined, fallback = '—') => {
    const s = stripCellQuotes(v ?? '');
    return s === '' ? fallback : s;
  };
  return `| \`${clean(opts.skill)}\` | ${clean(opts.version, '?')} | ${clean(opts.status, 'active')} | ${clean(opts.owner)} | ${clean(opts.lastReviewed)} | ${clean(opts.removalDate)} | ${clean(opts.notes)} |`;
}

/**
 * Reconcile a SKILLS.md with the delivered skill set:
 *   - rows whose version/last_reviewed differ from the delivered frontmatter
 *     are updated in place (values written unquoted),
 *   - delivered skills with NO row are appended after the last skill row,
 *   - skills with a row but no delivered SKILL.md are left untouched
 *     (removal/prune is a separate, explicit operation).
 *
 * Pure: returns the updated content and a per-skill action report without
 * touching the filesystem.
 */
export function reconcileSkillRegistry(
  content: string,
  delivered: Array<{
    skill: string;
    version: string;
    status?: string;
    owner?: string;
    lastReviewed?: string;
  }>,
): { content: string; updated: string[]; added: string[] } {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const { rows, lastSkillRowIdx } = parseSkillRegistryRows(content);
  const updated: string[] = [];
  const added: string[] = [];

  for (const d of delivered) {
    const row = rows.get(d.skill);
    if (row) {
      if (row.version !== d.version || row.lastReviewed !== (d.lastReviewed || row.lastReviewed)) {
        const newReviewed = d.lastReviewed || row.lastReviewed;
        lines[row.lineIdx] = buildSkillRegistryRow({
          skill: row.skill,
          version: d.version,
          status: row.status,
          owner: row.owner,
          lastReviewed: newReviewed,
          removalDate: row.removalDate,
          notes: row.notes,
        });
        updated.push(d.skill);
      }
    } else if (lastSkillRowIdx >= 0) {
      const newRow = buildSkillRegistryRow({
        skill: d.skill,
        version: d.version,
        status: d.status ?? 'active',
        owner: d.owner,
        lastReviewed: d.lastReviewed,
      });
      lines.splice(lastSkillRowIdx + 1 + added.length, 0, newRow);
      added.push(d.skill);
    }
  }

  return { content: lines.join('\n'), updated, added };
}
