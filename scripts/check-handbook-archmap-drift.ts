#!/usr/bin/env bun
// @version 1.0.0
// check-handbook-archmap-drift.ts — handbook architecture-map drift check
// (spec docs/designs/2026-11-07-handbook-archmap-drift-check-design.md).
//
// The canonical map is docs/architecture/workspace-architecture{,.en,.es,.ja}.svg.
// Two handbook clones under Handbooks/ embed copies in two forms:
//   (a) asset files  docs/assets/img/workspace-architecture{,.en,.es,.ja}.svg
//       — compared byte-for-byte (sha256), no normalization;
//   (b) an inline <svg> in docs/appendix/<page>{,_en,_es,_ja}.html
//       — only the BODY (lines strictly between the root <svg ...viewBox...>
//       open line and the first later line starting with </svg>) is compared
//       with the canonical body. The page's own root tag attributes
//       (width/role/aria-label/lang/font-family) are never compared.
// Inline normalization (both sides, nothing else): \r\n and \r -> \n; trailing
// spaces/tabs removed per line; trailing empty lines removed.
//
// Prints one PASS / DRIFT line per copy. Handbooks/ (or a handbook dir) absent
// -> SKIP, never a failure: the handbooks are gitignored sibling clones that
// GitHub CI and git worktrees do not have.
//
// Usage:
//   bun scripts/check-handbook-archmap-drift.ts [--json] [--root <dir>] [--handbooks <dir>]
//     --root       workspace root holding docs/architecture/ (default: script's parent dir)
//     --handbooks  handbook parent dir (default: <root>/Handbooks)
//
// Exit codes: 0 = all PASS or SKIP; 1 = one or more DRIFT;
//             2 = usage error or missing canonical file (repository fault).

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const LOCALES = [
  { id: 'ko', assetSuffix: '', pageSuffix: '' },
  { id: 'en', assetSuffix: '.en', pageSuffix: '_en' },
  { id: 'es', assetSuffix: '.es', pageSuffix: '_es' },
  { id: 'ja', assetSuffix: '.ja', pageSuffix: '_ja' },
] as const;

export const HANDBOOKS = [
  { dir: 'intro-to-ai-harness', page: 'G_Workspace_Architecture' },
  { dir: 'multi-agent-harness-handbook', page: 'E_Workspace_Architecture' },
] as const;

export type Status = 'PASS' | 'DRIFT' | 'SKIP';
export interface CopyResult {
  handbook: string;
  locale: string;
  form: 'asset' | 'inline' | 'handbook';
  path: string;
  status: Status;
  detail: string;
}

/** Normalize a body for comparison: line endings, per-line trailing whitespace,
 *  trailing empty lines. Nothing else. */
export function normalizeBody(lines: string[]): string {
  const out = lines.join('\n').replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/[ \t]+$/, ''));
  while (out.length > 0 && out[out.length - 1] === '') out.pop();
  return out.join('\n');
}

/** Body of a canonical SVG file: lines strictly between the root <svg open line
 *  (an optional leading <?xml ...?> line is skipped) and the final </svg> line.
 *  Returns null when the file does not have that shape. */
export function canonicalBody(text: string): string | null {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
  let start = 0;
  if (lines[0]?.trim().startsWith('<?xml')) start = 1;
  if (!lines[start]?.trim().startsWith('<svg')) return null;
  if (lines[lines.length - 1]?.trim() !== '</svg>' || lines.length - 1 <= start) return null;
  return normalizeBody(lines.slice(start + 1, lines.length - 1));
}

/** Body of the inline map in an appendix page: lines strictly between the first
 *  line that opens an <svg element with a viewBox attribute and the first later
 *  line whose trimmed text starts with </svg>. Returns null when not found or
 *  when the extracted body itself contains an <svg open tag (ambiguous). */
export function inlineBody(html: string): string | null {
  const lines = html.replace(/\r\n?/g, '\n').split('\n');
  const start = lines.findIndex((l) => /<svg\b[^>]*\bviewBox=/.test(l));
  if (start < 0) return null;
  let end = -1;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].trim().startsWith('</svg>')) { end = i; break; }
  }
  if (end < 0) return null;
  const body = lines.slice(start + 1, end);
  if (body.some((l) => /<svg\b/.test(l))) return null;
  return normalizeBody(body);
}

function sha256(buf: Buffer | string): string {
  return createHash('sha256').update(buf).digest('hex');
}

export interface CheckOptions { root: string; handbooksDir?: string }
export interface CheckReport { results: CopyResult[]; drift: number; skipped: boolean; error?: string }

export function checkDrift(opts: CheckOptions): CheckReport {
  const canonicalDir = join(opts.root, 'docs', 'architecture');
  const handbooksDir = opts.handbooksDir ?? join(opts.root, 'Handbooks');
  const results: CopyResult[] = [];

  // Canonical files are tracked in this repository: missing = repository fault.
  const canonical = new Map<string, { bytes: Buffer; body: string }>();
  for (const loc of LOCALES) {
    const p = join(canonicalDir, `workspace-architecture${loc.assetSuffix}.svg`);
    if (!existsSync(p)) return { results, drift: 0, skipped: false, error: `canonical file missing: ${p}` };
    const bytes = readFileSync(p);
    const body = canonicalBody(bytes.toString('utf8'));
    if (body === null) return { results, drift: 0, skipped: false, error: `canonical file has no <svg>...</svg> root shape: ${p}` };
    canonical.set(loc.id, { bytes, body });
  }

  if (!existsSync(handbooksDir)) {
    results.push({ handbook: '*', locale: '*', form: 'handbook', path: handbooksDir, status: 'SKIP', detail: 'Handbooks/ absent (gitignored sibling clones; not present in CI or worktrees)' });
    return { results, drift: 0, skipped: true };
  }

  for (const hb of HANDBOOKS) {
    const hbDir = join(handbooksDir, hb.dir);
    if (!existsSync(hbDir)) {
      results.push({ handbook: hb.dir, locale: '*', form: 'handbook', path: hbDir, status: 'SKIP', detail: 'handbook dir absent' });
      continue;
    }
    for (const loc of LOCALES) {
      const can = canonical.get(loc.id)!;

      const assetRel = join('docs', 'assets', 'img', `workspace-architecture${loc.assetSuffix}.svg`);
      const assetPath = join(hbDir, assetRel);
      if (!existsSync(assetPath)) {
        results.push({ handbook: hb.dir, locale: loc.id, form: 'asset', path: assetRel, status: 'DRIFT', detail: 'copy missing' });
      } else {
        const same = sha256(readFileSync(assetPath)) === sha256(can.bytes);
        results.push({ handbook: hb.dir, locale: loc.id, form: 'asset', path: assetRel, status: same ? 'PASS' : 'DRIFT', detail: same ? 'sha256 equal' : 'sha256 differs from canonical' });
      }

      const pageRel = join('docs', 'appendix', `${hb.page}${loc.pageSuffix}.html`);
      const pagePath = join(hbDir, pageRel);
      if (!existsSync(pagePath)) {
        results.push({ handbook: hb.dir, locale: loc.id, form: 'inline', path: pageRel, status: 'DRIFT', detail: 'page missing' });
        continue;
      }
      const body = inlineBody(readFileSync(pagePath, 'utf8'));
      if (body === null) {
        results.push({ handbook: hb.dir, locale: loc.id, form: 'inline', path: pageRel, status: 'DRIFT', detail: 'no single inline <svg viewBox> map found' });
      } else {
        const same = body === can.body;
        results.push({ handbook: hb.dir, locale: loc.id, form: 'inline', path: pageRel, status: same ? 'PASS' : 'DRIFT', detail: same ? 'inline body equals canonical body' : 'inline body differs from canonical body' });
      }
    }
  }
  return { results, drift: results.filter((r) => r.status === 'DRIFT').length, skipped: results.every((r) => r.status === 'SKIP') };
}

function main(): void {
  const args = process.argv.slice(2);
  let root = resolve(import.meta.dir, '..');
  let handbooksDir: string | undefined;
  let jsonOut = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--json') jsonOut = true;
    else if (a === '--root' && args[i + 1]) root = resolve(args[++i]);
    else if (a === '--handbooks' && args[i + 1]) handbooksDir = resolve(args[++i]);
    else if (a === '--help' || a === '-h') {
      console.log('Usage: bun scripts/check-handbook-archmap-drift.ts [--json] [--root <dir>] [--handbooks <dir>]');
      process.exit(0);
    } else {
      console.error(`check-handbook-archmap-drift: unknown or incomplete argument: ${a}`);
      process.exit(2);
    }
  }

  const report = checkDrift({ root, handbooksDir });
  if (jsonOut) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    if (report.error) console.error(`check-handbook-archmap-drift: ERROR — ${report.error}`);
    for (const r of report.results) {
      const where = r.form === 'handbook' ? r.path : `${r.handbook}/${r.path}`;
      console.log(`${r.status.padEnd(5)} ${r.form.padEnd(8)} ${r.locale.padEnd(2)} ${where} — ${r.detail}`);
    }
    if (!report.error) {
      const pass = report.results.filter((r) => r.status === 'PASS').length;
      const skip = report.results.filter((r) => r.status === 'SKIP').length;
      console.log(`\ncheck-handbook-archmap-drift: ${pass} pass, ${report.drift} drift, ${skip} skip`);
    }
  }
  process.exit(report.error ? 2 : report.drift > 0 ? 1 : 0);
}

if (import.meta.main) main();
