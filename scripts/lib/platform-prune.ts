#!/usr/bin/env bun
// @version 1.0.0
// v1.0.0 (2026-10-10, eight-platform coverage — spec docs/designs/2026-10-10-eight-platform-coverage-design.md §3.3):
//           pruneUnselectedProfiles(): the union pruning rule used by new-project.ts §2.7.
//           Removes every unselected profile's PROFILE_OWNED_PATHS from a project dir.
/**
 * platform-prune.ts — union pruning for the platform profiles.
 *
 * Keeps the owned paths of every selected profile and removes every other
 * profile's owned paths. Shared files (AGENTS.md, skills/, .agents/) are never
 * owned by a profile, so they are never touched here.
 */
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { PLATFORM_PROFILES, PROFILE_OWNED_PATHS, type PlatformProfile } from './platforms.ts';

/** Remove unselected profiles' owned paths under projectDir. Returns the removed relative paths. */
export function pruneUnselectedProfiles(projectDir: string, selected: readonly PlatformProfile[]): string[] {
  const removed: string[] = [];
  for (const p of PLATFORM_PROFILES) {
    if (selected.includes(p)) continue;
    for (const rel of PROFILE_OWNED_PATHS[p]) {
      const abs = join(projectDir, rel);
      if (existsSync(abs)) {
        rmSync(abs, { recursive: true });
        removed.push(rel);
      }
    }
  }
  return removed;
}
