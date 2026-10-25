// U-20261026-002: the variant-context placement guard (helpers/variant-context.ts)
// consumed by audit.ts — a scaffolded project must keep docs/<variant>.context.md
// at the convention path; silent relocations strand the PM workflow-table reference.
import { describe, expect, test } from 'bun:test';
import { variantContextPlacement } from '../../scripts/helpers/variant-context.ts';

function fixture(files: Record<string, string>) {
  // root '.' so join('.', rel) === rel and the fixture keys match resolved paths
  const read = (p: string) => {
    if (p in files) return files[p];
    throw new Error('ENOENT');
  };
  const exists = (p: string) => p in files;
  return { read, exists };
}

describe('variantContextPlacement (U-20261026-002)', () => {
  test('pass: convention path present', () => {
    const fx = fixture({
      'variant.json': '{"name":"co-newbiz"}',
      'docs/co-newbiz.context.md': '# Context',
    });
    expect(variantContextPlacement('.', fx.read, fx.exists)).toEqual({
      status: 'pass',
      message: 'docs/co-newbiz.context.md present at the template-convention path',
    });
  });

  test('fail: relocated file (the co-newbiz 9-day silent move)', () => {
    const fx = fixture({
      'variant.json': '{"name":"co-newbiz"}',
      'docs/meta/co-newbiz.context.md': '# Context',
    });
    const finding = variantContextPlacement('.', fx.read, fx.exists);
    expect(finding.status).toBe('fail');
    expect(finding.message).toContain('docs/co-newbiz.context.md is MISSING');
    expect(finding.message).toContain('superseding relocation record');
  });

  test('skip: workspace root without variant.json', () => {
    const fx = fixture({});
    expect(variantContextPlacement('.', fx.read, fx.exists).status).toBe('skip');
  });

  test('skip: unreadable or nameless manifest', () => {
    const broken = fixture({ 'variant.json': '{not json' });
    expect(variantContextPlacement('/', broken.read, broken.exists).status).toBe('skip');
    const nameless = fixture({ 'variant.json': '{"displayName":"X"}' });
    expect(variantContextPlacement('/', nameless.read, nameless.exists).status).toBe('skip');
  });
});
