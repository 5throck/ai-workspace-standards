// @version 1.0.0
// v1.0.0 (2026-09-27, spec docs/designs/2026-09-27-auto-template-release-design.md
//          R2-R7): initial release — classifyTemplateChanges() turns the pending
//          `git diff -M template-v<current>..HEAD --name-status -- templates/`
//          rows into a semver release level (no-op | patch | minor |
//          manual-review). D/R/A scoped rows = MINOR, M-only = PATCH, never
//          major. Four manual-review triggers (R6): unknown status code,
//          non-semver templates/VERSION, template-v<current> tag missing while
//          older template-v* tags exist, templates/VERSION inside the pending
//          diff. Release-metadata paths (VERSION / CHANGELOG.md / README.md /
//          README_ko.md) are excluded from classification (R2) but still feed
//          the VERSION trigger (R6d). Pure module — no git subprocess; the
//          runner (scripts/auto-release-template.ts) supplies the rows.
/**
 * template-release-classify.ts
 *
 * Pure decision function for the nightly template auto-release step
 * (ADR-0089 host, between Phase I and Phase II). Mirrors the
 * lib/upgrade-policy.ts precedent: a pure, unit-tested decision module with
 * the git interaction kept in the calling CLI.
 *
 * Scope rule (design R2): only rows under `templates/common/` or a
 * `templates/co-<variant>/` directory are upgrade-delivered and classified. Release metadata at
 * the `templates/` top level is excluded so changelog/README edits never
 * classify as phantom template changes. Exception: `templates/VERSION` in the
 * pending diff is an uncommitted bump signature and forces manual-review
 * (R6d) even though it is excluded from the counts.
 */

/** Release level for the pending template diff. `major` is unreachable by design (R7). */
export type ReleaseLevel = 'no-op' | 'patch' | 'minor' | 'manual-review';

/** git name-status row families the classifier understands. */
export type RowFamily = 'A' | 'M' | 'D' | 'R' | 'other';

export interface ClassifyCounts {
  /** Scoped rows per git status family. */
  added: number;
  modified: number;
  deleted: number;
  renamed: number;
  /** Scoped rows whose status code is outside A/M/D/R### (manual-review). */
  other: number;
  /** Total scoped rows (delivered surface changes only). */
  scopedTotal: number;
  /** Delivered path endpoints touched (rename rows can contribute two). */
  deliveredPaths: number;
  /** Delivered endpoints per top-level directory under templates/ (`common`, `co-abap`, ...). */
  byDir: Record<string, number>;
}

export interface ClassifyOptions {
  /** Current `templates/VERSION` content (trimmed by the caller or here). */
  currentVersion: string;
  /** Whether the `template-v<currentVersion>` tag exists. Default true (unchecked). */
  tagExists?: boolean;
  /** Whether any other `template-v*` tag exists. Default false. */
  otherTemplateTagsExist?: boolean;
}

export interface ClassifyResult {
  level: ReleaseLevel;
  /** Version the release would produce; null when the level is no-op or manual-review. */
  nextVersion: string | null;
  counts: ClassifyCounts;
  /** Human-readable manual-review triggers, one per hit (R6). */
  reasons: string[];
  /** Up to 5 scoped paths per family, for the run-log classification table (R4). */
  samples: { added: string[]; deleted: string[]; renamed: string[]; modified: string[] };
}

/** Release-metadata paths excluded from classification (design R2). */
export const RELEASE_METADATA_PATHS: ReadonlySet<string> = new Set([
  'templates/VERSION',
  'templates/CHANGELOG.md',
  'templates/README.md',
  'templates/README_ko.md',
]);

/** A delivered (upgrade-shipped) template path: common or any co-* variant. */
export function isDeliveredPath(p: string): boolean {
  return /^templates\/common\//.test(p) || /^templates\/co-[^/]+\//.test(p);
}

/** Top-level directory under templates/ for a delivered path (`common`, `co-abap`). */
export function deliveredDir(p: string): string | null {
  const m = /^templates\/(common|co-[^/]+)\//.exec(p);
  return m ? m[1] : null;
}

/** Semver X.Y.Z. */
export function isSemver(v: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(v.trim());
}

/** Bump a semver string. `minor` resets patch, `patch` increments patch. `major` is out of scope here (R7). */
export function bumpVersion(current: string, level: 'patch' | 'minor'): string {
  const [major, minor, patch] = current.trim().split('.').map(Number);
  if (level === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

interface ParsedRow {
  family: RowFamily;
  rawStatus: string;
  /** All paths on the row: one for A/M/D, two (old, new) for R/C. Empty when malformed. */
  paths: string[];
  malformed: boolean;
}

function parseRow(line: string): ParsedRow {
  const fields = line.split('\t');
  const status = fields[0] ?? '';
  if (/^R\d{0,3}$/.test(status) || /^C\d{0,3}$/.test(status)) {
    if (fields.length >= 3) {
      const family: RowFamily = status[0] === 'R' ? 'R' : 'other';
      return { family, rawStatus: status, paths: [fields[1], fields[2]], malformed: false };
    }
    return { family: 'other', rawStatus: status, paths: [], malformed: true };
  }
  if (fields.length >= 2) {
    const known: RowFamily = status === 'A' ? 'A' : status === 'M' ? 'M' : status === 'D' ? 'D' : 'other';
    return { family: known, rawStatus: status, paths: [fields[1]], malformed: false };
  }
  return { family: 'other', rawStatus: status, paths: [], malformed: true };
}

/** True when any path on the row is a delivered path (a rename into/out of the delivered surface counts). */
function rowInScope(row: ParsedRow): boolean {
  return row.paths.some(isDeliveredPath);
}

/**
 * Classify pending template name-status rows into a release level.
 *
 * Rows are the raw tab-separated lines of
 * `git diff -M template-v<current>..HEAD --name-status -- templates/`
 * (e.g. `A\tpath`, `M\tpath`, `D\tpath`, `R100\told\tnew`). Pure — pass the
 * tag-existence facts via options; no git subprocess runs here.
 */
export function classifyTemplateChanges(rows: string[], opts: ClassifyOptions): ClassifyResult {
  const counts: ClassifyCounts = {
    added: 0, modified: 0, deleted: 0, renamed: 0, other: 0, scopedTotal: 0, deliveredPaths: 0, byDir: {},
  };
  const reasons: string[] = [];
  const samples: ClassifyResult['samples'] = { added: [], deleted: [], renamed: [], modified: [] };
  const SAMPLE_LIMIT = 5;

  const currentVersion = opts.currentVersion.trim();
  const versionOk = isSemver(currentVersion);

  const scopedRows: ParsedRow[] = [];

  for (const raw of rows) {
    const line = raw.replace(/\r$/, '');
    if (!line.trim()) continue;
    const row = parseRow(line);

    // R6d: an uncommitted/unlanded VERSION bump signature anywhere in the
    // pending diff forces manual review, even though VERSION is excluded
    // from the classified counts (R2).
    if (row.paths.some((p) => RELEASE_METADATA_PATHS.has(p) && p === 'templates/VERSION')) {
      reasons.push(`templates/VERSION appears in the pending diff (uncommitted bump signature) — reconcile by hand`);
    }

    if (!rowInScope(row)) continue; // out of scope: release metadata or non-delivered path
    scopedRows.push(row);
    counts.scopedTotal += 1;

    switch (row.family) {
      case 'A':
        counts.added += 1;
        if (samples.added.length < SAMPLE_LIMIT) samples.added.push(row.paths[0]);
        break;
      case 'M':
        counts.modified += 1;
        if (samples.modified.length < SAMPLE_LIMIT) samples.modified.push(row.paths[0]);
        break;
      case 'D':
        counts.deleted += 1;
        if (samples.deleted.length < SAMPLE_LIMIT) samples.deleted.push(row.paths[0]);
        break;
      case 'R':
        counts.renamed += 1;
        if (samples.renamed.length < SAMPLE_LIMIT) samples.renamed.push(`${row.paths[0]} -> ${row.paths[1]}`);
        break;
      default:
        counts.other += 1;
        break;
    }
    if (row.family === 'other') {
      reasons.push(`unknown status code '${row.rawStatus}' on scoped row: ${row.malformed ? line : row.paths.join(' -> ')}`);
    }

    for (const p of row.paths) {
      if (!isDeliveredPath(p)) continue;
      counts.deliveredPaths += 1;
      const dir = deliveredDir(p);
      if (dir) counts.byDir[dir] = (counts.byDir[dir] ?? 0) + 1;
    }
  }

  // R6b: templates/VERSION must match X.Y.Z.
  if (!versionOk) {
    reasons.push(`templates/VERSION '${currentVersion}' does not match X.Y.Z`);
  }
  // R6c: previous release incomplete — the current tag is absent while older
  // template tags exist. Absent tag with no older tags is a first release,
  // not an inconsistency.
  if (opts.tagExists === false && opts.otherTemplateTagsExist === true) {
    reasons.push(`tag template-v${currentVersion} does not exist while older template-v* tags do — previous release incomplete, reconcile by hand`);
  }

  // R5 precedence: manual-review beats minor; minor beats patch (R7: major unreachable).
  let level: ReleaseLevel;
  if (reasons.length > 0) level = 'manual-review';
  else if (counts.deleted > 0 || counts.renamed > 0 || counts.added > 0) level = 'minor';
  else if (counts.modified > 0) level = 'patch';
  else level = 'no-op';

  const nextVersion =
    level === 'patch' || level === 'minor' ? bumpVersion(currentVersion, level) : null;

  return { level, nextVersion, counts, reasons, samples };
}
