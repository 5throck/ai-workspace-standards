// scripts/co-deck/handbook/check-symmetry.ts
// Check ②: If A's chapter-nav next → B, then B's chapter-nav prev → A.
// Adapted from Handbooks/multi-agent-harness-handbook/scripts/check-symmetry.ts

import { findAllHtmlFiles, readFile, extractChapterNav, resolveHref, getDocsDir } from "./nav-utils.ts";
import { relative } from "node:path";

export interface SymmetryError {
  type: "missing-back-link" | "mismatch" | "orphan-prev" | "orphan-next";
  fileA: string;
  fileB: string;
  detail: string;
}

export function checkSymmetry(): SymmetryError[] {
  const errors: SymmetryError[] = [];
  const htmlFiles = findAllHtmlFiles();
  const docsDir = getDocsDir();

  const navMap = new Map<string, ReturnType<typeof extractChapterNav>>();
  for (const filePath of htmlFiles) {
    const html = readFile(filePath);
    navMap.set(filePath, extractChapterNav(html));
  }

  const hubFiles = new Set<string>();
  for (const [filePath, nav] of navMap) {
    if (!nav.next && nav.others.length > 0 && nav.prev) {
      hubFiles.add(filePath);
    }
  }

  const noNavFiles = new Set<string>();
  for (const [filePath, nav] of navMap) {
    if (!nav.prev && !nav.next && nav.others.length === 0) {
      noNavFiles.add(filePath);
    }
  }

  const branchFiles = new Set<string>();
  for (const [filePath, nav] of navMap) {
    if (nav.others.length > 0) {
      branchFiles.add(filePath);
    }
  }

  for (const [filePath, nav] of navMap) {
    const relFile = relative(docsDir, filePath);

    if (nav.next) {
      const nextAbs = resolveHref(filePath, nav.next.href);
      if (nextAbs) {
        const targetNav = navMap.get(nextAbs);
        if (!targetNav) {
          errors.push({
            type: "missing-back-link",
            fileA: relFile,
            fileB: nav.next.href,
            detail: `next → ${nav.next.href} but target file not found in docs/`,
          });
        } else if (!targetNav.prev) {
          if (!noNavFiles.has(nextAbs)) {
            errors.push({
              type: "missing-back-link",
              fileA: relFile,
              fileB: relative(docsDir, nextAbs),
              detail: `next → ${relative(docsDir, nextAbs)} but target has no prev link`,
            });
          }
        } else {
          if (hubFiles.has(nextAbs) || branchFiles.has(filePath) || branchFiles.has(nextAbs)) {
            // Acceptable: branching navigation
          } else {
            const prevAbs = resolveHref(nextAbs, targetNav.prev.href);
            if (prevAbs !== filePath) {
              errors.push({
                type: "mismatch",
                fileA: relFile,
                fileB: relative(docsDir, nextAbs),
                detail: `next → ${relative(docsDir, nextAbs)} but that file's prev → ${targetNav.prev.href} (not back to ${relFile})`,
              });
            }
          }
        }
      }
    }

    if (nav.prev) {
      const prevAbs = resolveHref(filePath, nav.prev.href);
      if (prevAbs) {
        const targetNav = navMap.get(prevAbs);
        if (!targetNav) {
          errors.push({
            type: "missing-back-link",
            fileA: relFile,
            fileB: nav.prev.href,
            detail: `prev → ${nav.prev.href} but target file not found in docs/`,
          });
        } else if (!targetNav.next) {
          if (!hubFiles.has(prevAbs) && !noNavFiles.has(prevAbs)) {
            const targetRel = relative(docsDir, prevAbs);
            errors.push({
              type: "orphan-next",
              fileA: relFile,
              fileB: targetRel,
              detail: `prev → ${targetRel} but that file has no next link`,
            });
          }
        } else {
          if (branchFiles.has(filePath) || branchFiles.has(prevAbs)) {
            // Acceptable
          } else {
            const nextAbs = resolveHref(prevAbs, targetNav.next.href);
            if (nextAbs !== filePath) {
              errors.push({
                type: "mismatch",
                fileA: relFile,
                fileB: relative(docsDir, prevAbs),
                detail: `prev → ${relative(docsDir, prevAbs)} but that file's next → ${targetNav.next.href} (not back to ${relFile})`,
              });
            }
          }
        }
      }
    }
  }

  return errors;
}
