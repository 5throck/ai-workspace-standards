/**
 * Unit tests for resync-audit.ts v1.10.0 (T-20261117-010): merge-delivered
 * files (MERGE_MANAGED / JSON_MERGE / SCHEMA_MERGE claim — e.g.
 * .agents/mcp.json) must NEVER receive an auto-discard verdict from
 * content-equality with the template source. The upgrade wave delivers these
 * paths as a UNION and the project's merge-block edits are authoritative
 * between waves, so the STALE-RESIDUE justification "upgrade re-delivers" is
 * false for them — the 2026-11-17 fleet sweep discarded co-game/co-hr/co-news
 * .agents/mcp.json on that verdict while T-20261117-007 showed the TEMPLATE
 * side was the stale one, re-injecting a retired graft server the project had
 * hand-removed.
 *
 * classify() needs a real git repo (it reads HEAD:<path>), so the e2e cases
 * run against a temp repo with a controlled initial commit. The template
 * source compared against is the real templates/common/.agents/mcp.json —
 * the exact file involved in the incident — read at test runtime so the
 * fixture reproduces the reported case (working tree == template source).
 *
 * @version 1.10.0
 */
import { describe, test, expect, afterAll } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { classify, mergeDeliveryPolicy } from '../../scripts/resync-audit.ts';

const dir = mkdtempSync(join(tmpdir(), 'resync-audit-merge-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const REPO_ROOT = join(import.meta.dir, '..', '..');
const TEMPLATE_MCP = join(REPO_ROOT, 'templates', 'common', '.agents', 'mcp.json');

/** Normalized template-source content, matching classify()'s CRLF handling. */
function srcContent(p: string): string {
  return readFileSync(p, 'utf-8').replace(/\r\n/g, '\n');
}

const PROJECT_COMMITTED_MCP = JSON.stringify({
  mcpServers: { 'project-own': { command: 'uvx', args: ['some-project-server'] } },
}) + '\n';

const EMPTY_DELIVERY = { tombstones: {}, baselines: {} } as const;

function gitInit(project: string, files: Record<string, string>): void {
  mkdirSync(project, { recursive: true });
  const run = (args: string[]) =>
    spawnSync('git', ['-C', project, ...args], { encoding: 'utf-8' });
  run(['init', '-q']);
  run(['config', 'user.email', 'test@example.invalid']);
  run(['config', 'user.name', 'resync-audit test']);
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(project, rel);
    mkdirSync(abs.slice(0, abs.lastIndexOf('/')), { recursive: true });
    writeFileSync(abs, content);
  }
  run(['add', '-A']);
  run(['commit', '-qm', 'fixture baseline']);
}

describe('mergeDeliveryPolicy — resolveClaim-backed merge-delivery detection', () => {
  test('.agents/mcp.json → JSON_MERGE (the incident path)', () => {
    expect(mergeDeliveryPolicy('.agents/mcp.json')).toBe('JSON_MERGE');
  });

  test('.claude/settings.json → JSON_MERGE', () => {
    expect(mergeDeliveryPolicy('.claude/settings.json')).toBe('JSON_MERGE');
  });

  test('CLAUDE.md → MERGE_MANAGED', () => {
    expect(mergeDeliveryPolicy('CLAUDE.md')).toBe('MERGE_MANAGED');
  });

  test('docs/<variant>.context.md → MERGE_MANAGED (DOCS_MERGE) when variant given', () => {
    expect(mergeDeliveryPolicy('docs/co-x.context.md', 'co-x')).toBe('MERGE_MANAGED');
  });

  test('docs/workspace-schema.json → SCHEMA_MERGE', () => {
    expect(mergeDeliveryPolicy('docs/workspace-schema.json')).toBe('SCHEMA_MERGE');
  });

  test('agents/pm.md → MERGE_MANAGED (merge pass member, like the platform docs)', () => {
    expect(mergeDeliveryPolicy('agents/pm.md')).toBe('MERGE_MANAGED');
  });

  test('non-merge template-delivered paths → null', () => {
    expect(mergeDeliveryPolicy('skills/explain-me/SKILL.md')).toBeNull();
    expect(mergeDeliveryPolicy('.codex/skills/explain-me/SKILL.md')).toBeNull();
    expect(mergeDeliveryPolicy('scripts/resync-audit.ts')).toBeNull();
    expect(mergeDeliveryPolicy('.agents/skills/explain-me/SKILL.md')).toBeNull();
  });
});

describe('classify — merge-delivered files never auto-discard on content-equality (T-20261117-010)', () => {
  test('modified .agents/mcp.json equal to template source → PRESUME-STALE (was STALE-RESIDUE)', () => {
    const project = join(dir, 'mod-eq');
    gitInit(project, { '.agents/mcp.json': PROJECT_COMMITTED_MCP });
    // wave re-delivered the union into the working tree (== template source)
    writeFileSync(join(project, '.agents', 'mcp.json'), srcContent(TEMPLATE_MCP));
    const row = classify(project, '.agents/mcp.json', 'modified', { ...EMPTY_DELIVERY });
    expect(row.verdict).toBe('PRESUME-STALE');
    expect(row.basis).toContain('merge-delivered (JSON_MERGE)');
    expect(row.basis).toContain('human confirm before discard');
    expect(row.verdict).not.toBe('STALE-RESIDUE');
  });

  test('untracked .agents/mcp.json equal to template source → PRESUME-STALE (was STALE-RESIDUE)', () => {
    const project = join(dir, 'untracked-eq');
    gitInit(project, { 'README.md': 'x\n' });
    mkdirSync(join(project, '.agents'), { recursive: true });
    writeFileSync(join(project, '.agents', 'mcp.json'), srcContent(TEMPLATE_MCP));
    const row = classify(project, '.agents/mcp.json', 'untracked', { ...EMPTY_DELIVERY });
    expect(row.verdict).toBe('PRESUME-STALE');
    expect(row.basis).toContain('untracked');
    expect(row.basis).toContain('merge-delivered (JSON_MERGE)');
    expect(row.verdict).not.toBe('STALE-RESIDUE');
  });

  test('merge-delivered corroborated stale (older revision, mtime older) → PRESUME-STALE', () => {
    const project = join(dir, 'mod-older');
    gitInit(project, { '.agents/mcp.json': PROJECT_COMMITTED_MCP });
    // an OLDER-REVISION shape of the template source: its first lines only
    const templateLines = srcContent(TEMPLATE_MCP).split('\n').filter((l) => l.trim().length > 0);
    const older = templateLines.slice(0, Math.max(2, templateLines.length - 2)).join('\n') + '\n';
    const abs = join(project, '.agents', 'mcp.json');
    writeFileSync(abs, older);
    // project mtime strictly older than the template source (mtime corroboration)
    const srcMtime = statSync(TEMPLATE_MCP).mtime;
    const olderMtime = new Date(srcMtime.getTime() - 24 * 60 * 60 * 1000);
    utimesSync(abs, olderMtime, olderMtime);
    const row = classify(project, '.agents/mcp.json', 'modified', { ...EMPTY_DELIVERY });
    expect(row.verdict).toBe('PRESUME-STALE');
    expect(row.basis).toContain('merge-delivered (JSON_MERGE)');
    expect(row.verdict).not.toBe('STALE-RESIDUE');
  });

  test('non-merge file equal to its template source still → STALE-RESIDUE (behavior unchanged)', () => {
    const project = join(dir, 'mod-nonmerge');
    const rel = '.codex/skills/explain-me/SKILL.md';
    const templateAbs = join(REPO_ROOT, rel);
    if (!statSync(templateAbs, { throwIfNoEntry: false })?.isFile?.()) {
      // template source missing in this checkout — cannot pin the control
      return;
    }
    gitInit(project, { [rel]: 'stale committed marker\n' });
    writeFileSync(join(project, rel), srcContent(templateAbs));
    const row = classify(project, rel, 'modified', { ...EMPTY_DELIVERY });
    expect(row.verdict).toBe('STALE-RESIDUE');
    expect(row.basis).toBe(`content equals current template source (${rel})`);
  });

  test('merge-delivered file with genuinely divergent content → LOCAL-WORK (commit candidate)', () => {
    const project = join(dir, 'mod-divergent');
    gitInit(project, { '.agents/mcp.json': PROJECT_COMMITTED_MCP });
    writeFileSync(
      join(project, '.agents', 'mcp.json'),
      JSON.stringify({ mcpServers: { 'project-own': {}, trail: {}, extra: {} } }, null, 2) + '\n',
    );
    const row = classify(project, '.agents/mcp.json', 'modified', { ...EMPTY_DELIVERY });
    // neither equal to nor an older revision of the template source — the
    // merge guard never fires; the ordinary divergent verdict stands
    expect(row.verdict).toBe('LOCAL-WORK');
  });
});
