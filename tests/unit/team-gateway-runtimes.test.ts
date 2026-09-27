/** Unit tests for the Claude Code and Codex runtime adapters (Waves C1/C2).
 * Event shapes captured live 2026-09-27 (claude 2.1.274, codex CLI). */

import { describe, expect, test } from "bun:test";
import { claudeArgs, parseClaudeLine } from "../../services/team-gateway/src/claude";
import { codexArgs, parseCodexLine } from "../../services/team-gateway/src/codex";

describe("claude runtime — args and normalization", () => {
  test("builds the print-mode command with verbose stream-json", () => {
    const args = claudeArgs({ claudeBin: "claude", projectDir: "/p", message: "hi" });
    expect(args.slice(0, 4)).toEqual(["claude", "-p", "hi", "--output-format"]);
    expect(args).toContain("--verbose");
    expect(args).not.toContain("--resume");
  });

  test("resume adds --resume <session_id>", () => {
    const args = claudeArgs({ claudeBin: "claude", projectDir: "/p", message: "hi", sessionId: "sess-9" });
    expect(args[args.indexOf("--resume") + 1]).toBe("sess-9");
  });

  test("init event normalizes to system/init", () => {
    const evt = parseClaudeLine('{"type":"system","subtype":"init","session_id":"cc-1","cwd":"/p"}');
    expect(evt?.type).toBe("system");
    expect((evt as any).session_id).toBe("cc-1");
  });

  test("assistant text blocks normalize to text events", () => {
    const evt = parseClaudeLine(
      '{"type":"assistant","message":{"content":[{"type":"text","text":"Hello from claude"}],"usage":{}}}',
    );
    expect(evt).toEqual({ type: "text", text: "Hello from claude", raw: expect.any(Object) });
  });

  test("result event maps status and usage", () => {
    const evt = parseClaudeLine(
      '{"type":"result","subtype":"success","session_id":"cc-1","result":"the answer","usage":{"input_tokens":11,"output_tokens":7,"total_tokens":18}}',
    );
    expect(evt?.type).toBe("result");
    expect((evt as any).exit_code).toBe(0);
    expect((evt as any).text).toBe("the answer");
    expect((evt as any).tokens).toEqual({ input: 11, output: 7, total: 18 });
  });

  test("non-JSON lines surface as raw", () => {
    expect(parseClaudeLine("junk")).toEqual({ type: "raw", line: "junk" });
    expect(parseClaudeLine("")).toBeNull();
  });
});

describe("codex runtime — args and normalization", () => {
  test("builds exec --json without resume by default", () => {
    const args = codexArgs({ codexBin: "codex", projectDir: "/p", message: "hi" });
    expect(args.slice(0, 3)).toEqual(["codex", "exec", "--json"]);
    expect(args).not.toContain("resume");
  });

  test("thread id adds exec resume", () => {
    const args = codexArgs({ codexBin: "codex", projectDir: "/p", message: "hi", threadId: "thr-1" });
    expect(args).toContain("resume");
    expect(args[args.indexOf("resume") + 1]).toBe("thr-1");
  });

  test("thread.started normalizes to system/init", () => {
    const evt = parseCodexLine('{"type":"thread.started","thread_id":"thr-1"}');
    expect(evt?.type).toBe("system");
    expect((evt as any).session_id).toBe("thr-1");
  });

  test("agent_message items normalize to text events", () => {
    const evt = parseCodexLine(
      '{"type":"item.completed","item":{"id":"item_1","type":"agent_message","text":"Hello from codex"}}',
    );
    expect(evt).toEqual({ type: "text", text: "Hello from codex", raw: expect.any(Object) });
  });

  test("turn.completed maps usage", () => {
    const evt = parseCodexLine(
      '{"type":"turn.completed","usage":{"input_tokens":20,"cached_input_tokens":4,"total_tokens":24}}',
    );
    expect(evt?.type).toBe("result");
    expect((evt as any).tokens.input).toBe(20);
    expect((evt as any).tokens.total).toBe(24);
  });
});
