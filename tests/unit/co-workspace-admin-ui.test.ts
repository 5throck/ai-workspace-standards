/**
 * Admin UI pins for the tenant-loop section of the co-workspace web app (design
 * 2026-11-08-gw-tenant-loop-and-hardening-design §4 — the admin-UI half; the API half is
 * pinned by co-workspace-tenant-loop-acl.test.ts):
 *   (a) index.html carries the section ids, the fetch paths verbatim, the fail-closed
 *       empty-state text, and the kill-switch banner;
 *   (b) every mutating tenant-loop fetch sends x-requested-with (SEC-09);
 *   (c) the register form's client-side validation (gw-<12hex>, windows, config JSON) is a
 *       pure function in app-helpers.js mirroring src/tenant-loop.ts;
 *   (d) the dry-run → confirm upgrade flow is gated structurally on a prior plan render.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  LOOP_SCOPE_KEYS,
  TENANT_ID_RE,
  createUpgradeFlow,
  validateLoopConfigJson,
  validateLoopWindowsClient,
  validateTenantId,
} from "../../services/co-workspace/web/app-helpers.js";
import { TENANT_ID_RE as SERVER_TENANT_ID_RE } from "../../services/co-workspace/src/tenant-loop";

const webDir = join(import.meta.dir, "..", "..", "services", "co-workspace", "web");
const html = readFileSync(join(webDir, "index.html"), "utf8");

/** Every `fetch(...)` call in `source`, up to its matching close paren. */
function fetchCalls(source: string): string[] {
  const calls: string[] = [];
  for (const m of source.matchAll(/fetch\(/g)) {
    let depth = 0;
    let end = m.index! + "fetch".length;
    for (; end < source.length; end++) {
      if (source[end] === "(") depth++;
      else if (source[end] === ")" && --depth === 0) break;
    }
    calls.push(source.slice(m.index!, end + 1));
  }
  return calls;
}

describe("(a) tenant-loop section markup + fetch paths", () => {
  test("section ids are present in the admin view", () => {
    for (const id of [
      "tl-banner",
      "tl-body",
      "tl-registry",
      "tl-refresh",
      "tl-fresh",
      "tl-empty",
      "tl-rows",
      "tl-register",
      "tl-reg-pick",
      "tl-reg-id",
      "tl-reg-group",
      "tl-reg-tz",
      "tl-reg-start",
      "tl-reg-end",
      "tl-reg-remote",
      "tl-reg-url",
      "tl-reg-submit",
      "tl-reg-err",
      "tl-config",
      "tl-config-json",
      "tl-config-validate",
      "tl-config-save",
      "tl-config-err",
      "tl-status",
    ]) {
      expect(html, id).toContain(`id="${id}"`);
    }
    for (const k of LOOP_SCOPE_KEYS) expect(html).toContain(`id="tl-reg-scope-${k}"`);
    // Day checkboxes are generated (Sun..Sat → tl-reg-day-0..6).
    expect(html).toContain('id="tl-reg-day-${i}"');
  });

  test("fetch paths match the admin API verbatim (no invented endpoints)", () => {
    expect(html).toContain('fetch("/admin/tenant-loop/registry")');
    expect(html).toContain('fetch("/admin/tenant-loop/config", { method: "PUT"');
    expect(html).toContain("`/admin/tenant-loop/tenants/${encodeURIComponent(tenantId)}/${op}`");
    for (const op of ["register", "suspend", "deregister", "upgrade"]) {
      expect(html, op).toMatch(new RegExp(`tlPost\\([^)]*"${op}"`));
    }
    // No other /admin/tenant-loop paths exist on the server (routes/admin.ts).
    const paths = [...html.matchAll(/\/admin\/tenant-loop\/[\w/${}.()]+/g)].map((m) => m[0]);
    for (const p of paths) {
      expect(p, p).toMatch(/^\/admin\/tenant-loop\/(registry|config|tenants\/\$\{encodeURIComponent\(tenantId\)\}\/\$\{op\})/);
    }
  });

  test("empty state explains the fail-closed behavior; kill-switch banner names the env var", () => {
    expect(html).toContain("no registry export — the gateway writes it here after config changes; readers treat absence as zero tenants");
    expect(html).toContain("disabled via CO_WORKSPACE_TENANT_LOOP_DISABLED");
    // The banner is driven by the typed error code, not by status alone.
    expect(html).toContain('body?.code !== "tenant_loop_disabled"');
  });

  test("every tenant-loop input carries a label", () => {
    const section = html.slice(html.indexOf('id="tl-register"'), html.indexOf('id="tl-status"'));
    for (const m of section.matchAll(/<(input|select|textarea)\b[^>]*\bid="([^"]+)"/g)) {
      const [, tag, id] = m;
      // Checkboxes are wrapped by their <label>; every other control has a for= label.
      const wrapped = tag === "input" && /type="checkbox"/.test(m[0]);
      if (!wrapped) expect(section, id).toContain(`for="${id}"`);
    }
  });

  test("the inline module script still parses", () => {
    const script = html.slice(html.indexOf('<script type="module">') + '<script type="module">'.length, html.lastIndexOf("</script>"));
    expect(() => new Bun.Transpiler({ loader: "js" }).transformSync(script)).not.toThrow();
  });
});

describe("(b) SEC-09: mutating tenant-loop calls send x-requested-with", () => {
  test("the shared tenant-loop headers carry the CSRF header", () => {
    const start = html.indexOf("// ── Tenant loop (design 2026-11-08");
    const section = html.slice(start, html.indexOf("tlLoadRegistry();\n  });", start));
    const def = section.match(/const authHeaders = (\{[^}]*\})/);
    expect(def, "tenant-loop authHeaders definition").not.toBeNull();
    expect(def![1]).toContain('"x-requested-with": "co-workspace"');
  });

  test("every POST/PUT fetch in the tenant-loop code uses authHeaders or the header literal", () => {
    const start = html.indexOf("// ── Tenant loop (design 2026-11-08");
    const section = html.slice(start, html.indexOf("tlLoadRegistry();\n  });", start));
    const mutating = fetchCalls(section).filter((c) => /method:\s*"(POST|PUT|PATCH|DELETE)"/.test(c));
    expect(mutating.length).toBeGreaterThanOrEqual(2); // tlPost (POST) + config (PUT)
    for (const call of mutating) expect(call, call.slice(0, 90)).toMatch(/authHeaders|x-requested-with/);
  });
});

describe("(c) register-form client validation (pure, app-helpers.js)", () => {
  test("TENANT_ID_RE mirrors the gateway's regex exactly", () => {
    expect(TENANT_ID_RE.source).toBe(SERVER_TENANT_ID_RE.source);
    expect(TENANT_ID_RE.flags).toBe(SERVER_TENANT_ID_RE.flags);
  });

  test("validateTenantId accepts gw-<12 lowercase hex> only", () => {
    expect(validateTenantId("gw-0123456789ab")).toBeNull();
    for (const bad of ["", "gw-0123456789a", "gw-0123456789abc", "gw-0123456789AB", "co-0123456789ab", " gw-0123456789ab", "gw-01234567890g", undefined, 42]) {
      expect(validateTenantId(bad as never), String(bad)).toContain("gw-");
    }
  });

  test("the register handler validates the id before posting", () => {
    const submit = html.slice(html.indexOf('querySelector("#tl-reg-submit")'));
    expect(submit.indexOf("validateTenantId(id)")).toBeGreaterThan(-1);
    expect(submit.indexOf("validateTenantId(id)")).toBeLessThan(submit.indexOf('tlPost(id, "register"'));
  });

  test("LOOP_SCOPE_KEYS are the four server scope keys", () => {
    expect([...LOOP_SCOPE_KEYS].sort()).toEqual(["backportReview", "nightlyFleet", "upgrade", "upstreamFile"]);
  });

  test("validateLoopWindowsClient mirrors validateLoopWindows", () => {
    const ok = { tz: "Asia/Seoul", days: [0, 1, 2, 3, 4, 5, 6], start: "00:00", end: "23:59" };
    expect(validateLoopWindowsClient(ok)).toBeNull();
    expect(validateLoopWindowsClient({ ...ok, start: "22:00", end: "06:00" })).toBeNull(); // wrap-midnight is valid
    expect(validateLoopWindowsClient({ ...ok, tz: "Mars/Olympus" })).toContain("windows.tz");
    expect(validateLoopWindowsClient({ ...ok, days: [] })).toContain("windows.days");
    expect(validateLoopWindowsClient({ ...ok, days: [7] })).toContain("windows.days");
    expect(validateLoopWindowsClient({ ...ok, days: [1.5] })).toContain("windows.days");
    expect(validateLoopWindowsClient({ ...ok, start: "24:00" })).toContain("windows.start");
    expect(validateLoopWindowsClient({ ...ok, end: "9:00" })).toContain("windows.end");
    expect(validateLoopWindowsClient({ ...ok, end: "00:00" })).toContain("must differ");
    expect(validateLoopWindowsClient(null)).toContain("JSON object");
    expect(validateLoopWindowsClient([ok])).toContain("JSON object");
  });

  test("validateLoopConfigJson preflights the PUT /admin/tenant-loop/config body", () => {
    const good = validateLoopConfigJson(JSON.stringify({ group: "team-a", designatedUsers: ["alice"], scopes: { upgrade: true } }));
    expect(good).toEqual({ ok: true, value: { group: "team-a", designatedUsers: ["alice"], scopes: { upgrade: true } } });
    expect(validateLoopConfigJson("{}")).toEqual({ ok: true, value: {} }); // group defaults server-side
    expect(validateLoopConfigJson("{not json")).toEqual({ ok: false, error: "config must be valid JSON" });
    expect(validateLoopConfigJson("[]")).toEqual({ ok: false, error: "config must be a JSON object" });
    expect(validateLoopConfigJson(JSON.stringify({ group: "bad group!" })).ok).toBe(false);
    expect(validateLoopConfigJson(JSON.stringify({ designatedUsers: [""] })).ok).toBe(false);
    expect(validateLoopConfigJson(JSON.stringify({ scopes: { deploy: true } }))).toEqual({
      ok: false,
      error: 'unknown scope key "deploy" (allowed: upgrade, upstreamFile, backportReview, nightlyFleet)',
    });
    expect(validateLoopConfigJson(JSON.stringify({ scopes: { upgrade: "yes" } }))).toEqual({ ok: false, error: 'scope "upgrade" must be a boolean' });
    const win = validateLoopConfigJson(JSON.stringify({ windows: { tz: "UTC", days: [1], start: "09:00", end: "09:00" } }));
    expect(win).toEqual({ ok: false, error: "windows.start and windows.end must differ" });
  });
});

describe("(d) dry-run → confirm upgrade gate", () => {
  const plan = { tenantId: "gw-0123456789ab", dryRun: true, snapshotBranch: "tenant-backup/20261109T000000Z" };

  test("no confirm before a plan is rendered", () => {
    const flow = createUpgradeFlow();
    expect(flow.pendingTenantId()).toBeNull();
    expect(flow.confirmAllowed("gw-0123456789ab")).toBe(false);
    expect(flow.consume("gw-0123456789ab")).toBe(false);
  });

  test("only a dry-run plan arms the confirm", () => {
    const flow = createUpgradeFlow();
    expect(flow.offerPlan("gw-0123456789ab", { ...plan, dryRun: false })).toBe(false);
    expect(flow.offerPlan("gw-0123456789ab", { exitCode: 0 })).toBe(false); // an execution payload is not a plan
    expect(flow.offerPlan("gw-0123456789ab", null)).toBe(false);
    expect(flow.confirmAllowed("gw-0123456789ab")).toBe(false);
  });

  test("the confirm is tenant-scoped and single-use", () => {
    const flow = createUpgradeFlow();
    expect(flow.offerPlan("gw-0123456789ab", plan)).toBe(true);
    expect(flow.pendingTenantId()).toBe("gw-0123456789ab");
    expect(flow.confirmAllowed("gw-ffffffffffff")).toBe(false);
    expect(flow.confirmAllowed("gw-0123456789ab")).toBe(true);
    expect(flow.consume("gw-ffffffffffff")).toBe(false);
    expect(flow.consume("gw-0123456789ab")).toBe(true);
    expect(flow.confirmAllowed("gw-0123456789ab")).toBe(false);
  });

  test("a failed re-plan disarms a previously armed confirm", () => {
    const flow = createUpgradeFlow();
    flow.offerPlan("gw-0123456789ab", plan);
    flow.offerPlan("gw-0123456789ab", { error: "quota" });
    expect(flow.confirmAllowed("gw-0123456789ab")).toBe(false);
  });

  test("index.html: the confirm call sits behind offerPlan + confirmAllowed", () => {
    const fn = html.slice(html.indexOf("async function tlUpgrade("));
    const offer = fn.indexOf("tlUpgradeFlow.offerPlan(tenantId, body)");
    const render = fn.indexOf("dry-run plan`");
    const gate = fn.indexOf("if (!tlUpgradeFlow.confirmAllowed(tenantId)) return;");
    const confirm = fn.indexOf('tlPost(tenantId, "upgrade", { confirm: true })');
    expect(offer).toBeGreaterThan(-1);
    expect(render).toBeGreaterThan(offer); // the plan modal renders only after offerPlan accepted it
    expect(gate).toBeGreaterThan(render);
    expect(confirm).toBeGreaterThan(gate); // the confirm POST is unreachable without the gate
    // The dry-run call carries no confirm flag.
    expect(fn).toContain('tlPost(tenantId, "upgrade", {})');
    // Exactly one confirm call site in the page.
    expect([...html.matchAll(/confirm: true/g)]).toHaveLength(1);
  });
});
