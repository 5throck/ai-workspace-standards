#!/usr/bin/env bun
// @version 1.0.0
// gitleaks-full-config-parity.test.ts — T-20261124-007 (design
// docs/designs/2026-11-25-upgrade-runner-machinery-batch-design.md §4.7): the
// full-scan secrets config delivered to fleet repositories is a byte copy of the
// root file; the path carries the engine LOCKED claim and sits in the
// fleetParityCarveOut, which the parity-closure guard admits only for LOCKED or
// MERGE_MANAGED paths.

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { resolveClaim } from '../../scripts/lib/upgrade-policy.ts';
import { parityClosureCheck } from '../../scripts/verify-prompt-integrity.ts';

const workspaceRoot = resolve(import.meta.dir, '..', '..');
const ROOT_FILE = join(workspaceRoot, '.github', 'gitleaks-full.toml');
const TEMPLATE_FILE = join(workspaceRoot, 'templates', 'common', '.github', 'gitleaks-full.toml');
const REL = '.github/gitleaks-full.toml';

describe('full-scan gitleaks config delivery (design §4.7)', () => {
  test('templates/common/.github/gitleaks-full.toml and .github/gitleaks-full.toml are byte-identical', () => {
    const root = readFileSync(ROOT_FILE);
    const template = readFileSync(TEMPLATE_FILE);
    expect(template.equals(root)).toBe(true);
    expect(root.length).toBeGreaterThan(0);
  });

  test('the path resolves to the engine LOCKED claim', () => {
    expect(resolveClaim(REL, '').policy).toBe('LOCKED');
  });

  test('the path is in the fleetParityCarveOut and the parity-closure guard stays clean', () => {
    const protectedPaths = JSON.parse(readFileSync(join(workspaceRoot, 'docs', 'protected-paths.json'), 'utf8')) as {
      fleetParityCarveOut: { paths: string[] };
    };
    expect(protectedPaths.fleetParityCarveOut.paths).toContain(REL);
    expect(parityClosureCheck(protectedPaths.fleetParityCarveOut.paths).ok).toBe(true);
  });
});
