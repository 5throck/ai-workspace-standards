// theme-preview.test.ts — tests for the preview system (preview.html + build-theme-preview.ts).
//
// Validates:
// 1. preview-data.json loads and parses correctly
// 2. Preview HTML contains theme-native DOM (via buildThemeDeck with cssRoot)
// 3. Preview iframe src pattern is correct
// 4. Incompatible theme×style combinations produce errors
// 5. Error panel structure in preview.html

import { describe, it, expect } from 'bun:test';
import { buildThemeDeck, type BuildOptions } from '../lib/theme-builder.js';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { resolve, dirname, join } from 'path';

// tests/ is 3 levels deep from workspace root (scripts/co-deck/tests/).
const ROOT = resolve(dirname(import.meta.path), '../../..');

// Paths
const previewDir = join(ROOT, 'docs/html-themes/preview');
const previewDataPath = join(previewDir, 'preview-data.json');
const previewHtmlPath = join(previewDir, 'preview.html');
const decksDir = join(previewDir, 'decks');

describe('theme-preview', () => {
  // 1. preview-data.json loads
  describe('preview-data.json loads', () => {
    it('should exist and be valid JSON', () => {
      expect(existsSync(previewDataPath)).toBe(true);
      const content = readFileSync(previewDataPath, 'utf-8');
      const data = JSON.parse(content);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });

    it('should contain all slide types: cover, divider, standard, punchline, profile, contact', () => {
      const content = readFileSync(previewDataPath, 'utf-8');
      const data = JSON.parse(content);
      const types = new Set(data.map((s: any) => s.type));
      expect(types.has('cover')).toBe(true);
      expect(types.has('divider')).toBe(true);
      expect(types.has('standard')).toBe(true);
      expect(types.has('punchline')).toBe(true);
      expect(types.has('profile')).toBe(true);
      expect(types.has('contact')).toBe(true);
    });

    it('should have headline and type fields on every slide', () => {
      const content = readFileSync(previewDataPath, 'utf-8');
      const data = JSON.parse(content);
      for (const slide of data) {
        expect(slide).toHaveProperty('headline');
        expect(slide).toHaveProperty('type');
        expect(typeof slide.headline).toBe('string');
        expect(typeof slide.type).toBe('string');
      }
    });
  });

  // 2. Preview HTML contains theme-native DOM
  describe('preview HTML contains theme-native DOM', () => {
    it('should produce HTML with const slideData when built with cssRoot', () => {
      const slideData = [
        { headline: 'Test', type: 'cover', bullets: [] },
      ];
      const result = buildThemeDeck({
        root: ROOT,
        projectPath: decksDir,
        theme: 'outline',
        style: 'classic',
        title: 'Preview Test',
        slideData,
        cssRoot: '../..',
      });

      expect(result.errors).toHaveLength(0);
      expect(result.html).toContain('const slideData =');
      expect(result.html).toContain('"headline"');
    });

    it('should use the custom cssRoot prefix for CSS links', () => {
      const result = buildThemeDeck({
        root: ROOT,
        projectPath: decksDir,
        theme: 'outline',
        style: 'classic',
        title: 'CSS Root Test',
        slideData: [{ headline: 'Test', type: 'cover', bullets: [] }],
        cssRoot: '../..',
      });

      expect(result.errors).toHaveLength(0);
      // With cssRoot='../..', CSS paths should start with ../..
      expect(result.html).toContain('href="../../styles/base.css"');
      expect(result.html).toContain('href="../../themes/outline/theme.css"');
      expect(result.html).toContain('href="../../styles/classic/style.css"');
    });

    it('should use default prefix when cssRoot is not provided', () => {
      const result = buildThemeDeck({
        root: ROOT,
        projectPath: join(ROOT, 'presentations', '_test'),
        theme: 'outline',
        style: 'classic',
        title: 'Default Prefix Test',
        slideData: [{ headline: 'Test', type: 'cover', bullets: [] }],
      });

      expect(result.errors).toHaveLength(0);
      // Default prefix is ../../docs/html-themes
      expect(result.html).toContain('href="../../docs/html-themes/styles/base.css"');
    });

    it('should produce valid HTML for all themes with preview data', () => {
      const previewData = JSON.parse(readFileSync(previewDataPath, 'utf-8'));
      const themeDirs = readdirSync(join(ROOT, 'docs/html-themes/themes'), { withFileTypes: true })
        .filter(d => d.isDirectory() && d.name !== '_shared')
        .map(d => d.name);

      // Test first compatible style for each theme
      for (const theme of themeDirs) {
        const themeJsonPath = join(ROOT, 'docs/html-themes/themes', theme, 'theme.json');
        if (!existsSync(themeJsonPath)) continue;
        const tj = JSON.parse(readFileSync(themeJsonPath, 'utf-8'));
        const firstStyle = (tj.compatible_styles || [])[0];
        if (!firstStyle) continue;

        const result = buildThemeDeck({
          root: ROOT,
          projectPath: decksDir,
          theme,
          style: firstStyle,
          title: `Preview — ${theme} × ${firstStyle}`,
          slideData: previewData,
          cssRoot: '../..',
        });

        expect(result.errors).toHaveLength(0);
        expect(result.html.length).toBeGreaterThan(100);
        // Verify it's a complete HTML document
        expect(result.html).toContain('<!DOCTYPE html>');
        expect(result.html).toContain('</html>');
      }
    });
  });

  // 3. Preview iframe src is correct
  describe('preview iframe src pattern', () => {
    it('should reference deck files at decks/<theme>_<style>.html path', () => {
      const previewHtml = readFileSync(previewHtmlPath, 'utf-8');
      // Check that the iframe loads from the decks/ directory
      expect(previewHtml).toContain("decks/'");
      expect(previewHtml).toContain('.html');
    });

    it('should have an iframe element with id preview-iframe', () => {
      const previewHtml = readFileSync(previewHtmlPath, 'utf-8');
      expect(previewHtml).toMatch(/id="preview-iframe"/);
      expect(previewHtml).toContain('<iframe');
    });

    it('should construct iframe src with theme and style from selection', () => {
      const previewHtml = readFileSync(previewHtmlPath, 'utf-8');
      // The JS constructs: 'decks/' + encodeURIComponent(theme) + '_' + encodeURIComponent(style) + '.html'
      expect(previewHtml).toContain('encodeURIComponent');
      expect(previewHtml).toContain("'decks/'");
    });

    it('should have pre-built deck files for at least outline_classic', () => {
      expect(existsSync(join(decksDir, 'outline_classic.html'))).toBe(true);
      const content = readFileSync(join(decksDir, 'outline_classic.html'), 'utf-8');
      expect(content).toContain('<!DOCTYPE html>');
      expect(content).toContain('const slideData');
    });
  });

  // 4. Incompatible combination rejection
  describe('incompatible combination rejection', () => {
    it('should show error panel when building incompatible theme×style', () => {
      const result = buildThemeDeck({
        root: ROOT,
        projectPath: decksDir,
        theme: 'pitch',
        style: 'visual-heavy',
        title: 'Incompatible Test',
        slideData: [{ headline: 'Test', type: 'cover', bullets: [] }],
        cssRoot: '../..',
      });

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('incompatible'))).toBe(true);
      expect(result.html).toBe('');
    });

    it('should have error display logic in preview.html', () => {
      const previewHtml = readFileSync(previewHtmlPath, 'utf-8');
      // Verify error panel exists
      expect(previewHtml).toContain('id="error-panel"');
      expect(previewHtml).toContain('contract-errors');
      expect(previewHtml).toContain('runtime-errors');
      // Verify error panel is red
      expect(previewHtml).toMatch(/#1a0000|#ff6b6b|background.*red|background.*#1a0000/);
    });

    it('should NOT build a deck file for incompatible combinations', () => {
      // pitch + visual-heavy is incompatible — there should be no deck file
      expect(existsSync(join(decksDir, 'pitch_visual-heavy.html'))).toBe(false);
    });
  });

  // 5. Error panel structure
  describe('error panel structure', () => {
    it('should have a contract-errors section', () => {
      const previewHtml = readFileSync(previewHtmlPath, 'utf-8');
      expect(previewHtml).toContain('id="contract-errors"');
    });

    it('should have a runtime-errors section', () => {
      const previewHtml = readFileSync(previewHtmlPath, 'utf-8');
      expect(previewHtml).toContain('id="runtime-errors"');
    });

    it('should have a copy button for error details', () => {
      const previewHtml = readFileSync(previewHtmlPath, 'utf-8');
      expect(previewHtml).toContain('copyErrorDetails');
      expect(previewHtml).toContain('Copy Error Details');
    });

    it('should have error panel visibility toggle', () => {
      const previewHtml = readFileSync(previewHtmlPath, 'utf-8');
      expect(previewHtml).toContain('visible');
      expect(previewHtml).toContain('error-panel');
    });

    it('should support postMessage-based runtime error capture from iframe', () => {
      const previewHtml = readFileSync(previewHtmlPath, 'utf-8');
      expect(previewHtml).toContain('__preview_error__');
      expect(previewHtml).toContain('onIframeMessage');
    });
  });

  // 6. URL parameter support
  describe('URL parameter support', () => {
    it('should read theme and style from URL params', () => {
      const previewHtml = readFileSync(previewHtmlPath, 'utf-8');
      expect(previewHtml).toContain('URLSearchParams');
      expect(previewHtml).toContain("'theme'");
      expect(previewHtml).toContain("'style'");
    });

    it('should update URL when selection changes', () => {
      const previewHtml = readFileSync(previewHtmlPath, 'utf-8');
      expect(previewHtml).toContain('history.replaceState');
    });
  });

  // 7. Manifest-driven dropdowns
  describe('manifest-driven dropdowns', () => {
    it('should load themes-manifest.js via script tag', () => {
      const previewHtml = readFileSync(previewHtmlPath, 'utf-8');
      expect(previewHtml).toContain('themes-manifest.js');
      expect(previewHtml).toContain('__THEMES_MANIFEST__');
    });

    it('should populate theme select from manifest', () => {
      const previewHtml = readFileSync(previewHtmlPath, 'utf-8');
      expect(previewHtml).toContain('id="theme-select"');
      expect(previewHtml).toContain('populateThemeSelect');
    });

    it('should populate style select from manifest (filtered by theme)', () => {
      const previewHtml = readFileSync(previewHtmlPath, 'utf-8');
      expect(previewHtml).toContain('id="style-select"');
      expect(previewHtml).toContain('populateStyleSelect');
    });
  });
});
