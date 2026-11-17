/**
 * Unit tests for the .githooks/commit-msg COMMIT_BODY extraction pipeline
 * (T-20261116-002, spec docs/designs/2026-11-17-template-lifecycle-batch-design.md
 * §3 work item B, §3.2 O-8 default Option A, §3.3 test plan, §8 PR-2 acceptance).
 *
 * Defect: `sed '1,/^$/d'` cannot end a START,END range on the START line — the
 * END-match search begins on the line AFTER the start. On a message
 * "subj / blank / para one / blank / para two" the tail stream starts with the
 * blank after the subject (START), the range therefore ran to the SECOND blank
 * line and deleted the first body paragraph, leaving COMMIT_BODY "para two".
 * Effect surface: the hook's memory auto-log only (PURPOSE and the
 * DECISIONS/ISSUES greps); the commit itself is unaffected.
 *
 * Fix (O-8 default Option A): a portable awk filter that skips blanks only
 * BEFORE the first content line — sed `0,/re/` was rejected as unreliable on
 * macOS BSD sed in the design's testing, so its absence is pinned here too.
 *
 * The tests execute the REAL assignment extracted from the hook file (joined
 * across `\` continuations, so a re-format of the pipeline stays covered) —
 * not a copy that could drift. The full hook is not spawned: it appends to
 * memory/ and re-enters the language gate, which would mutate workspace state.
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..', '..');
const HOOK_PATH = join(ROOT, '.githooks', 'commit-msg');
const MIRROR_PATH = join(ROOT, 'templates', 'common', '.githooks', 'commit-msg');

/**
 * Extract the COMMIT_BODY=$(...) assignment from the hook source, joining
 * backslash-newline continuations into a single statement (the hook currently
 * keeps it on one line; joining keeps the test robust to a re-format).
 */
function extractCommitBodyPipeline(hookSource: string): string {
  const lines = hookSource.split('\n');
  const start = lines.findIndex((line) => line.startsWith('COMMIT_BODY='));
  expect(start).toBeGreaterThanOrEqual(0);
  let statement = '';
  for (let i = start; i < lines.length; i++) {
    if (lines[i].endsWith('\\')) {
      statement += `${lines[i].slice(0, -1)} `;
      continue;
    }
    statement += lines[i];
    break;
  }
  return statement;
}

/** Run the hook's real COMMIT_BODY pipeline against a fixture message. */
function commitBody(message: string): string {
  const pipeline = extractCommitBodyPipeline(readFileSync(HOOK_PATH, 'utf-8'));
  const dir = mkdtempSync(join(tmpdir(), 'commit-msg-hook-'));
  const msgFile = join(dir, 'COMMIT_EDITMSG');
  writeFileSync(msgFile, message);
  // COMMIT_MSG_FILE is set first, then the hook's own assignment runs, then
  // the body is printed verbatim ($(...) inside the hook strips trailing
  // newlines exactly as it does at commit time).
  const script = `COMMIT_MSG_FILE=${JSON.stringify(msgFile)}\n${pipeline}\nprintf '%s' "$COMMIT_BODY"\n`;
  const result = spawnSync('bash', ['-c', script], { encoding: 'utf-8', timeout: 10000 });
  expect(result.status).toBe(0);
  return result.stdout;
}

/** PURPOSE per hook: COMMIT_BODY's first line when a body exists. */
function purposeOf(body: string): string {
  return body === '' ? '' : body.split('\n')[0];
}

describe('commit-msg hook — pipeline shape (O-8 Option A pins)', () => {
  // Shape pins target the EXECUTABLE COMMIT_BODY statement (the comment above
  // it deliberately names the old defect, so whole-file matching would false-
  // positive on documentation).
  const pipeline = () => extractCommitBodyPipeline(readFileSync(HOOK_PATH, 'utf-8'));

  test('the defective sed range is gone from the executable pipeline', () => {
    expect(pipeline()).not.toMatch(/1,\/\^\$\/d/);
  });

  test('the awk leading-blank-skip filter is present', () => {
    expect(pipeline()).toContain("awk 'found {print; next} /^[[:space:]]*$/{next} {found=1; print}'");
  });

  test('comment stripping, per-line trim, and head -5 truncation are preserved', () => {
    expect(pipeline()).toContain("sed -e '/^#/d'");
    expect(pipeline()).toContain("sed 's/^[[:space:]]*//' | head -5");
  });

  test('the rejected BSD-sed alternative is not used', () => {
    expect(pipeline()).not.toMatch(/sed -e ['"]0,\//);
  });
});

describe('commit-msg hook — defect pin (design §3.3 reproduce / §8 PR-2)', () => {
  test('multi-paragraph body keeps BOTH paragraphs with the inner blank line', () => {
    const body = commitBody('subj\n\npara one\n\npara two\n');
    expect(body).toBe('para one\n\npara two');
  });

  test('memory PURPOSE is the real first paragraph, not "para two"', () => {
    const body = commitBody('subj\n\npara one\n\npara two\n');
    expect(purposeOf(body)).toBe('para one');
  });

  test('first paragraph with Why:/Issue: markers is now visible to the greps', () => {
    // §3.1 effect surface: markers in the first paragraph were invisible.
    const body = commitBody('fix: x\n\nWhy: the range end cannot match on the start line\n\npara two\n');
    expect(body.split('\n')[0]).toContain('Why:');
  });
});

describe('commit-msg hook — regression pins (design §3.3)', () => {
  test('git trailing comments are still stripped (before and inside the body)', () => {
    const body = commitBody('subj\n\n# Please enter the commit message\n# On branch main\n\npara one\n\n# comment tail\npara two\n');
    expect(body).toBe('para one\n\npara two');
  });

  test('comment-only body stays empty (no-body behavior unchanged)', () => {
    // COMMIT_BODY === '' sends PURPOSE to the conventional-commit case block.
    const body = commitBody('subj\n\n# Please enter the commit message\n');
    expect(body).toBe('');
    expect(purposeOf(body)).toBe('');
  });

  test('no body at all: empty COMMIT_BODY, case block path unchanged', () => {
    const body = commitBody('feat: x\n');
    expect(body).toBe('');
  });

  test('leading-whitespace body lines are still trimmed', () => {
    const body = commitBody('subj\n\n    indented para\n\ttabbed line\n');
    expect(body).toBe('indented para\ntabbed line');
  });

  test('head -5 truncation unchanged: six body lines keep exactly five', () => {
    const body = commitBody('subj\n\nl1\nl2\nl3\nl4\nl5\nl6\n');
    expect(body.split('\n')).toHaveLength(5);
    expect(body.split('\n')[4]).toBe('l5');
  });

  test('body of only blank lines yields empty COMMIT_BODY', () => {
    const body = commitBody('subj\n\n\n\n\n');
    expect(body).toBe('');
  });
});

describe('commit-msg hook — mirror parity (lifecycle-sync-audit Check G)', () => {
  test('templates/common/.githooks/commit-msg is byte-identical to root (CRLF-normalized)', () => {
    const normalize = (s: string) => s.replace(/\r\n/g, '\n');
    const root = normalize(readFileSync(HOOK_PATH, 'utf-8'));
    const mirror = normalize(readFileSync(MIRROR_PATH, 'utf-8'));
    expect(mirror).toBe(root);
  });
});
