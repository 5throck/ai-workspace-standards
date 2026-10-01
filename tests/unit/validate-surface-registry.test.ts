/**
 * Tests for scripts/validate-surface-registry.ts (T-20261001-018, ADR-0097
 * follow-up): the CONSTITUTION §11.0 supported-surface registry must be backed
 * by the filesystem at L0/L1/L2, with the templates/common/docs/context.md copy
 * in sync, documented gaps (docs/surface-gaps.json) rendering as WARNs and
 * undocumented gaps as FAILs.
 *
 * The real-workspace tests are integration checks (the tree must pass). The
 * synthetic-workspace tests build minimal fixture trees to exercise the FAIL
 * and gap-WARN paths deterministically.
 *
 * @version 1.0.0
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseSurfaceRegistry,
  parseConstitutionRows,
  parseContextTable,
  checkLayer,
  validateSurfaceRegistry,
  SCAFFOLD_COMPOSED,
} from '../../scripts/validate-surface-registry.ts';
import { readFileSync } from 'node:fs';

const ROOT = join(import.meta.dir, '..', '..');
const constitutionMd = readFileSync(join(ROOT, 'CONSTITUTION.md'), 'utf-8');

describe('§11.0 registry parsing', () => {
  test('parses all 8 surfaces with their instruction files and families', () => {
    const rows = parseSurfaceRegistry(constitutionMd);
    expect(rows).toHaveLength(8);
    expect(rows[0]).toMatchObject({ num: 1, surface: 'Claude Code', family: 'Anthropic', instructionFiles: ['CLAUDE.md'] });
    expect(rows[3].surface).toBe('Antigravity CLI');
    expect(rows[4].instructionFiles).toEqual(['CODEX.md', 'AGENTS.md']);
    expect(rows[7].instructionFiles).toEqual(['HERMES.md', 'AGENTS.md']);
  });

  test('raw-row extraction is normalized and complete on both sides (one source)', () => {
    const constRows = parseConstitutionRows(constitutionMd);
    expect(constRows).toHaveLength(8);
    const ctx = readFileSync(join(ROOT, 'templates', 'common', 'docs', 'context.md'), 'utf-8');
    const ctxRows = parseContextTable(ctx);
    expect(ctxRows).toEqual(constRows); // one-source rule holds today
  });

  test('scaffold-composed set carries the three merged instruction files', () => {
    expect([...SCAFFOLD_COMPOSED].sort()).toEqual(['CLAUDE.md', 'CODEX.md', 'GEMINI.md']);
  });
});

describe('real workspace (integration)', () => {
  test('the live tree passes the full validation', () => {
    const findings = validateSurfaceRegistry(ROOT);
    const fails = findings.filter((f) => f.severity === 'FAIL');
    expect(fails).toEqual([]);
  });
});

describe('synthetic workspace (FAIL and gap-WARN paths)', () => {
  let ws: string;
  beforeEach(() => {
    ws = mkdtempSync(join(tmpdir(), 'surface-registry-'));
    // Minimal L0: constitution with the real table, all files present.
    cpSync(join(ROOT, 'CONSTITUTION.md'), join(ws, 'CONSTITUTION.md'));
    mkdirSync(join(ws, 'templates', 'common', 'docs'), { recursive: true });
    cpSync(join(ROOT, 'templates', 'common', 'docs', 'context.md'), join(ws, 'templates', 'common', 'docs', 'context.md'));
    for (const f of ['CLAUDE.md', 'GEMINI.md', 'CODEX.md', 'HERMES.md', 'AGENTS.md']) {
      writeFileSync(join(ws, f), 'x');
      writeFileSync(join(ws, 'templates', 'common', f), 'x');
    }
    for (const d of ['.claude', '.gemini', '.agents', '.codex', '.hermes']) {
      mkdirSync(join(ws, d), { recursive: true });
      mkdirSync(join(ws, 'templates', 'common', d), { recursive: true });
    }
    mkdirSync(join(ws, 'templates', 'co-test'), { recursive: true });
    writeFileSync(join(ws, 'templates', 'co-test', 'AGENTS.md'), 'x');
    writeFileSync(join(ws, 'templates', 'co-test', 'HERMES.md'), 'x');
    for (const d of ['.claude', '.gemini', '.agents', '.codex', '.hermes']) {
      mkdirSync(join(ws, 'templates', 'co-test', d), { recursive: true });
    }
  });
  afterEach(() => rmSync(ws, { recursive: true, force: true }));

  function writeGaps(gaps: unknown[]) {
    mkdirSync(join(ws, 'docs'), { recursive: true });
    writeFileSync(join(ws, 'docs', 'surface-gaps.json'), JSON.stringify({ gaps }), 'utf-8');
  }

  test('a missing L2 static instruction file is an undocumented FAIL', () => {
    rmSync(join(ws, 'templates', 'co-test', 'HERMES.md'));
    const findings = validateSurfaceRegistry(ws);
    const f = findings.find((x) => x.severity === 'FAIL' && x.message.includes('co-test') && x.message.includes('HERMES.md'));
    expect(f).toBeDefined();
  });

  test('the same gap WITH a documented row is a WARN naming the ticket', () => {
    rmSync(join(ws, 'templates', 'co-test', 'HERMES.md'));
    writeGaps([{ surface: 'Hermes Agent', check: 'instruction-file', reason: 'hermes profile ships late', fallback: 'graft init --agents hermes', ticket: 'T-20261001-999' }]);
    const findings = validateSurfaceRegistry(ws);
    const w = findings.find((x) => x.severity === 'WARN' && x.message.includes('HERMES.md'));
    expect(w).toBeDefined();
    expect(w!.ticket).toBe('T-20261001-999');
  });

  test('a scaffold-composed file (CLAUDE.md) absent from L2 is NOT a finding', () => {
    // co-test never carried CLAUDE.md — composed at scaffold from L1.
    const findings = validateSurfaceRegistry(ws);
    expect(findings.find((x) => x.message.includes('co-test') && x.message.includes('CLAUDE.md'))).toBeUndefined();
  });

  test('a skill missing from a platform mirror FAILs; mirror:false is honored', () => {
    mkdirSync(join(ws, 'templates', 'co-test', 'skills', 'sample'), { recursive: true });
    writeFileSync(join(ws, 'templates', 'co-test', 'skills', 'sample', 'SKILL.md'), '---\nname: sample\n---\nbody');
    const findings = validateSurfaceRegistry(ws);
    expect(findings.some((x) => x.severity === 'FAIL' && x.message.includes('skill sample'))).toBe(true);
    // mark it mirror-excluded (ADR-0075) — the finding disappears
    writeFileSync(join(ws, 'templates', 'co-test', 'skills', 'sample', 'SKILL.md'), '---\nname: sample\nmirror: false\n---\nbody');
    const after = validateSurfaceRegistry(ws);
    expect(after.some((x) => x.message.includes('skill sample'))).toBe(false);
  });

  test('context.md table drift is a one-source FAIL', () => {
    const p = join(ws, 'templates', 'common', 'docs', 'context.md');
    const drifted = readFileSync(p, 'utf-8').replace('| 2 | Claude Desktop App', '| 2 | Claude Desktop (renamed)');
    writeFileSync(p, drifted, 'utf-8');
    const findings = validateSurfaceRegistry(ws);
    expect(findings.some((x) => x.severity === 'FAIL' && x.check === 'one-source')).toBe(true);
  });
});
