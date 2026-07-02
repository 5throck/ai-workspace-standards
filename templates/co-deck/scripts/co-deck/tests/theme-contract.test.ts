import { describe, it, expect, beforeAll } from 'bun:test';
import { loadThemePackage, validateThemePackage, SLIDE_TYPE_HTML_TO_JSON } from '../lib/theme-contract.js';
import { resolve, dirname } from 'path';

// tests/ is 3 levels deep from workspace root (scripts/co-deck/tests/).
// Use import.meta.path (native file path) rather than import.meta.url (file:/// URL)
// because dirname() on a URL string breaks path resolution on Windows.
const ROOT = resolve(dirname(import.meta.path), '../../..');

describe('theme-contract', () => {
  // Test loadThemePackage for each real theme
  const themes = ['outline', 'pitch', 'pitch-enhanced', 'vertical', 'zen'];

  for (const name of themes) {
    describe(`load ${name}`, () => {
      let pkg: any;
      let errors: any[];
      beforeAll(() => {
        const result = loadThemePackage(ROOT, name);
        pkg = result.pkg;
        errors = result.errors;
      });

      it('loads without fatal errors', () => {
        expect(pkg).not.toBeNull();
        expect(errors.filter((e: any) => e.severity === 'error')).toHaveLength(0);
      });

      it('has all 4 required files', () => {
        expect(pkg.files.templateHtml).toBeDefined();
        expect(pkg.files.themeJson).toBeDefined();
        expect(pkg.files.themeCss).toBeDefined();
        expect(pkg.files.pdfLayoutSpec).toBeDefined();
      });

      it('has all 4 required INJECT markers', () => {
        expect(pkg.injectMarkers).toContain('INJECT:title');
        expect(pkg.injectMarkers).toContain('INJECT:CSS');
        expect(pkg.injectMarkers).toContain('INJECT:slides');
        expect(pkg.injectMarkers).toContain('INJECT:slideData');
      });
    });
  }

  // Test SLIDE_TYPE_HTML_TO_JSON constant
  it('exports cover -> title mapping', () => {
    expect(SLIDE_TYPE_HTML_TO_JSON.cover).toBe('title');
  });

  // Test validation: no style simultaneously compatible and incompatible
  describe('cross-compatibility validation', () => {
    for (const name of themes) {
      it(`${name}: no style in both compatible and incompatible`, () => {
        const result = loadThemePackage(ROOT, name);
        if (!result.pkg) return;
        const errors = validateThemePackage(result.pkg);
        const overlapErrors = errors.filter((e: any) => e.message.includes('simultaneously'));
        expect(overlapErrors).toHaveLength(0);
      });
    }
  });

  // Test partial_styles optional handling (pitch omits it)
  it('pitch handles missing partial_styles without error', () => {
    const result = loadThemePackage(ROOT, 'pitch');
    expect(result.pkg).not.toBeNull();
    expect(result.pkg!.metadata.partial_styles).toBeUndefined();
    const errors = validateThemePackage(result.pkg!);
    const partialErrors = errors.filter(
      (e: any) => e.message.includes('partial_styles') && e.severity === 'error',
    );
    expect(partialErrors).toHaveLength(0);
  });

  // Test version field exists in all themes
  for (const name of themes) {
    it(`${name}: has version field`, () => {
      const result = loadThemePackage(ROOT, name);
      expect(result.pkg).not.toBeNull();
      expect(result.pkg!.metadata.version).toBeDefined();
      expect(typeof result.pkg!.metadata.version).toBe('string');
    });
  }

  // Test CSS paths start with docs/html-themes/
  describe('CSS path validation', () => {
    for (const name of themes) {
      it(`${name}: all CSS paths start with docs/html-themes/`, () => {
        const result = loadThemePackage(ROOT, name);
        if (!result.pkg) return;
        const errors = validateThemePackage(result.pkg);
        const cssErrors = errors.filter(
          (e: any) => e.message.includes('does not start with "docs/html-themes/"') && e.severity === 'error',
        );
        expect(cssErrors).toHaveLength(0);
      });
    }
  });
});
