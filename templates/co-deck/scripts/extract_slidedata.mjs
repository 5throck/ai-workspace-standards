#!/usr/bin/env node
/**
 * extract_slidedata.mjs
 * HTML 슬라이드 파일에서 slideData 배열을 추출하여 slidedata.json으로 저장.
 *
 * 사용법:
 *   bun scripts/extract_slidedata.mjs <html_file> [output_json]
 *   node scripts/extract_slidedata.mjs <html_file> [output_json]
 *
 * 예시:
 *   bun scripts/extract_slidedata.mjs lecture_v4.html slidedata.json
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname, basename, join } from "path";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: extract_slidedata.mjs <html_file> [output_json]");
  process.exit(1);
}

const htmlPath = resolve(args[0]);
const outPath = args[1]
  ? resolve(args[1])
  : join(dirname(htmlPath), "slidedata.json");

const html = readFileSync(htmlPath, "utf-8");

// slideData 배열을 추출하는 정규식 패턴
// const slideData = [...] 또는 var slideData = [...] 형태를 탐지
const patterns = [
  /(?:const|let|var)\s+slideData\s*=\s*(\[[\s\S]*?\]);?\s*\n/,
  /(?:const|let|var)\s+slideData\s*=\s*(\[[\s\S]*\])\s*;?\s*<\/script>/,
];

let rawJson = null;
for (const pattern of patterns) {
  const match = html.match(pattern);
  if (match) {
    rawJson = match[1];
    break;
  }
}

if (!rawJson) {
  // 더 넓은 범위로 재시도: slideData = 이후 모든 내용
  const startIdx = html.indexOf("slideData");
  if (startIdx !== -1) {
    const afterAssign = html.indexOf("[", startIdx);
    if (afterAssign !== -1) {
      // 괄호 매칭으로 배열 끝 찾기
      let depth = 0;
      let endIdx = afterAssign;
      for (let i = afterAssign; i < html.length; i++) {
        if (html[i] === "[") depth++;
        else if (html[i] === "]") {
          depth--;
          if (depth === 0) {
            endIdx = i;
            break;
          }
        }
      }
      rawJson = html.slice(afterAssign, endIdx + 1);
    }
  }
}

if (!rawJson) {
  console.error("❌ slideData를 찾을 수 없습니다. HTML 파일에 'slideData' 변수가 있는지 확인하세요.");
  process.exit(1);
}

// JavaScript 객체 리터럴을 JSON으로 변환
// - 단일따옴표 → 큰따옴표
// - 후행 쉼표 제거
// - 키에 따옴표 추가
let jsonStr = rawJson
  // 주석 제거 (// ...)
  .replace(/\/\/[^\n]*/g, "")
  // 주석 제거 (/* ... */)
  .replace(/\/\*[\s\S]*?\*\//g, "")
  // 단일따옴표 문자열을 큰따옴표로 변환 (이스케이프 주의)
  .replace(/'([^'\\]*(\\.[^'\\]*)*)'/g, (_, inner) => `"${inner.replace(/"/g, '\\"')}"`)
  // 후행 쉼표 제거 (JSON 비허용)
  .replace(/,\s*([}\]])/g, "$1")
  // 키에 따옴표 추가: key: → "key":
  .replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');

let slideData;
try {
  slideData = JSON.parse(jsonStr);
} catch (e) {
  // JSON 파싱 실패 시 eval 방식으로 재시도
  try {
    // Function 생성자를 사용하여 안전하게 평가
    slideData = new Function(`return ${rawJson}`)();
  } catch (e2) {
    console.error("❌ slideData 파싱 실패:", e2.message);
    console.error("raw JSON 일부:", rawJson.slice(0, 200));
    process.exit(1);
  }
}

writeFileSync(outPath, JSON.stringify(slideData, null, 2), "utf-8");

console.log(`✅ slideData 추출 완료`);
console.log(`   슬라이드 수: ${slideData.length}장`);
console.log(`   저장 경로: ${outPath}`);

// 슬라이드 타입 통계
const counts = slideData.reduce((acc, s) => {
  if (s.isTitleSlide) acc.title++;
  else if (s.isDividerSlide) acc.divider++;
  else if (s.isProfileSlide) acc.profile++;
  else if (s.isContactSlide) acc.contact++;
  else acc.normal++;
  return acc;
}, { title: 0, divider: 0, profile: 0, contact: 0, normal: 0 });

console.log(`   타입별: 표지 ${counts.title} | 간지 ${counts.divider} | 강연자소개 ${counts.profile} | 연락처 ${counts.contact} | 일반 ${counts.normal}`);
