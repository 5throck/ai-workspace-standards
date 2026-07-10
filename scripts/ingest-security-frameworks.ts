#!/usr/bin/env bun
// ingest-security-frameworks.ts - Phase 4 variant-specific security frameworks ingestion
// @version 1.0.1

import * as fs from 'node:fs';
import * as path from 'node:path';
import { validateUrl } from './lib/ssrf.ts';

const CYAN   = '\x1b[36m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN  = '\x1b[32m';
const RESET  = '\x1b[0m';

console.log(`${CYAN}🚀 Ingesting Security Frameworks...${RESET}`);

const workspaceRoot = path.resolve(import.meta.dir, '..');
const templatesDir = path.resolve(path.join(workspaceRoot, 'templates'));

function safeResolvePath(base: string, variant: string, ingestPath: string): string {
  const resolved = path.resolve(path.join(base, variant, ingestPath));
  if (!resolved.startsWith(templatesDir + path.sep) && resolved !== templatesDir) {
    throw new Error(`Path traversal blocked: "${ingestPath}" resolves outside templates/`);
  }
  return resolved;
}

if (!fs.existsSync(templatesDir)) {
  console.log(`${RED}templates directory not found.${RESET}`);
  if (import.meta.main) {
    process.exit(1);
  }
}

const variants = fs.readdirSync(templatesDir).filter(dir => dir.startsWith('co-'));

async function ingest() {
  for (const variant of variants) {
    const variantJsonPath = path.join(templatesDir, variant, 'variant.json');
    if (!fs.existsSync(variantJsonPath)) continue;

    const variantJson = JSON.parse(fs.readFileSync(variantJsonPath, 'utf-8'));
    const externalSecurity = variantJson.security_manifest?.external || [];

    for (const item of externalSecurity) {
      console.log(`Ingesting ${item.name} for ${variant}...`);
      try {
        const ssrfCheck = await validateUrl(item.source_url);
        if (!ssrfCheck.allowed) {
          console.error(`${YELLOW}SSRF check blocked ${item.name}: ${ssrfCheck.reason}${RESET}`);
          continue;
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        let response: Response;
        try {
          response = await fetch(item.source_url, { signal: controller.signal, redirect: 'error' });
          clearTimeout(timeout);
        } catch (err) {
          clearTimeout(timeout);
          if (err instanceof DOMException && err.name === 'AbortError') {
            console.error(`${RED}Timeout fetching ${item.name} (30s)${RESET}`);
            continue;
          }
          throw err;
        }
        if (!response.ok) {
          console.error(`${RED}Failed to fetch ${item.source_url}: ${response.statusText}${RESET}`);
          continue;
        }
        const contentLength = Number(response.headers.get('content-length'));
        if (contentLength > 10 * 1024 * 1024) {
          console.error(`${RED}Rejected ${item.name}: content-length ${contentLength} exceeds 10MB limit${RESET}`);
          continue;
        }
        const content = await response.text();
        let targetPath: string;
        try {
          targetPath = safeResolvePath(templatesDir, variant, item.ingest_path);
        } catch (e) {
          console.error(`${RED}${e}${RESET}`);
          continue;
        }
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.writeFileSync(targetPath, content, 'utf-8');
        console.log(`${GREEN}Successfully ingested ${item.name} -> ${item.ingest_path}${RESET}`);
      } catch (e) {
        console.error(`${RED}Error ingesting ${item.name}: ${e}${RESET}`);
      }
    }
  }
}

ingest().then(() => {
  console.log(`${GREEN}Security Ingestion complete.${RESET}`);
});
