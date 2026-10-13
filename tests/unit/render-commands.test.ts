import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderGeminiToml, splitFrontmatter, sync } from '../../scripts/render-commands.ts';

const SRC = `---
description: Run the full project sync pipeline.
gemini-parity: skip
---
Run the full project sync pipeline. Args: $ARGUMENTS
`;

function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'render-cmds-'));
  const dir = join(root, '.claude', 'commands');
  mkdirSync2(dir);
  for (const [n, c] of Object.entries(files)) writeFileSync(join(dir, n), c);
  return root;
}

function mkdirSync2(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

describe('renderGeminiToml', () => {
  test('$ARGUMENTS maps to {{args}} and frontmatter description wins', () => {
    const toml = renderGeminiToml('sync', SRC);
    expect(toml).toContain('description = "Run the full project sync pipeline."');
    expect(toml).toContain('{{args}}');
    expect(toml).not.toContain('$ARGUMENTS');
  });

  test('gemini-parity: skip sources are excluded from rendering by sync', () => {
    const root = fixture({ 'sync.md': SRC });
    expect(sync(root, false)).toEqual([]);
    rmSync(root, { recursive: true, force: true });
  });

  test('non-skip sources render a toml and drift is detected then fixed', () => {
    const root = fixture({ 'greet.md': '---\ndescription: Greet someone.\n---\nHello $ARGUMENTS\n' });
    let drift = sync(root, false);
    expect(drift).toEqual(['missing: .gemini/commands/greet.toml']);
    sync(root, true);
    const toml = readFileSync(join(root, '.gemini', 'commands', 'greet.toml'), 'utf-8');
    expect(toml).toContain('Hello {{args}}');
    drift = sync(root, false);
    expect(drift).toEqual([]);
    rmSync(root, { recursive: true, force: true });
  });
});

describe('splitFrontmatter', () => {
  test('splits frontmatter from body and strips quotes', () => {
    const { fm, body } = splitFrontmatter('---\ndescription: "Quoted"\n---\nBody');
    expect(fm.description).toBe('Quoted');
    expect(body).toBe('Body');
  });
});
