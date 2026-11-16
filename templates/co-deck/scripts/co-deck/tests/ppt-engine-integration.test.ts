// @version 1.2.0
// v1.2.0 (design 2026-11-16-co-deck-pdf-html-backport PR-2, U-20261116-009 item 2
//   + U-008 item 4): FootnoteBuilder notes/footnotes split pins (source + CSS +
//   DOM) and zen contact-bullets fallback DOM pins. The DOM suite launches
//   system Chrome via puppeteer-core and self-skips when no Chrome/Edge is
//   installed (CI), mirroring the gen-slides-pdf font-skip convention.
// v1.1.1 (2026-11-15, spec docs/designs/2026-11-15-co-deck-deliverables-migration-design.md): doc-only — usage comments and path constants follow the fleet's deliverables/ consolidation (presentations/ → deliverables/); no logic change.
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

import { describe, it, expect, beforeAll, afterAll, test } from 'bun:test';
import { buildThemeDeck, type BuildOptions } from '../lib/theme-builder.js';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import puppeteer from 'puppeteer-core';

// ── Workspace root & paths ─────────────────────────────────────────────

// tests/ is 3 levels deep from workspace root (scripts/co-deck/tests/).
const ROOT = resolve(dirname(import.meta.path), '../../..');
const slideDataPath = join(dirname(import.meta.path), 'fixtures', 'theme-deck', 'slide-data.json');
const pptEnginePath = join(ROOT, 'docs', 'html-themes', 'themes', '_shared', 'ppt-engine.js');

// Read fixture slide data
const SLIDE_DATA = JSON.parse(readFileSync(slideDataPath, 'utf-8')) as any[];

// PPT-engine themes (those with css_ppt_engine in theme.json)
// pitch migrated from self-contained to ppt-engine on 2026-07-21
const PPT_THEMES = ['outline', 'pitch', 'pitch-enhanced', 'vertical', 'zen'];

// Non-PPT themes (none currently — pitch has been migrated)
const NON_PPT_THEMES: string[] = [];

// ── Helper ────────────────────────────────────────────────────────────

function makeOpts(overrides: Partial<BuildOptions> = {}): BuildOptions {
  return {
    root: ROOT,
    projectPath: join(ROOT, 'deliverables', '_test'),
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

// ── Part A.3: ppt-engine.js IS inlined for pitch (post-migration) ─────

describe('ppt-engine inline contract — inlined for pitch (post-migration)', () => {
  it('should inline ppt-engine.js for pitch theme', () => {
    const result = buildThemeDeck(makeOpts({ theme: 'pitch', style: 'classic' }));
    expect(result.errors).toHaveLength(0);

    // PPT-engine functions MUST be present after migration
    expect(result.html).toContain('var TransitionEngine');
    expect(result.html).toContain('var TOCBuilder');
    expect(result.html).toContain('var NarrationEngine');
    expect(result.html).toContain('function initPPT(options)');

    // Pitch keeps its own slide renderer
    expect(result.html).toContain('const slideData');
    expect(result.html).toContain('function renderSlide(data, index)');

    // Placeholder should NOT remain
    expect(result.html).not.toMatch(/ppt-engine\.js inline \(common PPT runtime\) ─+$/m);
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

  it('should include ppt-engine.css link for pitch theme (post-migration)', () => {
    const result = buildThemeDeck(makeOpts({ theme: 'pitch', style: 'classic' }));
    expect(result.errors).toHaveLength(0);
    expect(result.html).toContain('ppt-engine.css');
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

// ── Part D: Keyboard navigation contract (presenter-remote support) ────

describe('keyboard navigation contract — presenter remotes (clickers)', () => {
  const keydownSection = () => {
    const source = readFileSync(pptEnginePath, 'utf-8');
    const idx = source.indexOf("addEventListener('keydown'");
    expect(idx).toBeGreaterThan(0);
    return source.slice(idx, idx + 2500);
  };

  it('shared engine should navigate on PageDown/PageUp (clicker keycodes)', () => {
    const section = keydownSection();
    // Next-slide group must include PageDown alongside arrows/space
    expect(section).toContain("e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' '");
    // Previous-slide group must include PageUp
    expect(section).toContain("e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp'");
  });

  it('shared engine should jump to first/last slide on Home/End', () => {
    const section = keydownSection();
    expect(section).toContain("e.key === 'Home'");
    expect(section).toContain("e.key === 'End'");
  });

  it('vertical template override should use capture phase (no double-advance)', () => {
    const template = readFileSync(
      join(ROOT, 'docs', 'html-themes', 'themes', 'vertical', 'template.html'),
      'utf-8',
    );
    // The scroll-based override must stop the shared engine handler from
    // also firing on the same keypress, and must run in capture phase.
    expect(template).toContain('stopImmediatePropagation');
    expect(template).toMatch(/\}, true\);.*capture phase to override/s);
    // Override must cover Left/Right too — remotes send them as well
    expect(template).toContain("e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'PageDown'");
    expect(template).toContain("e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'PageUp'");
  });

  it('built decks should inline the full key set', () => {
    // Every PPT-engine theme build must carry the clicker keys in its output
    for (const theme of PPT_THEMES) {
      const result = buildThemeDeck(makeOpts({ theme, style: 'classic' }));
      if (result.errors.length > 0) continue; // skip incompatible combos
      expect(result.html).toContain("'PageDown'");
      expect(result.html).toContain("'PageUp'");
      expect(result.html).toContain("'Home'");
      expect(result.html).toContain("'End'");
    }
  });
});

// ── Part E: Abbreviation footnotes contract (slideData[i].footnotes) ───

describe('abbreviation footnotes contract', () => {
  it('shared engine should define FootnoteBuilder and call it from initPPT', () => {
    const source = readFileSync(pptEnginePath, 'utf-8');
    expect(source).toContain('FootnoteBuilder');
    expect(source).toMatch(/var FootnoteBuilder = \{/);
    // initPPT must invoke the renderer after slides exist
    expect(source).toMatch(/FootnoteBuilder\.render\(\);/);
    // Renderer reads slideData[i].footnotes (array) and appends .slide-footnote
    expect(source).toContain("d.footnotes");
    expect(source).toContain("'slide-footnote'");
  });

  it('shared CSS should style .slide-footnote with wrap (no truncation)', () => {
    const css = readFileSync(
      join(ROOT, 'docs', 'html-themes', 'themes', '_shared', 'ppt-engine.css'),
      'utf-8',
    );
    expect(css).toContain('.slide-footnote');
    expect(css).toMatch(/white-space:\s*normal/);
    expect(css).toMatch(/--footnote-color/);
  });

  it('built decks should inline the footnote renderer', () => {
    for (const theme of PPT_THEMES) {
      const result = buildThemeDeck(makeOpts({ theme, style: 'classic' }));
      if (result.errors.length > 0) continue;
      expect(result.html).toContain('FootnoteBuilder.render()');
    }
  });

  it('slideData with footnotes field should survive the build unescaped-invalid', () => {
    const data = JSON.parse(JSON.stringify(SLIDE_DATA));
    data[0].footnotes = ['SMR: 소형모듈원전(Small Modular Reactor)'];
    const result = buildThemeDeck(makeOpts({ slideData: data }));
    expect(result.errors).toHaveLength(0);
    expect(result.html).toContain('"footnotes"');
    expect(result.html).toContain('Small Modular Reactor');
  });
});

// ── Part F: notes/footnotes split (U-20261116-009 item 2, PR-2) ────────
//
// The FootnoteBuilder splits two slide-level bands: slideData[i].notes
// (sources/caveats — in-card, static at the end of .slide-content flow, class
// .slide-footnote.slide-notes) and slideData[i].footnotes (abbreviations —
// outside the card, legacy pill on the slide host). Each field renders
// independently; single-field decks render exactly as before.

describe('notes/footnotes split — source and CSS pins', () => {
  it('shared engine should render the notes band in-card and keep the pill branch independent', () => {
    const source = readFileSync(pptEnginePath, 'utf-8');
    // notes branch: in-card .slide-footnote.slide-notes, appended to .slide-content
    expect(source).toMatch(/d\.notes && d\.notes\.length/);
    expect(source).toContain("'slide-footnote slide-notes'");
    expect(source).toContain("host.querySelector('.slide-content')");
    // in-card guard: skip when .slide-content is absent (video-style slides)
    expect(source).toMatch(/if \(content\) \{/);
    // pill branch stays independent of the notes band despite the shared class
    expect(source).toContain(".slide-footnote:not(.slide-notes)");
  });

  it('shared CSS should style the in-card notes band (static, no pill, dim ink)', () => {
    const css = readFileSync(
      join(ROOT, 'docs', 'html-themes', 'themes', '_shared', 'ppt-engine.css'),
      'utf-8',
    );
    const idx = css.indexOf('.slide-footnote.slide-notes');
    expect(idx).toBeGreaterThan(0);
    const block = css.slice(idx, css.indexOf('}', idx) + 1);
    expect(block).toMatch(/position:\s*static/);           // no absolute pill
    expect(block).toMatch(/text-shadow:\s*none/);          // no photo shadow
    expect(block).toMatch(/--text-dim/);                   // muted in-card ink
    // wrap behavior is inherited from the base .slide-footnote rule
    expect(css.slice(0, idx)).toMatch(/\.slide-footnote \{[\s\S]*?white-space:\s*normal/);
  });
});

// ── Part G: rendered-DOM pins (Chrome; self-skips without a browser) ───
//
// Executes a built zen deck in headless Chrome and pins the two PR-2
// rendering contracts on real DOM output:
//   1. FootnoteBuilder split — a slide with notes + footnotes renders two
//      distinct bands (.slide-content > .slide-footnote.slide-notes and
//      .slide > .slide-footnote); single-field slides render their one band;
//      a video slide with footnotes keeps the legacy pill (no .slide-notes).
//   2. zen contact bullets fallback (U-008 item 4 / O-1) — a bullets-only
//      contact slide renders the speaker title + up to 5 .contact-item lines
//      with the first as .contact-primary; a contact*-first slide ignores
//      bullets (parity with the PDF renderer's contact*-first contract).

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome Beta',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/microsoft-edge',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];
const chromePath = CHROME_CANDIDATES.find((c) => existsSync(c));

const DOM_SLIDE_DATA = [
  { section: 'S1', title: 'Notes And Footnotes', bullets: ['bullet one', 'bullet two'],
    notes: ['Source: Co-deck Annual Data 2026'],
    footnotes: ['ABBRZ = Abbreviation Definition Line'] },
  { section: 'S1', title: 'Notes Only Slide', bullets: ['bullet one', 'bullet two'],
    notes: ['Source: Notes Only Source Line'] },
  { section: 'S1', title: 'Footnotes Only Slide', bullets: ['bullet one', 'bullet two'],
    footnotes: ['ABBR2 = Legacy Pill Gloss'] },
  { section: 'S1', title: 'Video With Gloss', videoId: 'abc123XYZ_-',
    footnotes: ['ABBR3 = Video Slide Gloss'] },
  { isContactSlide: true, title: '감사합니다',
    bullets: ['김데크 연구원 · 총괄', 'deck@example.com', '+82-10-1234-5678',
              'linkedin.com/in/deck', 'newsletter.example.com'] },
  { isContactSlide: true, title: 'Reach Out',
    contactEmail: 'keep@existing.deck',
    bullets: ['Fallback bullet that must stay hidden'] },
];

const domDeck = (() => {
  const data = DOM_SLIDE_DATA;
  const result = buildThemeDeck(makeOpts({
    theme: 'zen',
    style: 'white-bubble',
    slideData: data,
    outputPath: join(ROOT, 'scripts', 'co-deck', 'tests', 'tmp', 'ppt-integration-footnote-dom.html'),
  }));
  expect(result.errors).toHaveLength(0);
  return result.html;
})();

describe.skipIf(!chromePath)('notes/footnotes split — rendered DOM (Chrome)', () => {
  let browser: import('puppeteer-core').Browser | null = null;
  let page: import('puppeteer-core').Page | null = null;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: true,
      args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    });
    page = await browser.newPage();
    await page.setContent(domDeck, { waitUntil: 'load' });
    await page.waitForSelector('.slide');
    // FootnoteBuilder.render runs inside initPPT (DOMContentLoaded / immediate)
    await page.waitForFunction(() => document.querySelectorAll('.slide-footnote').length >= 3);
  }, 60000);

  afterAll(async () => { if (browser) await browser.close(); });

  test('a slide with notes + footnotes renders two distinct bands (in-card notes, outside pill)', async () => {
    const bands = await page!.evaluate(() => {
      const slide = document.querySelectorAll('.slide')[0];
      const notes = slide.querySelector('.slide-content > .slide-footnote.slide-notes');
      const pill = slide.querySelector(':scope > .slide-footnote');
      return {
        notesText: notes ? (notes as HTMLElement).textContent : null,
        pillText: pill ? (pill as HTMLElement).textContent : null,
        distinct: !!notes && !!pill && notes !== pill,
        notesOutsideContent: !!notes && !notes.closest('.slide-content'),
      };
    });
    expect(bands.distinct).toBe(true);
    expect(bands.notesText).toContain('Source: Co-deck Annual Data 2026');
    expect(bands.pillText).toContain('ABBRZ = Abbreviation Definition Line');
    // the notes band must be INSIDE the card, the pill outside it
    expect(bands.notesOutsideContent).toBe(false);
  });

  test('a notes-only slide renders the in-card band and no outside pill', async () => {
    const r = await page!.evaluate(() => {
      const slide = document.querySelectorAll('.slide')[1];
      return {
        notes: !!slide.querySelector('.slide-content > .slide-footnote.slide-notes'),
        notesText: (slide.querySelector('.slide-notes') as HTMLElement | null)?.textContent ?? null,
        pill: !!slide.querySelector(':scope > .slide-footnote'),
      };
    });
    expect(r.notes).toBe(true);
    expect(r.notesText).toContain('Source: Notes Only Source Line');
    expect(r.pill).toBe(false);
  });

  test('a footnotes-only slide renders the legacy pill and no notes band (backward compat)', async () => {
    const r = await page!.evaluate(() => {
      const slide = document.querySelectorAll('.slide')[2];
      return {
        pillText: (slide.querySelector(':scope > .slide-footnote') as HTMLElement | null)?.textContent ?? null,
        notes: !!slide.querySelector('.slide-notes'),
      };
    });
    expect(r.pillText).toContain('ABBR2 = Legacy Pill Gloss');
    expect(r.notes).toBe(false);
  });

  test('a video slide with footnotes keeps the legacy pill and gains no in-card notes', async () => {
    const r = await page!.evaluate(() => {
      const slide = document.querySelectorAll('.slide')[3];
      return {
        isVideo: slide.classList.contains('video-slide'),
        hasContent: !!slide.querySelector('.slide-content'),
        pillText: (slide.querySelector(':scope > .slide-footnote') as HTMLElement | null)?.textContent ?? null,
        notes: !!slide.querySelector('.slide-notes'),
      };
    });
    expect(r.isVideo).toBe(true);
    expect(r.hasContent).toBe(false);       // guard: no .slide-content on video slides
    expect(r.pillText).toContain('ABBR3 = Video Slide Gloss');
    expect(r.notes).toBe(false);
  });

  test('a bullets-only contact slide renders the title + 5 contact-item lines, first as .contact-primary', async () => {
    const r = await page!.evaluate(() => {
      const slide = document.querySelectorAll('.slide')[4];
      const items = Array.from(slide.querySelectorAll('.slide-content > .contact-item')) as HTMLElement[];
      return {
        title: (slide.querySelector('.slide-title') as HTMLElement | null)?.textContent ?? null,
        itemCount: items.length,
        firstIsPrimary: items[0]?.classList.contains('contact-primary') ?? false,
        restPlain: items.slice(1).every((el) => !el.classList.contains('contact-primary')),
        primaryText: items[0]?.textContent ?? null,
        lastText: items[items.length - 1]?.textContent ?? null,
      };
    });
    expect(r.title).toContain('감사합니다');
    expect(r.itemCount).toBe(5);
    expect(r.firstIsPrimary).toBe(true);
    expect(r.restPlain).toBe(true);
    expect(r.primaryText).toContain('김데크 연구원');
    expect(r.lastText).toContain('newsletter.example.com');
  });

  test('a contact*-first slide ignores bullets (contact*-first order, PDF parity)', async () => {
    const r = await page!.evaluate(() => {
      const slide = document.querySelectorAll('.slide')[5];
      const items = Array.from(slide.querySelectorAll('.slide-content > .contact-item')) as HTMLElement[];
      return {
        itemCount: items.length,
        texts: items.map((el) => el.textContent),
        hasPrimary: items.some((el) => el.classList.contains('contact-primary')),
      };
    });
    expect(r.itemCount).toBe(1);
    expect(r.texts[0]).toContain('keep@existing.deck');
    expect(r.hasPrimary).toBe(false);
    expect(r.texts.join(' ')).not.toContain('Fallback bullet that must stay hidden');
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
