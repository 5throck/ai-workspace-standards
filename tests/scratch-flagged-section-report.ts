// Scratch: dump each REVIEW/REMOVE-flagged variant-context section next to its matched
// common-template section, for ADR-0050 Part 3 triage. Read-only.
// Usage: bun tests/scratch-flagged-section-report.ts [--min-overlap 0.5] [project ...]
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  splitIntoSections,
  splitContextFileSections,
  splitOffVersionFooter,
  stripVersionFooter,
  classifyCommonizationSection,
  W2_REMOVE_THRESHOLD,
  W2_REVIEW_FLOOR,
  normalizeHeading,
} from '../scripts/helpers/context-sections.ts';

const args = process.argv.slice(2);
let minOverlap = 0;
const minIdx = args.indexOf('--min-overlap');
if (minIdx !== -1) {
  minOverlap = parseFloat(args[minIdx + 1]);
  args.splice(minIdx, 2);
}
const projectsRoot = 'Projects';
const projects = args.length > 0 ? args : readdirSync(projectsRoot).filter((d) => existsSync(join(projectsRoot, d, '.git')));

const commonContextSrc = 'templates/common/docs/context.md';
const commonSections = splitIntoSections(stripVersionFooter(readFileSync(commonContextSrc, 'utf8')));
const commonByHeading = new Map(commonSections.map((s) => [normalizeHeading(s.heading), s]));

for (const project of projects) {
  const variantContextPath = join(projectsRoot, project, 'docs', `${project}.context.md`);
  if (!existsSync(variantContextPath)) continue;
  const originalContent = readFileSync(variantContextPath, 'utf8');
  const { body: originalBody } = splitOffVersionFooter(originalContent);
  const sections = splitContextFileSections(originalBody, { includeVariantInject: true });
  let printedHeader = false;
  for (const { section, headingInManagedZone } of sections) {
    if (headingInManagedZone) continue;
    const verdict = classifyCommonizationSection(section, commonSections, {
      removeThreshold: W2_REMOVE_THRESHOLD,
      reviewFloor: W2_REVIEW_FLOOR,
    });
    if (verdict.verdict === 'keep') continue;
    if (verdict.maxSimilarity < minOverlap) continue;
    if (!printedHeader) {
      console.log(`\n########## ${project} ##########`);
      printedHeader = true;
    }
    console.log(`\n>>> ${section.heading} — ${verdict.verdict.toUpperCase()} overlap ${verdict.maxSimilarity.toFixed(2)} vs common "## ${verdict.matchedCommonHeading ?? '?'}"`);
    console.log(`--- variant body (${section.body.trim().split('\n').length} lines) first 14 lines:`);
    console.log(section.body.trim().split('\n').slice(0, 14).map((l) => '  | ' + l).join('\n'));
    const matched = verdict.matchedCommonHeading ? commonByHeading.get(normalizeHeading(verdict.matchedCommonHeading)) : undefined;
    if (matched) {
      console.log(`--- common "## ${matched.heading}" (${matched.body.trim().split('\n').length} lines) first 10 lines:`);
      console.log(matched.body.trim().split('\n').slice(0, 10).map((l) => '  | ' + l).join('\n'));
    }
  }
}
