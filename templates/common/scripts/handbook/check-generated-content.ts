#!/usr/bin/env bun
// scripts/handbook/check-generated-content.ts
// L3 — Detects recurring defects from LLM-assisted content generation that
// earlier validators miss.
// @version 1.0.0
//
// Ported from the multi-agent-harness-handbook repo copy (added after a
// 2026-09 review found all four defect classes in published pages).
//
// Checks (per HTML page under docs/):
//   1. duplicated <td>  — a table row whose second cell repeats the first
//                         verbatim (broken "item | intent" generator).
//   2. raw backticks    — `...` spans in visible HTML (outside <pre>/<code>)
//                         that render literally instead of as <code>.
//   3. stray Hanja      — CJK ideographs inside Korean pages (lang "ko*");
//                         other languages (ja, zh, ...) are exempt. The page
//                         language comes from <html lang="...">, falling back
//                         to the `_xx.html` filename suffix, then to "ko"
//                         for suffix-less files (legacy Korean-base layout).
//   4. garbled quiz     — a quiz <ol> where a numbered item follows an
//                         unnumbered one (definition fragments mixed with
//                         numbered checklist leftovers).
//
// Usage:
//   bun run scripts/check-generated-content.ts --docs-dir docs
// Exit code 0 if clean, 1 otherwise.

import { relative } from "node:path";
import { configureDocsDir, findAllHtmlFiles, getDocsDir, readFile } from "./nav-utils.ts";

export interface GeneratedContentIssue {
  file: string;
  line: number;
  kind: "duplicated-td" | "raw-backtick" | "stray-hanja" | "garbled-quiz";
  detail: string;
}

const SEGMENT_SPLIT = /(<pre>[\s\S]*?<\/pre>|<code>[\s\S]*?<\/code>)/g;

function lineOf(text: string, idx: number): number {
  return text.slice(0, idx).split("\n").length;
}

/** Resolve the page language: <html lang>, else `_xx.html` suffix, else "ko". */
export function pageLang(rel: string, html: string): string {
  const attr = /<html\b[^>]*\blang\s*=\s*["']([^"']+)["']/i.exec(html);
  if (attr) return attr[1].toLowerCase();
  const suffix = /_([a-z]{2})\.html$/.exec(rel);
  return suffix ? suffix[1] : "ko";
}

/** Apply `pattern` to the prose segments (outside <pre>/<code>) of `text`. */
function scanProse(text: string, pattern: RegExp, onMatch: (match: RegExpExecArray, absIndex: number) => void): void {
  const parts = text.split(SEGMENT_SPLIT);
  let offset = 0;
  for (let i = 0; i < parts.length; i += 2) {
    const seg = parts[i];
    const re = new RegExp(pattern.source, pattern.flags);
    let m = re.exec(seg);
    while (m !== null) {
      onMatch(m, offset + m.index);
      m = re.exec(seg);
    }
    offset += seg.length + (parts[i + 1]?.length ?? 0);
  }
}

export function checkGeneratedContent(docsDir?: string): GeneratedContentIssue[] {
  const dir = docsDir ?? getDocsDir();
  const issues: GeneratedContentIssue[] = [];
  if (docsDir) configureDocsDir(docsDir);

  for (const file of findAllHtmlFiles()) {
    const rel = relative(dir, file).replace(/\\/g, "/");
    const text = readFile(file);

    // 1. duplicated <td> pairs. Placeholder cells ("—", "⚠️ …", empty) are
    //    legitimate colspan workarounds in matrix tables.
    const tdRe = /<td>([^<]+)<\/td><td>\1<\/td>/g;
    let td = tdRe.exec(text);
    while (td !== null) {
      const cell = td[1].trim();
      if (cell && cell !== "—" && !cell.startsWith("⚠")) {
        issues.push({ file: rel, line: lineOf(text, td.index), kind: "duplicated-td", detail: td[1].slice(0, 60) });
      }
      td = tdRe.exec(text);
    }

    // 2. raw backticks outside <pre> and <code>
    scanProse(text, /`([^`<]+)`/g, (m, abs) => {
      issues.push({ file: rel, line: lineOf(text, abs), kind: "raw-backtick", detail: m[0].slice(0, 60) });
    });

    // 3. stray Hanja in Korean pages only (CJK Unified Ideographs + Ext A)
    if (pageLang(rel, text).startsWith("ko")) {
      scanProse(text, /[一-鿿㐀-䶿]+/g, (m, abs) => {
        issues.push({ file: rel, line: lineOf(text, abs), kind: "stray-hanja", detail: m[0] });
      });
    }

    // 4. garbled quiz: numbered item following an unnumbered item
    const quizRe = /<div class="quiz">[\s\S]*?<\/ol><\/div>/g;
    let quiz = quizRe.exec(text);
    while (quiz !== null) {
      const items: string[] = [];
      const liRe = /<li>([\s\S]*?)<\/li>/g;
      let li = liRe.exec(quiz[0]);
      while (li !== null) {
        items.push(li[1].replace(/<[^>]+>/g, "").trim());
        li = liRe.exec(quiz[0]);
      }
      const numbered = (s: string): boolean => /^\d+[.)]\s/.test(s);
      for (let i = 1; i < items.length; i++) {
        if (!numbered(items[i - 1]) && numbered(items[i])) {
          issues.push({
            file: rel,
            line: lineOf(text, quiz.index),
            kind: "garbled-quiz",
            detail: `numbered item after unnumbered: "${items[i].slice(0, 50)}"`,
          });
          break;
        }
      }
      quiz = quizRe.exec(text);
    }
  }
  return issues;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const idx = args.indexOf("--docs-dir");
  if (idx !== -1 && args[idx + 1]) configureDocsDir(args[idx + 1]);

  const issues = checkGeneratedContent();
  if (issues.length === 0) {
    console.log("check-generated-content: OK — no duplicated cells, raw backticks, stray Hanja, or garbled quizzes.");
  } else {
    console.error(`check-generated-content: ${issues.length} issue(s) found:\n`);
    for (const it of issues) console.error(`  ${it.file}:${it.line} [${it.kind}] ${it.detail}`);
    process.exit(1);
  }
}
