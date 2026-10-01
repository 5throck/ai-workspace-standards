/** Unit tests for the Team Gateway Gemini wire translation (Antigravity/Gemini ecosystem). */

import { afterAll, describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  estimateTokens,
  generateContentPayload,
  geminiStream,
  parseGeminiRequest,
} from "../../services/co-workspace/src/gemini";
import { loadConfig } from "../../services/co-workspace/src/config";
import { createServer, createState } from "../../services/co-workspace/src/server";

describe("parseGeminiRequest — generateContent shape", () => {
  test("extracts the latest user turn from contents[].parts", () => {
    const parsed = parseGeminiRequest({
      contents: [
        { role: "user", parts: [{ text: "first" }] },
        { role: "model", parts: [{ text: "reply" }] },
        { role: "user", parts: [{ text: "second" }] },
      ],
      systemInstruction: { parts: [{ text: "ignored in phase 0" }] },
      generationConfig: { temperature: 0.5 },
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.req.message).toBe("second");
      expect(parsed.req.user).toBe("default");
    }
  });

  test("joins multiple text parts and reads the gateway-extension user field", () => {
    const parsed = parseGeminiRequest({
      user: "dave",
      contents: [{ role: "user", parts: [{ text: "hello" }, { text: "team" }] }],
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.req.message).toBe("hello\nteam");
      expect(parsed.req.user).toBe("dave");
    }
  });

  test("rejects missing or non-text contents", () => {
    expect(parseGeminiRequest({}).ok).toBe(false);
    expect(parseGeminiRequest({ contents: [] }).ok).toBe(false);
    expect(parseGeminiRequest({ contents: [{ role: "user", parts: [{ inlineData: {} }] }] }).ok).toBe(false);
  });
});

describe("Gemini wire payloads", () => {
  test("generateContent envelope shape", () => {
    const payload = generateContentPayload("answer", {
      promptTokenCount: 10,
      candidatesTokenCount: 2,
      totalTokenCount: 12,
    }) as any;
    expect(payload.candidates[0].content.parts[0].text).toBe("answer");
    expect(payload.candidates[0].finishReason).toBe("STOP");
    expect(payload.usageMetadata.totalTokenCount).toBe(12);
  });

  test("stream frames: deltas then terminal chunk with finishReason and usage", () => {
    const dec = new TextDecoder();
    const frames = [...geminiStream().delta("hi"), ...geminiStream().end(11, 7)].map((b) =>
      JSON.parse(dec.decode(b).replace(/^data: /, "").trim()),
    );
    expect(frames[0].candidates[0].content.parts[0].text).toBe("hi");
    expect(frames[1].candidates[0].finishReason).toBe("STOP");
    expect(frames[1].usageMetadata).toEqual({
      promptTokenCount: 11,
      candidatesTokenCount: 7,
      totalTokenCount: 18,
    });
  });

  test("estimateTokens is a rough chars/4 estimate", () => {
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("a".repeat(101))).toBe(26);
  });
});

describe("gateway server — Gemini surface", () => {
  const dataDir = join(tmpdir(), `co-workspace-gemini-${crypto.randomUUID().slice(0, 8)}`);
  const workspaceDir = join(tmpdir(), `co-workspace-gemini-ws-${crypto.randomUUID().slice(0, 8)}`);
  mkdirSync(join(workspaceDir, "scripts"), { recursive: true });
  writeFileSync(
    join(workspaceDir, "scripts", "new-project.ts"),
    `import { mkdirSync, writeFileSync } from "node:fs";
const name = process.argv[2];
mkdirSync(\`Projects/\${name}/.hermes/skills\`, { recursive: true });
writeFileSync(\`Projects/\${name}/AGENTS.md\`, "# fake tenant\\n");
`,
  );
  const hermesBinDir = join(tmpdir(), `co-workspace-gemini-bin-${crypto.randomUUID().slice(0, 8)}`);
  mkdirSync(hermesBinDir, { recursive: true });
  const hermesBin = join(hermesBinDir, "fake-hermes.ts");
  writeFileSync(
    hermesBin,
    // T-20260929-001: portable fake binary — bun runs the .ts directly on every OS
    // (Windows Bun.spawn cannot exec shebang scripts).
    `await Bun.stdin.text();
console.log('{"type":"system","subtype":"init","model":"fake-model","session_id":"sess-g","timestamp":1}');
console.log('{"type":"text","text":"Hello from fake hermes","timestamp":2}');
console.log('{"type":"result","session_id":"sess-g","exit_code":0,"text":"Hello from fake hermes","tokens":{"input":11,"output":7,"total":18},"duration_ms":5,"timestamp":3}');
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
  });
  const server = createServer(createState(cfg));
  const base = `http://127.0.0.1:${server.port}`;

  afterAll(() => server.stop(true));

  test("stream=false returns a generateContent envelope with mapped usage", async () => {
    const res = await fetch(`${base}/v1beta/models/co-consult:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "hi" }] }],
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.candidates[0].content.parts[0].text).toBe("Hello from fake hermes");
    expect(body.usageMetadata.totalTokenCount).toBe(18);
  });

  test("stream=true emits per-delta candidate chunks then the terminal chunk", async () => {
    const res = await fetch(`${base}/v1beta/models/co-consult:streamGenerateContent?alt=sse`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "hi" }] }],
      }),
    });
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const text = await res.text();
    // SSE comments (": …" progress frames, T-20260930-010) are not data frames.
    const frames = text
      .split("\n\n")
      .filter((frame) => frame.startsWith("data: "))
      .map((frame) => JSON.parse(frame.replace(/^data: /, "")));
    expect(frames[0].candidates[0].content.parts[0].text).toBe("Hello from fake hermes");
    expect(frames.at(-1).candidates[0].finishReason).toBe("STOP");
    expect(frames.at(-1).usageMetadata.totalTokenCount).toBe(18);
  });

  test("models list, countTokens stub, unknown model 404", async () => {
    const models = await (await fetch(`${base}/v1beta/models`)).json();
    expect(models.models[0].name).toBe("models/co-consult");
    const count = await fetch(`${base}/v1beta/models/co-consult:countTokens`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "abcd" }] }] }),
    });
    expect(((await count.json()) as any).totalTokens).toBeGreaterThanOrEqual(1);
    const unknown = await fetch(`${base}/v1beta/models/co-nope:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "hi" }] }] }),
    });
    expect(unknown.status).toBe(404);
  });
});
