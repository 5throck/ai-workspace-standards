/**
 * Shared-team loop integration (design docs/designs/2026-11-09-gw-shared-teams-design.md
 * §10, D-S8, verification table row 5): a shared team is covered DIRECTLY by its owning
 * group's (group_id, variant) enrollment — the owner-membership check maps to "the group
 * owns the team"; the export row's principal stays the `group:<id>` owner string (the
 * workspace reader accepts any non-empty principal — pinned against
 * scripts/lib/fleet.ts validateTenantLoopRegistryPayload); a member's personal team stays
 * fail-closed (not exported without its own coverage); and a shared-team delete refreshes
 * the export. Fixtures under absolute tmpdir roots (T-20261104-003).
 */

import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../../services/co-workspace/src/config";
import { createState, deleteTenantData } from "../../services/co-workspace/src/server";
import type { GatewayState } from "../../services/co-workspace/src/state";
import { buildTenantLoopExport, groupMembershipInputs, resolveEnrollment, tenantLoopRegistryPath, type LoopEnrollmentInput } from "../../services/co-workspace/src/tenant-loop";
import type { TenantRecord } from "../../services/co-workspace/src/tenant";
import { DEFAULT_LOOP_SCOPES, DEFAULT_LOOP_WINDOWS } from "../../services/co-workspace/src/tenant-loop";
import { validateTenantLoopRegistryPayload } from "../../scripts/lib/fleet";

const ROOTS: string[] = [];
const CLOSEABLE: Array<{ close(): void }> = [];

afterAll(() => {
  for (const handle of CLOSEABLE) {
    try {
      handle.close();
    } catch {
      /* best effort */
    }
  }
  for (const dir of ROOTS) rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

function makeState(name: string): { state: GatewayState; root: string } {
  const root = mkdtempSync(join(tmpdir(), `gw-st-loop-${name}-`));
  ROOTS.push(root);
  const state = createState(
    loadConfig({
      CO_WORKSPACE_DATA_DIR: join(root, "data"),
      CO_WORKSPACE_WORKSPACE_DIR: root, // the export lands at <workspaceDir>/.pipeline-state/
      CO_WORKSPACE_VARIANTS: "co-consult,co-develop",
    }),
  );
  for (const store of [state.registry, state.turns, state.users, state.audit]) CLOSEABLE.push(store);
  return { state, root };
}

function enrollment(groupId: string, variant: string, status: "active" | "suspended" = "active"): LoopEnrollmentInput {
  return { groupId, variant, status, scopes: { ...DEFAULT_LOOP_SCOPES }, windows: { ...DEFAULT_LOOP_WINDOWS }, gitRemote: "local-only" };
}

function sharedRecord(state: GatewayState, groupId: string, variant = "co-consult"): TenantRecord {
  return state.registry.create({
    variant,
    key: `${variant}::group:${groupId}`,
    ownerPrincipal: `group:${groupId}`,
    teamKind: "shared",
    ownerGroup: groupId,
  });
}

describe("resolveEnrollment — group-owned teams (D-S8)", () => {
  test("an active (group, variant) enrollment covers the group's shared team directly", () => {
    const resolution = resolveEnrollment(
      { ownerPrincipal: "group:team-a", variant: "co-consult" } as TenantRecord,
      [enrollment("team-a", "co-consult")],
      [], // NO membership rows: the synthetic owner is a member of nothing — ownership suffices
    );
    expect(resolution.covered).toBe(true);
    expect(resolution.coveringGroups).toEqual(["team-a"]);
  });

  test("the '*' wildcard variant covers every variant of the group's team", () => {
    const resolution = resolveEnrollment(
      { ownerPrincipal: "group:team-a", variant: "co-develop" } as TenantRecord,
      [enrollment("team-a", "*")],
      [],
    );
    expect(resolution.covered).toBe(true);
  });

  test("suspended, other-group and other-variant enrollments do not cover (fail-closed)", () => {
    const tenant = { ownerPrincipal: "group:team-a", variant: "co-consult" } as TenantRecord;
    expect(resolveEnrollment(tenant, [enrollment("team-a", "co-consult", "suspended")], []).covered).toBe(false);
    expect(resolveEnrollment(tenant, [enrollment("team-b", "co-consult")], []).covered).toBe(false);
    expect(resolveEnrollment(tenant, [enrollment("team-a", "co-develop")], []).covered).toBe(false);
    const bare = resolveEnrollment(tenant, [], []);
    expect(bare.covered).toBe(false);
    expect(bare.reason).toBe("not_covered");
    expect(bare.detail).toContain("owning group team-a");
  });

  test("a principal-owner tenant still resolves through group MEMBERSHIP (round-2 rule unchanged)", () => {
    const resolution = resolveEnrollment(
      { ownerPrincipal: "alice", variant: "co-consult" } as TenantRecord,
      [enrollment("team-a", "co-consult")],
      [{ groupId: "team-a", principals: ["alice"] }],
    );
    expect(resolution.covered).toBe(true);
    expect(resolution.coveringGroups).toEqual(["team-a"]);
  });
});

describe("export integration — shared rows and the reader contract", () => {
  test("export row principal = group:<id>; unenrolled principals stay fail-closed; the fleet reader accepts the row", async () => {
    const { state, root } = makeState("export");
    state.users.createGroup({ groupId: "team-a", name: "Team A" });
    const alice = state.users.createUser({ email: "alice@example.test", name: "alice", password: null });
    const outsider = state.users.createUser({ email: "oscar@example.test", name: "oscar", password: null });
    state.users.addMembers("team-a", [alice!.principal]);
    state.users.setEnrollment("team-a", "co-consult", { status: "active", scopes: { ...DEFAULT_LOOP_SCOPES }, windows: { ...DEFAULT_LOOP_WINDOWS } });

    const shared = sharedRecord(state, "team-a");
    // Alice's PERSONAL team: covered by her group's enrollment (round-2 unit model — a group
    // enrollment covers "all of its tenants, including new ones", members' personal teams
    // included). The row's principal stays alice.
    state.registry.create({ variant: "co-consult", key: `co-consult::${alice!.principal}`, ownerPrincipal: alice!.principal });
    // Oscar is in NO enrolled group — fail-closed, not exported.
    state.registry.create({ variant: "co-consult", key: `co-consult::${outsider!.principal}`, ownerPrincipal: outsider!.principal });

    const result = await import("../../services/co-workspace/src/tenant-loop").then((m) => m.exportTenantLoopRegistry(state));
    expect(result.ok).toBe(true);
    const payload = JSON.parse(readFileSync(tenantLoopRegistryPath(root), "utf8")) as {
      tenants: Array<{ id: string; principal: string; variant: string }>;
    };
    expect(payload.tenants).toHaveLength(2);
    const sharedRow = payload.tenants.find((t) => t.id === shared.tenantId)!;
    expect(sharedRow.principal).toBe("group:team-a");
    expect(sharedRow.variant).toBe("co-consult");
    expect(payload.tenants.some((t) => t.principal === outsider!.principal)).toBe(false);

    // The workspace-side reader (scripts/lib/fleet.ts, non-empty principal contract) parses it.
    const verdict = validateTenantLoopRegistryPayload(payload, Date.now());
    expect(verdict.ok).toBe(true);
  });

  test("shared-team delete refreshes the export (deleteTenantData emits for shared deletes too)", async () => {
    const { state, root } = makeState("delete-refresh");
    state.users.createGroup({ groupId: "team-a", name: "Team A" });
    state.users.setEnrollment("team-a", "co-consult", { status: "active", scopes: { ...DEFAULT_LOOP_SCOPES }, windows: { ...DEFAULT_LOOP_WINDOWS } });
    const shared = sharedRecord(state, "team-a");
    mkdirSync(shared.projectDir, { recursive: true });
    mkdirSync(shared.hermesHome, { recursive: true });
    expect(existsSync(tenantLoopRegistryPath(root))).toBe(false);
    // First export: the shared row is present.
    await import("../../services/co-workspace/src/tenant-loop").then((m) => m.exportTenantLoopRegistry(state));
    expect((JSON.parse(readFileSync(tenantLoopRegistryPath(root), "utf8")) as { tenants: unknown[] }).tenants).toHaveLength(1);

    await deleteTenantData(state, state.registry.get(shared.tenantId)!, "alice");

    // The delete path rewrote the export: the row is gone, the file still valid.
    const after = JSON.parse(readFileSync(tenantLoopRegistryPath(root), "utf8")) as { tenants: unknown[] };
    expect(after.tenants).toHaveLength(0);
    expect(state.registry.get(shared.tenantId)).toBeUndefined();
    const audit = state.audit.query({ action: "tenant.delete" }).entries.find((e) => e.target === shared.tenantId);
    expect(audit?.detail).toContain("owner=group:team-a");
  });

  test("buildTenantLoopExport covers a shared team under '*' enrollments without any membership row", () => {
    const { state } = makeState("star");
    state.users.createGroup({ groupId: "team-a", name: "Team A" });
    state.users.setEnrollment("team-a", "*", { status: "active", scopes: { ...DEFAULT_LOOP_SCOPES }, windows: { ...DEFAULT_LOOP_WINDOWS } });
    const shared = sharedRecord(state, "team-a", "co-develop");
    const payload = buildTenantLoopExport(
      state.registry.list(),
      {
        enrollments: state.users.listEnrollments(),
        groupMemberships: groupMembershipInputs(state.users.groupMembershipList()),
      },
    );
    expect(payload.tenants.map((t) => t.id)).toEqual([shared.tenantId]);
    expect(payload.tenants[0].principal).toBe("group:team-a");
  });
});
