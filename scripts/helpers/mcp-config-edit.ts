// @version 1.1.0
// v1.1.0 (2026-10-02, T-20261002-010 review M13): recognizes a UTF-8 BOM and a quoted
//           top-level key ("mcp_servers":) instead of appending a duplicate; per-line
//           EOL preservation (a mixed-EOL file no longer gets normalized to CRLF);
//           empty/whitespace-only files append without a null-deref crash.
// Pure text editors for MCP server registrations in user-level client configs.
// Used by scripts/install-upstream-mcp.ts (L0 only; not propagated to templates).
//
// Hermes keeps its whole configuration (>100 KB, with comments) in one YAML file, so a
// parse-and-dump round trip would rewrite the user's file. These editors change only the
// `mcp_servers:` block as text, then prove with a YAML parse that nothing else changed.

import { isDeepStrictEqual } from 'node:util';
import { load, JSON_SCHEMA } from 'js-yaml';

export interface McpStdioEntry {
  command: string;
  args: string[];
}

type Doc = Record<string, any>;

function stripBom(text: string): { text: string; bom: string } {
  return text.startsWith('\uFEFF') ? { text: text.slice(1), bom: '\uFEFF' } : { text, bom: '' };
}

function parseDoc(text: string): Doc {
  const stripped = stripBom(text).text;
  if (stripped.trim() === '') return {};
  const doc = load(stripped, { schema: JSON_SCHEMA });
  if (doc === null || doc === undefined) return {};
  if (typeof doc !== 'object' || Array.isArray(doc)) {
    throw new Error('config.yaml is not a YAML mapping');
  }
  return doc as Doc;
}

function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

function isBlankOrComment(line: string): boolean {
  const t = line.trim();
  return t === '' || t.startsWith('#');
}

function eolOf(text: string): string {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

/** M13: a mixed-EOL file keeps each line's own terminator — no wholesale CRLF normalization. */
function splitLines(text: string): { lines: string[]; eols: string[] } {
  const lines: string[] = [];
  const eols: string[] = [];
  let rest = stripBom(text).text;
  for (;;) {
    const nl = rest.indexOf('\n');
    if (nl === -1) { lines.push(rest); eols.push(''); break; }
    const crlf = nl > 0 && rest[nl - 1] === '\r';
    lines.push(rest.slice(0, crlf ? nl - 1 : nl));
    eols.push(crlf ? '\r\n' : '\n');
    rest = rest.slice(nl + 1);
    if (rest === '') { break; }
  }
  return { lines, eols };
}

function joinLines(lines: string[], eols: string[], bom: string): string {
  let out = bom;
  for (let i = 0; i < lines.length; i++) out += lines[i] + (eols[i] ?? (i === lines.length - 1 ? '' : '\n'));
  return out;
}

const KEY_LINE = /^mcp_servers\s*:\s*(#.*)?$|^["']mcp_servers["']\s*:\s*(#.*)?$/;
const INLINE_EMPTY = /^mcp_servers\s*:\s*\{\s*\}\s*(#.*)?$|^["']mcp_servers["']\s*:\s*\{\s*\}\s*(#.*)?$/;
const ANY_KEY = /^mcp_servers\s*:|^["']mcp_servers["']\s*:/;

/** Read the registered entry (command + args) for `name`, or null when absent. */
export function readHermesMcpEntry(text: string, name: string): McpStdioEntry | null {
  const doc = parseDoc(text);
  const entry = doc.mcp_servers?.[name];
  if (entry === undefined || entry === null) return null;
  const args = Array.isArray(entry.args) ? entry.args.map(String) : [];
  return { command: String(entry.command ?? ''), args };
}

function entryLines(name: string, entry: McpStdioEntry, unit: number): string[] {
  const pad = (n: number) => ' '.repeat(n);
  const out = [
    `${pad(unit)}${name}:`,
    `${pad(unit * 2)}command: ${JSON.stringify(entry.command)}`,
  ];
  if (entry.args.length === 0) {
    out.push(`${pad(unit * 2)}args: []`);
  } else {
    out.push(`${pad(unit * 2)}args:`);
    for (const a of entry.args) out.push(`${pad(unit * 3)}- ${JSON.stringify(a)}`);
  }
  out.push(`${pad(unit * 2)}enabled: true`);
  return out;
}

/** Locate the top-level `mcp_servers:` key. Throws on shapes this editor does not handle. */
function findKey(lines: string[]): { idx: number; inlineEmpty: boolean } | null {
  const hits = lines
    .map((l, i) => (ANY_KEY.test(i === 0 ? l.replace(/^\uFEFF/, '') : l) ? i : -1))
    .filter((i) => i >= 0);
  if (hits.length === 0) return null;
  if (hits.length > 1) throw new Error('multiple top-level mcp_servers keys; edit config.yaml by hand');
  const idx = hits[0];
  if (KEY_LINE.test(lines[idx])) return { idx, inlineEmpty: false };
  if (INLINE_EMPTY.test(lines[idx])) return { idx, inlineEmpty: true };
  throw new Error('mcp_servers uses a layout this installer does not edit; edit config.yaml by hand');
}

/** End (exclusive) of the block that starts after the key line at `idx`. */
function blockEnd(lines: string[], idx: number): number {
  let end = idx + 1;
  for (let i = idx + 1; i < lines.length; i++) {
    if (!isBlankOrComment(lines[i]) && indentOf(lines[i]) === 0) break;
    end = i + 1;
  }
  return end;
}

function childIndent(lines: string[], idx: number, end: number): number {
  for (let i = idx + 1; i < end; i++) {
    if (!isBlankOrComment(lines[i])) return indentOf(lines[i]);
  }
  return 2;
}

function removeEntryLines(lines: string[], idx: number, end: number, unit: number, name: string): string[] {
  const keyRe = new RegExp(`^ {${unit}}${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:`);
  let start = -1;
  for (let i = idx + 1; i < end; i++) {
    if (keyRe.test(lines[i])) { start = i; break; }
  }
  if (start < 0) return lines;
  let stop = start + 1;
  for (let i = start + 1; i < end; i++) {
    if (!isBlankOrComment(lines[i]) && indentOf(lines[i]) <= unit) break;
    stop = i + 1;
  }
  while (stop > start + 1 && lines[stop - 1].trim() === '') stop--;
  return [...lines.slice(0, start), ...lines.slice(stop)];
}

function verify(before: string, after: string, name: string, expected: McpStdioEntry | null): void {
  const a = parseDoc(before);
  const b = parseDoc(after);
  const expectedDoc: Doc = { ...a, mcp_servers: { ...(a.mcp_servers ?? {}) } };
  if (expected) {
    expectedDoc.mcp_servers[name] = { command: expected.command, args: expected.args, enabled: true };
  } else {
    delete expectedDoc.mcp_servers[name];
  }
  // An empty mapping and an absent key mean the same thing to Hermes.
  if (Object.keys(expectedDoc.mcp_servers).length === 0 && !('mcp_servers' in a)) delete expectedDoc.mcp_servers;
  if (!isDeepStrictEqual(b, expectedDoc)) {
    throw new Error('verification failed: the edit would change more than the single MCP entry; nothing was written');
  }
}

/** Add or replace `name` under `mcp_servers:`, leaving every other byte of the file alone. */
export function setHermesMcpEntry(text: string, name: string, entry: McpStdioEntry): string {
  const { bom } = stripBom(text);
  const { lines, eols } = splitLines(text);
  const key = findKey(lines);
  let out: string[];
  let outEols: string[];

  if (!key) {
    const trimmed = [...lines];
    const trimmedEols = [...eols];
    while (trimmed.length && trimmed[trimmed.length - 1].trim() === '') { trimmed.pop(); trimmedEols.pop(); }
    // M13: an empty/whitespace-only file simply gains the block — no null-deref path.
    if (trimmed.length === 0) {
      out = ['mcp_servers:', ...entryLines(name, entry, 2), ''];
      const eol = eolOf(text);
      outEols = [eol, ...Array.from({ length: entryLines(name, entry, 2).length }, () => eol), ''];
    } else {
      out = [...trimmed, 'mcp_servers:', ...entryLines(name, entry, 2), ''];
      const eol = eolOf(text);
      outEols = [...trimmedEols, eol, ...Array.from({ length: entryLines(name, entry, 2).length + 1 }, () => eol)];
    }
  } else if (key.inlineEmpty) {
    out = [...lines.slice(0, key.idx), 'mcp_servers:', ...entryLines(name, entry, 2), ...lines.slice(key.idx + 1)];
    const eol = eolOf(text);
    outEols = [...eols.slice(0, key.idx), eol, ...Array.from({ length: entryLines(name, entry, 2).length }, () => eol), ...eols.slice(key.idx + 1)];
  } else {
    const end = blockEnd(lines, key.idx);
    const unit = childIndent(lines, key.idx, end);
    const pruned = removeEntryLines(lines, key.idx, end, unit, name);
    const removedCount = lines.length - pruned.length;
    const prunedEols = [...eols.slice(0, key.idx + 1), ...eols.slice(key.idx + 1 + removedCount)];
    const entryCount = entryLines(name, entry, unit).length;
    out = [...pruned.slice(0, key.idx + 1), ...entryLines(name, entry, unit), ...pruned.slice(key.idx + 1)];
    const eol = eolOf(text);
    outEols = [...prunedEols.slice(0, key.idx + 1), ...Array.from({ length: entryCount }, () => eol), ...prunedEols.slice(key.idx + 1)];
  }

  const result = joinLines(out, outEols, bom);
  verify(text, result, name, entry);
  return result;
}

/** Remove `name` from `mcp_servers:`. Returns the text unchanged when it is not registered. */
export function removeHermesMcpEntry(text: string, name: string): string {
  if (readHermesMcpEntry(text, name) === null) return text;
  const { bom } = stripBom(text);
  const { lines, eols } = splitLines(text);
  const key = findKey(lines);
  if (!key || key.inlineEmpty) {
    throw new Error('mcp_servers uses a layout this installer does not edit; edit config.yaml by hand');
  }
  const end = blockEnd(lines, key.idx);
  const unit = childIndent(lines, key.idx, end);
  const pruned = removeEntryLines(lines, key.idx, end, unit, name);
  const removedCount = lines.length - pruned.length;
  const outEols = [...eols.slice(0, key.idx + 1), ...eols.slice(key.idx + 1 + removedCount)];
  const result = joinLines(pruned, outEols, bom);
  verify(text, result, name, null);
  return result;
}
