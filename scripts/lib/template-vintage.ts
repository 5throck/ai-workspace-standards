// @version 1.0.0
// v1.0.0 (2026-11-12, DEC-20261111-01, design 2026-11-11-upgrade-overwrite-protection §4.4 E3 — PR-B):
//          template-vintage provenance. A project file whose bytes equal ANY historical
//          revision of its template counterpart is untouched template vintage: it carries
//          no project-authored content, so restoring the current template over it destroys
//          nothing. Pure helpers (blobIdOf, vintageMatch) + two git readers
//          (loadTemplateBlobHistory, readBlobTexts). Git spawns pass gitCleanEnv().
//          Vintage applies to raw-bytes passes only (never rendered/merged deliverables).
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { gitCleanEnv } from "./git-env.ts";

/** Policy horizon: template history older than this is not consulted (design §4.4). */
export const VINTAGE_HORIZON = "2026-06-01";

/** template path (workspace-relative, forward slashes) -> every git blob id it ever held. */
export type TemplateBlobHistory = Map<string, Set<string>>;

/** git blob id of `content` (sha1 of "blob <byteLength>\0" + bytes) — parity with `git hash-object`. */
export function blobIdOf(content: string): string {
  const bytes = Buffer.from(content, "utf8");
  return createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
}

/** The blob ids a project file may match: raw bytes and the LF-normalized form (CRLF checkouts). */
export function blobIdCandidates(content: string): string[] {
  const ids = [blobIdOf(content)];
  const lf = content.replace(/\r\n/g, "\n");
  if (lf !== content) ids.push(blobIdOf(lf));
  return ids;
}

/**
 * Load the blob history of every file under each root since `since`. One `git log --raw`
 * spawn per root. Deleted revisions (all-zero post-image) are skipped; renames are not
 * followed (a renamed template path loses its older blobs — design risk 3).
 */
export function loadTemplateBlobHistory(
  workspaceRoot: string,
  roots: string[],
  since: string = VINTAGE_HORIZON,
): TemplateBlobHistory {
  const history: TemplateBlobHistory = new Map();
  for (const root of roots) {
    const r = spawnSync(
      "git",
      ["-C", workspaceRoot, "log", "--format=", "--raw", "--no-abbrev", "--no-renames", `--since=${since}`, "--", root],
      { encoding: "utf8", env: gitCleanEnv(), maxBuffer: 256 * 1024 * 1024 },
    );
    if (r.status !== 0) continue;
    for (const line of (r.stdout || "").split("\n")) {
      // :<oldmode> <newmode> <oldblob> <newblob> <status>\t<path>
      const m = line.match(/^:\d+ \d+ [0-9a-f]+ ([0-9a-f]{40}) [A-Z]\d*\t(.+)$/);
      if (!m) continue;
      const [, blob, path] = m;
      if (/^0+$/.test(blob)) continue;
      let set = history.get(path);
      if (!set) {
        set = new Set();
        history.set(path, set);
      }
      set.add(blob);
    }
  }
  return history;
}

/**
 * True when `projectContent` equals (byte- or CRLF-normalized) any historical revision of
 * any candidate template path. `rel` is the project-relative path (informational: candidates
 * are derived by the caller from it — templates/<variant>/<rel>, templates/common/<rel>, ...).
 */
export function vintageMatch(
  rel: string,
  projectContent: string,
  candidateTemplatePaths: string[],
  history: TemplateBlobHistory,
): boolean {
  void rel;
  const ids = blobIdCandidates(projectContent);
  for (const p of candidateTemplatePaths) {
    const set = history.get(p);
    if (!set) continue;
    for (const id of ids) if (set.has(id)) return true;
  }
  return false;
}

/** Union of blob ids of the candidate paths (input to readBlobTexts). */
export function blobIdsFor(candidateTemplatePaths: string[], history: TemplateBlobHistory): string[] {
  const out = new Set<string>();
  for (const p of candidateTemplatePaths) for (const id of history.get(p) ?? []) out.add(id);
  return [...out];
}

/** Text of the given blobs (`git cat-file --batch`). Unreadable blobs are skipped. */
export function readBlobTexts(workspaceRoot: string, blobIds: string[]): string[] {
  if (blobIds.length === 0) return [];
  const r = spawnSync("git", ["-C", workspaceRoot, "cat-file", "--batch"], {
    input: `${blobIds.join("\n")}\n`,
    env: gitCleanEnv(),
    maxBuffer: 256 * 1024 * 1024,
  });
  if (r.status !== 0 || !r.stdout) return [];
  const buf = r.stdout as Buffer;
  const texts: string[] = [];
  let pos = 0;
  while (pos < buf.length) {
    const nl = buf.indexOf(0x0a, pos);
    if (nl < 0) break;
    const header = buf.subarray(pos, nl).toString("utf8");
    const m = header.match(/^[0-9a-f]{40} blob (\d+)$/);
    if (!m) {
      pos = nl + 1; // "<id> missing"
      continue;
    }
    const size = Number(m[1]);
    texts.push(buf.subarray(nl + 1, nl + 1 + size).toString("utf8"));
    pos = nl + 1 + size + 1;
  }
  return texts;
}
