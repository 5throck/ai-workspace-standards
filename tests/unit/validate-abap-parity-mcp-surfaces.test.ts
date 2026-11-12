/**
 * Unit tests for the co-abap platform-parity checkMcp conditional surfaces
 * (validate-abap-platform-parity.ts v1.2.0, U-20261112-015): opencode.json
 * (its `mcp` map, argv-array command shape) and .claude/settings.json
 * (mcpServers) are added to MCP_CONFIGS as conditional requireAbap:false
 * surfaces — skipped when the file is absent, enforcing only the
 * abap-routes-through-proxy / no-direct-vsp invariant when present.
 *
 * checkMcp runs against a synthetic root fixture per test.
 *
 * @version 1.0.0
 */
import { describe, test, expect, afterEach } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkMcp, serverArgv } from '../../templates/co-abap/scripts/validate-abap-platform-parity.ts';

let roots: string[] = [];
function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'abap-parity-'));
  roots.push(root);
  // Universal fail-on-missing surfaces (base table, unchanged by U-20261112-015)
  writeFileSync(
    join(root, '.mcp.json'),
    JSON.stringify({ mcpServers: { abap: { command: 'bun', args: ['scripts/sap-mcp-proxy.ts'] } } }),
  );
  mkdirSync(join(root, '.agents'));
  writeFileSync(
    join(root, '.agents/mcp.json'),
    JSON.stringify({ mcpServers: { abap: { command: 'bun', args: ['scripts/sap-mcp-proxy.ts'] } } }),
  );
  mkdirSync(join(root, '.gemini'));
  writeFileSync(
    join(root, '.gemini/settings.json'),
    JSON.stringify({ mcpServers: { abap: { command: 'bun', args: ['scripts/sap-mcp-proxy.ts'] } } }),
  );
  mkdirSync(join(root, 'config', 'platforms'), { recursive: true });
  writeFileSync(join(root, 'config/platforms/hermes-mcp.example.yaml'), 'abap:\n  command: bun scripts/sap-mcp-proxy.ts\n');
  return root;
}
afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots = [];
});

const problemsFor = (root: string): string[] => checkMcp(root).problems.filter((p) => !p.startsWith('.codex/'));

describe('checkMcp conditional surfaces (U-20261112-015)', () => {
  test('opencode.json absent → skipped (conditional), universal surfaces still enforced', () => {
    const root = makeRoot();
    expect(problemsFor(root)).toEqual([]);
  });

  test('opencode.json with direct vsp server → flagged', () => {
    const root = makeRoot();
    writeFileSync(
      join(root, 'opencode.json'),
      JSON.stringify({ mcp: { vsp: { type: 'local', command: ['vsp', '--mode', 'hyperfocused'] } } }),
    );
    const problems = problemsFor(root);
    expect(problems.some((p) => p.includes('opencode.json') && p.includes('vsp directly'))).toBe(true);
  });

  test('opencode.json with abap routing through the proxy (argv-array shape) → pass', () => {
    const root = makeRoot();
    writeFileSync(
      join(root, 'opencode.json'),
      JSON.stringify({
        mcp: {
          abap: { type: 'local', command: ['bun', 'scripts/sap-mcp-proxy.ts', '--', '--mode', 'hyperfocused'] },
          trail: { type: 'local', command: ['trail', 'mcp'] },
        },
      }),
    );
    expect(problemsFor(root)).toEqual([]);
  });

  test('.claude/settings.json with trail-only mcpServers → pass (requireAbap: false)', () => {
    const root = makeRoot();
    mkdirSync(join(root, '.claude'));
    writeFileSync(
      join(root, '.claude/settings.json'),
      JSON.stringify({ permissions: { deny: [] }, mcpServers: { trail: { command: 'trail', args: ['mcp'] } } }),
    );
    expect(problemsFor(root)).toEqual([]);
  });

  test('.claude/settings.json without any mcpServers key (common shape) → pass', () => {
    const root = makeRoot();
    mkdirSync(join(root, '.claude'));
    writeFileSync(join(root, '.claude/settings.json'), JSON.stringify({ permissions: { deny: [] }, hooks: {} }));
    expect(problemsFor(root)).toEqual([]);
  });

  test('.claude/settings.json mcpServers with abap NOT routing through the proxy → flagged', () => {
    const root = makeRoot();
    mkdirSync(join(root, '.claude'));
    writeFileSync(
      join(root, '.claude/settings.json'),
      JSON.stringify({ mcpServers: { abap: { command: 'vsp' } } }),
    );
    const problems = problemsFor(root);
    expect(problems.some((p) => p.includes('.claude/settings.json') && p.includes('sap-mcp-proxy'))).toBe(true);
  });

  test('universal surfaces stay fail-on-missing (no conditional relaxation)', () => {
    const root = makeRoot();
    rmSync(join(root, '.agents/mcp.json'));
    expect(problemsFor(root)).toContain('.agents/mcp.json: missing');
  });
});

describe('serverArgv (U-20261112-015 argv shapes)', () => {
  test('mcpServers command+args string shape', () => {
    expect(serverArgv({ command: 'bun', args: ['scripts/sap-mcp-proxy.ts'] })).toEqual([
      'bun',
      'scripts/sap-mcp-proxy.ts',
    ]);
  });
  test('opencode command-array shape', () => {
    expect(serverArgv({ type: 'local', command: ['trail', 'mcp'] })).toEqual(['trail', 'mcp']);
  });
  test('http server (no command) → empty argv', () => {
    expect(serverArgv({ type: 'http', url: 'https://example.invalid/mcp' })).toEqual(['']);
  });
});
