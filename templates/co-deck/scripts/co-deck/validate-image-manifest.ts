// @version 1.0.0
// Validate image-manifest.json for a co-deck project — Gate 3.5 hard gate.
//
// Recomputes a SHA-256 content hash and reads pixel dimensions for every image
// referenced in presentations/<project>/image-manifest.json, then checks:
//   1. ERROR — any image file missing or unreadable.
//   2. ERROR — two or more slides sharing the same content hash (duplicate image
//      across the deck). This is the hard block at Gate 3.5: re-curate one of them
//      before the image-curator → html-build handoff.
//   3. WARN  — image entries missing the extended schema fields
//      (content_hash / width / height / aspect_ratio) — regenerate the manifest.
//   4. WARN  — an image whose aspect ratio deviates > 30% from its theme × image_role
//      target (deck theme read from lecture-profile.md; see agents/image-curator.md
//      "Aspect-Ratio Targets by Theme × Role").
//
// Dimensions are read with inline zero-dependency parsers for PNG (IHDR),
// JPEG (SOF marker), and SVG (viewBox / width / height). No external image library.
//
// Usage:
//   bun scripts/co-deck/validate-image-manifest.ts --workspace presentations/<project> [--root <path>]
//   --workspace  project directory under presentations/ (required)
//   --root       instance root, default process.cwd() (where presentations/ lives)
// Exit codes: 0 = pass, 1 = validation errors found (warnings never fail).

import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { createHash } from 'crypto';

const args = process.argv.slice(2);
const get = (flag: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};

const workspaceArg = get('--workspace');
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

// ── 0. Args + manifest load ────────────────────────────────────────────────────

if (!workspaceArg) {
  console.error('Usage: bun scripts/co-deck/validate-image-manifest.ts --workspace presentations/<project> [--root <path>]');
  console.error('  --workspace  project directory under presentations/ (required)');
  console.error('  --root       instance root, default process.cwd() (where presentations/ lives)');
  process.exit(1);
}

const workspaceDir = resolve(instanceRoot, workspaceArg);
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
const theme = detectTheme(workspaceDir);

// ── 1. Per-slide: hash + dimensions + aspect + missing-field tally ────────────

const hashToSlides = new Map<string, number[]>();
let imageCount = 0;
let missingFieldEntries = 0;

for (const slide of slides) {
  const idx = slide.slide_index;
  const role = slide.image_role;
  const relPath = slide.path;
  if (!relPath || typeof relPath !== 'string') continue; // missing-image / no-image entry

  imageCount++;
  const absPath = resolve(instanceRoot, relPath);
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
  if (idxs.length > 1) {
    err(`duplicate image across slides ${idxs.join(', ')} — identical content hash sha256:${hash.slice(0, 12)}… (re-curate one of them before html-build handoff)`);
  }
}

// ── 3. Report ──────────────────────────────────────────────────────────────────

console.log(`\nvalidate-image-manifest: slides=${slides.length} images=${imageCount} theme=${theme ?? '(unknown)'}`);
if (errors > 0 || warnings > 0) {
  console.log(`  ${errors} error(s), ${warnings} warning(s)`);
}
if (errors > 0) {
  console.error('\nvalidate-image-manifest FAILED');
  process.exit(1);
}
console.log('validate-image-manifest PASSED');
