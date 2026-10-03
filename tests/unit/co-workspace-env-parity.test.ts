/** Env-var parity ratchet (T-20260929-011, finding H12): every CO_WORKSPACE_* / HERMES_* /
 * GOOGLE_* variable the service READS must appear on the deployment surface
 * (docker-compose.yml environment block + .env.sample), or be listed in an explicit,
 * reasoned exemption map below. Exemptions cannot rot: a stale one fails too. */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SVC = join(import.meta.dir, "../../services/co-workspace");
const COMPOSE_REL = "services/co-workspace/docker/docker-compose.yml";
/** Volume-mode override (T-20260930-038): its environment blocks are part of the compose
 * surface - declaring CO_WORKSPACE_DATA_VOLUME etc. there is the parity mechanism (design
 * 2026-09-30, section 7), so the ratchet unions it with the base compose file. */
const COMPOSE_VOLUME_OVERRIDE_REL = "services/co-workspace/docker/docker-compose.volume.yml";
const SAMPLE_REL = "services/co-workspace/docker/.env.sample";
/** T-20261003-014 (2026-10-03 review H9/D): the README configuration table is the third
 * documentation surface — a switch as consequential as CO_WORKSPACE_ALLOW_ANON_PROVISIONING
 * must not be real in config but absent from the operator docs. */
const README_REL = "services/co-workspace/README.md";
const NAME = "(?:CO_WORKSPACE_|HERMES_|GOOGLE_)[A-Z0-9_]*";

/** Vars read by src/ but intentionally NOT passed through docker-compose.yml. */
const COMPOSE_EXEMPT: Record<string, string> = {
  CO_WORKSPACE_PORT: "container port is fixed at 9030 (default) to match the loopback publish mapping",
  HERMES_BIN_PREFIX: "command wrapper (e.g. `wsl hermes`) for hosts running Hermes outside the image; hermes is on PATH in the container",
  CO_WORKSPACE_CLAUDE_BIN: "claude CLI is not installed in the gateway image; runtime only usable on a bare-metal run",
  CO_WORKSPACE_CODEX_BIN: "codex CLI is not installed in the gateway image; runtime only usable on a bare-metal run",
  CO_WORKSPACE_ANTIGRAVITY_BIN: "agy CLI is not installed in the gateway image; runtime only usable on a bare-metal run",
  CO_WORKSPACE_ANTIGRAVITY_BIN_PREFIX: "agy CLI is not installed in the gateway image; runtime only usable on a bare-metal run",
  CO_WORKSPACE_BROKER_PORT: "docker socket broker env — set on the docker-broker service in docker-compose.isolation.yml, not on the gateway",
  CO_WORKSPACE_BROKER_SOCKET: "docker socket broker env — set on the docker-broker service in docker-compose.isolation.yml, not on the gateway",
  CO_WORKSPACE_BROKER_MAX_CONN: "docker socket broker env — set on the docker-broker service in docker-compose.isolation.yml, not on the gateway",
};

/** Vars read by src/ but intentionally NOT documented in .env.sample. */
const SAMPLE_EXEMPT: Record<string, string> = {
  CO_WORKSPACE_HOST: "pinned to 0.0.0.0 by compose; loopback publish is the access control",
  CO_WORKSPACE_PORT: "container port is fixed at 9030 to match the compose publish mapping",
  CO_WORKSPACE_DATA_DIR: "pinned to /data by compose; operators set CO_WORKSPACE_DATA_DIR_HOST instead",
  CO_WORKSPACE_WORKSPACE_DIR: "pinned to /workspace by compose; operators set CO_WORKSPACE_WORKSPACE_DIR_HOST instead",
  CO_WORKSPACE_API_KEYS_FILE: "pinned to /seed/.env.keys by compose; operators set CO_WORKSPACE_API_KEYS_FILE_HOST instead",
  HERMES_BIN_PREFIX: "command wrapper for bare-metal runs only; not applicable to the compose deployment",
  CO_WORKSPACE_CLAUDE_BIN: "runtime binary override for bare-metal runs; not runnable in the compose image",
  CO_WORKSPACE_CODEX_BIN: "runtime binary override for bare-metal runs; not runnable in the compose image",
  CO_WORKSPACE_ANTIGRAVITY_BIN: "runtime binary override for bare-metal runs; not runnable in the compose image",
  CO_WORKSPACE_ANTIGRAVITY_BIN_PREFIX: "runtime binary override for bare-metal runs; not runnable in the compose image",
};

/** Env vars a source string READS (assignments like `env.X = ...` are child-process writes, skipped). */
export function collectReadVars(src: string): Set<string> {
  const out = new Set<string>();
  const re = new RegExp(`\\benv(?:\\.(${NAME})\\b|\\[\\s*["'\`](${NAME})["'\`]\\s*\\])(\\s*=(?!=))?`, "g");
  for (const m of src.matchAll(re)) {
    if (m[3]) continue; // write
    out.add((m[1] ?? m[2])!);
  }
  return out;
}

/** Names set in the compose `environment:` block (list-of-keys form `NAME:`). */
export function collectComposeVars(yml: string): Set<string> {
  const out = new Set<string>();
  const lines = yml.split("\n");
  let inEnv = false;
  for (const line of lines) {
    if (/^\s+environment:\s*$/.test(line)) { inEnv = true; continue; }
    if (inEnv) {
      if (/^\s*#/.test(line) || line.trim() === "") continue;
      const m = line.match(/^\s+([A-Z][A-Z0-9_]*):/);
      if (m) out.add(m[1]!);
      else inEnv = false;
    }
  }
  return out;
}

/** Names documented in .env.sample (`NAME=` or commented `#NAME=`). */
export function collectSampleVars(sample: string): Set<string> {
  const out = new Set<string>();
  for (const m of sample.matchAll(/^\s*#?\s*([A-Z][A-Z0-9_]*)=/gm)) out.add(m[1]!);
  return out;
}

/** Backticked var names anywhere in the README (config table + prose). */
export function collectReadmeVars(md: string): Set<string> {
  const out = new Set<string>();
  for (const m of md.matchAll(/`((?:CO_WORKSPACE_|HERMES_|GOOGLE_)[A-Z0-9_]*)`/g)) out.add(m[1]!);
  return out;
}

/** Returns human-readable problems; empty = parity holds. */
export function checkParity(
  read: Set<string>,
  surface: Set<string>,
  exempt: Record<string, string>,
  surfaceFile: string,
  exemptMapName: string,
): string[] {
  const problems: string[] = [];
  for (const v of [...read].sort()) {
    if (!surface.has(v) && !(v in exempt)) {
      problems.push(`${v} is read by services/co-workspace/src but missing from ${surfaceFile}: add it there, or add it to ${exemptMapName} in tests/unit/co-workspace-env-parity.test.ts with a reason`);
    }
  }
  for (const [v, reason] of Object.entries(exempt)) {
    if (!reason.trim()) problems.push(`${exemptMapName} entry ${v} has no reason`);
    if (!read.has(v)) problems.push(`stale ${exemptMapName} entry ${v}: no longer read by src/ — remove it from tests/unit/co-workspace-env-parity.test.ts`);
    else if (surface.has(v)) problems.push(`stale ${exemptMapName} entry ${v}: now present in ${surfaceFile} — remove it from ${exemptMapName} in tests/unit/co-workspace-env-parity.test.ts`);
  }
  return problems;
}

describe("checkParity / collectors (synthetic inputs)", () => {
  test("collectReadVars finds reads, skips writes and provider keys", () => {
    const src = `
      const a = env.CO_WORKSPACE_A ?? "x";
      const b = process.env.HERMES_B;
      const c = env["GOOGLE_C"];
      env.HERMES_W = "child";
      env.ZAI_API_KEY = k; const d = env.OPENAI_API_KEY;
      if (env.CO_WORKSPACE_E === "1") {}
    `;
    expect([...collectReadVars(src)].sort()).toEqual(["CO_WORKSPACE_A", "CO_WORKSPACE_E", "GOOGLE_C", "HERMES_B"]);
  });

  test("a var read but absent from the surface FAILS, naming var and file", () => {
    const read = collectReadVars("const x = env.CO_WORKSPACE_FAKE_VAR;");
    const p = checkParity(read, new Set(), {}, COMPOSE_REL, "COMPOSE_EXEMPT");
    expect(p).toHaveLength(1);
    expect(p[0]).toContain("CO_WORKSPACE_FAKE_VAR");
    expect(p[0]).toContain(COMPOSE_REL);
  });

  test("a stale exemption FAILS (var no longer read, or now on the surface)", () => {
    const gone = checkParity(new Set(), new Set(), { CO_WORKSPACE_OLD: "why" }, SAMPLE_REL, "SAMPLE_EXEMPT");
    expect(gone[0]).toContain("stale");
    const present = checkParity(new Set(["CO_WORKSPACE_X"]), new Set(["CO_WORKSPACE_X"]), { CO_WORKSPACE_X: "why" }, SAMPLE_REL, "SAMPLE_EXEMPT");
    expect(present[0]).toContain("now present");
    expect(checkParity(new Set(["A"]), new Set(), { A: " " }, SAMPLE_REL, "SAMPLE_EXEMPT")[0]).toContain("no reason");
  });

  test("compose and sample collectors", () => {
    const yml = "services:\n  s:\n    environment:\n      # c\n      CO_WORKSPACE_A: ${CO_WORKSPACE_A:-1}\n      HERMES_B: x\n    volumes:\n      - FOO:/x\n";
    expect([...collectComposeVars(yml)].sort()).toEqual(["CO_WORKSPACE_A", "HERMES_B"]);
    expect([...collectSampleVars("A_B=1\n#C_D=2\n# prose no equals\n")].sort()).toEqual(["A_B", "C_D"]);
  });
});

describe("co-workspace env parity (real files)", () => {
  const srcDir = join(SVC, "src");
  const read = new Set<string>();
  // Recursive: route handlers live in src/routes/ (M12 split) and must be scanned too.
  const files = (readdirSync(srcDir, { recursive: true }) as string[])
    .map((f) => f.replaceAll("\\", "/"))
    .filter((f) => f.endsWith(".ts"));
  for (const f of files) {
    for (const v of collectReadVars(readFileSync(join(srcDir, f), "utf8"))) read.add(v);
  }
  const compose = collectComposeVars(readFileSync(join(SVC, "docker/docker-compose.yml"), "utf8"));
  const composeSurface = new Set([
    ...compose,
    ...collectComposeVars(readFileSync(join(SVC, "docker/docker-compose.volume.yml"), "utf8")),
  ]);
  const sample = collectSampleVars(readFileSync(join(SVC, "docker/.env.sample"), "utf8"));

  test("scanner sees the service's env surface", () => {
    expect(read.size).toBeGreaterThan(30);
    expect(read.has("CO_WORKSPACE_COOKIE_SECURE")).toBe(true);
    expect(files).toContain("routes/auth.ts"); // subdirectories are scanned
  });

  test("every read var is passed through docker-compose.yml (+ volume override) or exempt", () => {
    expect(checkParity(read, composeSurface, COMPOSE_EXEMPT, COMPOSE_REL, "COMPOSE_EXEMPT")).toEqual([]);
  });

  test("every read var is documented in .env.sample or exempt", () => {
    expect(checkParity(read, sample, SAMPLE_EXEMPT, SAMPLE_REL, "SAMPLE_EXEMPT")).toEqual([]);
  });

  // T-20261003-014 (2026-10-03 review H9): the README config table is the operator doc —
  // a var the code reads must be documented there or explicitly exempted with a reason.
  const README_EXEMPT: Record<string, string> = {
    CO_WORKSPACE_BROKER_PORT: "docker-broker-internal env — set on the broker service in docker-compose.isolation.yml, documented in its header comments",
    CO_WORKSPACE_BROKER_SOCKET: "docker-broker-internal env — socket path inside the broker container, not an operator knob in the README",
    CO_WORKSPACE_BROKER_MAX_CONN: "docker-broker-internal env — connection cap, documented in docker-compose.isolation.yml comments",
  };
  const readme = collectReadmeVars(readFileSync(join(SVC, "README.md"), "utf8"));
  test("every read var is documented in README.md or exempt (T-20261003-014)", () => {
    expect(checkParity(read, readme, README_EXEMPT, README_REL, "README_EXEMPT")).toEqual([]);
  });
});
