# Design: co-deck template presentations/ → deliverables/ migration (2026-11-15)

Decision: user instruction (translate: "the template must switch its presentations/ folder to deliverables, and the related content needs updating too"). This closes the exclusion recorded in
2026-11-15-co-deck-co-learning-backport-batch-design.md §R2 (html-build path-convention
flip deferred pending the scaffold-dir decision — the decision is now made).

## R1 — The fleet convention (superseding state)

The co-deck project workspace consolidated deck projects under
`deliverables/<project>/` with the shared pool at `deliverables/assets/
{images,diagrams,videos,fonts}` (present in Projects/co-deck since the
presentations→deliverables consolidation; already reflected in the project's
scripts' usage comments, skill docs, and html-build guidance). The template
still scaffolded `presentations/` — every scaffolded co-deck project started
with the retired convention.

## R2 — Change set

1. **Scaffold dir rename** (git mv): `templates/co-deck/presentations/` →
   `templates/co-deck/deliverables/`, seeds extended to
   `deliverables/assets/{images,diagrams,videos,fonts}/.gitkeep` (+ existing
   `_smoke_test/`).
2. **Wholesale copy from Projects/co-deck** (project supersedes; content
   verified path-only or improvement-bearing):
   - skills ×8 (html-build, research, design, prep-pdf, slide-layout-gate,
     presenter-mode, version, pdf-export) ×5 platform mirrors + skills/ —
     frontmatter versions identical (doc-only convention), so no registry/
     lifecycle churn.
   - scripts ×13 + lib/theme-builder.ts + tests ×9 — usage-comment path
     updates; `inject-video-players.ts` EXCLUDED (template ahead at v1.3.1).
   - docs: lecture-profile.md, html-themes/THEMES.md, decisions/gates.yaml,
     html-themes/baselines/README.md, adr/0002 + designs/2026-07-17
     (project-updated records).
3. **In-place word-swap** (presentations/ → deliverables/) for files carrying
   template-specific adaptations (AGENTS.md, variant.json, SCRIPTS.md,
   co-deck.context.md, user-guide ×2, agents/*.md ×10 with [Project Name]
   placeholders).
4. **Root script**: create-l3-scaffold.ts v1.21.0 — the lecture-type scaffold
   seeds `deliverables/` instead of `presentations/` (dir list, .gitkeep write,
   log lines); registry row + history comment updated. The consulting
   convention (`deliverables/presentations` subdir, line 755) is a different,
   untouched concept.
5. **Deliberate keep**: validate-image-manifest's legacy-path test pins the
   dual-convention rule — pre-migration projects with `presentations/` still
   lint clean (WARN/ERROR with migration hint, by design). Historical records
   (docs/designs/, docs/adr/ copies not updated by the project) keep their
   as-written paths.

## R3 — Non-goals

- No project-tree changes (projects already live on deliverables/).
- No frozen-project wave: existing projects receive the convention at their
  next upgrade visit (T-20261112-008 class).
- Prose uses of "presentations" (presentation decks, live presentations) are
  not paths and are untouched.

## Acceptance

- No path-shaped `presentations/` reference remains in templates/co-deck
  outside docs/designs/, docs/adr/ records and the validator's legacy-path
  test.
- audit --spec-check, validate-templates, verify-scripts, bun test all green.
- VERSION_MANIFEST regenerated (create-l3-scaffold 1.21.0).
