// @version 1.1.0
// v1.1.0 (T-20260917-review): tombstone the archived session's MEMORY.md row.
//           Archiving a session log used to leave its `[date](date.md)` link in
//           memory/MEMORY.md pointing at a deleted file — the verify-memory
//           dead-link regression test then failed on the next CI run (real case:
//           2026-09-09, archived by dev-sync step 3.96b, row left as a link).
//           The row is now rewritten as a link-free tombstone, matching the
//           convention documented at the top of memory/MEMORY.md.
/**
 * Archives memory markdown files older than 7 days and tombstones their
 * memory/MEMORY.md session rows.
 * @version 1.1.0
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const memoryDir = 'memory';
const archiveDir = path.join(memoryDir, 'archive');
const memoryIndexPath = path.join(memoryDir, 'MEMORY.md');

if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true });
}

const files = fs.readdirSync(memoryDir);
const today = new Date();
today.setHours(0, 0, 0, 0);

const archivedSessions: string[] = [];

for (const file of files) {
    if (!file.endsWith('.md')) continue;
    if (file === 'MEMORY.md') continue;

    const fullPath = path.join(memoryDir, file);
    if (fs.statSync(fullPath).isDirectory()) continue;

    const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})\.md$/);
    let fileDate: Date;
    if (dateMatch) {
        fileDate = new Date(dateMatch[1]);
    } else {
        fileDate = fs.statSync(fullPath).mtime;
    }

    const diffTime = today.getTime() - fileDate.getTime();
    const diffDays = diffTime / (1000 * 3600 * 24);

    if (diffDays > 7) {
        fs.renameSync(fullPath, path.join(archiveDir, file));
        if (dateMatch) archivedSessions.push(dateMatch[1]);
        console.log(`Archived ${file}`);
    }
}

// Tombstone MEMORY.md rows for the sessions just archived: replace the
// `[date](date.md)` link with plain-text date (link-free rows are the
// documented tombstone convention in memory/MEMORY.md).
if (archivedSessions.length > 0 && fs.existsSync(memoryIndexPath)) {
    let index = fs.readFileSync(memoryIndexPath, 'utf-8');
    let changed = false;
    for (const date of archivedSessions) {
        const linkRe = new RegExp(`\\[(${date})\\]\\(${date}\\.md\\)`, 'g');
        if (linkRe.test(index)) {
            index = index.replace(linkRe, '$1');
            changed = true;
        }
    }
    if (changed) {
        fs.writeFileSync(memoryIndexPath, index, 'utf-8');
        console.log(`Tombstoned ${archivedSessions.length} MEMORY.md row(s)`);
    }
}
