/**
 * validate-output.ts + classifyVariantMirrorCopy tests
 * (design docs/designs/2026-11-17-new-project-precheck-argv-design.md §4, T-20261117-009)
 */
import { describe, expect, test } from "bun:test";
import type { SpawnSyncReturns } from "node:child_process";
import { join, resolve } from "node:path";
import {
  describeSpawnFailure,
  evaluateValidationOutput,
  runGovernancePrecheck,
} from "../../scripts/helpers/validate-output.ts";
import { classifyVariantMirrorCopy } from "../../scripts/validate-templates.ts";

const ROOT = resolve(import.meta.dir, "..", "..");
const SCRIPT = join(ROOT, "scripts", "helpers", "validate-output.ts");
const DOMAINS = ["variant", "agent", "skill"];

function bigPayload(): string {
  const warnings = Array.from({ length: 600 }, (_, i) => ({
    variant: "co-y",
    check: "some-warning",
    message: `padding warning ${i} ${"x".repeat(200)}`,
  }));
  const errors = [
    { variant: "co-y", check: "variant-other", message: "other variant error" },
    { variant: "co-x", check: "variant-parity", message: "target variant error" },
  ];
  return JSON.stringify({ warnings, errors });
}

function fakeSpawn(map: (args: readonly string[]) => Partial<SpawnSyncReturns<string>>): never {
  return ((_cmd: string, args: readonly string[]) => ({
    pid: 0,
    output: [],
    signal: null,
    status: 0,
    stdout: "",
    stderr: "",
    ...map(args),
  })) as never;
}

describe("evaluateValidationOutput", () => {
  test("T3: >100 KB payload is evaluated in-process", () => {
    const payload = bigPayload();
    expect(payload.length).toBeGreaterThan(100_000);
    const v = evaluateValidationOutput(payload, { mandatoryDomains: DOMAINS, variant: "co-x" });
    expect(v.kind).toBe("blocked");
    if (v.kind === "blocked") {
      expect(v.blocking).toHaveLength(1);
      expect(v.blocking[0]?.message).toBe("target variant error");
      expect(v.outOfScope).toHaveLength(1);
    }
  });

  test("T6: scoping to target variant plus common; legacy without variant blocks all", () => {
    const text = JSON.stringify({
      errors: ["co-x", "common", "co-y", "root"].map((variant) => ({ variant, check: "variant-x", message: variant })),
    });
    const scoped = evaluateValidationOutput(text, { mandatoryDomains: DOMAINS, variant: "co-x" });
    expect(scoped.kind).toBe("blocked");
    if (scoped.kind === "blocked") {
      expect(scoped.blocking.map((e) => e.variant)).toEqual(["co-x", "common"]);
      expect(scoped.outOfScope.map((e) => e.variant)).toEqual(["co-y", "root"]);
    }
    const legacy = evaluateValidationOutput(text, { mandatoryDomains: DOMAINS });
    expect(legacy.kind === "blocked" && legacy.blocking.length).toBe(4);
  });

  test("non-mandatory checks never block; garbage is unparsable (fail-closed)", () => {
    const pass = evaluateValidationOutput(JSON.stringify({ errors: [{ variant: "co-x", check: "cv-02" }] }), {
      mandatoryDomains: DOMAINS,
      variant: "co-x",
    });
    expect(pass.kind).toBe("pass");
    const bad = evaluateValidationOutput('TRACE verdict: ok\n{"errors":[]}', { mandatoryDomains: DOMAINS });
    expect(bad.kind).toBe("unparsable");
    if (bad.kind === "unparsable") expect(bad.preview.startsWith("TRACE")).toBe(true);
  });
});

describe("validate-output CLI", () => {
  test("T2: >100 KB payload over stdin exits 1 with the error on stderr", () => {
    const proc = Bun.spawnSync(["bun", SCRIPT, "variant,agent,skill", "-", "--variant", "co-x"], {
      stdin: new TextEncoder().encode(bigPayload()),
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(proc.exitCode).toBe(1);
    expect(proc.stderr.toString()).toContain("target variant error");
    expect(proc.stderr.toString()).not.toContain("other variant error");
  });

  test("unparsable stdin exits 2", () => {
    const proc = Bun.spawnSync(["bun", SCRIPT, "variant", "-"], {
      stdin: new TextEncoder().encode("not json"),
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(proc.exitCode).toBe(2);
    expect(proc.stderr.toString()).toContain("Could not parse");
  });

  test("T8: importing the module has no side effects", async () => {
    const proc = Bun.spawnSync(
      ["bun", "-e", `await import(${JSON.stringify(SCRIPT)}); console.log("imported-ok")`, "unrelated", "args"],
      { stdout: "pipe", stderr: "pipe" },
    );
    expect(proc.exitCode).toBe(0);
    expect(proc.stdout.toString().trim()).toBe("imported-ok");
    expect(proc.stderr.toString()).toBe("");
  });
});

describe("describeSpawnFailure", () => {
  const base = { pid: 0, output: [], signal: null, status: 0, stdout: "ok", stderr: "" } as SpawnSyncReturns<string>;

  test("T4: error code, signal, empty stdout with stderr tail, and normal result", () => {
    const enametoolong = describeSpawnFailure("validate-output.ts", {
      ...base,
      error: Object.assign(new Error("spawnSync ENAMETOOLONG"), { code: "ENAMETOOLONG" }),
      status: null,
      stdout: "",
    });
    expect(enametoolong).toContain("could not start");
    expect(enametoolong).toContain("ENAMETOOLONG");

    expect(describeSpawnFailure("v", { ...base, status: null, signal: "SIGKILL", stdout: "" })).toContain("SIGKILL");

    const empty = describeSpawnFailure("v", { ...base, status: 3, stdout: "", stderr: "boom line\nlast line" });
    expect(empty).toContain("exited 3 with no output");
    expect(empty).toContain("last line");

    expect(describeSpawnFailure("v", base)).toBeNull();
  });
});

describe("runGovernancePrecheck", () => {
  test("T5: injected spawn failure is fail-closed and names the code", () => {
    const spawn = fakeSpawn((args) =>
      args.some((a) => a.endsWith("validate-templates.ts"))
        ? {
            error: Object.assign(new Error("spawnSync ENAMETOOLONG"), { code: "ENAMETOOLONG" }),
            status: null,
            stdout: "",
          }
        : { stdout: "variant,agent,skill\n" },
    );
    const r = runGovernancePrecheck({ workspaceRoot: ROOT, variant: "co-x", spawn });
    expect(r.ok).toBe(false);
    expect(r.lines.join("\n")).toContain("ENAMETOOLONG");
    expect(r.lines.join("\n")).toContain("bun scripts/validate-templates.ts --variant co-x");
  });

  test("T5: injected garbage stdout is unparsable and fail-closed", () => {
    const spawn = fakeSpawn((args) =>
      args.some((a) => a.endsWith("validate-templates.ts"))
        ? { stdout: "TRACE verdict: ok\n{}" }
        : { stdout: "variant,agent,skill\n" },
    );
    const r = runGovernancePrecheck({ workspaceRoot: ROOT, variant: "co-x", spawn });
    expect(r.ok).toBe(false);
    const text = r.lines.join("\n");
    expect(text).toContain("not valid JSON");
    expect(text).toContain("TRACE verdict");
  });

  test("lifecycle-governance spawn failure warns visibly and falls back to default domains", () => {
    const spawn = fakeSpawn((args) =>
      args.some((a) => a.endsWith("validate-templates.ts"))
        ? { stdout: JSON.stringify({ errors: [] }) }
        : { status: null, signal: "SIGTERM", stdout: "" },
    );
    const r = runGovernancePrecheck({ workspaceRoot: ROOT, variant: "co-x", spawn });
    expect(r.ok).toBe(true);
    expect(r.mandatoryDomains).toBe("variant,agent,skill");
    expect(r.lines.join("\n")).toContain("SIGTERM");
  });

  test("T9: live end-to-end pre-check passes for co-develop", () => {
    const r = runGovernancePrecheck({ workspaceRoot: ROOT, variant: "co-develop" });
    expect(r.lines.filter((l) => l.includes("❌"))).toEqual([]);
    expect(r.ok).toBe(true);
  }, 120000);
});

describe("classifyVariantMirrorCopy (T7)", () => {
  const base = { inVariant: false, inCommon: true, flagged: false, mirrorVersion: "1.0.0", commonVersion: "1.1.0", peerCount: 0 };
  test.each([
    ["flagged -> warn-undeclared", { ...base, flagged: true }, "warn-undeclared"],
    ["stale orphan -> fail-stale-orphan", base, "fail-stale-orphan"],
    ["peer carries it -> ok", { ...base, peerCount: 2 }, "ok"],
    ["same version -> ok", { ...base, mirrorVersion: "1.1.0" }, "ok"],
    ["mirror version unknown -> ok", { ...base, mirrorVersion: null }, "ok"],
    ["common version unknown -> ok", { ...base, commonVersion: null }, "ok"],
    ["variant owns skill -> ok", { ...base, inVariant: true }, "ok"],
    ["not in common -> ok", { ...base, inCommon: false }, "ok"],
  ] as const)("%s", (_name, opts, verdict) => {
    expect(classifyVariantMirrorCopy({ ...opts })).toBe(verdict);
  });
});
