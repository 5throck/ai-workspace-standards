/**
 * Tests for templates/common/scripts/handbook/check-authoring.ts Check 11 —
 * the external-deps manifest-fed public-repo allowlist (design
 * docs/designs/2026-11-07-external-deps-standard-design.md §5.5, §7 "Unit —
 * Check 11"): a manifest repo WITH a recorded commit suppresses the
 * private-repo link/clone finding; WITHOUT a commit it does not.
 *
 * Runs the checker as a subprocess against a temp project (docs/*.html +
 * external-deps.json). No network.
 *
 * @version 1.1.0
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const CHECKER = path.resolve(import.meta.dir, '../../templates/common/scripts/handbook/check-authoring.ts');
let proj = '';

function run(): string {
  const r = Bun.spawnSync(['bun', CHECKER, '--project', proj], { stdout: 'pipe', stderr: 'pipe' });
  return r.stdout.toString() + r.stderr.toString();
}

function manifest(withCommit: boolean): void {
  const dep: Record<string, unknown> = { id: 'demo-tool', repo: 'https://github.com/example-org/demo-tool' };
  if (withCommit) dep.commit = '5e8856be0da8e6bc85c4aa28acc614478f7b7137';
  fs.writeFileSync(path.join(proj, 'external-deps.json'), JSON.stringify({ schema_version: 2, dependencies: [dep] }));
}

beforeEach(() => {
  proj = fs.mkdtempSync(path.join(os.tmpdir(), 'check11-'));
  fs.mkdirSync(path.join(proj, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(proj, 'docs', 'guide.html'),
    '<html><body><p>See <a href="https://github.com/example-org/demo-tool">demo-tool</a>.</p><pre>git clone https://github.com/example-org/demo-tool</pre></body></html>');
});
afterEach(() => fs.rmSync(proj, { recursive: true, force: true }));

describe('Check 11 manifest-fed allowlist', () => {
  test('without a manifest the repo is flagged', () => {
    const out = run();
    expect(out).toContain('private-repo-clone');
  });

  test('a manifest entry WITH a recorded commit suppresses the clone and link findings', () => {
    manifest(true);
    const out = run();
    expect(out).not.toContain('private-repo-clone');
    expect(out).not.toContain('private-repo-link');
  });

  test('a manifest entry WITHOUT a commit adds nothing', () => {
    manifest(false);
    expect(run()).toContain('private-repo-clone');
  });

  test('a malformed manifest adds nothing and does not crash the checker', () => {
    fs.writeFileSync(path.join(proj, 'external-deps.json'), '{ not json');
    expect(run()).toContain('private-repo-clone');
  });
});

describe('Check 11 public allowlist and URL-shape parsing', () => {
  function page(body: string): void {
    fs.writeFileSync(path.join(proj, 'docs', 'guide.html'), `<html><body>${body}</body></html>`);
  }

  test('built-in public repos (5throck/setup, hugohe3/ppt-master) are not flagged', () => {
    page(
      '<pre>git clone https://github.com/5throck/setup.git</pre>' +
        '<a href="https://github.com/hugohe3/ppt-master">ppt-master</a>',
    );
    const out = run();
    expect(out).not.toContain('private-repo-clone');
    expect(out).not.toContain('private-repo-link');
  });

  test('reserved github.com paths and subdomain URLs are not parsed as repositories', () => {
    page(
      '<a href="https://github.com/login/device">device</a>' +
        '<a href="https://cli.github.com/packages/githubcli-archive-keyring.gpg">key</a>',
    );
    expect(run()).not.toContain('private-repo-link');
  });

  test('an unknown repo is still flagged', () => {
    page('<a href="https://github.com/acme-corp/secret-tool">x</a>');
    expect(run()).toContain('private-repo-link');
    page('<pre>git clone https://github.com/acme-corp/secret-tool.git</pre>');
    expect(run()).toContain('private-repo-clone');
  });
});
