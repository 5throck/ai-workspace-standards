#!/usr/bin/env bun
// @version 1.0.0
// verify-scripts-extensions.test.ts — T-20260909-003 .bat registry governance
//
// Contract: SCRIPT_EXTENSIONS must keep governing the legacy cross-platform trio
// (.sh/.ps1/.ts) AND Windows batch helpers (.bat) — before v1.6.0 a shipped
// setup.bat escaped every unregistered-script check because the scanner ignored
// the extension.

import { test, expect, describe } from 'bun:test';
import { SCRIPT_EXTENSIONS } from '../../scripts/verify-scripts.ts';

describe('SCRIPT_EXTENSIONS (T-20260909-003)', () => {
  test('governs .bat alongside the legacy trio', () => {
    for (const ext of ['.sh', '.ps1', '.ts', '.bat']) {
      expect(SCRIPT_EXTENSIONS).toContain(ext);
    }
  });

  test('contains exactly the four governed extensions', () => {
    expect(SCRIPT_EXTENSIONS).toHaveLength(4);
  });
});
