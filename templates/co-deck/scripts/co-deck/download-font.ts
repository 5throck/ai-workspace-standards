// @version 2.1.0 — supply-chain hardening: Pretendard pinned to a concrete release
//   tag (no releases/latest), optional per-font expected_sha256 verification of the
//   downloaded archive, hard failure when extraction does not cover spec.files
//   (partial font sets previously exited 0 and surfaced later as PDF font fallback),
//   project-local default font dir (OS font dir writes are opt-in via --os-font-dir),
//   English console output.
// Download Korean TTF fonts for PDF generation — saves to presentations/assets/fonts/ directory.
// Detects fonts already installed system-wide and skips the download.
// Usage: bun scripts/co-deck/download-font.ts <font_name> [output_dir] [--os-font-dir]
//   output_dir defaults to the project-local presentations/assets/fonts/; pass
//   --os-font-dir (without output_dir) to write to the OS user font directory instead.
// Fonts: maruburi | notosanskr | nanumsquareneo | pretendard
// Requires: fflate (bun install fflate)

import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { platform, homedir } from 'os';
import { createHash } from 'crypto';
import { unzipSync } from 'fflate';

interface FontSpec {
  name: string;
  url: string;
  headers: Record<string, string>;
  extract: string;
  nestedZip?: string | null;
  files: Record<string, string>;
  /** SHA-256 of the downloaded archive (hex). Verification runs only when declared. */
  expected_sha256?: string;
}

const FONT_CATALOG: Record<string, FontSpec> = {
  maruburi: {
    name: 'MaruBuri',
    url: 'https://hangeul.pstatic.net/hangeul_static/webfont/zips/maruburi.zip',
    headers: {
      Referer: 'https://hangeul.naver.com/',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
    extract: 'ttf',
    nestedZip: 'MaruBuriTTF.zip',
    files: {
      'MaruBuri-Regular.ttf': 'MaruBuri-Regular.ttf',
      'MaruBuri-Bold.ttf': 'MaruBuri-Bold.ttf',
    },
  },
  notosanskr: {
    name: 'Noto Sans KR',
    url: 'https://fonts.google.com/download?family=Noto%20Sans%20KR',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
    extract: 'ttf',
    files: {
      'NotoSansKR-Regular.ttf': 'NotoSansKR-Regular.ttf',
      'NotoSansKR-Bold.ttf': 'NotoSansKR-Bold.ttf',
    },
  },
  nanumsquareneo: {
    name: 'NanumSquareNeo',
    url: 'https://hangeul.pstatic.net/hangeul_static/webfont/NanumSquareNeo/NanumFontSetup_TTF_SQUARENEO.zip',
    headers: {
      Referer: 'https://hangeul.naver.com/',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
    extract: 'ttf',
    files: {
      'NanumSquareNeoTTF-aLt.ttf': 'NanumSquareNeo-Light.ttf',
      'NanumSquareNeoTTF-bRg.ttf': 'NanumSquareNeo-Regular.ttf',
      'NanumSquareNeoTTF-cBd.ttf': 'NanumSquareNeo-Bold.ttf',
      'NanumSquareNeoTTF-dEb.ttf': 'NanumSquareNeo-ExtraBold.ttf',
      'NanumSquareNeoTTF-eHv.ttf': 'NanumSquareNeo-Heavy.ttf',
    },
  },
  pretendard: {
    name: 'Pretendard',
    // Pinned to a concrete release tag (v1.3.9) — never fetch releases/latest,
    // so a rogue or breaking upstream release cannot silently change the bytes.
    url: 'https://github.com/orioncactus/pretendard/releases/download/v1.3.9/Pretendard-1.3.9.zip',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
    extract: 'ttf',
    files: {
      'Pretendard-Regular.ttf': 'Pretendard-Regular.ttf',
      'Pretendard-Bold.ttf': 'Pretendard-Bold.ttf',
    },
  },
};

// ── Font directory defaults ─────────────────────────────────────────────────────

// Project-local default: font downloads stay inside the project so scaffolds are
// self-contained. Writing to OS font directories is opt-in via --os-font-dir.
const PROJECT_FONT_DIR = 'presentations/assets/fonts';

function getOsFontDir(): string | null {
  const p = platform();
  if (p === 'win32') {
    // Windows: system font install requires admin — no OS user-font dir offered.
    return null;
  }
  const home = homedir();
  if (p === 'darwin') return join(home, 'Library/Fonts');
  // Linux: XDG user font directory
  return join(home, '.local/share/fonts');
}

// ── System font detection ───────────────────────────────────────────────────────

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

function findSystemFont(filename: string): string | null {
  for (const dir of getSystemFontDirs()) {
    const path = join(dir, filename);
    if (existsSync(path)) return path;
  }
  return null;
}

async function downloadBytes(url: string, headers: Record<string, string>): Promise<Uint8Array> {
  const resp = await fetch(url, { headers });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);

  const contentLength = Number(resp.headers.get('content-length') ?? 0);
  const bytes = new Uint8Array(await resp.arrayBuffer());

  if (contentLength > 0) {
    console.log(`  Downloaded ${Math.round(bytes.length / 1024)}KB / ${Math.round(contentLength / 1024)}KB`);
  } else {
    console.log(`  Downloaded ${Math.round(bytes.length / 1024)}KB`);
  }
  return bytes;
}

/** Verify the archive's SHA-256 against the declared checksum. Errors only when a checksum IS declared. */
function verifySha256(bytes: Uint8Array, spec: FontSpec): void {
  if (!spec.expected_sha256) return;
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== spec.expected_sha256.toLowerCase()) {
    throw new Error(
      `SHA-256 mismatch for ${spec.name} archive: expected ${spec.expected_sha256}, got ${actual}. ` +
      `The upstream file changed — do NOT proceed; update expected_sha256 only after verifying the new source.`,
    );
  }
  console.log(`  SHA-256 verified: ${actual}`);
}

function extractFonts(zipBytes: Uint8Array, spec: FontSpec, outputDir: string): [string, number][] {
  const entries = unzipSync(zipBytes);
  const saved: [string, number][] = [];

  // Handle nested zip (e.g. maruburi ships a zip inside a zip)
  if (spec.nestedZip) {
    const nestedKey = Object.keys(entries).find(k => k.endsWith(spec.nestedZip!));
    if (nestedKey) {
      const innerSpec = { ...spec, nestedZip: null };
      return extractFonts(entries[nestedKey], innerSpec, outputDir);
    }
  }

  const ext = (spec.extract ?? 'ttf').toLowerCase();
  const wanted = spec.files;

  for (const [zipPath, data] of Object.entries(entries)) {
    const filename = zipPath.split('/').pop() ?? '';
    if (!filename.toLowerCase().endsWith(`.${ext}`)) continue;

    const outName = wanted[filename] ?? (Object.keys(wanted).length === 0 ? filename : null);
    if (!outName) continue;

    const outPath = join(outputDir, outName);
    writeFileSync(outPath, data);
    saved.push([outName, data.length]);
    console.log(`  OK ${outName} (${Math.round(data.length / 1024)}KB)`);
  }

  return saved;
}

/** Fail when the saved files do not cover every entry of spec.files. */
function verifyCoverage(saved: [string, number][], spec: FontSpec): void {
  const savedNames = new Set(saved.map(([n]) => n));
  const missing = Object.values(spec.files).filter(n => !savedNames.has(n));
  if (missing.length === 0) return;

  console.error(`  ERROR: extraction incomplete — ${missing.length} of ${Object.keys(spec.files).length} expected file(s) missing:`);
  for (const m of missing) console.error(`     ${m}`);
  console.error('  A partial font set would surface later as PDF font fallback. Aborting.');
  throw new Error('extracted files do not cover the font spec');
}

async function main() {
  const args = process.argv.slice(2);
  const osFontDirFlag = args.includes('--os-font-dir');
  const positional = args.filter(a => !a.startsWith('--'));

  if (positional.length < 1) {
    console.log(`Usage: bun scripts/co-deck/download-font.ts <font_name> [output_dir] [--os-font-dir]`);
    console.log(`\nSupported fonts: ${Object.keys(FONT_CATALOG).join(', ')}`);
    console.log(`\nDefault output directory (project-local): ${PROJECT_FONT_DIR}`);
    console.log(`Pass --os-font-dir (without output_dir) to write to the OS user font directory instead.`);
    process.exit(1);
  }

  const fontKey = positional[0].toLowerCase().trim();
  if (!(fontKey in FONT_CATALOG)) {
    console.error(`Unknown font: ${fontKey}`);
    console.error(`Supported fonts: ${Object.keys(FONT_CATALOG).join(', ')}`);
    process.exit(1);
  }

  // Output dir resolution: explicit arg > --os-font-dir opt-in > project-local default.
  let outputDir: string;
  if (positional.length >= 2) {
    outputDir = resolve(positional[1]);
  } else if (osFontDirFlag) {
    const osDir = getOsFontDir();
    if (!osDir) {
      console.error('--os-font-dir is not supported on this platform (system font install requires admin). Using the project-local directory.');
      outputDir = resolve(PROJECT_FONT_DIR);
    } else {
      outputDir = resolve(osDir);
    }
  } else {
    outputDir = resolve(PROJECT_FONT_DIR);
  }
  mkdirSync(outputDir, { recursive: true });

  const spec = FONT_CATALOG[fontKey];

  // Check-before-download: skip if all font files already exist in output dir
  const allExistInOutput = Object.values(spec.files).every(filename =>
    existsSync(join(outputDir, filename))
  );
  if (allExistInOutput) {
    console.log(`OK: ${spec.name} fonts already exist in ${outputDir}`);
    console.log(`   Files: ${Object.values(spec.files).join(', ')}`);
    process.exit(0);
  }

  // Check-before-download: skip if all font files exist in system directories
  const allExistInSystem = Object.keys(spec.files).every(filename =>
    findSystemFont(filename) !== null
  );
  if (allExistInSystem) {
    console.log(`OK: ${spec.name} fonts are already installed system-wide:`);
    for (const filename of Object.keys(spec.files)) {
      const sysPath = findSystemFont(filename);
      console.log(`   ${filename} -> ${sysPath}`);
    }
    console.log(`\n   To copy them into the project font directory as well:`);
    console.log(`   bun scripts/co-deck/download-font.ts ${fontKey} ${outputDir}`);
    process.exit(0);
  }

  console.log(`\nDownloading ${spec.name}`);
  console.log(`   URL: ${spec.url}`);
  console.log(`   OS: ${platform()}`);
  console.log(`   Output: ${outputDir}/\n`);

  try {
    const zipBytes = await downloadBytes(spec.url, spec.headers);
    verifySha256(zipBytes, spec);
    console.log(`  Extracting...`);
    const saved = extractFonts(zipBytes, spec, outputDir);

    if (saved.length === 0) {
      console.error(`  ERROR: no files extracted. Check the zip structure against the font catalog.`);
      process.exit(1);
    }
    verifyCoverage(saved, spec);

    console.log(`\nDone — ${saved.length} file(s) saved`);
    console.log(`   Location: ${outputDir}/`);
    console.log(`\nUsed by the PDF scripts as:`);
    for (const [outName] of saved) {
      const varName = outName.replace(/-/g, '_').replace(/\.ttf$/i, '').toUpperCase();
      console.log(`   ${varName} = "${join(outputDir, outName)}"`);
    }
  } catch (err: any) {
    console.error(`\nError: ${err.message}`);
    console.error('   Check the URL, or download the font manually from the vendor site.');
    process.exit(1);
  }
}

main();
