// @version 1.0.0
// v1.0.0 (2026-10-01, T-20260930-026 PR-A, ADR-0094 — spec
//          docs/designs/2026-10-01-ci-template-unit-test-job-design.md §6):
//          fail-closed merge of a project's `.github/workflows/ci.yml` with the
//          template. Template-owned jobs stay authoritative; ONLY the region
//          between `# PROJECT-JOBS-BEGIN` / `# PROJECT-JOBS-END` (jobs-level, 2-space
//          indent) is project-owned, and that region is UNTRUSTED input validated
//          after parsing the whole merged file. mergeCiWorkflow/validateCiWorkflow
//          are pure (no fs); fs work is confined to applyCiWorkflowMerge (temp file +
//          re-validate + atomic rename; nothing is written on any error). Text is
//          never re-serialized: project job slices are copied as original text.
//
// YAML parsing uses js-yaml (the repo dependency; the design named the `yaml`
// package's uniqueKeys option, but js-yaml rejects duplicate mapping keys by default).
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { load as yamlLoad, loadAll as yamlLoadAll } from 'js-yaml';

export type CiMergeErrorCode =
  | 'MARKER_COUNT'
  | 'MARKER_ORDER'
  | 'MARKER_INDENT'
  | 'REGION_INDENT'
  | 'YAML_PARSE'
  | 'DUPLICATE_KEY'
  | 'RESERVED_JOB'
  | 'REGION_JOB_PRIVILEGE'
  | 'REGION_TOP_LEVEL'
  | 'FORBIDDEN_TRIGGER'
  | 'TEMPLATE_JOB_DRIFT'
  | 'MIGRATION_UNSAFE';

export interface CiMergeError { code: CiMergeErrorCode; detail: string }

export interface CiMergeResult {
  ok: boolean;
  content: string | null;
  errors: CiMergeError[];
  warnings: string[];
  migrated: string[];
  diff: string | null;
}

export const CI_MARKER_BEGIN = '  # PROJECT-JOBS-BEGIN';
export const CI_MARKER_END = '  # PROJECT-JOBS-END';
export const CI_RESERVED_JOBS = ['audit', 'secret-scan', 'unit-tests'];
const TOP_LEVEL_ALLOWED = ['name', 'on', 'permissions', 'env', 'jobs'];
const REGION_FORBIDDEN_TOP_KEYS = ['on', 'permissions', 'env', 'name', 'jobs'];
const REGION_PRIVILEGE_KEYS = ['permissions', 'environment', 'secrets'];
const MARKER_CODES: CiMergeErrorCode[] = ['MARKER_COUNT', 'MARKER_ORDER', 'MARKER_INDENT'];

const MARKER_LIKE = /^(\s*)#\s*PROJECT-JOBS-(BEGIN|END)\s*$/;
const JOB_KEY = /^ {2}(?:"([^"]+)"|'([^']+)'|([A-Za-z0-9_][A-Za-z0-9_-]*))\s*:(?:\s|$)/;

// ── low-level text scanning ────────────────────────────────────────────────────

const normalizeEol = (text: string): string => text.replace(/\r\n/g, '\n');
const indentOf = (line: string): number => line.length - line.trimStart().length;
const isBlankOrComment = (l: string): boolean => l.trim() === '' || l.trimStart().startsWith('#');

/** Lines that sit inside a `|` / `>` block scalar (opener line excluded). */
function blockScalarMask(lines: string[]): boolean[] {
  const mask = new Array<boolean>(lines.length).fill(false);
  let openerIndent = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (openerIndent >= 0) {
      if (line.trim() === '' || indentOf(line) > openerIndent) { mask[i] = true; continue; }
      openerIndent = -1;
    }
    if (line.trimStart().startsWith('#')) continue;
    if (/(?::|^\s*-)\s+[|>][-+0-9]*\s*(#.*)?$/.test(line)) openerIndent = indentOf(line);
  }
  return mask;
}

interface MarkerScan { begin: number[]; end: number[]; indentBad: number[]; outsideJobs: number[] }

function scanMarkers(lines: string[], mask: boolean[], jobsLine: number): MarkerScan {
  const scan: MarkerScan = { begin: [], end: [], indentBad: [], outsideJobs: [] };
  lines.forEach((line, i) => {
    if (mask[i]) return;
    const m = line.match(MARKER_LIKE);
    if (!m) return;
    (m[2] === 'BEGIN' ? scan.begin : scan.end).push(i);
    if (m[1].length !== 2) scan.indentBad.push(i);
    if (jobsLine < 0 || i < jobsLine) scan.outsideJobs.push(i);
  });
  return scan;
}

const findJobsLine = (lines: string[], mask: boolean[]): number =>
  lines.findIndex((l, i) => !mask[i] && /^jobs\s*:\s*(#.*)?$/.test(l));

function jobsSectionEnd(lines: string[], mask: boolean[], jobsLine: number): number {
  for (let i = jobsLine + 1; i < lines.length; i++) {
    if (!mask[i] && lines[i].trim() !== '' && indentOf(lines[i]) === 0 && !lines[i].startsWith('#')) return i;
  }
  return lines.length;
}

interface JobSlice { key: string; start: number; end: number }

/** Jobs-level keys with their text extents. A job's leading contiguous indent-2
 *  comments attach to it; marker lines and top-level keys terminate a slice. */
function sliceJobs(lines: string[], mask: boolean[], jobsLine: number): JobSlice[] {
  if (jobsLine < 0) return [];
  const jobsEnd = jobsSectionEnd(lines, mask, jobsLine);
  const keys: { key: string; line: number }[] = [];
  for (let i = jobsLine + 1; i < jobsEnd; i++) {
    if (mask[i]) continue;
    const m = lines[i].match(JOB_KEY);
    if (m) keys.push({ key: m[1] ?? m[2] ?? m[3], line: i });
  }
  const isMarker = (i: number): boolean => !mask[i] && MARKER_LIKE.test(lines[i]);
  const starts = keys.map(k => {
    let s = k.line;
    while (s - 1 > jobsLine && /^ {2}#/.test(lines[s - 1]) && !isMarker(s - 1) && !mask[s - 1]) s--;
    return s;
  });
  return keys.map((k, idx) => {
    let end = idx + 1 < keys.length ? starts[idx + 1] : jobsEnd;
    for (let i = k.line + 1; i < end; i++) { if (isMarker(i)) { end = i; break; } }
    return { key: k.key, start: starts[idx], end };
  });
}

const sliceText = (lines: string[], s: JobSlice): string => lines.slice(s.start, s.end).join('\n').replace(/\s+$/, '');
/** Comment/blank-insensitive form, used only for the informational TEMPLATE_JOB_CHANGED warning. */
const sliceCode = (lines: string[], s: JobSlice): string => lines.slice(s.start, s.end).filter(l => !isBlankOrComment(l)).join('\n');

// ── parsing helpers ────────────────────────────────────────────────────────────

function parseYaml(text: string): { value: unknown; error?: CiMergeError } {
  try {
    return { value: yamlLoad(text) };
  } catch (err) {
    const msg = (err as Error).message.split('\n')[0];
    return { value: undefined, error: { code: /duplicated mapping key/i.test(msg) ? 'DUPLICATE_KEY' : 'YAML_PARSE', detail: msg } };
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (isObj(v)) return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(',')}}`;
  return JSON.stringify(v) ?? 'null';
}

/** Anchors / aliases outside block scalars and quoted strings. */
function hasAnchorOrAlias(lines: string[], mask: boolean[]): boolean {
  return lines.some((raw, i) => {
    if (mask[i]) return false;
    const line = raw.replace(/"(?:[^"\\]|\\.)*"|'(?:[^']|'')*'/g, '""').replace(/(^|\s)#.*$/, '');
    return /(^|[\s[{,:-])[&*][A-Za-z0-9_]/.test(line);
  });
}

function hasMultiDoc(text: string, lines: string[], mask: boolean[]): boolean {
  let seenContent = false;
  let leadingMarker = false;
  for (let i = 0; i < lines.length; i++) {
    if (mask[i]) continue;
    const l = lines[i];
    if (/^(---|\.\.\.)(\s|$)/.test(l)) {
      if (l.startsWith('---') && !seenContent && !leadingMarker) { leadingMarker = true; continue; }
      return true;
    }
    if (!isBlankOrComment(l)) seenContent = true;
  }
  try { return yamlLoadAll(text).length > 1; } catch { return false; }
}

function forbiddenTrigger(lines: string[]): string | null {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trimStart().startsWith('#')) continue;
    const m = lines[i].match(/\b(pull_request_target|workflow_run)\b/);
    if (m) return `${m[1]} (line ${i + 1})`;
  }
  return null;
}

// ── validation ─────────────────────────────────────────────────────────────────

/** Parse-level checks that apply to every ci.yml regardless of markers. */
function validateCore(text: string, lines: string[]): CiMergeError[] {
  const errors: CiMergeError[] = [];
  const trigger = forbiddenTrigger(lines);
  if (trigger) errors.push({ code: 'FORBIDDEN_TRIGGER', detail: trigger });
  const whole = parseYaml(text);
  if (whole.error) errors.push(whole.error);
  return errors;
}

/** Validate a merged ci.yml against the template (markers, region, template-job
 *  identity, parse, triggers). Pure. Empty array = valid. */
export function validateCiWorkflow(mergedText: string, templateText: string): CiMergeError[] {
  const text = normalizeEol(mergedText);
  const lines = text.split('\n');
  const mask = blockScalarMask(lines);
  const jobsLine = findJobsLine(lines, mask);
  const scan = scanMarkers(lines, mask, jobsLine);
  const errors: CiMergeError[] = [];

  if (scan.begin.length !== 1 || scan.end.length !== 1) {
    errors.push({ code: 'MARKER_COUNT', detail: `expected exactly one PROJECT-JOBS-BEGIN and one PROJECT-JOBS-END, found ${scan.begin.length} and ${scan.end.length}` });
  } else if (scan.end[0] < scan.begin[0]) {
    errors.push({ code: 'MARKER_ORDER', detail: 'PROJECT-JOBS-END appears before PROJECT-JOBS-BEGIN' });
  }
  if (scan.indentBad.length > 0 || scan.outsideJobs.length > 0) {
    const at = [...new Set([...scan.indentBad, ...scan.outsideJobs])].map(i => i + 1).join(', ');
    errors.push({ code: 'MARKER_INDENT', detail: `markers must sit at jobs-level indent (2 spaces) inside jobs: (line(s) ${at})` });
  }
  errors.push(...validateCore(text, lines));

  const markersOk = errors.every(e => !MARKER_CODES.includes(e.code));
  if (!markersOk) return errors;

  const tplLines = normalizeEol(templateText).split('\n');
  const tplMask = blockScalarMask(tplLines);
  const tplJobs = sliceJobs(tplLines, tplMask, findJobsLine(tplLines, tplMask));
  const reserved = new Set([...CI_RESERVED_JOBS, ...tplJobs.map(j => j.key)]);

  errors.push(...validateRegion(lines.slice(scan.begin[0] + 1, scan.end[0]), reserved));

  const mergedJobs = sliceJobs(lines, mask, jobsLine);
  for (const tj of tplJobs) {
    const mj = mergedJobs.find(j => j.key === tj.key && (j.start < scan.begin[0] || j.start > scan.end[0]));
    if (!mj) errors.push({ code: 'TEMPLATE_JOB_DRIFT', detail: `template-owned job "${tj.key}" is missing or was moved into the project region` });
    else if (sliceText(lines, mj) !== sliceText(tplLines, tj)) errors.push({ code: 'TEMPLATE_JOB_DRIFT', detail: `template-owned job "${tj.key}" is not identical to the template` });
  }
  return errors;
}

function validateRegion(regionLines: string[], reserved: Set<string>): CiMergeError[] {
  const errors: CiMergeError[] = [];
  const mask = blockScalarMask(regionLines);
  const content = regionLines.filter((l, i) => !mask[i] && !isBlankOrComment(l));
  for (const l of content) {
    if (indentOf(l) === 0 && /^(on|permissions|env)\s*:/.test(l)) errors.push({ code: 'REGION_TOP_LEVEL', detail: `region introduces top-level key: ${l.trim()}` });
  }
  if (content.length === 0) return errors;
  if (content.some(l => indentOf(l) < 2) || (content.length > 0 && indentOf(content[0]) !== 2)) {
    errors.push({ code: 'REGION_INDENT', detail: 'region lines must be indented at jobs-level child indentation (2 spaces for job keys)' });
    return errors;
  }

  const parsed = parseYaml(regionLines.join('\n'));
  if (parsed.error) { errors.push(parsed.error); return errors; }
  if (parsed.value === null || parsed.value === undefined) return errors;
  if (!isObj(parsed.value)) { errors.push({ code: 'YAML_PARSE', detail: 'region is not a mapping of jobs' }); return errors; }
  for (const [key, job] of Object.entries(parsed.value)) {
    if (reserved.has(key)) errors.push({ code: 'RESERVED_JOB', detail: `region job "${key}" collides with a template-owned job` });
    if (REGION_FORBIDDEN_TOP_KEYS.includes(key)) errors.push({ code: 'REGION_TOP_LEVEL', detail: `region defines "${key}", a workflow top-level key` });
    if (isObj(job)) {
      for (const pk of REGION_PRIVILEGE_KEYS) {
        if (pk in job) errors.push({ code: 'REGION_JOB_PRIVILEGE', detail: `region job "${key}" sets ${pk}` });
      }
    }
  }
  return errors;
}

// ── merge ──────────────────────────────────────────────────────────────────────

const fail = (errors: CiMergeError[], warnings: string[], diff: string | null): CiMergeResult => {
  const seen = new Set<string>();
  const unique = errors.filter(e => { const k = `${e.code}|${e.detail}`; if (seen.has(k)) return false; seen.add(k); return true; });
  return { ok: false, content: null, errors: unique, warnings, migrated: [], diff };
};

/** Template lines with `regionLines` spliced between its markers; a marker-less
 *  template (pre-PR-B) gets the marker pair appended at the end of its jobs section. */
function templateWithRegion(tplLines: string[], regionLines: string[]): { lines: string[]; error?: CiMergeError } {
  const mask = blockScalarMask(tplLines);
  const jobsLine = findJobsLine(tplLines, mask);
  const scan = scanMarkers(tplLines, mask, jobsLine);
  if (scan.begin.length === 1 && scan.end.length === 1 && scan.begin[0] < scan.end[0] && scan.indentBad.length === 0) {
    return { lines: [...tplLines.slice(0, scan.begin[0] + 1), ...regionLines, ...tplLines.slice(scan.end[0])] };
  }
  if (scan.begin.length + scan.end.length > 0) return { lines: [], error: { code: 'MARKER_COUNT', detail: 'template PROJECT-JOBS markers are malformed' } };
  if (jobsLine < 0) return { lines: [], error: { code: 'MIGRATION_UNSAFE', detail: 'template has no jobs: section' } };
  const jobsEnd = jobsSectionEnd(tplLines, mask, jobsLine);
  let cut = jobsEnd;
  while (cut - 1 > jobsLine && tplLines[cut - 1].trim() === '') cut--;
  const tail = tplLines.slice(jobsEnd);
  const gap = tail.length > 0 && tail[0] !== '' ? [''] : [];
  return { lines: [...tplLines.slice(0, cut), '', CI_MARKER_BEGIN, ...regionLines, CI_MARKER_END, ...gap, ...tail] };
}

interface TopLevelCheck { errors: CiMergeError[]; warnings: string[]; diff: string | null }

/** Safety prelude shared by the marker and legacy paths (refuse, never guess). */
function checkProjectTopLevel(projText: string, projLines: string[], projMask: boolean[], tplText: string, allow: boolean): TopLevelCheck {
  const out: TopLevelCheck = { errors: [], warnings: [], diff: null };
  if (hasAnchorOrAlias(projLines, projMask)) out.errors.push({ code: 'MIGRATION_UNSAFE', detail: 'anchors/aliases present; manual migration needed' });
  if (hasMultiDoc(projText, projLines, projMask)) out.errors.push({ code: 'MIGRATION_UNSAFE', detail: 'multiple YAML documents; manual migration needed' });
  const proj = parseYaml(projText);
  if (proj.error) { out.errors.push(proj.error); return out; }
  if (!isObj(proj.value)) { out.errors.push({ code: 'MIGRATION_UNSAFE', detail: 'workflow is not a mapping; manual migration needed' }); return out; }
  const extra = Object.keys(proj.value).filter(k => !TOP_LEVEL_ALLOWED.includes(k));
  if (extra.length > 0) out.errors.push({ code: 'MIGRATION_UNSAFE', detail: `unknown top-level key(s) ${extra.join(', ')}; manual migration needed` });
  const tplParsed = parseYaml(tplText).value;
  const tplObj = isObj(tplParsed) ? tplParsed : {};
  if ('env' in proj.value && stableStringify(proj.value.env) !== stableStringify(tplObj.env)) {
    out.errors.push({ code: 'MIGRATION_UNSAFE', detail: 'project top-level env differs from the template and would be dropped; manual migration needed' });
  }
  if ('name' in proj.value && proj.value.name !== tplObj.name) out.warnings.push(`workflow name "${String(proj.value.name)}" is replaced by the template name "${String(tplObj.name)}"`);
  const diffLines: string[] = [];
  for (const k of ['on', 'permissions']) {
    const a = stableStringify(proj.value[k]);
    const b = stableStringify(tplObj[k]);
    if (a !== b) diffLines.push(`~ ${k}:`, `-   project:  ${a}`, `+   template: ${b}`);
  }
  if (diffLines.length > 0) {
    out.diff = diffLines.join('\n');
    if (!allow) out.errors.push({ code: 'MIGRATION_UNSAFE', detail: 'project on/permissions differ from the template; review the diff and re-run with --accept-ci-perm-diff to accept the template values' });
  }
  return out;
}

export function mergeCiWorkflow(projectText: string, templateText: string, opts: { allowTriggerPermDiff: boolean }): CiMergeResult {
  const crlf = projectText.includes('\r\n');
  const projText = normalizeEol(projectText);
  const tplText = normalizeEol(templateText);
  const projLines = projText.split('\n');
  const projMask = blockScalarMask(projLines);
  const jobsLine = findJobsLine(projLines, projMask);
  const scan = scanMarkers(projLines, projMask, jobsLine);

  const top = checkProjectTopLevel(projText, projLines, projMask, tplText, opts.allowTriggerPermDiff);
  const errors: CiMergeError[] = [...top.errors];
  const warnings = [...top.warnings];
  const migrated: string[] = [];

  const tplLines = tplText.split('\n');
  const tplMask = blockScalarMask(tplLines);
  const tplJobs = sliceJobs(tplLines, tplMask, findJobsLine(tplLines, tplMask));
  const projJobs = sliceJobs(projLines, projMask, jobsLine);
  const changedWarning = (key: string): string =>
    `TEMPLATE_JOB_CHANGED: project copy of template job "${key}" differed; the project edit is dropped (template-owned)`;

  const hasMarkers = scan.begin.length + scan.end.length > 0;
  let regionLines: string[] = [];
  if (hasMarkers) {
    const markerErrors = validateCiWorkflow(projText, tplText).filter(e => MARKER_CODES.includes(e.code));
    if (markerErrors.length > 0) return fail([...errors, ...markerErrors], warnings, top.diff);
    regionLines = projLines.slice(scan.begin[0] + 1, scan.end[0]);
    // Validate the untrusted region directly so its specific codes surface even when the
    // whole-file parse already failed (e.g. a region job duplicating a template job key).
    const reserved = new Set([...CI_RESERVED_JOBS, ...tplJobs.map(j => j.key)]);
    errors.push(...validateRegion(regionLines, reserved));
    for (const pj of projJobs) {
      const inRegion = pj.start > scan.begin[0] && pj.start < scan.end[0];
      const tj = tplJobs.find(t => t.key === pj.key);
      if (!inRegion && tj && sliceCode(projLines, pj) !== sliceCode(tplLines, tj)) warnings.push(changedWarning(pj.key));
    }
  } else {
    if (jobsLine < 0) {
      errors.push({ code: 'MIGRATION_UNSAFE', detail: 'no jobs: section; manual migration needed' });
    } else {
      const first = projLines.find((l, i) => i > jobsLine && !projMask[i] && !isBlankOrComment(l));
      if (first !== undefined && indentOf(first) !== 2) errors.push({ code: 'MIGRATION_UNSAFE', detail: 'jobs are not indented by 2 spaces; manual migration needed' });
    }
    for (const pj of projJobs) {
      const tj = tplJobs.find(t => t.key === pj.key);
      if (tj) {
        if (sliceCode(projLines, pj) !== sliceCode(tplLines, tj)) warnings.push(changedWarning(pj.key));
      } else {
        migrated.push(pj.key);
        regionLines.push(...projLines.slice(pj.start, pj.end));
      }
    }
  }
  if (errors.length > 0) return fail(errors, warnings, top.diff);

  const needsRegion = hasMarkers || migrated.length > 0;
  let outLines = tplLines;
  if (needsRegion) {
    const built = templateWithRegion(tplLines, regionLines);
    if (built.error) return fail([built.error], warnings, top.diff);
    outLines = built.lines;
  }
  const merged = outLines.join('\n');
  const finalErrors = needsRegion ? validateCiWorkflow(merged, tplText) : validateCore(merged, outLines);
  if (finalErrors.length > 0) return fail(finalErrors, warnings, top.diff);

  return { ok: true, content: crlf ? merged.replace(/\n/g, '\r\n') : merged, errors: [], warnings, migrated, diff: top.diff };
}

// ── filesystem apply (the only fs-touching export) ─────────────────────────────

export interface CiApplyOptions {
  dryRun: boolean;
  allowTriggerPermDiff: boolean;
  /** Test seam: replaces the post-write re-validation. */
  validateWritten?: (writtenText: string, templateText: string) => CiMergeError[];
}

export interface CiApplyOutcome {
  status: 'created' | 'unchanged' | 'updated' | 'would-create' | 'would-update' | 'error';
  result: CiMergeResult | null;
  errors: CiMergeError[];
}

/** Re-validation of the text that was actually written to the temp file. */
function validateWrittenText(written: string, templateText: string): CiMergeError[] {
  const lines = normalizeEol(written).split('\n');
  const hasMarker = lines.some(l => MARKER_LIKE.test(l));
  return hasMarker ? validateCiWorkflow(written, templateText) : validateCore(normalizeEol(written), lines);
}

/** Merge template into projectFile. Writes via temp file + re-validate + atomic
 *  rename; on ANY error nothing is written and no temp file is left behind. */
export function applyCiWorkflowMerge(projectFile: string, templateFile: string, opts: CiApplyOptions): CiApplyOutcome {
  const templateText = readFileSync(templateFile, 'utf8');
  if (!existsSync(projectFile)) {
    if (opts.dryRun) return { status: 'would-create', result: null, errors: [] };
    mkdirSync(dirname(projectFile), { recursive: true });
    const errs = writeValidated(projectFile, templateText, templateText, opts);
    return errs.length > 0 ? { status: 'error', result: null, errors: errs } : { status: 'created', result: null, errors: [] };
  }
  const projectText = readFileSync(projectFile, 'utf8');
  const result = mergeCiWorkflow(projectText, templateText, { allowTriggerPermDiff: opts.allowTriggerPermDiff });
  if (!result.ok || result.content === null) return { status: 'error', result, errors: result.errors };
  if (result.content === projectText) return { status: 'unchanged', result, errors: [] };
  if (opts.dryRun) return { status: 'would-update', result, errors: [] };
  const errs = writeValidated(projectFile, result.content, templateText, opts);
  return errs.length > 0 ? { status: 'error', result, errors: errs } : { status: 'updated', result, errors: [] };
}

function writeValidated(file: string, content: string, templateText: string, opts: CiApplyOptions): CiMergeError[] {
  const tmp = `${file}.tmp-${process.pid}`;
  try {
    writeFileSync(tmp, content, 'utf8');
    const written = readFileSync(tmp, 'utf8');
    if (written !== content) return [{ code: 'YAML_PARSE', detail: 'temp file read-back differs from the merged content' }];
    const errs = (opts.validateWritten ?? validateWrittenText)(written, templateText);
    if (errs.length > 0) return errs;
    renameSync(tmp, file);
    return [];
  } catch (err) {
    return [{ code: 'YAML_PARSE', detail: `write failed: ${(err as Error).message}` }];
  } finally {
    if (existsSync(tmp)) { try { unlinkSync(tmp); } catch { /* best effort */ } }
  }
}
