/**
 * Subprocess tests for mcp-governance-server.ts (T-20260925-009, spec
 * docs/designs/2026-09-25-mcp-governance-server-design.md §6).
 *
 * Drives the real server over stdin/stdout with newline-delimited JSON-RPC
 * and asserts the handshake, tool advertisement, a read-only tool call
 * against the live workspace scripts, and the allowlist rejections.
 */
import { describe, test, expect } from 'bun:test';
import { spawn } from 'node:child_process';
import * as path from 'node:path';

const serverPath = path.resolve(import.meta.dir, '..', '..', 'scripts', 'mcp-governance-server.ts');

interface JsonRpcResponse { id: string | number | null; result?: unknown; error?: { code: number; message: string } }

/** Send newline-delimited JSON-RPC lines; collect one response per request id. */
function talk(lines: unknown[], timeoutMs = 60_000): Map<string | number | null, JsonRpcResponse> {
    return new Promise((resolvePromise, rejectPromise) => {
        const child = spawn('bun', [serverPath], { stdio: ['pipe', 'pipe', 'pipe'] });
        const responses = new Map<string | number | null, JsonRpcResponse>();
        let buffer = '';
        const timer = setTimeout(() => {
            child.kill();
            rejectPromise(new Error(`server timed out; partial responses: ${responses.size}`));
        }, timeoutMs);
        child.stdout.on('data', (chunk: Buffer) => {
            buffer += chunk.toString('utf-8');
            let idx: number;
            while ((idx = buffer.indexOf('\n')) !== -1) {
                const line = buffer.slice(0, idx).trim();
                buffer = buffer.slice(idx + 1);
                if (!line) continue;
                const msg = JSON.parse(line) as JsonRpcResponse;
                if (msg.id !== undefined) responses.set(msg.id, msg);
                if (responses.size >= lines.filter(l => (l as { id?: number }).id !== undefined).length) {
                    clearTimeout(timer);
                    child.kill();
                    resolvePromise(responses);
                }
            }
        });
        child.stderr.on('data', () => { /* logs ignored */ });
        child.on('error', (err) => { clearTimeout(timer); rejectPromise(err); });
        const payload = lines.map(l => JSON.stringify(l)).join('\n') + '\n';
        child.stdin.write(payload);
        child.stdin.end();
    });
}

const INIT = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '0' } } };
const LIST = { jsonrpc: '2.0', id: 2, method: 'tools/list' };

describe('mcp-governance-server (T-20260925-009)', () => {
    test('handshake echoes the requested protocol version and advertises the four governance tools', async () => {
        const responses = await talk([INIT, { jsonrpc: '2.0', method: 'notifications/initialized' }, LIST]);
        const init = responses.get(1)!;
        const initResult = init.result as { protocolVersion: string; serverInfo: { name: string } };
        expect(init.error).toBeUndefined();
        expect(initResult.protocolVersion).toBe('2024-11-05');
        expect(initResult.serverInfo.name).toBe('ai-workspace-governance');
        const tools = (responses.get(2)!.result as { tools: Array<{ name: string }> }).tools.map(t => t.name).sort();
        expect(tools).toEqual(['audit', 'qa_gate', 'spec_register', 'ticket']);
    });

    test('tools/call on the read-only ticket tool returns a structured envelope with exitCode 0', async () => {
        const responses = await talk([
            INIT,
            { jsonrpc: '2.0', method: 'notifications/initialized' },
            { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'ticket', arguments: { action: 'list' } } },
        ]);
        const res = responses.get(3)!;
        expect(res.error).toBeUndefined();
        const result = res.result as { isError: boolean; content: Array<{ type: string; text: string }> };
        expect(result.isError).toBe(false);
        const envelope = JSON.parse(result.content[0]!.text) as { command: string[]; exitCode: number };
        expect(envelope.exitCode).toBe(0);
        expect(envelope.command).toEqual(['bun', 'scripts/ticket.ts', 'list']);
    });

    test('ticket move with a disallowed status is rejected with -32602 before any spawn', async () => {
        const responses = await talk([
            INIT,
            { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'ticket', arguments: { action: 'move', id: 'T-20260925-010', status: 'yolo' } } },
        ]);
        expect(responses.get(4)!.error?.code).toBe(-32602);
    });

    test('an unknown tool name is rejected with -32602', async () => {
        const responses = await talk([
            INIT,
            { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'rm_rf', arguments: {} } },
        ]);
        expect(responses.get(5)!.error?.code).toBe(-32602);
    });

    test('an unknown method is rejected with -32601', async () => {
        const responses = await talk([INIT, { jsonrpc: '2.0', id: 6, method: 'resources/list' }]);
        expect(responses.get(6)!.error?.code).toBe(-32601);
    });
});
