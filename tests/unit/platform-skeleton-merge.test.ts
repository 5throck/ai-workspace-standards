/**
 * Tests for scripts/lib/platform-skeleton-merge.ts (spec
 * docs/designs/2026-10-25-managed-platform-skeleton-design.md, ADR-0101):
 * canonical-section registry delivery for the OUT-OF-ZONE skeleton of
 * CLAUDE.md / GEMINI.md — the upgrade MERGE pass runs mergeSkeletonSections()
 * after mergeManagedBlocks.
 *
 * Pins (design §Merge semantics + test matrix):
 * 1. Old-vintage CLAUDE.md (no `### 2.` heading, co-architect shape) gets
 *    §2/§3/§4.5/§5/§6 restored with continuous out-of-zone numbering.
 * 2. New-vintage file (real template shape) → byte-identical no-op, zero
 *    SKELETON log lines.
 * 3. Project-local section at EOF (SAP Safety / Context tail) preserved
 *    byte-identical.
 * 4. COMMON zone content untouched (zone spans byte-identical).
 * 5. Guard G1: a replace whose span carries a foreign heading/comment line
 *    (co-abap GEMINI §5 `LOCAL-PATCH` shape) is skipped, no snapshot.
 * 6. Guard G2: a drifted span over the 120-line cap is skipped.
 * 7. Snapshot data on replace + the caller's fail-closed `.pre-skeleton.bak`
 *    contract (bak write failure → project file untouched).
 * 8. Number-collision guard: old-vintage `### 2. Pre-Edit Quality Gate (All
 *    Platforms)` blocks the claude-s2 insert (SKELETON DRIFT log, no
 *    duplicate §2) while §3/§4.5/§5/§6 still insert; a foreign `### 5.`
 *    title blocks claude-s5 the same way.
 * 9. Idempotent second run: content identical, zero INSERTED/REPLACED lines.
 *    (Known standing signal, by design: on a project that keeps an
 *    unregistered old-vintage `### 2.` heading, the claude-s2 collision skip
 *    re-logs `SKELETON DRIFT (manual review)` on every run — inserts delete
 *    nothing, so that conflict stays visible until resolved manually.)
 * 10. Unresolved anchor → SKELETON ANCHOR NOT FOUND, no write; dryRun purity.
 * 11. Real-tree invariants: the registry validates clean against
 *     templates/common/{CLAUDE,GEMINI}.md and both templates self-merge as a
 *     no-op.
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  MANAGED_SKELETON_SECTIONS,
  mergeSkeletonSections,
  validateSkeletonRegistry,
  headingNumber,
  headingLevel,
  SKELETON_REPLACE_MAX_SPAN_LINES,
} from '../../scripts/lib/platform-skeleton-merge.ts';

const workspaceRoot = resolve(import.meta.dir, '..', '..');
const claudeTemplate = readFileSync(join(workspaceRoot, 'templates', 'common', 'CLAUDE.md'), 'utf8');
const geminiTemplate = readFileSync(join(workspaceRoot, 'templates', 'common', 'GEMINI.md'), 'utf8');

// ── Fixtures (mirroring the verified fleet shapes) ────────────────────────────

const C_OPEN = '<!-- COMMON-CLAUDE:START -->';
const C_END = '<!-- COMMON-CLAUDE:END -->';
const G_OPEN = '<!-- COMMON-GEMINI:START -->';
const G_END = '<!-- COMMON-GEMINI:END -->';

/** Template-derived section bodies (kept in sync with templates/common by the
 *  real-tree pins below — a template heading/body rename breaks these fixtures
 *  loudly instead of silently testing stale copies). */
function templateSection(content: string, heading: string, stopPrefixes: string[]): string[] {
  const lines = content.split('\n');
  const start = lines.findIndex((l) => l.trim() === heading);
  if (start < 0) throw new Error(`fixture helper: heading not found: ${heading}`);
  const end = lines.findIndex((l, i) => i > start && stopPrefixes.some((p) => l.trim().startsWith(p)));
  return lines.slice(start, end < 0 ? lines.length : end).filter((l, i, a) => !(i === a.length - 1 && l.trim() === ''));
}

const S3 = '### 3. MCP Configurations & Absolute Resolving';
const S4 = '### 4. Language Policy for Documentation';
const S45 = '### 4.5 Skill Resolution Priority';
const S5 = '### 5. Agent Dispatch Rules';
const S6 = '### 6. Native Sub-agents (`Agent` Tool)';
const EPB = '## Execution Plan Boilerplate';

const s3Lines = templateSection(claudeTemplate, S3, [S4, C_OPEN]);
const s45Lines = templateSection(claudeTemplate, S45, [S5]);
const s5Lines = templateSection(claudeTemplate, S5, [C_OPEN]);
const geminiS5Lines = templateSection(geminiTemplate, S5, [G_OPEN]);

interface OldVintageOpts {
  /** Include the old-vintage `### 2. Pre-Edit Quality Gate` heading (co-newbiz shape). */
  oldS2?: boolean;
  /** Project-local tail at EOF (co-abap / co-price shape). */
  tail?: string[];
}

/** Old-vintage CLAUDE.md fixture: full zone set, registered sections missing
 *  (the 09-12 wave shape). */
function oldVintageClaude(opts: OldVintageOpts = {}): string {
  const parts: string[] = ['# CLAUDE.md', '', '## Role Declaration', 'prose head', ''];
  if (opts.oldS2) {
    parts.push('### 2. Pre-Edit Quality Gate (All Platforms)', '', 'old-vintage pre-edit body', '');
  }
  parts.push(
    '### 1. Automated Hooks',
    'hooks body',
    '',
    C_OPEN,
    '#### teammateMode (Claude Code Agent Teams execution mode)',
    'zone body v1',
    C_END,
    '',
    C_OPEN,
    S4,
    '',
    'policy body',
    C_END,
    '',
    C_OPEN,
    EPB,
    '',
    'boilerplate body',
    C_END,
    '',
    C_OPEN,
    'Use the native `Agent` tool to spawn sub-agents.',
    C_END,
    '',
    C_OPEN,
    '#### Cost Optimization (3-Tier Model Strategy)',
    'tier body',
    C_END,
    '',
    C_OPEN,
    '### 7. Native Plan Mode (`EnterPlanMode`)',
    'plan body',
    C_END,
    '',
  );
  if (opts.tail) parts.push(...opts.tail, '');
  return parts.join('\n');
}

/** Old-vintage GEMINI.md fixture with a co-abap-shaped §5: heading present,
 *  LOCAL-PATCH comment + project-local body inside the span. */
function abapGemini(localPatch: boolean): string {
  const s5Body = localPatch
    ? [S5, '', '<!-- LOCAL-PATCH(upstream-request: pending): heading added for governance anchors -->', 'Dispatch specialist agents with `define_subagent`.', '', '---', '']
    : [S5, '', 'Drifted prose body without any structural line change.', ''];
  return [
    '# GEMINI.md',
    '',
    '### 3. Subagent Instantiation & Async Orchestration',
    'body',
    '',
    G_OPEN,
    S4,
    '',
    'policy body',
    G_END,
    '',
    ...s5Body,
    G_OPEN,
    EPB,
    '',
    'boilerplate body',
    G_END,
    '',
  ].join('\n');
}

function zoneSpansOf(content: string, open: string, close: string): string[] {
  return content.match(new RegExp(`${open}[\\s\\S]*?${close}`, 'g')) ?? [];
}

// ── 1+3+4: old-vintage restore, tail preservation, zone-untouched ────────────

describe('old-vintage CLAUDE.md restore (co-architect shape, no local §2)', () => {
  const proj = oldVintageClaude({ tail: ['## SAP Safety (co-abap hardening)', 'project-local hardening prose', '', '## Co Newbiz Context', 'context tail'] });
  const result = mergeSkeletonSections(proj, claudeTemplate, 'CLAUDE.md', false);

  test('all five registered sections INSERTED', () => {
    expect(result.log.filter((l) => l.includes('SKELETON INSERTED')).length).toBe(5);
    for (const id of ['claude-s2', 'claude-s3', 'claude-s45', 'claude-s5', 'claude-s6']) {
      expect(result.log.some((l) => l.includes(`SKELETON INSERTED ${id}`))).toBe(true);
    }
    expect(result.merged).toBe(true);
    expect(result.snapshots).toEqual([]); // inserts delete nothing
  });

  test('continuous out-of-zone numbering in section order 1,2,3,4.5,5,6 (§7+ are zone-delivered)', () => {
    const lines = result.content.split('\n');
    const zoneLine = new Set<string>();
    // mark lines inside COMMON-CLAUDE zones
    let depth = false;
    for (const l of lines) {
      const t = l.trim();
      if (t === C_OPEN) { depth = true; continue; }
      if (t === C_END) { depth = false; continue; }
      if (depth) zoneLine.add(l);
    }
    const numbered = lines
      .filter((l) => !zoneLine.has(l) && /^###\s/.test(l.trim()))
      .map((l) => headingNumber(l) ?? l.trim());
    expect(numbered).toEqual(['1', '2', '3', '4.5', '5', '6']);
  });

  test('project-local tail preserved byte-identical', () => {
    const tail = ['## SAP Safety (co-abap hardening)', 'project-local hardening prose', '', '## Co Newbiz Context', 'context tail'].join('\n');
    expect(result.content).toContain(`\n${tail}\n`);
    expect(result.content.endsWith(`${tail}\n`)).toBe(true);
  });

  test('COMMON zone content untouched (every zone span byte-identical)', () => {
    const before = zoneSpansOf(proj, C_OPEN, C_END);
    const after = zoneSpansOf(result.content, C_OPEN, C_END);
    expect(after).toEqual(before);
    expect(after.length).toBe(6);
  });

  test('inserted section bodies are byte-equal to the template sections', () => {
    expect(result.content).toContain(s3Lines.join('\n'));
    expect(result.content).toContain(s45Lines.join('\n'));
    expect(result.content).toContain(s5Lines.join('\n'));
    expect(result.content).toContain(S6); // heading line only
  });
});

// ── 2: new-vintage no-op ──────────────────────────────────────────────────────

describe('new-vintage no-op (real template shapes)', () => {
  test('CLAUDE.md template self-merge is a byte-identical no-op with zero log', () => {
    const r = mergeSkeletonSections(claudeTemplate, claudeTemplate, 'CLAUDE.md', false);
    expect(r.content).toBe(claudeTemplate);
    expect(r.merged).toBe(false);
    expect(r.log).toEqual([]);
    expect(r.snapshots).toEqual([]);
  });

  test('GEMINI.md template self-merge is a byte-identical no-op with zero log', () => {
    const r = mergeSkeletonSections(geminiTemplate, geminiTemplate, 'GEMINI.md', false);
    expect(r.content).toBe(geminiTemplate);
    expect(r.merged).toBe(false);
    expect(r.log).toEqual([]);
  });
});

// ── 5: G1 (project-local content in span) ────────────────────────────────────

describe('guard G1: replace skipped when the span carries project-local content', () => {
  test('co-abap GEMINI §5 LOCAL-PATCH shape → skip, no snapshot, no change', () => {
    const proj = abapGemini(true);
    const r = mergeSkeletonSections(proj, geminiTemplate, 'GEMINI.md', false);
    expect(r.log.some((l) => l.includes('SKELETON REPLACE SKIPPED (project-local content)') && l.includes('gemini-s5'))).toBe(true);
    expect(r.content).toBe(proj);
    expect(r.merged).toBe(false);
    expect(r.snapshots).toEqual([]);
    expect(r.content).toContain('<!-- LOCAL-PATCH(upstream-request: pending)');
  });

  test('prose-only drift (no foreign heading/comment) still replaces', () => {
    const proj = abapGemini(false);
    const r = mergeSkeletonSections(proj, geminiTemplate, 'GEMINI.md', false);
    expect(r.log.some((l) => l.includes('SKELETON REPLACED gemini-s5'))).toBe(true);
    expect(r.snapshots.length).toBe(1);
    expect(r.snapshots[0]!.rel).toBe('GEMINI.md');
    expect(r.snapshots[0]!.content).toContain('Drifted prose body');
    expect(r.content).toContain('**MANDATORY PM GATEWAY**');
  });
});

// ── 6: G2 (span size cap) ─────────────────────────────────────────────────────

describe('guard G2: replace skipped over the span-size cap', () => {
  test('drifted §5 span padded past 120 prose lines → skip, no snapshot', () => {
    const padded = [...geminiS5Lines];
    padded[2] = 'Old drifted prose.';
    for (let i = 0; i < SKELETON_REPLACE_MAX_SPAN_LINES + 10; i++) padded.push(`filler ${i}`);
    const proj = [
      '# GEMINI.md',
      '',
      G_OPEN,
      S4,
      'policy body',
      G_END,
      '',
      ...padded,
      '',
      G_OPEN,
      EPB,
      'boilerplate body',
      G_END,
      '',
    ].join('\n');
    const r = mergeSkeletonSections(proj, geminiTemplate, 'GEMINI.md', false);
    expect(r.log.some((l) => l.includes(`SKELETON REPLACE SKIPPED (span exceeds ${SKELETON_REPLACE_MAX_SPAN_LINES}-line cap — manual review)`) && l.includes('gemini-s5'))).toBe(true);
    expect(r.content).toBe(proj);
    expect(r.merged).toBe(false);
    expect(r.snapshots).toEqual([]);
  });
});

// ── 7: snapshot data + caller fail-closed .pre-skeleton.bak contract ─────────

describe('snapshot persistence: the caller contract (upgrade-project mergeWorkspaceManaged)', () => {
  test('fail-closed: an unwritable .pre-skeleton.bak aborts before the project write', () => {
    const dir = mkdtempSync(join(tmpdir(), 'skeleton-bak-fail-'));
    const proj = abapGemini(false); // replace case → snapshot returned
    const projFile = join(dir, 'GEMINI.md');
    writeFileSync(projFile, proj, 'utf8');

    const skeleton = mergeSkeletonSections(proj, geminiTemplate, 'GEMINI.md', false);
    expect(skeleton.snapshots.length).toBe(1);
    expect(skeleton.merged).toBe(true);

    const bakPath = `${projFile}.pre-skeleton.bak`;
    // A directory at the bak path forces writeFileSync to throw (EISDIR) —
    // the exact caller failure mode the fail-closed abort exists for.
    mkdirSync(bakPath, { recursive: true });
    let threw = false;
    try {
      // — verbatim shape of the upgrade-project snapshot block —
      writeFileSync(bakPath, skeleton.snapshots.map((s) => s.content).join('\n\n'), 'utf8');
      writeFileSync(projFile, skeleton.content, 'utf8');
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
    expect(readFileSync(projFile, 'utf8')).toBe(proj); // project untouched
  });

  test('happy path: the bak file carries the exact replaced project span', () => {
    const dir = mkdtempSync(join(tmpdir(), 'skeleton-bak-ok-'));
    const proj = abapGemini(false);
    const projFile = join(dir, 'GEMINI.md');
    writeFileSync(projFile, proj, 'utf8');

    const skeleton = mergeSkeletonSections(proj, geminiTemplate, 'GEMINI.md', false);
    const bakPath = `${projFile}.pre-skeleton.bak`;
    writeFileSync(bakPath, skeleton.snapshots.map((s) => s.content).join('\n\n'), 'utf8');
    writeFileSync(projFile, skeleton.content, 'utf8');

    expect(readFileSync(bakPath, 'utf8')).toBe(skeleton.snapshots[0]!.content);
    expect(readFileSync(projFile, 'utf8')).not.toBe(proj);
    expect(existsSync(bakPath)).toBe(true);
  });
});

// ── 8: number-collision guard ─────────────────────────────────────────────────

describe('number-collision guard', () => {
  test('old-vintage `### 2. Pre-Edit Quality Gate` blocks claude-s2 with a DRIFT log; §3/§4.5/§5/§6 still insert (co-newbiz shape)', () => {
    const proj = oldVintageClaude({ oldS2: true });
    const r = mergeSkeletonSections(proj, claudeTemplate, 'CLAUDE.md', false);
    expect(r.log.some((l) => l.includes('SKELETON DRIFT (manual review)') && l.includes('claude-s2'))).toBe(true);
    expect(r.content).not.toContain('### 2. Native Slash Commands');
    expect(r.content).toContain('### 2. Pre-Edit Quality Gate (All Platforms)');
    for (const id of ['claude-s3', 'claude-s45', 'claude-s5', 'claude-s6']) {
      expect(r.log.some((l) => l.includes(`SKELETON INSERTED ${id}`))).toBe(true);
    }
    expect(r.merged).toBe(true);
  });

  test('a foreign `### 5.` title blocks claude-s5 the same way', () => {
    const proj = [
      '# CLAUDE.md',
      '',
      '### 5. Project-Local Custom Rules',
      'local body',
      '',
      C_OPEN,
      EPB,
      'boilerplate body',
      C_END,
      '',
    ].join('\n');
    const r = mergeSkeletonSections(proj, claudeTemplate, 'CLAUDE.md', false);
    expect(r.log.some((l) => l.includes('SKELETON DRIFT (manual review)') && l.includes('claude-s5'))).toBe(true);
    expect(r.content).not.toContain(S5);
    expect(r.content).toContain('### 5. Project-Local Custom Rules');
  });

  test('4.5 collision detection handles the dotless N.M heading form', () => {
    expect(headingNumber('### 4.5 Skill Resolution Priority')).toBe('4.5');
    expect(headingNumber('### 2. Native Slash Commands')).toBe('2');
    expect(headingLevel('### 4.5 Skill Resolution Priority')).toBe(3);
    const proj = [
      '# CLAUDE.md',
      '',
      '### 4.5 Project-Local Skill Overrides',
      'local body',
      '',
      C_OPEN,
      EPB,
      'boilerplate body',
      C_END,
      '',
    ].join('\n');
    const r = mergeSkeletonSections(proj, claudeTemplate, 'CLAUDE.md', false);
    expect(r.log.some((l) => l.includes('SKELETON DRIFT (manual review)') && l.includes('claude-s45'))).toBe(true);
  });
});

// ── 9: idempotency ────────────────────────────────────────────────────────────

describe('idempotent second run', () => {
  test('second run over the first run output changes nothing and inserts/replaces nothing', () => {
    const proj = oldVintageClaude({ oldS2: true, tail: ['## Co Newbiz Context', 'context tail'] });
    const first = mergeSkeletonSections(proj, claudeTemplate, 'CLAUDE.md', false);
    const second = mergeSkeletonSections(first.content, claudeTemplate, 'CLAUDE.md', false);
    expect(second.content).toBe(first.content);
    expect(second.merged).toBe(false);
    expect(second.snapshots).toEqual([]);
    expect(second.log.some((l) => l.includes('SKELETON INSERTED') || l.includes('SKELETON REPLACED'))).toBe(false);
    // By design, the standing unregistered `### 2.` keeps re-logging the
    // collision skip — the conflict stays visible until resolved manually.
    expect(second.log.some((l) => l.includes('SKELETON DRIFT (manual review)'))).toBe(true);
  });

  test('second run on a normalized file (no standing collision) is fully silent', () => {
    const proj = oldVintageClaude({ tail: ['## Co Newbiz Context', 'context tail'] });
    const first = mergeSkeletonSections(proj, claudeTemplate, 'CLAUDE.md', false);
    const second = mergeSkeletonSections(first.content, claudeTemplate, 'CLAUDE.md', false);
    expect(second.content).toBe(first.content);
    expect(second.log).toEqual([]);
  });
});

// ── 10: unresolved anchor + dryRun purity ────────────────────────────────────

describe('unresolved anchor and dryRun purity', () => {
  test('missing anchor heading → ANCHOR NOT FOUND, no write, never throws', () => {
    const proj = '# GEMINI.md\n\nno anchors here\n';
    const r = mergeSkeletonSections(proj, geminiTemplate, 'GEMINI.md', false);
    expect(r.log.some((l) => l.includes('SKELETON ANCHOR NOT FOUND — skipped'))).toBe(true);
    expect(r.content).toBe(proj);
    expect(r.merged).toBe(false);
  });

  test('unknown rel → pure no-op', () => {
    const r = mergeSkeletonSections('anything', claudeTemplate, 'AGENTS.md', false);
    expect(r.content).toBe('anything');
    expect(r.merged).toBe(false);
    expect(r.log).toEqual([]);
  });

  test('dryRun tags every log line without changing the content', () => {
    const proj = oldVintageClaude({ oldS2: true });
    const plain = mergeSkeletonSections(proj, claudeTemplate, 'CLAUDE.md', false);
    const dry = mergeSkeletonSections(proj, claudeTemplate, 'CLAUDE.md', true);
    expect(dry.content).toBe(plain.content);
    expect(dry.log.length).toBe(plain.log.length);
    expect(dry.log.every((l) => l.includes('[DRY RUN] '))).toBe(true);
    expect(plain.log.every((l) => !l.includes('[DRY RUN] '))).toBe(true);
  });
});

// ── 11: real-tree invariants (templates/common) ──────────────────────────────

describe('real-tree invariants: registry vs templates/common', () => {
  test('registry is non-empty and scoped to CLAUDE.md/GEMINI.md', () => {
    expect(MANAGED_SKELETON_SECTIONS.length).toBe(6);
    expect(new Set(MANAGED_SKELETON_SECTIONS.map((s) => s.rel))).toEqual(new Set(['CLAUDE.md', 'GEMINI.md']));
  });

  test('validateSkeletonRegistry is clean for both platform templates', () => {
    expect(validateSkeletonRegistry(claudeTemplate, 'CLAUDE.md')).toEqual([]);
    expect(validateSkeletonRegistry(geminiTemplate, 'GEMINI.md')).toEqual([]);
  });

  test('registry validation catches a renamed heading, an in-zone heading, and duplicate numbers', () => {
    const renamed = claudeTemplate.replace(S5, '### 5. Agent Dispatch Rule');
    expect(validateSkeletonRegistry(renamed, 'CLAUDE.md').some((i) => i.includes('missing'))).toBe(true);

    const zoned = claudeTemplate.replace(
      `${C_OPEN}\n${EPB}`,
      `${C_OPEN}\n${S5}`,
    ).replace(`\n${S5}\n\n**MANDATORY PM GATEWAY**`, '\n\n**MANDATORY PM GATEWAY**');
    expect(validateSkeletonRegistry(zoned, 'CLAUDE.md').some((i) => i.includes('INSIDE a managed marker zone'))).toBe(true);

    const dup = claudeTemplate.replace(S6, S5);
    expect(validateSkeletonRegistry(dup, 'CLAUDE.md').some((i) => i.includes('duplicate section number 5'))).toBe(true);
  });
});
