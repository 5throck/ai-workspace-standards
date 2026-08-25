#!/usr/bin/env bun
/**
 * Asset-Manifest Validator for co-game projects
 * Validates projects/<game>/asset-manifest.json — the per-game asset registry —
 * by re-reading every referenced file and checking registry consistency.
 * Mirrors co-deck's validate-image-manifest.ts pattern (zero external dependencies).
 *
 * Checks:
 *   1. ERROR — asset file missing or unreadable.
 *   2. ERROR — duplicate content hash: the same asset content registered under
 *      two different ids (re-curate one of them instead of shipping it twice).
 *   3. ERROR — manifest path escaping the project directory (../ traversal).
 *   4. ERROR — unknown asset type (expected: sprite | spritesheet | audio | font | data).
 *   5. ERROR — spritesheet frame math inconsistent: the sheet's actual PNG
 *      dimensions are not an exact frame grid for frame_width x frame_height,
 *      or the grid cannot hold frame_count frames.
 *   6. WARN  — entries missing content_hash (regenerate the manifest).
 *   7. WARN  — audio asset in a format browsers may not play
 *      (expected: ogg | mp3 | wav | opus | m4a | flac).
 *
 * Dimensions are read with an inline zero-dependency PNG IHDR parser — no image library.
 *
 * @version 1.0.0
 * Usage:
 *   bun scripts/co-game/validate-asset-manifest.ts --workspace projects/<game> [--root <path>]
 *   --workspace  game directory under projects/ (required)
 *   --root       instance root, default process.cwd() (where projects/ lives)
 * Exit codes: 0 = pass, 1 = validation errors found (warnings never fail).
 * @module validate-asset-manifest
 */

import { existsSync, readFileSync } from 'fs';
import { join, resolve, extname, sep } from 'path';
import { createHash } from 'crypto';

const args = process.argv.slice(2);
const get = (flag: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};

const workspaceArg = get('--workspace');
const rootArg = get('--root');
const instanceRoot = rootArg ? resolve(rootArg) : process.cwd();

if (!workspaceArg) {
  console.error('Error: --workspace <game-dir> is required');
  console.error('Usage: bun scripts/co-game/validate-asset-manifest.ts --workspace projects/<game> [--root <path>]');
  process.exit(1);
}

const workspacePath = resolve(instanceRoot, workspaceArg);
const manifestPath = join(workspacePath, 'asset-manifest.json');

if (!existsSync(manifestPath)) {
  console.error(`Error: manifest not found: ${manifestPath}`);
  process.exit(1);
}

const VALID_TYPES = new Set(['sprite', 'spritesheet', 'audio', 'font', 'data']);
const PLAYABLE_AUDIO = new Set(['.ogg', '.mp3', '.wav', '.opus', '.m4a', '.flac']);

let errors = 0;
let warnings = 0;

const err = (msg: string) => { errors++; console.error(`ERROR — ${msg}`); };
const warn = (msg: string) => { warnings++; console.warn(`WARN — ${msg}`); };

// PNG: IHDR chunk — width/height are big-endian uint32 at bytes 16 and 20
// (after the 8-byte signature + 4-byte chunk length + 4-byte "IHDR" type).
function pngDimensions(buf: Buffer): { w: number; h: number } | null {
  if (buf.length < 24) return null;
  if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) return null; // \x89PNG
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  return w > 0 && h > 0 ? { w, h } : null;
}

interface AssetEntry {
  id?: string;
  type?: string;
  path?: string;
  content_hash?: string;
  frame_width?: number;
  frame_height?: number;
  frame_count?: number;
}

let manifest: { assets?: AssetEntry[] };
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
} catch (e) {
  console.error(`Error: asset-manifest.json is not valid JSON: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
}

const assets = manifest.assets ?? [];
if (assets.length === 0) {
  warn('manifest has no asset entries');
}

const seenHashes = new Map<string, string>(); // content_hash -> first id that claimed it

for (const asset of assets) {
  const label = asset.id ?? '(missing id)';

  if (!asset.id) err(`asset entry without id: ${JSON.stringify(asset).slice(0, 60)}...`);
  if (!asset.type || !VALID_TYPES.has(asset.type)) {
    err(`${label}: unknown type '${asset.type}' (expected one of: ${[...VALID_TYPES].join(', ')})`);
    continue;
  }
  if (!asset.path) {
    err(`${label}: missing path`);
    continue;
  }

  // Check 3: path escape — the resolved asset path must stay inside the workspace.
  const assetPath = resolve(workspacePath, asset.path);
  if (!assetPath.startsWith(workspacePath + sep) && assetPath !== workspacePath) {
    err(`${label}: path '${asset.path}' escapes the project directory`);
    continue;
  }

  // Check 1: file exists and is readable.
  if (!existsSync(assetPath)) {
    err(`${label}: file not found: ${asset.path}`);
    continue;
  }
  let buf: Buffer;
  try {
    buf = readFileSync(assetPath);
  } catch (e) {
    err(`${label}: file unreadable: ${asset.path} (${e instanceof Error ? e.message : e})`);
    continue;
  }

  // Check 6: content_hash present.
  if (!asset.content_hash) {
    warn(`${label}: missing content_hash — regenerate the manifest`);
  } else {
    // Check 2: duplicate content.
    const actual = createHash('sha256').update(buf).digest('hex');
    if (asset.content_hash !== actual) {
      err(`${label}: content_hash mismatch — file changed since the manifest was generated`);
    }
    const firstClaimant = seenHashes.get(actual);
    if (firstClaimant) {
      err(`${label}: duplicate content — identical to '${firstClaimant}' (re-curate one of them)`);
    } else {
      seenHashes.set(actual, label);
    }
  }

  // Check 5: spritesheet frame math vs actual PNG dimensions.
  if (asset.type === 'spritesheet') {
    const dims = pngDimensions(buf);
    if (!dims) {
      warn(`${label}: spritesheet is not a PNG (or has no IHDR) — frame math skipped`);
    } else {
      const fw = asset.frame_width ?? 0;
      const fh = asset.frame_height ?? 0;
      const fc = asset.frame_count ?? 0;
      if (fw <= 0 || fh <= 0 || fc <= 0) {
        warn(`${label}: spritesheet missing frame_width/frame_height/frame_count — frame math skipped`);
      } else {
        if (dims.w % fw !== 0 || dims.h % fh !== 0) {
          err(`${label}: frame math mismatch — sheet ${dims.w}x${dims.h} is not an exact grid of ${fw}x${fh} frames`);
        } else {
          const capacity = (dims.w / fw) * (dims.h / fh);
          if (capacity < fc) {
            err(`${label}: frame math mismatch — grid holds ${capacity} frames but frame_count is ${fc}`);
          }
        }
      }
    }
  }

  // Check 7: audio playability.
  if (asset.type === 'audio') {
    const ext = extname(asset.path).toLowerCase();
    if (!PLAYABLE_AUDIO.has(ext)) {
      warn(`${label}: audio format '${ext || '(none)'}' may not play in browsers (expected one of: ${[...PLAYABLE_AUDIO].join(', ')})`);
    }
  }
}

console.log(`\nvalidate-asset-manifest: ${assets.length} asset(s) — ${errors} error(s), ${warnings} warning(s)`);
if (errors > 0) {
  console.error('Result: FAIL');
  process.exit(1);
}
console.log('Result: PASS');
process.exit(0);
