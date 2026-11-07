/**
 * Unit tests for scripts/check-handbook-archmap-drift.ts
 * (spec docs/designs/2026-11-07-handbook-archmap-drift-check-design.md).
 *
 * Temp-dir fixtures: a fake workspace root with docs/architecture/ canonical
 * files and a Handbooks/ dir holding both copy forms for both handbooks.
 *
 * @version 1.0.0
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  checkDrift,
  canonicalBody,
  inlineBody,
  normalizeBody,
  HANDBOOKS,
  LOCALES,
} from '../../scripts/check-handbook-archmap-drift.ts';

const SCRIPT = resolve(import.meta.dir, '../../scripts/check-handbook-archmap-drift.ts');

function canonicalSvg(locale: string): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" lang="${locale}">`,
    `<title>map ${locale}</title>`,
    `<rect width="100" height="100" fill="#fafafa"/>`,
    `<text x="1" y="2">.trail/</text>`,
    `</svg>`,
    ``,
  ].join('\n');
}

function pageHtml(locale: string, body: string, rootAttrs = `width="100%" role="img" aria-label="map" lang="${locale}"`): string {
  return [
    `<!doctype html><html><body>`,
    `  <h1>Appendix</h1>`,
    `  <div class="diagram-frame"><svg viewBox="0 0 100 100" ${rootAttrs}>`,
    body,
    `</svg></div>`,
    `  <p>caption</p>`,
    `</body></html>`,
    ``,
  ].join('\n');
}

function bodyOf(svg: string): string {
  const lines = svg.split('\n');
  return lines.slice(1, lines.indexOf('</svg>')).join('\n');
}

let root: string;

function build(): void {
  const arch = join(root, 'docs', 'architecture');
  mkdirSync(arch, { recursive: true });
  for (const loc of LOCALES) writeFileSync(join(arch, `workspace-architecture${loc.assetSuffix}.svg`), canonicalSvg(loc.id));
  for (const hb of HANDBOOKS) {
    const img = join(root, 'Handbooks', hb.dir, 'docs', 'assets', 'img');
    const app = join(root, 'Handbooks', hb.dir, 'docs', 'appendix');
    mkdirSync(img, { recursive: true });
    mkdirSync(app, { recursive: true });
    for (const loc of LOCALES) {
      writeFileSync(join(img, `workspace-architecture${loc.assetSuffix}.svg`), canonicalSvg(loc.id));
      writeFileSync(join(app, `${hb.page}${loc.pageSuffix}.html`), pageHtml(loc.id, bodyOf(canonicalSvg(loc.id))));
    }
  }
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'archmap-drift-'));
  build();
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('checkDrift', () => {
  test('identical copies → all 16 PASS, no drift', () => {
    const r = checkDrift({ root });
    expect(r.error).toBeUndefined();
    expect(r.results).toHaveLength(HANDBOOKS.length * LOCALES.length * 2);
    expect(r.results.every((x) => x.status === 'PASS')).toBe(true);
    expect(r.drift).toBe(0);
  });

  test('changed asset copy → DRIFT for that asset only', () => {
    const p = join(root, 'Handbooks', 'intro-to-ai-harness', 'docs', 'assets', 'img', 'workspace-architecture.en.svg');
    writeFileSync(p, readFileSync(p, 'utf8').replace('.trail/', 'graft/'));
    const r = checkDrift({ root });
    expect(r.drift).toBe(1);
    const d = r.results.find((x) => x.status === 'DRIFT')!;
    expect(d).toMatchObject({ handbook: 'intro-to-ai-harness', locale: 'en', form: 'asset' });
  });

  test('asset copy differing only in trailing newline → DRIFT (byte-for-byte, no normalization)', () => {
    const p = join(root, 'Handbooks', 'intro-to-ai-harness', 'docs', 'assets', 'img', 'workspace-architecture.svg');
    writeFileSync(p, readFileSync(p, 'utf8') + '\n');
    expect(checkDrift({ root }).drift).toBe(1);
  });

  test('changed inline body → DRIFT for that page only', () => {
    const p = join(root, 'Handbooks', 'multi-agent-harness-handbook', 'docs', 'appendix', 'E_Workspace_Architecture_ja.html');
    writeFileSync(p, readFileSync(p, 'utf8').replace('.trail/', 'graft/'));
    const r = checkDrift({ root });
    expect(r.drift).toBe(1);
    expect(r.results.find((x) => x.status === 'DRIFT')).toMatchObject({ handbook: 'multi-agent-harness-handbook', locale: 'ja', form: 'inline' });
  });

  test('root-tag attribute differences alone → still PASS', () => {
    const p = join(root, 'Handbooks', 'intro-to-ai-harness', 'docs', 'appendix', 'G_Workspace_Architecture_es.html');
    writeFileSync(p, pageHtml('es', bodyOf(canonicalSvg('es')), 'width="80%" role="figure" aria-label="otro texto" lang="es-ES" font-family="serif"'));
    const r = checkDrift({ root });
    expect(r.drift).toBe(0);
    expect(r.results.every((x) => x.status === 'PASS')).toBe(true);
  });

  test('inline body with CRLF and trailing whitespace → still PASS (documented normalization)', () => {
    const p = join(root, 'Handbooks', 'intro-to-ai-harness', 'docs', 'appendix', 'G_Workspace_Architecture.html');
    const body = bodyOf(canonicalSvg('ko')).split('\n').map((l) => `${l}  \t`).join('\n');
    writeFileSync(p, pageHtml('ko', body + '\n\n').replace(/\n/g, '\r\n'));
    expect(checkDrift({ root }).drift).toBe(0);
  });

  test('inline leading-whitespace change → DRIFT (only trailing whitespace is normalized)', () => {
    const p = join(root, 'Handbooks', 'intro-to-ai-harness', 'docs', 'appendix', 'G_Workspace_Architecture.html');
    writeFileSync(p, pageHtml('ko', bodyOf(canonicalSvg('ko')).split('\n').map((l) => `  ${l}`).join('\n')));
    expect(checkDrift({ root }).drift).toBe(1);
  });

  test('page with no inline map → DRIFT with reason', () => {
    const p = join(root, 'Handbooks', 'intro-to-ai-harness', 'docs', 'appendix', 'G_Workspace_Architecture_en.html');
    writeFileSync(p, '<html><body><img src="x.svg"></body></html>\n');
    const r = checkDrift({ root });
    expect(r.drift).toBe(1);
    expect(r.results.find((x) => x.status === 'DRIFT')!.detail).toContain('no single inline');
  });

  test('missing copy inside a present handbook → DRIFT', () => {
    rmSync(join(root, 'Handbooks', 'intro-to-ai-harness', 'docs', 'assets', 'img', 'workspace-architecture.ja.svg'));
    const r = checkDrift({ root });
    expect(r.drift).toBe(1);
    expect(r.results.find((x) => x.status === 'DRIFT')!.detail).toBe('copy missing');
  });

  test('missing handbook dir → SKIP for that handbook, others still checked', () => {
    rmSync(join(root, 'Handbooks', 'multi-agent-harness-handbook'), { recursive: true, force: true });
    const r = checkDrift({ root });
    expect(r.drift).toBe(0);
    expect(r.results.filter((x) => x.status === 'SKIP')).toHaveLength(1);
    expect(r.results.filter((x) => x.status === 'PASS')).toHaveLength(LOCALES.length * 2);
  });

  test('missing Handbooks/ → single SKIP, skipped=true, no drift', () => {
    rmSync(join(root, 'Handbooks'), { recursive: true, force: true });
    const r = checkDrift({ root });
    expect(r.skipped).toBe(true);
    expect(r.drift).toBe(0);
    expect(r.results).toHaveLength(1);
    expect(r.results[0].status).toBe('SKIP');
  });

  test('--handbooks override reads handbooks from another dir', () => {
    const other = mkdtempSync(join(tmpdir(), 'archmap-hb-'));
    try {
      rmSync(join(other), { recursive: true, force: true });
      const r1 = checkDrift({ root, handbooksDir: other });
      expect(r1.skipped).toBe(true);
      const r2 = checkDrift({ root, handbooksDir: join(root, 'Handbooks') });
      expect(r2.drift).toBe(0);
      expect(r2.skipped).toBe(false);
    } finally {
      rmSync(other, { recursive: true, force: true });
    }
  });

  test('missing canonical file → error (repository fault)', () => {
    rmSync(join(root, 'docs', 'architecture', 'workspace-architecture.es.svg'));
    expect(checkDrift({ root }).error).toContain('canonical file missing');
  });
});

describe('body extraction helpers', () => {
  test('canonicalBody drops root open line and final </svg>, skips <?xml?>', () => {
    const svg = canonicalSvg('ko');
    expect(canonicalBody(svg)).toBe(normalizeBody(bodyOf(svg).split('\n')));
    expect(canonicalBody(`<?xml version="1.0"?>\n${svg}`)).toBe(canonicalBody(svg));
    expect(canonicalBody('<html></html>')).toBeNull();
  });

  test('inlineBody returns null on nested <svg> inside the extracted body', () => {
    expect(inlineBody(pageHtml('ko', '<svg viewBox="0 0 1 1">\n<rect/>'))).toBeNull();
  });
});

describe('CLI', () => {
  function run(args: string[]): { code: number; out: string } {
    const p = Bun.spawnSync(['bun', SCRIPT, ...args], { stdout: 'pipe', stderr: 'pipe' });
    return { code: p.exitCode ?? -1, out: new TextDecoder().decode(p.stdout) + new TextDecoder().decode(p.stderr) };
  }

  test('all PASS → exit 0 with PASS lines', () => {
    const r = run(['--root', root]);
    expect(r.code).toBe(0);
    expect(r.out.match(/^PASS /gm)).toHaveLength(16);
  });

  test('drift → exit 1 with a DRIFT line', () => {
    const p = join(root, 'Handbooks', 'intro-to-ai-harness', 'docs', 'assets', 'img', 'workspace-architecture.svg');
    writeFileSync(p, 'x');
    const r = run(['--root', root]);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/^DRIFT /m);
  });

  test('absent Handbooks/ → exit 0 with SKIP', () => {
    rmSync(join(root, 'Handbooks'), { recursive: true, force: true });
    const r = run(['--root', root]);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/^SKIP /m);
  });

  test('--json emits a parseable report', () => {
    const r = run(['--root', root, '--json']);
    expect(r.code).toBe(0);
    const j = JSON.parse(r.out);
    expect(j.drift).toBe(0);
    expect(j.results).toHaveLength(16);
  });

  test('unknown argument → exit 2', () => {
    expect(run(['--bogus']).code).toBe(2);
  });
});
