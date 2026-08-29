// @version 2.0.0
// scripts/handbook/check-search.ts
// Check ④: search-manifest.json must contain all primary HTML files in docs/,
// every manifest entry must point to an existing file, and search-data.js
// must be in sync with the manifest (stale detection).
// Canonical source of the handbook toolkit (adapted from
// Handbooks/multi-agent-harness-handbook/scripts/check-search.ts).
// Skipped when search-manifest.json is absent — handbooks that use
// inpage-search.js have no global DOCS array to validate.

import { findAllHtmlFiles, readFile, parseDocsArray, fileExists, getDocsDir } from "./nav-utils.ts";
import { relative, join } from "node:path";
import { readFileSync } from "node:fs";

export interface SearchIndexError {
  type: "missing-from-manifest" | "missing-file" | "stale-search-data" | "missing-search-data";
  path: string;
  detail: string;
}

interface ManifestPage {
  path: string;
  title: string;
  lang: string;
}

interface Manifest {
  pages: ManifestPage[];
}

function readManifest(docsDir: string): Manifest | null {
  const manifestPath = join(docsDir, "search-manifest.json");
  if (!fileExists(manifestPath)) return null;
  const raw = readFileSync(manifestPath, "utf-8");
  return JSON.parse(raw) as Manifest;
}

export function checkSearchIndex(): SearchIndexError[] {
  const errors: SearchIndexError[] = [];
  const docsDir = getDocsDir();

  const manifest = readManifest(docsDir);
  if (!manifest) return errors; // no manifest — skip

  const actualFiles = new Set(
    findAllHtmlFiles().map((f) => relative(docsDir, f).replace(/\\/g, "/"))
  );

  const manifestPaths = new Set(manifest.pages.map((p) => p.path.replace(/\\/g, "/")));

  // 1. Verify every manifest entry points to an existing file
  for (const entry of manifest.pages) {
    if (!actualFiles.has(entry.path)) {
      errors.push({
        type: "missing-file",
        path: entry.path,
        detail: `Manifest references "${entry.path}" but file does not exist`,
      });
    }
  }

  // 2. Verify no primary HTML files are missing from the manifest
  for (const file of actualFiles) {
    if (file === "index.html") continue;
    if (file.startsWith("assets/")) continue;
    if (file === "search-manifest.json") continue;

    // Allow locale-variant HTML files to exist without being in the manifest
    // (they are reached via the language switcher, not the search index).
    if (/_en\.html$|_ja\.html$|_ko\.html$|_es\.html$/.test(file)) continue;

    if (!manifestPaths.has(file)) {
      errors.push({
        type: "missing-from-manifest",
        path: file,
        detail: `File "${file}" exists but is missing from search-manifest.json`,
      });
    }
  }

  // 3. Verify search-data.js exists and is in sync with manifest
  const searchDataPath = join(docsDir, "assets", "search-data.js");
  if (!fileExists(searchDataPath)) {
    errors.push({
      type: "missing-search-data",
      path: "assets/search-data.js",
      detail: "search-data.js is missing — run 'bun run scripts/build-search-index.ts --docs-dir docs'",
    });
  } else {
    const searchData = readFile(searchDataPath);
    const generatedDocs = parseDocsArray(searchData);
    const generatedPaths = new Set(generatedDocs.map((d) => d.path.replace(/\\/g, "/")));

    // Check for entries in manifest but not in generated data (stale search-data.js)
    for (const entry of manifest.pages) {
      if (!generatedPaths.has(entry.path)) {
        errors.push({
          type: "stale-search-data",
          path: entry.path,
          detail: `"${entry.path}" is in manifest but missing from search-data.js — regenerate with build-search-index.ts`,
        });
      }
    }

    // Check for entries in generated data but not in manifest (orphaned)
    for (const gen of generatedDocs) {
      if (!manifestPaths.has(gen.path)) {
        errors.push({
          type: "stale-search-data",
          path: gen.path,
          detail: `"${gen.path}" is in search-data.js but missing from manifest — regenerate with build-search-index.ts`,
        });
      }
    }
  }

  return errors;
}
