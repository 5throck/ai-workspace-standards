import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

function walkSkills(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const skillMd = join(dir, e.name, 'SKILL.md');
    if (existsSync(skillMd)) acc.push(skillMd);
    else walkSkills(join(dir, e.name), acc);
  }
  return acc;
}

let fixed = 0, checked = 0;
for (const root of ['skills', '.claude/skills', '.gemini/skills']) {
  for (const f of walkSkills(root)) {
    checked++;
    const raw = readFileSync(f, 'utf8');
    const next = raw.replace(/^version: "([0-9]+\.[0-9]+)"$/m, 'version: "$1.0"');
    if (next !== raw) { writeFileSync(f, next, 'utf8'); fixed++; }
  }
}
console.log('checked:', checked, 'fixed:', fixed);
