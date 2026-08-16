// @version 1.0.0
#!/usr/bin/env bun
// vsp-task.ts - Creates a new task file in scratch/tasks/ from template
// Usage: bun scripts/vsp-task.ts [task-name]

import path from "node:path";
import * as fs from "node:fs";

const scriptDir = path.dirname(import.meta.path);
const projectRoot = path.resolve(scriptDir, "..");

const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

const MINIMAL_TEMPLATE = `# Task — {{timestamp}}

## 0. Request

**Received by (PM)**: {{timestamp}}
**User Request**:
> Request for: {{name}}

**Classification**: <!-- Debug / Graph Analysis / Interface / Infra / ABAP Dev -->
**Package**: $TMP
**Affected Object Types**: <!-- fill after investigation -->

## 1. Business Analysis
<!-- Fill after read-only-analyst / sap-investigator / schema-inspector results -->

## 2. Technical Design
<!-- Fill after architect report -->

## 3. Implementation Log
<!-- Fill as code-writer completes steps -->

## 4. QA / Test Results
<!-- Fill after test-runner report -->

## 5. Finalization
<!-- Memory log entry, transport number, git commit -->
`;

async function main() {
  const name = process.argv.slice(2).join(" ") || "new-task";
  const now = new Date();
  const date = now.toISOString().split("T")[0]; // yyyy-MM-dd
  const timestamp = now.toISOString().replace("T", " ").substring(0, 19); // yyyy-MM-dd HH:mm:ss

  const scratchDir = path.join(projectRoot, "scratch", "tasks");
  const templateFile = path.join(projectRoot, "docs", "task-template.md");

  // Create scratch dir if it doesn't exist
  if (!fs.existsSync(scratchDir)) {
    fs.mkdirSync(scratchDir, { recursive: true });
  }

  // Find next sequence number
  let nextSeq = 1;
  try {
    const existingFiles = fs
      .readdirSync(scratchDir)
      .filter((f) => f.startsWith(`task-${date}-`) && f.endsWith(".md"))
      .sort();
    if (existingFiles.length > 0) {
      const lastFile = existingFiles[existingFiles.length - 1];
      const match = lastFile.match(/(\d+)\.md$/);
      if (match) {
        nextSeq = parseInt(match[1], 10) + 1;
      }
    }
  } catch {
    // directory doesn't exist yet
  }

  const seqStr = nextSeq.toString().padStart(3, "0");
  const targetFileName = `task-${date}-${seqStr}.md`;
  const targetFilePath = path.join(scratchDir, targetFileName);

  // Choose template source
  let templateContent: string;
  if (fs.existsSync(templateFile)) {
    templateContent = fs.readFileSync(templateFile, "utf-8");
  } else {
    console.log(`${YELLOW}Warning: task-template.md not found. Using minimal template.${RESET}`);
    templateContent = MINIMAL_TEMPLATE;
  }

  // Replace placeholders
  templateContent = templateContent.replace(/<!-- date and time -->/g, timestamp);
  templateContent = templateContent.replace(
    /<!-- paste original user request verbatim -->/g,
    `Request for: ${name}`
  );

  // Path adjustment: tasks are two directories deeper than template
  templateContent = templateContent.replace(/\]\(\.\.\/skills\//g, "](../../skills/");

  fs.writeFileSync(targetFilePath, templateContent, "utf-8");
  console.log(`${GREEN}Created new task: ${targetFileName}${RESET}`);
  console.log(`Path: ${targetFilePath}`);
}

if (import.meta.main) {
  main().catch((e) => {
    console.error(`vsp-task: ${e}`);
    process.exit(1);
  });
}

export { main };
