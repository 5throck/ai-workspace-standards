// @version 1.0.0
// Unit tests for patchReadmePagesUrl() in deploy-handbook.ts
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const tmpDir = join(tmpdir(), `deploy-readme-patch-test-${Date.now()}`);
const url = "https://5throck.github.io/test-handbook/";
const title = "Test Handbook";

// We test the function by running it in-process via a helper script
// that re-exports the function (since deploy-handbook.ts has top-level
// side effects). Instead, we extract the core logic into a testable form.

// --- Inline the logic under test (mirrors deploy-handbook.ts exactly) ---

function detectReadmeLang(filename: string): string {
  const match = filename.match(/^README_([a-z]{2}(?:-[A-Z]{2})?)\.md$/);
  return match ? match[1] : "en";
}

function patchReadmePagesUrl(content: string, filename: string, url: string, title: string): { result: string; changed: boolean } {
  const lang = detectReadmeLang(filename);
  const isKo = lang === "ko";

  const sectionHeading = isKo
    ? "## 🌐 교육 프로그램 바로가기 (웹사이트)"
    : "## 🌐 Read the Handbook Live";
  const linkText = isKo
    ? `${title} 교육 사이트 보기`
    : "Online Handbook & Educational Program";
  const newSection = `${sectionHeading}\n👉 **[${linkText}](${url})**`;

  // Case 2/3: 🌐 section already exists
  if (content.includes("## 🌐")) {
    if (content.includes(url)) return { result: content, changed: false };

    const match = content.match(/(## 🌐[^\n]*\n)(\S+)/);
    if (match) {
      content = content.replace(
        /(## 🌐[^\n]*\n)(?:👉 \*\[[^\]]*\]\([^)]+\)\*\*|\[?[^\]]*\]?\([^)]+\))/,
        `$1👉 **[${linkText}](${url})**`,
      );
      return { result: content, changed: true };
    }

    // Fallback: remove old 🌐 section, insert new
    content = content.replace(/## 🌐[^\n]*\n(?:.*\n?)*?(?=\n## )/, "");
    content = content.trimEnd() + "\n\n" + newSection + "\n";
    return { result: content, changed: true };
  }

  // Case 1: No 🌐 section — insert before 🎯 or 📜
  const insertBefore = content.includes("## 🎯")
    ? "## 🎯"
    : content.includes("## 📜")
      ? "## 📜"
      : null;

  if (insertBefore) {
    content = content.replace(insertBefore, `${newSection}\n\n${insertBefore}`);
  } else {
    content = content.trimEnd() + "\n\n" + newSection + "\n";
  }

  return { result: content, changed: true };
}

// --- Test fixtures ---

const EN_README_NO_GLOBE = `# Test Handbook

Language: **English** | [한국어](README_ko.md)

Welcome to the **Test Handbook**, an AI Workspace educational program.

## 📚 Curriculum / Contents
  - **Chapter 1**

## 🎯 Target Versions
- Claude Code 2026-07

## 📜 License
- **Handbook content**: [CC BY-NC-SA 4.0](LICENSE)
`;

const KO_README_NO_GLOBE = `# 테스트 핸드북

Language: [English](README.md) | **한국어**

테스트 핸드북에 오신 것을 환영합니다.

## 📚 커리큘럼 구성
  - **1장**

## 🎯 대상 버전
- Claude Code 2026-07

## 📄 라이센스
- **핸드북 콘텐츠**: [CC BY-NC-SA 4.0](LICENSE)
`;

const EN_README_WITH_GLOBE = `# Test Handbook

Language: **English** | [한국어](README_ko.md)

Welcome to the **Test Handbook**, an AI Workspace educational program.

## 🌐 Read the Handbook Live
👉 **[Online Handbook](https://old-url.github.io/old/)**

## 📚 Curriculum / Contents
  - **Chapter 1**

## 🎯 Target Versions
- Claude Code 2026-07

## 📜 License
- **Handbook content**: [CC BY-NC-SA 4.0](LICENSE)
`;

const EN_README_SAME_URL = `# Test Handbook

Language: **English** | [한국어](README_ko.md)

Welcome to the **Test Handbook**, an AI Workspace educational program.

## 🌐 Read the Handbook Live
👉 **[Online Handbook & Educational Program](https://5throck.github.io/test-handbook/)**

## 📚 Curriculum / Contents
  - **Chapter 1**

## 🎯 Target Versions
- Claude Code 2026-07

## 📜 License
- **Handbook content**: [CC BY-NC-SA 4.0](LICENSE)
`;

// --- Tests ---

describe("patchReadmePagesUrl", () => {
  test("EN: inserts 🌐 section before 🎯 when missing", () => {
    const { result, changed } = patchReadmePagesUrl(EN_README_NO_GLOBE, "README.md", url, title);
    expect(changed).toBe(true);
    expect(result).toContain("## 🌐 Read the Handbook Live");
    expect(result).toContain(`[Online Handbook & Educational Program](${url})`);
    expect(result).toContain("## 🎯 Target Versions");
    // 🌐 should appear before 🎯
    const globeIdx = result.indexOf("## 🌐");
    const targetIdx = result.indexOf("## 🎯");
    expect(globeIdx).toBeLessThan(targetIdx);
  });

  test("KO: inserts 🌐 section before 🎯 when missing", () => {
    const { result, changed } = patchReadmePagesUrl(KO_README_NO_GLOBE, "README_ko.md", url, title);
    expect(changed).toBe(true);
    expect(result).toContain("## 🌐 교육 프로그램 바로가기 (웹사이트)");
    expect(result).toContain(`[${title} 교육 사이트 보기](${url})`);
    expect(result).toContain("## 🎯 대상 버전");
    // 🌐 should appear before 🎯
    const globeIdx = result.indexOf("## 🌐");
    const targetIdx = result.indexOf("## 🎯");
    expect(globeIdx).toBeLessThan(targetIdx);
  });

  test("EN: replaces URL in existing 🌐 section", () => {
    const { result, changed } = patchReadmePagesUrl(EN_README_WITH_GLOBE, "README.md", url, title);
    expect(changed).toBe(true);
    expect(result).toContain(url);
    expect(result).not.toContain("https://old-url.github.io/old/");
    expect(result).toContain("## 🌐 Read the Handbook Live");
    expect(result).toContain(`[Online Handbook & Educational Program](${url})`);
  });

  test("EN: no-op when URL already matches", () => {
    const { result, changed } = patchReadmePagesUrl(EN_README_SAME_URL, "README.md", url, title);
    expect(changed).toBe(false);
    expect(result).toBe(EN_README_SAME_URL);
  });

  test("falls back to 📜 when 🎯 is absent", () => {
    const noTarget = `# Test

## 📚 Contents
- Chapter 1

## 📜 License
- CC BY-NC-SA
`;
    const { result, changed } = patchReadmePagesUrl(noTarget, "README.md", url, title);
    expect(changed).toBe(true);
    expect(result).toContain("## 🌐 Read the Handbook Live");
    expect(result).toContain(`[Online Handbook & Educational Program](${url})`);
    // 🌐 should appear before 📜
    const globeIdx = result.indexOf("## 🌐");
    const licenseIdx = result.indexOf("## 📜");
    expect(globeIdx).toBeLessThan(licenseIdx);
  });

  test("appends at end when neither 🎯 nor 📜 exists", () => {
    const minimal = `# Test\n\nSome content\n`;
    const { result, changed } = patchReadmePagesUrl(minimal, "README.md", url, title);
    expect(changed).toBe(true);
    expect(result).toContain("## 🌐 Read the Handbook Live");
    expect(result).toContain(url);
  });

  test("handles ja locale as non-KO (English format)", () => {
    const { result, changed } = patchReadmePagesUrl(EN_README_NO_GLOBE, "README_ja.md", url, title);
    expect(changed).toBe(true);
    expect(result).toContain("## 🌐 Read the Handbook Live");
    expect(result).not.toContain("교육 프로그램");
  });

  test("detectReadmeLang parses locale codes correctly", () => {
    expect(detectReadmeLang("README.md")).toBe("en");
    expect(detectReadmeLang("README_ko.md")).toBe("ko");
    expect(detectReadmeLang("README_ja.md")).toBe("ja");
    expect(detectReadmeLang("README_es.md")).toBe("es");
    expect(detectReadmeLang("README_zh-CN.md")).toBe("zh-CN");
  });
});
