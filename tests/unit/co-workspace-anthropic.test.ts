/** Unit tests for the Team Gateway Anthropic Messages wire translation (ADR-0092 W3b). */

import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  anthropicStream,
  estimateTokens,
  messagePayload,
  messageId,
  parseAnthropicRequest,
} from "../../services/co-workspace/src/anthropic";
import { loadConfig } from "../../services/co-workspace/src/config";
import { createServer, createState } from "../../services/co-workspace/src/server";

describe("parseAnthropicRequest — Messages API shape", () => {
  test("accepts string content and extracts the latest user message", () => {
    const parsed = parseAnthropicRequest({
      model: "co-consult",
      max_tokens: 1024,
      system: "ignored in phase 0",
      messages: [
        { role: "user", content: "first" },
        { role: "assistant", content: [{ type: "text", text: "reply" }] },
        { role: "user", content: "second" },
      ],
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.req.message).toBe("second");
      expect(parsed.req.stream).toBe(false);
      expect(parsed.req.user).toBe("default");
    }
  });

  test("accepts text content blocks and metadata.user_id keying", () => {
    const parsed = parseAnthropicRequest({
      model: "co-consult",
      max_tokens: 8,
      stream: true,
      metadata: { user_id: "alice" },
      messages: [{ role: "user", content: [{ type: "text", text: "hello" }, { type: "text", text: "team" }] }],
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.req.message).toBe("hello\nteam");
      expect(parsed.req.user).toBe("alice");
      expect(parsed.req.stream).toBe(true);
    }
  });

  test("rejects missing model, missing max_tokens, and userless messages", () => {
    expect(parseAnthropicRequest({ messages: [{ role: "user", content: "hi" }] }).ok).toBe(false);
    expect(parseAnthropicRequest({ model: "co-consult", messages: [{ role: "user", content: "hi" }] }).ok).toBe(false);
    expect(parseAnthropicRequest({ model: "co-consult", max_tokens: 1, messages: [] }).ok).toBe(false);
    expect(
      parseAnthropicRequest({
        model: "co-consult",
        max_tokens: 1,
        messages: [{ role: "user", content: [{ type: "image", source: {} }] }],
      }).ok,
    ).toBe(false);
  });
});

describe("Anthropic wire payloads", () => {
  test("message envelope shape", () => {
    const payload = messagePayload("msg_x", "co-consult", "answer", {
      input_tokens: 10,
      output_tokens: 2,
    }) as any;
    expect(payload.type).toBe("message");
    expect(payload.role).toBe("assistant");
    expect(payload.content).toEqual([{ type: "text", text: "answer" }]);
    expect(payload.stop_reason).toBe("end_turn");
    expect(payload.usage).toEqual({ input_tokens: 10, output_tokens: 2 });
    expect(messageId().startsWith("msg_")).toBe(true);
  });

  test("stream frames follow the Anthropic event order", () => {
    const dec = new TextDecoder();
    const frames = anthropicStream("msg_x", "co-consult");
    const all = [
      ...frames.messageStart(),
      ...frames.contentStart(),
      ...frames.contentDelta("hi"),
      ...frames.contentStop(),
      ...frames.messageStop(11, 7),
    ]
      .map((bytes) => dec.decode(bytes))
      .join("");
    const events = all
      .split("\n\n")
      .filter(Boolean)
      .map((frame) => {
        const [eventLine, dataLine] = frame.split("\n");
        return { event: eventLine.replace("event: ", ""), data: JSON.parse(dataLine.replace("data: ", "")) };
      });
    expect(events.map((e) => e.event)).toEqual([
      "message_start",
      "content_block_start",
      "content_block_delta",
      "content_block_stop",
      "message_delta",
      "message_stop",
    ]);
    const start = events[0].data;
    expect(start.type).toBe("message_start");
    expect(start.message.model).toBe("co-consult");
    expect(events[2].data.delta).toEqual({ type: "text_delta", text: "hi" });
    expect(events[4].data.delta.stop_reason).toBe("end_turn");
    expect(events[5].data.type).toBe("message_stop");
  });

  test("estimateTokens is a rough chars/4 estimate", () => {
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("a".repeat(101))).toBe(26);
  });
});

describe("gateway server — Anthropic surface", () => {
  const dataDir = join(tmpdir(), `co-workspace-anthropic-${crypto.randomUUID().slice(0, 8)}`);
  const workspaceDir = join(tmpdir(), `co-workspace-anthropic-ws-${crypto.randomUUID().slice(0, 8)}`);
  const seedHome = join(tmpdir(), `co-workspace-anthropic-seed-${crypto.randomUUID().slice(0, 8)}`);
  mkdirSync(join(workspaceDir, "scripts"), { recursive: true });
  mkdirSync(seedHome, { recursive: true });
  writeFileSync(
    join(workspaceDir, "scripts", "new-project.ts"),
    `import { mkdirSync, writeFileSync } from "node:fs";
const name = process.argv[2];
mkdirSync(\`Projects/\${name}/.hermes/skills\`, { recursive: true });
writeFileSync(\`Projects/\${name}/AGENTS.md\`, "# fake tenant\\n");
`,
  );
  const hermesBinDir = join(tmpdir(), `co-workspace-anthropic-bin-${crypto.randomUUID().slice(0, 8)}`);
  mkdirSync(hermesBinDir, { recursive: true });
  const hermesBin = join(hermesBinDir, "fake-hermes.ts");
  writeFileSync(
    hermesBin,
    // T-20260929-001: portable fake binary — bun runs the .ts directly on every OS
    // (Windows Bun.spawn cannot exec shebang scripts).
    `await Bun.stdin.text();
console.log('{"type":"system","subtype":"init","model":"fake-model","session_id":"sess-a","timestamp":1}');
console.log('{"type":"text","text":"Hello from fake hermes","timestamp":2}');
console.log('{"type":"result","session_id":"sess-a","exit_code":0,"text":"Hello from fake hermes","tokens":{"input":11,"output":7,"total":18},"duration_ms":5,"timestamp":3}');
`,
  );
  chmodSync(hermesBin, 0o755);

  const cfg = loadConfig({
    CO_WORKSPACE_HOST: "127.0.0.1",
    CO_WORKSPACE_PORT: String(20000 + Math.floor(Math.random() * 20000)),
    CO_WORKSPACE_DATA_DIR: dataDir,
    CO_WORKSPACE_WORKSPACE_DIR: workspaceDir,
    CO_WORKSPACE_VARIANTS: "co-consult",
    // Anonymous lazy-provisioning flow — opt into the 2026-10-02 gate design's knob.
    CO_WORKSPACE_ALLOW_ANON_PROVISIONING: "true",
    HERMES_BIN: hermesBin,
    HERMES_BIN_PREFIX: "bun", // T-20260929-001: portable fake runs via bun
    CO_WORKSPACE_HERMES_SEED_HOME: seedHome,
  });
  const state = createState(cfg);
  const server = createServer(state);
  const base = `http://127.0.0.1:${server.port}`;

  afterAll(() => server.stop(true));

  test("stream=false returns a single Anthropic message envelope with mapped usage", async () => {
    const res = await fetch(`${base}/v1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": "anything", "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "co-consult",
        max_tokens: 256,
        messages: [{ role: "user", content: "hi" }],
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.type).toBe("message");
    expect(body.model).toBe("co-consult");
    expect(body.content[0].text).toBe("Hello from fake hermes");
    expect(body.usage).toEqual({ input_tokens: 11, output_tokens: 7 });
  });

  test("stream=true emits the full Anthropic event sequence", async () => {
    const res = await fetch(`${base}/v1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "co-consult",
        max_tokens: 256,
        stream: true,
        metadata: { user_id: "carol" },
        messages: [{ role: "user", content: "hi" }],
      }),
    });
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const text = await res.text();
    // Protocol events only: SSE comment frames (": …", T-20260930-010) carry no event line.
    const events = text
      .split("\n\n")
      .filter((frame) => frame.startsWith("event: "))
      .map((frame) => frame.split("\n")[0].replace("event: ", ""));
    expect(events).toEqual([
      "message_start",
      "content_block_start",
      "content_block_delta",
      "content_block_stop",
      "message_delta",
      "message_stop",
    ]);
    expect(text).toContain('"text_delta"');
    expect(text).toContain('"stop_reason":"end_turn"');
  });

  test("count_tokens stub returns an estimate; unknown model 404s; bad body 400s", async () => {
    const count = await fetch(`${base}/v1/messages/count_tokens`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "co-consult", messages: [{ role: "user", content: "abcd" }] }),
    });
    expect(((await count.json()) as any).input_tokens).toBeGreaterThanOrEqual(1);
    const unknown = await fetch(`${base}/v1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "co-nope", max_tokens: 1, messages: [{ role: "user", content: "hi" }] }),
    });
    expect(unknown.status).toBe(404);
    const bad = await fetch(`${base}/v1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "co-consult", messages: [{ role: "user", content: "hi" }] }),
    });
    expect(bad.status).toBe(400);
  });
});
