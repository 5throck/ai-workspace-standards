// @version 1.0.0
/**
 * extract-copycode.ts
 *
 * Automation script to extract inline copyCode() function from HTML files
 * and replace with a shared <script src="..."> reference.
 *
 * Usage: bun scripts/extract-copycode.ts <docs-root>
 *
 * The script:
 * 1. Finds all HTML files containing the inline copyCode function
 * 2. Removes the inline <script>...</script> block
 * 3. Inserts <script src="../assets/copy-code.js"></script> in its place
 *    (or assets/copy-code.js for files directly in docs/)
 */

import { readdir, stat, readFile, writeFile } from "node:fs/promises";
import { join, relative, dirname, posix } from "node:path";

const INLINE_SCRIPT_PATTERN =
  /<script>\s*function copyCode\(btn\) \{[\s\S]*?\}\s*<\/script>/;

async function walkDir(dir: string, ext: string): Promise<string[]> {
  const results: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    const st = await stat(full);
    if (st.isDirectory()) {
      results.push(...(await walkDir(full, ext)));
    } else if (entry.name.endsWith(ext)) {
      results.push(full);
    }
  }
  return results;
}

async function main() {
  const docsRoot = process.argv[2];
  if (!docsRoot) {
    console.error("Usage: bun scripts/extract-copycode.ts <docs-root>");
    process.exit(1);
  }

  const htmlFiles = await walkDir(docsRoot, ".html");
  let modified = 0;
  let skipped = 0;

  for (const file of htmlFiles) {
    const content = await readFile(file, "utf-8");

    if (!content.includes("function copyCode(btn)")) {
      continue;
    }

    if (!INLINE_SCRIPT_PATTERN.test(content)) {
      console.warn(`  SKIP (no match): ${relative(docsRoot, file)}`);
      skipped++;
      continue;
    }

    // Determine relative path to assets/copy-code.js
    const relFromDocs = relative(docsRoot, file);
    const dirPath = dirname(relFromDocs);
    // If the file is directly in docsRoot (dirPath === "."), use "assets/"
    // Otherwise use "../assets/" (one level up from subdirectory)
    const assetRel =
      dirPath === "."
        ? "assets/copy-code.js"
        : posix.join(...dirPath.split(/[\\/]/).map(() => ".."), "assets", "copy-code.js");

    const replacement = `<script src="${assetRel}"></script>`;
    const newContent = content.replace(INLINE_SCRIPT_PATTERN, replacement);

    if (newContent === content) {
      console.warn(`  SKIP (no change): ${relative(docsRoot, file)}`);
      skipped++;
      continue;
    }

    await writeFile(file, newContent, "utf-8");
    modified++;
    console.log(`  OK: ${relative(docsRoot, file)} -> ${assetRel}`);
  }

  console.log(`\nDone: ${modified} modified, ${skipped} skipped.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
