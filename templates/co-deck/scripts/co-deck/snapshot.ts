// @version 1.0.0
// File version snapshot manager — saves copies to _versions/<id>/ and tracks history in VERSIONS.md.
// Usage: bun scripts/snapshot.ts <file1> [file2 ...] --workspace presentations/<project> --desc "..." --agent "..."
//        bun scripts/snapshot.ts --workspace presentations/<project> --list
//        bun scripts/snapshot.ts --workspace presentations/<project> --restore <versionId>

import {
  existsSync, mkdirSync, copyFileSync, cpSync, statSync,
  readdirSync, readFileSync, writeFileSync,
} from 'fs';
import { join, resolve, relative, dirname, basename } from 'path';

const VERSIONS_DIR = '_versions';
const VERSIONS_MD  = 'VERSIONS.md';
const MAX_DISPLAY  = 20;

function getWorkspaceRoot(): string {
  return resolve(dirname(import.meta.path), '../..');
}

function makeVersionId(desc: string, agent: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const ts = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
  const safeAgent = agent.replace(/ /g, '_').toLowerCase().slice(0, 12);
  const safeDesc  = (desc || 'update').replace(/ /g, '_').replace(/[^a-zA-Z0-9\-_가-힣ㄱ-ㅎㅏ-ㅣ]/g, '').slice(0, 20);
  return `${ts}_${safeAgent}_${safeDesc}`;
}

function sizeofFmt(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function getAllFiles(dir: string): string[] {
  const files: string[] = [];
  function walk(d: string) {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else files.push(full);
    }
  }
  walk(dir);
  return files;
}

function updateVersionsMd(
  workspace: string, versionId: string, desc: string, agent: string,
  saved: [string, string][], skipped: string[],
) {
  const mdPath = join(workspace, VERSIONS_MD);
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ');

  const filesLines = [
    ...saved.map(([f, size]) => `  - \`${f}\` (${size})`),
    ...skipped.map(s  => `  - ~~\`${s}\`~~ (없음, 건너뜀)`),
  ].join('\n');

  const restoreCmd = `bun scripts/snapshot.ts --restore ${versionId}`;
  const newEntry = `
## ${versionId}

| 항목 | 내용 |
|------|------|
| 날짜 | ${now} |
| 에이전트 | ${agent} |
| 설명 | ${desc} |

**저장된 파일:**
${filesLines}

**복원 명령어:**
\`\`\`bash
${restoreCmd}
\`\`\`

---
`;

  let content: string;
  if (existsSync(mdPath)) {
    const existing = readFileSync(mdPath, 'utf-8');
    const dashIdx = existing.indexOf('---');
    content = dashIdx !== -1
      ? existing.slice(0, dashIdx + 3) + newEntry + existing.slice(dashIdx + 3)
      : existing + newEntry;
  } else {
    content = `# 버전 이력

이 파일은 \`scripts/snapshot.ts\`가 자동으로 관리합니다.
각 스냅샷은 \`_versions/<버전ID>/\` 폴더에 저장됩니다.

---
${newEntry}`;
  }

  writeFileSync(mdPath, content, 'utf-8');
}

function snapshot(files: string[], desc: string, agent: string, workspace: string): string {
  const versionId  = makeVersionId(desc, agent);
  const versionDir = join(workspace, VERSIONS_DIR, versionId);
  mkdirSync(versionDir, { recursive: true });

  const saved: [string, string][] = [];
  const skipped: string[] = [];

  for (const filePath of files) {
    const src = resolve(workspace, filePath);
    if (!existsSync(src)) { skipped.push(filePath); continue; }

    const stat = statSync(src);
    if (stat.isDirectory()) {
      const dst = join(versionDir, basename(src));
      cpSync(src, dst, { recursive: true });
      saved.push([filePath, 'directory']);
      console.log(`  📁 ${filePath}/ → _versions/${versionId}/`);
    } else {
      let rel: string;
      try { rel = relative(workspace, src); } catch { rel = basename(src); }
      const dst = join(versionDir, rel);
      mkdirSync(dirname(dst), { recursive: true });
      copyFileSync(src, dst);
      const size = sizeofFmt(stat.size);
      saved.push([rel, size]);
      console.log(`  📄 ${rel} (${size}) → _versions/${versionId}/`);
    }
  }

  for (const s of skipped) console.log(`  ⚠️  건너뜀 (없음): ${s}`);

  updateVersionsMd(workspace, versionId, desc, agent, saved, skipped);
  console.log(`\n✅ 스냅샷 완료: ${versionId}`);
  console.log(`   복원 명령어: bun scripts/snapshot.ts --restore ${versionId}`);
  return versionId;
}

function listVersions(workspace: string) {
  const versionsDir = join(workspace, VERSIONS_DIR);
  if (!existsSync(versionsDir)) { console.log('📭 저장된 버전이 없습니다.'); return; }

  const entries = readdirSync(versionsDir, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name)
    .sort()
    .reverse();

  if (entries.length === 0) { console.log('📭 저장된 버전이 없습니다.'); return; }

  const line = '─'.repeat(60);
  console.log(`\n${line}`);
  console.log(`  저장된 버전 (${entries.length}개, 최신순)`);
  console.log(line);

  for (let i = 0; i < Math.min(entries.length, MAX_DISPLAY); i++) {
    const entryPath = join(versionsDir, entries[i]);
    const allFiles  = getAllFiles(entryPath);
    const total     = allFiles.reduce((acc, f) => acc + statSync(f).size, 0);
    console.log(`  [${String(i + 1).padStart(2)}] ${entries[i]}`);
    console.log(`        파일: ${allFiles.length}개 / 크기: ${sizeofFmt(total)}`);
  }

  if (entries.length > MAX_DISPLAY) console.log(`  ... 외 ${entries.length - MAX_DISPLAY}개 더`);
  console.log(line);
  console.log(`\n  복원: bun scripts/snapshot.ts --restore <버전ID>`);
  if (entries[0]) console.log(`  예시: bun scripts/snapshot.ts --restore ${entries[0]}`);
}

function restore(versionId: string, workspace: string) {
  const versionsDir = join(workspace, VERSIONS_DIR);
  let versionDir    = join(versionsDir, versionId);

  if (!existsSync(versionDir)) {
    if (!existsSync(versionsDir)) {
      console.log(`❌ 버전을 찾을 수 없습니다: ${versionId}`); return;
    }
    const matches = readdirSync(versionsDir, { withFileTypes: true })
      .filter(e => e.isDirectory() && e.name.includes(versionId))
      .map(e => e.name);

    if (matches.length === 1) {
      versionDir = join(versionsDir, matches[0]);
      console.log(`  → 버전 ID 매칭: ${matches[0]}`);
    } else if (matches.length > 1) {
      console.log(`❌ 여러 버전이 매칭됩니다. 더 구체적인 ID를 사용하세요:`);
      matches.forEach(m => console.log(`   ${m}`));
      return;
    } else {
      console.log(`❌ 버전을 찾을 수 없습니다: ${versionId}`);
      console.log(`   bun scripts/snapshot.ts --list 로 목록을 확인하세요.`); return;
    }
  }

  const versionDirName = basename(versionDir);
  console.log(`\n🔄 복원 시작: ${versionDirName}`);

  const filesToRestore = getAllFiles(versionDir).map(f => relative(versionDir, f));
  const existing       = filesToRestore.filter(f => existsSync(join(workspace, f)));

  if (existing.length > 0) {
    console.log('  현재 파일 백업 중...');
    const autoId = snapshot(existing, '복원직전_자동백업', 'version', workspace);
    console.log(`  백업 완료: ${autoId}`);
  }

  const restored: string[] = [];
  for (const relPath of filesToRestore) {
    const src = join(versionDir, relPath);
    const dst = join(workspace, relPath);
    if (!existsSync(src)) { console.log(`  ⚠️  ${relPath}: 스냅샷에 없음, 건너뜀`); continue; }
    mkdirSync(dirname(dst), { recursive: true });
    const stat = statSync(src);
    if (stat.isDirectory()) cpSync(src, dst, { recursive: true });
    else copyFileSync(src, dst);
    restored.push(relPath);
    console.log(`  ✅ ${relPath}`);
  }

  console.log(`\n✅ 복원 완료 — ${restored.length}개 파일`);
  console.log(`   복원 원본: _versions/${versionDirName}/`);
}

// ── CLI entrypoint ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flagsWithVal = new Set(['--workspace', '--desc', '--agent', '--restore']);
const files: string[] = [];
const parsed: Record<string, string | boolean> = {};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--list') {
    parsed['list'] = true;
  } else if (flagsWithVal.has(arg)) {
    parsed[arg.slice(2)] = args[++i] ?? '';
  } else if (!arg.startsWith('--')) {
    files.push(arg);
  }
}

const workspaceArg = parsed['workspace'] as string | undefined;
const workspace    = workspaceArg ? resolve(workspaceArg) : getWorkspaceRoot();
const desc         = (parsed['desc']  as string) ?? 'update';
const agent        = (parsed['agent'] as string) ?? 'manual';
const restoreId    = parsed['restore'] as string | undefined;
const isList       = parsed['list'] === true;

console.log(`🗂  워크스페이스: ${workspace}`);

if (isList) {
  listVersions(workspace);
} else if (restoreId) {
  restore(restoreId, workspace);
} else if (files.length > 0) {
  console.log(`\n📸 스냅샷 생성 중...`);
  console.log(`   에이전트: ${agent}`);
  console.log(`   설명: ${desc}`);
  console.log(`   파일: ${files.join(', ')}\n`);
  snapshot(files, desc, agent, workspace);
} else {
  console.log(`
사용법:
  bun scripts/snapshot.ts <file1> [file2 ...] --workspace presentations/<project> --desc "설명" --agent "에이전트명"
  bun scripts/snapshot.ts --workspace presentations/<project> --list
  bun scripts/snapshot.ts --workspace presentations/<project> --restore <버전ID>

예시:
  bun scripts/snapshot.ts slide_deck.md --desc '챕터 수 조정' --agent content
  bun scripts/snapshot.ts --list
  bun scripts/snapshot.ts --restore 2026-06-17_14-30_content_챕터수조정
`);
}
