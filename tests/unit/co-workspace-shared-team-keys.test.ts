/**
 * Shared-team key namespace pins (design docs/designs/2026-11-09-gw-shared-teams-design.md
 * §3-§4, D-S1/D-S2, verification table row 1): the shared key format, the namespace collision
 * guard (a group id equal to a principal never produces the same key), and the personal
 * branch's byte-identity with today's output. Pure unit — no fixtures, no IO.
 */

import { describe, expect, test } from "bun:test";
import {
  groupOwnerPrincipalFor,
  isSharedTeam,
  sharedTeamKeyFor,
  tenantKeyFor,
} from "../../services/co-workspace/src/lifecycle";
import type { TenantRecord } from "../../services/co-workspace/src/tenant";

describe("shared-team key namespace (D-S1/D-S2)", () => {
  test("personal branch byte-identity: tenantKeyFor output is unchanged", () => {
    expect(tenantKeyFor("co-consult", "alice")).toBe("co-consult::alice");
    expect(tenantKeyFor("co-develop", "u-0123456789abcdef")).toBe("co-develop::u-0123456789abcdef");
    expect(tenantKeyFor("co-consult", "anonymous")).toBe("co-consult::anonymous");
  });

  test("shared key format: <variant>::group:<group_id>", () => {
    expect(sharedTeamKeyFor("co-consult", "team-a")).toBe("co-consult::group:team-a");
    expect(sharedTeamKeyFor("co-develop", "g-1a2b3c4d")).toBe("co-develop::group:g-1a2b3c4d");
  });

  test("namespace collision guard: a group id equal to a principal yields DISTINCT keys", () => {
    // Group ids and principals share the [a-z0-9-] character space (users.ts:310 login rule
    // vs routes/admin/groups.ts:13 GROUP_ID_RE) — without the `group:` prefix,
    // `<variant>::acme` would be ambiguous. With it, the namespaces are disjoint.
    const principal = "acme";
    const groupId = "acme";
    expect(tenantKeyFor("co-consult", principal)).toBe("co-consult::acme");
    expect(sharedTeamKeyFor("co-consult", groupId)).toBe("co-consult::group:acme");
    expect(tenantKeyFor("co-consult", principal)).not.toBe(sharedTeamKeyFor("co-consult", groupId));
  });

  test("the synthetic group owner principal carries the group: prefix", () => {
    expect(groupOwnerPrincipalFor("team-a")).toBe("group:team-a");
    // The prefix is what keeps a synthetic owner from ever equaling a real principal —
    // principals cannot contain a colon (login-id rule allows only [a-z0-9-]).
    expect(groupOwnerPrincipalFor("alice")).not.toBe("alice");
  });

  test("isSharedTeam: unset teamKind (legacy row) reads as personal", () => {
    const legacy = { tenantId: "gw-0123456789ab" } as TenantRecord;
    expect(isSharedTeam(legacy)).toBe(false);
    expect(isSharedTeam({ teamKind: "personal" } as TenantRecord)).toBe(false);
    expect(isSharedTeam({ teamKind: "shared" } as TenantRecord)).toBe(true);
  });
});
