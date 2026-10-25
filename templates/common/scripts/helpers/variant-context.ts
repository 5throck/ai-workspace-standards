#!/usr/bin/env bun
// @version 1.0.0
// v1.0.0 (2026-10-26, U-20261026-002): variant-context placement guard — the
// convention renders templates/common/docs/variant.context.template.md to
// docs/<variant>.context.md and the PM workflow table references that path;
// co-newbiz relocated the file for 9 days with no gate noticing. Pure helper
// (fs injected) consumed by audit.ts's placement check.

import { join } from 'node:path';

export interface VariantContextFinding {
  status: 'pass' | 'fail' | 'skip';
  message: string;
}

const NAME_RE = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Assert the convention path docs/<variant>.context.md exists for the scaffolded
 * project at `root` (variant.json present). `readFile`/`exists` are injected so
 * tests can drive fixtures without a real tree. Returns 'skip' for non-project
 * roots (no variant.json) and unreadable/unnamed manifests.
 */
export function variantContextPlacement(
  root: string,
  readFile: (p: string) => string,
  exists: (p: string) => boolean,
): VariantContextFinding {
  const manifestPath = join(root, 'variant.json');
  if (!exists(manifestPath)) {
    return { status: 'skip', message: 'no variant.json — not a scaffolded project' };
  }
  let name = '';
  try {
    name = JSON.parse(readFile(manifestPath)).name ?? '';
  } catch {
    return { status: 'skip', message: 'variant.json unreadable' };
  }
  if (typeof name !== 'string' || !NAME_RE.test(name)) {
    return { status: 'skip', message: 'variant.json has no usable variant name' };
  }
  const expected = `docs/${name}.context.md`;
  if (exists(join(root, expected))) {
    return { status: 'pass', message: `${expected} present at the template-convention path` };
  }
  return {
    status: 'fail',
    message: `${expected} is MISSING — the convention renders variant.context.template.md to that path and the PM workflow table references it; return the file to the convention path or register a superseding relocation record (U-20261026-002)`,
  };
}
