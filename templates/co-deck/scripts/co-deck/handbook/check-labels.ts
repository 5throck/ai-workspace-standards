// scripts/co-deck/handbook/check-labels.ts
// Check ③: chapter-nav link labels should match the target file's title or h1.
// Adapted from Handbooks/multi-agent-harness-handbook/scripts/check-labels.ts

import { findAllHtmlFiles, readFile, extractChapterNav, resolveHref, extractTitle, extractH1, getDocsDir } from "./nav-utils.ts";
import { relative } from "node:path";

export interface LabelError {
  file: string;
  linkType: "prev" | "next" | "other";
  href: string;
  label: string;
  targetTitle: string;
  targetH1: string;
}

/** Extract chapter number from a label (e.g. "3장", "Ch.3", "Chapter 8", "12章"). */
function extractChapterNum(s: string): string | null {
  const m = s.match(/(\d+)\s*(장|Ch\.?|Chapter|章)/i);
  return m ? m[1] : null;
}

export function checkLabels(): LabelError[] {
  const errors: LabelError[] = [];
  const htmlFiles = findAllHtmlFiles();
  const docsDir = getDocsDir();

  const fileMeta = new Map<string, { title: string; h1: string }>();
  for (const filePath of htmlFiles) {
    const html = readFile(filePath);
    fileMeta.set(filePath, { title: extractTitle(html), h1: extractH1(html) });
  }

  for (const filePath of htmlFiles) {
    const html = readFile(filePath);
    const nav = extractChapterNav(html);
    const relFile = relative(docsDir, filePath);

    const links: { type: "prev" | "next" | "other"; entry: { href: string; label: string } }[] = [];
    if (nav.prev) links.push({ type: "prev", entry: nav.prev });
    if (nav.next) links.push({ type: "next", entry: nav.next });
    for (const o of nav.others) links.push({ type: "other", entry: o });

    for (const { type, entry } of links) {
      const absTarget = resolveHref(filePath, entry.href);
      if (!absTarget) continue;
      const meta = fileMeta.get(absTarget);
      if (!meta) continue;

      const labelNum = extractChapterNum(entry.label);
      const titleNum = extractChapterNum(meta.title);

      if (labelNum && titleNum && labelNum !== titleNum) {
        errors.push({
          file: relFile,
          linkType: type,
          href: entry.href,
          label: entry.label,
          targetTitle: meta.title,
          targetH1: meta.h1,
        });
      }
    }
  }

  return errors;
}
