// scripts/co-deck/handbook/check-links.ts
// Check ①: Verify all internal a href targets resolve to existing files.
// Adapted from Handbooks/multi-agent-harness-handbook/scripts/check-links.ts

import { findAllHtmlFiles, readFile, resolveHref, fileExists, getDocsDir } from "./nav-utils.ts";
import { relative } from "node:path";

export interface LinkError {
  file: string;
  href: string;
  resolved: string;
}

export function checkBrokenLinks(): LinkError[] {
  const errors: LinkError[] = [];
  const htmlFiles = findAllHtmlFiles();

  for (const filePath of htmlFiles) {
    const html = readFile(filePath);
    const linkRe = /<a\s+(?:[^>]*?\s)?href="([^"]*)"[^>]*>/g;
    let m: RegExpExecArray | null;

    while ((m = linkRe.exec(html)) !== null) {
      const href = m[1];
      const absPath = resolveHref(filePath, href);
      if (absPath === null) continue; // external, anchor, etc.

      if (!fileExists(absPath)) {
        errors.push({
          file: relative(getDocsDir(), filePath),
          href,
          resolved: relative(getDocsDir(), absPath),
        });
      }
    }
  }

  return errors;
}
