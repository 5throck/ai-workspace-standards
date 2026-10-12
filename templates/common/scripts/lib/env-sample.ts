// @version 1.0.0
// env-sample.ts — Country-scoped env block pruning AND project-key-preserving merge for
// .env.sample (ADR-0057/0058 + ENV_SAMPLE SYNC v1.23.0).
//
// Shared by the scaffold-time CLI (scripts/helpers/prune-country-scoped-assets.ts) and the
// upgrade path (scripts/upgrade-project.ts ENV_SAMPLE SYNC pass) so the two cannot drift:
// both must agree on the `# >>> country-scoped:<CODE>` / `# <<< country-scoped:<CODE>`
// marker grammar and the keep/drop decision, or an upgrade re-injects blocks the scaffold
// pruned (or vice versa). Pure string transforms — no filesystem access.

export interface EnvBlockPruneResult {
  /** Pruned content; identical to the input when nothing was pruned or markers are unbalanced. */
  output: string;
  /** Country codes of the removed blocks, in file order (empty when untouched). */
  pruned: string[];
  /** Diagnostic messages for unbalanced/corrupt marker structures. */
  warnings: string[];
  /** True when markers are unbalanced — the file was left unchanged; callers must not write `output`. */
  unbalanced: boolean;
}

/**
 * Remove `# >>> country-scoped:<CODE>` … `# <<< country-scoped:<CODE>` blocks whose
 * registered country does not match `country`. `country: 'none'` (or '') prunes ALL
 * blocks (region-neutral posture). Unbalanced markers leave the content unchanged —
 * scaffold-time safety contract: never destroy a file when the parser is in doubt.
 */
export function pruneCountryScopedEnvBlocks(content: string, country: string): EnvBlockPruneResult {
  const lines = content.split('\n');
  const output: string[] = [];
  const pruned: string[] = [];
  const warnings: string[] = [];
  let inBlock = false;
  let currentBlockCode: string | null = null;
  let blockStartLine = -1;
  let blockLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const openMatch = line.match(/^# >>>\s*country-scoped:([A-Z]{2,4})/);
    const closeMatch = line.match(/^# <<<\s*country-scoped:([A-Z]{2,4})/);

    if (openMatch) {
      if (inBlock) {
        warnings.push(`Unbalanced marker at line ${i + 1}: nested opening marker without closing previous block. File left unchanged.`);
        return { output: content, pruned: [], warnings, unbalanced: true };
      }
      inBlock = true;
      currentBlockCode = openMatch[1];
      blockStartLine = i;
      blockLines = [line];
    } else if (closeMatch) {
      if (!inBlock) {
        warnings.push(`Unbalanced marker at line ${i + 1}: closing marker without opening. File left unchanged.`);
        return { output: content, pruned: [], warnings, unbalanced: true };
      }
      if (closeMatch[1] !== currentBlockCode) {
        warnings.push(`Unbalanced marker at line ${i + 1}: closing code '${closeMatch[1]}' doesn't match opening code '${currentBlockCode}'. File left unchanged.`);
        return { output: content, pruned: [], warnings, unbalanced: true };
      }

      // Complete block — keep when the country matches, drop otherwise
      blockLines.push(line);
      if (country !== 'none' && country !== '' && country === currentBlockCode) {
        output.push(...blockLines);
      } else {
        pruned.push(currentBlockCode);
      }

      inBlock = false;
      currentBlockCode = null;
      blockLines = [];
    } else if (inBlock) {
      blockLines.push(line);
    } else {
      output.push(line);
    }
  }

  if (inBlock) {
    warnings.push(`Unbalanced marker: block starting at line ${blockStartLine + 1} has no closing marker. File left unchanged.`);
    return { output: content, pruned: [], warnings, unbalanced: true };
  }

  return { output: output.join('\n'), pruned, warnings, unbalanced: false };
}

// ── Project-key-preserving merge (ENV_SAMPLE SYNC delivery) ──────────────────

/** Marker introducing the project-owned section appended by mergeEnvSample. Exported so
 *  re-merges can recognize (and not duplicate) their own output. ASCII-only on purpose. */
export const PROJECT_ENV_SECTION_HEADER =
  '# --- Project-specific variables (preserved by upgrade; not overwritten by template sync) ---';

/** `KEY=` or `KEY=value` or `KEY=value  # inline note` — LHS group is the variable name. */
const ENV_KEY_LINE = /^([A-Za-z_][A-Za-z0-9_]*)\s*=/;

export interface EnvSampleMergeResult {
  /** Merged content: template body + (when the project owns extra keys) the preserved section. */
  output: string;
  /** Project-only keys preserved under the section header, in first-seen order. */
  preservedKeys: string[];
  /** Keys the template re-delivered over a diverging project line (template wins; placeholder normalized). */
  overriddenKeys: string[];
}

/**
 * Merge a (country-pruned) template .env.sample over a project's copy WITHOUT clobbering
 * project-owned content — the upgrade-path lesson of mergeGitleaksToml (v1.10.0): a
 * wholesale overwrite silently dropped project-specific allowlist entries, and real fleet
 * data (Projects/co-price) carries 16 project-only keys in .env.sample.
 *
 * Rules (line-attribution, template wins conflicts):
 *  - A project line that is byte-identical to a template line is dropped (the template
 *    re-delivers its own boilerplate — no duplication).
 *  - A project KEY line whose variable name exists in the template is dropped (template
 *    wins: updated placeholders/comments/country blocks arrive; diverging project values
 *    are reported in `overriddenKeys`). Comparing by NAME (not whole line) is what lets an
 *    updated template block replace a stale one — e.g. co-newbiz's hand-added empty
 *    `ECOS_API_KEY=` is superseded by the template's documented line.
 *  - Every other project line (project-only keys, their section dividers, inline comments,
 *    commented-out documentation keys) is preserved verbatim under PROJECT_ENV_SECTION_HEADER.
 *  - The header itself and blank-line runs are structural: blank runs collapse to one so
 *    the merge is idempotent (re-merging its own output is a no-op).
 */
export function mergeEnvSample(templateContent: string, projectContent: string): EnvSampleMergeResult {
  const templateLines = new Set(templateContent.split('\n'));
  const templateKeys = new Set<string>();
  for (const line of templateContent.split('\n')) {
    const m = line.match(ENV_KEY_LINE);
    if (m) templateKeys.add(m[1]);
  }

  const additions: string[] = [];
  const preservedKeys: string[] = [];
  const overriddenKeys: string[] = [];

  for (const line of projectContent.split('\n')) {
    if (line === PROJECT_ENV_SECTION_HEADER) continue; // never re-capture our own marker
    if (line.trim() === '') { additions.push(line); continue; } // structural — collapsed below
    const keyMatch = line.match(ENV_KEY_LINE);
    if (keyMatch && templateKeys.has(keyMatch[1])) {
      if (!templateLines.has(line)) overriddenKeys.push(keyMatch[1]);
      continue; // template owns this key — its updated line is delivered
    }
    if (templateLines.has(line)) continue; // boilerplate the template re-delivers
    if (keyMatch) preservedKeys.push(keyMatch[1]);
    additions.push(line);
  }

  // Collapse blank runs to one and trim the edges (idempotence + tidy output)
  const collapsed: string[] = [];
  for (const line of additions) {
    if (line.trim() === '' && (collapsed.length === 0 || collapsed[collapsed.length - 1].trim() === '')) continue;
    collapsed.push(line);
  }
  while (collapsed.length > 0 && collapsed[collapsed.length - 1].trim() === '') collapsed.pop();

  const base = templateContent.replace(/\n+$/, '');
  const body = collapsed.join('\n');
  const output = body ? `${base}\n\n${PROJECT_ENV_SECTION_HEADER}\n${body}\n` : `${base}\n`;
  return { output, preservedKeys, overriddenKeys };
}
