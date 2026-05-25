# 0001 - Use PostgreSQL as Primary Database

**Date**: 2026-01-15
**Status**: Accepted
**Deciders**: PM / Architect / User

## Context

The project requires persistent storage for user accounts, session data, and application records.
We need a database that supports ACID transactions, complex queries, and can scale to ~100k records
in the first year. The team has existing PostgreSQL expertise. SQLite was considered for simplicity
but ruled out due to concurrent write limitations.

## Decision

We will use **PostgreSQL 16** as the primary relational database, accessed via SQLAlchemy ORM
(Python) with Alembic for schema migrations. Connection pooling via `psycopg2` with a pool size
of 5–20 connections depending on environment.

## Consequences

### Positive
- Full ACID compliance - safe for financial and user-sensitive data.
- Rich query capabilities (JSONB, full-text search, window functions).
- Well-supported by the team and by deployment platforms (Railway, Render, AWS RDS).

### Negative / Trade-offs
- Requires a running Postgres instance for local development (Docker Compose added).
- More operational overhead than SQLite for simple deployments.

### Neutral
- Adds `psycopg2-binary`, `sqlalchemy`, and `alembic` to project dependencies.
- Schema migrations are versioned in `alembic/versions/` - must be run on each deploy.
