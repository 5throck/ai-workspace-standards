// @version 2.0.0 — OS-aware font directory defaults + system font detection.
// Download Korean TTF fonts for PDF generation — saves to presentations/assets/fonts/ directory.
// Auto-detects OS to set default font directory; skips download if fonts are already
// installed system-wide.
// Usage: bun scripts/download-font.ts <font_name> [output_dir]
// Fonts: maruburi | notosanskr | nanumsquareneo | pretendard
// Requires: fflate (bun install fflate)

import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { platform, homedir } from 'os';
import { unzipSync } from 'fflate';

interface FontSpec {
  name: string;
  url: string;
  headers: Record<string, string>;
  extract: string;
  nestedZip?: string | null;
  files: Record<string, string>;
}

const FONT_CATALOG: Record<string, FontSpec> = {
  maruburi: {
    name: '마루부리 (MaruBuri)',
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
    name: '나눔스퀘어 네오 (NanumSquareNeo)',
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
    url: 'https://github.com/orioncactus/pretendard/releases/latest/download/Pretendard.zip',
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

// ── OS-aware default font directory ─────────────────────────────────────────────

function getDefaultFontDir(): string {
  const p = platform();
  const home = homedir();

  if (p === 'win32') {
    // Windows: use project-relative presentations/assets/fonts/ (system font install requires admin)
    return 'presentations/assets/fonts';
  } else if (p === 'darwin') {
    // macOS: user font directory (no admin needed)
    return join(home, 'Library/Fonts');
  } else {
    // Linux: XDG user font directory
    return join(home, '.local/share/fonts');
  }
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
    console.log(`  다운로드 완료 ${Math.round(bytes.length / 1024)}KB / ${Math.round(contentLength / 1024)}KB`);
  } else {
    console.log(`  다운로드 완료 ${Math.round(bytes.length / 1024)}KB`);
  }
  return bytes;
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
    console.log(`  ✓ ${outName} (${Math.round(data.length / 1024)}KB)`);
  }

  return saved;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log(`사용법: bun scripts/download-font.ts <font_name> [output_dir]`);
    console.log(`\n지원 폰트: ${Object.keys(FONT_CATALOG).join(', ')}`);
    console.log(`\nOS 감지: ${platform()} — 기본 폰트 디렉토리: ${getDefaultFontDir()}`);
    process.exit(1);
  }

  const fontKey = args[0].toLowerCase().trim();
  if (!(fontKey in FONT_CATALOG)) {
    console.error(`❌ 알 수 없는 폰트: ${fontKey}`);
    console.error(`지원 폰트: ${Object.keys(FONT_CATALOG).join(', ')}`);
    process.exit(1);
  }

  const outputDir = resolve(args[1] ?? getDefaultFontDir());
  mkdirSync(outputDir, { recursive: true });

  const spec = FONT_CATALOG[fontKey];

  // Check-before-download: skip if all font files already exist in output dir
  const allExistInOutput = Object.values(spec.files).every(filename =>
    existsSync(join(outputDir, filename))
  );
  if (allExistInOutput) {
    console.log(`✅ ${spec.name} 폰트가 이미 존재합니다: ${outputDir}`);
    console.log(`   파일: ${Object.values(spec.files).join(', ')}`);
    process.exit(0);
  }

  // Check-before-download: skip if all font files exist in system directories
  const allExistInSystem = Object.keys(spec.files).every(filename =>
    findSystemFont(filename) !== null
  );
  if (allExistInSystem) {
    console.log(`✅ ${spec.name} 폰트가 시스템에 이미 설치되어 있습니다:`);
    for (const filename of Object.keys(spec.files)) {
      const sysPath = findSystemFont(filename);
      console.log(`   ${filename} → ${sysPath}`);
    }
    console.log(`\n   💡 프로젝트 폰트 디렉토리에도 복사하려면:`);
    console.log(`   bun scripts/download-font.ts ${fontKey} ${outputDir}`);
    process.exit(0);
  }

  console.log(`\n📦 ${spec.name} 다운로드 시작`);
  console.log(`   URL: ${spec.url}`);
  console.log(`   OS: ${platform()}`);
  console.log(`   저장 위치: ${outputDir}/\n`);

  try {
    const zipBytes = await downloadBytes(spec.url, spec.headers);
    console.log(`  추출 중...`);
    const saved = extractFonts(zipBytes, spec, outputDir);

    if (saved.length === 0) {
      console.warn(`⚠️  추출된 파일이 없습니다. zip 구조를 확인하세요.`);
      process.exit(1);
    }

    console.log(`\n✅ 완료 — ${saved.length}개 파일 저장됨`);
    console.log(`   위치: ${outputDir}/`);
    console.log(`\nPDF 스크립트에서 사용:`);
    for (const [outName] of saved) {
      const varName = outName.replace(/-/g, '_').replace(/\.ttf$/i, '').toUpperCase();
      console.log(`   ${varName} = "${join(outputDir, outName)}"`);
    }
  } catch (err: any) {
    console.error(`\n❌ 오류: ${err.message}`);
    console.error('   URL을 확인하거나 브라우저에서 직접 다운로드하세요.');
    process.exit(1);
  }
}

main();
