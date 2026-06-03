#!/usr/bin/env bun
/**
 * verify-template-integrity.ts
 * @version 1.0.0
 *
 * Verify template integrity of existing projects.
 * Reads .template/INTEGRITY and .template-bootstrap.log, validates file hashes.
 *
 * Usage: bun scripts/verify-template-integrity.ts ./my-project
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { createHash } from 'crypto';

interface IntegrityReport {
  templateVersion: string;
  downloadTimestamp: string;
  archiveHash: string;
  userConfirmed: boolean;
  files: { [path: string]: string };
  status: 'VALID' | 'INVALID' | 'MISSING';
  missingFiles: string[];
  invalidFiles: string[];
}

interface IntegrityLog {
  'Template-Version'?: string;
  'Download-Timestamp'?: string;
  'Downloaded-From'?: string;
  'Archive-SHA256'?: string;
  'User-Confirmed'?: string;
}

function calculateSHA256(filePath: string): string {
  const content = readFileSync(filePath);
  return createHash('sha256').update(content).digest('hex').toLowerCase();
}

function parseINTEGRITYFile(filePath: string): { files: Map<string, string>, meta: IntegrityLog } {
  const content = readFileSync(filePath, 'utf-8');
  const files = new Map<string, string>();
  const meta: IntegrityLog = {};

  for (const line of content.split('\n')) {
    if (line.startsWith('#') || line.trim() === '') continue;

    if (line.includes(':')) {
      const [key, ...valueParts] = line.split(':');
      const value = valueParts.join(':').trim();
      meta[key.trim() as keyof IntegrityLog] = value;
    } else if (line.includes(',')) {
      const [path, hash] = line.split(',');
      if (path && hash) {
        files.set(path, hash.trim());
      }
    }
  }

  return { files, meta };
}

function parseBootstrapLog(filePath: string): IntegrityLog {
  const content = readFileSync(filePath, 'utf-8');
  const log: IntegrityLog = {};

  for (const line of content.split('\n')) {
    if (line.includes(':')) {
      const [key, ...valueParts] = line.split(':');
      const value = valueParts.join(':').trim();
      log[key.trim() as keyof IntegrityLog] = value;
    }
  }

  return log;
}

function verifyProject(projectPath: string): IntegrityReport {
  const integrityPath = join(projectPath, '.template', 'INTEGRITY');
  const logPath = join(projectPath, '.template-bootstrap.log');

  // Check if files exist
  if (!existsSync(integrityPath)) {
    return {
      templateVersion: 'unknown',
      downloadTimestamp: 'unknown',
      archiveHash: 'unknown',
      userConfirmed: false,
      files: {},
      status: 'MISSING',
      missingFiles: [],
      invalidFiles: [],
    };
  }

  // Parse files
  const { files, meta } = parseINTEGRITYFile(integrityPath);
  const log = existsSync(logPath) ? parseBootstrapLog(logPath) : {};

  const report: IntegrityReport = {
    templateVersion: meta['Template-Version'] || log['Template-Version'] || 'unknown',
    downloadTimestamp: meta['Download-Timestamp'] || log['Download-Timestamp'] || 'unknown',
    archiveHash: meta['Archive-SHA256'] || log['Archive-SHA256'] || 'unknown',
    userConfirmed: (meta['User-Confirmed'] || log['User-Confirmed']) === 'true',
    files: {},
    status: 'VALID',
    missingFiles: [],
    invalidFiles: [],
  };

  // Verify each file
  for (const [relativePath, expectedHash] of files.entries()) {
    const fullPath = join(projectPath, relativePath);

    if (!existsSync(fullPath)) {
      report.missingFiles.push(relativePath);
      continue;
    }

    const actualHash = calculateSHA256(fullPath);
    report.files[relativePath] = actualHash;

    if (actualHash !== expectedHash.toLowerCase()) {
      report.invalidFiles.push(relativePath);
    }
  }

  // Determine status
  if (report.missingFiles.length > 0 || report.invalidFiles.length > 0) {
    report.status = 'INVALID';
  }

  return report;
}

function colorLog(message: string, color: string = '\x1b[0m'): void {
  const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
  };
  process.stdout.write(`${colors[color as keyof typeof colors] || ''}${message}${colors.reset}\n`);
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    colorLog('Error: Project path required', 'red');
    console.log('Usage: bun scripts/verify-template-integrity.ts ./my-project');
    process.exit(1);
  }

  const projectPath = args[0];

  if (!existsSync(projectPath)) {
    colorLog(`Error: Project not found: ${projectPath}`, 'red');
    process.exit(1);
  }

  colorLog('=== Template Integrity Verification ===', 'cyan');
  colorLog(`Project: ${projectPath}`, 'cyan');
  console.log('');

  const report = verifyProject(projectPath);

  // Display results
  if (report.status === 'MISSING') {
    colorLog('Status: MISSING - No integrity data found', 'yellow');
    colorLog('This project may have been created with an older template version', 'yellow');
    process.exit(2);
  }

  colorLog(`✅ Template: ${report.templateVersion}`, 'green');
  colorLog(`✅ Downloaded: ${report.downloadTimestamp}`, 'green');
  colorLog(`✅ Archive SHA256: ${report.archiveHash}`, 'green');
  colorLog(`✅ User confirmed: ${report.userConfirmed}`, 'green');

  const totalFiles = Object.keys(report.files).length;
  const verifiedFiles = totalFiles - report.invalidFiles.length;

  colorLog(`✅ Integrity: ${report.status} (${verifiedFiles}/${totalFiles} files verified)`, 'green');

  if (report.missingFiles.length > 0) {
    colorLog('', 'reset');
    colorLog(`⚠️  Missing files (${report.missingFiles.length}):`, 'yellow');
    for (const file of report.missingFiles) {
      console.log(`   - ${file}`);
    }
  }

  if (report.invalidFiles.length > 0) {
    colorLog('', 'reset');
    colorLog(`❌ Invalid files (${report.invalidFiles.length}):`, 'red');
    for (const file of report.invalidFiles) {
      console.log(`   - ${file}`);
    }
    colorLog('', 'reset');
    colorLog('Status: FAILED', 'red');
    process.exit(1);
  }

  colorLog('', 'reset');
  colorLog('Status: PASSED', 'green');
  process.exit(0);
}

main();
