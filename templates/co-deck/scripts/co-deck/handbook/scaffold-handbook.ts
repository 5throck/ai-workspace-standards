#!/usr/bin/env bun
// scripts/co-deck/handbook/scaffold-handbook.ts
// Generates handbook project scaffold from skill templates + assets.
// Copies template HTML, CSS, JS, scripts, and examples into a new project.

import { copyFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve, relative } from "node:path";

const args = process.argv.slice(2);
function getArg(name: string, fallback: string): string {
  const idx = args.indexOf(name);
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return fallback;
}

const projectDir = resolve(getArg("--project", "."));
const outputDir = getArg("--output", "handbook");
const lang = getArg("--lang", "ko");

const targetDir = join(projectDir, outputDir);
const docsDir = join(targetDir, "docs");
const scriptsDir = join(targetDir, "scripts");
const assetsDir = join(docsDir, "assets");

// Locate skill templates relative to this script
const thisDir = import.meta.dirname || ".";
const skillRoot = join(thisDir, "..", "..", "..", "skills", "handbook");

const TEMPLATE_FILES: { src: string; dest: string }[] = [
  // HTML templates
  { src: "templates/base.html", dest: "base.html" },
  { src: "templates/index.html", dest: "index.html" },
  { src: "templates/manual.html", dest: "manual.html" },
  { src: "templates/examples.html", dest: "examples.html" },
  { src: "templates/chapter.html", dest: "chapter.html" },
  { src: "templates/quiz.html", dest: "quiz.html" },
  { src: "templates/course-overview.html", dest: "course-overview.html" },
  { src: "templates/instructor-guide.html", dest: "instructor-guide.html" },
  // Assets
  { src: "assets/css/handbook-variables.css", dest: "assets/css/handbook-variables.css" },
  { src: "assets/css/handbook-components.css", dest: "assets/css/handbook-components.css" },
  { src: "assets/js/site-search.js", dest: "assets/js/site-search.js" },
  { src: "assets/js/inpage-search.js", dest: "assets/js/inpage-search.js" },
  { src: "assets/js/dark-mode-toggle.js", dest: "assets/js/dark-mode-toggle.js" },
  { src: "assets/js/lang-switcher.js", dest: "assets/js/lang-switcher.js" },
  // Static files
  { src: "templates/.gitignore", dest: ".gitignore" },
  { src: "templates/.nojekyll", dest: ".nojekyll" },
];

const SCRIPT_FILES: { src: string; dest: string }[] = [
  { src: "handbook/validate-nav.ts", dest: "validate-nav.ts" },
  { src: "handbook/check-links.ts", dest: "check-links.ts" },
  { src: "handbook/check-symmetry.ts", dest: "check-symmetry.ts" },
  { src: "handbook/check-labels.ts", dest: "check-labels.ts" },
  { src: "handbook/check-search.ts", dest: "check-search.ts" },
  { src: "handbook/nav-utils.ts", dest: "nav-utils.ts" },
  { src: "handbook/scaffold-handbook.ts", dest: "scaffold-handbook.ts" },
  { src: "handbook/check-authoring.ts", dest: "check-authoring.ts" },
  { src: "handbook/apply-handbook-theme.ts", dest: "apply-handbook-theme.ts" },
  { src: "handbook/handbook-doctor.ts", dest: "handbook-doctor.ts" },
];

let copied = 0;
let skipped = 0;
let created = 0;

function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    created++;
  }
}

function copyFile(srcAbs: string, destAbs: string) {
  if (!existsSync(srcAbs)) {
    console.log(`⚠️  SKIP (not found): ${srcAbs}`);
    skipped++;
    return;
  }
  ensureDir(join(destAbs, ".."));
  copyFileSync(srcAbs, destAbs);
  copied++;
}

// Create directory structure
ensureDir(docsDir);
ensureDir(join(docsDir, "chapters"));
ensureDir(assetsDir);
ensureDir(join(assetsDir, "css"));
ensureDir(join(assetsDir, "js"));
ensureDir(join(assetsDir, "images"));
ensureDir(join(assetsDir, "icons"));
ensureDir(scriptsDir);
ensureDir(join(scriptsDir, "handbook"));
ensureDir(join(targetDir, ".github", "workflows"));

// Copy templates
console.log("📝 Copying templates...");
for (const t of TEMPLATE_FILES) {
  const src = join(skillRoot, t.src);
  const dest = join(docsDir, t.dest);
  copyFile(src, dest);
}

// Copy scripts
console.log("📝 Copying scripts...");
const scriptsSourceDir = join(thisDir);
for (const t of SCRIPT_FILES) {
  const src = join(scriptsSourceDir, t.src);
  const dest = join(scriptsDir, t.dest);
  copyFile(src, dest);
}

// Create package.json
const packageJson = {
  name: "handbook",
  private: true,
  type: "module",
  scripts: {
    "validate-nav": `bun run scripts/validate-nav.ts --docs-dir docs`,
    "check-authoring": `bun run scripts/check-authoring.ts --project . --lang ${lang}`,
    "apply-theme": `bun run scripts/apply-handbook-theme.ts --project . --theme azure`,
    "handbook-doctor": `bun run scripts/handbook-doctor.ts --project .`,
    "scaffold": `bun run scripts/scaffold-handbook.ts --project . --output handbook --lang ${lang}`,
  },
};
writeFileSync(join(targetDir, "package.json"), JSON.stringify(packageJson, null, 2) + "\n");
created++;

// Create CI workflow
const ciYml = `name: Validate Handbook
on:
  pull_request:
    branches: [main]
    paths:
      - 'handbook/docs/**'
      - 'handbook/scripts/**'

jobs:
  validate-nav:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: cd handbook && bun install && bun run validate-nav

  check-authoring:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: cd handbook && bun install && bun run check-authoring --examples-dir ../templates/co-deck/skills/handbook/examples
`;
writeFileSync(join(targetDir, ".github", "workflows", "validate-handbook.yml"), ciYml);
created++;

// Create CHANGELOG.md placeholder
writeFileSync(join(targetDir, "CHANGELOG.md"), `# Changelog\n\nAll notable changes to this handbook.\n\n## [Unreleased]\n\n`);
created++;

// Summary
console.log(`\n✅ Handbook scaffold created: ${targetDir}`);
console.log(`   📋 ${copied} file(s) copied, ${created} file(s) created, ${skipped} skipped`);
console.log(`   📁 docs/    — HTML pages + assets`);
console.log(`   📁 scripts/ — Validation and tooling scripts`);
console.log(`   📁 .github/ — CI workflow (validate-nav + check-authoring)`);
console.log(`\n   Next steps:`);
console.log(`   1. cd ${outputDir}`);
console.log(`   2. bun install`);
console.log(`   3. bun run apply-theme --theme azure`);
console.log(`   4. Edit docs/chapters/ to add content`);
console.log(`   5. bun run validate-nav && bun run check-authoring`);
