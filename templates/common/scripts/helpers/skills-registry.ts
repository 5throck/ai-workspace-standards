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
 * v1.2.0 (spec 2026-09-25-registry-policy-completeness-design.md W5/R5.1):
 * adds the registry auto-sync machinery — `collectRegistryDrift()`,
 * `listSkillDirs()`, `splitRootRegistry()`, `collectCatalogEntries()`,
 * `collectCatalogDrift()`, `syncVariantExclusiveCatalog()`,
 * `syncGenericRegistry()`, and `collectWorkspaceRegistryFindings()`. Pure
 * compute shared by three consumers: the sync CLI
 * (`scripts/sync-skill-registries.ts`), validate-templates VA-08, and the
 * unit tests. The root registry's `### Variant-Exclusive Skills` section has
 * its own reconcile because its 7th column is the owner-variant list, not
 * `notes`.
 *
 * @version 1.2.0
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

// ── W5: registry auto-sync machinery (spec 2026-09-25-registry-policy- ───────
//    completeness-design.md R5.1). Pure compute shared by the sync CLI,
//    validate-templates VA-08, and the unit tests.

/** One registry-table-vs-frontmatter divergence. */
export interface RegistrySyncFinding {
  /** Human-readable registry surface label, e.g. `templates/common/skills/SKILLS.md`. */
  surface: string;
  /** Skill the finding is about. */
  skill: string;
  kind:
    | 'version-drift'      // row version/last_reviewed != frontmatter
    | 'meta-drift'         // row status/owner != frontmatter
    | 'ghost-row'          // row whose SKILL.md dir does not exist
    | 'missing-row'        // delivered skill with no row
    | 'unparseable'        // dir exists but SKILL.md has no parseable version
    | 'variant-cell'       // catalog row's variant cell != owning variants
    | 'catalog-divergent'; // multi-variant skill with divergent frontmatter
  message: string;
}

/** Directory names under a skills/ tree that carry a SKILL.md (sorted). */
export function listSkillDirs(skillsDir: string): string[] {
  if (!existsSync(skillsDir)) return [];
  return readdirSync(skillsDir)
    .filter((e) => existsSync(join(skillsDir, e, 'SKILL.md')))
    .sort();
}

/**
 * Drift findings for ONE generic registry table (the `notes`-column shape)
 * against the skills tree it documents. Read-only; emits nothing.
 *
 * `dirNames` sharpens row classification when provided: a row whose dir is
 * absent is a `ghost-row`; a dir present but missing from `delivered` has an
 * unparseable frontmatter version — the row is legitimate, kept, and reported
 * fail-closed (VA-07's missing-version stance). Without `dirNames`, rows with
 * no delivered record are all `ghost-row`s.
 */
export function collectRegistryDrift(
  surface: string,
  content: string,
  delivered: Array<{ skill: string; version: string; status?: string; owner?: string; lastReviewed?: string }>,
  dirNames?: string[],
): RegistrySyncFinding[] {
  const findings: RegistrySyncFinding[] = [];
  const { rows } = parseSkillRegistryRows(content);
  const byName = new Map(delivered.map((d) => [d.skill, d]));
  const dirs = dirNames ? new Set(dirNames) : null;

  for (const row of rows.values()) {
    const d = byName.get(row.skill);
    if (!d) {
      if (dirs && !dirs.has(row.skill)) {
        findings.push({ surface, skill: row.skill, kind: 'ghost-row', message: `${surface}: registry row \`${row.skill}\` has no matching SKILL.md directory` });
      } else {
        findings.push({ surface, skill: row.skill, kind: 'unparseable', message: `${surface}: \`${row.skill}\` SKILL.md has no parseable frontmatter version — row kept, values unverifiable` });
      }
      continue;
    }
    const reviewed = d.lastReviewed || row.lastReviewed;
    if (row.version !== d.version || row.lastReviewed !== reviewed) {
      findings.push({ surface, skill: row.skill, kind: 'version-drift', message: `${surface}: \`${row.skill}\` row ${row.version}/${row.lastReviewed} != frontmatter ${d.version}/${d.lastReviewed ?? '—'}` });
    }
    const status = d.status ?? row.status;
    const owner = d.owner ?? row.owner;
    if (status !== row.status || owner !== row.owner) {
      findings.push({ surface, skill: row.skill, kind: 'meta-drift', message: `${surface}: \`${row.skill}\` row status/owner ${row.status}/${row.owner} != frontmatter ${status}/${owner}` });
    }
  }
  for (const d of delivered) {
    if (!rows.has(d.skill)) {
      findings.push({ surface, skill: d.skill, kind: 'missing-row', message: `${surface}: delivered skill \`${d.skill}\` (${d.version}) has no registry row` });
    }
  }
  return findings;
}

/**
 * Split the workspace-root registry into its two sections: the Workspace
 * Skills table (generic `notes`-column rows) and the `### Variant-Exclusive
 * Skills` catalog, whose 7th column is the owner-variant list, not `notes`.
 * The parts reconcile with different functions — parseSkillRegistryRows is
 * section-agnostic, so running the generic reconcile over the whole file
 * would misread catalog rows.
 */
export function splitRootRegistry(content: string): { workspace: string; catalog: string } {
  const normalized = content.replace(/\r\n/g, '\n');
  const match = normalized.match(/^###\s+Variant-Exclusive Skills\b.*(?:\n|$)/m);
  if (!match || match.index === undefined) return { workspace: normalized, catalog: '' };
  return { workspace: normalized.slice(0, match.index), catalog: normalized.slice(match.index) };
}

/** Frontmatter-derived catalog record for one variant-exclusive skill. */
export interface CatalogEntry {
  skill: string;
  version: string;
  status?: string;
  owner?: string;
  lastReviewed?: string;
  /** Sorted unique variant names whose skills/ tree carries this skill. */
  variants: string[];
}

/** Catalog 7th-column value: `co-x only` singular, comma-joined plural. */
export function formatCatalogVariantCell(variants: string[]): string {
  return variants.length === 1 ? `${variants[0]} only` : variants.join(', ');
}

/**
 * Scan `templatesDir`'s `co-*` skills trees for catalog entries. Skills named
 * in `exclude` (the workspace root's own `skills/` dirs) are not catalog
 * material — the catalog documents variant-EXCLUSIVE skills only. A
 * multi-variant skill whose frontmatter diverges across its owners yields a
 * `catalog-divergent` finding, NO entry, and its name lands in
 * `divergentSkills` so callers keep any existing row untouched (the sync
 * never silently picks a winner, and never prunes a row that still documents
 * real variant content). A copy carrying the `catalog-parity: skip`
 * frontmatter marker (VA-03 `mirror-parity: skip` vocabulary) declares the
 * skill a variant-maintained fork: it lands in `skippedSkills`, is excluded
 * from the catalog entirely (the per-variant registries document it), and
 * produces no divergence finding. Skills with no parseable version are
 * skipped (fail-closed reporting for those belongs to the VA-03/VA-07
 * family).
 */
export function collectCatalogEntries(
  templatesDir: string,
  exclude: Set<string>,
): { entries: CatalogEntry[]; divergentSkills: Set<string>; skippedSkills: Set<string>; findings: RegistrySyncFinding[] } {
  const findings: RegistrySyncFinding[] = [];
  const divergentSkills = new Set<string>();
  const skippedSkills = new Set<string>();
  const bySkill = new Map<string, Map<string, { version: string; status?: string; owner?: string; lastReviewed?: string }>>();
  if (!existsSync(templatesDir)) return { entries: [], divergentSkills, skippedSkills, findings };

  for (const variant of readdirSync(templatesDir).sort()) {
    if (!variant.startsWith('co-')) continue;
    const skillsDir = join(templatesDir, variant, 'skills');
    for (const skill of listSkillDirs(skillsDir)) {
      if (exclude.has(skill)) continue;
      const raw = readFileSync(join(skillsDir, skill, 'SKILL.md'), 'utf-8');
      const fm = extractFrontmatterVersionAndReviewed(join(skillsDir, skill, 'SKILL.md'));
      if (!fm.version) continue;
      if (/^catalog-parity:\s*skip\b/m.test(raw)) {
        skippedSkills.add(skill);
        continue;
      }
      if (!bySkill.has(skill)) bySkill.set(skill, new Map());
      bySkill.get(skill)!.set(variant, { version: fm.version, status: fm.status, owner: fm.owner, lastReviewed: fm.last_reviewed || undefined });
    }
  }

  for (const skill of bySkill.keys()) {
    if (skippedSkills.has(skill)) bySkill.delete(skill);
  }

  const entries: CatalogEntry[] = [];
  for (const [skill, byVariant] of bySkill) {
    const variants = [...byVariant.keys()].sort();
    const records = [...byVariant.values()];
    const [base, ...rest] = records;
    const divergent = rest.find(
      (r) =>
        r.version !== base.version ||
        (r.lastReviewed ?? '') !== (base.lastReviewed ?? '') ||
        (r.status ?? '') !== (base.status ?? '') ||
        (r.owner ?? '') !== (base.owner ?? ''),
    );
    if (divergent) {
      const detail = variants.map((v) => `${v}=${byVariant.get(v)!.version}`).join(', ');
      findings.push({
        surface: 'skills/SKILLS.md (Variant-Exclusive)',
        skill,
        kind: 'catalog-divergent',
        message: `skills/SKILLS.md (Variant-Exclusive): \`${skill}\` frontmatter diverges across variants (${detail}) — resolve manually before cataloging`,
      });
      divergentSkills.add(skill);
      continue;
    }
    entries.push({ skill, variants, version: base.version, status: base.status, owner: base.owner, lastReviewed: base.lastReviewed });
  }
  entries.sort((a, b) => a.skill.localeCompare(b.skill));
  return { entries, divergentSkills, skippedSkills, findings };
}

/**
 * Drift findings for the Variant-Exclusive catalog against its entries.
 * `parseSkillRegistryRows` surfaces the catalog's 7th column as `notes` —
 * here that cell carries the owner-variant list. Rows whose skill is in
 * `keepUnmatched` (frontmatter-divergent across variants) are skipped here —
 * `collectCatalogEntries` already reported them as `catalog-divergent`. Rows
 * whose skill is in `skippedSkills` (`catalog-parity: skip` forks) are also
 * skipped — the sync prunes them as part of the accepted disposition, not as
 * drift.
 */
export function collectCatalogDrift(
  surface: string,
  content: string,
  entries: CatalogEntry[],
  keepUnmatched?: Set<string>,
  skippedSkills?: Set<string>,
): RegistrySyncFinding[] {
  const findings: RegistrySyncFinding[] = [];
  const { rows } = parseSkillRegistryRows(content);
  const byName = new Map(entries.map((e) => [e.skill, e]));

  for (const row of rows.values()) {
    if (keepUnmatched?.has(row.skill)) continue;
    if (skippedSkills?.has(row.skill)) continue;
    const entry = byName.get(row.skill);
    if (!entry) {
      findings.push({ surface, skill: row.skill, kind: 'ghost-row', message: `${surface}: catalog row \`${row.skill}\` matches no variant skill directory` });
      continue;
    }
    const reviewed = entry.lastReviewed || row.lastReviewed;
    if (row.version !== entry.version || row.lastReviewed !== reviewed) {
      findings.push({ surface, skill: row.skill, kind: 'version-drift', message: `${surface}: \`${row.skill}\` row ${row.version}/${row.lastReviewed} != frontmatter ${entry.version}/${entry.lastReviewed ?? '—'}` });
    }
    const status = entry.status ?? row.status;
    const owner = entry.owner ?? row.owner;
    if (status !== row.status || owner !== row.owner) {
      findings.push({ surface, skill: row.skill, kind: 'meta-drift', message: `${surface}: \`${row.skill}\` row status/owner ${row.status}/${row.owner} != frontmatter ${status}/${owner}` });
    }
    const expectedCell = formatCatalogVariantCell(entry.variants);
    if (row.notes !== expectedCell) {
      findings.push({ surface, skill: row.skill, kind: 'variant-cell', message: `${surface}: \`${row.skill}\` variant cell "${row.notes}" != owners ${expectedCell}` });
    }
  }
  for (const entry of entries) {
    if (!rows.has(entry.skill)) {
      findings.push({ surface, skill: entry.skill, kind: 'missing-row', message: `${surface}: variant skill \`${entry.skill}\` (${entry.version}, ${entry.variants.join(', ')}) has no catalog row` });
    }
  }
  return findings;
}

/**
 * Converge the Variant-Exclusive catalog in place: prune ghost rows, refresh
 * stale values and variant cells, append missing entries (after the last
 * catalog row). Rows whose skill is in `keepUnmatched`
 * (frontmatter-divergent across variants) are left untouched — their
 * divergence is reported separately and the sync never picks a winner. Rows
 * whose skill is in `skippedSkills` (`catalog-parity: skip` forks) are
 * PRUNED — the accepted disposition removes them from the cross-variant
 * catalog; the per-variant registries document each copy. Pure.
 */
export function syncVariantExclusiveCatalog(
  content: string,
  entries: CatalogEntry[],
  keepUnmatched?: Set<string>,
  skippedSkills?: Set<string>,
): { content: string; updated: string[]; added: string[]; pruned: string[] } {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const { rows } = parseSkillRegistryRows(content);
  const byName = new Map(entries.map((e) => [e.skill, e]));
  const updated: string[] = [];
  const added: string[] = [];
  const pruned: string[] = [];
  const removed = new Set<number>();

  for (const row of rows.values()) {
    if (keepUnmatched?.has(row.skill)) continue;
    if (skippedSkills?.has(row.skill)) {
      removed.add(row.lineIdx);
      pruned.push(row.skill);
      continue;
    }
    const entry = byName.get(row.skill);
    if (!entry) {
      removed.add(row.lineIdx);
      pruned.push(row.skill);
      continue;
    }
    const reviewed = entry.lastReviewed || row.lastReviewed;
    const status = entry.status ?? row.status;
    const owner = entry.owner ?? row.owner;
    const variantCell = formatCatalogVariantCell(entry.variants);
    if (
      row.version !== entry.version ||
      row.lastReviewed !== reviewed ||
      row.status !== status ||
      row.owner !== owner ||
      row.notes !== variantCell
    ) {
      lines[row.lineIdx] = buildSkillRegistryRow({
        skill: row.skill,
        version: entry.version,
        status,
        owner,
        lastReviewed: reviewed,
        removalDate: row.removalDate,
        notes: variantCell,
      });
      updated.push(row.skill);
    }
  }

  const rebuilt = lines.filter((_, i) => !removed.has(i));
  const missing = entries.filter((e) => !rows.has(e.skill));
  if (missing.length > 0) {
    // Insertion point: after the last catalog row of the pruned content (the
    // removals above may have shifted line indices, so re-parse).
    const afterRemoval = parseSkillRegistryRows(rebuilt.join('\n'));
    missing.forEach((entry, i) => {
      const row = buildSkillRegistryRow({
        skill: entry.skill,
        version: entry.version,
        status: entry.status ?? 'active',
        owner: entry.owner,
        lastReviewed: entry.lastReviewed,
        removalDate: '—',
        notes: formatCatalogVariantCell(entry.variants),
      });
      rebuilt.splice(afterRemoval.lastSkillRowIdx + 1 + i, 0, row);
      added.push(entry.skill);
    });
  }

  return { content: rebuilt.join('\n'), updated, added, pruned };
}

/**
 * Converge one generic registry table in memory: prune rows for absent dirs
 * (dir-based keep-set, the scaffold semantics — version-less skills keep
 * their rows), reconcile version/last_reviewed, align status/owner. Pure.
 */
export function syncGenericRegistry(
  content: string,
  skillsDir: string,
): { after: string; pruned: string[]; updated: string[]; added: string[]; aligned: string[] } {
  const keep = new Set(listSkillDirs(skillsDir));
  const delivered = collectDeliveredSkills(skillsDir);
  const prunedStep = pruneSkillRegistryRows(content, keep);
  const reconciledStep = reconcileSkillRegistry(prunedStep.content, delivered);
  const alignedStep = alignSkillRegistryRowsWithFrontmatter(reconciledStep.content, delivered);
  return { after: alignedStep.content, pruned: prunedStep.pruned, updated: reconciledStep.updated, added: reconciledStep.added, aligned: alignedStep.aligned };
}

/**
 * Read-only scan of ALL registry surfaces under a workspace root — the
 * shared core of the sync CLI's `--check` mode and validate-templates VA-08.
 * Surfaces: (1) root Workspace Skills rows, (2) root Variant-Exclusive
 * catalog, (3) the common scaffold seed, (4) each curated variant registry.
 * Absent surfaces contribute nothing, so scaffolded projects (no templates/
 * tree) scan surface 1 only.
 */
export function collectWorkspaceRegistryFindings(root: string): RegistrySyncFinding[] {
  const findings: RegistrySyncFinding[] = [];
  const joinRoot = (...p: string[]) => join(root, ...p);

  const rootSkillsDir = joinRoot('skills');
  const rootRegistryPath = join(rootSkillsDir, 'SKILLS.md');
  if (existsSync(rootRegistryPath)) {
    const content = readFileSync(rootRegistryPath, 'utf-8');
    const { workspace, catalog } = splitRootRegistry(content);
    const rootDirs = listSkillDirs(rootSkillsDir);
    findings.push(...collectRegistryDrift('skills/SKILLS.md (Workspace Skills)', workspace, collectDeliveredSkills(rootSkillsDir), rootDirs));

    const catalogScan = collectCatalogEntries(joinRoot('templates'), new Set(rootDirs));
    findings.push(...catalogScan.findings);
    findings.push(...collectCatalogDrift('skills/SKILLS.md (Variant-Exclusive)', catalog, catalogScan.entries, catalogScan.divergentSkills, catalogScan.skippedSkills));
  }

  const commonSkillsDir = joinRoot('templates', 'common', 'skills');
  const commonRegistryPath = join(commonSkillsDir, 'SKILLS.md');
  if (existsSync(commonRegistryPath)) {
    const content = readFileSync(commonRegistryPath, 'utf-8');
    findings.push(...collectRegistryDrift('templates/common/skills/SKILLS.md', content, collectDeliveredSkills(commonSkillsDir), listSkillDirs(commonSkillsDir)));
  }

  const templatesDir = joinRoot('templates');
  if (existsSync(templatesDir)) {
    for (const variant of readdirSync(templatesDir).sort()) {
      if (!variant.startsWith('co-')) continue;
      const skillsDir = join(templatesDir, variant, 'skills');
      const registryPath = join(skillsDir, 'SKILLS.md');
      if (!existsSync(registryPath)) continue;
      const content = readFileSync(registryPath, 'utf-8');
      findings.push(...collectRegistryDrift(`templates/${variant}/skills/SKILLS.md`, content, collectDeliveredSkills(skillsDir), listSkillDirs(skillsDir)));
    }
  }

  return findings;
}
