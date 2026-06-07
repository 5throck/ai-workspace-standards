/**
 * test-runner.ts — Test Runner for TypeScript Test Suites
 * @version 1.0.0
 */
import { execSync } from 'child_process';
import { readdirSync } from 'fs';
import { join } from 'path';

interface TestSuite {
  name: string;
  pattern: string;
  timeout: number;
  dir: string;
  ext: string;
}

const suites: TestSuite[] = [
  { name: 'unit', pattern: '*.test.ts', timeout: 30000, dir: 'tests/unit', ext: '.test.ts' },
  { name: 'integration', pattern: '*.test.ts', timeout: 120000, dir: 'tests', ext: '.test.ts' },
  { name: 'scenarios', pattern: '*', timeout: 300000, dir: 'tests/scenarios', ext: '' }
];

function getTestFiles(suite: TestSuite): string[] {
  const files: string[] = [];
  try {
    const entries = readdirSync(suite.dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && (suite.ext === '' || entry.name.endsWith(suite.ext))) {
        files.push(join(suite.dir, entry.name));
      }
    }
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      console.error(`Error reading directory ${suite.dir}: ${error.message}`);
    }
  }
  return files.sort();
}

export async function runTests(suiteName: string): Promise<boolean> {
  const suite = suites.find(s => s.name === suiteName);
  if (!suite) {
    console.error(`Available suites: ${suites.map(s => s.name).join(', ')}`);
    throw new Error(`Suite not found: ${suiteName}`);
  }

  const files = getTestFiles(suite);

  if (files.length === 0) {
    console.log(`No tests found for suite: ${suiteName}`);
    return true;
  }

  console.log(`Running ${suiteName} suite (${files.length} test files)...`);

  try {
    for (const file of files) {
      console.log(`  Running: ${file}`);
      execSync('bun', ['test', file], {
        stdio: 'inherit',
        timeout: suite.timeout
      });
    }
    console.log(`✓ ${suiteName} suite passed`);
    return true;
  } catch (error: any) {
    console.error(`✗ Test failed: ${error.message}`);
    return false;
  } finally {
    try {
      import('node:fs').then(fs => {
        if (fs.existsSync('tests/.temp')) {
          fs.rmSync('tests/.temp', { recursive: true, force: true });
        }
      });
    } catch(e) {}
  }
}

// CLI entrypoint
const suiteName = process.argv[2] || 'integration';
runTests(suiteName).then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error(error.message);
  process.exit(1);
});
