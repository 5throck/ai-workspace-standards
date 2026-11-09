---
title: "co-workspace admin round 2: named policies assigned to groups and users, and tenant loop driven by group or user enrollment"
author: SungHyuk
date: 2026-11-09
branch: main
cost: { minutes: 53, tokens: 376061 }
id: l-6dd2d324
scope: repo
status: active
src: agent
touches:
  - CHANGELOG.md
  - docs/VERSION_MANIFEST.md
  - memory/2026-11-09.md
  - services/co-workspace/src/auth.ts
  - tests/unit/co-workspace-admin-page.test.ts
  - tests/unit/co-workspace-admin-console.test.ts
  - docs/designs/2026-11-09-gw-admin-console-design.md
  - services/co-workspace/src/access.ts
---

## Decided
- Policies become standalone named objects with CRUD. They are assigned to groups and to individual users. A user's effective limit is the strictest of every policy assigned directly or through their groups, falling back to the global env limits.
- Tenant-loop groups merge into the ordinary user groups. A group or a user is enrolled in the loop with a schedule and scopes, and all of their tenants, including tenants created later, follow automatically. Per-tenant settings remain only as exceptions.
- The registry file the workspace reads stays a per-tenant list with an unchanged schema. Enrollment is resolved into tenant rows when the file is written, so workspace-side readers need no change.

## Tried and ruled out
- Keeping limits as a blob on each group and only making the Policies page editable: rejected because the same limits could not be reused or given to a single user.
- Keeping per-tenant loop registration and adding bulk actions by owner or group: rejected because new tenants would still need manual registration, which keeps the loop tenant-centric.

## Watch out
- The tenant-loop delegate check must still derive the governing group from the enrollment covering the tenant, never from a group named in the request. Naming a group in the request is the cross-group bypass that was fixed earlier.
- Group creation failing in round 1 was most likely the strict lowercase-ASCII group id; round 2 generates ids from the name.

In the code: services/co-workspace/src/policy.ts (effectivePolicyFor), src/tenant-loop.ts (buildTenantLoopExportDetailed, effectiveLoopConfig), src/access.ts (assertTenantLoopAllowed), src/routes/admin/groups.ts (GROUP_ID_RE); plan docs/designs/2026-11-09-gw-admin-console-round2-plan.md
