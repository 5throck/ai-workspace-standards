#!/usr/bin/env bun
// @version 1.0.0
// scripts/handbook/update-footers.ts
// Syncs the localized site footer into every HTML page under docs/.
// Vendored from Handbooks/multi-agent-harness-handbook/scripts/update-footers.ts
// (canonical source: scripts/handbook/).
// WRITE-ONLY maintenance tool — run deliberately, not as part of validation.
//
// Usage:
//   bun run scripts/handbook/update-footers.ts --docs-dir docs

import { writeFileSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { getDocsDir, configureDocsDir } from "./nav-utils.ts";

const FOOTERS: Record<string, string> = {
  ko: `  <footer>
    Claude Code 2026-07 / Antigravity CLI 1.1.0+ / Antigravity 2.0 / ai-workspace-standards main (2026-08-15) 기준 · 한국어 교육 자료<br>
    공식 자료: <a href="https://code.claude.com/docs/en/overview" target="_blank">Claude Code</a> ·
    <a href="https://antigravity.google/docs/home" target="_blank">Antigravity</a> ·
    <a href="https://github.com/5throck/ai-workspace-standards" target="_blank">ai-workspace-standards</a><br>
    본 핸드북의 콘텐츠는 <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/deed.ko" target="_blank" rel="noopener noreferrer">CC BY-NC-SA 4.0 (저작자표시-비영리-동일조건변경허락 4.0 국제)</a> 라이선스에 따라 이용할 수 있습니다.
  </footer>`,
  en: `  <footer>
    Based on Claude Code 2026-07 / Antigravity CLI 1.1.0+ / Antigravity 2.0 / ai-workspace-standards main (2026-08-15) · English Educational Materials<br>
    Official Docs: <a href="https://code.claude.com/docs/en/overview" target="_blank">Claude Code</a> ·
    <a href="https://antigravity.google/docs/home" target="_blank">Antigravity</a> ·
    <a href="https://github.com/5throck/ai-workspace-standards" target="_blank">ai-workspace-standards</a><br>
    Handbook content is licensed under <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-NC-SA 4.0 (Attribution-NonCommercial-ShareAlike 4.0 International)</a>.
  </footer>`,
  es: `  <footer>
    Basado en Claude Code 2026-07 / Antigravity CLI 1.1.0+ / Antigravity 2.0 / ai-workspace-standards main (2026-08-15) · Material educativo en español<br>
    Recursos oficiales: <a href="https://code.claude.com/docs/en/overview" target="_blank">Claude Code</a> ·
    <a href="https://antigravity.google/docs/home" target="_blank">Antigravity</a> ·
    <a href="https://github.com/5throck/ai-workspace-standards" target="_blank">ai-workspace-standards</a><br>
    El contenido de este manual está bajo la licencia <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/deed.es" target="_blank" rel="noopener noreferrer">CC BY-NC-SA 4.0 (Atribución-NoComercial-CompartirIgual 4.0 Internacional)</a>.
  </footer>`,
  ja: `  <footer>
    Claude Code 2026-07 / Antigravity CLI 1.1.0+ / Antigravity 2.0 / ai-workspace-standards main (2026-08-15) 基準 · 日本語教材<br>
    公式リソース: <a href="https://code.claude.com/docs/en/overview" target="_blank">Claude Code</a> ·
    <a href="https://antigravity.google/docs/home" target="_blank">Antigravity</a> ·
    <a href="https://github.com/5throck/ai-workspace-standards" target="_blank">ai-workspace-standards</a><br>
    このハンドブックのコンテンツは <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/deed.ja" target="_blank" rel="noopener noreferrer">CC BY-NC-SA 4.0 (表示 - 非営利 - 継承 4.0 国際)</a> ライセンスの下で提供されています。
  </footer>`,
};

function langForPath(filePath: string): "ko" | "en" | "es" | "ja" {
  if (filePath.endsWith("_en.html")) return "en";
  if (filePath.endsWith("_es.html")) return "es";
  if (filePath.endsWith("_ja.html")) return "ja";
  return "ko";
}

function findAllHtmlFiles(docsDir: string): string[] {
  const results: string[] = [];
  function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".html")) results.push(full);
    }
  }
  walk(docsDir);
  return results;
}

/** Replace each page's footer with the localized canonical footer. */
export function updateFooters(docsDir?: string): { updated: number; total: number } {
  const dir = docsDir ? docsDir : getDocsDir();
  const htmlFiles = findAllHtmlFiles(dir);
  let updatedCount = 0;

  for (const filePath of htmlFiles) {
    const lang = langForPath(filePath);
    let content = readFileSync(filePath, "utf-8");
    const targetFooter = FOOTERS[lang];

    // 1. Remove existing footer tag if present
    const cleanContent = content.replace(/\s*<footer[\s\S]*?<\/footer>/, "");

    // 2. Insert footer in appropriate container location
    let newContent = cleanContent;
    if (cleanContent.includes("</article>")) {
      newContent = cleanContent.replace("</article>", `${targetFooter}\n </article>`);
    } else if (cleanContent.includes('class="wrap"')) {
      const lastDivIndex = cleanContent.lastIndexOf("</div>");
      if (lastDivIndex !== -1) {
        newContent = cleanContent.slice(0, lastDivIndex) + `${targetFooter}\n  </div>` + cleanContent.slice(lastDivIndex + 6);
      } else if (cleanContent.includes("</body>")) {
        newContent = cleanContent.replace("</body>", `${targetFooter}\n</body>`);
      }
    } else if (cleanContent.includes("</body>")) {
      newContent = cleanContent.replace("</body>", `${targetFooter}\n</body>`);
    }

    if (newContent !== content) {
      writeFileSync(filePath, newContent, "utf-8");
      updatedCount++;
    }
  }

  return { updated: updatedCount, total: htmlFiles.length };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const idx = args.indexOf("--docs-dir");
  if (idx !== -1 && args[idx + 1]) configureDocsDir(args[idx + 1]);

  const { updated, total } = updateFooters();
  console.log(`Successfully placed footers in ${updated} / ${total} HTML files.`);
}
