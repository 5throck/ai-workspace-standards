#!/usr/bin/env bun
// @version 1.0.0
// extract-script-dependencies.test.ts — shape-corpus pins for the rewritten
// extractScriptDependencies (scripts/generate-version-manifest.ts).
//
// Spec: docs/designs/2026-11-09-delivered-scripts-strict-profile-design.md §4.4
// (U-20261108-001, DEC-20261109-01). The previous three-probe extractor had a
// dead node-import branch (`import * from` matches no real shape), a dead bun
// probe, counted bare builtins (`fs`, `path`) as external deps, and truncated
// `@scope/pkg` to `@scope`. The rewrite is quote-agnostic and shape-complete so
// the import-protocol sweep cannot drift the VERSION_MANIFEST deps column.
// The fixture corpus covers every import style × quote style × specifier class,
// including the two real pre/post-conversion excerpts named by the design.

import { describe, test, expect } from 'bun:test';
import { extractScriptDependencies } from '../../scripts/generate-version-manifest.ts';

describe('extractScriptDependencies (design 2026-11-09-delivered-scripts-strict-profile §4.4)', () => {
  test('single quotes: all import shapes classify', () => {
    const src = [
      "import * as fs from 'node:fs';",
      "import path from 'path';",
      "import { join } from 'node:path';",
      "import x, { a, b } from 'external-pkg';",
      "import './side-effect.ts';",
      "import { $ } from 'bun';",
    ].join('\n');
    expect(extractScriptDependencies(src)).toEqual(['bun', 'external-pkg', 'fs', 'path']);
  });

  test('double quotes: same classification (quote-agnostic — the pre-sweep bug)', () => {
    const src = [
      'import * as fs from "node:fs";',
      'import path from "path";',
      'import { join } from "node:path";',
      'import x, { a, b } from "external-pkg";',
      'import "./side-effect.ts";',
      'import { $ } from "bun";',
    ].join('\n');
    expect(extractScriptDependencies(src)).toEqual(['bun', 'external-pkg', 'fs', 'path']);
  });

  test('node: protocol strips to the builtin name (incl. subpaths)', () => {
    expect(extractScriptDependencies('import { Database } from "node:sqlite";')).toEqual(['sqlite']);
    expect(extractScriptDependencies('import { readFile } from "node:fs/promises";')).toEqual(['fs']);
    expect(extractScriptDependencies("import * as cp from 'node:child_process';")).toEqual(['child_process']);
  });

  test('bare builtins are builtin deps, NOT external (misclassification fixed)', () => {
    // The classification bucket differs from the old extractor even though the
    // rendered name is the same; the pin is that they render as builtin names
    // and survive the protocol conversion unchanged.
    const pre = 'import fs from "fs";\nimport { resolve } from "path";';
    expect(extractScriptDependencies(pre)).toEqual(['fs', 'path']);
  });

  test('relative and absolute specifiers are skipped', () => {
    const src = [
      'import { a } from "./lib/x.ts";',
      'import { b } from "../up/y.ts";',
      'import { c } from "/abs/z.ts";',
      'import "./side-effect.ts";',
    ].join('\n');
    expect(extractScriptDependencies(src)).toEqual([]);
  });

  test('@scope/pkg keeps the full scoped name (not truncated to @scope)', () => {
    expect(extractScriptDependencies('import { thing } from "@scope/pkg";')).toEqual(['@scope/pkg']);
    expect(extractScriptDependencies('import { sub } from "@scope/pkg/entry";')).toEqual(['@scope/pkg']);
  });

  test('unscoped externals reduce to the first path segment', () => {
    expect(extractScriptDependencies('import { z } from "zod";')).toEqual(['zod']);
    expect(extractScriptDependencies('import { q } from "quasar/entry/nested";')).toEqual(['quasar']);
    expect(extractScriptDependencies("import * as yaml from 'js-yaml';")).toEqual(['js-yaml']);
  });

  test('type-only imports classify like value imports (old-extractor parity)', () => {
    expect(extractScriptDependencies('import type { Foo } from "type-pkg";')).toEqual(['type-pkg']);
    expect(extractScriptDependencies('import type { Bar } from "node:util";')).toEqual(['util']);
  });

  test('multi-line named-import bodies are captured (290-site corpus shape)', () => {
    const src = [
      'import {',
      '  copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync,',
      '} from "node:fs";',
      'import {',
      '  alpha,',
      '  beta,',
      '} from "multi-dep";',
    ].join('\n');
    expect(extractScriptDependencies(src)).toEqual(['fs', 'multi-dep']);
  });

  test('prose mentioning imports mid-line is not matched (^ anchor parity)', () => {
    const src = [
      '// We import foo from "fake-pkg" in this module (comment).',
      'const s = "you can import bar from \'another-fake\' here";',
      'See also: import baz from "prose-fake" in the docs below.',
    ].join('\n');
    expect(extractScriptDependencies(src)).toEqual([]);
  });

  test('output is deduplicated and sorted', () => {
    const src = 'import { a } from "z-pkg";\nimport { b } from "a-pkg";\nimport { c } from "node:fs";\nimport { d } from "a-pkg";';
    expect(extractScriptDependencies(src)).toEqual(['a-pkg', 'fs', 'z-pkg']);
  });

  test('real excerpt: verify-scripts.ts pre-conversion (design-pinned fixture)', () => {
    // scripts/verify-scripts.ts:81-85 at implementation time — namespace import
    // of a bare builtin in double quotes, the shape the dead node-import branch
    // could never see and the double-quote sweep would have broken.
    const pre = [
      'import * as fs from "fs";',
      'import { createHash } from "node:crypto";',
      'import { readFileSync, readdirSync, existsSync, writeFileSync } from "fs";',
      'import { join, dirname, relative } from "path";',
      'import { scrubConstitutionRefs } from "./lib/constitution-scrub.ts";',
    ].join('\n');
    expect(extractScriptDependencies(pre)).toEqual(['crypto', 'fs', 'path']);
  });

  test('real excerpt: verify-scripts.ts post-conversion — deps unchanged', () => {
    // Same file after the useNodejsImportProtocol sweep: only specifier shapes
    // changed, so the deps column must be byte-identical (G4 no-churn pin).
    const post = [
      'import * as fs from "node:fs";',
      'import { createHash } from "node:crypto";',
      'import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";',
      'import { join, dirname, relative } from "node:path";',
      'import { scrubConstitutionRefs } from "./lib/constitution-scrub.ts";',
    ].join('\n');
    expect(extractScriptDependencies(post)).toEqual(['crypto', 'fs', 'path']);
  });

  test('real excerpt: validate-doc-folder.ts pre/post — deps unchanged', () => {
    // scripts/validate-doc-folder.ts:25-28 at implementation time — default
    // imports of bare builtins in single quotes.
    const pre = [
      "import fs from 'fs';",
      "import path from 'path';",
      "import { resolve } from 'node:path';",
      "import { ErrorPhase, die, withSyncErrorHandling } from './lib/error-handling.ts';",
    ].join('\n');
    const post = [
      'import fs from "node:fs";',
      'import path from "node:path";',
      'import { resolve } from "node:path";',
      'import { ErrorPhase, die, withSyncErrorHandling } from "./lib/error-handling.ts";',
    ].join('\n');
    expect(extractScriptDependencies(pre)).toEqual(['fs', 'path']);
    expect(extractScriptDependencies(post)).toEqual(['fs', 'path']);
  });

  test('real excerpt: hub-promotion.ts multi-line node:fs import now visible', () => {
    // The defect symptom: scripts/hub-promotion.ts imports node:fs ONLY via a
    // multi-line named import, so the old extractor rendered its deps as N/A.
    const real = [
      'import {',
      '  copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmdirSync, renameSync, rmSync, statSync, writeFileSync,',
      "} from 'node:fs';",
      "import { tmpdir } from 'node:os';",
    ].join('\n');
    expect(extractScriptDependencies(real)).toEqual(['fs', 'os']);
  });
});
