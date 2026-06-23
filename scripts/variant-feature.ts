// @version 1.0.0
/**
 * variant-feature.ts
 *
 * Guided CLI for adding a new feature to an existing variant.
 * Generates stubs for agents, skills, scripts, and/or docs, then registers a spec.
 *
 * Usage:
 *   bun scripts/variant-feature.ts --variant co-work --feature slide-export
 *   bun scripts/variant-feature.ts --variant co-deck --feature tts --type agent,skill
 *   bun scripts/variant-feature.ts --variant co-design --feature icon-gen --type all
 *
 * Types: agent | skill | script | docs | all (default: all)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

const WORKSPACE_ROOT = path.resolve(import.meta.dir, '..');
const TODAY = new Date().toISOString().split('T')[0];

function fail(msg: string): never {
  console.error(`${RED}${msg}${RESET}`);
  process.exit(1);
}

function writeStub(filePath: string, content: string): void {
  if (fs.existsSync(filePath)) {
    console.log(`${YELLOW}  Already exists, skipped: ${path.relative(WORKSPACE_ROOT, filePath)}${RESET}`);
    return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`${GREEN}  Created: ${path.relative(WORKSPACE_ROOT, filePath)}${RESET}`);
}

const args = process.argv.slice(2);
function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

const variant = getArg('--variant');
const feature = getArg('--feature');
const typeArg = getArg('--type') ?? 'all';

if (!variant || !feature) {
  fail('Usage: bun scripts/variant-feature.ts --variant <name> --feature <name> [--type agent|skill|script|docs|all]');
}

if (!/^co-[a-z][a-z0-9-]{1,30}$/.test(variant)) fail(`Invalid variant name "${variant}".`);
if (!/^[a-z][a-z0-9-]{0,50}$/.test(feature)) fail(`Invalid feature name "${feature}". Use lowercase kebab-case.`);

const variantDir = path.join(WORKSPACE_ROOT, 'templates', variant);
if (!fs.existsSync(variantDir)) fail(`Variant not found: templates/${variant}/`);

const types = typeArg === 'all' ? ['agent', 'skill', 'script', 'docs'] : typeArg.split(',').map(t => t.trim());
const validTypes = new Set(['agent', 'skill', 'script', 'docs']);
for (const t of types) if (!validTypes.has(t)) fail(`Invalid type "${t}".`);

console.log(`${CYAN}=== variant-feature.ts -- adding "${feature}" to ${variant} ===${RESET}`);
console.log(`Types: ${types.join(', ')}\n`);

const createdFiles: string[] = [];

if (types.includes('agent')) {
  const p = path.join(variantDir, 'agents', `${feature}.md`);
  writeStub(p, `---
name: ${feature}
role: specialist
status: active
tier:
  claude: medium
  gemini: medium
phases: [3, 4]
handoff_to: []
handoff_from: [pm]
required_skills: []
version: "0.1.0"
last_reviewed: "${TODAY}"
description: 'TODO: describe what this agent does'
---

## Role

You are the **${feature}** specialist for the **${variant}** variant.

TODO: Define core responsibilities.

## Responsibilities

- TODO: List primary responsibilities

## Output Format

TODO: Describe expected outputs.

## Constraints

- TODO: List constraints

## Meeting Participation

TODO: Define meeting persona.

## Dispatch Protocol

**Can Lead Phases**: [4]
**Can Support In**: [3]
**Tier**: medium

## Required Tools

| Tool | Purpose |
|------|---------|
| Read, Glob, Grep | Analysis |
| Write, Edit | Authoring |
`);
  createdFiles.push(p);
}

if (types.includes('skill')) {
  const p = path.join(variantDir, 'skills', feature, 'SKILL.md');
  writeStub(p, `---
name: ${feature}
status: active
description: >
  TODO: One-line description of what this skill does.
owner: pm
version: 0.1.0
last_reviewed: ${TODAY}
metadata:
  type: process
  triggers:
    - ${feature}
---

## Overview

TODO: Describe the purpose of this skill.

## When to Use This Skill

TODO: Describe specific use cases and triggers.

## Steps

### Step 1: TODO

TODO: Define steps.

## Expected Outputs

TODO: Describe outputs.
`);
  createdFiles.push(p);
}

if (types.includes('script')) {
  const scriptName = `${variant.replace('co-', '')}-${feature}.ts`;
  const p = path.join(WORKSPACE_ROOT, 'scripts', scriptName);
  writeStub(p, `// @version 0.1.0
/**
 * ${scriptName}
 *
 * TODO: Describe what this script does.
 * Variant: ${variant} | Feature: ${feature}
 *
 * Usage:
 *   bun scripts/${scriptName} [args]
 */

import * as fs from 'node:fs';

const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

// TODO: Implement script logic
console.log(\`\${GREEN}TODO: implement ${feature}\${RESET}\`);
`);
  createdFiles.push(p);
}

if (types.includes('docs')) {
  const docPath = path.join(WORKSPACE_ROOT, 'docs', 'designs', `${TODAY}-${variant}-${feature}-design.md`);
  writeStub(docPath, `# Design: ${feature} for ${variant}

**Date**: ${TODAY}
**Variant**: ${variant}
**Status**: draft

---

## Context

TODO: Why is this feature needed?

## Goals

- TODO: List primary goals

## Architecture

TODO: Describe the high-level architecture.

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | TODO | TODO |
`);
  createdFiles.push(docPath);

  // Register spec
  const specRegister = path.join(WORKSPACE_ROOT, 'scripts', 'spec-register.ts');
  if (fs.existsSync(specRegister)) {
    try {
      execFileSync(process.execPath, [specRegister, '--file', path.relative(WORKSPACE_ROOT, docPath), '--source', 'manual', '--status', 'draft'], {
        cwd: WORKSPACE_ROOT, stdio: 'inherit',
      });
    } catch {
      console.log(`${YELLOW}  spec-register.ts failed -- register manually${RESET}`);
    }
  }
}

console.log(`\n${CYAN}Done: created ${createdFiles.length} stub(s) for "${feature}" in ${variant}.${RESET}`);
console.log(`\nNext: fill in stubs, then run bun scripts/audit.ts`);
