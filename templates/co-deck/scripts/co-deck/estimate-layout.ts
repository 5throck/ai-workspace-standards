// @version 1.6.0 — meta-wording gate (U-20261119-006, batch-2 PR-E1):
//   • --lint gains the audience-language wording check on top of the
//     content_constraints counts. Three banned pattern families (SKILL
//     storyline Step 3.5 R1): epistemic bullet prefixes
//     (사실/가능성/해석/추정/전망 + —/:/-), parenthetical meta asides
//     ((강연자 해석)/(확정된 사실은 아님)/(확인 필요)), and narration epistemic
//     disclaimers (근거는 없습니다 / 독립적인 검증을 거친 것은 아니라는 점).
//   • Slide-visible fields (title, subtitle, text, bullets, visualTitle,
//     visualDisplay, visualCaption, notes, footnotes) fail on ALL three
//     families. Script fields (script/scriptEn/scriptJa) fail on bullet
//     prefixes and parentheticals only — owner decision D3: narration
//     disclaimers are banned on slides but ALLOWED in the spoken script.
//   • The wording check applies to every declared-type slide, independent of
//     content_constraints (a divider caption can carry the defect too).
// v1.5.1 (2026-11-15, spec docs/designs/2026-11-15-co-deck-deliverables-migration-design.md): doc-only — usage comments and path constants follow the fleet's deliverables/ consolidation (presentations/ → deliverables/); no logic change.
//   • lintSlideContent resolves the slide type via lib/slide-type.ts
//     slideTypeOf() — recognizes the boolean-flag schema current decks emit
//     (isCover/isDivider/isPunchline/isContact/isProfile) in addition to the
//     legacy `type` string; every special slide previously fell through to
//     `standard` and falsely failed the min-content checks (U-20261105-001).
//   • frontmatter/layout_overrides parsing moved to lib/layout-overrides.ts
//     (shared with gen-slides-pdf.ts — dotted-key dialect parity,
//     U-20261105-003).
// v1.4.0 — --lint gains minimum content checks (U-20261029-006):
// min_bullets / min_body_chars read per type from the merged content_constraints;
// standard slides default to 3 bullets / 40 body chars when the theme declares
// no minimum (explicit 0 disables); slides carrying videoId are exempt.
// v1.3.0 — adds --lint layout gate: checks every slide in slidedata.json
// against the merged spec's content_constraints; exits 1 on any violation.
// v1.1.0: OS-aware font search paths (Windows, macOS, Linux).
// Playwright-free PDF layout preparation — replaces measure-layout.ts.
// Reads lecture-profile.md, resolves the 4-layer spec merge, validates fonts,
// and outputs a summary for review. Optionally triggers a sample PDF.
// Usage: bun scripts/co-deck/estimate-layout.ts --project deliverables/<project> [--sample] [--lint] [--font-dir deliverables/assets/fonts/]
// No Playwright dependency required.

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { platform, homedir } from 'os';
import { deepMerge, parseFrontmatter } from './lib/layout-overrides';
import { slideTypeOf, type SlideSchemaItem } from './lib/slide-type';

// ── Types ────────────────────────────────────────────────────────────────────

interface Region { x_pct: number; y_pct: number; w_pct: number; h_pct: number; fit?: string; }

interface LayoutSpec {
  version?: string;
  page?: { width_mm?: number; height_mm?: number; margin_mm?: number; aspect_ratio?: string };
  calibration?: { viewport_px?: number };
  regions?: Record<string, Region | null>;
  slide_types?: Record<string, { regions: string[] }>;
  slide_type_overrides?: Record<string, Record<string, Region | null>>;
  fonts?: Record<string, number>;
  line_heights?: Record<string, number>;
  colors?: Record<string, number[]>;
  image_zones?: Record<string, Region>;
  content_constraints?: Record<string, Record<string, number>>;
  print?: Record<string, any>;
}

// ── Font validation ──────────────────────────────────────────────────────────

interface FontStatus { name: string; regular: boolean; bold: boolean; path: string; }

/** OS-aware system font directories for PDF font discovery */
function getSystemFontDirs(): string[] {
  const p = platform();
  const home = homedir();
  if (p === 'win32') {
    return ['C:/Windows/Fonts'];
  } else if (p === 'darwin') {
    return [
      join(home, 'Library/Fonts'),
      '/Library/Fonts',
      '/System/Library/Fonts',
    ];
  } else {
    return [
      join(home, '.local/share/fonts'),
      '/usr/share/fonts/truetype',
      '/usr/share/fonts/opentype',
      '/usr/share/fonts',
    ];
  }
}

function findFontFile(prefix: string, suffix: string, searchDirs: string[]): string | null {
  // Search in project font dir first, then system dirs
  const filename = `${prefix}${suffix}`;
  for (const dir of searchDirs) {
    const path = join(dir, filename);
    if (existsSync(path)) return path;
  }
  return null;
}

function checkFonts(fontDir: string): FontStatus[] {
  const fonts = [
    { name: 'Pretendard', prefix: 'Pretendard' },
    { name: 'MaruBuri', prefix: 'MaruBuri' },
  ];

  // Build search path list: project dir → system dirs
  const searchDirs = [fontDir, ...getSystemFontDirs()];

  return fonts.map(f => ({
    name: f.name,
    regular: findFontFile(f.prefix, '-Regular.ttf', searchDirs) !== null,
    bold: findFontFile(f.prefix, '-Bold.ttf', searchDirs) !== null,
    path: findFontFile(f.prefix, '-Regular.ttf', searchDirs) ?? fontDir,
  }));
}

// ── Summary generator ───────────────────────────────────────────────────────

function generateSummary(
  theme: string,
  style: string,
  merged: LayoutSpec,
  hasOverrides: boolean,
  fontDir: string,
  fontStatus: FontStatus[],
): string {
  const lines: string[] = [
    '# PDF Layout Summary',
    '',
    `> Theme: **${theme}** | Style: **${style}**`,
    hasOverrides ? '> ⚠️ Project-level `layout_overrides` detected — overrides are active.' : '',
    '',
    '---',
    '',
  ];

  // Page info
  const page = merged.page ?? {};
  lines.push('## Page Dimensions', '');
  lines.push('| Property | Value |', '|----------|-------|');
  lines.push(`| Width | ${page.width_mm ?? 338.7} mm |`);
  lines.push(`| Height | ${page.height_mm ?? 190.5} mm |`);
  lines.push(`| Margin | ${page.margin_mm ?? 0} mm |`);
  lines.push(`| Aspect | ${page.aspect_ratio ?? '16:9'} |`);
  lines.push('');

  // Calibration
  const vp = merged.calibration?.viewport_px;
  if (vp) {
    lines.push(`**Viewport calibration**: ${vp}px height`);
    lines.push(`- px→mm: \`(px / ${vp}) × ${(page.height_mm ?? 190.5).toFixed(1)}\``);
    lines.push(`- px→pt: \`(px / ${vp}) × ${(page.height_mm ?? 190.5).toFixed(1)} × 2.835\``);
    lines.push('');
  }

  // Regions
  const regions = merged.regions ?? {};
  const typeOverrides = merged.slide_type_overrides ?? {};
  const slideTypes = merged.slide_types ?? {};

  lines.push('## Regions', '');
  lines.push('### Default Regions', '');
  lines.push('| Region | X% | Y% | W% | H% | Fit |', '|--------|-----|-----|-----|-----|-----|');
  for (const [name, r] of Object.entries(regions)) {
    if (r === null) { lines.push(`| ${name} | — | — | — | — | — |`); continue; }
    lines.push(`| ${name} | ${(r.x_pct * 100).toFixed(1)} | ${(r.y_pct * 100).toFixed(1)} | ${(r.w_pct * 100).toFixed(1)} | ${(r.h_pct * 100).toFixed(1)} | ${r.fit ?? '—'} |`);
  }
  lines.push('');

  // Per-slide-type overrides
  if (Object.keys(typeOverrides).length > 0) {
    lines.push('### Slide Type Overrides', '');
    for (const [type, overrides] of Object.entries(typeOverrides)) {
      const typeRegions = slideTypes[type]?.regions ?? [];
      lines.push(`**${type}** (uses: ${typeRegions.join(', ')}):`, '');
      lines.push('| Region | X% | Y% | W% | H% | Fit |', '|--------|-----|-----|-----|-----|-----|');
      for (const [name, r] of Object.entries(overrides)) {
        if (r === null) continue;
        lines.push(`| ${name} | ${(r.x_pct * 100).toFixed(1)} | ${(r.y_pct * 100).toFixed(1)} | ${(r.w_pct * 100).toFixed(1)} | ${(r.h_pct * 100).toFixed(1)} | ${r.fit ?? '—'} |`);
      }
      lines.push('');
    }
  }

  // Slide types
  lines.push('## Slide Types', '');
  lines.push('| Type | Regions Used |', '|------|--------------|');
  for (const [type, info] of Object.entries(slideTypes)) {
    lines.push(`| ${type} | ${info.regions.join(', ')} |`);
  }
  lines.push('');

  // Fonts
  const fonts = merged.fonts ?? {};
  if (Object.keys(fonts).length > 0) {
    lines.push('## Font Sizes', '');
    lines.push('| Key | Value |', '|-----|-------|');
    for (const [key, val] of Object.entries(fonts)) {
      const unit = key.endsWith('_pt') ? 'pt' : key.endsWith('_px') ? 'px' : '';
      lines.push(`| ${key} | ${val}${unit} |`);
    }
    lines.push('');
  }

  // Line heights
  const lineHeights = merged.line_heights ?? {};
  if (Object.keys(lineHeights).length > 0) {
    lines.push('## Line Heights', '');
    lines.push('| Key | Value (px) | Value (mm) |', '|-----|------------|------------|');
    for (const [key, val] of Object.entries(lineHeights)) {
      const mmVal = vp ? ((val / vp) * (page.height_mm ?? 190.5)).toFixed(2) : '—';
      lines.push(`| ${key} | ${val} | ${mmVal} |`);
    }
    lines.push('');
  }

  // Content constraints
  const constraints = merged.content_constraints ?? {};
  if (Object.keys(constraints).length > 0) {
    lines.push('## Content Constraints', '');
    for (const [type, rules] of Object.entries(constraints)) {
      lines.push(`**${type}**: ${Object.entries(rules as Record<string, number>).map(([k, v]) => `${k}=${v}`).join(', ')}`);
    }
    lines.push('');
  }

  // Font availability
  lines.push('## Font Availability', '');
  lines.push(`Font directory: \`${fontDir}\``, '');
  lines.push('| Font | Regular | Bold |', '|------|---------|-----|');
  for (const fs of fontStatus) {
    const regIcon = fs.regular ? '✅' : '❌';
    const boldIcon = fs.bold ? '✅' : '❌';
    lines.push(`| ${fs.name} | ${regIcon} | ${boldIcon} |`);
  }
  lines.push('');

  const preferred = fontStatus.find(f => f.regular && f.bold);
  if (preferred) {
    lines.push(`**Active font**: ${preferred.name} (first found with Regular+Bold)`);
  } else {
    lines.push('⚠️ **No complete font pair found.** Run `bun scripts/co-deck/download-font.ts pretendard` to download.');
  }
  lines.push('');

  // Layer provenance
  lines.push('## Layer Provenance', '');
  lines.push('This summary reflects the merged result of:', '');
  lines.push('1. **Layer 0**: `themes/_shared/layout_base.json` (page dimensions, null regions)');
  lines.push(`2. **Layer 1**: \`themes/${theme}/pdf_layout_spec.json\` (regions, fonts, line heights)`);
  lines.push(`3. **Layer 2**: \`styles/${style}/pdf_color_spec.json\` (color palette)`);
  lines.push('4. **Layer 3**: `lecture-profile.md` → `layout_overrides` (per-project overrides)');
  if (hasOverrides) {
    lines.push('', '> ⚠️ Layer 3 overrides are active. Values above may differ from theme defaults.');
  }
  lines.push('');

  return lines.join('\n');
}

// ── Slide content lint (--lint gate) ─────────────────────────────────────────

interface SlideDataItem extends SlideSchemaItem {
  title?: string;
  subtitle?: string;
  sub?: string;
  text?: string;
  videoId?: string;
  bullets?: (string | { text?: string })[];
  visualTitle?: string;
  visualDisplay?: string;
  visualCaption?: string;
  notes?: string[];
  footnotes?: string[];
  script?: string;
  scriptEn?: string;
  scriptJa?: string;
}

/**
 * Locate slidedata.json for a project; extract it from the deck HTML when absent.
 * Returns the parsed slide array, or exits(1) with an explanatory error.
 */
async function loadSlideData(projectDir: string, workspaceRoot: string): Promise<SlideDataItem[]> {
  const slidedataPath = join(projectDir, 'slidedata.json');
  if (!existsSync(slidedataPath)) {
    const htmlFiles = ['lecture_v1.html', 'lecture.html', 'lecture_slide.html'];
    const htmlFile = htmlFiles.find(f => existsSync(join(projectDir, f)));
    if (!htmlFile) {
      console.error(`❌ slidedata.json not found and no HTML file detected for extraction.`);
      console.error(`   Run html-build first, or place slidedata.json in ${projectDir}`);
      process.exit(1);
    }
    console.log(`\n📊 Extracting slide data from ${htmlFile}...`);
    const { execFileSync } = await import('child_process');
    try {
      execFileSync('bun', ['scripts/co-deck/extract_slidedata.mjs', join(projectDir, htmlFile)], {
        cwd: workspaceRoot,
        stdio: 'inherit',
      });
    } catch (e) {
      console.error(`❌ extract_slidedata.mjs failed: ${(e as Error).message}`);
      process.exit(1);
    }
  }
  const slides: SlideDataItem[] = JSON.parse(readFileSync(slidedataPath, 'utf-8'));
  if (!Array.isArray(slides) || slides.length === 0) {
    console.error(`❌ slidedata.json is empty or malformed (expected a non-empty slide array).`);
    process.exit(1);
  }
  return slides;
}

/**
 * Lint slide content against the merged spec's content_constraints.
 * FAIL (exit 1) on any over-bound or under-bound check or a slide type missing
 * from slide_types; WARN (pass) on slide types with no declared constraints.
 *
 * Minimums (U-20261029-006): min_bullets / min_body_chars read per type from
 * the same merged content_constraints as the maxima. Sensible defaults apply
 * to `standard` slides when the theme declares no minimum (explicit 0
 * disables); other types (title/divider/profile/contact/punchline) are exempt
 * unless they declare explicit minimums; slides carrying videoId are exempt
 * (media slides render chrome-free, cf. the template VideoSlide branch).
 */
const DEFAULT_MIN_BULLETS = 3;
const DEFAULT_MIN_BODY_CHARS = 40;

function effectiveMinimums(
  type: string,
  c: Record<string, number> | undefined,
): { minBullets: number | undefined; minBodyChars: number | undefined } {
  const declaredMinBullets = c?.min_bullets;
  const declaredMinBody = c?.min_body_chars;
  const isStandard = type === 'standard';
  // Explicit 0 disables; undefined falls back to the standard-slide defaults.
  const minBullets = declaredMinBullets !== undefined
    ? (declaredMinBullets > 0 ? declaredMinBullets : undefined)
    : (isStandard ? DEFAULT_MIN_BULLETS : undefined);
  const minBodyChars = declaredMinBody !== undefined
    ? (declaredMinBody > 0 ? declaredMinBody : undefined)
    : (isStandard ? DEFAULT_MIN_BODY_CHARS : undefined);
  return { minBullets, minBodyChars };
}

// ── Meta-wording gate (U-20261119-006, batch-2 PR-E1) ────────────────────────
// Audience-language gate: internal verification/meta wording must never reach
// the audience. Three banned pattern families (skills/storyline/SKILL.md
// Step 3.5 R1):
//   1. Epistemic bullet prefixes — `사실 —`, `가능성 —`, `해석 —`, `추정 —`,
//      `전망 —` (label-BEFORE-dash; the pre-existing R1 row covers the
//      label-AFTER-dash aside headers like `— 해석 주의`).
//   2. Parenthetical meta asides — `(강연자 해석)`, `(확정된 사실은 아님)`,
//      `(확인 필요)`.
//   3. Narration epistemic disclaimers — `근거는 없습니다`,
//      `독립적인 검증을 거친 것은 아니라는 점`.
// Slide-visible fields fail on ALL three families. Script fields fail on
// families 1+2 only — owner decision D3: the caveat-to-script migration row
// is narrowed so narration disclaimers stay ALLOWED in the spoken script (the
// presenter speaks them; natural attribution like `행정안전부는 …라고 밝혔다`
// remains the preferred narration form). Verification status itself stays in
// storyline.md / source_notes, never on a slide.
const META_BULLET_PREFIX_RE = /^\s*(사실|가능성|해석|추정|전망)\s*[—:-]/m;
const META_PAREN_RE = /\(\s*(강연자\s*해석|확정된\s*사실은\s*아님|확인\s*필요)\s*\)/;
const META_DISCLAIMER_RES: RegExp[] = [
  /근거는\s*없습니다/,
  /독립적인\s*검증을\s*거친\s*것은\s*아니라는\s*점/,
];

interface WordingRule { kind: 'bullet prefix' | 'paren aside' | 'disclaimer'; re: RegExp; }
const SLIDE_WORDING_RULES: WordingRule[] = [
  { kind: 'bullet prefix', re: META_BULLET_PREFIX_RE },
  { kind: 'paren aside', re: META_PAREN_RE },
  ...META_DISCLAIMER_RES.map(re => ({ kind: 'disclaimer' as const, re })),
];
// D3 narrowing: scripts keep the written-form artifact bans (prefixes and
// parentheticals are not speakable wording) but allow bare disclaimers.
const SCRIPT_WORDING_RULES: WordingRule[] = SLIDE_WORDING_RULES.filter(r => r.kind !== 'disclaimer');

interface WordingHit { field: string; kind: WordingRule['kind']; snippet: string; }

function scanWording(texts: Array<[string, string]>, rules: WordingRule[]): WordingHit[] {
  const hits: WordingHit[] = [];
  for (const [field, text] of texts) {
    for (const rule of rules) {
      const m = rule.re.exec(text);
      if (!m) continue;
      const start = Math.max(0, m.index - 8);
      const end = Math.min(text.length, m.index + m[0].length + 12);
      let snippet = text.slice(start, end).replace(/\s+/g, ' ').trim();
      if (snippet.length > 48) snippet = `${snippet.slice(0, 45)}…`;
      hits.push({ field, kind: rule.kind, snippet });
    }
  }
  return hits;
}

/** Slide-visible text fields (SKILL Step 3.5 R1 scope) as [field, text] pairs. */
function slideVisibleTexts(s: SlideDataItem): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const push = (field: string, v: unknown) => {
    if (typeof v === 'string' && v.trim()) out.push([field, v]);
  };
  push('title', s.title);
  push('subtitle', s.subtitle ?? s.sub);
  push('text', s.text);
  push('visualTitle', s.visualTitle);
  push('visualDisplay', s.visualDisplay);
  push('visualCaption', s.visualCaption);
  if (Array.isArray(s.bullets)) {
    s.bullets.forEach((b, i) => {
      const t = typeof b === 'string' ? b : (b?.text ?? '');
      if (t.trim()) out.push([`bullets[${i}]`, t]);
    });
  }
  for (const key of ['notes', 'footnotes'] as const) {
    const arr = s[key];
    if (Array.isArray(arr)) {
      arr.forEach((v, i) => {
        if (typeof v === 'string' && v.trim()) out.push([`${key}[${i}]`, v]);
      });
    }
  }
  return out;
}

/** Speaker-script fields (TTS narration) as [field, text] pairs. */
function scriptTexts(s: SlideDataItem): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const key of ['script', 'scriptEn', 'scriptJa'] as const) {
    const v = s[key];
    if (typeof v === 'string' && v.trim()) out.push([key, v]);
  }
  return out;
}

function lintSlideContent(slides: SlideDataItem[], merged: LayoutSpec, theme: string): void {
  const constraints = merged.content_constraints ?? {};
  const slideTypes = merged.slide_types ?? {};

  const rows: string[] = [];
  let passCount = 0;
  let failCount = 0;
  let warnSlides = 0;
  let wordingFailCount = 0;

  slides.forEach((s, i) => {
    const num = i + 1;
    // Boolean-flag schema (isCover/isDivider/isPunchline/isContact/isProfile,
    // U-20261105-001) + legacy `type` string via the shared detector.
    const type = slideTypeOf(s);

    if (!slideTypes[type]) {
      rows.push(`| ${num} | ${type} | slide type declared in spec? | — | — | FAIL |`);
      failCount++;
      return;
    }

    // Meta-wording gate (U-20261119-006): runs on every declared-type slide,
    // independent of content_constraints — a divider caption or a title can
    // carry the defect just as well as a standard bullet.
    const wordingHits = [
      ...scanWording(slideVisibleTexts(s), SLIDE_WORDING_RULES),
      ...scanWording(scriptTexts(s), SCRIPT_WORDING_RULES),
    ];
    for (const h of wordingHits) {
      rows.push(`| ${num} | ${type} | meta wording: ${h.kind} (${h.field}) | ${h.snippet.replace(/\|/g, '∥')} | ban | FAIL |`);
      failCount++;
      wordingFailCount++;
    }

    const c = constraints[type];
    if (!c || Object.keys(c).length === 0) {
      rows.push(`| ${num} | ${type} | no content_constraints declared | — | — | WARN |`);
      warnSlides++;
      return;
    }

    const subtitle = s.subtitle ?? s.sub ?? '';
    const bodyChars = (s.bullets?.length)
      ? s.bullets.map(b => typeof b === 'string' ? b : (b.text ?? '')).join('').length
      : (s.text ?? '').length;

    const checks: Array<[string, number, number | undefined, string]> = [
      ['title chars', (s.title ?? '').length, c.max_title_chars, '≤'],
      ['subtitle chars', subtitle.length, c.max_subtitle_chars, '≤'],
      ['desc chars', (s.sub ?? s.text ?? '').length, c.max_desc_chars, '≤'],
      ['bullet count', s.bullets?.length ?? 0, c.max_bullets, '≤'],
      ['body chars', bodyChars, c.max_body_chars, '≤'],
    ];

    // Minimum content (U-20261029-006): media slides are exempt.
    if (!s.videoId) {
      const { minBullets, minBodyChars } = effectiveMinimums(type, c);
      checks.push(['bullet count (min)', s.bullets?.length ?? 0, minBullets, '≥']);
      checks.push(['body chars (min)', bodyChars, minBodyChars, '≥']);
    }

    for (const [label, actual, limit, op] of checks) {
      if (limit === undefined) continue; // constraint not declared for this type
      const violated = op === '≤' ? actual > limit : actual < limit;
      if (violated) {
        rows.push(`| ${num} | ${type} | ${label} | ${actual} | ${op} ${limit} | FAIL |`);
        failCount++;
      } else {
        passCount++;
      }
    }
  });

  console.log(`\n🚧 Layout Gate — content_constraints + meta-wording lint (${slides.length} slides, theme=${theme}):`);
  console.log(`   | # | Type | Check | Actual | Limit | Verdict |`);
  console.log(`   |---|------|-------|--------|-------|---------|`);
  for (const r of rows) console.log(`   ${r}`);
  console.log('');
  console.log(`   ${passCount} check(s) passed, ${failCount} failed, ${warnSlides} slide(s) unconstrained (WARN)`);

  if (failCount > 0) {
    console.error(`\n❌ Layout gate FAILED (${failCount} violation${failCount > 1 ? 's' : ''}) — PDF export is blocked.`);
    console.error(`   Remediation ladder (see skills/slide-layout-gate/SKILL.md):`);
    console.error(`   0. Rewrite meta wording — strip epistemic labels/asides from slide fields (skills/storyline/SKILL.md Step 3.5 R1); caveat disclaimers move to the speaker script, never the slide (owner decision D3)`);
    console.error(`   1. Cut content — trim title/subtitle, tighten or merge bullets (over-bound rows)`);
    console.error(`   1b. Densify content — merge thin slides or add substance (under-bound "min" rows)`);
    console.error(`   2. Split the slide into two standard slides`);
    console.error(`   3. Reclassify the slide type (Uniform Layout Principle)`);
    console.error(`   4. Record a justified layout_overrides entry in lecture-profile.md (last resort)`);
    if (wordingFailCount > 0) {
      console.error(`   Meta wording (${wordingFailCount} row${wordingFailCount > 1 ? 's' : ''}): verification/meta wording is audience-facing — keep the information as natural attribution (e.g. 행정안전부는 …라고 밝혔다) or move it to storyline.md/source_notes; script fields allow spoken disclaimers only (D3).`);
    }
    process.exit(1);
  }
  console.log(`✅ Layout gate passed.`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const get = (flag: string) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
  const has = (flag: string) => args.includes(flag);

  const projectArg = get('--project');
  if (!projectArg) {
    console.error('Usage: bun scripts/co-deck/estimate-layout.ts --project deliverables/<project> [--sample] [--lint] [--font-dir deliverables/assets/fonts/]');
    console.error('');
    console.error('Options:');
    console.error('  --project    Project folder (relative to workspace root)');
    console.error('  --sample     Generate a 5-slide sample PDF after estimation');
    console.error('  --lint       Layout gate: lint slidedata.json against merged content_constraints (exit 1 on violation)');
    console.error('  --font-dir   Custom font directory (default: deliverables/assets/fonts/)');
    process.exit(1);
  }

  const wantSample = has('--sample');
  const wantLint = has('--lint');
  const fontDirArg = get('--font-dir');

  const workspaceRoot = resolve(dirname(import.meta.path), '../..');
  const projectDir = resolve(workspaceRoot, projectArg);

  if (!existsSync(projectDir)) {
    console.error(`❌ Project folder not found: ${projectDir}`);
    process.exit(1);
  }

  // ── Read lecture-profile.md ────────────────────────────────────────────────
  const lectureProfilePath = join(projectDir, 'lecture-profile.md');
  if (!existsSync(lectureProfilePath)) {
    console.error(`❌ lecture-profile.md not found: ${lectureProfilePath}`);
    console.error('   Create a lecture-profile.md in the project folder first.');
    process.exit(1);
  }

  const profileContent = readFileSync(lectureProfilePath, 'utf-8');
  const profile = parseFrontmatter(profileContent);

  const theme = profile.theme ?? 'pitch-enhanced';
  const style = profile.style ?? 'premium-dark';
  if (!profile.theme || !profile.style) {
    console.warn(`[frontmatter] ${lectureProfilePath} has no theme/style frontmatter — assuming defaults (pitch-enhanced / premium-dark).`);
  }
  const hasOverrides = !!profile.layout_overrides && Object.keys(profile.layout_overrides).length > 0;

  console.log(`\n📐 PDF Layout Estimation`);
  console.log(`   Project: ${projectArg}`);
  console.log(`   Theme:   ${theme}`);
  console.log(`   Style:   ${style}`);
  if (hasOverrides) console.log(`   ⚠️  layout_overrides detected in lecture-profile.md`);
  console.log('');

  // ── Load 4-layer spec files ────────────────────────────────────────────────
  const basePath = resolve(workspaceRoot, 'docs/html-themes/themes/_shared/layout_base.json');
  const themePath = resolve(workspaceRoot, `docs/html-themes/themes/${theme}/pdf_layout_spec.json`);
  const stylePath = resolve(workspaceRoot, `docs/html-themes/styles/${style}/pdf_color_spec.json`);

  // Validate existence
  for (const [label, p] of [['layout_base.json', basePath], [`${theme}/pdf_layout_spec.json`, themePath]] as const) {
    if (!existsSync(p)) {
      console.error(`❌ Required spec not found: ${label}`);
      console.error(`   Expected: ${p}`);
      process.exit(1);
    }
  }

  const baseSpec: LayoutSpec = JSON.parse(readFileSync(basePath, 'utf-8'));
  const themeSpec: LayoutSpec = JSON.parse(readFileSync(themePath, 'utf-8'));

  // 4-layer merge
  let merged: LayoutSpec = deepMerge(baseSpec, themeSpec);

  if (existsSync(stylePath)) {
    const styleSpec: any = JSON.parse(readFileSync(stylePath, 'utf-8'));
    if (styleSpec.colors) {
      merged = deepMerge(merged, { colors: styleSpec.colors }) as LayoutSpec;
    }
    console.log(`   ✅ Style spec loaded: ${style}`);
  } else {
    console.log(`   ⚠️  Style spec not found: ${stylePath} — using theme color defaults`);
  }

  if (hasOverrides) {
    merged = deepMerge(merged, profile.layout_overrides) as LayoutSpec;
    console.log(`   ✅ Project overrides applied`);
  }

  console.log(`   ✅ Spec merge complete`);

  // ── Validate spec has usable data ─────────────────────────────────────────
  if (!merged.regions || Object.keys(merged.regions).length === 0) {
    console.error(`❌ Merged spec has no "regions" block (theme=${theme}).`);
    process.exit(1);
  }
  if (!merged.slide_types || Object.keys(merged.slide_types).length === 0) {
    console.error(`❌ Merged spec has no "slide_types" block (theme=${theme}).`);
    process.exit(1);
  }

  // ── Check fonts ───────────────────────────────────────────────────────────
  const fontDir = resolve(workspaceRoot, fontDirArg ?? 'deliverables/assets/fonts');
  const fontStatus = checkFonts(fontDir);
  const preferred = fontStatus.find(f => f.regular && f.bold);

  console.log(`\n🔤 Font check (${fontDir}):`);
  for (const fs of fontStatus) {
    const status = fs.regular && fs.bold ? '✅' : fs.regular || fs.bold ? '⚠️' : '❌';
    console.log(`   ${status} ${fs.name}: Regular=${fs.regular}, Bold=${fs.bold}`);
  }
  if (!preferred) {
    console.log(`   ⚠️  No complete font pair. Run: bun scripts/co-deck/download-font.ts pretendard`);
  } else {
    console.log(`   ✅ Active font: ${preferred.name}`);
  }

  // ── Write summary ────────────────────────────────────────────────────────
  const summary = generateSummary(theme, style, merged, hasOverrides, fontDir, fontStatus);
  const summaryPath = join(projectDir, 'layout_summary.md');
  writeFileSync(summaryPath, summary, 'utf-8');
  console.log(`\n💾 Layout summary saved: ${summaryPath}`);

  // Print condensed version to stdout
  const vp = merged.calibration?.viewport_px;
  const pageH = merged.page?.height_mm ?? 190.5;
  const fonts = merged.fonts ?? {};
  const lineHeights = merged.line_heights ?? {};

  console.log(`\n📋 Quick Reference:`);
  console.log(`   Page: ${merged.page?.width_mm ?? 338.7}×${pageH}mm (${merged.page?.aspect_ratio ?? '16:9'})`);
  if (vp) console.log(`   Viewport: ${vp}px (px→mm = px/${vp}×${pageH})`);
  if (Object.keys(fonts).length > 0) {
    console.log(`   Fonts: ${Object.entries(fonts).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  }
  if (Object.keys(lineHeights).length > 0) {
    console.log(`   Line heights: ${Object.entries(lineHeights).map(([k, v]) => `${k}=${v}px`).join(', ')}`);
  }
  const typeCount = Object.keys(merged.slide_types ?? {}).length;
  const regionCount = Object.entries(merged.regions ?? {}).filter(([, v]) => v !== null).length;
  console.log(`   Slide types: ${typeCount} (${Object.keys(merged.slide_types ?? {}).join(', ')})`);
  console.log(`   Active regions: ${regionCount}`);

  // ── Layout gate (--lint) ─────────────────────────────────────────────────
  if (wantLint) {
    const slides = await loadSlideData(projectDir, workspaceRoot);
    lintSlideContent(slides, merged, theme);
  }

  // ── Optional sample PDF ──────────────────────────────────────────────────
  if (wantSample) {
    if (!preferred) {
      console.log(`\n❌ Cannot generate sample PDF — no complete font pair found.`);
      console.log(`   Run: bun scripts/co-deck/download-font.ts pretendard`);
      process.exit(1);
    }

    // Ensure slidedata.json exists (extract from deck HTML when absent)
    await loadSlideData(projectDir, workspaceRoot);

    console.log(`\n📄 Generating 5-slide sample PDF...`);
    const { execFileSync } = await import('child_process');
    try {
      execFileSync('bun', ['scripts/co-deck/gen-slides-pdf.ts', '--project', projectArg, '--sample', '5'], {
        cwd: workspaceRoot,
        stdio: 'inherit',
      });
    } catch (e) {
      console.error(`❌ gen-slides-pdf.ts failed: ${(e as Error).message}`);
      process.exit(1);
    }

    console.log(`\n✅ Sample PDF generated. Review the 5-slide sample for layout approval.`);
  } else {
    console.log(`\n💡 Next step: generate a 5-slide sample with:`);
    console.log(`   bun scripts/co-deck/gen-slides-pdf.ts --project ${projectArg} --sample 5`);
    console.log(`   Or re-run with --sample flag:`);
    console.log(`   bun scripts/co-deck/estimate-layout.ts --project ${projectArg} --sample`);
  }
}

main().catch(err => { console.error('❌', err); process.exit(1); });
