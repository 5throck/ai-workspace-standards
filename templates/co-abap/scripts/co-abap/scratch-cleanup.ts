#!/usr/bin/env bun
// @version 1.0.1
/**
 * Scratch Workspace Cleanup CLI
 * Manages scratch/ directory hygiene — temp purging, task archival, and status reporting.
 *
 * Usage:
 *   bun scripts/scratch-cleanup.ts --status                  Show directory overview
 *   bun scripts/scratch-cleanup.ts --temp [--days 7]         Purge temp/ files older than N days
 *   bun scripts/scratch-cleanup.ts --archive-tasks [--days 30]  Archive completed tasks
 *   bun scripts/scratch-cleanup.ts --dry-run <any flags>     Preview without making changes
 *
 * @module scratch-cleanup
 */

import path from "node:path";
import * as fs from "node:fs";

const scriptDir = path.dirname(import.meta.path);
const projectRoot = path.resolve(scriptDir, "..");

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";

interface DirStats {
  path: string;
  fileCount: number;
  totalSize: number;
  oldestFile: string | null;
  oldestDate: Date | null;
  newestFile: string | null;
  newestDate: Date | null;
}

interface CleanupResult {
  action: "delete" | "archive" | "skip";
  file: string;
  reason?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function getDirStats(dirPath: string): DirStats {
  const stats: DirStats = {
    path: dirPath,
    fileCount: 0,
    totalSize: 0,
    oldestFile: null,
    oldestDate: null,
    newestFile: null,
    newestDate: null,
  };

  if (!fs.existsSync(dirPath)) return stats;

  const entries = fs.readdirSync(dirPath);
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry);
    if (fs.statSync(fullPath).isFile() && !entry.startsWith(".git")) {
      const stat = fs.statSync(fullPath);
      stats.fileCount++;
      stats.totalSize += stat.size;

      if (!stats.oldestDate || stat.mtime < stats.oldestDate) {
        stats.oldestDate = stat.mtime;
        stats.oldestFile = entry;
      }
      if (!stats.newestDate || stat.mtime > stats.newestDate) {
        stats.newestDate = stat.mtime;
        stats.newestFile = entry;
      }
    }
  }

  return stats;
}

function displayStatus(root: string = projectRoot): void {
  console.log(`${CYAN}=== Scratch Workspace Status ===${RESET}\n`);

  const scratchDir = path.join(root, "scratch");
  const subdirs = ["stable", "tasks", "temp"];

  for (const subdir of subdirs) {
    const dirPath = path.join(scratchDir, subdir);
    const stats = getDirStats(dirPath);

    const icon = stats.fileCount === 0 ? "  " : stats.fileCount > 10 ? "⚠️" : "✅";
    console.log(`${icon} ${subdir}/`);
    console.log(`   Files: ${stats.fileCount}`);
    console.log(`   Size:  ${formatBytes(stats.totalSize)}`);

    if (stats.oldestFile) {
      console.log(`   Oldest: ${stats.oldestFile} (${stats.oldestDate!.toISOString().split("T")[0]})`);
    }
    if (stats.newestFile) {
      console.log(`   Newest: ${stats.newestFile} (${stats.newestDate!.toISOString().split("T")[0]})`);
    }
    console.log("");
  }

  // Check for root-level files (should be empty)
  const rootFiles = fs.existsSync(scratchDir)
    ? fs.readdirSync(scratchDir).filter(
        (f) => !["stable", "tasks", "temp", "qa-reports"].includes(f) && !f.startsWith(".")
      )
    : [];
  if (rootFiles.length > 0) {
    console.log(`${YELLOW}⚠️  Root-level files in scratch/ (should be organized into subdirs):${RESET}`);
    for (const f of rootFiles) {
      console.log(`   - ${f}`);
    }
    console.log("");
  } else {
    console.log(`${GREEN}✅ scratch/ root is clean (no stray files)${RESET}\n`);
  }
}

function purgeTemp(maxAgeDays: number, dryRun: boolean, root: string = projectRoot): void {
  const tempDir = path.join(root, "scratch", "temp");

  if (!fs.existsSync(tempDir)) {
    console.log(`${CYAN}ℹ️  scratch/temp/ does not exist — nothing to purge.${RESET}`);
    return;
  }

  const entries = fs.readdirSync(tempDir).filter((f) => !f.startsWith("."));
  if (entries.length === 0) {
    console.log(`${GREEN}✅ scratch/temp/ is already empty.${RESET}`);
    return;
  }

  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  const results: CleanupResult[] = [];

  for (const entry of entries) {
    const fullPath = path.join(tempDir, entry);
    const stat = fs.statSync(fullPath);
    if (stat.mtimeMs < cutoff) {
      results.push({ action: "delete", file: entry, reason: `${Math.floor((Date.now() - stat.mtimeMs) / 86400000)} days old` });
    } else {
      results.push({ action: "skip", file: entry, reason: `< ${maxAgeDays} days old` });
    }
  }

  const toDelete = results.filter((r) => r.action === "delete");
  const toSkip = results.filter((r) => r.action === "skip");

  if (dryRun) {
    console.log(`${CYAN}=== DRY RUN: temp/ purge (>${maxAgeDays} days) ===${RESET}\n`);
  } else {
    console.log(`${CYAN}=== Purging scratch/temp/ (>${maxAgeDays} days) ===${RESET}\n`);
  }

  if (toDelete.length > 0) {
    for (const r of toDelete) {
      const icon = dryRun ? `${YELLOW}[DRY]${RESET}` : `${RED}[DEL]${RESET}`;
      console.log(`  ${icon} ${r.file} (${r.reason})`);
      if (!dryRun) {
        fs.unlinkSync(path.join(tempDir, r.file));
      }
    }
  }

  if (toSkip.length > 0) {
    console.log(`\n  ${toSkip.length} file(s) skipped (below age threshold):`);
    for (const r of toSkip) {
      console.log(`  ${GREEN}[KEEP]${RESET} ${r.file} (${r.reason})`);
    }
  }

  console.log(`\n  Summary: ${toDelete.length} deleted, ${toSkip.length} kept`);
}

function archiveTasks(maxAgeDays: number, dryRun: boolean, root: string = projectRoot): void {
  const tasksDir = path.join(root, "scratch", "tasks");
  const archiveDir = path.join(tasksDir, "archive");

  if (!fs.existsSync(tasksDir)) {
    console.log(`${CYAN}ℹ️  scratch/tasks/ does not exist — nothing to archive.${RESET}`);
    return;
  }

  const entries = fs.readdirSync(tasksDir).filter((f) => f.endsWith(".md") && f !== "README.md");
  if (entries.length === 0) {
    console.log(`${CYAN}ℹ️  No task files found in scratch/tasks/.${RESET}`);
    return;
  }

  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  const results: CleanupResult[] = [];

  for (const entry of entries) {
    const fullPath = path.join(tasksDir, entry);
    const stat = fs.statSync(fullPath);
    const content = fs.readFileSync(fullPath, "utf-8");
    const isDone = /status:\s*done/i.test(content) || /##\s*done/i.test(content);
    const isOld = stat.mtimeMs < cutoff;

    if (isDone || isOld) {
      const reason = isDone ? "status: done" : `${Math.floor((Date.now() - stat.mtimeMs) / 86400000)} days old`;
      results.push({ action: "archive", file: entry, reason });
    } else {
      results.push({ action: "skip", file: entry, reason: "active task" });
    }
  }

  const toArchive = results.filter((r) => r.action === "archive");
  const toSkip = results.filter((r) => r.action === "skip");

  if (dryRun) {
    console.log(`${CYAN}=== DRY RUN: tasks/ archive (>${maxAgeDays} days or status: done) ===${RESET}\n`);
  } else {
    console.log(`${CYAN}=== Archiving completed tasks (>${maxAgeDays} days or status: done) ===${RESET}\n`);
    if (toArchive.length > 0 && !dryRun) {
      fs.mkdirSync(archiveDir, { recursive: true });
    }
  }

  if (toArchive.length > 0) {
    for (const r of toArchive) {
      const icon = dryRun ? `${YELLOW}[DRY]${RESET}` : `${CYAN}[ARC]${RESET}`;
      console.log(`  ${icon} ${r.file} (${r.reason})`);
      if (!dryRun) {
        fs.renameSync(path.join(tasksDir, r.file), path.join(archiveDir, r.file));
      }
    }
  }

  if (toSkip.length > 0) {
    console.log(`\n  ${toSkip.length} task(s) skipped:`);
    for (const r of toSkip) {
      console.log(`  ${GREEN}[KEEP]${RESET} ${r.file} (${r.reason})`);
    }
  }

  console.log(`\n  Summary: ${toArchive.length} archived, ${toSkip.length} kept`);
}

function main(): void {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  const tempIdx = args.indexOf("--temp");
  const archiveIdx = args.indexOf("--archive-tasks");
  const statusIdx = args.indexOf("--status");
  const daysIdx = args.indexOf("--days");

  const days = daysIdx >= 0 && args[daysIdx + 1] ? parseInt(args[daysIdx + 1], 10) : 7;

  if (args.length === 0 || statusIdx >= 0) {
    displayStatus();
    return;
  }

  if (tempIdx >= 0) {
    purgeTemp(days, dryRun);
    return;
  }

  if (archiveIdx >= 0) {
    archiveTasks(days, dryRun);
    return;
  }

  // Default: show help
  console.log(`
Usage: bun scripts/scratch-cleanup.ts <command> [options]

Commands:
  --status                Show scratch/ directory overview (default)
  --temp                  Purge temp/ files older than N days (default: 7)
  --archive-tasks         Archive completed/old task files (default: 30 days)

Options:
  --days <N>              Age threshold in days (default: 7 for --temp, 30 for --archive-tasks)
  --dry-run               Preview changes without executing
`);
}

if (import.meta.main) {
  main();
}

export { main, displayStatus, purgeTemp, archiveTasks, getDirStats };
