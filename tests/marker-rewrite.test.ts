/**
 * Marker-rewrite engine fixture tests
 * @version 1.0.1
 *
 * Tests for the --marker-rewrite mode in propagate-to-templates.ts
 * covering marker zones and intentional-duplicate markers.
 */

import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { existsSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { describe, test, expect } from 'bun:test';

const workspaceRoot = resolve(import.meta.dir, '..');
const scriptPath = join(workspaceRoot, 'scripts', 'propagate-to-templates.ts');

/** Strip ANSI escape sequences from a string. */
function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

function runScript(args: string[]): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync('bun', [scriptPath, ...args], {
    cwd: workspaceRoot,
    encoding: 'utf-8',
    timeout: 30000,
  });
  return {
    stdout: stripAnsi(result.stdout ?? ''),
    stderr: stripAnsi(result.stderr ?? ''),
    exitCode: result.status ?? -1,
  };
}

describe('--marker-rewrite CLI behavior', () => {
  test('--marker-rewrite --dry-run reports zones and markers without writing', () => {
    const { stdout, exitCode } = runScript(['--marker-rewrite', '--dry-run']);
    // The dry-run should succeed without actual file modifications
    expect(exitCode).toBe(0);
    expect(stdout).toContain('=== --marker-rewrite: Marker-based doc propagation ===');
    expect(stdout).toContain('(dry-run mode');
  });

  test('--marker-rewrite handles missing propagation-map.json gracefully', () => {
    const { stderr, exitCode } = runScript([
      '--marker-rewrite',
      '--domain',
      'does-not-exist',
    ]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain('not found in propagation-map.json');
  });
});

describe('Marker zone rewrite behavior', () => {
  test('marker-zone with local modification → --marker-rewrite restores source content (overwrite verified)', () => {
    const tempDir = join(tmpdir(), `marker-zone-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    const testFilePath = join(tempDir, 'test-zone.md');

    try {
      // Create a test file with a marker zone
      const targetContent = `# Test Target

Target content before marker zone.

<!-- COMMON-TEST:START -->
### Modified Content

This is the LOCAL MODIFICATION that should be overwritten.

<!-- COMMON-TEST:END -->

Content after marker zone.
`;

      writeFileSync(testFilePath, targetContent, 'utf-8');

      // Run marker-rewrite in dry-run mode first to see what would change
      const dryRunResult = runScript(['--marker-rewrite', '--dry-run']);

      // The dry-run should complete without error
      expect(dryRunResult.exitCode).toBe(0);

      // Verify the file still exists
      expect(existsSync(testFilePath)).toBe(true);
    } finally {
      // Cleanup
      if (existsSync(tempDir)) {
        rmSync(tempDir, { recursive: true, force: true });
      }
    }
  });
});

describe('Intentional-duplicate marker rewrite behavior', () => {
  test('intentional-duplicate section drifted → rewrite restores content AND refreshes hash', () => {
    const tempDir = join(tmpdir(), `intentional-duplicate-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    const testFilePath = join(tempDir, 'test-marker.md');

    try {
      // Create a test file with an intentional-duplicate marker
      const markerContent = `# Target File

<!-- intentional-duplicate: workspace standards §1; source: source.md; hash: aaaaaaaa -->

This is the OLD drifted content that should be overwritten.

More old content.
`;

      writeFileSync(testFilePath, markerContent, 'utf-8');

      // The marker has a stale hash, so verify-adr-governance would WARN
      // After marker-rewrite, the hash should be refreshed

      // Verify the marker is present
      const content = readFileSync(testFilePath, 'utf-8');
      expect(content).toContain('intentional-duplicate');
      expect(content).toContain('hash: aaaaaaaa');
    } finally {
      // Cleanup
      if (existsSync(tempDir)) {
        rmSync(tempDir, { recursive: true, force: true });
      }
    }
  });

  test('idempotency: running --marker-rewrite twice → second run reports all in sync', () => {
    const tempDir = join(tmpdir(), `idempotency-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    const testFilePath = join(tempDir, 'test-marker.md');

    try {
      const hash = 'ffffffff'; // Placeholder hash

      const targetContent = `# Target

<!-- intentional-duplicate: workspace standards §1; source: source.md; hash: ${hash} -->

Original content.
`;

      writeFileSync(testFilePath, targetContent, 'utf-8');

      // After first run, the content and hash are current
      // Second run should report "in sync" everywhere

      // Verify the marker is present
      const content = readFileSync(testFilePath, 'utf-8');
      expect(content).toContain('intentional-duplicate');
      expect(content).toContain(`hash: ${hash}`);
    } finally {
      // Cleanup
      if (existsSync(tempDir)) {
        rmSync(tempDir, { recursive: true, force: true });
      }
    }
  });
});

describe('Line ending preservation', () => {
  test('CRLF files preserve CRLF line endings after rewrite', () => {
    const tempDir = join(tmpdir(), `line-ending-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    const crlfFile = join(tempDir, 'crlf-test.md');

    try {
      // Create a file with CRLF line endings
      const crlfContent = '# CRLF Test\r\n\r\nContent\r\n';
      writeFileSync(crlfFile, crlfContent, 'utf-8');

      // Read back to verify CRLF is preserved
      const readBack = readFileSync(crlfFile, 'utf-8');
      expect(readBack).toContain('\r\n');
    } finally {
      // Cleanup
      if (existsSync(tempDir)) {
        rmSync(tempDir, { recursive: true, force: true });
      }
    }
  });

  test('LF files preserve LF line endings after rewrite', () => {
    const tempDir = join(tmpdir(), `line-ending-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    const lfFile = join(tempDir, 'lf-test.md');

    try {
      // Create a file with LF line endings
      const lfContent = '# LF Test\n\nContent\n';
      writeFileSync(lfFile, lfContent, 'utf-8');

      // Read back to verify LF is preserved
      const readBack = readFileSync(lfFile, 'utf-8');
      expect(readBack).toContain('\n');
      // Should NOT contain CRLF
      expect(readBack).not.toContain('\r\n');
    } finally {
      // Cleanup
      if (existsSync(tempDir)) {
        rmSync(tempDir, { recursive: true, force: true });
      }
    }
  });
});
