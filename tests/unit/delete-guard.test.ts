import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import {
  analyzeSegment,
  expandTilde,
  isAllowlisted,
  isInsideWorkspace,
  shortFlagsEnableRecursive,
  splitSegments,
} from '../../scripts/hooks/delete-guard';

const HOOK_PATH = join(import.meta.dir, '../../scripts/hooks/delete-guard.ts');
const REPO_ROOT = join(import.meta.dir, '../..');

interface HookResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

// ---------------------------------------------------------------------------
// Fixtures — a fake workspace root with the incident's directory shape
// ---------------------------------------------------------------------------

let WS_ROOT: string;
let STATE_DIR: string;
let TMP_FIXTURE: string; // real temp dir carrying a .git (tmpdir exemption test)
let PROJECTS_PATH: string;
const tempRoots: string[] = [];

beforeAll(() => {
  // The fixture workspace must NOT live under os.tmpdir(): the design
  // allowlists anything under os.tmpdir() outright (sanctioned fixture
  // area), so a tmpdir-resident fake workspace would exempt every target
  // and make the gating paths untestable. The repo's tests/ scratch area is
  // the sanctioned temporary location (AGENTS.md §7 File Organization);
  // removed in afterAll.
  WS_ROOT = mkdtempSync(join(REPO_ROOT, 'tests', '.dg-ws-'));
  STATE_DIR = mkdtempSync(join(tmpdir(), 'delete-guard-state-'));
  tempRoots.push(WS_ROOT, STATE_DIR);

  // The incident shape: Projects/ holding a real checkout with .git
  PROJECTS_PATH = join(WS_ROOT, 'Projects');
  mkdirSync(join(PROJECTS_PATH, 'co-x', '.git'), { recursive: true });

  // Allowlisted targets: node_modules clean, dist with .git beneath (depth 2)
  mkdirSync(join(WS_ROOT, 'node_modules'), { recursive: true });
  mkdirSync(join(WS_ROOT, 'dist', 'pkg', '.git'), { recursive: true });

  // Real temp dir with .git — proves os.tmpdir() exemption skips the re-check
  TMP_FIXTURE = mkdtempSync(join(tmpdir(), 'delete-guard-tmp-'));
  mkdirSync(join(TMP_FIXTURE, '.git'), { recursive: true });
  tempRoots.push(TMP_FIXTURE);
});

afterAll(() => {
  while (tempRoots.length) {
    rmSync(tempRoots.pop()!, { recursive: true, force: true });
  }
});

/**
 * Spawn the delete-guard hook with the given stdin payload, platform flag,
 * and extra env. The fixture workspace root and marker state dir are injected
 * via env so every case runs against isolated fixtures; ALLOW_RECURSIVE_DELETE
 * is scrubbed unless a test explicitly sets it.
 */
function runHook(
  payloadObj: Record<string, unknown>,
  opts: { platform?: 'gemini'; extraEnv?: Record<string, string> } = {},
): HookResult {
  const env: Record<string, string | undefined> = { ...process.env };
  delete env.ALLOW_RECURSIVE_DELETE;
  env.CLAUDE_PROJECT_DIR = WS_ROOT;
  env.DELETE_GUARD_STATE_DIR = STATE_DIR;
  Object.assign(env, opts.extraEnv);

  const result = spawnSync(
    'bun',
    [HOOK_PATH, ...(opts.platform ? ['--platform', opts.platform] : [])],
    {
      input: JSON.stringify(payloadObj),
      encoding: 'utf-8',
      timeout: 15000,
      cwd: REPO_ROOT,
      env: env as NodeJS.ProcessEnv,
    },
  );
  return {
    exitCode: result.status ?? -1,
    stdout: (result.stdout as string) || '',
    stderr: (result.stderr as string) || '',
  };
}

function payload(command: string, sessionId = 'sess-test'): Record<string, unknown> {
  return {
    session_id: sessionId,
    hook_event_name: 'PreToolUse',
    tool_name: 'Bash',
    tool_input: { command },
  };
}

function markerFile(sessionId: string): string {
  return join(STATE_DIR, `${sessionId}.json`);
}

// ---------------------------------------------------------------------------
// Detection matrix (design §7 fixtures)
// ---------------------------------------------------------------------------

describe('delete-guard hook — detection', () => {
  test('incident command `rm -rf Projects` (claude) — ask, exit 0, protocol named', () => {
    const r = runHook(payload('rm -rf Projects'));
    expect(r.exitCode).toBe(0);
    const parsed = JSON.parse(r.stdout.trim());
    expect(parsed.decision).toBe('ask');
    expect(parsed.reason).toContain('[DELETE-GUARD]');
    expect(parsed.reason).toContain(realpathSync(PROJECTS_PATH));
    expect(parsed.reason).toContain('ALLOW_RECURSIVE_DELETE');
    expect(parsed.reason).toContain('dry-run');
  });

  test('incident command (gemini) — deny, exit 2', () => {
    const r = runHook(payload('rm -rf Projects'), { platform: 'gemini' });
    expect(r.exitCode).toBe(2);
    const parsed = JSON.parse(r.stdout.trim());
    expect(parsed.decision).toBe('deny');
    expect(parsed.reason).toContain('[DELETE-GUARD]');
  });

  test('compound forms gate the delete segment', () => {
    for (const cmd of [
      'cd /tmp && rm -rf Projects',
      'echo hi; rm -r Projects',
      'cat file | rm --recursive -f Projects',
      'bun test\nrm -R Projects',
    ]) {
      const r = runHook(payload(cmd));
      expect(r.exitCode).toBe(0);
      const parsed = JSON.parse(r.stdout.trim());
      expect(parsed.decision).toBe('ask');
    }
  });

  test('flag permutations gate: -fr, -R, --recursive, -r, -fR', () => {
    for (const cmd of [
      'rm -fr Projects',
      'rm -R Projects',
      'rm --recursive Projects',
      'rm -r Projects',
      'rm -fR Projects',
    ]) {
      const parsed = JSON.parse(runHook(payload(cmd)).stdout.trim());
      expect(parsed.decision).toBe('ask');
    }
  });

  test('trash verbs gate: trash, trash-put', () => {
    for (const cmd of ['trash Projects', 'trash-put Projects']) {
      const parsed = JSON.parse(runHook(payload(cmd)).stdout.trim());
      expect(parsed.decision).toBe('ask');
    }
  });

  test('workspace root itself (`rm -rf .`) is gated', () => {
    const parsed = JSON.parse(runHook(payload('rm -rf .')).stdout.trim());
    expect(parsed.decision).toBe('ask');
    expect(parsed.reason).toContain(realpathSync(WS_ROOT));
  });

  test('non-recursive rm is not gated (silent pass)', () => {
    for (const cmd of ['rm -f Projects/file.txt', 'rm Projects/co-x/README.md']) {
      const r = runHook(payload(cmd));
      expect(r.exitCode).toBe(0);
      expect(r.stdout.trim()).toBe('');
    }
  });

  test('v2 deferral: git clean / find -delete are not gated', () => {
    for (const cmd of ['git clean -fd Projects', 'find Projects -delete']) {
      const r = runHook(payload(cmd));
      expect(r.exitCode).toBe(0);
      expect(r.stdout.trim()).toBe('');
    }
  });
});

// ---------------------------------------------------------------------------
// Allowlist + .git suppression
// ---------------------------------------------------------------------------

describe('delete-guard hook — allowlist', () => {
  test('rm -rf node_modules (no .git beneath) — allowed, silent pass', () => {
    const r = runHook(payload('rm -rf node_modules'));
    expect(r.exitCode).toBe(0);
    expect(r.stdout.trim()).toBe('');
  });

  test('allowlist segment matching is case-sensitive: rm -rf Dist is gated', () => {
    const parsed = JSON.parse(runHook(payload('rm -rf Dist')).stdout.trim());
    expect(parsed.decision).toBe('ask');
  });

  test('.git beneath an allowlisted target suppresses the bypass — gated', () => {
    const r = runHook(payload('rm -rf dist'));
    expect(r.exitCode).toBe(0);
    const parsed = JSON.parse(r.stdout.trim());
    expect(parsed.decision).toBe('ask');
    expect(parsed.reason).toContain('suppressed');
    expect(parsed.reason).toContain(realpathSync(join(WS_ROOT, 'dist')));
  });

  test('os.tmpdir() targets are allowed even with .git beneath (re-check exempt)', () => {
    const r = runHook(payload(`rm -rf ${TMP_FIXTURE}`));
    expect(r.exitCode).toBe(0);
    expect(r.stdout.trim()).toBe('');
  });

  test('outside-workspace target — no opinion (silent pass)', () => {
    const r = runHook(payload('rm -rf /dg-no-such-target-anywhere'));
    expect(r.exitCode).toBe(0);
    expect(r.stdout.trim()).toBe('');
  });

  test('tilde operand expands to home (outside fixture workspace) — silent pass', () => {
    const r = runHook(payload('rm -rf ~/dg-no-such-home-target'));
    expect(r.exitCode).toBe(0);
    expect(r.stdout.trim()).toBe('');
  });

  test('redirect targets do not corrupt gating: allowlisted cleanup with redirects passes', () => {
    // `> /dev/null` and `2>&1` must not turn into bogus gated operands —
    // the operands are exactly [node_modules], allowlisted, no .git beneath.
    const r = runHook(payload('rm -rf node_modules > /dev/null 2>&1'));
    expect(r.exitCode).toBe(0);
    expect(r.stdout.trim()).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Marker protocol (dry-run-list-first escape)
// ---------------------------------------------------------------------------

describe('delete-guard hook — marker protocol', () => {
  test('listing records a marker; delete downgrades (claude ask-ack, gemini allow)', () => {
    // 1. The dry-run listing writes the session marker.
    const listing = runHook(payload('ls -la Projects', 'sess-marker'));
    expect(listing.exitCode).toBe(0);
    expect(existsSync(markerFile('sess-marker'))).toBe(true);
    const marker = JSON.parse(readFileSync(markerFile('sess-marker'), 'utf-8')) as {
      entries: { resolvedPath: string; at: number }[];
    };
    expect(marker.entries.some((e) => e.resolvedPath === realpathSync(PROJECTS_PATH))).toBe(true);

    // 2. Claude: still ask, but the reason acknowledges the recorded listing.
    const claude = runHook(payload('rm -rf Projects', 'sess-marker'));
    expect(claude.exitCode).toBe(0);
    const claudeParsed = JSON.parse(claude.stdout.trim());
    expect(claudeParsed.decision).toBe('ask');
    expect(claudeParsed.reason).toContain('recorded');

    // 3. Gemini: valid marker downgrades deny → allow (Manual approval supplies
    //    the human confirmation there).
    const gemini = runHook(payload('rm -rf Projects', 'sess-marker'), { platform: 'gemini' });
    expect(gemini.exitCode).toBe(0);
    expect(gemini.stdout.trim()).toBe('');
  });

  test('marker is per-target and per-session', () => {
    // Listing Projects does not cover Projects/co-x.
    runHook(payload('ls -la Projects', 'sess-scoped'));
    const r = runHook(payload('rm -rf Projects/co-x', 'sess-scoped'), { platform: 'gemini' });
    expect(r.exitCode).toBe(2);
    expect(JSON.parse(r.stdout.trim()).decision).toBe('deny');

    // A different session has no marker at all.
    const other = runHook(payload('rm -rf Projects', 'sess-other'), { platform: 'gemini' });
    expect(other.exitCode).toBe(2);
  });

  test('stale marker (> 30 min) does not downgrade', () => {
    writeFileSync(
      markerFile('sess-stale'),
      JSON.stringify({
        entries: [{ resolvedPath: realpathSync(PROJECTS_PATH), at: Date.now() - 31 * 60 * 1000 }],
      }),
      'utf-8',
    );
    const r = runHook(payload('rm -rf Projects', 'sess-stale'), { platform: 'gemini' });
    expect(r.exitCode).toBe(2);
  });

  test('listing verb coverage: find -maxdepth / du -s / stat / tree record; du without -s does not', () => {
    for (const cmd of ['find Projects -maxdepth 1', 'du -s Projects', 'stat Projects', 'tree Projects']) {
      const sid = `sess-${cmd.split(' ')[0]}`;
      const listing = runHook(payload(cmd, sid));
      expect(listing.exitCode).toBe(0);
      const marker = JSON.parse(readFileSync(markerFile(sid), 'utf-8')) as {
        entries: { resolvedPath: string }[];
      };
      expect(marker.entries.some((e) => e.resolvedPath === realpathSync(PROJECTS_PATH))).toBe(true);
    }
    // `du Projects` without -s is not the protocol's bounded listing.
    runHook(payload('du Projects', 'sess-du-bare'));
    const r = runHook(payload('rm -rf Projects', 'sess-du-bare'), { platform: 'gemini' });
    expect(r.exitCode).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Escape hatch
// ---------------------------------------------------------------------------

describe('delete-guard hook — ALLOW_RECURSIVE_DELETE=1', () => {
  test('env hatch bypasses the gate (claude)', () => {
    const r = runHook(payload('rm -rf Projects'), {
      extraEnv: { ALLOW_RECURSIVE_DELETE: '1' },
    });
    expect(r.exitCode).toBe(0);
    expect(r.stdout.trim()).toBe('');
  });

  test('env hatch bypasses the gate (gemini)', () => {
    const r = runHook(payload('rm -rf Projects'), {
      platform: 'gemini',
      extraEnv: { ALLOW_RECURSIVE_DELETE: '1' },
    });
    expect(r.exitCode).toBe(0);
    expect(r.stdout.trim()).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Fail-open posture
// ---------------------------------------------------------------------------

describe('delete-guard hook — fail-open', () => {
  function runRaw(stdin: string): HookResult {
    const env: Record<string, string | undefined> = { ...process.env };
    delete env.ALLOW_RECURSIVE_DELETE;
    env.CLAUDE_PROJECT_DIR = WS_ROOT;
    env.DELETE_GUARD_STATE_DIR = STATE_DIR;
    const result = spawnSync('bun', [HOOK_PATH], {
      input: stdin,
      encoding: 'utf-8',
      timeout: 15000,
      cwd: REPO_ROOT,
      env: env as NodeJS.ProcessEnv,
    });
    return {
      exitCode: result.status ?? -1,
      stdout: (result.stdout as string) || '',
      stderr: (result.stderr as string) || '',
    };
  }

  test('malformed JSON — exit 0, silent', () => {
    const r = runRaw('{not valid json');
    expect(r.exitCode).toBe(0);
    expect(r.stdout.trim()).toBe('');
  });

  test('empty stdin — exit 0, silent', () => {
    const r = runRaw('');
    expect(r.exitCode).toBe(0);
    expect(r.stdout.trim()).toBe('');
  });

  test('missing tool_input / missing command / non-string command — exit 0, silent', () => {
    for (const raw of ['{}', '{"tool_input":{}}', '{"tool_input":{"command":123}}']) {
      const r = runRaw(raw);
      expect(r.exitCode).toBe(0);
      expect(r.stdout.trim()).toBe('');
    }
  });
});

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

describe('delete-guard pure helpers', () => {
  test('splitSegments splits on && || ; | newline and trims', () => {
    expect(splitSegments('cd x && rm -rf y')).toEqual(['cd x', 'rm -rf y']);
    expect(splitSegments('foo; rm -r bar')).toEqual(['foo', 'rm -r bar']);
    expect(splitSegments('a || b | c\nd')).toEqual(['a', 'b', 'c', 'd']);
    expect(splitSegments('plain command')).toEqual(['plain command']);
    expect(splitSegments('   ')).toEqual([]);
  });

  test('shortFlagsEnableRecursive covers combined flag bundles (rm-like semantics)', () => {
    expect(shortFlagsEnableRecursive('-r')).toBe(true);
    expect(shortFlagsEnableRecursive('-R')).toBe(true);
    expect(shortFlagsEnableRecursive('-fr')).toBe(true);
    expect(shortFlagsEnableRecursive('-Rf')).toBe(true);
    expect(shortFlagsEnableRecursive('-f')).toBe(false);
    expect(shortFlagsEnableRecursive('--recursive')).toBe(false); // double-dash handled separately
    // A single-dash token is read as a flag bundle, matching rm's own
    // parsing — the documented heuristic's known cost.
    expect(shortFlagsEnableRecursive('-project')).toBe(true);
  });

  test('analyzeSegment: env prefix, redirects, and listing verbs', () => {
    expect(analyzeSegment('FOO=1 rm -rf x')).toEqual({
      isRecursiveDelete: true,
      deleteOperands: ['x'],
      isListing: false,
      listingOperands: [],
    });
    expect(analyzeSegment('rm -rf node_modules > /dev/null 2>&1').deleteOperands).toEqual(['node_modules']);
    expect(analyzeSegment('rm Projects').isRecursiveDelete).toBe(false);
    expect(analyzeSegment('trash-put x').deleteOperands).toEqual(['x']);
    expect(analyzeSegment('find Projects -maxdepth 1')).toEqual({
      isRecursiveDelete: false,
      deleteOperands: [],
      isListing: true,
      listingOperands: ['Projects'],
    });
    expect(analyzeSegment('find Projects -delete').isListing).toBe(false);
    expect(analyzeSegment('du -s Projects').listingOperands).toEqual(['Projects']);
    expect(analyzeSegment('du Projects').isListing).toBe(false);
  });

  test('analyzeSegment: transparent prefixes no longer bypass detection (T-20261106-005 item 1)', () => {
    const expectDelete = (cmd: string, operands: string[]) => {
      const r = analyzeSegment(cmd);
      expect(r.isRecursiveDelete).toBe(true);
      expect(r.deleteOperands).toEqual(operands);
    };
    expectDelete('sudo rm -rf Projects', ['Projects']);
    expectDelete('env rm -rf Projects', ['Projects']);
    expectDelete('nice rm -rf Projects', ['Projects']);
    expectDelete('xargs rm -rf Projects', ['Projects']);
    expectDelete('nohup rm -rf Projects', ['Projects']);
    expectDelete('sudo env rm -rf Projects', ['Projects']);
    expectDelete('FOO=1 sudo rm -rf Projects', ['Projects']);
    // negatives: benign prefixed reads stay unflagged
    expect(analyzeSegment('sudo ls Projects').isRecursiveDelete).toBe(false);
    expect(analyzeSegment('env grep -r x Projects').isRecursiveDelete).toBe(false);
    expect(analyzeSegment('nice du -s Projects').isListing).toBe(true);
  });

  test('expandTilde expands ~ and ~/...', () => {
    expect(expandTilde('~')).not.toBe('~');
    expect(expandTilde('~/x')).toBe(join(expandTilde('~'), 'x'));
    expect(expandTilde('/abs/path')).toBe('/abs/path');
    expect(expandTilde('relative')).toBe('relative');
  });

  test('isInsideWorkspace boundary semantics', () => {
    const root = '/ws';
    expect(isInsideWorkspace(root, '/ws')).toBe(true);
    expect(isInsideWorkspace(root, join(root, 'x'))).toBe(true);
    expect(isInsideWorkspace(root, '/ws2')).toBe(false);
    expect(isInsideWorkspace(root, '/etc')).toBe(false);
  });

  test('isAllowlisted: segment match relative to root, never the root itself', () => {
    const root = sep === '/' ? '/ws' : 'C:\\ws';
    expect(isAllowlisted(root, join(root, 'node_modules'))).toBe(true);
    expect(isAllowlisted(root, join(root, 'pkg', 'dist'))).toBe(true);
    expect(isAllowlisted(root, join(root, 'Projects'))).toBe(false);
    expect(isAllowlisted(root, join(root, 'distx'))).toBe(false);
    expect(isAllowlisted(root, root)).toBe(false);
    expect(isAllowlisted(root, '/outside/node_modules')).toBe(false);
  });
});
