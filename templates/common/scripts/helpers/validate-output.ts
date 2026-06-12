#!/usr/bin/env bun
/**
 * validate-output.ts — Parse validate-templates.ts JSON output and filter mandatory domain errors
 * @version 1.0.0
 *
 * Usage:
 *   bun scripts/helpers/validate-output.ts <mandatory-domains-comma-separated> <json-string>
 *
 * Exits with:
 *   0 if no mandatory domain errors
 *   1 if mandatory domain errors found (prints each error to stderr)
 */

const args = process.argv.slice(2);
const mandatoryStr = args[0];
const jsonStr = args.slice(1).join(' '); // Rejoin remaining args in case JSON has spaces

if (!mandatoryStr || !jsonStr) {
  console.error('Usage: bun validate-output.ts <comma-separated-domains> <json-string>');
  process.exit(1);
}

const mandatoryDomains = mandatoryStr.split(',');

try {
  const output = JSON.parse(jsonStr);
  const errors = output.errors || [];

  // Filter errors for mandatory domains only
  const mandatoryErrors = errors.filter((err: any) => {
    const check = err.check || '';
    return mandatoryDomains.some((domain: string) => check.includes(domain));
  });

  if (mandatoryErrors.length > 0) {
    for (const err of mandatoryErrors) {
      console.error(`  ❌ ${err.message || err.check || 'unknown error'}`);
    }
    process.exit(1);
  }

  process.exit(0);
} catch (error) {
  // If parsing fails, don't block project creation
  console.warn(`WARN: Could not parse validation output: ${error}`);
  process.exit(0);
}
