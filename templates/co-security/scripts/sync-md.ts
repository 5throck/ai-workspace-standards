#!/usr/bin/env bun
// @version 1.2.0
// sync-md.ts - Update memory/MEMORY.md index
// Usage:
//   bun run scripts/sync-md.ts "YYYY-MM-DD" "summary"              # session entry
//   bun run scripts/sync-md.ts "YYYY-MM-DD" "summary" --meeting    # meeting entry
//   bun run scripts/sync-md.ts "YYYY-MM-DD" "summary" --adr "ID"   # ADR entry

const args = process.argv.slice(2);

const date: string = args[0] ?? new Date().toISOString().split('T')[0];
const summary: string = args[1] ?? 'update';

let type: 'session' | 'meeting' | 'adr' = 'session';
let adrId: string = '';

for (let i = 2; i < args.length; i++) {
  if (args[i] === '--meeting') type = 'meeting';
  else if (args[i] === '--adr') type = 'adr';
  else if (args[i].startsWith('ADR-')) adrId = args[i];
}

const MEMORY_FILE = 'memory/MEMORY.md';

const INIT_CONTENT = `# Memory Index

## Sessions

| Date | Summary |
|------|---------|

## Meetings

| Date | Topic | File |
|------|-------|------|

## ADRs

| ID | Title | Status | File |
|----|-------|--------|------|
`;

// ── Initialize MEMORY.md with 3-section structure if missing ─────────────────
const file = Bun.file(MEMORY_FILE);
let exists = await file.exists();
if (!exists) {
  await Bun.write(MEMORY_FILE, INIT_CONTENT);
}

let content = await Bun.file(MEMORY_FILE).text();

// ── Migrate legacy flat index if no ## Sessions section ──────────────────────
if (!content.includes('## Sessions')) {
  // Prepend Sessions section after # Memory Index heading
  content = content.replace(/(# Memory Index\r?\n)/, '$1\n## Sessions\n\n');
  content = content + `
## Meetings

| Date | Topic | File |
|------|-------|------|

## ADRs

| ID | Title | Status | File |
|----|-------|--------|------|
`;
  await Bun.write(MEMORY_FILE, content);
  content = await Bun.file(MEMORY_FILE).text();
}

// ── Append to appropriate section ────────────────────────────────────────────
function makeSlug(str: string, maxLen: number): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/-$/, '')
    .substring(0, maxLen);
}

if (type === 'meeting') {
  const slug = makeSlug(summary, 40);
  const meetingFile = `meeting-${date}-${slug}.md`;
  // Only insert if not already present (dedup by date + summary)
  if (!content.includes(date) && !content.includes(summary)) {
    // Insert row after the separator line of the ## Meetings table
    content = content.replace(
      /(## Meetings\r?\n\r?\n\| Date \|[^\n]+\r?\n\|[-| ]+\|)/,
      `$1\n| ${date} | ${summary} | [${meetingFile}](${meetingFile}) |`
    );
    await Bun.write(MEMORY_FILE, content);
  }
} else if (type === 'adr') {
  const slug = makeSlug(summary, 50);
  const id = adrId || 'ADR-XXXX';
  const adrFile = `${id}-${slug}.md`;
  // Only insert if not already present
  if (!content.includes(id) && !content.includes(summary)) {
    content = content.replace(
      /(## ADRs\r?\n\r?\n\| ID \|[^\n]+\r?\n\|[-| ]+\|)/,
      `$1\n| ${id} | ${summary} | Accepted | [${adrFile}](${adrFile}) |`
    );
    await Bun.write(MEMORY_FILE, content);
  }
} else {
  // Session: dedup by date
  if (!content.includes(`[${date}]`)) {
    content = content.replace(
      /(## Sessions\r?\n\r?\n\| Date \|[^\n]+\r?\n\|[-| ]+\|)/,
      `$1\n| [${date}](${date}.md) | ${summary} |`
    );
    await Bun.write(MEMORY_FILE, content);
  }
}
