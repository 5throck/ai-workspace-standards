/**
 * apply-handbook-theme.ts emits the ja variable block followed by the inline
 * SVG font override, for both the azure and native themes.
 *
 * @version 1.0.0
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const SCRIPT = resolve(import.meta.dir, '../../templates/common/scripts/handbook/apply-handbook-theme.ts');
const JA_BLOCK =
  ":root:lang(ja) {\n  --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Meiryo, 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', sans-serif;\n  --line-height-body: 1.55;\n  --line-height-compact: 1.5;\n}\n";
const SVG_OVERRIDE =
  '/* Inline diagram groups on ja pages hardcode a generic stack; defer to the page font */\n' +
  ':root:lang(ja) svg g[font-family^="-apple-system"], :root:lang(ja) svg g[font-family^="system-ui"] { font-family: var(--font-family); }\n';

let proj: string;
beforeEach(() => {
  proj = mkdtempSync(join(tmpdir(), 'theme-ja-'));
});
afterEach(() => {
  rmSync(proj, { recursive: true, force: true });
});

describe('apply-handbook-theme ja SVG override', () => {
  for (const theme of ['azure', 'native']) {
    test(`${theme}: ja block then SVG override, exact text`, () => {
      const r = Bun.spawnSync(['bun', 'run', SCRIPT, '--project', proj, '--theme', theme]);
      expect(r.exitCode).toBe(0);
      const css = readFileSync(join(proj, 'docs', 'assets', 'css', 'handbook-variables.css'), 'utf-8');
      expect(css.endsWith(JA_BLOCK + SVG_OVERRIDE)).toBe(true);
      expect(css.split(SVG_OVERRIDE)).toHaveLength(2);
    });
  }
});
