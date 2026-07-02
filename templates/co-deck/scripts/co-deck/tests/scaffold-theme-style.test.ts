// scaffold-theme-style.test.ts — tests for the theme/style scaffolder.
//
// Tests --from derivation, minimally valid scaffolding, required files,
// and contract validation.

import { describe, it, expect, beforeEach, afterEach, afterAll } from 'bun:test';
import { execSync } from 'child_process';
import { existsSync, readFileSync, rmSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { loadThemePackage, validateThemePackage } from '../lib/theme-contract.js';

const SCRIPT = resolve(dirname(import.meta.path), '../scaffold-theme-style.ts');
const MANIFEST_SCRIPT = resolve(dirname(import.meta.path), '../generate-themes-manifest.ts');
const ROOT = resolve(dirname(import.meta.path), '../../..');
const THEMES_ROOT = join(ROOT, 'docs', 'html-themes', 'themes');

// Generate a unique test theme name to avoid conflicts
function testThemeName(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}`;
}

function scaffold(themeName: string, extraArgs: string): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execSync(
      `bun "${SCRIPT}" --theme ${themeName} ${extraArgs}`,
      { encoding: 'utf-8', timeout: 15000, cwd: ROOT },
    );
    return { stdout, stderr: '', exitCode: 0 };
  } catch (err: any) {
    return {
      stdout: err.stdout?.toString() || '',
      stderr: err.stderr?.toString() || err.message || '',
      exitCode: err.status ?? 1,
    };
  }
}

describe('scaffold-theme-style', () => {
  // After all tests in this file, regenerate the manifest so other test files
  // don't see a stale manifest from temporarily scaffolded themes.
  afterAll(() => {
    try {
      execSync(`bun "${MANIFEST_SCRIPT}" --root "${ROOT}"`, { encoding: 'utf-8', timeout: 10000 });
    } catch { /* ignore */ }
  });

  describe('--from derivation', () => {
    const derivedName = testThemeName('test-derived');

    afterEach(() => {
      // Cleanup: remove scaffolded theme dir
      const dir = join(THEMES_ROOT, derivedName);
      if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    });

    it('creates a valid package when deriving from an existing theme', () => {
      const { stdout, exitCode } = scaffold(derivedName, '--from outline');
      expect(exitCode).toBe(0);
      expect(stdout).toContain('scaffolded theme');
      expect(stdout).toContain('derived from outline');
    });

    it('copies template.html from source theme', () => {
      const { exitCode } = scaffold(derivedName, '--from outline');
      expect(exitCode).toBe(0);

      const templatePath = join(THEMES_ROOT, derivedName, 'template.html');
      expect(existsSync(templatePath)).toBe(true);
      const content = readFileSync(templatePath, 'utf-8');
      // Template should have the new theme's data-theme attribute
      expect(content).toContain(`data-theme="${derivedName}"`);
      // Template should still have all 4 INJECT markers
      expect(content).toContain('INJECT:title');
      expect(content).toContain('INJECT:CSS');
      expect(content).toContain('INJECT:slides');
      expect(content).toContain('INJECT:slideData');
    });

    it('copies theme.css from source theme', () => {
      const { exitCode } = scaffold(derivedName, '--from outline');
      expect(exitCode).toBe(0);

      const cssPath = join(THEMES_ROOT, derivedName, 'theme.css');
      expect(existsSync(cssPath)).toBe(true);
      const content = readFileSync(cssPath, 'utf-8');
      // The derived CSS should have the new theme name referenced in a header comment
      // (the exact format depends on the source theme's comment style)
      expect(content.length).toBeGreaterThan(100);
      // Verify it's the outline theme's CSS adapted (contains outline-specific classes)
      expect(content).toContain('outline'); // Reference to source theme
    });

    it('sets based_on field in theme.json', () => {
      const { exitCode } = scaffold(derivedName, '--from outline');
      expect(exitCode).toBe(0);

      const jsonPath = join(THEMES_ROOT, derivedName, 'theme.json');
      const json = JSON.parse(readFileSync(jsonPath, 'utf-8'));
      expect(json.based_on).toBe('outline');
    });

    it('sets author to "scaffold-derived"', () => {
      const { exitCode } = scaffold(derivedName, '--from outline');
      expect(exitCode).toBe(0);

      const jsonPath = join(THEMES_ROOT, derivedName, 'theme.json');
      const json = JSON.parse(readFileSync(jsonPath, 'utf-8'));
      expect(json.author).toBe('scaffold-derived');
    });

    it('passes contract validation for INJECT markers', () => {
      const { exitCode } = scaffold(derivedName, '--from outline');
      expect(exitCode).toBe(0);

      const { pkg, errors } = loadThemePackage(ROOT, derivedName);
      expect(pkg).not.toBeNull();
      expect(errors.filter((e) => e.severity === 'error')).toHaveLength(0);
      expect(pkg!.injectMarkers).toContain('INJECT:title');
      expect(pkg!.injectMarkers).toContain('INJECT:CSS');
      expect(pkg!.injectMarkers).toContain('INJECT:slides');
      expect(pkg!.injectMarkers).toContain('INJECT:slideData');
    });
  });

  describe('minimally valid scaffolding (no --from)', () => {
    const bareName = testThemeName('test-bare');

    afterEach(() => {
      const dir = join(THEMES_ROOT, bareName);
      if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    });

    it('creates all 4 required files', () => {
      const { exitCode } = scaffold(bareName, '');
      expect(exitCode).toBe(0);

      const dir = join(THEMES_ROOT, bareName);
      expect(existsSync(join(dir, 'template.html'))).toBe(true);
      expect(existsSync(join(dir, 'theme.json'))).toBe(true);
      expect(existsSync(join(dir, 'theme.css'))).toBe(true);
      expect(existsSync(join(dir, 'pdf_layout_spec.json'))).toBe(true);
    });

    it('template.html has all 4 INJECT markers', () => {
      const { exitCode } = scaffold(bareName, '');
      expect(exitCode).toBe(0);

      const template = readFileSync(join(THEMES_ROOT, bareName, 'template.html'), 'utf-8');
      expect(template).toContain('<!-- INJECT:title -->');
      expect(template).toContain('<!-- INJECT:CSS -->');
      expect(template).toContain('<!-- INJECT:slides -->');
      expect(template).toContain('<!-- INJECT:slideData -->');
    });

    it('theme.json has all required fields', () => {
      const { exitCode } = scaffold(bareName, '');
      expect(exitCode).toBe(0);

      const json = JSON.parse(readFileSync(join(THEMES_ROOT, bareName, 'theme.json'), 'utf-8'));
      expect(json.name).toBe(bareName);
      expect(json.version).toBeDefined();
      expect(json.rendering).toBeDefined();
      expect(json.slide_types).toBeDefined();
      expect(json.compatible_styles).toBeInstanceOf(Array);
      expect(json.css_base).toBeDefined();
      expect(json.css_theme).toContain(bareName);
    });

    it('theme.css has basic structure (not empty)', () => {
      const { exitCode } = scaffold(bareName, '');
      expect(exitCode).toBe(0);

      const css = readFileSync(join(THEMES_ROOT, bareName, 'theme.css'), 'utf-8');
      expect(css.length).toBeGreaterThan(50);
      expect(css).toContain(':root');
      expect(css).toContain('--slide-');
    });

    it('pdf_layout_spec.json has region skeleton', () => {
      const { exitCode } = scaffold(bareName, '');
      expect(exitCode).toBe(0);

      const spec = JSON.parse(readFileSync(join(THEMES_ROOT, bareName, 'pdf_layout_spec.json'), 'utf-8'));
      expect(spec.version).toBeDefined();
      expect(spec.page).toBeDefined();
      expect(spec.regions).toBeDefined();
      expect(spec.regions.header).toBeDefined();
      expect(spec.regions.title).toBeDefined();
      expect(spec.regions.content).toBeDefined();
      expect(spec.regions.visual).toBeDefined();
      expect(spec.regions.meta).toBeDefined();
      expect(spec.regions.toc).toBeDefined();
      expect(spec.print).toBeDefined();
    });

    it('scaffolded theme passes contract validation (load + validate)', () => {
      const { exitCode } = scaffold(bareName, '');
      expect(exitCode).toBe(0);

      const { pkg, errors: loadErrors } = loadThemePackage(ROOT, bareName);
      expect(pkg).not.toBeNull();
      expect(loadErrors.filter((e) => e.severity === 'error')).toHaveLength(0);

      const validationErrors = validateThemePackage(pkg!);
      const fatalErrors = validationErrors.filter((e) => e.severity === 'error');
      // Expect no fatal errors (warnings about slide_types are OK for scaffolded themes)
      expect(fatalErrors).toHaveLength(0);
    });

    it('author defaults to "co-deck" when no --from is specified', () => {
      const { exitCode } = scaffold(bareName, '');
      expect(exitCode).toBe(0);

      const json = JSON.parse(readFileSync(join(THEMES_ROOT, bareName, 'theme.json'), 'utf-8'));
      expect(json.author).toBe('co-deck');
      expect(json.based_on).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('refuses to overwrite existing theme directory', () => {
      // outline always exists — trying to scaffold it should fail
      const { exitCode, stderr } = scaffold('outline', '');
      expect(exitCode).toBe(1);
      expect(stderr).toContain('already exists');
    });

    it('errors when --from is used without --theme', () => {
      try {
        execSync(
          `bun "${SCRIPT}" --from outline`,
          { encoding: 'utf-8', timeout: 10000, cwd: ROOT },
        );
        expect(true).toBe(false); // should not reach
      } catch (err: any) {
        expect(err.status).toBe(1);
        const output = err.stderr?.toString() || err.stdout?.toString();
        // The script validates --theme first, so the error is about missing --theme
        expect(output).toContain('--theme');
      }
    });

    it('errors when --from references a non-existent theme', () => {
      const badName = testThemeName('test-bad-from');
      try {
        execSync(
          `bun "${SCRIPT}" --theme ${badName} --from nonexistent-theme`,
          { encoding: 'utf-8', timeout: 10000, cwd: ROOT },
        );
        expect(true).toBe(false); // should not reach
      } catch (err: any) {
        expect(err.status).toBe(1);
        const output = err.stderr?.toString() || err.stdout?.toString();
        expect(output).toContain('not found');
      } finally {
        const dir = join(THEMES_ROOT, badName);
        if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
      }
    });
  });
});
