/**
 * Unit tests for scripts/lib/env-sample.ts — the shared .env.sample engine behind
 * scaffold-time pruning (helpers/prune-country-scoped-assets.ts) and upgrade-time
 * delivery (upgrade-project.ts ENV_SAMPLE SYNC pass, v1.23.0). Both callers must agree
 * on the country-marker grammar and the keep/drop decision, or an upgrade re-injects
 * country blocks the scaffold pruned. mergeEnvSample additionally guards the
 * data-loss class found in the 2026-09-12 fleet inspection: wholesale delivery clobbered
 * project-only keys (Projects/co-price carries 16).
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import {
  pruneCountryScopedEnvBlocks,
  mergeEnvSample,
  PROJECT_ENV_SECTION_HEADER,
} from '../../scripts/lib/env-sample.ts';

const KR_BLOCK = [
  '# >>> country-scoped:KR',
  'DART_API_KEY=your_dart_api_key_here',
  'KOSIS_API_KEY=your_kosis_api_key_here',
  '# <<< country-scoped:KR',
].join('\n');

const JP_BLOCK = [
  '# >>> country-scoped:JP',
  'JP_EXAMPLE_KEY=your_jp_key_here',
  '# <<< country-scoped:JP',
].join('\n');

function withHeader(...blocks: string[]): string {
  return ['# .env.sample — copy to .env and fill in values', ...blocks, '# [KEY_NAME]=[description]'].join('\n\n');
}

describe('env-sample pruneCountryScopedEnvBlocks — keep/drop decision', () => {
  test('matching country keeps its block', () => {
    const content = withHeader(KR_BLOCK);
    const result = pruneCountryScopedEnvBlocks(content, 'KR');
    expect(result.unbalanced).toBe(false);
    expect(result.pruned).toEqual([]);
    expect(result.output).toBe(content);
  });

  test('non-matching country prunes the block, surrounding content preserved', () => {
    const content = withHeader(KR_BLOCK);
    const result = pruneCountryScopedEnvBlocks(content, 'US');
    expect(result.pruned).toEqual(['KR']);
    // Both blank lines surrounding the removed block (outside its markers) survive.
    expect(result.output).toBe('# .env.sample — copy to .env and fill in values\n\n\n# [KEY_NAME]=[description]');
  });

  test("country 'none' (region-neutral) prunes ALL blocks", () => {
    const content = withHeader(KR_BLOCK, JP_BLOCK);
    const result = pruneCountryScopedEnvBlocks(content, 'none');
    expect(result.pruned).toEqual(['KR', 'JP']);
    expect(result.output).not.toContain('DART_API_KEY');
    expect(result.output).not.toContain('JP_EXAMPLE_KEY');
    expect(result.output).toContain('# [KEY_NAME]=[description]');
  });

  test("empty country prunes ALL blocks (scaffold helper's '' alias)", () => {
    const result = pruneCountryScopedEnvBlocks(withHeader(KR_BLOCK), '');
    expect(result.pruned).toEqual(['KR']);
  });

  test('mixed blocks: matching kept in place, mismatched dropped, order preserved', () => {
    const content = withHeader(KR_BLOCK, JP_BLOCK);
    const result = pruneCountryScopedEnvBlocks(content, 'KR');
    expect(result.pruned).toEqual(['JP']);
    expect(result.output).toContain('# >>> country-scoped:KR');
    expect(result.output).toContain('DART_API_KEY');
    expect(result.output).not.toContain('JP_EXAMPLE_KEY');
    expect(result.output).toContain('# [KEY_NAME]=[description]');
  });

  test('content without markers passes through untouched', () => {
    const content = 'FOO=bar\nBAZ=qux\n';
    const result = pruneCountryScopedEnvBlocks(content, 'none');
    expect(result.output).toBe(content);
    expect(result.pruned).toEqual([]);
    expect(result.warnings).toEqual([]);
  });
});

describe('env-sample pruneCountryScopedEnvBlocks — unbalanced marker safety', () => {
  test('nested opening marker: file left unchanged with a warning', () => {
    const content = [
      '# >>> country-scoped:KR',
      '# >>> country-scoped:JP',
      '# <<< country-scoped:JP',
      '# <<< country-scoped:KR',
    ].join('\n');
    const result = pruneCountryScopedEnvBlocks(content, 'KR');
    expect(result.unbalanced).toBe(true);
    expect(result.output).toBe(content);
    expect(result.pruned).toEqual([]);
    expect(result.warnings[0]).toContain('nested opening marker');
    expect(result.warnings[0]).toContain('line 2');
  });

  test('closing marker without opening: file left unchanged', () => {
    const content = '# <<< country-scoped:KR\nFOO=bar';
    const result = pruneCountryScopedEnvBlocks(content, 'none');
    expect(result.unbalanced).toBe(true);
    expect(result.output).toBe(content);
    expect(result.warnings[0]).toContain('closing marker without opening');
  });

  test('closing code mismatch: file left unchanged', () => {
    const content = '# >>> country-scoped:KR\nKEY=val\n# <<< country-scoped:JP';
    const result = pruneCountryScopedEnvBlocks(content, 'KR');
    expect(result.unbalanced).toBe(true);
    expect(result.output).toBe(content);
    expect(result.warnings[0]).toContain("'JP'");
    expect(result.warnings[0]).toContain("'KR'");
  });

  test('unclosed block at EOF: file left unchanged', () => {
    const content = 'FOO=bar\n# >>> country-scoped:KR\nKEY=val';
    const result = pruneCountryScopedEnvBlocks(content, 'none');
    expect(result.unbalanced).toBe(true);
    expect(result.output).toBe(content);
    expect(result.warnings[0]).toContain('no closing marker');
  });
});

describe('env-sample pruneCountryScopedEnvBlocks — idempotence', () => {
  test('pruning an already-pruned file is a no-op', () => {
    const once = pruneCountryScopedEnvBlocks(withHeader(KR_BLOCK, JP_BLOCK), 'KR');
    const twice = pruneCountryScopedEnvBlocks(once.output, 'KR');
    expect(twice.output).toBe(once.output);
    expect(twice.pruned).toEqual([]);
  });

  test('real templates/common/.env.sample shape: KR project keeps the KR block intact', () => {
    // Mirrors the live template structure (comment + multiple keys inside the block).
    const content = [
      '# .env.sample — copy to .env and fill in values',
      '# All variables listed here are required unless marked [optional]',
      '',
      '# >>> country-scoped:KR',
      '# Korean Financial Supervisory Service DART OpenAPI key',
      'DART_API_KEY=your_dart_api_key_here',
      '',
      '# Korea Exchange (KRX) Data Marketplace OPEN API key',
      'KRX_API_KEY=your_krx_api_key_here',
      '# <<< country-scoped:KR',
      '',
      '# If this project has no environment variables, leave this file with only this comment.',
    ].join('\n');
    const result = pruneCountryScopedEnvBlocks(content, 'KR');
    expect(result.unbalanced).toBe(false);
    expect(result.output).toBe(content);
  });
});

describe('env-sample mergeEnvSample — project-key preservation (co-price class)', () => {
  const TEMPLATE = [
    '# .env.sample — copy to .env and fill in values',
    '# All variables listed here are required unless marked [optional]',
    '',
    '# [KEY_NAME]=[description]',
    '# If this project has no environment variables, leave this file with only this comment.',
  ].join('\n');

  test('fully customized project copy: all project-only keys preserved under the header', () => {
    // Mirrors Projects/co-price: section dividers, inline comments, empty/quoted values.
    const project = [
      '# .env.sample — copy to .env and fill in values',
      '# All variables listed here are required unless marked [optional]',
      '',
      '# ── Core ─────────────────────────────────────────────────────────────────',
      'DATABASE_URL="file:./prisma/dev.db"',
      'NEXTAUTH_URL=http://localhost:9981        # must match the public HTTPS origin',
      'NEXTAUTH_SECRET=generate_via_openssl_rand_base64_32',
      '',
      '# Server-side only. NEVER commit real keys. Values below are placeholders.',
      'PRICE_PROVIDER=claude                     # claude | gemini | codex | zai',
      'PRICE_ZAI_MODEL=glm-4.6',
    ].join('\n');

    const result = mergeEnvSample(TEMPLATE, project);
    expect(result.preservedKeys).toEqual(['DATABASE_URL', 'NEXTAUTH_URL', 'NEXTAUTH_SECRET', 'PRICE_PROVIDER', 'PRICE_ZAI_MODEL']);
    expect(result.overriddenKeys).toEqual([]);
    expect(result.output).toContain(TEMPLATE); // template boilerplate delivered
    expect(result.output).toContain(PROJECT_ENV_SECTION_HEADER);
    expect(result.output).toContain('# ── Core ─────');
    expect(result.output).toContain('PRICE_ZAI_MODEL=glm-4.6');
    // template boilerplate NOT duplicated
    expect(result.output.split('# [KEY_NAME]=[description]').length - 1).toBe(1);
  });

  test('idempotent: re-merging its own output is a no-op', () => {
    const project = 'MY_KEY=a\n\n# note about MY_OTHER\nMY_OTHER=b\n';
    const once = mergeEnvSample(TEMPLATE, project);
    const twice = mergeEnvSample(TEMPLATE, once.output);
    expect(twice.output).toBe(once.output);
    expect(twice.preservedKeys).toEqual(once.preservedKeys);
  });

  test('project keys arrive with no leftover double blank lines', () => {
    const project = '# .env.sample — copy to .env and fill in values\n\n\n\nA_KEY=1\n\n\n\nB_KEY=2\n\n\n';
    const result = mergeEnvSample(TEMPLATE, project);
    expect(result.output).not.toMatch(/\n{3,}/);
  });
});

describe('env-sample mergeEnvSample — template-wins semantics (co-newbiz / co-safety class)', () => {
  const TEMPLATE_KR = withHeader(
    ['# >>> country-scoped:KR', 'DART_API_KEY=your_dart_api_key_here', 'KOSIS_API_KEY=your_kosis_api_key_here', 'ECOS_API_KEY=your_ecos_api_key_here', '# <<< country-scoped:KR'].join('\n'),
  );

  test('same-NAME key with diverging project line is superseded (placeholder normalization)', () => {
    const project = [
      '# >>> country-scoped:KR',
      'DART_API_KEY=your_dart_api_key_here',
      'LAW_API_OC=your_oc_key_here', // hand-customized placeholder — key IS in template? no: not a template key → preserved
      'ECOS_API_KEY=stale-project-value', // stale hand-added line — name is in the updated template
      '# <<< country-scoped:KR',
    ].join('\n');
    const result = mergeEnvSample(TEMPLATE_KR, project);
    expect(result.overriddenKeys).toEqual(['ECOS_API_KEY']);
    expect(result.output).toContain('ECOS_API_KEY=your_ecos_api_key_here');
    expect(result.output).not.toContain('stale-project-value');
    // LAW_API_OC is not a template key → preserved as project-only
    expect(result.preservedKeys).toEqual(['LAW_API_OC']);
  });

  test('stale country block is updated to the new template block (added keys arrive)', () => {
    // co-export class: project has an old 4-key block, template now ships 6 — the
    // updated block must arrive; project-only extras below the boilerplate must survive.
    const project = [
      '# .env.sample — copy to .env and fill in values',
      '# >>> country-scoped:KR',
      'DART_API_KEY=your_dart_api_key_here',
      'KOSIS_API_KEY=your_kosis_api_key_here',
      '# <<< country-scoped:KR',
      '',
      'CO_NEWBIZ_API_BASE_URL=http://localhost:8787',
      'CO_NEWBIZ_API_TOKEN=your_co_newbiz_api_token_here',
    ].join('\n');
    const result = mergeEnvSample(TEMPLATE_KR, project);
    expect(result.output).toContain('ECOS_API_KEY=your_ecos_api_key_here'); // arrived via template
    expect(result.output).toContain('CO_NEWBIZ_API_TOKEN=your_co_newbiz_api_token_here'); // preserved
    expect(result.preservedKeys).toEqual(['CO_NEWBIZ_API_BASE_URL', 'CO_NEWBIZ_API_TOKEN']);
  });

  test('commented-out documentation keys are preserved verbatim', () => {
    const project = [
      '# Optional research sources:',
      '# TAVILY_API_KEY=your_tavily_api_key_here',
      '# CO_NEWBIZ_DD_TAILOR_AGENTS=tavily',
    ].join('\n');
    const result = mergeEnvSample(TEMPLATE_KR, project);
    expect(result.output).toContain('# TAVILY_API_KEY=your_tavily_api_key_here');
    expect(result.output).toContain('# CO_NEWBIZ_DD_TAILOR_AGENTS=tavily');
    expect(result.preservedKeys).toEqual([]); // comments are preserved, but they are not keys
  });

  test('idempotent on a merged country-aware output', () => {
    const project = [
      '# .env.sample — copy to .env and fill in values',
      '# >>> country-scoped:KR',
      'DART_API_KEY=your_dart_api_key_here',
      '# <<< country-scoped:KR',
      '',
      'MY_PROJECT_KEY=1',
    ].join('\n');
    const once = mergeEnvSample(TEMPLATE_KR, project);
    const twice = mergeEnvSample(TEMPLATE_KR, once.output);
    expect(twice.output).toBe(once.output);
  });

  test('template already fully present: no additions section, output equals template', () => {
    const result = mergeEnvSample(TEMPLATE_KR, TEMPLATE_KR + '\n');
    expect(result.output).toBe(TEMPLATE_KR + '\n');
    expect(result.preservedKeys).toEqual([]);
  });
});
