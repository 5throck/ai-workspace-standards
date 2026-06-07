#!/usr/bin/env bun
// ingest-security-frameworks.ts - Phase 4 variant-specific security frameworks ingestion
// @version 1.0.0

import * as fs from 'node:fs';
import * as path from 'node:path';

const CYAN   = '\x1b[36m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN  = '\x1b[32m';
const RESET  = '\x1b[0m';

console.log(`${CYAN}🚀 Ingesting Security Frameworks...${RESET}`);

const workspaceRoot = path.resolve(import.meta.dir, '..');
const templatesDir = path.join(workspaceRoot, 'templates');

if (!fs.existsSync(templatesDir)) {
  console.log(`${RED}templates directory not found.${RESET}`);
  process.exit(1);
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
        const response = await fetch(item.source_url);
        if (!response.ok) {
          console.error(`${RED}Failed to fetch ${item.source_url}: ${response.statusText}${RESET}`);
          continue;
        }
        const content = await response.text();
        const targetPath = path.join(templatesDir, variant, item.ingest_path);
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
