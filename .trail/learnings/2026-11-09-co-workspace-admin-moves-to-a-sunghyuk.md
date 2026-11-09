---
title: co-workspace admin moves to a standalone user- and group-centric console
author: SungHyuk
date: 2026-11-09
branch: main
cost: { minutes: 1, tokens: 1376 }
id: l-fb35cc7a
scope: repo
status: active
src: agent
touches:
  - services/co-workspace/src/migrations.ts
---

## Decided
- The admin surface becomes a separate /admin page (web/admin.html + admin.js) with a left-nav menu. It is no longer a panel inside the chat SPA.
- Management centers on users and groups: group CRUD and membership, bulk user actions (CSV import/export included), group-level policies (maxTenants/maxTurns/maxTokens/allowedVariants, strictest wins across a user's groups, falling back to global env), and owner/group tenant views with bulk archive/delete.
- Reuse the existing tenant-loop groups/user_groups tables. A `kind` column (loop|general) distinguishes the two uses; there is no new parallel group store.

## Tried and ruled out
- Tabs inside index.html: rejected because the admin code keeps growing in the chat SPA, and an independent menu structure with deep links was the goal.

## Watch out
- Tenant-loop export must only see kind='loop' groups, or general groups leak into the loop registry.
- A user in no policy-bearing group falls through to the global env quotas. Keep that fallback so existing deployments are unaffected.

In the code: services/co-workspace/src/migrations.ts (step v3), src/users.ts groups methods, src/access.ts assertTenantCap/assertQuota, src/routes/admin.ts; spec docs/superpowers/specs/2026-11-09-gw-admin-console-design.md
