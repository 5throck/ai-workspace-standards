/** Unit tests for the Team Gateway Hermes bridge and OpenAI wire translation (ADR-0092 W3). */

import { describe, expect, test } from "bun:test";
import { hermesArgs, parseHermesLine, type HermesSpawnOptions } from "../../services/team-gateway/src/hermes";
import {
  chunkData,
  completionPayload,
  completionUsage,
  doneData,
  modelsPayload,
  parseChatRequest,
} from "../../services/team-gateway/src/openai";

const baseSpawn: HermesSpawnOptions = {
  hermesBin: "hermes",
  projectDir: "/data/tenants/gw-x/project",
  hermesHome: "/data/tenants/gw-x/hermes-home",
  message: "hello",
  sessionName: "gw-x",
  runBudgetSeconds: 300,
  maxTurns: 100,
};

describe("parseHermesLine — stream-json protocol (hermes_cli/stream_json.py shapes)", () => {
  test("parses the init event and keeps session_id", () => {
    const evt = parseHermesLine('{"type":"system","subtype":"init","model":"m","session_id":"s1","timestamp":1}');
    expect(evt).toEqual({
      type: "system",
      subtype: "init",
      model: "m",
      session_id: "s1",
      timestamp: 1,
    });
  });

  test("parses text, tool_use, tool_result and the terminal result event", () => {
    expect(parseHermesLine('{"type":"text","text":"hi","timestamp":2}')?.type).toBe("text");
    const toolUse = parseHermesLine('{"type":"tool_use","name":"read_file","tool_call_id":"t1","timestamp":3}');
    expect(toolUse?.type).toBe("tool_use");
    expect((toolUse as any)?.name).toBe("read_file");
    const toolResult = parseHermesLine(
      '{"type":"tool_result","name":"read_file","output":"ok","duration_ms":3,"is_error":false,"timestamp":4}',
    );
    expect(toolResult?.type).toBe("tool_result");
    expect((toolResult as any)?.is_error).toBe(false);
    const result = parseHermesLine(
      '{"type":"result","session_id":"s1","exit_code":0,"text":"done","tokens":{"input":1,"output":2,"total":3},"duration_ms":9,"timestamp":5}',
    );
    expect(result?.type).toBe("result");
    expect((result as any)?.tokens.total).toBe(3);
  });

  test("tolerates non-JSON lines and non-object JSON defensively", () => {
    expect(parseHermesLine("not json at all")).toEqual({ type: "raw", line: "not json at all" });
    expect(parseHermesLine("[1,2,3]")).toEqual({ type: "raw", line: "[1,2,3]" });
    expect(parseHermesLine("")).toBeNull();
    expect(parseHermesLine("   ")).toBeNull();
  });
});

describe("hermesArgs — unattended chat invocation", () => {
  test("builds the headless stream-json command with ceilings and stdin query", () => {
    const args = hermesArgs(baseSpawn);
    expect(args).toContain("chat");
    expect(args).toContain("--format");
    expect(args).toContain("stream-json");
    expect(args).toContain("--in");
    expect(args).toContain("/data/tenants/gw-x/project");
    expect(args).toContain("--accept-hooks");
    expect(args).toContain("--continue");
    expect(args[args.indexOf("--continue") + 1]).toBe("gw-x");
    expect(args).toContain("--create-if-missing");
    expect(args).not.toContain("--source"); // per-tenant homes make source isolation moot
    expect(args).not.toContain("--resume"); // named threads replace the MRU lookup
    expect(args).toContain("--query-file");
    expect(args[args.indexOf("--query-file") + 1]).toBe("-");
    expect(args).not.toContain("-q"); // -q takes a value; the query travels via --query-file -
    expect(args[args.indexOf("--max-turns") + 1]).toBe("100");
    expect(args[args.indexOf("--run-budget") + 1]).toBe("300");
  });

  test("named thread is deterministic; extra args are appended verbatim", () => {
    const args = hermesArgs({ ...baseSpawn, extraArgs: ["--yolo"] });
    expect(args[args.indexOf("--continue") + 1]).toBe("gw-x");
    expect(args).not.toContain("--usage-file"); // chat runs emit tokens in the result envelope
    expect(args.at(-1)).toBe("--yolo");
  });
});

describe("OpenAI wire translation", () => {
  test("modelsPayload exposes variants as OpenAI models", () => {
    const payload = modelsPayload(["co-consult", "co-develop"]) as any;
    expect(payload.object).toBe("list");
    expect(payload.data.map((m: any) => m.id)).toEqual(["co-consult", "co-develop"]);
    expect(payload.data[0].object).toBe("model");
  });

  test("parseChatRequest accepts the OpenAI shape and extracts the latest user message", () => {
    const parsed = parseChatRequest({
      model: "co-consult",
      user: "alice",
      stream: true,
      messages: [
        { role: "system", content: "be brief" },
        { role: "user", content: "first" },
        { role: "assistant", content: "answer" },
        { role: "user", content: "second" },
      ],
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.req.message).toBe("second");
      expect(parsed.req.user).toBe("alice");
      expect(parsed.req.stream).toBe(true);
    }
  });

  test("parseChatRequest rejects invalid bodies", () => {
    expect(parseChatRequest(null).ok).toBe(false);
    expect(parseChatRequest({ messages: [] }).ok).toBe(false);
    expect(parseChatRequest({ model: "x", messages: [{ role: "user", content: 42 }] }).ok).toBe(false);
    const noUser = parseChatRequest({ model: "x", messages: [{ role: "assistant", content: "hi" }] });
    expect(noUser.ok).toBe(false);
  });

  test("parseChatRequest defaults user and stream", () => {
    const parsed = parseChatRequest({ model: "co-consult", messages: [{ role: "user", content: "hi" }] });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.req.user).toBe("default");
      expect(parsed.req.stream).toBe(false);
    }
  });

  test("SSE chunk framing matches the OpenAI streaming wire", () => {
    const role = chunkData("id1", "co-consult", 123, { role: "assistant" }, null);
    expect(role.startsWith("data: ")).toBe(true);
    const parsed = JSON.parse(role.slice(6));
    expect(parsed.object).toBe("chat.completion.chunk");
    expect(parsed.choices[0].delta.role).toBe("assistant");
    expect(parsed.choices[0].finish_reason).toBeNull();

    const content = JSON.parse(chunkData("id1", "co-consult", 123, { content: "hi" }, null).slice(6));
    expect(content.choices[0].delta.content).toBe("hi");

    const finish = JSON.parse(chunkData("id1", "co-consult", 123, {}, "stop").slice(6));
    expect(finish.choices[0].finish_reason).toBe("stop");
    expect(doneData()).toBe("data: [DONE]\n\n");
  });

  test("completionUsage maps Hermes tokens onto OpenAI usage", () => {
    expect(completionUsage({ input: 11, output: 7, total: 18 })).toEqual({
      prompt_tokens: 11,
      completion_tokens: 7,
      total_tokens: 18,
    });
    expect(completionUsage(null)).toEqual({ prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 });
    expect(completionUsage({ input: "junk" }).prompt_tokens).toBe(0);
  });

  test("completionPayload shape", () => {
    const payload = completionPayload("id1", "co-consult", 123, "answer", {
      prompt_tokens: 1,
      completion_tokens: 2,
      total_tokens: 3,
    }) as any;
    expect(payload.object).toBe("chat.completion");
    expect(payload.choices[0].message).toEqual({ role: "assistant", content: "answer" });
    expect(payload.choices[0].finish_reason).toBe("stop");
    expect(payload.usage.total_tokens).toBe(3);
  });
});
