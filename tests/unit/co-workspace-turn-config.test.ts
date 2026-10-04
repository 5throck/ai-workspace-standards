// Turn-runtime hot-swap (spec 2026-10-04-turn-runtime-hotswap-design, T from the
// user review: runtime/credential switching must not require a container restart,
// and the turn params must not be hermes-named).

import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyTurnOverrides,
  loadTurnOverrides,
  maskApiKey,
  persistTurnOverrides,
  readTurnOverrides,
  turnOverridesPath,
  validateTurnOverridesBody,
} from "../../services/co-workspace/src/config";
import type { GatewayConfig } from "../../services/co-workspace/src/config";

function baseCfg(): GatewayConfig {
  return {
    runtime: "hermes",
    llmProvider: undefined,
    llmApiKey: undefined,
    llmBaseUrl: undefined,
    hermesModel: undefined,
    hermesExtraArgs: [],
  } as unknown as GatewayConfig;
}

describe("applyTurnOverrides", () => {
  test("applies runtime, provider, apiKey, baseUrl, model, extraArgs", () => {
    const cfg = baseCfg();
    const { applied, warnings } = applyTurnOverrides(cfg, {
      runtime: "claude",
      provider: "anthropic",
      apiKey: "sk-ant-test-1234",
      baseUrl: "https://anthropic-proxy.example.com/v1",
      model: "claude-sonnet-4",
      extraArgs: ["--verbose"],
    });
    expect(applied).toEqual(["runtime", "provider", "apiKey", "baseUrl", "model", "extraArgs"]);
    expect(cfg.runtime).toBe("claude");
    expect(cfg.llmApiKey).toBe("sk-ant-test-1234");
    expect(cfg.llmBaseUrl).toBe("https://anthropic-proxy.example.com/v1");
    expect(cfg.hermesModel).toBe("claude-sonnet-4");
    expect(cfg.hermesExtraArgs).toEqual(["--verbose"]);
    expect(warnings).toEqual([]); // anthropic speaks the claude protocol
  });

  test("a family mismatch applies but warns (operator may be preparing a switch)", () => {
    const cfg = baseCfg();
    const { warnings } = applyTurnOverrides(cfg, { runtime: "claude", provider: "openai", apiKey: "sk-x" });
    expect(warnings.join(" ")).toContain("openai");
  });

  test("invalid values throw loud, nothing applied", () => {
    const cfg = baseCfg();
    expect(() => applyTurnOverrides(cfg, { runtime: "gemini" as never })).toThrow(/runtime must be one of/);
    expect(() => applyTurnOverrides(cfg, { apiKey: "   " })).toThrow(/non-empty/);
    expect(() => applyTurnOverrides(cfg, { baseUrl: "http://insecure" })).toThrow(/https/);
    expect(() => applyTurnOverrides(cfg, { provider: "HAS SPACE" })).toThrow(/provider/);
    expect(cfg.runtime).toBe("hermes");
    expect(cfg.llmApiKey).toBeUndefined();
  });
});

describe("overlay file round-trip (data/turn-config.json)", () => {
  test("persist + load applies the same values", () => {
    const dir = mkdtempSync(join(tmpdir(), "turn-config-"));
    try {
      const cfg = baseCfg();
      persistTurnOverrides(dir, { runtime: "claude", provider: "anthropic", apiKey: "sk-ant-x" });
      const result = loadTurnOverrides(cfg, dir);
      expect(result?.applied).toContain("runtime");
      expect(cfg.runtime).toBe("claude");
      // the file is readable JSON
      const raw = JSON.parse(readFileSync(turnOverridesPath(dir), "utf8"));
      expect(raw.runtime).toBe("claude");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("no overlay file → null; corrupt file → loud boot refusal", () => {
    const dir = mkdtempSync(join(tmpdir(), "turn-config-"));
    try {
      expect(loadTurnOverrides(baseCfg(), dir)).toBeNull();
      persistTurnOverrides(dir, {});
      const { writeFileSync } = require("node:fs");
      writeFileSync(turnOverridesPath(dir), "{ not json", "utf8");
      expect(() => loadTurnOverrides(baseCfg(), dir)).toThrow(/not valid JSON/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("readTurnOverrides tolerates a corrupt file (PUT merges over it)", () => {
    const dir = mkdtempSync(join(tmpdir(), "turn-config-"));
    try {
      persistTurnOverrides(dir, {});
      const { writeFileSync } = require("node:fs");
      writeFileSync(turnOverridesPath(dir), "garbage", "utf8");
      expect(readTurnOverrides(dir)).toEqual({});
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("validateTurnOverridesBody + masking", () => {
  test("string extraArgs split; empty body rejected upstream", () => {
    expect(validateTurnOverridesBody({ extraArgs: "--verbose --model x" })).toEqual({
      extraArgs: ["--verbose", "--model", "x"],
    });
    expect(validateTurnOverridesBody({})).toEqual({});
  });

  test("maskApiKey shows only the last 4 chars, or null", () => {
    expect(maskApiKey(undefined)).toBeNull();
    expect(maskApiKey("sk-ant-abcd1234")).toBe("•••1234");
  });
});
