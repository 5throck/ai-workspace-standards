#!/usr/bin/env bun
/**
 * apply-adr0102-l1l2-tier-normalization.ts — one-shot applier for ADR-0102
 * (docs/adr/0102-agent-tier-scalar-declaration.md), design
 * 2026-10-26-model-registry-platform-coverage §8 (PR-2a scope: L1 + L2).
 *
 * Replaces legacy map-form `tier:` blocks (per-platform sub-lines) in agent
 * frontmatter with the scalar form `tier: high|medium|low`:
 *   - uniform block  → the block's single consensus value
 *   - mixed block    → the §8.2 co-price table value (mixed files not in the
 *     table are a FAIL — no silent claude-collapse)
 *   - block-less extends-stub whose L1 counterpart is `tier: medium`
 *     (the 4 co-hr/co-news stubs) → `tier: medium` inserted after `name:`
 * Template files (L1/L2) also get a version minor-bump (1.0.0 → 1.1.0,
 * otherwise X.(Y+1).0, quoting style preserved) and `last_updated` refreshed
 * where the key exists, so upgrade-project SYNC_IF_NEWER re-delivers them.
 *
 * Idempotent: files already carrying a scalar tier are SKIP. --dry-run
 * prints the per-file plan without writing. CRLF-safe; UTF-8 enforced.
 * Scope: templates/common/agents + templates/co-[variant]/agents (README
 * excluded; _COMMON.md fragment excluded). Root agents and Projects/co-* are
 * out of scope (root landed in PR-1; projects land via the --projects pass
 * later).
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DRY = process.argv.includes('--dry-run');
const TODAY = '2026-10-27';

const VALID_TIERS = new Set(['high', 'medium', 'low']);
const KNOWN_PLATFORMS = new Set([
  'claude',
  'gemini',
  'antigravity',
  'gemini-cli',
  'codex',
  'hermes',
  'zai',
]);

// Design §8.2 — the 9 co-price mixed blocks, verbatim.
const CO_PRICE_82: Record<string, string> = {
  'cost-asset-mgmt.md': 'high',
  'devops-admin.md': 'high',
  'engagement-director.md': 'high',
  'l10n-auditor.md': 'medium',
  'lead-architect.md': 'high',
  'market-intelligence-analyst.md': 'high',
  'qa-tester.md': 'high',
  'security-auditor.md': 'high',
  'ux-specialist.md': 'high',
};

interface Target {
  rel: string;
  /** Variant name for L2 ('common' for L1) — used for mixed-block lookup. */
  scope: string;
}

function targets(): Target[] {
  const list: Target[] = [];
  const pushDir = (dir: string, scope: string) => {
    const abs = join(ROOT, dir);
    if (!existsSync(abs)) return;
    for (const f of readdirSync(abs).sort()) {
      if (!f.endsWith('.md') || f.startsWith('README') || f === '_COMMON.md') continue;
      list.push({ rel: join(dir, f), scope });
    }
  };
  pushDir('templates/common/agents', 'common');
  for (const entry of readdirSync(join(ROOT, 'templates')).sort()) {
    if (!entry.startsWith('co-')) continue;
    pushDir(join('templates', entry, 'agents'), entry);
  }
  return list;
}

function splitLines(raw: string): { lines: string[]; eol: string; hadCr: boolean } {
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.split('\n').map((l) => (l.endsWith('\r') ? l.slice(0, -1) : l));
  return { lines, eol, hadCr: raw.includes('\r') };
}

/** Minor-bump per the task rule: "1.0.0" → "1.1.0"; X.Y(.Z) → X.(Y+1).0. */
function bumpVersion(v: string): string {
  const m = v.match(/^(\d+)\.(\d+)(?:\.(\d+))?$/);
  if (!m) throw new Error(`unparseable version: ${JSON.stringify(v)}`);
  const [, xs, ys] = m;
  const x = Number(xs);
  const y = Number(ys);
  if (x === 1 && y === 0) return '1.1.0';
  return `${x}.${y + 1}.0`;
}

function tierBlockSpan(lines: string[]): { start: number; end: number } | null {
  const fmStart = lines.findIndex((l) => l.trim() === '---');
  if (fmStart !== 0) throw new Error('no frontmatter open marker on line 1');
  const fmEnd = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
  if (fmEnd === -1) throw new Error('no frontmatter close marker');
  const start = lines.findIndex((l) => l === 'tier:' || /^tier:\s*$/.test(l));
  if (start === -1 || start > fmEnd) return null;
  let end = start;
  while (end + 1 <= fmEnd && /^[ \t]/.test(lines[end + 1])) end += 1;
  return { start, end };
}

function parseBlock(lines: string[], span: { start: number; end: number }): Record<string, string> {
  const map: Record<string, string> = {};
  for (let i = span.start + 1; i <= span.end; i++) {
    const m = lines[i].match(/^[ \t]+([A-Za-z-]+):\s*([^\s#]+)/);
    if (!m) throw new Error(`unparseable tier block line: ${JSON.stringify(lines[i])}`);
    map[m[1]] = m[2];
  }
  return map;
}

function refreshScalar(lines: string[], span: { start: number; end: number }, value: string): string[] {
  const next = [...lines];
  next.splice(span.start, span.end - span.start + 1, `tier: ${value}`);
  return next;
}

/** Insert `tier: <value>` after the `name:` line (block-less stubs). */
function insertScalar(lines: string[], value: string): string[] {
  const idx = lines.findIndex((l) => /^name:\s/.test(l));
  if (idx === -1) throw new Error('no tier block and no name: anchor for stub insert');
  return [...lines.slice(0, idx + 1), `tier: ${value}`, ...lines.slice(idx + 1)];
}

function bumpVersionInLines(lines: string[], eol: string): { lines: string[]; from?: string; to?: string } {
  const idx = lines.findIndex((l) => /^version:\s*/.test(l));
  if (idx === -1) return { lines };
  const cur = lines[idx].match(/^version:\s*(.*)$/)![1].trim();
  const quoted = cur.startsWith('"') || cur.startsWith("'");
  const q = quoted ? '"' : '';
  const nextVer = bumpVersion(cur.replace(/^["']|["']$/g, ''));
  const next = [...lines];
  next[idx] = `version: ${q}${nextVer}${q}`;
  return { lines: next, from: cur, to: `${q}${nextVer}${q}` };
}

function refreshLastUpdated(lines: string[]): { lines: string[]; changed: boolean } {
  const idx = lines.findIndex((l) => /^last_updated:\s*/.test(l));
  if (idx === -1) return { lines, changed: false };
  const cur = lines[idx].match(/^last_updated:\s*(.*)$/)![1].trim();
  const quoted = cur.startsWith('"') || cur.startsWith("'");
  const q = quoted ? '"' : '';
  const bare = cur.replace(/^["']|["']$/g, '');
  if (bare === TODAY) return { lines, changed: false };
  const next = [...lines];
  next[idx] = `last_updated: ${q}${TODAY}${q}`;
  return { lines: next, changed: true };
}

let applied = 0;
let skipped = 0;
let failed = 0;

for (const { rel, scope } of targets()) {
  const abs = join(ROOT, rel);
  const { lines, eol } = splitLines(readFileSync(abs, 'utf-8'));
  const file = rel.split('/').pop()!;
  let status: string;
  try {
    const span = tierBlockSpan(lines);
    let next = lines;
    let newTier: string | null = null;

    if (!span && lines.some((l) => /^tier:\s*(\S+)\s*$/.test(l))) {
      status = 'SKIP (already scalar)';
      skipped += 1;
      console.log(`${status.padEnd(56)} ${rel}`);
      continue;
    }

    if (span) {
      const map = parseBlock(lines, span);
      const unknown = Object.keys(map).filter((k) => !KNOWN_PLATFORMS.has(k));
      if (unknown.length) throw new Error(`unknown platform key(s): ${unknown.join(', ')}`);
      const values = new Set(Object.values(map));
      if (values.size === 1) {
        newTier = [...values][0];
      } else {
        // Mixed block — only the §8.2 co-price table is authorized.
        if (scope !== 'co-price' || !(file in CO_PRICE_82)) {
          throw new Error(`mixed tier block not in design §8.2 table (scope=${scope})`);
        }
        newTier = CO_PRICE_82[file];
      }
      if (!VALID_TIERS.has(newTier)) throw new Error(`invalid tier value: ${newTier}`);
      next = refreshScalar(lines, span, newTier);
    } else {
      // Block-less: only the design's stub case (L1 counterpart is medium).
      const name = lines.find((l) => /^name:\s/.test(l))?.match(/^name:\s*(\S+)/)?.[1];
      const extendsLine = lines.find((l) => /^extends:\s*/.test(l));
      const l1 = join(ROOT, 'templates/common/agents', `${name}.md`);
      if (!extendsLine || !existsSync(l1)) {
        throw new Error('no tier block and not an extends-stub with an L1 counterpart');
      }
      const l1Raw = readFileSync(l1, 'utf-8');
      const l1Span = tierBlockSpan(splitLines(l1Raw).lines);
      const l1Scalar = l1Span
        ? (() => {
            const map = parseBlock(splitLines(l1Raw).lines, l1Span);
            const values = new Set(Object.values(map));
            return values.size === 1 ? [...values][0] : null;
          })()
        : l1Raw.match(/^tier:\s*(\S+)\s*$/m)?.[1];
      if (l1Scalar !== 'medium') {
        throw new Error(`L1 counterpart tier is ${l1Scalar ?? 'unknown'}, expected medium`);
      }
      newTier = 'medium';
      next = insertScalar(lines, 'medium');
    }

    // Version bump + last_updated refresh (delivery mechanics, design §8.4).
    const bumped = bumpVersionInLines(next, eol);
    next = bumped.lines;
    const lu = refreshLastUpdated(next);
    next = lu.lines;

    if (JSON.stringify(next) === JSON.stringify(lines)) {
      status = 'SKIP (already scalar, nothing to change)';
      skipped += 1;
    } else {
      const bits: string[] = [`tier=${newTier}`];
      if (bumped.from) bits.push(`version ${bumped.from} → ${bumped.to}`);
      if (lu.changed) bits.push('last_updated refreshed');
      status = `APPLY (${bits.join(', ')})`;
      if (!DRY) writeFileSync(abs, next.join(eol), 'utf-8');
      applied += 1;
    }
  } catch (err) {
    status = `FAIL: ${err instanceof Error ? err.message : String(err)}`;
    failed += 1;
  }
  console.log(`${status.padEnd(56)} ${rel}`);
}

console.log(
  `\n${DRY ? 'dry-run: ' : ''}applied=${applied} skipped=${skipped} failed=${failed} (targets=${targets().length})`,
);
if (failed > 0) process.exit(1);
