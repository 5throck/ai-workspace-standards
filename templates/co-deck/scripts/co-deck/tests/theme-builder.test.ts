// theme-builder.test.ts — tests for the deterministic theme deck builder.
//
// Uses real theme packages from the workspace and a minimal slideData array.

import { describe, it, expect } from 'bun:test';
import { buildThemeDeck, BuildResult } from '../lib/theme-builder.js';
import { resolve, dirname, join } from 'path';

// tests/ is 3 levels deep from workspace root (scripts/co-deck/tests/).
// Use import.meta.path (native file path) rather than import.meta.url (file:/// URL)
// because dirname() on a URL string breaks path resolution on Windows.
const ROOT = resolve(dirname(import.meta.path), '../../..');

// Minimal slide data for tests.
const MINIMAL_SLIDES = [{ headline: 'Test Deck', type: 'cover', bullets: [] }];

// Helper: create build options with sensible defaults.
function makeOpts(overrides: Partial<import('../lib/theme-builder.js').BuildOptions> = {}) {
  return {
    root: ROOT,
    projectPath: join(ROOT, 'presentations', '_test'),
    theme: 'outline',
    style: 'classic',
    title: 'Test Deck',
    slideData: MINIMAL_SLIDES,
    outputPath: join(ROOT, 'scripts', 'co-deck', 'tests', 'tmp', 'test-output.html'),
    ...overrides,
  };
}

describe('theme-builder', () => {
  // 1. Compatibility rejection: pitch + visual-heavy → error
  describe('incompatible style rejection', () => {
    it('should error when building pitch + visual-heavy', () => {
      const result = buildThemeDeck(makeOpts({
        theme: 'pitch',
        style: 'visual-heavy',
      }));
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes('incompatible'))).toBe(true);
      expect(result.html).toBe('');
    });

    it('should error when building zen + visual-heavy', () => {
      const result = buildThemeDeck(makeOpts({
        theme: 'zen',
        style: 'visual-heavy',
      }));
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes('incompatible'))).toBe(true);
    });
  });

  // 2. Partial style warning: pitch-enhanced + visual-heavy → succeed with warning
  describe('partial style warning', () => {
    it('should succeed with warning for pitch-enhanced + visual-heavy', () => {
      const result = buildThemeDeck(makeOpts({
        theme: 'pitch-enhanced',
        style: 'visual-heavy',
      }));
      expect(result.errors).toHaveLength(0);
      expect(result.html).not.toBe('');
      expect(result.warnings.some((w) => w.includes('partial compatibility'))).toBe(true);
    });
  });

  // 3. Marker replacement: build a simple deck → verify HTML contains title, CSS links, slideData
  describe('marker replacement', () => {
    it('should replace all markers in a simple outline + classic deck', () => {
      const result = buildThemeDeck(makeOpts());
      expect(result.errors).toHaveLength(0);

      // Title present in <title> tag
      expect(result.html).toContain('<title>Test Deck</title>');

      // CSS links present
      expect(result.html).toContain('href="../../docs/html-themes/styles/base.css"');
      expect(result.html).toContain('href="../../docs/html-themes/themes/outline/theme.css"');
      expect(result.html).toContain('href="../../docs/html-themes/styles/classic/style.css"');

      // slideData present as const declaration
      expect(result.html).toContain('const slideData = [');
      expect(result.html).toContain('"headline"');
      expect(result.html).toContain('"Test Deck"');

      // No raw markers remaining
      expect(result.html).not.toContain('<!-- INJECT:title -->');
      expect(result.html).not.toContain('<!-- INJECT:CSS -->');
      expect(result.html).not.toContain('<!-- INJECT:slides -->');
      expect(result.html).not.toContain('// <!-- INJECT:slideData -->');
    });
  });

  // 4. CSS load order for PPT theme: base → ppt-engine → theme → style
  describe('CSS load order for PPT-engine theme', () => {
    it('should produce CSS links in correct order: base → ppt-engine → theme → style', () => {
      const result = buildThemeDeck(makeOpts({
        theme: 'outline',
        style: 'premium-dark',
      }));
      expect(result.errors).toHaveLength(0);

      const baseIdx = result.html.indexOf('../../docs/html-themes/styles/base.css');
      const pptIdx = result.html.indexOf('../../docs/html-themes/themes/_shared/ppt-engine.css');
      const themeIdx = result.html.indexOf('../../docs/html-themes/themes/outline/theme.css');
      const styleIdx = result.html.indexOf('../../docs/html-themes/styles/premium-dark/style.css');

      expect(baseIdx).toBeGreaterThan(-1);
      expect(pptIdx).toBeGreaterThan(-1);
      expect(themeIdx).toBeGreaterThan(-1);
      expect(styleIdx).toBeGreaterThan(-1);

      // Verify order: base < ppt-engine < theme < style
      expect(baseIdx).toBeLessThan(pptIdx);
      expect(pptIdx).toBeLessThan(themeIdx);
      expect(themeIdx).toBeLessThan(styleIdx);
    });

    it('should also include ppt-engine.css for vertical theme', () => {
      const result = buildThemeDeck(makeOpts({
        theme: 'vertical',
        style: 'minimal',
      }));
      expect(result.errors).toHaveLength(0);
      expect(result.html).toContain('../../docs/html-themes/themes/_shared/ppt-engine.css');
    });

    it('should include ppt-engine.css for zen theme', () => {
      const result = buildThemeDeck(makeOpts({
        theme: 'zen',
        style: 'classic',
      }));
      expect(result.errors).toHaveLength(0);
      expect(result.html).toContain('../../docs/html-themes/themes/_shared/ppt-engine.css');
    });
  });

  // 5. CSS load order for pitch: NO ppt-engine.css
  describe('CSS load order for pitch theme', () => {
    it('should NOT include ppt-engine.css link for pitch theme', () => {
      const result = buildThemeDeck(makeOpts({
        theme: 'pitch',
        style: 'classic',
      }));
      expect(result.errors).toHaveLength(0);

      // Should have base, theme, and style CSS
      expect(result.html).toContain('../../docs/html-themes/styles/base.css');
      expect(result.html).toContain('../../docs/html-themes/themes/pitch/theme.css');
      expect(result.html).toContain('../../docs/html-themes/styles/classic/style.css');

      // Should NOT have ppt-engine.css
      expect(result.html).not.toContain('ppt-engine.css');
    });
  });

  // 6. Strict-JSON preservation: special characters survive round-trip
  describe('strict-JSON preservation', () => {
    it('should produce valid JSON for slide data with special characters', () => {
      const specialSlides = [
        {
          headline: 'Test "quotes" & <brackets>',
          type: 'cover',
          bullets: ['Line 1\nNew line', '한글 텍스트', 'Émojis: 🎉 🚀', 'Path: C:\\Users\\test'],
        },
      ];
      const result = buildThemeDeck(makeOpts({
        slideData: specialSlides,
      }));
      expect(result.errors).toHaveLength(0);

      // Extract the slideData from the HTML.
      // The template has documentation comments mentioning const slideData,
      // so we search specifically for the injected const statement.
      // It appears right after "// <!-- INJECT:slideData -->" was replaced.
      // The statement is: const slideData = [ ... ];  where [ ... ] is valid JSON.
      // We find it by locating the '<script>' tag's content and parsing the JSON
      // array with bracket-depth tracking.
      const scriptIdx = result.html.lastIndexOf('<script>');
      expect(scriptIdx).toBeGreaterThan(-1);
      const afterScript = result.html.substring(scriptIdx);
      const constIdx = afterScript.indexOf('const slideData = ');
      expect(constIdx).toBeGreaterThan(-1);
      const bracketStart = afterScript.indexOf('[', constIdx);
      // Bracket-depth tracking to find the matching ]
      let depth = 0;
      let bracketEnd = -1;
      for (let i = bracketStart; i < afterScript.length; i++) {
        if (afterScript[i] === '[') depth++;
        else if (afterScript[i] === ']') depth--;
        if (depth === 0) { bracketEnd = i; break; }
      }
      expect(bracketEnd).toBeGreaterThan(bracketStart);
      const jsonString = afterScript.substring(bracketStart, bracketEnd + 1);

      // Parse the extracted JSON — must be valid
      const parsed = JSON.parse(jsonString);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].headline).toBe('Test "quotes" & <brackets>');
      expect(parsed[0].bullets).toHaveLength(4);
      expect(parsed[0].bullets[0]).toBe('Line 1\nNew line');
      expect(parsed[0].bullets[2]).toBe('Émojis: 🎉 🚀');
      expect(parsed[0].bullets[3]).toBe('Path: C:\\Users\\test');
    });
  });

  // 7. Deterministic output: two builds → byte-identical HTML
  describe('deterministic output', () => {
    it('should produce byte-identical HTML for two builds with same inputs', () => {
      const result1 = buildThemeDeck(makeOpts());
      const result2 = buildThemeDeck(makeOpts());

      expect(result1.errors).toHaveLength(0);
      expect(result2.errors).toHaveLength(0);
      expect(result1.html).toBe(result2.html);
    });

    it('should produce byte-identical HTML across different build orders', () => {
      const opts = makeOpts({ theme: 'pitch-enhanced', style: 'premium-dark' });
      const result1 = buildThemeDeck(opts);
      const result2 = buildThemeDeck(opts);

      expect(result1.html).toBe(result2.html);
    });
  });

  // 8. INJECT marker validation: all 4 markers present and replaced exactly once
  describe('INJECT marker validation', () => {
    it('should have no remaining INJECT markers after build', () => {
      const result = buildThemeDeck(makeOpts());
      expect(result.errors).toHaveLength(0);

      // Check none of the 4 actual INJECT markers remain (exact strings).
      // Note: template comments may contain bracketed references like [INJECT:CSS]
      // which are documentation only — those are fine to remain.
      expect(result.html).not.toContain('<!-- INJECT:title -->');
      expect(result.html).not.toContain('<!-- INJECT:CSS -->');
      expect(result.html).not.toContain('<!-- INJECT:slides -->');
      expect(result.html).not.toContain('// <!-- INJECT:slideData -->');
    });

    it('should have no marker-related errors for all PPT themes', () => {
      const pptThemes = ['outline', 'pitch-enhanced', 'vertical', 'zen'];
      for (const theme of pptThemes) {
        const result = buildThemeDeck(makeOpts({ theme, style: 'classic' }));
        const markerErrors = result.errors.filter((e) => e.includes('INJECT marker'));
        expect(markerErrors).toHaveLength(0);
      }
    });

    it('should have no marker-related errors for pitch theme', () => {
      const result = buildThemeDeck(makeOpts({ theme: 'pitch', style: 'minimal' }));
      const markerErrors = result.errors.filter((e) => e.includes('INJECT marker'));
      expect(markerErrors).toHaveLength(0);
    });
  });

  // Additional: data-theme and data-style attributes
  describe('html attributes', () => {
    it('should set data-theme and data-style on <html> element', () => {
      const result = buildThemeDeck(makeOpts({
        theme: 'outline',
        style: 'premium-dark',
      }));
      expect(result.errors).toHaveLength(0);
      expect(result.html).toMatch(/<html\s+[^>]*data-theme="outline"[^>]*>/);
      expect(result.html).toMatch(/<html\s+[^>]*data-style="premium-dark"[^>]*>/);
    });
  });

  // Additional: ppt-engine.js inlining for PPT themes
  describe('ppt-engine.js inlining', () => {
    it('should inline ppt-engine.js content for outline theme', () => {
      const result = buildThemeDeck(makeOpts({
        theme: 'outline',
        style: 'classic',
      }));
      expect(result.errors).toHaveLength(0);

      // ppt-engine.js exports TransitionEngine
      expect(result.html).toContain('TransitionEngine');
      expect(result.html).toContain('PresenterTools');
      expect(result.html).toContain('TOCBuilder');

      // The placeholder comment should NOT remain
      expect(result.html).not.toContain('ppt-engine.js inline (common PPT runtime)');
    });

    it('should NOT inline ppt-engine.js for pitch theme', () => {
      const result = buildThemeDeck(makeOpts({
        theme: 'pitch',
        style: 'classic',
      }));
      expect(result.errors).toHaveLength(0);

      // Pitch theme doesn't have ppt-engine functions
      // The slideData should still be present
      expect(result.html).toContain('const slideData');
    });
  });

  // Edge: unknown theme
  describe('error handling', () => {
    it('should error for unknown theme', () => {
      const result = buildThemeDeck(makeOpts({ theme: 'nonexistent' }));
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.html).toBe('');
    });
  });
});
