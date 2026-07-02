import { describe, it, expect } from 'bun:test';
import { execSync } from 'child_process';
import { existsSync, readFileSync, unlinkSync } from 'fs';
import { join, resolve } from 'path';

const SCRIPT = resolve(import.meta.dir, '../generate-themes-manifest.ts');
const ROOT = resolve(import.meta.dir, '../../..');
const MANIFEST_PATH = join(ROOT, 'docs/html-themes/preview/themes-manifest.js');
const THEMES_MD_PATH = join(ROOT, 'docs/html-themes/THEMES.md');

describe('generate-themes-manifest', () => {
  it('produces byte-identical output on consecutive runs', () => {
    // Run once
    execSync(`bun ${SCRIPT} --root ${ROOT}`, { encoding: 'utf-8' });
    const output1 = readFileSync(MANIFEST_PATH, 'utf-8');

    // Run again
    execSync(`bun ${SCRIPT} --root ${ROOT}`, { encoding: 'utf-8' });
    const output2 = readFileSync(MANIFEST_PATH, 'utf-8');

    expect(output1).toBe(output2);
  });

  it('--check passes after generation', () => {
    // Ensure manifest is freshly generated
    execSync(`bun ${SCRIPT} --root ${ROOT}`, { encoding: 'utf-8' });

    const result = execSync(`bun ${SCRIPT} --root ${ROOT} --check`, { encoding: 'utf-8' });
    expect(result).toContain('up to date');
  });

  it('--check fails when manifest is missing', () => {
    // Temporarily remove the manifest
    const backup = existsSync(MANIFEST_PATH) ? readFileSync(MANIFEST_PATH, 'utf-8') : null;
    if (existsSync(MANIFEST_PATH)) unlinkSync(MANIFEST_PATH);

    try {
      let failed = false;
      try {
        execSync(`bun ${SCRIPT} --root ${ROOT} --check`, { encoding: 'utf-8' });
      } catch (err: any) {
        failed = true;
        expect(err.status).toBe(1);
        expect(err.stderr?.toString() || err.message).toContain('stale');
      }
      expect(failed).toBe(true);
    } finally {
      // Restore the manifest
      if (backup !== null) {
        const { writeFileSync, mkdirSync } = require('fs');
        const { dirname } = require('path');
        mkdirSync(dirname(MANIFEST_PATH), { recursive: true });
        writeFileSync(MANIFEST_PATH, backup, 'utf-8');
      }
    }
  });

  it('manifest does not contain generated_at', () => {
    execSync(`bun ${SCRIPT} --root ${ROOT}`, { encoding: 'utf-8' });
    const output = readFileSync(MANIFEST_PATH, 'utf-8');
    expect(output).not.toContain('generated_at');
  });

  it('manifest themes and styles arrays are sorted alphabetically', () => {
    execSync(`bun ${SCRIPT} --root ${ROOT}`, { encoding: 'utf-8' });
    const output = readFileSync(MANIFEST_PATH, 'utf-8');

    // Extract the JSON from window.__THEMES_MANIFEST__ = {...};
    const jsonStr = output.replace(/^.*?window\.__THEMES_MANIFEST__\s*=\s*/s, '').replace(/;\s*$/, '');
    const manifest = JSON.parse(jsonStr);

    const themeNames = manifest.themes.map((t: any) => t.name);
    const sortedThemeNames = [...themeNames].sort();
    expect(themeNames).toEqual(sortedThemeNames);

    const styleNames = manifest.styles;
    const sortedStyleNames = [...styleNames].sort();
    expect(styleNames).toEqual(sortedStyleNames);
  });

  it('--themes-md updates THEMES.md without errors', () => {
    execSync(`bun ${SCRIPT} --root ${ROOT} --themes-md`, { encoding: 'utf-8' });
    const content = readFileSync(THEMES_MD_PATH, 'utf-8');
    expect(content).toContain('AUTO-GENERATED-THEME-TABLE:START');
    expect(content).toContain('AUTO-GENERATED-THEME-TABLE:END');
    expect(content).toContain('AUTO-GENERATED-COMPAT-MATRIX:START');
    expect(content).toContain('AUTO-GENERATED-COMPAT-MATRIX:END');
  });

  it('--themes-md produces deterministic THEMES.md output', () => {
    // Generate twice
    execSync(`bun ${SCRIPT} --root ${ROOT} --themes-md`, { encoding: 'utf-8' });
    const content1 = readFileSync(THEMES_MD_PATH, 'utf-8');

    execSync(`bun ${SCRIPT} --root ${ROOT} --themes-md`, { encoding: 'utf-8' });
    const content2 = readFileSync(THEMES_MD_PATH, 'utf-8');

    expect(content1).toBe(content2);
  });
});
