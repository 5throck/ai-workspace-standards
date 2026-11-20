// @version 1.6.0
// v1.6.0 (2026-11-21, U-20261119-008 — spec
// docs/designs/2026-11-20-co-deck-pipeline-batch-2-design.md §R4, owner
// decision D1 / Option A): deck-scoped asset paths — user-cleared deck-private
// images no longer have to enter the shared pool. Two new accepted spellings:
// "./assets/{images,fonts,videos}/…" (deck-relative) and
// "deliverables/<this-deck>/assets/{images,fonts,videos}/…" (repo-root-relative,
// accepted ONLY for the deck's own directory — another deck's assets tree
// stays a path-style ERROR). Deck-scoped entries pass the same per-image
// checks (existence, content hash, dimensions, aspect, rule-3 deck dedupe)
// but are tagged "deck-local" in the report and are OUTSIDE the pool
// consolidation scope: the pool-wide duplicate scan (2d) still walks
// deliverables/assets/images/ only. Rationale: the old deck-local rejection
// existed for pool consolidation, not privacy — forcing user-cleared press
// images into the pool exposed them cross-deck as a side effect. Missing
// image-manifest.json remains a hard ERROR (Gate 3.5 wiring unchanged); the
// diagram-only-stage auto-degrade is a separate §R4 sub-change, not landed
// here.
// v1.5.0 (2026-11-16, U-20261114-011 — spec docs/designs/2026-11-16-governance-batch-design.md §R7):
//   background_image.chapters[] — chapter/section-scoped background groups are a
//   first-class manifest concept. Each entry {chapter, slug} declares that the
//   chapter's content slides share one pool backdrop; rule 3 (duplicate content
//   hash) EXEMPTS a hash group every slide of which carries a chapter-declared
//   slug (partial registration — a chapter slug shared by some slides plus the
//   same file on an undeclared slide — is still an ERROR). Malformed chapter
//   entries (missing chapter/slug, empty slug) are ERRORs; a declared slug with
//   no matching slides[] entry is a WARN (registered but unused).
// v1.4.2 (2026-11-16, U-20261114-010): --project accepted as a --workspace alias (DX unification with the sibling co-deck tools; usage docs updated).
// v1.4.0 (LOCAL-PATCH — deck-wide photo background doctrine, 2026-11-14
// rebuild of 2026-11-ai-era-business-survival): Rule A amended — scope
// "all"/"divider-cover" with a REGISTERED global background is now the
// approved deck-wide backdrop design, not a family-reuse defect. "Registered"
// = background_image.path set AND the manifest carries the matching global
// entry (slides[] slide_index === -1 with the same path — the image-curator's
// deliberate-registration marker). The U-20261029-007 family-reuse ERROR now
// fires only when the global is NOT registered (path with no matching -1
// entry) or is missing/unreadable. Rationale: the U-20261029-007 doctrine
// predates the deck-wide photo-background feature; under it, one curated
// global photo intentionally serving every in-scope slide is the product, and
// the -1 entry is the curation record. Kept ERRORs: unregistered global path
// serving ≥2 in-scope slides, missing background_image.path under a counting
// scope, unreadable/missing background_image.path file, pathless background
// entries, deck-scoped and pool-wide duplicate content.
// LOCAL-PATCH(upstream-request: U-20261114-005; promotion pending in
// U-20261114-006/-008 — script believed project-owned)
// v1.4.1: pool-wide duplicate diagnostics normalize win32 backslash separators to manifest-convention forward slashes (win32-only test pin validate-image-manifest.test.ts:430; POSIX output unchanged) — single emission site, line 464.
// v1.3.0 (design 2026-11-14-deliverables-rename-asset-pool-consolidation,
// Follow-up 3): pool-wide duplicate content scan promoted WARN → ERROR
// (blocking at Gate 3.5) — pool duplicates are consolidation debt that must not
// ship; existing duplicates were cleaned after v1.2.0, so a clean pool passes.
// v1.2.0 (U-20261114-005): deliverables/ asset-pool enforcement —
//   (a) path-style rule: every slides[].path and background_image.path must be
//       repo-root-relative "deliverables/assets/{images,fonts,videos}/…" or
//       deck-relative "../assets/{images,fonts,videos}/…"; anything else —
//       legacy deck-local trees (pre-rename layouts), absolute paths, arbitrary
//       relatives — is an ERROR with a migration hint. Deck-relative paths
//       resolve against the workspace dir; repo-root-relative against --root
//       (existing behavior).
//   (b) sibling diagram-manifest.json location check: entries[].svg / entries[].png
//       must be repo-root-relative "deliverables/assets/diagrams/…" and exist on disk.
//   (c) pool-wide duplicate content scan of deliverables/assets/images/ (WARN,
//       non-blocking — consolidate pool copies; the hard duplicate ERROR stays
//       deck-scoped).
// v1.1.0 (U-20261029-007): background_image section rules — family/hero reuse
// (one global background serving multiple background-scoped slides), missing
// background coverage under a declared scope, pathless background entries,
// and an unreadable background_image.path file are now ERRORs; slidedata.json
// supplies slide types (explicit WARN-skip when absent). See
// agents/image-curator.md "Background image handling".
// Validate image-manifest.json for a co-deck project — Gate 3.5 hard gate.
//
// Recomputes a SHA-256 content hash and reads pixel dimensions for every image
// referenced in deliverables/<project>/image-manifest.json, then checks:
//   1. ERROR — path-style violation: an image path outside the shared pool
//      convention (deliverables/assets/{images,fonts,videos}/… repo-root-relative
//      or ../assets/{images,fonts,videos}/… deck-relative). Deck-scoped
//      spellings (./assets/{images,fonts,videos}/… deck-relative and
//      deliverables/<this-deck>/assets/{images,fonts,videos}/… repo-root-relative)
//      are VALID since v1.6.0 — deck-private, tagged deck-local, excluded from
//      the pool-wide scan (U-20261119-008).
//   2. ERROR — any image file missing or unreadable.
//   3. ERROR — two or more slides sharing the same content hash (duplicate image
//      across the deck). This is the hard block at Gate 3.5: re-curate one of them
//      before the image-curator → html-build handoff.
//   4. WARN  — image entries missing the extended schema fields
//      (content_hash / width / height / aspect_ratio) — regenerate the manifest.
//   5. WARN  — an image whose aspect ratio deviates > 30% from its theme × image_role
//      target (deck theme read from lecture-profile.md; see agents/image-curator.md
//      "Aspect-Ratio Targets by Theme × Role").
//   6. ERROR — background_image section rules (U-20261029-007, amended v1.4.0):
//      family/hero reuse fires only when a global background serving ≥2
//      in-scope slides is NOT registered (background_image.path set with no
//      matching slides[] entry at slide_index -1); missing coverage when scope
//      all/divider-cover declares no global path, a background entry without a
//      path, and an unreadable background_image.path file remain ERRORs. A
//      registered global is the approved deck-wide backdrop design (v1.4.0
//      LOCAL-PATCH); scope "individual" with one distinct image_role:"background"
//      entry per background slide remains the per-slide-photo flow
//      (agents/image-curator.md "Background image handling").
//   7. WARN  — background_image.path set under scope "individual" (ignored by
//      both renderers); slidedata.json absent while a counting rule needs it.
//   8. ERROR — sibling diagram-manifest.json entries pointing outside the shared
//      diagram pool (deliverables/assets/diagrams/…) or at missing files
//      (U-20261114-005).
//   9. ERROR — the same image content (sha256) filed under two or more different
//      files in the shared pool deliverables/assets/images/ — consolidate pool
//      copies before the handoff (blocking since v1.3.0, consolidation Follow-up 3;
//      deck-scoped duplicates remain rule 3 ERRORs; deck-scoped entries live
//      outside the pool directory and are excluded from this scan — v1.6.0).
//
// Dimensions are read with inline zero-dependency parsers for PNG (IHDR),
// JPEG (SOF marker), and SVG (viewBox / width / height). No external image library.
//
// Usage:
//   bun scripts/co-deck/validate-image-manifest.ts --workspace deliverables/<project> [--root <path>]
//   bun scripts/co-deck/validate-image-manifest.ts --project deliverables/<project> [--root <path>]  (alias)
//   --workspace  project directory under deliverables/ (required; --project accepted as an alias)
//   --root       instance root, default process.cwd() (where deliverables/ and the
//                shared asset pool deliverables/assets/ live)
// Exit codes: 0 = pass, 1 = validation errors found (warnings never fail).

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, relative, resolve } from 'path';
import { createHash } from 'crypto';

const args = process.argv.slice(2);
const get = (flag: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};

// U-20261114-010 DX unification: --project is an alias of --workspace (the
// sibling co-deck tools standardize on --project; both spellings are accepted).
const workspaceArg = get('--workspace') ?? get('--project');
const rootArg = get('--root');
const instanceRoot = rootArg ? resolve(rootArg) : process.cwd();

let errors = 0;
let warnings = 0;

const err = (msg: string) => { console.error(`  ERROR: ${msg}`); errors++; };
const warn = (msg: string) => { console.warn(`  WARN:  ${msg}`); warnings++; };

function readJson(path: string, label: string): any | null {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch (e: any) {
    err(`Failed to parse ${label}: ${e.message}`);
    return null;
  }
}

// ── Dimension parsers (zero-dependency) ────────────────────────────────────────

// PNG: IHDR chunk — width/height are big-endian uint32 at bytes 16 and 20
// (after the 8-byte signature + 4-byte chunk length + 4-byte "IHDR" type).
function pngDimensions(buf: Buffer): { w: number; h: number } | null {
  if (buf.length < 24) return null;
  if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) return null; // \x89PNG
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  return w > 0 && h > 0 ? { w, h } : null;
}

// JPEG: scan segments for a SOF marker (C0–CF except C4/C8/CC), then read
// height (2B BE) and width (2B BE) after the 1-byte precision field.
function jpegDimensions(buf: Buffer): { w: number; h: number } | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null; // SOI
  let i = 2;
  while (i + 3 < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    const isSof = marker >= 0xc0 && marker <= 0xcf &&
                  marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    const standalone = marker >= 0xd0 && marker <= 0xd9; // RSTn / SOI / EOI — no length
    i += 2; // past FF + marker → now at the segment length (if any)
    if (isSof) {
      if (i + 7 > buf.length) return null;
      const height = buf.readUInt16BE(i + 3); // skip 2B length + 1B precision
      const width = buf.readUInt16BE(i + 5);
      return width > 0 && height > 0 ? { w: width, h: height } : null;
    }
    if (standalone) continue;
    if (i + 1 >= buf.length) return null;
    const segLen = buf.readUInt16BE(i); // length includes the 2 length bytes
    if (segLen < 2) return null;
    i += segLen;
  }
  return null;
}

// SVG: XML text — prefer viewBox ("minX minY w h"), else width/height attributes.
function svgDimensions(buf: Buffer): { w: number; h: number } | null {
  const text = buf.toString('utf-8');
  const vb = text.match(/viewBox=["']([^"']+)["']/i);
  if (vb) {
    const parts = vb[1].trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.slice(2).every((n) => Number.isFinite(n) && n > 0)) {
      return { w: parts[2], h: parts[3] };
    }
  }
  const num = (attr: string): number | null => {
    const m = text.match(new RegExp(`\\s${attr}=["']([\\d.]+)`));
    return m ? Number(m[1]) : null;
  };
  const w = num('width');
  const h = num('height');
  return w && h && w > 0 && h > 0 ? { w, h } : null;
}

function detectDimensions(buf: Buffer, ext: string): { w: number; h: number } | null {
  const e = ext.toLowerCase();
  if (e === 'png') return pngDimensions(buf);
  if (e === 'jpg' || e === 'jpeg') return jpegDimensions(buf);
  if (e === 'svg') return svgDimensions(buf);
  return null; // unknown format — caller warns
}

// ── Theme + aspect targets ─────────────────────────────────────────────────────

function detectTheme(workspaceDir: string): string | null {
  const profilePath = join(workspaceDir, 'lecture-profile.md');
  if (!existsSync(profilePath)) return null;
  const text = readFileSync(profilePath, 'utf-8');
  // Match `theme: pitch` / `deck.theme: pitch` / `- theme = pitch` style lines.
  const m = text.match(/^[^\S\r\n]*theme[^\S:=]*[:=][^\S]*["']?([A-Za-z0-9_-]+)/mi);
  return m ? m[1].toLowerCase() : null;
}

// Target aspect (w/h) per theme × image_role. null = no target / skip aspect check.
function aspectTarget(theme: string | null, role: string | undefined): number | null {
  const r = (role || '').toLowerCase();
  if (r === 'background') return 1.78; // full-bleed → landscape, all themes
  if (r === 'divider' || r === 'divider-right') return 1.0;
  if (r === 'illustrative') return theme === 'pitch' ? 0.73 : null; // only pitch has a right panel
  return null; // portrait, data-viz, none, unknown → skip
}

// ── Path conventions (U-20261114-005 pool; U-20261119-008 deck-scoped) ────────

// Shared-pool bindings come in exactly two shapes:
//   - repo-root-relative: deliverables/assets/{images,fonts,videos}/… (resolved
//     against --root, where the shared pool lives)
//   - deck-relative: ../assets/{images,fonts,videos}/… (resolved against the
//     workspace dir — the deck HTML sits in deliverables/<project>/)
const POOL_STYLE = /^(deliverables|\.\.)\/assets\/(images|fonts|videos)\//;

// Deck-scoped bindings (U-20261119-008, batch-2 PR-C1 — owner decision D1 /
// Option A, design docs/designs/2026-11-20-co-deck-pipeline-batch-2-design.md
// §R4): a user-cleared deck-private image may stay inside the deck's OWN
// directory:
//   - deck-relative: ./assets/{images,fonts,videos}/… (resolved against the
//     workspace dir)
//   - repo-root-relative: deliverables/<this-deck>/assets/{images,fonts,videos}/…
//     (resolved against --root; accepted only when <this-deck> IS this
//     workspace's own directory under deliverables/ — another deck's tree is
//     neither pool nor this deck's scope and stays an ERROR)
// Valid but DECK-PRIVATE: deck-local files are never consolidated into the
// shared pool and are excluded from the pool-wide duplicate scan (2d) — the
// pool's cross-deck visibility is exactly what the owner declined for these
// files (the U-008 privacy exposure was a side effect of forced pool
// consolidation, not a path-style objection). Rule 3 (duplicate content across
// THIS deck's slides) still applies to deck-local entries; only the
// pool-side consolidation scope is unchanged.
const DECK_LOCAL_STYLE = /^\.\/assets\/(images|fonts|videos)\//;
const DECK_LOCAL_TAIL = /^(images|fonts|videos)\//;

type PathClass = 'pool' | 'deck-local';

// `deliverables/<this-deck>/assets/…` is deck-scoped ONLY when <this-deck> is
// this workspace's own directory under deliverables/. Returns null when the
// workspace does not sit at deliverables/<name> (then only the ./ spelling is
// deck-scoped).
function deckScopedPrefix(): string | null {
  const deckRel = relative(instanceRoot, workspaceDir).replaceAll('\\', '/');
  const m = deckRel.match(/^deliverables\/([^/]+)$/);
  return m ? `deliverables/${m[1]}/assets/` : null;
}

function classifyAssetPath(relPath: string): PathClass | null {
  if (POOL_STYLE.test(relPath)) return 'pool';
  if (DECK_LOCAL_STYLE.test(relPath)) return 'deck-local';
  const prefix = deckScopedPrefix();
  if (prefix !== null && relPath.startsWith(prefix) && DECK_LOCAL_TAIL.test(relPath.slice(prefix.length))) {
    return 'deck-local';
  }
  return null;
}

function resolveAssetPath(relPath: string): string {
  if (relPath.startsWith('../') || relPath.startsWith('./')) {
    return resolve(workspaceDir, relPath);
  }
  return resolve(instanceRoot, relPath);
}

function checkAssetPathStyle(label: string, relPath: string): PathClass | null {
  const cls = classifyAssetPath(relPath);
  if (cls) return cls;
  err(`${label}: path violates the shared-pool convention — must be repo-root-relative "deliverables/assets/{images,fonts,videos}/…", deck-relative "../assets/{images,fonts,videos}/…", or deck-scoped "./assets/{images,fonts,videos}/…" / "deliverables/<this-deck>/assets/{images,fonts,videos}/…" (migrate legacy deck-local or arbitrary paths: move the file into the pool at deliverables/assets/ and rebind — or, for deck-private images the owner declines to pool, rebind under the deck's own assets/) → ${relPath}`);
  return null;
}

// ── 0. Args + manifest load ────────────────────────────────────────────────────

if (!workspaceArg) {
  console.error('Usage: bun scripts/co-deck/validate-image-manifest.ts --workspace deliverables/<project> [--root <path>]');
  console.error('  --workspace  project directory under deliverables/ (required)');
  console.error('  --root       instance root, default process.cwd() (where deliverables/ lives)');
  process.exit(1);
}

const workspaceDir = resolve(instanceRoot, workspaceArg);
function isPlainObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
const manifestPath = join(workspaceDir, 'image-manifest.json');

if (!existsSync(manifestPath)) {
  err(`image-manifest.json not found: ${manifestPath}`);
  console.error('\nvalidate-image-manifest FAILED (no manifest)');
  process.exit(1);
}

const manifest = readJson(manifestPath, 'image-manifest.json');
if (!manifest) {
  console.error('\nvalidate-image-manifest FAILED (unreadable manifest)');
  process.exit(1);
}

const slides: any[] = Array.isArray(manifest.slides) ? manifest.slides : [];

// U-20261114-011: chapter backdrop groups — background_image.chapters[] maps
// chapter → pool slug; the slides[] entries of that chapter's content slides
// share the slug's file, which rule 3 would otherwise flag as duplicate content.
const chapterBackdrops: Array<{ chapter: string | number; slug: string }> = [];
const chapterSlugs = new Set<string>();
const bgRoot = isPlainObj(manifest.background_image) ? manifest.background_image : {};
if (Array.isArray((bgRoot as Record<string, unknown>).chapters)) {
  for (const c of (bgRoot as Record<string, unknown>).chapters as unknown[]) {
    if (!isPlainObj(c) || (typeof c.chapter !== 'string' && typeof c.chapter !== 'number') || typeof c.slug !== 'string' || c.slug === '') {
      err(`background_image.chapters entry malformed — expected {chapter, slug} with a non-empty slug: ${JSON.stringify(c)}`);
      continue;
    }
    chapterBackdrops.push({ chapter: c.chapter as string | number, slug: c.slug });
    chapterSlugs.add(c.slug);
  }
}
const slugOf = (relPath: string): string => {
  const base = relPath.split('/').pop() ?? '';
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(0, dot) : base;
};
const idxPath = new Map<number, string>();
const theme = detectTheme(workspaceDir);

// ── 1. Per-slide: hash + dimensions + aspect + missing-field tally ────────────

const hashToSlides = new Map<string, number[]>();
let imageCount = 0;
let missingFieldEntries = 0;
const deckLocalEntries: string[] = [];

for (const slide of slides) {
  const idx = slide.slide_index;
  const role = slide.image_role;
  const relPath = slide.path;
  if (!relPath || typeof relPath !== 'string') continue; // missing-image / no-image entry

  imageCount++;
  idxPath.set(idx, relPath);
  const pathClass = checkAssetPathStyle(`slide ${idx} (${slide.slide_title ?? '?'})`, relPath);
  if (!pathClass) continue;
  if (pathClass === 'deck-local') deckLocalEntries.push(relPath);
  const absPath = resolveAssetPath(relPath);
  if (!existsSync(absPath)) {
    err(`slide ${idx} (${slide.slide_title ?? '?'}): image file missing → ${relPath}`);
    continue;
  }

  let buf: Buffer;
  try {
    buf = readFileSync(absPath);
  } catch (e: any) {
    err(`slide ${idx}: cannot read image → ${relPath}: ${e.message}`);
    continue;
  }

  // Content hash — recomputed from bytes (source of truth for dedup, independent
  // of whatever the manifest may claim).
  const hash = createHash('sha256').update(buf).digest('hex');
  const group = hashToSlides.get(hash) ?? [];
  group.push(idx);
  hashToSlides.set(hash, group);

  // Extended-schema completeness.
  const missingFields = ['content_hash', 'width', 'height', 'aspect_ratio']
    .filter((f) => slide[f] === undefined || slide[f] === null);
  if (missingFields.length > 0) missingFieldEntries++;

  // Aspect vs target.
  const ext = absPath.split('.').pop() || '';
  const dims = detectDimensions(buf, ext);
  if (dims) {
    const aspect = dims.w / dims.h;
    const target = aspectTarget(theme, role);
    if (target !== null) {
      const deviation = Math.abs(aspect - target) / target;
      if (deviation > 0.30) {
        warn(`slide ${idx} (${role}, theme=${theme ?? '?'}): aspect ${aspect.toFixed(2)} deviates ${Math.round(deviation * 100)}% from target ${target.toFixed(2)} → ${relPath}`);
      }
    }
  } else {
    warn(`slide ${idx}: could not read dimensions for .${ext} → ${relPath} (aspect check skipped)`);
  }
}

if (missingFieldEntries > 0) {
  warn(`${missingFieldEntries} of ${imageCount} image entr${missingFieldEntries === 1 ? 'y is' : 'ies are'} missing extended schema fields (content_hash/width/height/aspect_ratio) — regenerate the manifest to populate`);
}

// ── 2. Duplicate content-hash ERROR (hard block) ───────────────────────────────

for (const [hash, idxs] of hashToSlides) {
  if (idxs.length <= 1) continue;
  // U-20261114-011: a hash group whose slides ALL carry a chapter-declared slug
  // is the registered chapter backdrop — intentional reuse, not duplication.
  const slugs = [...new Set(idxs.map((i) => slugOf(idxPath.get(i) ?? '')))];
  const allChapter = slugs.length >= 1 && slugs.every((s) => chapterSlugs.has(s));
  if (allChapter) {
    warn(`chapter backdrop group (chapters: ${slugs.join(', ')}) serves slides ${idxs.join(', ')} — intentional reuse, not rule-3 duplication`);
    continue;
  }
  err(`duplicate image across slides ${idxs.join(', ')} — identical content hash sha256:${hash.slice(0, 12)}… (re-curate one of them, or register the shared backdrop under background_image.chapters[], before html-build handoff)`);
}

// Chapter slugs with no matching slides[] entry — registered but unused (drift).
for (const c of chapterBackdrops) {
  const used = slides.some((s) => typeof s.path === 'string' && slugOf(s.path) === c.slug);
  if (!used) warn(`background_image.chapters declares chapter ${JSON.stringify(c.chapter)} → slug \"${c.slug}\", but no slides[] entry uses that slug`);
}

// ── 2b. background_image section rules (U-20261029-007) ────────────────────────
// Both renderers bind per-slide background entries ONLY under scope
// "individual" (html-build agents/html-build.md "Background image binding";
// gen-slides-pdf.ts resolveBgImagePath). Under "all"/"divider-cover" the single
// global background_image.path is applied to every in-scope slide — i.e. N ≥ 2
// background slides share one family/hero image, the defect class the ticket
// flags ("each background slide is expected to carry its own distinct image").

// Slide types come from slidedata.json (the deck SSOT produced by html-build).
// Its absence degrades to an explicit WARN-skip, never a false pass.
function loadSlideTypes(workspaceDir: string): { typeOf: (i: number) => string; count: number } | null {
  const sdPath = join(workspaceDir, 'slidedata.json');
  if (!existsSync(sdPath)) return null;
  try {
    const arr = JSON.parse(readFileSync(sdPath, 'utf-8'));
    if (!Array.isArray(arr)) return null;
    const typeOf = (i: number): string => {
      const s = arr[i] ?? {};
      const t = s.type ?? (s.isTitleSlide ? 'cover' : s.isDividerSlide ? 'divider' : s.isPunchline ? 'punchline' : 'standard');
      return t === 'title' ? 'cover' : t;
    };
    return { typeOf, count: arr.length };
  } catch {
    return null;
  }
}

const bg = manifest.background_image ?? null;
const bgEnabled = !!(bg && bg.enabled);
const bgScope: string | null = bg ? (bg.scope ?? 'divider-cover') : null;
const bgCountsScope = bgEnabled && (bgScope === 'all' || bgScope === 'divider-cover');

// Path-style rule applies to background_image.path wherever it is declared
// (pool and deck-scoped spellings are both valid; the class is informational
// here — per-image checks below handle the file itself).
if (bg && typeof bg.path === 'string' && bg.path) {
  checkAssetPathStyle('background_image.path', bg.path);
}

if (bgEnabled && bgScope === 'individual' && bg.path) {
  warn(`background_image.path is set but scope "individual" ignores the global path (per-slide image_role:"background" entries are the source) → ${bg.path}`);
}

if (bgCountsScope) {
  const types = loadSlideTypes(workspaceDir);
  if (!types) {
    warn('slidedata.json not found or unreadable in the workspace — background coverage/reuse checks skipped (slide types needed to count background-scoped slides)');
  } else {
    // Background-scoped slides: scope "all" → every slide; "divider-cover" →
    // cover/title, divider, and punchline slides.
    const scoped: number[] = [];
    for (let i = 0; i < types.count; i++) {
      const t = types.typeOf(i);
      if (bgScope === 'all' || t === 'cover' || t === 'divider' || t === 'punchline') scoped.push(i);
    }

    if (!bg.path || typeof bg.path !== 'string') {
      err(`background_image scope "${bgScope}" declares background slides but background_image.path is missing — ${scoped.length} background slide(s) would render with no background at all (per-slide entries are ignored in this scope; use scope "individual" with one image_role:"background" entry per background slide)`);
    } else {
      // Rule A — family/hero reuse, amended v1.4.0 (deck-wide photo background
      // doctrine): the global image serving every in-scope slide is the
      // APPROVED design when it is registered — background_image.path set AND
      // the manifest carries the deliberate-registration marker (a slides[]
      // entry with slide_index === -1 carrying the same path). Unregistered
      // (path with no matching -1 entry), the U-20261029-007 defect class
      // stands: one image silently washing every background slide with no
      // curation record.
      const globalEntry = slides.find(
        (s) => s.slide_index === -1 && typeof s.path === 'string' && s.path === bg.path,
      );
      if (scoped.length >= 2 && !globalEntry) {
        err(`family reuse: background_image.path serves ${scoped.length} background-scoped slides (slide indices ${scoped.join(', ')}) with no registered global entry — either register the deck-wide background (add a slides[] entry with slide_index -1 carrying this exact path; that is the approved v1.4.0 deck-wide backdrop design) or re-curate with scope "individual" + one distinct image_role:"background" entry per background slide → ${bg.path}`);
      } else if (scoped.length >= 2 && globalEntry) {
        console.log(`  global background registered (slides[] slide_index -1${globalEntry.slug ? ` "${globalEntry.slug}"` : ''}) — scope "${bgScope}" binds it across ${scoped.length} in-scope slide(s) (approved deck-wide backdrop design, v1.4.0 LOCAL-PATCH)`);
      }
      // Rule B3 — the global path never passes through the slides[] loop, so
      // its file must be checked here (pool and deck-scoped spellings alike).
      if (classifyAssetPath(bg.path)) {
        const bgAbs = resolveAssetPath(bg.path);
        if (!existsSync(bgAbs)) {
          err(`background_image.path file missing → ${bg.path}`);
        }
      }
    }
  }
}

// Rule B2 — a declared background entry without a path was silently skipped by
// the per-slide loop above; it is a coverage defect, not a no-image slide.
for (const slide of slides) {
  if (slide.image_role !== 'background') continue;
  const idx = slide.slide_index;
  if (idx === -1) continue; // global background entry (background_image.path is its source)
  if (!slide.path || typeof slide.path !== 'string') {
    err(`background entry for slide ${idx} (${slide.slide_title ?? '?'}) has no image path — declared background with no file (re-curate or drop the entry)`);
  }
}

// ── 2c. diagram-manifest.json location check (U-20261114-005) ──────────────────
// When the workspace carries a sibling diagram-manifest.json, every diagram
// artifact must live in the shared diagram pool and exist on disk. SVG-only
// entries (png: null) are legitimate and skipped.

const DIAG_POOL_STYLE = /^deliverables\/assets\/diagrams\//;

const diagManifestPath = join(workspaceDir, 'diagram-manifest.json');
if (existsSync(diagManifestPath)) {
  const diag = readJson(diagManifestPath, 'diagram-manifest.json');
  if (diag && !Array.isArray(diag.entries)) {
    warn('diagram-manifest.json has no entries[] array — diagram location check skipped');
  } else if (diag) {
    for (const entry of diag.entries) {
      for (const field of ['svg', 'png'] as const) {
        const p = entry?.[field];
        if (!p || typeof p !== 'string') continue; // png: null = SVG-only entry
        const slug = entry?.slug ?? '?';
        if (!DIAG_POOL_STYLE.test(p)) {
          err(`diagram entry "${slug}": ${field} path violates the shared-pool convention — must be repo-root-relative "deliverables/assets/diagrams/…" (migrate deck-local assets/diagrams/ files into the pool and rebind) → ${p}`);
          continue;
        }
        if (!existsSync(resolve(instanceRoot, p))) {
          err(`diagram entry "${slug}": ${field} file missing → ${p}`);
        }
      }
    }
  }
}

// ── 2d. Pool-wide duplicate content scan (ERROR, blocking; consolidation
// Follow-up 3, v1.3.0) ── The same sha256 content filed under two different
// files in the shared pool deliverables/assets/images/ is consolidation debt
// that must not ship — consolidate pool copies before the image-curator →
// html-build handoff. The hard duplicate ERROR (rule 3) stays deck-scoped.
//
// Policy split (U-20261119-008, v1.6.0): this scan remains POOL-ONLY — it
// walks deliverables/assets/images/ and never reaches deck-scoped trees
// (./assets/…, deliverables/<deck>/assets/…). Deck-scoped entries are valid
// bindings but deck-PRIVATE by design: user-cleared images stay out of the
// shared pool because pooling them would expose them cross-deck (the privacy
// exposure was a side effect of forced pool consolidation — the old
// deck-local rejection existed for consolidation, not privacy). Deck-local
// duplicates inside one deck are still caught by rule 3.

const poolDir = join(instanceRoot, 'deliverables/assets/images');
if (existsSync(poolDir)) {
  const poolHashToFiles = new Map<string, string[]>();
  const walkPool = (dir: string): void => {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, name.name);
      if (name.isDirectory()) {
        walkPool(full);
      } else if (name.isFile()) {
        try {
          const h = createHash('sha256').update(readFileSync(full)).digest('hex');
          const files = poolHashToFiles.get(h) ?? [];
          files.push(full.slice(instanceRoot.length + 1).replaceAll('\\', '/'));
          poolHashToFiles.set(h, files);
        } catch {
          // unreadable pool file — the deck-side gate is not the place for it
        }
      }
    }
  };
  walkPool(poolDir);
  for (const [h, files] of poolHashToFiles) {
    if (files.length > 1) {
      err(`duplicate image content in the shared pool — sha256:${h.slice(0, 12)}… filed under ${files.join(', ')} (consolidate pool copies before the html-build handoff; deck-scoped duplicates remain separate ERRORs)`);
    }
  }
}

// ── 3. Report ──────────────────────────────────────────────────────────────────

console.log(`\nvalidate-image-manifest: slides=${slides.length} images=${imageCount} theme=${theme ?? '(unknown)'}`);
if (deckLocalEntries.length > 0) {
  console.log(`  deck-local: ${deckLocalEntries.length} image(s) — deck-scoped paths (U-20261119-008): deck-private, excluded from the shared pool and the pool-wide duplicate scan`);
  for (const p of deckLocalEntries) console.log(`    deck-local → ${p}`);
}
if (errors > 0 || warnings > 0) {
  console.log(`  ${errors} error(s), ${warnings} warning(s)`);
}
if (errors > 0) {
  console.error('\nvalidate-image-manifest FAILED');
  process.exit(1);
}
console.log('validate-image-manifest PASSED');
