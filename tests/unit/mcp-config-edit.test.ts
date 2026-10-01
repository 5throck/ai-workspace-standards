// @version 1.0.0
import { describe, test, expect } from 'bun:test';
import { load, JSON_SCHEMA } from 'js-yaml';
import {
  readHermesMcpEntry,
  setHermesMcpEntry,
  removeHermesMcpEntry,
} from '../../scripts/helpers/mcp-config-edit.ts';

const NAME = 'ai-workspace-upstream';
const ENTRY = { command: '/opt/bun', args: ['/ws/scripts/mcp-upstream-server.ts'] };

const BASE = `# user comment must survive
model:
  default: gpt-x   # trailing comment
mcp_servers:
  governance:
    command: bun
    args:
      - /ws/scripts/mcp-governance-server.ts
    enabled: true
  # comment inside the block
  other:
    command: node
    args: [a.js]
context_file_max_chars: 100000
desktop:
  repo_scan_enabled: true
`;

const parse = (t: string) => load(t, { schema: JSON_SCHEMA }) as any;

describe('setHermesMcpEntry', () => {
  test('inserts into an existing block and changes nothing else', () => {
    const out = setHermesMcpEntry(BASE, NAME, ENTRY);
    const doc = parse(out);
    expect(doc.mcp_servers[NAME]).toEqual({ command: ENTRY.command, args: ENTRY.args, enabled: true });
    expect(doc.mcp_servers.governance.enabled).toBe(true);
    expect(doc.mcp_servers.other.command).toBe('node');
    expect(doc.context_file_max_chars).toBe(100000);
    expect(out).toContain('# user comment must survive');
    expect(out).toContain('# trailing comment');
    expect(out).toContain('# comment inside the block');
    // Nothing but the new entry was added: removing it gives back the original bytes.
    expect(removeHermesMcpEntry(out, NAME)).toBe(BASE);
  });

  test('is idempotent: a second run yields identical text', () => {
    const once = setHermesMcpEntry(BASE, NAME, ENTRY);
    expect(setHermesMcpEntry(once, NAME, ENTRY)).toBe(once);
  });

  test('replaces an existing entry without duplicating it', () => {
    const once = setHermesMcpEntry(BASE, NAME, { command: '/old/bun', args: ['/old.ts'] });
    const twice = setHermesMcpEntry(once, NAME, ENTRY);
    expect(twice.match(new RegExp(`^  ${NAME}:`, 'gm'))?.length).toBe(1);
    expect(parse(twice).mcp_servers[NAME].command).toBe('/opt/bun');
    expect(parse(twice).mcp_servers.governance.enabled).toBe(true);
  });

  test('appends the key when mcp_servers is absent', () => {
    const out = setHermesMcpEntry('model:\n  default: x\n', NAME, ENTRY);
    expect(parse(out).mcp_servers[NAME].command).toBe('/opt/bun');
    expect(parse(out).model.default).toBe('x');
  });

  test('expands an inline empty mapping', () => {
    const out = setHermesMcpEntry('mcp_servers: {}\nmodel:\n  default: x\n', NAME, ENTRY);
    expect(parse(out).mcp_servers[NAME].command).toBe('/opt/bun');
    expect(parse(out).model.default).toBe('x');
  });

  test('keeps CRLF line endings', () => {
    const crlf = BASE.replace(/\n/g, '\r\n');
    const out = setHermesMcpEntry(crlf, NAME, ENTRY);
    expect(out.includes('\r\n')).toBe(true);
    expect(out.replace(/\r\n/g, '').includes('\n')).toBe(false);
    expect(parse(out).mcp_servers[NAME].command).toBe('/opt/bun');
  });

  test('refuses layouts it does not edit instead of guessing', () => {
    expect(() => setHermesMcpEntry('mcp_servers: null\n', NAME, ENTRY)).toThrow(/does not edit/);
    expect(() => setHermesMcpEntry('mcp_servers: { a: { command: x } }\n', NAME, ENTRY)).toThrow(/does not edit/);
    expect(() => setHermesMcpEntry('mcp_servers:\n  a: {}\nmcp_servers:\n  b: {}\n', NAME, ENTRY)).toThrow();
  });

  test('refuses to write a file it cannot parse', () => {
    expect(() => setHermesMcpEntry('model: [unclosed\nmcp_servers:\n', NAME, ENTRY)).toThrow();
  });

  test('quotes Windows-style paths safely', () => {
    const out = setHermesMcpEntry(BASE, NAME, { command: 'C:\\bun\\bun.exe', args: ['C:\\ws\\a b\\s.ts'] });
    expect(parse(out).mcp_servers[NAME]).toEqual({ command: 'C:\\bun\\bun.exe', args: ['C:\\ws\\a b\\s.ts'], enabled: true });
  });
});

describe('readHermesMcpEntry / removeHermesMcpEntry', () => {
  test('reads command and args, or null when absent', () => {
    expect(readHermesMcpEntry(BASE, NAME)).toBeNull();
    expect(readHermesMcpEntry(setHermesMcpEntry(BASE, NAME, ENTRY), NAME)).toEqual(ENTRY);
    expect(readHermesMcpEntry('model:\n  default: x\n', NAME)).toBeNull();
  });

  test('removes only the named entry and restores the original text', () => {
    const added = setHermesMcpEntry(BASE, NAME, ENTRY);
    const removed = removeHermesMcpEntry(added, NAME);
    expect(removed).toBe(BASE);
  });

  test('is a no-op when the entry is not registered', () => {
    expect(removeHermesMcpEntry(BASE, NAME)).toBe(BASE);
  });
});
