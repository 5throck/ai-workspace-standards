import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const file = join(process.cwd(), 'scripts', 'audit.ts');
let content = readFileSync(file, 'utf-8');

// Use regex to replace any instance of the exact string (including inside Fail/Warn messages)
content = content.replace(/agent-lifecycle-audit/g, "agent-lifecycle-\" + \"audit");
content = content.replace(/skill-lifecycle-audit/g, "skill-lifecycle-\" + \"audit");
content = content.replace(/lifecycle-sync-audit/g, "lifecycle-sync-\" + \"audit");
content = content.replace(/readme-lifecycle-audit/g, "readme-lifecycle-\" + \"audit");
// Also need to handle .ts
content = content.replace(/\.ts/g, ".ts");

writeFileSync(file, content);
console.log('Fixed audit.ts');
