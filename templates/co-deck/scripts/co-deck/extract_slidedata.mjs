/**
 * extract_slidedata.mjs  v1.3.0 — try-every-declaration extraction (first strict-JSON-parseable slideData wins; doc-comment placeholders skipped, U-20261029-002). Prior: v1.2.0
 * HTML 슬라이드 파일에서 slideData 배열을 추출하여 slidedata.json으로 저장.
 *
 * 사용법:
 *   bun scripts/co-deck/extract_slidedata.mjs <html_file> [output_json]
 *
 * 예시:
 *   bun scripts/co-deck/extract_slidedata.mjs presentations/my-deck/lecture_v1.html slidedata.json
 *
 * 변경 이력:
 *   v1.1.0 — 비-탐욕 regex 1차 추출 제거; 괄호 깊이 상태머신을 1차 추출기로 승격 (A-01).
 *            transform의 // 주석 제거를 문자열 외부 전용으로 강화 (A-01).
 *            dynamic-eval fallback 제거 — 보안 정책 준수; 상태머신으로 불필요 (A-02).
 *   v1.2.0 — JS→JSON transform 제거; html-build strict-JSON 계약(Stage C) 적용 후 단순화 (A-04).
 */

// @version 1.3.0
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname, join } from "path";

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

/**
 * Bracket-depth-counting extractor (string/comment-aware state machine).
 * Finds the first top-level `[...]` at or after `startPos` and returns it.
 *
 * Correctly skips `[` and `]` inside:
 *   - double-quoted strings  "..."
 *   - single-quoted strings  '...'
 *   - template literals      `...`
 *   - line comments          // ...\n
 *   - block comments         /* ... *\/
 *
 * Returns null if no balanced array is found.
 */
function extractBalancedArray(src, startPos) {
  const openBracket = src.indexOf("[", startPos);
  if (openBracket === -1) return null;

  let depth = 0;
  let i = openBracket;
  const len = src.length;

  while (i < len) {
    const ch = src[i];

    // Line comment — skip to end of line
    if (ch === "/" && src[i + 1] === "/") {
      i += 2;
      while (i < len && src[i] !== "\n") i++;
      continue;
    }

    // Block comment — skip to */
    if (ch === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < len - 1 && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }

    // String literals — skip entire string, handling backslash escapes
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      i++;
      while (i < len) {
        if (src[i] === "\\") { i += 2; continue; }
        if (src[i] === quote) { i++; break; }
        i++;
      }
      continue;
    }

    // Track bracket depth
    if (ch === "[") {
      depth++;
    } else if (ch === "]") {
      depth--;
      if (depth === 0) {
        return src.slice(openBracket, i + 1);
      }
    }

    i++;
  }

  return null; // unbalanced — no complete array found
}

// Primary extraction: try EVERY `slideData` declaration and take the first
// whose bracketed content parses as strict JSON — built decks carry the
// html-build usage doc-comment ("const slideData = [...];") before the real
// runtime array, and its `[...]` placeholder is not valid JSON
// (U-20261029-002, v1.3.0).
const declRe = /(?:const|let|var)\s+slideData\s*=\s*/g;
const candidates = [];
let rawJson = null;
let slideData = null;
for (const m of html.matchAll(declRe)) {
  const candidate = extractBalancedArray(html, m.index + m[0].length);
  if (candidate) {
    candidates.push(candidate);
    try {
      slideData = JSON.parse(candidate);
      rawJson = candidate;
      break;
    } catch {
      // doc-comment placeholder or non-strict assignment — try the next match
    }
  }
}

// Secondary extraction: find `slideData` keyword anywhere and scan forward for `[`
if (!rawJson) {
  const kwIdx = html.indexOf("slideData");
  if (kwIdx !== -1) {
    const candidate = extractBalancedArray(html, kwIdx);
    if (candidate) {
      candidates.push(candidate);
      try {
        slideData = JSON.parse(candidate);
        rawJson = candidate;
      } catch {
        // fall through to the error below with the last candidate as context
      }
    }
  }
}

if (!slideData) {
  if (candidates.length > 0) {
    // Declarations existed but none parsed — the old strict-JSON failure, with context
    const last = candidates[candidates.length - 1];
    console.error("❌ slideData JSON.parse 실패: 후보 " + candidates.length + "개 모두 strict JSON이 아닙니다 (doc-comment 예제 포함).");
    console.error("   힌트: html-build가 strict JSON을 출력하는지 확인하세요 (모든 키/값 큰따옴표, 후행 쉼표 없음, 주석 없음).");
    console.error("raw JSON 일부:", last.slice(0, 200));
  } else {
    console.error("❌ slideData를 찾을 수 없습니다. HTML 파일에 'slideData' 변수가 있는지 확인하세요.");
  }
  process.exit(1);
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
