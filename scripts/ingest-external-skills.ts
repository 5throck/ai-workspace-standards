#!/usr/bin/env bun
// ingest-external-skills.ts - Phase 4 variant-specific external skills ingestion
// @version 1.0.0

import * as fs from 'node:fs';
import * as path from 'node:path';

const CYAN   = '\x1b[36m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN  = '\x1b[32m';
const RESET  = '\x1b[0m';

console.log(`${CYAN}🚀 Ingesting External Skills & Scripts...${RESET}`);

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
    const externalSkills = variantJson.skill_manifest?.external || [];
    const externalScripts = variantJson.script_manifest?.external || [];

    for (const skill of externalSkills) {
      console.log(`Ingesting ${skill.name} for ${variant}...`);
      try {
        const response = await fetch(skill.source_url);
        if (!response.ok) {
          console.error(`${RED}Failed to fetch ${skill.source_url}: ${response.statusText}${RESET}`);
          continue;
        }
        const content = await response.text();
        const targetPath = path.join(templatesDir, variant, skill.ingest_path);
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.writeFileSync(targetPath, content, 'utf-8');
        console.log(`${GREEN}Successfully ingested ${skill.name} -> ${skill.ingest_path}${RESET}`);
      } catch (e) {
        console.error(`${RED}Error ingesting ${skill.name}: ${e}${RESET}`);
      }
    }

    for (const script of externalScripts) {
      console.log(`Ingesting script ${script.name} for ${variant}...`);
      try {
        const response = await fetch(script.source_url);
        if (!response.ok) {
          console.error(`${RED}Failed to fetch ${script.source_url}: ${response.statusText}${RESET}`);
          continue;
        }
        const content = await response.text();
        const targetPath = path.join(templatesDir, variant, script.ingest_path);
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.writeFileSync(targetPath, content, 'utf-8');
        console.log(`${GREEN}Successfully ingested ${script.name} -> ${script.ingest_path}${RESET}`);
      } catch (e) {
        console.error(`${RED}Error ingesting ${script.name}: ${e}${RESET}`);
      }
    }
  }
}

ingest().then(() => {
  console.log(`${GREEN}Ingestion complete.${RESET}`);
});
