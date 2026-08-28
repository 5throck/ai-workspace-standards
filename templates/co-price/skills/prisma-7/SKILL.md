---
name: prisma-7
scope: co-price
description: Prisma 7 ORM schema management and migration
version: "2.0.0"
last_reviewed: 2026-08-25
status: active
owner: lead-architect
prerequisites: user approval for schema changes (AGENTS.md §4.2)
---

# Prisma 7 Specialized Skill (`prisma-7`)

## 1. Description
Database schema design, migration management, and persistence layer optimization using Prisma.

## 2. Trigger Criteria
- "Modify DB schema"
- "Update Prisma model"
- "Create migration"

## 3. Allowed Tools
- `write_to_file`
- `run_command` (for `bunx prisma db push` or `bunx prisma generate`)

## 4. Behavior Rules
- Always prioritize relational normalization.
- Ensure `.prisma` files are syntactically correct for Prisma v7+.
- Do not bypass Zod schema synchronizations when updating models.

## 5. Expected Output
Updated `schema.prisma` file and successful DB synchronization.
## Context

See [docs/co-price.context.md](../docs/co-price.context.md) for project context and the consulting engagement lifecycle.

## When to Use

- When a co-price task requires **Prisma 7 ORM schema management and migration** within the engagement lifecycle.

## Execution Steps

1. **Receive dispatch** from PM with task parameters and document anchors.
2. **Execute** the skill procedure against the artifacts named in the task scope.
3. **Report** results to the dispatching agent with evidence links.

## Output Format

Structured markdown report delivered to the dispatching agent, citing document anchors (for example `[Ref: biz_logic.*]`) where applicable.

## Related Skills

- Owner agent: `lead-architect`. See `variant.json` skills registry for the full co-price skill set.
