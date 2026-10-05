# Spec Registry Entries-as-SSOT Design (One-File-Per-Spec Projection)

- **Date**: 2026-10-05
- **Status**: Implemented (2026-10-05 — delivered with the entries store, the auto-migration, the projection regeneration, the audit drift arm, and the regression tests in the same change set)
- **Owner**: Automation Engineer (design + implementation)
- **Spec id**: `2026-10-05-spec-registry-entries-projection-design` (registry: `docs/specs/registry.json`, source: `manual`)
- **Ticket**: T-20261005-005 (the optional direction named in T-20261005-002, whose canonical-order fix shipped as PR #1425)
- **Related ADRs**: ADR-0074 (Universal Design Gate)

---

## 1. Summary

PR #1425 made spec-registry insertion content-derived, but two registrations whose ids fall into the same alphabetical gap of the committed base (typically same-day neighbors — the common case) still collide at line level on a simultaneous push. This change removes the shared mutable artifact from the judgment path entirely: **`docs/specs/entries/<spec-id>.json` becomes the single source of truth (one file per spec entry), and `docs/specs/registry.json` becomes a committed generated projection** rebuilt from the entry files. The projection keeps its path and shape, so every existing reader — `audit.ts` spec-check, `spec-hygiene-sweep.ts`, `spec-backfill.ts`, `design-lint.ts`, `workspace-integration.ts`, `scaffold-markers.ts` (project seeding), and the delivered project-side copies — works unchanged.

## 2. Mechanism

| Piece | Behavior |
|-------|----------|
| `docs/specs/entries/<id>.json` (new SSOT) | One pretty-printed `SpecEntry` object per file. Concurrent registrations write disjoint files — the judgment content can never conflict. |
| `loadRegistry()` (changed, v1.6.0) | Builds the registry from the entries directory when it has files; falls back to parsing `registry.json` when the directory is absent (legacy and not-yet-migrated projects). |
| `registerSpec()` / `--update` (changed) | Upsert the entry **file**, then regenerate the projection. Regeneration migrates by **union**: projection entries without an entry file are split into files on every rebuild, so the first CRUD in a legacy tree auto-migrates even though its own entry file was written first — and a partial state self-heals instead of propagating (the fallback-ordered first cut of this design erased the live projection pre-commit; caught by the post-registration count check, restored from git, and pinned by the union recovery test). |
| `--regenerate` (new CLI flag) | Rebuild the projection from the entries directory (auto-migrating first). Deterministic: same entries → byte-identical projection. |
| `saveRegistry()` (unchanged semantics) | Canonical sort + projection write; external `loadRegistry`/`saveRegistry` importers keep working on the projection. |
| `insertSpecSorted()` (removed) | Superseded by regeneration; nothing else imported it. |
| `canonicalOrderViolation()` + audit **Check 5** (kept) | Still fails a hand-ordered projection. |
| audit **Check 5b** (new, v2.50.0) | When the entries directory exists: the projection must match the entry-file id set exactly — a stale projection (entry file landed without regeneration, e.g. after a merge) FAILs with the one-command fix. Absent directory → skipped (legacy projects). |

## 3. Merge model after this change

- **Different-gap concurrent registrations**: both the entry files (always disjoint) and the projection edits (different regions) merge clean — no change from #1425.
- **Same-gap concurrent registrations** (the #1425 residual): the entry files still merge clean; the projection conflicts. Resolution is now **one mechanical command** — `bun scripts/spec-register.ts --regenerate` rebuilds the projection from the union of entry files — replacing judgment-based hand-splicing. Accepted as the residual; a custom git merge driver for the projection was considered and deferred (per-clone `git config` wiring makes it unreliable on fresh clones/CI; the command path is deterministic and scriptable).

## 4. Migration

This design's own registration executed the live migration: the committed registry's entries were split into `docs/specs/entries/*.json` and the projection regenerated. The projection diff contains only the new entry; the entry files are additive. Project-side copies migrate lazily — the delivered `spec-register` auto-migrates on the project's next registration, and `--regenerate` works standalone. `upgrade-project` delivery of `docs/specs/registry.json` is an add-if-missing seed (unchanged); no delivery change is required.

## 5. Verification

1. `bun test tests/unit/spec-registry-canonical-order.test.ts` — rewritten for the entries model: upsert/regenerate round-trip in a temp dir, migration split, projection determinism, canonical-order predicate, and the same-gap two-writer pin (disjoint files + deterministic union).
2. End-to-end git acceptance in a scratch repo: two branches registering **same-gap** ids → entry files merge clean, projection conflicts, `--regenerate` resolves mechanically, final projection sorted with both entries.
3. `bun scripts/audit.ts --spec-check` — Check 5 + 5b pass on the migrated live registry; `typecheck`, `verify-scripts --verify`, lifecycle audit green.

## 6. Non-goals

- **Custom git merge driver for the projection** — deferred (per-clone config fragility); `--regenerate` is the supported resolution.
- **Un-committing the projection** (gitignored, generated at read time) — every reader would need a generation step; the committed projection preserves the zero-reader-change property.
- No change to `--list`, spec-hygiene-sweep, spec-backfill, or project seeding.
