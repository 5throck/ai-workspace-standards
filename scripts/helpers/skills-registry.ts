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
 * v1.1.0 (spec 2026-09-24-skills-registry-overlay-reconcile, T-20260924-008):
 * adds the fresh-scaffold half of the shared reconcile machinery —
 * `collectDeliveredSkills()` (scan a delivered skills/ tree's SKILL.md
 * frontmatter, verbatim logic from upgrade-project.ts's delivery loop),
 * `pruneSkillRegistryRows()` (drop rows for skills absent from the delivered
 * tree — the inverse check `skill-lifecycle-audit.ts` enforces, which
 * `reconcileSkillRegistry` deliberately does not), plus the two scaffold
 * placement/alignment passes the fleet E2E forced: `foldVariantExclusiveRowsIntoWorkspaceSection()`
 * (the audit's parser reads only the `### Workspace Skills` section) and
 * `alignSkillRegistryRowsWithFrontmatter()` (status/owner drift, the design
 * §10 remedy applied scaffold-side; `reconcileSkillRegistry` stays frozen for
 * the upgrade path). `extractFrontmatterVersionAndReviewed()` moves here
 * VERBATIM from upgrade-project.ts (which now imports it back) so scaffold and
 * upgrade share one parser.
 *
 * @version 1.1.0
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

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
 * Shape test shared by `parseSkillRegistryRows` and `pruneSkillRegistryRows`:
 * a line is a skill row iff it is a table row whose second cell is a backticked
 * name and whose third cell looks like a version. Returns the split cells or
 * null.
 */
function matchSkillRowCells(line: string): string[] | null {
  if (!isTableRow(line)) return null;
  const cells = splitRow(line);
  if (cells.length < 4) return null;
  if (!cells[1].match(/^`([^`]+)`$/)) return null;
  if (!looksLikeVersion(cells[2])) return null; // header row / separator / other tables
  return cells;
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
    const cells = matchSkillRowCells(lines[i]);
    if (!cells) continue;
    const skill = cells[1].match(/^`([^`]+)`$/)![1];
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

/**
 * Drop registry rows whose skill is not in `keepNames` (T-20260924-008).
 *
 * `reconcileSkillRegistry` deliberately never removes rows (upgrade-path
 * semantics), but the fresh-scaffold seed registry (templates/common/skills/
 * SKILLS.md, 63 rows) lists many skills a scaffold never delivers — region-
 * pruned `k-*`, `l2_propagate: false` sweeps, workspace-root-only skills.
 * Un-pruned, those rows surface as `Registry row has no matching runtime
 * skill` errors in the project's own audit (skill-lifecycle-audit.ts inverse
 * check). The keep-set is the delivered DIR set (dirs containing a SKILL.md),
 * so a delivered skill whose frontmatter lacks a parseable version keeps its
 * seed row — matching the reconcile's version-less skip.
 *
 * Shape detection is the same matcher `parseSkillRegistryRows` uses, applied
 * line-by-line, so duplicate listings of the same pruned skill are all removed.
 *
 * Pure: returns the pruned content and the pruned skill names (line order)
 * without touching the filesystem.
 */
export function pruneSkillRegistryRows(
  content: string,
  keepNames: Iterable<string>,
): { content: string; pruned: string[] } {
  const keep = new Set(keepNames);
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const pruned: string[] = [];
  const kept = lines.filter((line) => {
    const cells = matchSkillRowCells(line);
    if (!cells) return true;
    const skill = cells[1].match(/^`([^`]+)`$/)![1];
    if (keep.has(skill)) return true;
    pruned.push(skill);
    return false;
  });
  return { content: kept.join('\n'), pruned };
}

/**
 * Scan a delivered skills/ directory and collect each `<dir>/SKILL.md`
 * frontmatter as a reconcile delivery record (T-20260924-008). Skills whose
 * frontmatter lacks a parseable `version` are skipped — the same
 * `if (!fm.version) continue` semantics the upgrade path applies
 * (upgrade-project.ts SKILLS_REGISTRY_RECONCILE delivery loop, moved here
 * verbatim so scaffold and upgrade collect identically).
 *
 * Pure filesystem read; returns records in directory-listing order.
 */
export function collectDeliveredSkills(skillsDir: string): Array<{
  skill: string;
  version: string;
  status?: string;
  owner?: string;
  lastReviewed?: string;
}> {
  const delivered: Array<{
    skill: string;
    version: string;
    status?: string;
    owner?: string;
    lastReviewed?: string;
  }> = [];
  if (!existsSync(skillsDir)) return delivered;

  for (const skillName of readdirSync(skillsDir)) {
    const skillMdPath = join(skillsDir, skillName, 'SKILL.md');
    if (!existsSync(skillMdPath)) continue;

    const fm = extractFrontmatterVersionAndReviewed(skillMdPath);
    if (!fm.version) continue;
    delivered.push({
      skill: skillName,
      version: fm.version,
      status: fm.status,
      owner: fm.owner,
      lastReviewed: fm.last_reviewed,
    });
  }

  return delivered;
}

/**
 * Parse SKILL.md frontmatter to extract version and last_reviewed.
 *
 * Verbatim move from upgrade-project.ts (v1.46.1, T-20260924-008) so scaffold
 * and upgrade share one parser; upgrade-project imports it back from here.
 */
export function extractFrontmatterVersionAndReviewed(filePath: string): {
  version: string;
  last_reviewed: string;
  status?: string;
  owner?: string;
} {
  if (!existsSync(filePath)) return { version: '', last_reviewed: '' };
  const content = readFileSync(filePath, 'utf8');
  const versionMatch = content.match(/^version:\s*["']?(\d+\.\d+\.\d+)/m);
  const reviewedMatch = content.match(/^last_reviewed:\s*["']?(\d{4}-\d{2}-\d{2})/m);
  const statusMatch = content.match(/^status:\s*["']?([A-Za-z_-]+)/m);
  const ownerMatch = content.match(/^owner:\s*["']?([^"'\n]+)/m);
  return {
    version: versionMatch?.[1] ?? '',
    last_reviewed: reviewedMatch?.[1] ?? '',
    status: statusMatch?.[1],
    owner: ownerMatch?.[1]?.trim(),
  };
}

/**
 * Fold the seed registry's `### Variant-Exclusive Skills` section into the
 * `### Workspace Skills` section (T-20260924-008, scaffold reconcile placement
 * step).
 *
 * Why: the acceptance audit's registry parser (skill-lifecycle-audit.ts) reads
 * ONLY the `### Workspace Skills` section when the heading exists — rows under
 * `### Variant-Exclusive Skills` are invisible to both of its bijection
 * directions. A delivered variant-exclusive skill whose row stayed in that
 * section reported `Missing skills/SKILLS.md registry row`, so the delivered
 * registry is only audit-correct when every surviving row lives in the
 * Workspace section. The design (D1c) already declares the delivered registry
 * "a pure function of the delivered tree" — post-fold, the template-side
 * section split (which documents variant-exclusivity in the CATALOG) no longer
 * applies to a delivered project's own registry.
 *
 * Behavior: rows under the section keep ALL their cells verbatim (the variant
 * annotation in the last cell becomes the notes cell of the Workspace table —
 * columns are preserved, never rebuilt); the section's heading, prose, and
 * table header are dropped. Files without the heading are returned unchanged,
 * which makes a second run a byte-identical no-op.
 *
 * Pure: no filesystem access.
 */
export function foldVariantExclusiveRowsIntoWorkspaceSection(content: string): {
  content: string;
  moved: number;
} {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const veIdx = lines.findIndex((l) => /^###\s+Variant-Exclusive Skills\b/i.test(l));
  if (veIdx === -1) return { content, moved: 0 };

  // Section span: heading → next `## ` sibling heading (or EOF).
  let sectionEnd = lines.length;
  for (let i = veIdx + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) {
      sectionEnd = i;
      break;
    }
  }

  const movedRows: string[] = [];
  for (let i = veIdx; i < sectionEnd; i++) {
    if (matchSkillRowCells(lines[i])) movedRows.push(lines[i]);
  }

  // Insertion point: directly after the last skill row above the section (the
  // Workspace table's last row) so the moved rows stay attached to that table.
  let insertAt = veIdx;
  for (let i = veIdx - 1; i >= 0; i--) {
    if (matchSkillRowCells(lines[i])) {
      insertAt = i + 1;
      break;
    }
  }

  const next = [
    ...lines.slice(0, insertAt),
    ...movedRows,
    ...lines.slice(insertAt, veIdx),
    ...lines.slice(sectionEnd),
  ];
  return { content: next.join('\n'), moved: movedRows.length };
}

/**
 * Align surviving registry rows' `status` and `owner` cells with the delivered
 * SKILL.md frontmatter (T-20260924-008, scaffold reconcile final pass).
 *
 * Why: the audit flags `Registry status/owner drift` between a row and the
 * delivered SKILL.md frontmatter, but the shared `reconcileSkillRegistry`
 * deliberately updates only version/last_reviewed (upgrade-path semantics,
 * preserved unchanged — see the design's §10 residual risk, which names this
 * exact remedy). The fresh-scaffold path has no committed registry to protect:
 * every surviving row must simply describe the delivered tree, so the scaffold
 * applies the stronger rule locally. Rows whose skill has no delivered record
 * (version-less SKILL.md) are left untouched; `removal-date`/`notes` cells are
 * preserved; version/last_reviewed come from the delivered record (the same
 * values reconcile just wrote).
 *
 * Pure: no filesystem access.
 */
export function alignSkillRegistryRowsWithFrontmatter(
  content: string,
  delivered: Array<{
    skill: string;
    version: string;
    status?: string;
    owner?: string;
    lastReviewed?: string;
  }>,
): { content: string; aligned: string[] } {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const { rows } = parseSkillRegistryRows(content);
  const byName = new Map(delivered.map((d) => [d.skill, d]));
  const aligned: string[] = [];

  for (const row of rows.values()) {
    const d = byName.get(row.skill);
    if (!d) continue;
    const status = d.status ?? row.status;
    const owner = d.owner ?? row.owner;
    if (status === row.status && owner === row.owner) continue;
    lines[row.lineIdx] = buildSkillRegistryRow({
      skill: row.skill,
      version: d.version,
      status,
      owner,
      lastReviewed: d.lastReviewed || row.lastReviewed,
      removalDate: row.removalDate,
      notes: row.notes,
    });
    aligned.push(row.skill);
  }

  return { content: lines.join('\n'), aligned };
}
