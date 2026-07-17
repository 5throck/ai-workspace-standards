// scripts/co-deck/handbook/check-search.ts
// Check ④: site-search.js DOCS array must contain all HTML files in docs/,
// and every DOCS entry must point to an existing file.
// Adapted from Handbooks/multi-agent-harness-handbook/scripts/check-search.ts

import { findAllHtmlFiles, readFile, parseDocsArray, fileExists, getDocsDir } from "./nav-utils.ts";
import { relative, join } from "node:path";

export interface SearchIndexError {
  type: "missing-from-docs" | "missing-file" | "extra-in-docs";
  path: string;
  detail: string;
}

export function checkSearchIndex(): SearchIndexError[] {
  const errors: SearchIndexError[] = [];
  const docsDir = getDocsDir();

  const searchJsPath = join(docsDir, "assets", "site-search.js");
  const searchJs = readFile(searchJsPath);
  const docsEntries = parseDocsArray(searchJs);

  const actualFiles = new Set(
    findAllHtmlFiles().map((f) => relative(docsDir, f).replace(/\\/g, "/"))
  );

  const docsPaths = new Set(docsEntries.map((d) => d.path.replace(/\\/g, "/")));

  for (const entry of docsEntries) {
    if (!actualFiles.has(entry.path)) {
      errors.push({
        type: "missing-file",
        path: entry.path,
        detail: `DOCS array references "${entry.path}" but file does not exist`,
      });
    }
  }

  for (const file of actualFiles) {
    if (file === "index.html") continue;
    if (file.startsWith("assets/")) continue;

    if (!docsPaths.has(file)) {
      errors.push({
        type: "missing-from-docs",
        path: file,
        detail: `File "${file}" exists but is missing from DOCS array in site-search.js`,
      });
    }
  }

  return errors;
}
