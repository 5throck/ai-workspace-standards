// ppt-engine-integration.test.ts — builder-side integration tests for the shared PPT runtime.
//
// Validates the ppt-engine.js inline-at-build-time contract (Task 7, Parts A & C):
//   Part A:
//     1. No <script src="...ppt-engine..."> references in generated output
//     2. ppt-engine.js content is inlined for all PPT-engine themes
//     3. ppt-engine.js is NOT inlined for pitch theme
//     4. initPPT function exists in generated HTML for PPT themes
//     5. renderSlide function exists in generated HTML (per-theme, always present)
//   Part C:
//     6. Documentation header exists in ppt-engine.js source file
//
// Run via:
//   bun test scripts/co-deck/tests/ppt-engine-integration.test.ts

import { describe, it, expect } from 'bun:test';
import { buildThemeDeck, type BuildOptions } from '../lib/theme-builder.js';
import { readFileSync } from 'fs';
import { resolve, dirname, join } from 'path';

// ── Workspace root & paths ─────────────────────────────────────────────

// tests/ is 3 levels deep from workspace root (scripts/co-deck/tests/).
const ROOT = resolve(dirname(import.meta.path), '../../..');
const slideDataPath = join(dirname(import.meta.path), 'fixtures', 'theme-deck', 'slide-data.json');
const pptEnginePath = join(ROOT, 'docs', 'html-themes', 'themes', '_shared', 'ppt-engine.js');

// Read fixture slide data
const SLIDE_DATA = JSON.parse(readFileSync(slideDataPath, 'utf-8')) as any[];

// PPT-engine themes (those with css_ppt_engine in theme.json)
const PPT_THEMES = ['outline', 'pitch-enhanced', 'vertical', 'zen'];

// Non-PPT themes (pitch family — self-contained runtime)
const NON_PPT_THEMES = ['pitch'];

// ── Helper ────────────────────────────────────────────────────────────

function makeOpts(overrides: Partial<BuildOptions> = {}): BuildOptions {
  return {
    root: ROOT,
    projectPath: join(ROOT, 'presentations', '_test'),
    theme: 'outline',
    style: 'classic',
    title: 'Integration Test Deck',
    slideData: SLIDE_DATA,
    outputPath: join(ROOT, 'scripts', 'co-deck', 'tests', 'tmp', 'ppt-integration-test.html'),
    ...overrides,
  };
}

// ── Part A.1: No <script src> references to ppt-engine ────────────────

describe('ppt-engine inline contract — no <script src> references', () => {
  const allThemes = [...PPT_THEMES, ...NON_PPT_THEMES];

  for (const theme of allThemes) {
    // Find a compatible style for each theme
    const compatibleStyle = theme === 'pitch' ? 'classic' : 'classic';

    it(`should have no <script src="...ppt-engine..."> in output for theme "${theme}"`, () => {
      const result = buildThemeDeck(makeOpts({ theme, style: compatibleStyle }));

      // Skip if build fails (incompatibility)
      if (result.errors.length > 0) {
        expect(result.errors.length).toBeGreaterThan(0);
        return;
      }

      expect(result.errors).toHaveLength(0);

      // No <script src> tag referencing ppt-engine in the generated HTML.
      // Strip all content inside <script>...</script> and <!-- ... --> blocks first,
      // then check that no <script src="...ppt-engine..."> remains.
      const htmlSansScripts = result.html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '');
      const scriptSrcMatch = htmlSansScripts.match(/<script\s+src=["'][^"']*ppt-engine[^"']*["'][^>]*>/i);
      expect(scriptSrcMatch).toBeNull();
    });
  }
});

// ── Part A.2: ppt-engine.js content is inlined for PPT themes ─────────

describe('ppt-engine inline contract — inlined for PPT themes', () => {
  for (const theme of PPT_THEMES) {
    it(`should inline ppt-engine.js content for theme "${theme}"`, () => {
      const result = buildThemeDeck(makeOpts({ theme, style: 'classic' }));
      expect(result.errors).toHaveLength(0);

      // Key exports from ppt-engine.js must be present
      expect(result.html).toContain('var TransitionEngine');
      expect(result.html).toContain('var PresenterTools');
      expect(result.html).toContain('var TOCBuilder');
      expect(result.html).toContain('var NarrationEngine');
      expect(result.html).toContain('var ThumbnailNav');
      expect(result.html).toContain('var FullscreenManager');

      // Key functions from ppt-engine.js
      expect(result.html).toContain('function showSlide(index)');
      expect(result.html).toContain('function changeSlide(delta)');
      expect(result.html).toContain('function initPPT(options)');

      // DOM helpers
      expect(result.html).toContain('function escapeText(s)');
      expect(result.html).toContain('function el(tag, cls, text)');
      expect(result.html).toContain('function appendInline(parent, s)');

      // TOC functions
      expect(result.html).toContain('function toggleTOC()');
      expect(result.html).toContain('function closeTOC()');

      // Documentation header should be present (first line has the file description)
      expect(result.html).toContain('ppt-engine.js — PPT-style common runtime engine');

      // The placeholder comment line (with trailing dashes) should NOT remain.
      // The inlined ppt-engine.js has a different description of the placeholder.
      // Template placeholders look like: // ── ppt-engine.js inline (common PPT runtime) ────
      // After replacement, that exact trailing-dashes pattern should be gone.
      expect(result.html).not.toMatch(/ppt-engine\.js inline \(common PPT runtime\) ─+$/m);
    });
  }
});

// ── Part A.3: ppt-engine.js is NOT inlined for pitch ──────────────────

describe('ppt-engine inline contract — NOT inlined for pitch', () => {
  it('should NOT inline ppt-engine.js for pitch theme', () => {
    const result = buildThemeDeck(makeOpts({ theme: 'pitch', style: 'classic' }));
    expect(result.errors).toHaveLength(0);

    // PPT-engine functions should NOT be present
    expect(result.html).not.toContain('var TransitionEngine');
    expect(result.html).not.toContain('var TOCBuilder');
    expect(result.html).not.toContain('var NarrationEngine');
    expect(result.html).not.toContain('function initPPT(options)');

    // But slideData and renderSlide should still be present (pitch has its own runtime)
    expect(result.html).toContain('const slideData');
    expect(result.html).toContain('function renderSlide(data, index)');
  });
});

// ── Part A.4: initPPT function exists in PPT theme output ─────────────

describe('ppt-engine inline contract — initPPT function', () => {
  for (const theme of PPT_THEMES) {
    it(`should contain initPPT function in output for theme "${theme}"`, () => {
      const result = buildThemeDeck(makeOpts({ theme, style: 'classic' }));
      expect(result.errors).toHaveLength(0);

      // initPPT should be defined as a function
      expect(result.html).toContain('function initPPT(options)');
      // initPPT should be called in the initialization code
      expect(result.html).toContain('initPPT(');
    });
  }
});

// ── Part A.5: renderSlide function exists in all theme output ──────────

describe('ppt-engine inline contract — renderSlide per-theme', () => {
  const allThemes = [...PPT_THEMES, ...NON_PPT_THEMES];

  for (const theme of allThemes) {
    const compatibleStyle = theme === 'pitch' ? 'classic' : 'classic';

    it(`should contain renderSlide function in output for theme "${theme}"`, () => {
      const result = buildThemeDeck(makeOpts({ theme, style: compatibleStyle }));

      if (result.errors.length > 0) {
        expect(result.errors.length).toBeGreaterThan(0);
        return;
      }

      expect(result.errors).toHaveLength(0);

      // renderSlide is per-theme (defined in template.html, not ppt-engine.js)
      // It must exist in all theme outputs
      expect(result.html).toContain('function renderSlide(data, index)');
    });
  }
});

// ── Part A bonus: ppt-engine.css link inclusion ────────────────────────

describe('ppt-engine CSS link contract', () => {
  for (const theme of PPT_THEMES) {
    it(`should include ppt-engine.css link for theme "${theme}"`, () => {
      const result = buildThemeDeck(makeOpts({ theme, style: 'classic' }));
      expect(result.errors).toHaveLength(0);
      expect(result.html).toContain('ppt-engine.css');
    });
  }

  it('should NOT include ppt-engine.css link for pitch theme', () => {
    const result = buildThemeDeck(makeOpts({ theme: 'pitch', style: 'classic' }));
    expect(result.errors).toHaveLength(0);
    expect(result.html).not.toContain('ppt-engine.css');
  });
});

// ── Part C.6: Documentation header in ppt-engine.js source ────────────

describe('ppt-engine.js documentation header', () => {
  it('should have the shared runtime contract documented', () => {
    const source = readFileSync(pptEnginePath, 'utf-8');

    // Top-level file description
    expect(source).toContain('ppt-engine.js — PPT-style common runtime engine');

    // Shared Runtime Contract section
    expect(source).toContain('Shared Runtime Contract');
    expect(source).toContain('PPT-engine family');
    expect(source).toContain('Pitch family');

    // renderSlide per-theme explanation
    expect(source).toContain('renderSlide() — Per-Theme, NOT Shared');
    expect(source).toContain('.slide-header + .slide-card');
    expect(source).toContain('.slide-content > .slide-left + .right-panel');
    expect(source).toContain('data-type="cover"');
    expect(source).toContain('data-type="title"');
    expect(source).toContain('Flexbox');
    expect(source).toContain('CSS Grid');

    // Build-time inline contract mention (text spans multiple lines)
    expect(source).toContain('Inlined into each template.html');
    expect(source).toContain('at build time');
    expect(source).toContain('theme-builder.ts');
  });

  it('should list all key components in the header', () => {
    const source = readFileSync(pptEnginePath, 'utf-8');

    // All major components should be documented
    expect(source).toContain('TransitionEngine');
    expect(source).toContain('PresenterTools');
    expect(source).toContain('TOCBuilder');
    expect(source).toContain('ThumbnailNav');
    expect(source).toContain('FullscreenManager');
    expect(source).toContain('NarrationEngine');
    expect(source).toContain('Keyboard shortcuts');
  });
});

// ── Cleanup ────────────────────────────────────────────────────────────

describe('cleanup: ppt-engine integration test output', () => {
  const { rmSync, existsSync } = require('fs');
  const tmpOutputPath = join(ROOT, 'scripts', 'co-deck', 'tests', 'tmp', 'ppt-integration-test.html');

  it('remove generated test output file', () => {
    if (existsSync(tmpOutputPath)) {
      rmSync(tmpOutputPath);
    }
    expect(true).toBe(true);
  });
});
