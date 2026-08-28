/**
 * Evidence Validator Library
 *
 * Hand-rolled JSON Schema draft-07 subset validator for Safety OS evidence
 * records (extracted from scripts/co-safety/safety-audit.ts v4.5.0 — behavior-neutral).
 * Supports exactly the keywords used by the evidence-model schemas: $ref,
 * type, required, properties, enum, pattern, format (date/date-time),
 * minItems, items. Unknown keywords are ignored. No external dependencies.
 *
 * Error handling is sink-based: every exported function receives the caller's
 * `errors` array as its final parameter and appends human-readable
 * `<rel>: <message>` strings to it. Callers own their error sink.
 *
 * External $ref documents are memoized in module state keyed by absolute
 * path, so refs resolve across multiple schema roots within one process run
 * (e.g. several bucket schemas sharing common.schema.json load it once).
 *
 * @version 1.0.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Resolve a JSON pointer (RFC 6901) against a document.
 * Returns undefined when traversal walks into a non-object node.
 */
export function walkJsonPointer(doc: any, pointer: string): any {
    let node = doc;
    for (const segment of pointer.split('/').filter(s => s.length > 0)) {
        if (node == null || typeof node !== 'object') return undefined;
        node = node[segment.replace(/~1/g, '/').replace(/~0/g, '~')];
    }
    return node;
}

// Memoized external-$ref document cache, keyed by absolute path. Load
// failures are memoized as null AND reported exactly once per target file,
// so repeated lookups of a broken ref never duplicate error messages.
const loadedRefDocs = new Map<string, any>();
const reportedRefLoadFailures = new Set<string>();

/**
 * Resolve an external $ref ("<file>#/<pointer>") against baseDir and return
 * the referenced schema node (or whole document when no pointer is given).
 * Returns null for internal refs (caller resolves those against rootDoc).
 * Unreadable/unparsable targets are reported once into `errors`.
 */
export function resolveRefSchema(ref: string, baseDir: string, errors: string[]): any {
    const [filePart, pointer] = ref.split('#');
    if (!filePart) {
        // Internal ref — resolved against the root schema being validated,
        // handled by the caller; external resolution never reaches here.
        return null;
    }
    const abs = path.resolve(baseDir, filePart);
    if (!loadedRefDocs.has(abs)) {
        try {
            loadedRefDocs.set(abs, JSON.parse(fs.readFileSync(abs, 'utf-8')));
        } catch (e: any) {
            loadedRefDocs.set(abs, null);
            if (!reportedRefLoadFailures.has(abs)) {
                reportedRefLoadFailures.add(abs);
                const relDisplay = path.relative(process.cwd(), abs).replace(/\\/g, '/');
                errors.push(`${relDisplay}: cannot load $ref target - ${e.message}`);
            }
        }
    }
    const doc = loadedRefDocs.get(abs);
    return pointer ? walkJsonPointer(doc, pointer) : doc;
}

export interface RecordValidationCtx {
    /** Display path of the record file, used to prefix every message. */
    rel: string;
    /** Instance path within the record ('$', '.field', '[0]', ...). */
    path: string;
    /** Root schema document — internal refs are resolved against it. */
    rootDoc: any;
    /** Directory external $ref file paths are resolved against. */
    baseDir: string;
}

/**
 * Validate a record value against a draft-07 subset schema, appending
 * `<rel>: <message>` findings to `errors`. Recurses through $ref chains
 * (depth-capped at 16), objects, arrays, and string constraints.
 */
export function validateRecordValue(value: any, schema: any, ctx: RecordValidationCtx, errors: string[]): void {
    // Resolve $ref chains (e.g. finding.schema.json -> common.schema.json#/definitions/x)
    let hops = 0;
    while (schema && schema.$ref) {
        if (++hops > 16) {
            errors.push(`${ctx.rel}: ${ctx.path} exceeds $ref resolution depth (possible circular $ref)`);
            return;
        }
        const [filePart, pointer] = schema.$ref.split('#');
        if (!filePart) {
            schema = pointer ? walkJsonPointer(ctx.rootDoc, pointer) : ctx.rootDoc;
        } else {
            schema = resolveRefSchema(schema.$ref, ctx.baseDir, errors);
        }
    }
    if (!schema || typeof schema !== 'object') return;

    if (schema.type === 'string') {
        if (typeof value !== 'string') {
            errors.push(`${ctx.rel}: ${ctx.path} must be a string`);
            return;
        }
        if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
            errors.push(`${ctx.rel}: ${ctx.path} has invalid value '${value}' (allowed: ${schema.enum.join(', ')})`);
        }
        if (schema.pattern && !(new RegExp(schema.pattern)).test(value)) {
            errors.push(`${ctx.rel}: ${ctx.path} does not match pattern '${schema.pattern}'`);
        }
        if (schema.format === 'date' && !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) {
            errors.push(`${ctx.rel}: ${ctx.path} is not an ISO date (YYYY-MM-DD)`);
        }
        if (schema.format === 'date-time' && !/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}/.test(value)) {
            errors.push(`${ctx.rel}: ${ctx.path} is not an ISO date-time`);
        }
    } else if (schema.type === 'array') {
        if (!Array.isArray(value)) {
            errors.push(`${ctx.rel}: ${ctx.path} must be an array`);
            return;
        }
        if (typeof schema.minItems === 'number' && value.length < schema.minItems) {
            errors.push(`${ctx.rel}: ${ctx.path} must have at least ${schema.minItems} item(s)`);
        }
        if (schema.items) {
            value.forEach((item, i) =>
                validateRecordValue(item, schema.items, { ...ctx, path: `${ctx.path}[${i}]` }, errors));
        }
    } else if (schema.type === 'object') {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            errors.push(`${ctx.rel}: ${ctx.path} must be an object`);
            return;
        }
        for (const req of schema.required || []) {
            if (!(req in value)) {
                errors.push(`${ctx.rel}: missing required field '${req}'`);
            }
        }
        for (const [key, sub] of Object.entries(schema.properties || {})) {
            if (key in value) {
                validateRecordValue(value[key], sub, { ...ctx, path: `${ctx.path}.${key}` }, errors);
            }
        }
    }
}
