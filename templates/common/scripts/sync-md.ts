#!/usr/bin/env bun
// @version 1.3.0
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
//
// Idempotency matters here. The previous version keyed the whole migration off a
// single `## Sessions` guard and then appended the Meetings/ADRs sections
// unconditionally. Its heading regex required the line to be exactly
// "# Memory Index", so any project using a suffixed title (e.g.
// "# Memory Index — co-newbiz") never got `## Sessions` inserted, the guard stayed
// false on every subsequent run, and the two sections were re-appended each time —
// three copies of each after two syncs. Each section is now inserted only if it is
// actually absent, and the heading match tolerates a suffix.
if (!content.includes('## Sessions')) {
  // Insert Sessions after the `# Memory Index...` heading, whatever follows it on
  // that line. If no such heading exists at all, prepend one so the file still ends
  // up with the canonical structure rather than silently staying unmigrated.
  const headingRe = /^(#\s+Memory Index[^\n]*\r?\n)/m;
  if (headingRe.test(content)) {
    content = content.replace(headingRe, '$1\n## Sessions\n\n| Date | Summary |\n|------|---------|\n');
  } else {
    content = `# Memory Index\n\n## Sessions\n\n| Date | Summary |\n|------|---------|\n\n${content}`;
  }
}

if (!content.includes('## Meetings')) {
  content = content.trimEnd() + `

## Meetings

| Date | Topic | File |
|------|-------|------|
`;
}

if (!content.includes('## ADRs')) {
  content = content.trimEnd() + `

## ADRs

| ID | Title | Status | File |
|----|-------|--------|------|
`;
}

await Bun.write(MEMORY_FILE, content);
content = await Bun.file(MEMORY_FILE).text();

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
