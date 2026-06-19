// @version 1.0.0
// Download Korean TTF fonts for PDF generation — saves to fonts/ directory.
// Usage: bun scripts/download-font.ts <font_name> [output_dir]
// Fonts: maruburi | notosanskr | nanumsquareneo | pretendard
// Requires: fflate (bun install fflate)

import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { unzipSync, strFromU8 } from 'fflate';

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
    process.exit(1);
  }

  const fontKey = args[0].toLowerCase().trim();
  if (!(fontKey in FONT_CATALOG)) {
    console.error(`❌ 알 수 없는 폰트: ${fontKey}`);
    console.error(`지원 폰트: ${Object.keys(FONT_CATALOG).join(', ')}`);
    process.exit(1);
  }

  const outputDir = resolve(args[1] ?? 'fonts');
  mkdirSync(outputDir, { recursive: true });

  const spec = FONT_CATALOG[fontKey];
  console.log(`\n📦 ${spec.name} 다운로드 시작`);
  console.log(`   URL: ${spec.url}`);
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
