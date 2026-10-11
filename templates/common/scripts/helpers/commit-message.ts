// @version 1.0.0
// v1.0.0 (2026-10-11, U-20261008-001, spec
//           docs/designs/2026-10-11-backlog-batch-2-design.md): descriptive commit-message
//           composition for dev-sync step 1 — weak caller messages (no message, bare
//           "chore: update", bare "chore: upgrade template to X") are replaced by a
//           conventional-commit summary derived from the task-staged change set.
/**
 * commit-message.ts — derive a descriptive commit message from a changed-path set.
 *
 * Import-safety: pure functions only; no git, no I/O — safe to import from tests
 * and from dev-sync.ts (same extraction pattern as helpers/version-bump.ts).
 */

/** Messages too generic to be worth keeping verbatim (replaced by a derived one). */
const WEAK_MESSAGE_RE = /^(?:chore: update|chore: (?:upgrade|resync|sync) template(?: to v?[\d.]+)?)$/i;

/** Hard subject-line budget — conventional-commit shaped, git-log friendly. */
const MAX_LENGTH = 72;

export function isWeakCommitMessage(msg: string): boolean {
  return msg.trim() === '' || WEAK_MESSAGE_RE.test(msg.trim());
}

interface PathGroup {
  scope: string;
  type: 'docs' | 'chore' | 'test' | 'ci';
}

/**
 * Classify a repo-relative path into a (type, scope) group. Order matters:
 * the first matching rule wins, so `docs/designs/` is grouped as `spec`
 * (it cites the spec id) before the generic `docs` group.
 */
function classifyPath(norm: string): PathGroup | null {
  if (norm.startsWith('tickets/')) return { scope: 'tickets', type: 'chore' };
  if (norm.startsWith('docs/designs/')) return { scope: 'spec', type: 'docs' };
  if (norm.startsWith('docs/')) return { scope: 'docs', type: 'docs' };
  if (/^(AGENTS|CLAUDE|GEMINI|CODEX|HERMES|CONSTITUTION|README|CHANGELOG|SECURITY)\.md$/i.test(norm)) return { scope: 'docs', type: 'docs' };
  if (norm.startsWith('scripts/')) return { scope: 'scripts', type: 'chore' };
  if (norm.startsWith('templates/')) return { scope: 'templates', type: 'chore' };
  if (norm.startsWith('skills/') || /^(\.claude|\.agents|\.codex|\.gemini|\.hermes|\.opencode)\/skills\//.test(norm)) return { scope: 'skills', type: 'docs' };
  if (norm.startsWith('agents/')) return { scope: 'agents', type: 'docs' };
  if (norm.startsWith('tests/')) return { scope: 'tests', type: 'test' };
  if (norm.startsWith('.github/')) return { scope: 'ci', type: 'ci' };
  if (norm.startsWith('schemas/')) return { scope: 'schemas', type: 'chore' };
  return null;
}

/** First `docs/designs/<spec-id>-design.md` id in the set, or null. */
function findSpecId(paths: string[]): string | null {
  for (const raw of paths) {
    const m = raw.replace(/\\/g, '/').match(/docs\/designs\/([a-z0-9][a-z0-9.-]*)-design\.md$/i);
    if (m) return m[1];
  }
  return null;
}

function plural(n: number): string {
  return n === 1 ? 'file' : 'files';
}

/**
 * Build a conventional-commit subject from the changed-path set.
 *
 * The primary group (most files; ties broken by first-seen group order) picks
 * type(scope). When the set touches docs/designs, the spec id is cited while it
 * fits the 72-char budget. With nothing classifiable, falls back to
 * `chore: workspace sync (<n> files)` — never the bare `chore: update`.
 */
export function deriveCommitMessage(paths: string[]): string {
  const norm = paths.map((p) => p.replace(/\\/g, '/'));
  const counts = new Map<string, { group: PathGroup; n: number }>();
  const order: string[] = [];
  for (const p of norm) {
    const g = classifyPath(p);
    if (!g) continue;
    if (!counts.has(g.scope)) {
      counts.set(g.scope, { group: g, n: 0 });
      order.push(g.scope);
    }
    counts.get(g.scope)!.n++;
  }

  const total = norm.length;
  const specId = findSpecId(paths);

  let primary: { group: PathGroup; n: number } | null = null;
  for (const scope of order) {
    const c = counts.get(scope)!;
    if (primary === null || c.n > primary.n) primary = c;
  }

  if (primary === null) {
    return `chore: workspace sync${total > 0 ? ` (${total} ${plural(total)})` : ''}`;
  }

  const fileNote = `${total} ${plural(total)}`;
  const withSpec = specId ? ` (spec ${specId}, ${fileNote})` : ` (${fileNote})`;
  let msg = `${primary.group.type}(${primary.group.scope}): workspace sync${withSpec}`;
  if (msg.length <= MAX_LENGTH) return msg;

  // Spec id did not fit — drop it first, then fall back to the plain note.
  msg = `${primary.group.type}(${primary.group.scope}): workspace sync (${fileNote})`;
  if (msg.length <= MAX_LENGTH) return msg;
  return `chore: workspace sync (${fileNote})`.slice(0, MAX_LENGTH);
}

/**
 * Keep a caller-supplied descriptive message; replace only weak fallback shapes
 * with a summary derived from the task-staged change set.
 */
export function composeCommitMessage(rawMsg: string, changedPaths: string[]): string {
  if (!isWeakCommitMessage(rawMsg)) return rawMsg.trim();
  return deriveCommitMessage(changedPaths);
}
