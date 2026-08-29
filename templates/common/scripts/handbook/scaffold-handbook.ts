#!/usr/bin/env bun
// @version 1.2.0
// scripts/handbook/scaffold-handbook.ts
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
const title = getArg("--title", "Handbook");
const description = getArg("--description", "");
const repo = getArg("--repo", "");
const chaptersArg = getArg("--chapters", "");

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
  { src: "validate-handbook.ts", dest: "validate-handbook.ts" },
  { src: "build-search-index.ts", dest: "build-search-index.ts" },
  { src: "check-a11y.ts", dest: "check-a11y.ts" },
  { src: "check-external-links.ts", dest: "check-external-links.ts" },
  { src: "check-lint.ts", dest: "check-lint.ts" },
  { src: "check-search.ts", dest: "check-search.ts" },
  { src: "check-spell.ts", dest: "check-spell.ts" },
  { src: "check-structure.ts", dest: "check-structure.ts" },
  { src: "validate-nav.ts", dest: "validate-nav.ts" },
  { src: "check-links.ts", dest: "check-links.ts" },
  { src: "check-symmetry.ts", dest: "check-symmetry.ts" },
  { src: "check-labels.ts", dest: "check-labels.ts" },
  { src: "check-tables.ts", dest: "check-tables.ts" },
  { src: "extract-copycode.ts", dest: "extract-copycode.ts" },
  { src: "update-footers.ts", dest: "update-footers.ts" },
  { src: "nav-utils.ts", dest: "nav-utils.ts" },
  { src: "scaffold-handbook.ts", dest: "scaffold-handbook.ts" },
  { src: "check-authoring.ts", dest: "check-authoring.ts" },
  { src: "check-i18n-parity.ts", dest: "check-i18n-parity.ts" },
  { src: "apply-handbook-theme.ts", dest: "apply-handbook-theme.ts" },
  { src: "handbook-doctor.ts", dest: "handbook-doctor.ts" },
  { src: "deploy-handbook.ts", dest: "deploy-handbook.ts" },
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
    "validate-handbook": `bun run scripts/validate-handbook.ts --docs-dir docs`,
    "validate-nav": `bun run scripts/validate-nav.ts --docs-dir docs`,
    "check-a11y": `bun run scripts/check-a11y.ts --docs-dir docs`,
    "check-spell": `bun run scripts/check-spell.ts --docs-dir docs`,
    "check-lint": `bun run scripts/check-lint.ts --docs-dir docs`,
    "check-external-links": `bun run scripts/check-external-links.ts --docs-dir docs`,
    "build-search-index": `bun run scripts/build-search-index.ts --docs-dir docs`,
    "extract-copycode": `bun run scripts/extract-copycode.ts --docs-dir docs`,
    "check-structure": `bun run scripts/check-structure.ts --docs-dir docs`,
    "check-tables": `bun run scripts/check-tables.ts --docs-dir docs`,
    "update-footers": `bun run scripts/update-footers.ts --docs-dir docs`,
    "check-authoring": `bun run scripts/check-authoring.ts --project . --lang ${lang}`,
    "check-i18n": `bun run scripts/check-i18n-parity.ts --docs-dir docs`,
    "apply-theme": `bun run scripts/apply-handbook-theme.ts --project . --theme azure`,
    "handbook-doctor": `bun run scripts/handbook-doctor.ts --project .`,
    "scaffold": `bun run scripts/scaffold-handbook.ts --project . --output handbook --lang ${lang}`,
    "deploy": `bun run scripts/deploy-handbook.ts --project . --output handbook`,
  },
};
writeFileSync(join(targetDir, "package.json"), JSON.stringify(packageJson, null, 2) + "\n");
created++;

// --- README.md + LICENSE generation ---

const chapters = chaptersArg ? chaptersArg.split(",").map(s => s.trim()).filter(Boolean) : [];

// Supported languages for README generation: en is always README.md,
// additional languages get README_<code>.md (e.g. README_ko.md, README_ja.md).
// Add new languages to README_LANGS to auto-generate them at scaffold time.
const README_LANGS: Array<{ code: string; file: string; label: string }> = [
  { code: "en", file: "README.md", label: "English" },
  { code: "ko", file: "README_ko.md", label: "한국어" },
];

function generateReadme(langCode: string, langLabel: string): string {
  const isKo = langCode === "ko";

  // Build language switcher: list all README_LANGS entries
  const langLinks = README_LANGS.map(l => {
    const marker = l.code === langCode ? `**${l.label}**` : l.label;
    return `[${marker}](${l.file})`;
  });
  const langSwitcher = `Language: ${langLinks.join(" | ")}`;

  const desc = description || (isKo
    ? `${title}은(는) AI 워크스페이스 교육 프로그램입니다.`
    : `Welcome to the **${title}**, an AI Workspace educational program.`);

  const pagesUrl = repo
    ? `https://${repo.replace(/^https?:\/\//, "").split("/")[0]}.github.io/${repo.split("/").pop()}/`
    : "";

  const pagesSection = pagesUrl
    ? (isKo
        ? `\n## 🌐 교육 프로그램 바로가기 (웹사이트)\n👉 **[${title} 교육 사이트 보기](${pagesUrl})**\n`
        : `\n## 🌐 Read the Handbook Live\n👉 **[Online Handbook & Educational Program](${pagesUrl})**\n`)
    : "";

  const curriculumHeader = isKo ? "## 📚 커리큘럼 구성" : "## 📚 Curriculum / Contents";
  const chapterList = chapters.length > 0
    ? chapters.map(ch => `  - **${ch}**`).join("\n")
    : `  - *(Add chapter list)*`;

  const versionsHeader = isKo ? "## 🎯 대상 버전" : "## 🎯 Target Versions";
  const versionInfo = "Claude Code 2026-07 / Antigravity CLI 1.1.0+ / Antigravity 2.0";

  const licenseHeader = "## 📜 License";
  const licenseText = isKo
    ? `- **핸드북 콘텐츠**: [CC BY-NC-SA 4.0](LICENSE) (저작자표시-비영리-동일조건변경허락 4.0 국제)`
    : `- **Handbook content**: [CC BY-NC-SA 4.0](LICENSE) (Attribution-NonCommercial-ShareAlike 4.0 International)`;

  return `# ${title}\n\n${langSwitcher}\n\n${desc}\n${pagesSection}\n${curriculumHeader}\n${chapterList}\n\n${versionsHeader}\n- ${versionInfo}\n\n${licenseHeader}\n${licenseText}\n`;
}

// Generate all README files
const readmeNames: string[] = [];
for (const { code, file, label } of README_LANGS) {
  writeFileSync(join(targetDir, file), generateReadme(code, label));
  readmeNames.push(file);
  created++;
}

// Write LICENSE (CC BY-NC-SA 4.0)
const licenseContent = `${title} — Content License
============================================================

The written content of this handbook (chapter text, diagrams, and other
documentation under this repository) is licensed under the Creative Commons
Attribution-NonCommercial-ShareAlike 4.0 International License (CC BY-NC-SA 4.0).

저작자표시-비영리-동일조건변경허락 4.0 국제 (CC BY-NC-SA 4.0)

You are free to:
  - Share — copy and redistribute the material in any medium or format
  - Adapt — remix, transform, and build upon the material

Under the following terms:
  - Attribution (저작자표시) — You must give appropriate credit, provide a
    link to the license, and indicate if changes were made.
  - NonCommercial (비영리) — You may not use the material for commercial
    purposes.
  - ShareAlike (동일조건변경허락) — If you remix, transform, or build upon
    the material, you must distribute your contributions under the same
    license as the original.

Full legal code: https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode
License deed:    https://creativecommons.org/licenses/by-nc-sa/4.0/
License deed (한국어): https://creativecommons.org/licenses/by-nc-sa/4.0/deed.ko
`;
writeFileSync(join(targetDir, "LICENSE"), licenseContent);
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
  validate-handbook:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: cd handbook && bun install && bun run validate-handbook

  check-authoring:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: cd handbook && bun install && bun run check-authoring --examples-dir ../templates/common/skills/handbook/examples

  check-a11y:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: cd handbook && bun install && bun run check-a11y

  check-spell:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: cd handbook && bun install && bun run check-spell

  check-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: cd handbook && bun install && bun run check-lint

  build-search-index:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: cd handbook && bun install && bun run build-search-index
      - name: Verify search-data.js is up to date
        run: |
          if ! git diff --exit-code docs/assets/search-data.js; then
            echo "::error::search-data.js is out of sync with search-manifest.json. Run 'bun run build-search-index' and commit the result."
            exit 1
          fi
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
console.log(`   📁 .github/ — CI workflow (validate-handbook + check-authoring)`);
console.log(`   📄 ${readmeNames.join(", ")}, LICENSE — Auto-generated project metadata`);
console.log(`\n   Next steps:`);
console.log(`   1. cd ${outputDir}`);
console.log(`   2. bun install`);
console.log(`   3. bun run apply-theme --theme azure`);
console.log(`   4. Edit docs/chapters/ to add content`);
console.log(`   5. bun run validate-handbook   # structure + nav + tables in one command`);
console.log(`   6. bun run deploy --repo {owner}/{name}   # deploy to GitHub Pages`);
