/**
 * Admin console pins for the round-2 unit-model surface (design
 * docs/designs/2026-11-09-gw-admin-console-round2-plan.md, "2026-11-09 unit-model
 * amendment" — named policies with group-only assignments, (group, variant) loop
 * enrollments, no per-tenant loop state). These pins read web/admin.js and web/admin.html:
 *   (a) the rebuilt sections carry their ids, the fetch paths verbatim (no invented or
 *       410'd endpoints), the kill-switch banner, and the covered-only registry text;
 *   (b) every mutating call sends x-requested-with, and reauth'd verbs carry
 *       x-admin-password per request (SEC-09 + the round-2 reauth matrix);
 *   (c) the policy-limits and enrollment-form validators are pure functions in
 *       app-helpers.js mirroring src/policy.ts and src/tenant-loop.ts;
 *   (d) the dry-run → confirm upgrade flow is gated structurally on a prior plan render;
 *   (e) index.html no longer carries the admin panel, and #adminMenu links to /admin.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  LOOP_SCOPE_KEYS,
  POLICY_NUMERIC_KEYS,
  buildEnrollmentPayload,
  createUpgradeFlow,
  validateLoopWindowsClient,
  validatePolicyLimits,
} from "../../services/co-workspace/web/app-helpers.js";

const webDir = join(import.meta.dir, "..", "..", "services", "co-workspace", "web");
/** The admin console script: holds the rebuilt sections and the rest of the console. */
const html = readFileSync(join(webDir, "admin.js"), "utf8");
const adminPage = readFileSync(join(webDir, "admin.html"), "utf8");
const indexPage = readFileSync(join(webDir, "index.html"), "utf8");

/** The tenant-loop section source (kill-switch banner through the enrollments page). */
function tenantLoopSection(): string {
  const start = html.indexOf("// ── Tenant Loop (round-2 unit model");
  expect(start, "tenant-loop section marker").toBeGreaterThan(-1);
  const end = html.indexOf("// ── end Tenant loop", start);
  return html.slice(start, end);
}

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

describe("(a) rebuilt sections: markup, fetch paths, no 410'd references", () => {
  test("tenant-loop section ids are present", () => {
    for (const id of [
      "tl-banner",
      "tl-body",
      "tl-enroll",
      "tl-en-group",
      "tl-en-variant",
      "tl-en-submit",
      "tl-en-err",
      "tl-enrollments",
      "tl-en-rows",
      "tl-en-empty",
      "tl-en-status",
      "tl-preview",
      "tl-preview-title",
      "tl-preview-body",
      "tl-registry",
      "tl-refresh",
      "tl-fresh",
      "tl-empty",
      "tl-rows",
      "tl-status",
    ]) {
      expect(html, id).toContain(`id="${id}"`);
    }
  });

  test("the enrollment form is shared between the Tenant Loop page and the group detail tab", () => {
    expect(html).toContain('enrollmentFormHtml("tl-en")');
    expect(html).toContain('enrollmentFormHtml("gl-en")');
    // The generator emits one scope checkbox per server scope key and one day checkbox
    // per weekday (Sun..Sat → <p>-day-0..6), with a for= label for every control.
    expect(html).toContain('id="${p}-scope-${k}"');
    expect(html).toContain('id="${p}-day-${i}"');
    const gen = html.slice(html.indexOf("function enrollmentFormHtml("), html.indexOf("function readEnrollmentForm("));
    for (const m of gen.matchAll(/<(input|select|textarea)\b[^>]*\bid="([^"]+)"/g)) {
      const [, tag, id] = m;
      // Checkboxes are wrapped by their <label>; every other control has a for= label.
      const wrapped = tag === "input" && /type="checkbox"/.test(m[0]);
      if (!wrapped) expect(gen, id).toContain(`for="${id}"`);
    }
  });

  test("fetch paths match the round-2 admin API verbatim (no invented endpoints)", () => {
    const section = tenantLoopSection();
    expect(section).toContain('fetch("/admin/tenant-loop/enrollments")');
    expect(section).toContain('fetch("/admin/tenant-loop/registry")');
    // PUT/DELETE enrollments are keyed (group, variant) and built by enrollmentApi
    // (defined in the shared loop-enrollment pieces, used by both enroll surfaces).
    expect(html).toContain("function enrollmentApi(groupId, variant, { method, body, password })");
    expect(html).toContain("`/admin/tenant-loop/enrollments/${encodeURIComponent(groupId)}/${encodeURIComponent(variant)}`");
    expect(section).toContain("{ method: \"PUT\", body: { status: \"active\", ...parsed.value }, password }");
    // The resolved-coverage preview carries BOTH query params — from the enrollments table
    // and from the group detail's Tenant-loop tab.
    expect(section).toContain("`/admin/tenant-loop/preview?groupId=${encodeURIComponent(e.groupId)}&variant=${encodeURIComponent(e.variant)}`");
    expect(html).toContain("`/admin/tenant-loop/preview?groupId=${encodeURIComponent(group.groupId)}&variant=${encodeURIComponent(variant)}`");
    // The only per-tenant op left is upgrade (dry-run + confirm).
    expect(section).toContain('tlPost(tenantId, "upgrade", {})');
    // The 410'd routes have no client references left.
    for (const gone of ["tenant-loop/config", "tl-reg-", "tl-config", '"register"', '"deregister"', "data-tl-suspend", "data-tl-dereg"]) {
      expect(section, gone).not.toContain(gone);
    }
    const paths = [...section.matchAll(/\/admin\/tenant-loop\/[\w/${}.()?&="]+/g)].map((m) => m[0]);
    for (const p of paths) {
      expect(p, p).toMatch(
        /^\/admin\/tenant-loop\/(registry|enrollments|preview\?groupId=|tenants\/\$\{encodeURIComponent\(tenantId\)\}\/\$\{op\})/,
      );
    }
  });

  test("the group-create modal is slug-free with per-field inline errors", () => {
    for (const id of ["cg-name", "cg-desc", "cg-name-err", "cg-desc-err", "cg-err"]) {
      expect(html, id).toContain(`id="${id}"`);
    }
    // Name + description ONLY — the server generates the id as a slug of the name.
    expect(html).toContain("body: { name, description: description || undefined }");
    // Errors render inline in the modal (never the disappearing flash), and success opens
    // the new group's Members tab.
    const fn = html.slice(html.indexOf("function createGroupFlow("), html.indexOf("async function editGroupFlow("));
    expect(fn).not.toMatch(/body:\s*\{\s*groupId/); // the create payload carries no manual id
    expect(fn).toContain('"#cg-name-err"');
    expect(fn).toContain('location.hash = `#/groups/${encodeURIComponent(data.groupId)}/members`');
    expect(fn).not.toContain("flash(");
  });

  test("the group detail carries the three tabs (Members / Policies / Tenant loop)", () => {
    for (const tab of ["members", "policies", "loop"]) {
      expect(html, tab).toContain(`href="#/groups/\${enc}/${tab}"`);
    }
    // The old per-group policy blob route (now 410) is never called, and no kind badge is
    // rendered anywhere (loop/general merged).
    expect(html).not.toContain("/policy\"");
    expect(html).not.toContain("${g.kind}");
  });

  test("policies CRUD fetch paths + form fields", () => {
    expect(html).toContain('api("/admin/policies", { method: "POST", body })');
    expect(html).toContain("`/admin/policies/${encodeURIComponent(policy.policyId)}`, { method: \"PATCH\"");
    expect(html).toContain("`/admin/policies/${encodeURIComponent(policyId)}`, { method: \"DELETE\", password }");
    expect(html).toContain("`/admin/policies/${encodeURIComponent(policyId)}/assignments`, { method: \"DELETE\"");
    expect(html).toContain("`/admin/policies/${encodeURIComponent(policy.policyId)}/assignments`, { method: \"POST\"");
    // A field per limit (4 numerics) plus the allowedVariants MULTI-select from the catalog.
    expect(html).toContain('id="pf-${key}"'); // the per-limit inputs are generated per key
    expect(html).toContain("POLICY_NUMERIC.map(([key, label, hint])");
    expect(html).toContain('<select id="pf-variants" multiple');
    // Inline error slots on the policy form, the group-assign picker and the detail page.
    for (const id of ["pf-name-err", "pf-err", "gp-err", "pa-err", "pd-err"]) {
      expect(html, id).toContain(`id="${id}"`);
    }
    // Assignment bodies are {groupId} only (group-only targets).
    expect(html).toContain("body: { groupId: group.groupId }");
    expect(html).toContain("body: { groupId }");
    expect(html).not.toContain("targets:");
  });

  test("the '*' wildcard variant option is offered by both enroll forms", () => {
    expect([...html.matchAll(/option\("\*", "\* \(all variants\)"/g)].length).toBe(2);
  });

  test("the user drawer shows the loop membership line and the flat policy sources", () => {
    expect(html).toContain("<h3>Loop membership</h3>");
    expect(html).toContain('api("/admin/tenant-loop/enrollments")');
    // Effective-policy sources are PolicySourceRef[] (policyName + via group) — read view,
    // no per-user assignment UI.
    expect(html).toContain("pol.sources ?? []");
    expect(html).toContain("via ${esc(s.via)}");
    expect(html).not.toContain("pol.sources?.[");
  });

  test("empty state explains the covered-only registry; kill-switch banner names the env var", () => {
    expect(html).toContain("no covered tenants in the export");
    expect(html).toContain("disabled via CO_WORKSPACE_TENANT_LOOP_DISABLED");
    // The banner is driven by the typed error code, not by status alone.
    expect(html).toContain('body?.code !== "tenant_loop_disabled"');
  });

  test("admin.js still parses as plain JS and the page loads it as a module", () => {
    expect(() => new Bun.Transpiler({ loader: "js" }).transformSync(html)).not.toThrow();
    expect(adminPage).toContain('<script type="module" src="/admin.js"></script>');
  });
});

describe("(b) SEC-09: CSRF header + the round-2 reauth matrix", () => {
  test("the shared tenant-loop headers carry the CSRF header", () => {
    const section = tenantLoopSection();
    const def = section.match(/const authHeaders = (\{[^}]*\})/);
    expect(def, "tenant-loop authHeaders definition").not.toBeNull();
    expect(def![1]).toContain('"x-requested-with": "co-workspace"');
  });

  test("every POST/PUT raw fetch in the tenant-loop section uses authHeaders or the header literal", () => {
    const section = tenantLoopSection();
    const mutating = fetchCalls(section).filter((c) => /method:\s*"(POST|PUT|PATCH|DELETE)"/.test(c));
    expect(mutating.length).toBeGreaterThanOrEqual(1); // tlPost (the upgrade POST)
    for (const call of mutating) expect(call, call.slice(0, 90)).toMatch(/authHeaders|x-requested-with/);
  });

  test("the api() transport itself sends x-requested-with and per-request x-admin-password", () => {
    expect(html).toContain('headers["x-requested-with"] = "co-workspace"');
    expect(html).toContain('headers["x-admin-password"] = password');
  });

  test("reauth'd verbs ask for the password before the call: enrollments PUT/DELETE, policy PATCH/assignments", () => {
    const section = tenantLoopSection();
    const toggle = section.slice(section.indexOf("async function tlEnrollmentAction("));
    const ask = toggle.indexOf("await askPassword(");
    const put = toggle.indexOf('{ method: "PUT", body: { status: next');
    const del = toggle.indexOf('{ method: "DELETE", password }');
    expect(ask).toBeGreaterThan(-1);
    expect(put).toBeGreaterThan(ask);
    expect(del).toBeGreaterThan(ask);
    // The enrollment PUT body is COMPLETE (status + scopes + windows) — no default fill.
    expect(toggle).toContain("body: { status: next, scopes: e.scopes, windows: e.windows, gitRemote: e.gitRemote }");
    // Policy edit re-confirms before the PATCH.
    const modal = html.slice(html.indexOf("async function policyModal("), html.indexOf("async function deletePolicyFlow("));
    const editAsk = modal.indexOf("await askPassword(");
    const patch = modal.indexOf('{ method: "PATCH"');
    expect(editAsk).toBeGreaterThan(-1);
    expect(patch).toBeGreaterThan(editAsk);
  });
});

describe("(c) form validators (pure, app-helpers.js)", () => {
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

  test("validatePolicyLimits serializes the 5-limit policy form (mirror of validateGroupPolicy)", () => {
    // Unset fields are omitted; valid integers pass through.
    expect(validatePolicyLimits({}, [])).toEqual({ ok: true, limits: {} });
    expect(validatePolicyLimits({ maxTenants: "5", maxTurns: "", maxTokens: null }, [])).toEqual({ ok: true, limits: { maxTenants: 5 } });
    expect(validatePolicyLimits({ maxTurns: 12, maxPrincipalTokens: "3000000" }, ["co-develop", "co-develop"])).toEqual({
      ok: true,
      limits: { maxTurns: 12, maxPrincipalTokens: 3_000_000, allowedVariants: ["co-develop"] },
    });
    // A policy can only tighten: 0, negatives, non-integers and junk are refused.
    // (Whitespace-only reads as "unset" — the form treats it as an empty field.)
    for (const bad of ["0", "-1", "2.5", "abc"]) {
      expect(validatePolicyLimits({ maxTenants: bad }, []).ok, bad).toBe(false);
    }
    expect(validatePolicyLimits({ maxTenants: " " }, [])).toEqual({ ok: true, limits: {} });
    expect(validatePolicyLimits({}, ["co-develop"]).ok).toBe(true);
    expect(validatePolicyLimits({}, [" "]).ok).toBe(false);
    expect(validatePolicyLimits({ maxTokens: "3" }, [])).toEqual({ ok: true, limits: { maxTokens: 3 } });
    // The error names the offending field for the inline slot.
    expect(validatePolicyLimits({ maxPrincipalTokens: "0" }, []).error).toContain("maxPrincipalTokens");
  });

  test("buildEnrollmentPayload emits COMPLETE scopes/windows and mirrors the gitRemote rule", () => {
    const windows = { tz: "Asia/Seoul", days: [1, 3], start: "09:00", end: "18:00" };
    const full = buildEnrollmentPayload({ upgrade: true }, windows, "local-only", "");
    expect(full).toEqual({
      ok: true,
      value: {
        // Every scope key is present (no default fill server-side): unchecked = false.
        scopes: { upgrade: true, upstreamFile: false, backportReview: false, nightlyFleet: false },
        windows: { tz: "Asia/Seoul", days: [1, 3], start: "09:00", end: "18:00" },
        gitRemote: null,
      },
    });
    const url = buildEnrollmentPayload({}, windows, "url", " https://git.example.team/team/project.git ");
    expect(url.ok).toBe(true);
    if (url.ok) expect(url.value.gitRemote).toBe("https://git.example.team/team/project.git");
    // A remote URL is required when the choice is 'url'; windows errors surface verbatim.
    expect(buildEnrollmentPayload({}, windows, "url", "  ").error).toContain("remote URL");
    expect(buildEnrollmentPayload({}, { ...windows, end: "09:00" }, "local-only", "").error).toContain("must differ");
    expect(buildEnrollmentPayload({}, { ...windows, days: [] }, "local-only", "").error).toContain("windows.days");
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

  test("admin.js: the confirm call sits behind offerPlan + confirmAllowed", () => {
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

describe("(e) the admin panel moved out of index.html", () => {
  test("index.html carries no admin panel markup, helpers, or tenant-loop code", () => {
    for (const marker of ["adminView", "tenant-loop", "tl-register", "userRows", "askAdminPassword", "barChart", "donutChart"]) {
      expect(indexPage, marker).not.toContain(marker);
    }
  });

  test("#adminMenu is a plain link to /admin", () => {
    expect(indexPage).toContain('<a id="adminMenu" class="gws-hidden" href="/admin">');
  });

  test("admin.html carries every nav route and the shared container", () => {
    for (const route of ["dashboard", "users", "groups", "tenants", "policies", "tenant-loop", "audit", "system"]) {
      expect(adminPage, route).toContain(`href="#/${route}"`);
    }
    expect(adminPage).toContain('id="view"');
    expect(html).toContain('from "./app-helpers.js"');
  });
});
