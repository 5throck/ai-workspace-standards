/**
 * Unit tests for templates/common/scripts/handbook/check-generated-content.ts
 *
 * Temp-dir fixtures: one clean page plus pages exhibiting each defect class,
 * and ko vs ja behavior of the stray-Hanja check.
 *
 * @version 1.0.0
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  checkGeneratedContent,
  pageLang,
} from '../../templates/common/scripts/handbook/check-generated-content.ts';

const SCRIPT = resolve(
  import.meta.dir,
  '../../templates/common/scripts/handbook/check-generated-content.ts',
);

let docs: string;

function page(lang: string | null, body: string): string {
  const attr = lang ? ` lang="${lang}"` : '';
  return `<!DOCTYPE html>\n<html${attr}><head><title>t</title></head><body>${body}</body></html>\n`;
}

function write(name: string, content: string): void {
  writeFileSync(join(docs, name), content);
}

beforeEach(() => {
  docs = mkdtempSync(join(tmpdir(), 'gen-content-'));
  mkdirSync(join(docs, 'sub'), { recursive: true });
});

afterEach(() => {
  rmSync(docs, { recursive: true, force: true });
});

describe('check-generated-content', () => {
  test('clean page yields no issues', () => {
    write(
      'clean.html',
      page(
        'en',
        '<table><tr><td>a</td><td>b</td></tr><tr><td>—</td><td>—</td></tr></table>' +
          '<p>Use <code>`x`</code> and <pre>`y`</pre>.</p>' +
          '<div class="quiz"><ol><li>1. one</li><li>2. two</li></ol></div>',
      ),
    );
    expect(checkGeneratedContent(docs)).toEqual([]);
  });

  test('detects duplicated td pair but not placeholders', () => {
    write('dup.html', page('en', '<table><tr><td>same</td><td>same</td></tr><tr><td>⚠️ x</td><td>⚠️ x</td></tr></table>'));
    const issues = checkGeneratedContent(docs);
    expect(issues.map((i) => i.kind)).toEqual(['duplicated-td']);
    expect(issues[0].detail).toBe('same');
  });

  test('detects raw backticks outside pre/code only', () => {
    write('tick.html', page('en', '<p>run `bun test` now</p><pre>`ok`</pre>'));
    const issues = checkGeneratedContent(docs);
    expect(issues).toHaveLength(1);
    expect(issues[0].kind).toBe('raw-backtick');
  });

  test('detects garbled quiz list', () => {
    write('quiz.html', page('en', '<div class="quiz"><ol><li>definition: foo</li><li>2. bar</li></ol></div>'));
    const issues = checkGeneratedContent(docs);
    expect(issues.map((i) => i.kind)).toEqual(['garbled-quiz']);
  });

  test('flags Hanja on ko pages but not ja pages', () => {
    write('ko.html', page('ko', '<p>한글 漢字 본문</p>'));
    write('ja.html', page('ja', '<p>日本語 漢字</p>'));
    const issues = checkGeneratedContent(docs);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ file: 'ko.html', kind: 'stray-hanja', detail: '漢字' });
  });

  test('skips Hanja inside code blocks on ko pages', () => {
    write('ko-code.html', page('ko', '<p>본문 <code>漢字</code></p>'));
    expect(checkGeneratedContent(docs)).toEqual([]);
  });

  test('html lang attribute wins over filename suffix', () => {
    write('sub/page_ja.html', page('ko-KR', '<p>漢字</p>'));
    write('sub/page_ko.html', page('ja', '<p>漢字</p>'));
    const issues = checkGeneratedContent(docs);
    expect(issues.map((i) => i.file)).toEqual(['sub/page_ja.html']);
  });

  test('pageLang falls back to suffix, then ko', () => {
    expect(pageLang('a.html', '<html lang="EN">')).toBe('en');
    expect(pageLang('a_ja.html', '<html>')).toBe('ja');
    expect(pageLang('a.html', '<html>')).toBe('ko');
  });

  test('CLI exits 1 on issues and 0 when clean', () => {
    write('dup.html', page('en', '<table><tr><td>x</td><td>x</td></tr></table>'));
    const bad = Bun.spawnSync(['bun', 'run', SCRIPT, '--docs-dir', docs]);
    expect(bad.exitCode).toBe(1);
    rmSync(join(docs, 'dup.html'));
    const ok = Bun.spawnSync(['bun', 'run', SCRIPT, '--docs-dir', docs]);
    expect(ok.exitCode).toBe(0);
  });
});
