#!/usr/bin/env bun
// @version 1.4.0
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
    // Match the Meetings table header directly rather than requiring it to
    // immediately follow the "## Meetings" heading — a note/blockquote line
    // (e.g. archive-memory.ts's tombstone explanation) inserted between the
    // heading and the table would otherwise make this regex silently fail to
    // match, and the row would never be appended (no error, no insertion).
    content = content.replace(
      /(\| Date \| Topic \| File \|\r?\n\|[-| ]+\|)/,
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
    // Same fragility fix as Meetings/Sessions: match the ADRs table header
    // directly, tolerant of any intervening note text after "## ADRs".
    content = content.replace(
      /(\| ID \| Title \| Status \| File \|\r?\n\|[-| ]+\|)/,
      `$1\n| ${id} | ${summary} | Accepted | [${adrFile}](${adrFile}) |`
    );
    await Bun.write(MEMORY_FILE, content);
  }
} else {
  // Session: dedup by date
  if (!content.includes(`[${date}]`)) {
    // Root cause of a missed-row bug (2026-09-20): this regex used to anchor
    // to "## Sessions\r?\n\r?\n| Date |...", requiring the table to
    // immediately follow the heading. archive-memory.ts's tombstone
    // explanatory note (a blockquote line under "## Sessions") sits between
    // the heading and the table, so the anchored regex silently failed to
    // match — .replace() is a no-op when there's no match, so the row was
    // never appended and no error surfaced. Match the Sessions table header
    // itself instead, which is tolerant of any intervening note content.
    const before = content;
    content = content.replace(
      /(\| Date \| Summary \|\r?\n\|[-| ]+\|)/,
      `$1\n| [${date}](${date}.md) | ${summary} |`
    );
    if (content === before) {
      console.error(`❌ sync-md.ts: could not find the Sessions table header in ${MEMORY_FILE} — row for ${date} was NOT added.`);
      process.exit(1);
    }
    await Bun.write(MEMORY_FILE, content);
  }
}

// Makes this file a module: top-level await below requires it (TS1375).
export {};
