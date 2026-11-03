#!/usr/bin/env bun
// @version 1.0.0
/**
 * audit-hook-sweep.ts — templates audit-variant hook sweep core (audit.ts §28).
 *
 * Extracted from scripts/audit.ts (U-20261104-001) so the sweep's manifest
 * parsing and hook resolution are unit-testable without executing the full
 * audit pipeline. Behavior is a verbatim lift of the former inline §28 loop:
 * for every templates/co-* directory whose variant.json declares an
 * `audit-variant` entry under script_manifest.local, the declared hook path
 * (resolved relative to the template directory) is surfaced for an
 * exists-and-executes regression check.
 *
 * Contract:
 *  - Non-co-* entries and directories without variant.json are ignored.
 *  - A malformed variant.json is skipped silently (the schema checks elsewhere
 *    in audit.ts report it) — surfaced here only via `malformed` for tests.
 *  - script_manifest.local entries that are not `audit-variant` (or lack a
 *    string path) are ignored.
 */

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

export interface TemplateAuditHook {
    /** Template directory name (e.g. 'co-design'). */
    variant: string;
    /** Hook path exactly as declared in variant.json script_manifest.local. */
    declaredPath: string;
    /** Declared path resolved relative to the templates root. */
    resolvedPath: string;
}

export interface TemplateAuditHookSweep {
    hooks: TemplateAuditHook[];
    /** templates/co-X/variant.json files that could not be parsed. */
    malformed: string[];
}

export function collectTemplateAuditHooks(templatesDir: string): TemplateAuditHookSweep {
    const hooks: TemplateAuditHook[] = [];
    const malformed: string[] = [];
    for (const entry of readdirSync(templatesDir, { withFileTypes: true })) {
        if (!entry.isDirectory() || !entry.name.startsWith('co-')) continue;
        const variantJsonPath = join(templatesDir, entry.name, 'variant.json');
        if (!existsSync(variantJsonPath)) continue;
        let manifest: any;
        try {
            manifest = JSON.parse(readFileSync(variantJsonPath, 'utf-8'));
        } catch {
            malformed.push(variantJsonPath);
            continue; // malformed variant.json is reported by the schema checks
        }
        const local = manifest?.script_manifest?.local;
        if (!Array.isArray(local)) continue;
        for (const hook of local) {
            if (hook?.name !== 'audit-variant' || typeof hook.path !== 'string' || !hook.path) continue;
            hooks.push({
                variant: entry.name,
                declaredPath: hook.path,
                resolvedPath: join(templatesDir, entry.name, hook.path),
            });
        }
    }
    return { hooks, malformed };
}
