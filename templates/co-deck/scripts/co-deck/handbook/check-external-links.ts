#!/usr/bin/env bun
// scripts/co-deck/handbook/check-external-links.ts
// L4 — External link validation for handbook HTML files.
// Extends the internal-only check-links.ts by testing external URLs:
//   1. Extracts all <a href="http..."> links from HTML files
//   2. Performs HTTP HEAD requests with a 5-second timeout
//   3. Reports non-2xx status codes and timeouts
//   4. Skips known-good domains (creativecommons.org, github.com, claude.ai)
//   5. Limits concurrency to 5 simultaneous requests
//
// Vendored between intro-to-ai-harness and multi-agent-harness-handbook.
// Uses only Node.js built-in http/https modules (no node-fetch).
//
// Usage:
//   bun run scripts/check-external-links.ts --docs-dir docs
// Exit code 0 if no broken links, 1 otherwise.

import { findAllHtmlFiles, readFile, getDocsDir, configureDocsDir } from "./nav-utils.ts";
import { relative } from "node:path";
import http from "node:http";
import https from "node:https";
import { URL } from "node:url";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const TIMEOUT_MS = 5_000;
const MAX_CONCURRENCY = 5;

/** Domains considered known-good and skipped. */
const SKIP_DOMAINS = new Set([
  "creativecommons.org",
  "github.com",
  "claude.ai",
  "anthropic.com",
]);

// ---------------------------------------------------------------------------
// Issue types
// ---------------------------------------------------------------------------

export interface ExternalLinkIssue {
  file: string;
  url: string;
  status: number | "TIMEOUT" | "ERROR";
}

// ---------------------------------------------------------------------------
// HTTP HEAD request helper
// ---------------------------------------------------------------------------

interface HeadResult {
  status: number;
}

/**
 * Perform an HTTP HEAD request with a timeout.
 * Returns the status code, or "TIMEOUT" / "ERROR" on failure.
 */
function headRequest(urlStr: string): Promise<HeadResult | "TIMEOUT" | "ERROR"> {
  return new Promise((resolve) => {
    let parsed: URL;
    try {
      parsed = new URL(urlStr);
    } catch {
      resolve("ERROR");
      return;
    }

    const transport = parsed.protocol === "https:" ? https : http;

    const req = transport.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: "HEAD",
        timeout: TIMEOUT_MS,
        headers: {
          "User-Agent": "handbook-link-checker/1.0",
          "Accept": "*/*",
        },
      },
      (res) => {
        // Consume response data to free the socket
        res.resume();
        resolve({ status: res.statusCode ?? 0 });
      },
    );

    req.on("timeout", () => {
      req.destroy();
      resolve("TIMEOUT");
    });

    req.on("error", () => {
      resolve("ERROR");
    });

    req.end();
  });
}

// ---------------------------------------------------------------------------
// Concurrency-limited map
// ---------------------------------------------------------------------------

/**
 * Like Promise.allSettled but limited to `limit` concurrent promises.
 * Returns results in the same order as the inputs.
 */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// URL extraction
// ---------------------------------------------------------------------------

/** Extract all external http(s) href URLs from an HTML string. */
function extractExternalUrls(html: string): string[] {
  const urls: string[] = [];
  const aRe = /<a\s+(?:[^>]*?\s)?href="(https?:\/\/[^"]*)"[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = aRe.exec(html)) !== null) {
    urls.push(m[1]);
  }
  return urls;
}

/** Check whether a URL's domain should be skipped. */
function shouldSkip(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    return SKIP_DOMAINS.has(parsed.hostname);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export async function checkExternalLinks(): Promise<ExternalLinkIssue[]> {
  const all: ExternalLinkIssue[] = [];
  const htmlFiles = findAllHtmlFiles();
  const docsDir = getDocsDir();

  // Collect (file, url) pairs, deduplicating URLs across files
  const fileUrlPairs: { file: string; url: string }[] = [];
  for (const filePath of htmlFiles) {
    const html = readFile(filePath);
    const relFile = relative(docsDir, filePath).replace(/\\/g, "/");
    const urls = extractExternalUrls(html);
    for (const url of urls) {
      if (!shouldSkip(url)) {
        fileUrlPairs.push({ file: relFile, url });
      }
    }
  }

  // Deduplicate URLs — only check each unique URL once
  const uniqueUrls = [...new Set(fileUrlPairs.map((p) => p.url))];

  console.error(`check-external-links: checking ${uniqueUrls.length} unique external URLs...`);

  // Check URLs with limited concurrency
  const results = await mapLimit(uniqueUrls, MAX_CONCURRENCY, async (url) => {
    const result = await headRequest(url);
    return { url, result };
  });

  // Build a status map for quick lookup
  const statusMap = new Map<string, HeadResult | "TIMEOUT" | "ERROR">();
  for (const { url, result } of results) {
    statusMap.set(url, result);
  }

  // Report issues
  for (const pair of fileUrlPairs) {
    const status = statusMap.get(pair.url);
    if (status === undefined) continue;
    if (typeof status === "object") {
      // Non-2xx status is a broken link
      if (status.status < 200 || status.status >= 300) {
        all.push({ file: pair.file, url: pair.url, status: status.status });
      }
    } else {
      // TIMEOUT or ERROR
      all.push({ file: pair.file, url: pair.url, status });
    }
  }

  return all;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const idx = args.indexOf("--docs-dir");
  if (idx !== -1 && args[idx + 1]) configureDocsDir(args[idx + 1]);

  checkExternalLinks().then((issues) => {
    if (issues.length === 0) {
      console.log("check-external-links: OK -- all external links reachable.");
      process.exit(0);
    }

    console.error(`check-external-links: ${issues.length} broken external link(s):`);
    // Deduplicate per file+url to avoid spamming the same URL from multiple files
    const seen = new Set<string>();
    for (const issue of issues) {
      const key = `${issue.file}:${issue.url}`;
      if (seen.has(key)) continue;
      seen.add(key);
      console.error(`  ${issue.file}: ${issue.url} -> ${issue.status}`);
    }
    process.exit(1);
  });
}
