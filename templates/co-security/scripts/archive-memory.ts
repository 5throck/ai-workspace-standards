/**
 * Archives memory markdown files older than 7 days.
 * @version 1.0.0
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const memoryDir = 'memory';
const archiveDir = path.join(memoryDir, 'archive');

if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true });
}

const files = fs.readdirSync(memoryDir);
const today = new Date();
today.setHours(0, 0, 0, 0);

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
        console.log(`Archived ${file}`);
    }
}
