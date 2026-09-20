import { describe, test, expect } from 'bun:test';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  barePackageName,
  barePackageImports,
  missingDependencies,
  scanDeliveredScripts,
} from '../../scripts/lib/dependency-guard';

describe('dependency-guard barePackageName', () => {
  test('collapses subpaths to package names', () => {
    expect(barePackageName('js-yaml')).toBe('js-yaml');
    expect(barePackageName('js-yaml/dist/types')).toBe('js-yaml');
    expect(barePackageName('@scope/pkg/sub')).toBe('@scope/pkg');
    expect(barePackageName('@scope/pkg')).toBe('@scope/pkg');
  });

  test('returns null for relative, absolute, and runtime-prefixed specifiers', () => {
    expect(barePackageName('./helper')).toBeNull();
    expect(barePackageName('../lib/x')).toBeNull();
    expect(barePackageName('/abs/path')).toBeNull();
    expect(barePackageName('node:fs')).toBeNull();
    expect(barePackageName('node:fs/promises')).toBeNull();
    expect(barePackageName('bun:test')).toBeNull();
  });

  test('returns null for runtime builtins imported without a prefix', () => {
    expect(barePackageName('fs')).toBeNull();
    expect(barePackageName('child_process')).toBeNull();
    expect(barePackageName('bun')).toBeNull();
  });

  test('returns null for interpolated or prose-like specifiers', () => {
    expect(barePackageName('${inputPath}')).toBeNull();
    expect(barePackageName('evidence parsed, zero symptoms')).toBeNull();
    expect(barePackageName('git remote get-url origin')).toBeNull();
  });
});

describe('dependency-guard barePackageImports', () => {
  test('extracts from all import forms', () => {
    const code = [
      "import * as yaml from 'js-yaml';",
      'import x from "@scope/pkg";',
      "const { a } = require('left-pad');",
      "const mod = await import('kysely');",
      "import 'side-effect-only';",
    ].join('\n');
    expect(barePackageImports(code)).toEqual(new Set(['js-yaml', '@scope/pkg', 'left-pad', 'kysely', 'side-effect-only']));
  });

  test('same-line matching only — newline after keyword does not capture prose', () => {
    const code = [
      '// The word import at line end',
      "  'evidence parsed, zero symptoms'",
      'import * as fs from "fs";',
    ].join('\n');
    expect(barePackageImports(code).size).toBe(0);
  });

  test('skips builtins and relatives, keeps real packages', () => {
    const code = [
      "import { spawnSync } from 'child_process';",
      "import { readFileSync } from 'node:fs';",
      "import { security } from './helpers/security-validator';",
      "import { $ } from 'bun';",
      "import * as yaml from 'js-yaml';",
    ].join('\n');
    expect(barePackageImports(code)).toEqual(new Set(['js-yaml']));
  });
});

describe('dependency-guard missingDependencies', () => {
  test('returns sorted undeclared imports', () => {
    expect(missingDependencies(new Set(['js-yaml']), ['zod', 'js-yaml', 'accepts'])).toEqual(['accepts', 'zod']);
  });
  test('empty when everything declared', () => {
    expect(missingDependencies(new Set(['js-yaml']), ['js-yaml'])).toEqual([]);
  });
});

describe('dependency-guard scanDeliveredScripts', () => {
  const root = join(tmpdir(), `dep-guard-${Date.now()}`);
  const scripts = join(root, 'scripts');

  test('aggregates imports per package with importing files', () => {
    mkdirSync(join(scripts, 'helpers'), { recursive: true });
    writeFileSync(join(scripts, 'top.ts'), "import * as yaml from 'js-yaml';\n");
    writeFileSync(join(scripts, 'helpers', 'pm-md-parser.ts'), "import * as yaml from 'js-yaml';\nimport { z } from 'zod';\n");
    const result = scanDeliveredScripts([scripts], root);
    const yaml = result.find((r) => r.pkg === 'js-yaml');
    expect(yaml?.importedBy).toEqual(['scripts/helpers/pm-md-parser.ts', 'scripts/top.ts']);
    expect(result.find((r) => r.pkg === 'zod')?.importedBy).toEqual(['scripts/helpers/pm-md-parser.ts']);
    rmSync(root, { recursive: true, force: true });
  });
});
