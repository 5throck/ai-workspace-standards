#!/usr/bin/env bun
// scripts/handbook/check-external-links.ts
// L4 — External link validation for handbook HTML files.
// @version 1.2.0
// Extends the internal-only check-links.ts by testing external URLs:
//   1. Extracts all <a href="http..."> links from HTML files
//   2. Performs HTTP HEAD requests with redirect following (max 5 hops)
//   3. Falls back to GET if HEAD returns 403/405/501
//   4. Reports non-2xx final status codes and timeouts
//   5. Skips known-good domains (creativecommons.org, github.com, claude.ai)
//   6. Limits concurrency to 5 simultaneous requests
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
  // TLS-fingerprint (JA3) blocking: sites verified healthy via curl but 403 any Node.js client regardless of headers
  "whatismyipaddress.com",
  "platform.deepseek.com",
]);

// ---------------------------------------------------------------------------
// Issue types
// ---------------------------------------------------------------------------

export interface ExternalLinkIssue {
  file: string;
  url: string;
  status: number | "TIMEOUT" | "ERROR";
  redirectChain?: string; // Optional: show redirect chain when final status fails
}

// ---------------------------------------------------------------------------
// HTTP request helper with redirect following and HEAD→GET fallback
// ---------------------------------------------------------------------------

interface CheckResult {
  status: number;
  redirectChain: string; // Only populated when final result fails
}

const MAX_REDIRECTS = 5;
const RETRYABLE_HEAD_STATUS = new Set([403, 405, 501]);

/**
 * Perform HTTP request with redirect following and HEAD→GET fallback.
 * Follows 3xx redirects (max 5 hops). If HEAD returns 403/405/501, retries with GET.
 * Returns final status after all redirects and fallback attempts.
 */
function checkUrl(urlStr: string): Promise<CheckResult | "TIMEOUT" | "ERROR"> {
  return new Promise((resolve) => {
    let parsed: URL;
    try {
      parsed = new URL(urlStr);
    } catch {
      resolve("ERROR");
      return;
    }

    const transport = parsed.protocol === "https:" ? https : http;
    let redirectCount = 0;
    let redirectChain: string[] = [];
    let currentMethod = "HEAD";

    const performRequest = (urlObj: URL): void => {
      const req = transport.request(
        {
          hostname: urlObj.hostname,
          port: urlObj.port || (urlObj.protocol === "https:" ? 443 : 80),
          path: urlObj.pathname + urlObj.search,
          method: currentMethod,
          timeout: TIMEOUT_MS,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
          },
        },
        (res) => {
          // Consume response data to free the socket
          res.resume();

          const status = res.statusCode ?? 0;

          // Handle redirects (3xx)
          if (status >= 300 && status < 400 && res.headers.location) {
            if (redirectCount >= MAX_REDIRECTS) {
              // Too many redirects - treat as error
              resolve("ERROR");
              return;
            }

            redirectCount++;
            redirectChain.push(`${urlObj.href} → ${status}`);

            let nextUrl: string;
            try {
              nextUrl = new URL(res.headers.location, urlObj.href).href;
            } catch {
              resolve("ERROR");
              return;
            }

            let nextParsed: URL;
            try {
              nextParsed = new URL(nextUrl);
            } catch {
              resolve("ERROR");
              return;
            }

            // Reset to HEAD method for new host
            if (nextParsed.hostname !== urlObj.hostname) {
              currentMethod = "HEAD";
            }

            performRequest(nextParsed);
            return;
          }

          // HEAD→GET fallback for servers that reject HEAD
          if (currentMethod === "HEAD" && RETRYABLE_HEAD_STATUS.has(status)) {
            currentMethod = "GET";
            performRequest(urlObj);
            return;
          }

          // Final result
          resolve({
            status,
            redirectChain: redirectChain.join(" → "),
          });
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
    };

    performRequest(parsed);
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
    const result = await checkUrl(url);
    return { url, result };
  });

  // Build a status map for quick lookup
  const statusMap = new Map<string, CheckResult | "TIMEOUT" | "ERROR">();
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
        all.push({
          file: pair.file,
          url: pair.url,
          status: status.status,
          redirectChain: status.redirectChain || undefined,
        });
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
      const redirectInfo = issue.redirectChain ? ` (${issue.redirectChain})` : "";
      console.error(`  ${issue.file}: ${issue.url} -> ${issue.status}${redirectInfo}`);
    }
    process.exit(1);
  });
}
