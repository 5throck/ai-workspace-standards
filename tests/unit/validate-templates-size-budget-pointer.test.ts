#!/usr/bin/env bun
// @version 1.0.0
// validate-templates-size-budget-pointer.test.ts — D2 pointer integrity
//
// Asserts that the size-budget Fix string pointers (design 2026-10-03-validator-warning-fixes-design §2.2)
// reference valid documentation sections and that old stale references are removed.

import { test, expect, describe } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

const ROOT = cwd();

describe('validate-templates-size-budget-pointer (design 2026-10-03-validator-warning-fixes-design §2.2)', () => {
  test('HERMES.md contains "Hermes Platform Mechanics" section heading', () => {
    const content = readFileSync(join(ROOT, 'HERMES.md'), 'utf-8');
    expect(content).toContain('Hermes Platform Mechanics');
  });

  test('HERMES.md contains context_file_max_chars configuration key', () => {
    const content = readFileSync(join(ROOT, 'HERMES.md'), 'utf-8');
    expect(content).toContain('context_file_max_chars');
  });

  test('CONSTITUTION.md contains "### 11. Governance Enforcement Layers" section', () => {
    const content = readFileSync(join(ROOT, 'CONSTITUTION.md'), 'utf-8');
    expect(content).toContain('### 11. Governance Enforcement Layers');
  });

  test('CONSTITUTION.md contains context_file_max_chars in section 11', () => {
    const content = readFileSync(join(ROOT, 'CONSTITUTION.md'), 'utf-8');
    const section11Match = content.match(/### 11\. Governance Enforcement Layers([\s\S]*?)(?:## |$)/);
    expect(section11Match).toBeTruthy();
    if (section11Match) {
      expect(section11Match[1]).toContain('context_file_max_chars');
    }
  });

  test('validate-templates.ts no longer references AGENTS.md §6 in size-budget Fix', () => {
    const content = readFileSync(join(ROOT, 'scripts', 'validate-templates.ts'), 'utf-8');
    // Should NOT contain the old pointer
    expect(content).not.toContain('see the config backstop in AGENTS.md §6');
  });

  test('validate-templates.ts contains the new HERMES.md + CONSTITUTION.md pointer in size-budget Fix', () => {
    const content = readFileSync(join(ROOT, 'scripts', 'validate-templates.ts'), 'utf-8');
    // Should contain the new pointer references
    expect(content).toContain('HERMES.md "Hermes Platform Mechanics"');
    expect(content).toContain('context_file_max_chars');
    expect(content).toContain('CONSTITUTION.md §11');
  });
});
