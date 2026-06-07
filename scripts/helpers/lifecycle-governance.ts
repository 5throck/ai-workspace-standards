#!/usr/bin/env bun
/**
 * lifecycle-governance.ts — Extract mandatory domains from governance JSON
 * @version 1.0.0
 *
 * Usage:
 *   bun scripts/helpers/lifecycle-governance.ts
 *
 * Outputs comma-separated mandatory domains to stdout
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const governancePath = join(__dirname, '..', '..', 'templates', 'common', 'lifecycle-governance.json');

try {
  const content = readFileSync(governancePath, 'utf-8');
  const data = JSON.parse(content);
  const policy = data.variantValidationPolicy || {};
  const mandatory = policy.mandatoryBeforeProjectCreation || ['variant', 'agent', 'skill'];

  console.log(mandatory.join(','));
} catch (error) {
  // If governance JSON doesn't exist or can't be parsed, use defaults
  console.log('variant,agent,skill');
}

