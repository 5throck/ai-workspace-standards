#!/usr/bin/env bun
// @version 1.1.0
// v1.0.0 (2026-09-25, T-20260925-009 — spec
//          docs/designs/2026-09-25-mcp-governance-server-design.md):
//          initial — stdio MCP server (newline-delimited JSON-RPC 2.0,
//          zero dependencies) exposing four governance scripts as tools:
//          ticket (list/board/doctor read; move write), audit (--spec-check
//          gate, read-only), spec_register (docs/designs/-confined write),
//          qa_gate (read-only). Safety by construction: execFileSync argv
//          arrays (no shell), subcommand/flag/path allowlists, 120s timeout,
//          capped output tails. Enforcement honesty (design D5): this is
//          harness-neutral ACCESS to the gates, not a new enforcement layer —
//          commit-time gates are unchanged.
/**
 * mcp-governance-server.ts — MCP server for workspace governance tools.
 *
 * Transport: MCP stdio (one JSON-RPC 2.0 message per stdin line; responses
 * written as single lines to stdout — NOTHING else may write to stdout).
 * Handshake: initialize → capabilities.tools → notifications/initialized;
 * protocol version echoes the client's requested version (fallback
 * "2024-11-05"). Logs go to stderr only.
 *
 * Layer: L0 (workspace-root governance surface; not shipped to projects).
 * Harness registration (documented, never automated): run from the workspace
 * root — `hermes mcp add governance -- bun scripts/mcp-governance-server.ts`.
 *
 * @version 1.1.0
 */

import { execFileSync } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { join, dirname, resolve, sep, extname } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = resolve(SCRIPT_DIR, '..');
const FALLBACK_PROTOCOL_VERSION = '2024-11-05';
const CALL_TIMEOUT_MS = 120_000;
const STDOUT_TAIL = 8000;
const STDERR_TAIL = 4000;

const TICKET_STATUSES = ['backlog', 'waiting', 'running', 'review', 'done', 'failed'] as const;
const TICKET_READ_ACTIONS = ['list', 'board', 'doctor'] as const;
const AUDIT_FLAGS = ['--spec-check', '--lifecycle-only'] as const;
const SPEC_SOURCES = ['brainstorming', 'meeting', 'manual', 'architect', 'pm'] as const;
const SPEC_STATUSES = ['draft', 'proposed', 'approved', 'implemented', 'drifted', 'archived'] as const;

// CWD guard (design §7): refuse to serve when the workspace layout is absent —
// the governed scripts must be the workspace's own, wherever the client launched us.
if (!existsSync(join(WORKSPACE_ROOT, 'scripts', 'ticket.ts'))
  || !existsSync(join(WORKSPACE_ROOT, 'scripts', 'audit.ts'))) {
  console.error(`mcp-governance-server: workspace layout not found at ${WORKSPACE_ROOT} — refusing to serve`);
  process.exit(1);
}

function tail(text: string, max: number): string {
  return text.length <= max ? text : `…(truncated)${text.slice(-max)}`;
}

interface ToolResult {
  command: string[];
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

function runGovernanceScript(argv: string[]): ToolResult {
  const command = ['bun', ...argv];
  try {
    const stdout = execFileSync(command[0]!, command.slice(1), {
      cwd: WORKSPACE_ROOT,
      encoding: 'utf-8',
      timeout: CALL_TIMEOUT_MS,
    });
    return { command, exitCode: 0, stdout: tail(stdout, STDOUT_TAIL), stderr: '' };
  } catch (err) {
    const e = err as { status?: number | null; stdout?: string; stderr?: string; message?: string };
    return {
      command,
      exitCode: typeof e.status === 'number' ? e.status : 1,
      stdout: tail(e.stdout ?? '', STDOUT_TAIL),
      stderr: tail(e.stderr ?? e.message ?? String(err), STDERR_TAIL),
    };
  }
}

/** Build the argv for a tool call, or return an error string. */
function buildArgv(name: string, args: Record<string, unknown>): string[] | string {
  if (name === 'ticket') {
    const action = args.action;
    if (typeof action === 'string' && (TICKET_READ_ACTIONS as readonly string[]).includes(action)) {
      return ['scripts/ticket.ts', action];
    }
    if (action === 'move') {
      const { id, status } = args as { id?: unknown; status?: unknown };
      if (typeof id !== 'string' || !/^T-\d{8}-\d{3,4}$/.test(id)) return 'ticket move requires a valid ticket id (T-YYYYMMDD-NNN)';
      if (typeof status !== 'string' || !(TICKET_STATUSES as readonly string[]).includes(status)) {
        return `ticket move status must be one of: ${TICKET_STATUSES.join(', ')}`;
      }
      const argv = ['scripts/ticket.ts', 'move', id, status];
      if (args.result !== undefined) {
        if (typeof args.result !== 'string') return 'ticket move result must be a string';
        argv.push('--result', args.result);
      }
      return argv;
    }
    return `ticket action must be one of: ${[...TICKET_READ_ACTIONS, 'move'].join(', ')}`;
  }

  if (name === 'audit') {
    const argv = ['scripts/audit.ts'];
    if (args.flags !== undefined) {
      if (!Array.isArray(args.flags)) return 'audit flags must be an array';
      for (const f of args.flags) {
        if (typeof f !== 'string' || !(AUDIT_FLAGS as readonly string[]).includes(f)) {
          return `audit flags allowlist: ${AUDIT_FLAGS.join(', ')}`;
        }
        argv.push(f);
      }
    }
    return argv;
  }

  if (name === 'qa_gate') {
    return ['scripts/qa-gate.ts'];
  }

  if (name === 'spec_register') {
    if (args.list === true) return ['scripts/spec-register.ts', '--list'];
    const { file } = args as { file?: unknown };
    if (typeof file !== 'string' || file.length === 0) return 'spec_register requires file (a docs/designs/*.md path)';
    const abs = resolve(WORKSPACE_ROOT, file);
    const designsDir = `${realpathSync(join(WORKSPACE_ROOT, 'docs', 'designs'))}${sep}`;
    if (!abs.startsWith(designsDir)) return 'spec_register file must resolve inside docs/designs/';
    if (!existsSync(abs)) return `spec_register file not found: ${file}`;
    // T-20260926-026b: the directory-prefix check is not sufficient — a
    // symlink planted inside docs/designs/ can point the WRITE outside the
    // confined scope. Realpath the leaf and re-verify against the same
    // confined prefix.
    const realLeaf = `${realpathSync(abs)}${sep}`;
    if (!realLeaf.startsWith(designsDir)) return 'spec_register file must resolve inside docs/designs/ (symlink escape rejected)';
    if (extname(abs) !== '.md') return 'spec_register file must be a .md file';
    const argv = ['scripts/spec-register.ts', '--file', file];
    if (args.update === true) {
      // T-20260926-026b: an id beginning with '--' would shift argv parsing
      // downstream — require the registered spec-id shape.
      const id = typeof args.id === 'string' ? args.id : '';
      if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) return 'spec_register --update requires a valid spec id (lowercase alphanumeric/dash)';
      argv.push('--update', id);
      return argv;
    }
    const source = args.source ?? 'manual';
    if (typeof source !== 'string' || !(SPEC_SOURCES as readonly string[]).includes(source)) {
      return `spec_register source must be one of: ${SPEC_SOURCES.join(', ')}`;
    }
    argv.push('--source', source);
    if (args.status !== undefined) {
      if (typeof args.status !== 'string' || !(SPEC_STATUSES as readonly string[]).includes(args.status)) {
        return `spec_register status must be one of: ${SPEC_STATUSES.join(', ')}`;
      }
      argv.push('--status', args.status);
    }
    return argv;
  }

  return `unknown tool: ${name}`;
}

const TOOLS = [
  {
    name: 'ticket',
    description: 'Workspace governance tickets: list/board/doctor (read) or move a ticket between statuses (write). Ids look like T-20260925-010.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'board', 'doctor', 'move'] },
        id: { type: 'string', description: 'Ticket id, e.g. T-20260925-010 (move only)' },
        status: { type: 'string', enum: [...TICKET_STATUSES], description: 'Target status (move only)' },
        result: { type: 'string', description: 'Result note recorded on the move (move only)' },
      },
      required: ['action'],
    },
  },
  {
    name: 'audit',
    description: 'Run the workspace audit gate (scripts/audit.ts). Read-only.',
    inputSchema: {
      type: 'object',
      properties: {
        flags: { type: 'array', items: { type: 'string', enum: [...AUDIT_FLAGS] } },
      },
    },
  },
  {
    name: 'spec_register',
    description: 'Register or update a design-doc spec entry (scripts/spec-register.ts). file must resolve inside docs/designs/.',
    inputSchema: {
      type: 'object',
      properties: {
        file: { type: 'string' },
        source: { type: 'string', enum: [...SPEC_SOURCES] },
        status: { type: 'string', enum: [...SPEC_STATUSES] },
        update: { type: 'boolean', description: 'true = update an existing entry by id' },
        id: { type: 'string', description: 'Spec id for --update' },
        list: { type: 'boolean', description: 'true = list registered specs (read-only)' },
      },
    },
  },
  {
    name: 'qa_gate',
    description: 'Run the QA gate (scripts/qa-gate.ts). Read-only.',
    inputSchema: { type: 'object', properties: {} },
  },
];

type JsonRpcId = string | number | null;

function send(msg: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify(msg)}\n`);
}

function respond(id: JsonRpcId, result: unknown): void {
  send({ jsonrpc: '2.0', id, result });
}

function respondError(id: JsonRpcId, code: number, message: string): void {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

function handleToolCall(id: JsonRpcId, params: { name?: unknown; arguments?: unknown }): void {
  const { name, arguments: args } = params;
  if (typeof name !== 'string' || !TOOLS.some(t => t.name === name)) {
    respondError(id, -32602, `params.name must be one of: ${TOOLS.map(t => t.name).join(', ')}`);
    return;
  }
  const built = buildArgv(name, (typeof args === 'object' && args !== null) ? args as Record<string, unknown> : {});
  if (typeof built === 'string') {
    respondError(id, -32602, built);
    return;
  }
  const result = runGovernanceScript(built);
  respond(id, {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    isError: result.exitCode !== 0,
  });
}

function handleMessage(line: string): void {
  let msg: { id?: JsonRpcId; method?: string; params?: Record<string, unknown> };
  try {
    msg = JSON.parse(line);
  } catch {
    respondError(null, -32700, 'parse error');
    return;
  }
  const id = msg.id ?? null;
  switch (msg.method) {
    case 'initialize':
      respond(id, {
        protocolVersion: (msg.params?.protocolVersion as string) ?? FALLBACK_PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: 'ai-workspace-governance', version: '1.0.0' },
      });
      return;
    case 'notifications/initialized':
      return; // notification — no response
    case 'ping':
      respond(id, {});
      return;
    case 'tools/list':
      respond(id, { tools: TOOLS });
      return;
    case 'tools/call':
      handleToolCall(id, (msg.params ?? {}) as { name?: unknown; arguments?: unknown });
      return;
    default:
      if (msg.method === undefined) respondError(id, -32600, 'invalid request: missing method');
      else if (id !== null) respondError(id, -32601, `method not found: ${msg.method}`);
      // unknown notifications are dropped per JSON-RPC 2.0
  }
}

const rl = createInterface({ input: process.stdin, terminal: false });
rl.on('line', line => {
  const trimmed = line.trim();
  if (trimmed.length > 0) {
    try {
      handleMessage(trimmed);
    } catch (err) {
      console.error(`mcp-governance-server: handler error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
});
rl.on('close', () => process.exit(0));
