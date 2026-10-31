# Patterns

Reusable runtime and architecture shapes **proven in a variant project** and
recorded here so other variants can adopt them without rediscovering the
design. A pattern is documentation only: it names the mechanism, cites its
variant provenance (ADR + verified file:line pointers), and gives an adoption
checklist - each variant implements against its own stack.

## Genre boundaries

| Genre | Directory | Answers |
|-------|-----------|---------|
| **Pattern** (this directory) | `docs/patterns/` | "What is a proven runtime shape other variants should reuse?" |
| Guide | `docs/guides/` | "How does an operator run a procedure in this workspace?" |
| ADR | `docs/adr/` | "What did THIS workspace decide, and why?" |
| Architecture note | `docs/architecture/` | "How is this workspace itself structured?" |

A pattern is not a workspace decision (that is an ADR) and not an operator
procedure (that is a guide). It is a distilled, variant-proven shape.

## Promotion-deferral boundary

Patterns do not ship code. A pattern graduates to a shared primitive
(`scripts/`), a scaffold asset (`templates/`), or a fleet skill only when its
own recorded trigger fires - by default: a **second variant independently
demands the same shape**, or the upstream implementation stabilizes at
P2+. Each pattern states its own triggers in its promotion-deferral section, so
every deferral is auditable. Until graduation, the provenance paths are the
reference implementation.

## Format

Every pattern file carries: version (`X.Y.Z`), status, provenance (variant +
ADR), a **When to adopt** section, the pattern's shape (each mechanism with
source pointers), an **Adoption checklist**, and a **Promotion-deferral**
section. Keep patterns implementation-neutral: describe the mechanism and its
invariants, not one variant's business specifics.

## Index

| Pattern | Version | Status | Provenance |
|---------|---------|--------|------------|
| [scheduled-jobs-runtime-pattern.md](scheduled-jobs-runtime-pattern.md) | 1.0.0 | Reference (promotion deferred) | co-newbiz ADR-0189 |
