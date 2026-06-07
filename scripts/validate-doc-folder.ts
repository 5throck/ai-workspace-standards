#!/usr/bin/env bun
/**
 * Validate docs/ folder structure compliance
 * @version 1.0.0
 * Ensures required subdirectories exist in docs/ folder
 */

import fs from 'fs';
import path from 'path';

interface ValidationResult {
  success: boolean;
  docsExists: boolean;
  missingFolders: string[];
  presentFolders: string[];
}

// Required subdirectories in docs/
const REQUIRED_FOLDERS = [
  'constitution',
  'governance',
  'lifecycle',
];

// Optional subdirectories (checked but not required)
const OPTIONAL_FOLDERS = [
  'variant',
  'superpowers',
];

function validateDocsFolder(docsPath: string): ValidationResult {
  const result: ValidationResult = {
    success: false,
    docsExists: false,
    missingFolders: [],
    presentFolders: [],
  };

  // Check if docs/ directory exists
  if (!fs.existsSync(docsPath)) {
    return result;
  }

  result.docsExists = true;

  // Check required folders
  for (const folder of REQUIRED_FOLDERS) {
    const folderPath = path.join(docsPath, folder);
    if (fs.existsSync(folderPath) && fs.statSync(folderPath).isDirectory()) {
      result.presentFolders.push(folder);
    } else {
      result.missingFolders.push(folder);
    }
  }

  // Check optional folders (for reporting)
  for (const folder of OPTIONAL_FOLDERS) {
    const folderPath = path.join(docsPath, folder);
    if (fs.existsSync(folderPath) && fs.statSync(folderPath).isDirectory()) {
      result.presentFolders.push(folder);
    }
  }

  // Validation passes if all required folders exist
  result.success = result.missingFolders.length === 0;

  return result;
}

function main(): void {
  const workspaceRoot = process.cwd();
  const docsPath = path.join(workspaceRoot, 'docs');

  console.log('🔍 Validating docs/ folder structure...');
  console.log(`   Path: ${docsPath}`);
  console.log('');

  const result = validateDocsFolder(docsPath);

  if (!result.docsExists) {
    console.error('❌ docs/ directory does not exist');
    console.error('   Please create the docs/ directory structure');
    process.exit(1);
  }

  console.log('✅ docs/ directory exists');
  console.log('');

  // Report required folders
  console.log('Required subdirectories:');
  for (const folder of REQUIRED_FOLDERS) {
    if (result.presentFolders.includes(folder)) {
      console.log(`   ✅ docs/${folder}/ exists`);
    } else {
      console.log(`   ❌ docs/${folder}/ missing`);
    }
  }

  // Report optional folders
  const optionalPresent = OPTIONAL_FOLDERS.filter(f => result.presentFolders.includes(f));
  if (optionalPresent.length > 0) {
    console.log('');
    console.log('Optional subdirectories (present):');
    for (const folder of optionalPresent) {
      console.log(`   ℹ️  docs/${folder}/ exists`);
    }
  }

  console.log('');
  console.log('📊 Validation Summary:');
  console.log(`   Required folders present: ${result.presentFolders.filter(f => REQUIRED_FOLDERS.includes(f)).length}/${REQUIRED_FOLDERS.length}`);
  console.log(`   Missing required folders: ${result.missingFolders.length}`);

  if (result.missingFolders.length > 0) {
    console.log('');
    console.log('⚠️  Missing required folders:');
    for (const folder of result.missingFolders) {
      console.log(`   → docs/${folder}/`);
    }
    console.log('');
    console.log('Please create missing directories:');
    console.log('   mkdir -p docs/constitution docs/governance docs/lifecycle');
    process.exit(1);
  } else {
    console.log('');
    console.log('✅ All required docs/ subdirectories exist');
    process.exit(0);
  }
}

// Run validation
main();
