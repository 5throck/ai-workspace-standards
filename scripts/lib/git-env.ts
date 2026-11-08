// @version 1.0.0
// v1.0.0 (2026-11-09, spec docs/designs/2026-11-08-gw-tenant-loop-and-hardening-design.md):
//          git repo-redirection environment sanitizer. `git push` runs hooks (pre-push)
//          with GIT_DIR exported, pointing at the checkout's private git dir; every git
//          spawn that inherits it honors GIT_DIR over cwd-based repository discovery.
//          During the tenant-loop QA wave this had two verified symptoms (both
//          reproduced with `GIT_DIR=$(git rev-parse --git-dir) bun test`):
//            1. fixture `git init`/`add`/`commit` calls (tests/unit/workspace-hygiene.test.ts
//               makeFixtureRepo, tests/unit/mcp-upstream-tenant-identity.test.ts tenant()
//               harness) landed in the OUTER worktree repo — a rogue `initial` commit
//               appeared on the PR branch (2026-11-07 external-deps incident, same class);
//            2. scripts/check-workspace-hygiene.ts:53 inspected GIT_DIR's repo instead of
//               --root, breaking the "exit 1 fail-closed when the target is not a git
//               repo" contract (a pre-existing incident 2026-11-07 pattern: three fixture
//               verify/install failures under GIT_DIR, see tests/unit/external-deps-cli.test.ts).
//          One derivation, many callers (the scripts/lib/fleet.ts discipline): every
//          git spawn in the hygiene gate and the tenant-loop suites goes through
//          gitCleanEnv() so fixtures and gates target THEIR OWN cwd regardless of the
//          caller's hook environment. Identity/config vars (GIT_AUTHOR_*,
//          GIT_COMMITTER_*, GIT_CONFIG_GLOBAL/SYSTEM, GIT_TERMINAL_PROMPT, …) are kept —
//          only the vars that REDIRECT a git command to a different repository/object
//          store, or force a config file, are stripped.
//
// Stripped keys (git docs: repository/location overrides that survive cwd changes):
//   GIT_DIR                     — the repository path (defeats cwd discovery entirely)
//   GIT_WORK_TREE               — working-tree root relocation
//   GIT_INDEX_FILE              — index file relocation
//   GIT_OBJECT_DIRECTORY        — object store relocation
//   GIT_ALTERNATE_OBJECT_DIRECTORIES — extra object stores (borrowed-object leakage)
//   GIT_COMMON_DIR              — shared/per-worktree path relocation
//   GIT_CEILING_DIRECTORIES     — discovery boundary (changes upward search semantics)
//   GIT_NAMESPACE               — ref namespace scoping
//   GIT_CONFIG                  — forces an additional config FILE on every command

/**
 * Keys that redirect a git command away from cwd-based repository discovery, or
 * force a config file onto every invocation. Exported so validators and future
 * callers derive from one list instead of re-typing it.
 */
export const GIT_REDIRECT_ENV_KEYS = [
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_INDEX_FILE',
  'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_COMMON_DIR',
  'GIT_CEILING_DIRECTORIES',
  'GIT_NAMESPACE',
  'GIT_CONFIG',
] as const;

/**
 * Copy of `base ?? process.env` with the git repo-redirection vars removed.
 *
 * Spawn every fixture/gate git call with `env: gitCleanEnv()` so it operates on
 * ITS OWN cwd no matter what hook/CI context exported GIT_DIR (pre-push runs
 * `bun test` with GIT_DIR pointing at the checkout's private git dir). Pass a
 * `base` to layer overrides on a sanitized copy (`gitCleanEnv({ TZ: 'UTC' })`).
 * Only redirection keys are stripped — user identity, GIT_CONFIG_GLOBAL/SYSTEM
 * and the rest of the environment pass through unchanged.
 */
export function gitCleanEnv(base?: Record<string, string | undefined>): Record<string, string | undefined> {
  const source: Record<string, string | undefined> = base ?? (process.env as Record<string, string | undefined>);
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(source)) {
    if (GIT_REDIRECT_ENV_KEYS.includes(key as (typeof GIT_REDIRECT_ENV_KEYS)[number])) continue;
    out[key] = value;
  }
  return out;
}
