#!/usr/bin/env bun
/**
 * variant-overlay-guard.ts — fail-closed exists-guard for variant-ization targets.
 *
 * Classifies the promotion target slot `templates/co-<name>/` BEFORE any write,
 * from the target's own variant.json when present. Shared by all three
 * enforcement points (design
 * docs/designs/2026-09-16-variant-ization-overlay-guard-design.md §3.2):
 *
 *   1. scripts/l3-to-variant-pipeline.ts (execute function, before Phase 1 —
 *      must precede the Phase 3.5 auto-fix, which can write into a live
 *      templates/<variant> when the L3 source lives under templates/)
 *   2. scripts/project-to-variant.ts (immediately after targetDir resolution,
 *      before the copy loop)
 *   3. scripts/helpers/generate-variant.ts (at the default templates/ output
 *      resolution — last line of defense for any future generateVariant caller)
 *
 * Classification (design §3.1):
 *
 *   | Target state                          | Behavior                                  |
 *   |---------------------------------------|-------------------------------------------|
 *   | Does not exist                        | Proceed (fresh promotion)                 |
 *   | Exists, variant.json missing/broken   | Hard refuse (reserved co-* namespace)     |
 *   | Exists, status stable/deprecated      | Hard refuse — NO bypass flag honors it    |
 *   | Exists, status beta/other pre-release | Refuse unless --overlay-variant           |
 *   | Explicit output outside templates/    | Exempt — destination named, not derived   |
 *
 * The explicit-output exemption protects the E2E harness pattern
 * (scripts/test-l3-to-variant-promotion.ts targets tests/.temp/).
 *
 * @version 1.0.0
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

/** Stable message prefix — tests and CLI assertions key on this string. */
export const OVERLAY_GUARD_PREFIX = 'OVERLAY GUARD';

/**
 * Terminal lifecycle statuses whose trees are the delivery lineage maintained
 * by upgrade-project for every scaffolded project. Hard refusal — no flag
 * honors it (design §3.3): an operator who truly needs to re-promote edits
 * `status` in the target's variant.json first (a small, reviewable git diff).
 */
export const TERMINAL_VARIANT_STATUSES = new Set(['stable', 'deprecated']);

/** Verdict actions returned by evaluateVariantOverlayTarget(). */
export type OverlayGuardAction = 'proceed' | 'refuse';

/**
 * Why the guard reached its verdict.
 * - `absent`              — target slot unoccupied; fresh promotion may proceed.
 * - `exempt-output`       — explicit output outside templates/; destination was
 *                           named by the caller, not derived from the variant
 *                           name, so the reserved-namespace rule does not apply.
 * - `overlay-authorized`  — target pre-existed with a pre-release status and the
 *                           caller passed the overlay authorization. The CALLER
 *                           owns snapshot/rollback in this mode (design §4.2) —
 *                           see scripts/helpers/rollback-partial-project.ts.
 * - `corrupt`             — target exists but variant.json is missing,
 *                           unparseable, or the target is not a directory.
 * - `terminal-status`     — target exists with status stable/deprecated.
 * - `overlay-not-authorized` — target exists with a pre-release status and no
 *                           overlay authorization was passed.
 */
export type OverlayGuardClassification =
  | 'absent'
  | 'exempt-output'
  | 'overlay-authorized'
  | 'corrupt'
  | 'terminal-status'
  | 'overlay-not-authorized';

export type OverlayGuardVerdict =
  | { action: 'proceed'; classification: 'absent' | 'exempt-output' | 'overlay-authorized'; targetDir: string }
  | { action: 'refuse'; classification: 'corrupt' | 'terminal-status' | 'overlay-not-authorized'; message: string; targetDir: string };

export interface OverlayGuardInput {
    /** Candidate output directory (resolved internally; may be relative). */
    targetDir: string;
    /** Workspace root — anchors the templates/ namespace and refusal messages. */
    workspaceRoot: string;
    /** True when the caller passed --overlay-variant (or the programmatic equivalent). */
    overlayAuthorized?: boolean;
    /** True when the output path was EXPLICITLY provided (vs derived from the variant name). */
    explicitOutput?: boolean;
}

/**
 * Classify the target slot. Pure read-only filesystem inspection — never writes.
 */
export function evaluateVariantOverlayTarget(input: OverlayGuardInput): OverlayGuardVerdict {
    const targetDir = resolve(input.targetDir);
    const workspaceRoot = resolve(input.workspaceRoot);
    const templatesDir = join(workspaceRoot, 'templates');
    const displayPath = relative(workspaceRoot, targetDir) || targetDir;

    // Explicit output OUTSIDE templates/ → guard does not apply: the destination
    // is named, not derived (the E2E harness relies on this). An explicit output
    // INSIDE templates/ is still a reserved-namespace slot and stays guarded.
    if (input.explicitOutput && !targetDir.startsWith(templatesDir + sep)) {
        return { action: 'proceed', classification: 'exempt-output', targetDir };
    }

    if (!existsSync(targetDir)) {
        return { action: 'proceed', classification: 'absent', targetDir };
    }

    // Target occupied — read the target's OWN variant.json to classify.
    let status: unknown;
    try {
        if (!statSync(targetDir).isDirectory()) {
            return refuseCorrupt(displayPath, targetDir, 'it is not a directory');
        }
        const raw = readFileSync(join(targetDir, 'variant.json'), 'utf-8');
        const parsed = JSON.parse(raw) as { status?: unknown };
        status = parsed?.status;
    } catch {
        return refuseCorrupt(displayPath, targetDir);
    }

    if (typeof status === 'string' && TERMINAL_VARIANT_STATUSES.has(status)) {
        return {
            action: 'refuse',
            classification: 'terminal-status',
            targetDir,
            message:
                `${OVERLAY_GUARD_PREFIX}: ${displayPath} exists with lifecycle status "${status}". ` +
                `Refusing to overwrite a ${status} variant template — no bypass flag honors this case, ` +
                `because a ${status} tree is the delivery lineage that upgrade-project maintains for ` +
                `every scaffolded project, and wholesale regeneration from a diverged project would ` +
                `destroy that lineage. To re-promote, edit "status" in the target's variant.json first ` +
                `(a small, reviewable git diff).`,
        };
    }

    // beta — or any other non-terminal value — is overlayable WITH explicit
    // authorization only (design §3.3): an authorized overlay destroys the
    // previous tree as a unit; per-file history lives in git, not on disk.
    const statusLabel = typeof status === 'string' ? status : 'missing';
    if (input.overlayAuthorized === true) {
        return { action: 'proceed', classification: 'overlay-authorized', targetDir };
    }
    return {
        action: 'refuse',
        classification: 'overlay-not-authorized',
        targetDir,
        message:
            `${OVERLAY_GUARD_PREFIX}: ${displayPath} exists with lifecycle status "${statusLabel}". ` +
            `Refusing to overwrite an existing pre-release variant template. Pass --overlay-variant ` +
            `to authorize the overlay: the previous tree is destroyed as a unit and per-file history ` +
            `lives in git, not on disk, so this is only available while the variant is unambiguously ` +
            `pre-release.`,
    };
}

function refuseCorrupt(displayPath: string, targetDir: string, detail?: string): OverlayGuardVerdict {
    return {
        action: 'refuse',
        classification: 'corrupt',
        targetDir,
        message:
            `${OVERLAY_GUARD_PREFIX}: ${displayPath} exists but its variant.json is missing or unparseable` +
            `${detail ? ` (${detail})` : ''}. The co-* template namespace is reserved — a corrupt or ` +
            `foreign directory must be resolved by a human (inspect or remove the directory manually); ` +
            `no flag honors this case.`,
    };
}
