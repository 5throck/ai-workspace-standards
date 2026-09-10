// Scratch read-only re-measurement of the upgrade-project v1.20.0 CONTEXT_COMMONIZATION
// pass across all Projects/* repos. Replicates the pass logic in upgrade-project.ts
// (dry-run semantics: verdicts printed, nothing written).
// Usage: bun tests/scratch-commonization-remeasure.ts [project-name ...]
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  splitIntoSections,
  splitContextFileSections,
  splitOffVersionFooter,
  stripVersionFooter,
  classifyCommonizationSection,
  W2_REMOVE_THRESHOLD,
  W2_REVIEW_FLOOR,
} from '../scripts/helpers/context-sections.ts';

const args = process.argv.slice(2);
const projectsRoot = 'Projects';
const projects = args.length > 0
  ? args
  : require('node:fs').readdirSync(projectsRoot)
      .filter((d) => existsSync(join(projectsRoot, d, '.git')));

const commonContextSrc = 'templates/common/docs/context.md';
const commonSections = splitIntoSections(stripVersionFooter(readFileSync(commonContextSrc, 'utf8')));

let fleetReview = 0;
let fleetRemove = 0;

for (const project of projects) {
  const variantContextPath = join(projectsRoot, project, 'docs', `${project}.context.md`);
  if (!existsSync(variantContextPath)) {
    console.log(`[${project}] SKIP (no variant context file)`);
    continue;
  }
  const originalContent = readFileSync(variantContextPath, 'utf8');
  const { body: originalBody } = splitOffVersionFooter(originalContent);
  const sections = splitContextFileSections(originalBody, { includeVariantInject: true });

  const reviews: string[] = [];
  const removes: string[] = [];
  for (const { section, headingInManagedZone, bodyContainedManagedZone } of sections) {
    if (headingInManagedZone) continue;
    const verdict = classifyCommonizationSection(section, commonSections, {
      removeThreshold: W2_REMOVE_THRESHOLD,
      reviewFloor: W2_REVIEW_FLOOR,
    });
    if (verdict.verdict === 'remove') {
      if (bodyContainedManagedZone) {
        reviews.push(`${section.heading} (overlap ${verdict.maxSimilarity.toFixed(2)} — managed-zone content)`);
      } else {
        removes.push(`${section.heading} (overlap ${verdict.maxSimilarity.toFixed(2)} vs common ## ${verdict.matchedCommonHeading})`);
      }
    } else if (verdict.verdict === 'review') {
      reviews.push(`${section.heading} (overlap ${verdict.maxSimilarity.toFixed(2)})`);
    }
  }
  fleetReview += reviews.length;
  fleetRemove += removes.length;
  console.log(`[${project}] sections=${sections.length} REMOVE=${removes.length} REVIEW=${reviews.length}`);
  for (const r of removes) console.log(`  REMOVE ${r}`);
  for (const r of reviews) console.log(`  REVIEW ${r}`);
}
console.log(`\nFLEET TOTAL: REMOVE=${fleetRemove} REVIEW=${fleetReview}`);
