// @version 1.0.0
// v1.0.0 (T-20260916-011): platform-delivery awareness for prose validators.
//           validate-model-registry.ts read CODEX.md unconditionally, so any
//           project scaffolded without the codex platform (--platform
//           claude/antigravity strips CODEX.md and .codex/ in new-project.ts
//           §2.7; --platform all keeps them) failed its own audit with
//           "could not read CODEX.md". The codex prose target is deliverable
//           only when the codex platform actually reached the audited context:
//           a CODEX.md file OR a .codex/ directory.
//
// Import-safe: no I/O at import time — the caller supplies the existence
// predicate, so unit tests exercise the full decision logic without a
// filesystem.

/** Minimal shape a prose target needs for delivery classification. */
export interface ProseTargetRef {
  file: string;
  label: string;
}

export interface SkippedProseTarget {
  file: string;
  label: string;
  /** Machine-readable reason for the skip (surfaced in the validator note). */
  reason: string;
}

/**
 * True when the codex platform is delivered in the audited context:
 * a CODEX.md file or a .codex/ directory (either satisfies — ADR-0077 §10
 * keeps both in codex-primary profiles, and both are stripped together in
 * codex-opt-out profiles, so partial states are not expected but either
 * alone still means the platform reached the context).
 */
export function isCodexPlatformDelivered(
  codexMdExists: boolean,
  codexDirExists: boolean,
): boolean {
  return codexMdExists || codexDirExists;
}

/**
 * Partition prose targets into active (the referenced file can be read) and
 * skipped (platform not delivered in this context).
 *
 * Delivery rule: CODEX.md is the codex-platform prose target — skipped
 * (with the "codex platform not delivered" reason) when neither CODEX.md
 * nor .codex/ exists. Every other target is skipped when its own file is
 * absent. L0/L1 contexts, where every target file exists, are behaviorally
 * unchanged: everything lands in `active`.
 */
export function partitionProseTargetsByDelivery<T extends ProseTargetRef>(
  targets: readonly T[],
  exists: (relPath: string) => boolean,
): { active: T[]; skipped: SkippedProseTarget[] } {
  const active: T[] = [];
  const skipped: SkippedProseTarget[] = [];
  for (const target of targets) {
    if (target.file === 'CODEX.md') {
      if (isCodexPlatformDelivered(exists('CODEX.md'), exists('.codex'))) {
        active.push(target);
      } else {
        skipped.push({
          file: target.file,
          label: target.label,
          reason: 'codex platform not delivered',
        });
      }
      continue;
    }
    if (exists(target.file)) {
      active.push(target);
    } else {
      skipped.push({
        file: target.file,
        label: target.label,
        reason: 'file not present in this context',
      });
    }
  }
  return { active, skipped };
}
