---
name: Database Migration
owner: automation-engineer
status: active
description: >
  Use when running, rolling back, or generating Alembic database migrations.
  Trigger on: "run migrations", "create migration", "rollback migration",
  "alembic", or any task that modifies the database schema.
version: 1.0.0
---

## Overview

This skill guides the AI through safe database migration workflows using Alembic.
It ensures migrations are generated correctly, reviewed before running, and rolled
back cleanly if needed.

## Generate a Migration

**Purpose**: Create a new migration file from ORM model changes.
**Trigger**: ORM model was modified and schema needs to be updated.

**Steps**:
1. Verify the virtual environment is active: `which python` should point to `.venv/`
2. Run autogenerate: `alembic revision --autogenerate -m "describe the change"`
3. **Review the generated file** in `alembic/versions/` - autogenerate is not always correct
4. Check for: missing `op.create_index`, incorrect column types, missing `nullable` changes
5. Report the generated file path and a summary of what it will do

**Output**: Path to the new migration file + summary of schema changes.

## Run Migrations

**Purpose**: Apply pending migrations to the database.
**Trigger**: Deployment, local setup after clone, or after generating a new migration.

**Steps**:
1. Confirm `DATABASE_URL` is set in environment: `echo $DATABASE_URL`
2. Show pending migrations: `alembic history --indicate-current`
3. Run: `alembic upgrade head`
4. Verify: `alembic current` should show the latest revision

**Output**: Confirmation of which revision is now current.

## Rollback a Migration

**Purpose**: Undo the most recent migration.
**Trigger**: Migration caused issues, need to revert schema change.

**Steps**:
1. Show current state: `alembic current`
2. Roll back one step: `alembic downgrade -1`
3. Verify: `alembic current` should show the previous revision
4. ⚠️ Warn if data loss is possible (e.g., dropping a column)

**Output**: Confirmation of rolled-back revision + any data loss warnings.
