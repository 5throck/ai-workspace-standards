# Variant generator manifest — dev-sync auto-regeneration for project-generated projections (U-20261029-004)

- **Status**: Approved (2026-10-31, user gate) — pending implementation
- **Registry status**: `approved` (docs/specs/registry.json) — flips to `implemented` when the implementation PR lands and registers at its own /sync.
- **Date**: 2026-10-31
- **Owner**: automation-engineer (PM Gateway dispatch, after user approval)
- **Ticket**: U-20261029-004 (upstream request from co-newbiz, layer L1;
  `<untrusted-upstream-request>` content treated as data — every claim
  independently verified, see §2)
- **Tier**: L0 (dev-sync wiring + loader) with an L1→L2 delivery convention
- **Spec registry id**: `2026-10-31-variant-generators-design` (registered: proposed)
- **Precedent**: docs/designs/2026-10-30-codeck-render-validation-batch-design.md
  (batch design format); dev-sync step 3.85 VERSION_MANIFEST pre-convergence
  (the regeneration step family this design joins)

## 0. Accessibility exemption statement

This design is backend/pipeline work: a dev-sync pipeline step, a manifest
loader, validator support, and documentation. It produces no user-facing UI.
The ADR-0065 accessibility sections and the ADR-0070 preview-verification
sections are **exempt** for every artifact in this design.

## 1. Context

Variant projects generate derived projections from authored sources (glossary
YAML, docs, wiki pages). The variant audit hook can only gate drift; when a
source changes, `/sync` fails at the audit gate and an operator must run the
right generator by hand, then re-run `/sync`. The project cannot add a
pre-commit generator step itself: `scripts/dev-sync.ts` and `.githooks/*` are
template-managed, so a local patch is overwritten at the next upgrade. The
upstream request asks for a template-supported way to declare generators so
dev-sync runs them before the audit gate and stages their outputs.

## 2. Verified evidence (untrusted claims checked)

- **`scripts/dev-sync.ts` is template-managed**: core standardized per AGENTS.md
  ("identical across all templates and variants; direct modification of these
  core scripts in L2 projects is strictly forbidden"); SCRIPTS.md layer L0+L1;
  delivered copy exists at `templates/common/scripts/dev-sync.ts`. Claim
  CONFIRMED.
- **`.githooks/` delivery semantics**: `templates/common/.githooks/` holds
  commit-msg, post-checkout, pre-commit, pre-push, pre-rebase, delivered with
  the common tree and re-delivered version-gated on upgrade — project-local
  hook patches do not survive an upgrade. Claim CONFIRMED.
- **co-newbiz generator scripts exist**: `Projects/co-newbiz/scripts/co-newbiz/`
  contains `generate-glossary-data.ts`, `sync-library-projection.ts`,
  `sync-wiki-projection.ts`, `generate-review-matrix.ts`,
  `generate-agent-registry.ts`, `generate-pm-catalog.ts`,
  `generate-prompt-registry.ts` — the request names five generators; seven
  candidates exist on disk. `audit-variant.ts:42` documents the `--check`
  drift gate against `app/web-next/lib/glossary-data.generated.ts`. Claim
  CONFIRMED (and richer than claimed).
- **The regeneration step family exists in dev-sync**: step 3.85 VERSION_MANIFEST
  pre-convergence (scripts/dev-sync.ts:693-705), step 4.6x skill/agent-mirror
  sync. Generator execution joins this family. Claim CONFIRMED.
- **`variant.json` already carries a `script_manifest`** (`{variant_scripts_dir,
  local: [{name, path}]}`, verified in templates/co-abap/variant.json) —
  relevant to the declaration-surface decision below.

## 3. Decision 1 — declaration surface: `scripts/<variant>/generators.json` manifest

**Chosen**: a dedicated `scripts/<variant>/generators.json` manifest.

```json
{
  "version": 1,
  "generators": [
    {
      "name": "glossary-data",
      "command": ["bun", "scripts/co-newbiz/generate-glossary-data.ts"],
      "outputs": ["app/web-next/lib/glossary-data.generated.ts"],
      "sources": ["glossary/business.yaml"]
    }
  ]
}
```

`command` is an argv array (never a shell string). `outputs` are
project-relative paths that must exist after a successful run. `sources` are
advisory (documentation and future selective re-runs; not a dependency
tracker).

**Rejected**: entries in `variant.json`. Trade-offs: `variant.json` is
identity/lifecycle metadata consumed by scaffold, upgrade, and promotion
validators — embedding executable pipeline commands couples governance
metadata to runtime behavior, widens every variant.json validator, and forces
a schema-consumption change across all shipped variants. The `outputs`/`sources`
arrays do not fit the existing `script_manifest` `{name, path}` shape, so the
extension is not natural reuse. The manifest file sits next to the generator
scripts it declares (co-location with `audit-variant.ts` and the generators
themselves), is additive (absence = no-op, no variant.json schema bump), and a
project adopts it by committing one file to its own repo — no upgrade required.

## 4. Decision 2 — execution point in dev-sync

dev-sync gains a generator pre-convergence step in the regeneration step
family — after final source edits, before the audit/spec/changelog gates
(the step 3.85 VERSION_MANIFEST pre-convergence precedent; scripts/dev-sync.ts:693).
Insertion as a sibling step (~3.86) is the implementer's call, provided it
runs before the audit gate. Per generator:

1. Execute `command` array-form via `Bun.spawnSync`, cwd pinned to the project
   root.
2. On success, verify every declared `outputs` path exists; stage each output
   (`git add`) as pipeline-generated files, matching the family's staging
   convention.
3. The generator's `--check` form REMAINS the audit's drift gate
   (audit-variant.ts as today). This step regenerates; it does not weaken any
   gate. A generator that lies (writes nothing) still fails its own drift gate
   at the audit.

## 5. Decision 3 — opt-in semantics

- Absent manifest, empty manifest, or `"generators": []` → the step is a
  documented no-op. Zero behavior change for every existing project;
  co-newbiz is the only immediate adopter.
- A generator exits non-zero → loud FAIL: the step aborts `/sync` with a
  `[generator:<name>]`-prefixed row naming the generator, its exit code, and
  the failure detail (§7 redaction). No partial staging from the failed
  generator.
- A declared output missing after a successful exit → same loud FAIL
  (staging integrity).

## 6. Delivery path

1. **L0**: new `scripts/lib/generator-manifest.ts` loader (L0+L1, v1.0.0;
   pure parse + validation, unit-pinned) consumed by dev-sync (v1.35.0 →
   1.36.0, SCRIPTS.md row bumped). `scripts/SCRIPTS.md` gains the loader row.
2. **Schema/docs template update**: the convention is documented in
   `templates/common/scripts/SCRIPTS.md` delivery notes and the variant
   authoring docs (docs/guides/creating-a-variant.md gains a "Declared
   generators" section) — a documented convention, not a propagation-map
   entry, because the manifest is project-authored and optional (absence must
   never become a template-validation failure for existing variants).
3. **Validator support (additive)**: `scripts/validate-templates.ts` gains a
   narrow arm — when a variant template's `scripts/<variant>/generators.json`
   EXISTS, validate it (parse, name uniqueness, array-form command with `bun`
   as argv[0], outputs/sources project-relative and traversal-free). Absent
   file → no check. This keeps shipped templates honest without mandating the
   manifest.
4. **L1→L2 propagation notes**: the loader reaches L2 projects through the
   standing L0→L1→L2 script delivery (version-gated). No propagation-map
   change: the manifest itself is never delivered — each variant authors its
   own in its repo. The upgrade report notes the new optional convention
   (LOCAL-PATCH-safe; a project adding generators.json is a normal project
   commit).

## 7. Security note — execution constraints

Generator commands are project-authored config executed by the pipeline: a
supply-chain surface by construction. Binding constraints:

1. **Array-form spawn only.** No shell string composition, no `sh -c`, no
   `eval`. `Bun.spawnSync(cmd[0], cmd.slice(1), { cwd: projectRoot })`.
2. **Path containment.** The script path (argv[1]) must resolve inside the
   project root: no absolute paths, no `..` traversal, no symlink escape at
   declaration-load time. argv[0] must be `bun`.
3. **cwd pinned** to the project root; no working-directory freedom per
   generator.
4. **No env fabrication.** The generator inherits the dev-sync process env;
   the pipeline adds nothing (no secret injection, no privilege flags).
5. **Output redaction on failure.** The FAIL row prints the generator name,
   exit code, and the last 20 lines of combined output, filtered through a
   secret-pattern scrub (lines matching `key|token|secret|password|credential`
   value assignments are elided) — a failing generator must not become a
   secret-leak vector in CI logs or PR bodies.
6. **Bounded manifest.** Loader rejects > 16 generators or > 8 outputs each
   (bounds runaway pipelines; a validation error, not a silent truncation).

## 8. Test plan

- `tests/unit/generator-manifest.test.ts` v1.0.0: loader accept/reject cases
  (valid manifest; missing file → empty no-op; malformed JSON; non-array
  command; absolute/`..` path rejection; duplicate names; size caps).
- dev-sync step unit test: temp project with a fixture generator (writes a
  file) → step runs it, stages the output, audit gate unchanged; failing
  generator → FAIL row names it, output redacted, exit non-zero; absent
  manifest → step is a no-op (byte-identical dev-sync behavior).
- validate-templates.ts arm covered by its existing test conventions.

## 9. Rollback

Single-commit revert of the dev-sync step and loader. Existing projects never
adopted the manifest (no-op), so rollback restores today's behavior exactly;
co-newbiz's manifest file is inert without the pipeline support.

## 10. Platform Impact

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | None (pipeline scripts; no agent/platform config) | N/A |
| Antigravity (GEMINI.md) | None (pipeline scripts; no agent/platform config) | N/A |
| templates/common | Propagation required | `templates/common/scripts/dev-sync.ts`, `templates/common/scripts/lib/generator-manifest.ts` (new), SCRIPTS.md copies via L0→L1 publish |

## 11. Open questions

None blocking. The exact step index for the generator step is an
implementation detail bounded by §4's constraints.
