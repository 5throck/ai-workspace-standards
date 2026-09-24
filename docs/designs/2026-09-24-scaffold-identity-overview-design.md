# Scaffold Identity Overview Design

- **Date**: 2026-09-24
- **Status**: Implemented (2026-09-24 — delivered with the §13 upgrade seed step in the same change set)
- **Owner**: Template Architect (design) → Automation Engineer (implementation)
- **Related tickets**: T-20260909-007 (done, per-project placeholder WARN), T-20260924-004/007 (regrowth-prevention pattern), T-20260912-001 (CONTEXT PRESERVE origin)
- **Amendments**: 2026-09-24 — upgrade seed step after implementation conflict (§13, PM Ruling Option 1)

---

## 1. Background

The 2026-09-24 fleet audit of all 12 delivered `Projects/co-*/docs/context.md` copies found one structural gap. Every copy carries a "## Project Overview" section whose content is literal template residue. The two lines are the template's instructional placeholders, never replaced by any pipeline step:

- `[One-sentence description of what this project does and who it's for.]` — present in all 12 projects.
- `**Type**: web | cli | api | mcp` — present in all 12 projects, never narrowed to one value.

Eleven of 12 also still carry the literal title `# [Project Name] — Project Context`. Only `Projects/co-design` has a substituted title (`# co-design — Project Context`). Provenance files explain the split: `Projects/co-design/.claude/template-version.txt` records `created=2026-09-24T03:25:04Z` (new-project.ts scaffold); the other 11 record `upgraded=2026-09-23T11:10:…` (upgrade-project flow).

The audit verdict: the largest remaining self-containment gap is not template prose — it is that the scaffold never fills the one section that must be project-specific.

## 2. Diagnosis

### 2.1 Substitution history (why the Overview is never filled)

The scaffold's substitution map has no entry for the Overview placeholder text. `applySubstitutions()` (`scripts/helpers/substitute-placeholders.ts:57-67`) replaces `[Project Name]`, `{{PROJECT_NAME}}`, `{{PROJECT_DESCRIPTION}}`, `{{COUNTRY}}`, and `<variant-name>`. The Overview placeholders at `templates/common/docs/context.md:15,17` are instructional prose, not tokens, so no flow ever replaces them. Consequences:

- **new-project.ts path** (co-design): the whole-tree substitution pass (`scripts/new-project.ts:915-946`, helper invocation at `:939`) replaces the `[Project Name]` title. The Overview stays literal. This is the steady-state behavior of the current scaffold: title filled, Overview never filled.
- **Older creations and adopted projects** (the other 11): several predate reliable substitution, and co-abap's git history shows the title was once `co-abap — Project Context` and later **regressed** to `[Project Name]` (see 2.2). The audit-visible state is therefore a mix of "never substituted" and "substituted, then overwritten".

### 2.2 Upgrade behavior toward docs/context.md (why in-place identity is fragile)

`docs/context.md` is classified `claim.policy === 'SYNC'` in the TEMPLATE TREE SYNC pass. On a template footer bump or content change, `scripts/upgrade-project.ts:2312-2357` wholesale-copies the template over the project copy — unless the preserve guard fires:

- The guard calls `findProjectOnlySections()` (`scripts/helpers/context-sections.ts:636-656`, invoked at `scripts/upgrade-project.ts:2329`).
- The detector is **heading-presence-based**: a section whose heading exists in the template is "shared — template carries it" and is not preserved (`context-sections.ts:648-649`). A filled Overview has the same heading as the template, so its content is invisible to the guard.
- On preserve, only managed-zone policy content is re-spliced (COMMON-CONTEXT splice, `scripts/upgrade-project.ts:2340-2348`). The Overview sits **outside** both COMMON-CONTEXT zones (`templates/common/docs/context.md:49-65` and `:317-325`; Overview at `:13-17`).

Proof from the fleet: co-abap's git history contains a diff `-# co-abap — Project Context` / `+# [Project Name] — Project Context` — an upgrade wholesale copy re-introduced the literal title over a previously substituted one. Any identity content filled in-place in `docs/context.md` will be destroyed by the next template footer bump (v2.9 → v2.12 landed 2026-09-24; more will follow). In-place filling without a preservation change is not a viable design.

### 2.3 Existing guardrails relevant to this design

- **Per-project placeholder WARN**: audit.ts "Live context placeholder check" (`scripts/audit.ts:605-624`, ticket T-20260909-007) warns when `docs/context.md` or `docs/*.context.md` match `/\[(Project Name|One-sentence description[^\]]*|TODO|TBD)\]|<variant-name>|<project-name>/i`. It did not prevent the gap: it is WARN-only and runs per-project, not fleet-wide.
- **Seed semantics that never overwrite**: `ADD_IF_MISSING` / `WORKSPACE` policies copy only when the destination is absent — "project-owned — seed only" (`scripts/upgrade-project.ts:2280-2297`). Precedent: docs/specs seeds (ADR-0074) and `.codex/**` seeds (ADR-0076).
- **Default claim is SYNC** (`scripts/lib/upgrade-policy.ts:51`): any new delivered path without an explicit claim entry will be wholesale-synced. A new identity file MUST get an explicit `ADD_IF_MISSING` claim.

## 3. Goals

- G1. New projects get a real identity (name, description, type) at creation time.
- G2. Project-filled identity survives every `upgrade-project.ts` run, including wholesale `docs/context.md` refreshes.
- G3. The identity mechanism uses existing drift-detection surfaces; it introduces no new undetected-drift class.
- G4. Existing projects converge through the upgrade path without overwriting any user-written content.

## 4. Non-goals

- N1. **Bulk backfill of the 12 existing Projects is out of scope.** The upgrade path delivers the pointer and the seed file; authoring each project's actual description stays with that project's team (or a later manual pass). Auto-generating descriptions would fabricate content the pipeline cannot know.
- N2. No change to `docs/<variant>.context.md` (MERGE_MANAGED semantics are orthogonal).
- N3. No interactive prompting in new-project.ts (would break CI and subprocess usage).
- N4. No extension of `findProjectOnlySections()` to content-level comparison. T-20260912-001 deliberately chose heading-presence; making it content-aware to protect one section risks new preserve/skip verdicts fleet-wide.

## 5. Requirements (per ADR-0079)

- R1. Provide optional `--description "<one sentence>"` and `--type web|cli|api|mcp` flags on `new-project.ts`.
- R2. Write captured identity into a project-owned file `docs/project.md` at scaffold time.
- R3. Render `docs/project.md` from a single SSOT template `templates/common/docs/project.template.md`; remove the `.template.md` copy from the delivered tree.
- R4. When `--description` or `--type` is absent, write a `TODO(project-overview): …` marker line into `docs/project.md`.
- R5. Replace the template Overview body in `docs/context.md` with a two-line pointer to `docs/project.md`; keep the `## Project Overview` heading and remove the literal placeholder text.
- R6. Classify `docs/project.md` as `ADD_IF_MISSING` in `scripts/lib/upgrade-policy.ts` so upgrade seeds it only when absent and never overwrites it.
- R7. Keep the `docs/context.md` pointer section byte-identical between template and project copies so wholesale SYNC remains harmless.
- R8. Extend the audit.ts live-placeholder scan to include `docs/project.md` (WARN-only).
- R9. Add a fleet-level WARN in `validate-templates.ts` for `Projects/*/docs/project.md` TODO markers and `Projects/*/docs/context.md` literal placeholders.
- R10. Bump the `docs/context.md` version footer to 2.13; bump `new-project.ts` to 1.26.0; cascade SCRIPTS.md rows.

## 6. Design decisions

### D1 — Capture: optional flags + unavoidable TODO marker (chosen)

| Option | Pro | Con | Verdict |
|---|---|---|---|
| `--description` / `--type` flags + TODO fallback | Additive to the existing positional CLI (`new-project.ts:67`); CI-safe; gap stays visible when flags are omitted | Description quality depends on caller discipline | **Chosen** |
| Interactive prompt | Coaxes a real sentence at creation | Breaks non-interactive runs, tests, and subprocess flows (N3) | Rejected |
| Name/variant-only substitution, no marker | Zero CLI change | Ships silent residue; audit cannot distinguish "not yet described" from "clean" | Rejected |

The fallback TODO line matches the existing audit regex (`TODO` alternative, `audit.ts:607`), so an undescribed project is WARN-visible from its first audit run.

### D2 — Location: project-owned `docs/project.md`, pointer in `docs/context.md` (chosen)

| Option | Pro | Con | Verdict |
|---|---|---|---|
| Fill Overview in-place in `docs/context.md` | Single file, no indirection | Destroyed by the next wholesale SYNC (proven, §2.2); requires content-aware preserve (N4) or new managed zones | Rejected |
| `docs/project.md` + pointer (ADD_IF_MISSING seed) | Upgrade-proof via existing seed semantics (`upgrade-project.ts:2290-2297`); resolves the policy contradiction of project-specific content living in a "make no hand edits" file; in-project reference satisfies self-containment | One extra file; pointer indirection | **Chosen** |
| New IDENTITY managed zone in `context.md` | Keeps one file | New marker class needs new parity/drift validators (T-20260924-005/006 lesson: do not create invisible zones) | Rejected |

Because the pointer section is template-owned and byte-identical in both copies (R7), the wholesale SYNC path may refresh `docs/context.md` freely without touching identity. `docs/project.md` is claimed `ADD_IF_MISSING` (R6) — without that explicit claim the fallback SYNC policy would overwrite it.

### D3 — Backfill: upgrade-path delivery only (chosen)

The v2.13 footer bump makes every project's next upgrade deliver the pointer section and seed `docs/project.md` (only when absent). Existing user content is never overwritten (seed semantics). Authoring real descriptions for the 12 existing projects is each project team's work (N1). The WARN checks (D4) keep the residual gap visible until filled.

### D4 — Validation: WARN-only, two surfaces (chosen)

- Per-project: extend the audit.ts live-placeholder scan (`audit.ts:605-624`) to `docs/project.md` (R8).
- Fleet: add a `validate-templates.ts` WARN over `Projects/*/docs/` (R9), the regrowth-prevention sibling of T-20260924-004/007.
- Both stay WARN-only: an undescribed project is a quality signal, not a broken build. No new marker vocabulary is introduced — both checks reuse the existing placeholder regex.

### D5 — Version and compatibility cascade

- `templates/common/docs/context.md` footer: 2.12 → 2.13 (Overview pointer replaces literal placeholders; the old placeholder text disappears from the template, which also fixes the substitution gap at its root).
- `new-project.ts`: 1.25.0 → 1.26.0 (new flags, identity rendering, tree cleanup).
- SCRIPTS.md: update rows for `new-project.ts`, `test-new-project.ts`, `validate-templates.ts`, `audit.ts` (check-scope note), and `upgrade-project.ts`/`upgrade-policy.ts` if the policy entry bumps their versions.

## 7. Acceptance criteria

- AC1. `bun scripts/new-project.ts "demo" --variant co-design --description "…sentence…" --type cli` creates `docs/project.md` containing the given description and `cli`, and no `project.template.md` file exists in the delivered tree.
- AC2. The same command without `--description`/`--type` yields a `docs/project.md` whose `TODO(project-overview)` line matches the audit placeholder regex.
- AC3. Delivered `docs/context.md` contains the pointer section, contains neither `[One-sentence description` nor `web | cli | api | mcp`, and keeps the `## Project Overview` heading.
- AC4. A project with a user-edited `docs/project.md` shows `docs/project.md` untouched after `upgrade-project.ts --dry-run` (no NEW/UPDATE/COPIED verdict for that path).
- AC5. An upgrade run against a project whose `docs/context.md` is at footer 2.12 delivers the 2.13 pointer section; identity in `docs/project.md` is unaffected.
- AC5a. Regression for the §13 conflict: scaffold a fresh scratch project, downgrade its `docs/context.md` footer to 2.12, delete `docs/project.md`, and run `upgrade-project.ts`. The seed step creates `docs/project.md` from the template (TODO markers intact). A second run seeds nothing. A pre-existing user-edited `docs/project.md` is never written.
- AC6. `findProjectOnlySections()` reports no project-only sections for a freshly scaffolded identity-complete pair (context.md + project.md), so CONTEXT PRESERVE is not spuriously triggered.
- AC7. The fleet check warns for a fixture project whose `docs/project.md` still carries the TODO marker, and stays silent for a filled one.
- AC8. `bun test scripts/test-new-project.ts` passes with the new assertions; `validate-templates` and `audit.ts` pass at the workspace root.
- AC9. SCRIPTS.md rows updated per D5; spec registry entry exists for this design.

## 8. Accessibility (ADR-0065 exemption)

This change adds CLI flags and file content only; there is no user interface, so the WCAG 2.1 AA baseline does not apply. The a11y surface is the flag contract: `--description "<one sentence>"` and `--type web|cli|api|mcp` are documented in the usage strings (`new-project.ts:67,135`) and the SCRIPTS.md row, in plain English sentences, with no emoji- or color-only signaling in the new output lines.

## 9. Preview verification (ADR-0070 exemption)

No web/app/document UI renders from this change; the deliverables are a CLI script and markdown files. Exempt with this statement. Verification is textual: AC1-AC7 assert file contents and CLI output.

## 10. Platform Impact

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | None — no platform config, hooks, or commands change | N/A |
| Antigravity (GEMINI.md) | None — identity delivery is platform-neutral and rides the common template tree | N/A (justification: `docs/context.md`, `docs/project.md`, and the scripts are shared across all platforms; no `.gemini/` surface is touched) |
| templates/common | Propagation required — new `docs/project.template.md`, edited `docs/context.md` | `templates/common/docs/context.md`, `templates/common/docs/project.template.md` (new) |

## 11. Implementation brief (for automation-engineer)

| File | Action | Description |
|------|--------|-------------|
| `templates/common/docs/project.template.md` | create | Identity seed: project name, `TODO(project-overview): …` fallback line, `**Type**: TODO(project-overview)` line, short "owned by the project, never overwritten by upgrade" note |
| `templates/common/docs/context.md` | modify | Overview body → 2-line pointer to `docs/project.md`; remove literal placeholders; bump footer to 2.13 |
| `scripts/new-project.ts` | modify | Add `--description`/`--type` parsing (near `:106-131`); render `docs/project.md` from the template after the common-tree copy; delete the delivered `.template.md`; bump to 1.26.0 |
| `scripts/lib/upgrade-policy.ts` | modify | `docs/project.md` → `ADD_IF_MISSING` (defensive no-op guard, see §13; and add `docs/project.template.md` to a TEMPLATE_ONLY/scaffold-removed list so upgrades never deliver the raw template) |
| `scripts/upgrade-project.ts` | modify | Dedicated identity-seed step AFTER the TEMPLATE TREE SYNC pass per §13 (only-when-absent render of `docs/project.template.md` → `docs/project.md`); bump 1.45.3 → 1.46.0 |
| `scripts/audit.ts` | modify | Extend live-placeholder scan file list with `docs/project.md` (`:605-624`) |
| `scripts/validate-templates.ts` | modify | Fleet WARN: scan `Projects/*/docs/project.md` + `Projects/*/docs/context.md` against the existing placeholder regex |
| `scripts/test-new-project.ts` | modify | Extend: assert AC1-AC3 (identity render, TODO fallback, template removal, pointer content) |
| `scripts/SCRIPTS.md` | modify | Rows per D5 |

Tests to add in `test-new-project.ts`: (T-a) flags render identity; (T-b) absent flags yield TODO marker matching the audit regex; (T-c) no `project.template.md` in the tree; (T-d) `docs/context.md` has pointer, no literal placeholders, footer 2.13. For AC4/AC5, extend the upgrade dry-run test fixture (or cover via `simulate-pipeline` smoke) with a pre-edited `docs/project.md`.

Sequencing: template files first, then `upgrade-policy.ts` (claim must exist before the v2.13 footer bump ships, or the first upgrade would SYNC-overwrite seeded files), then `new-project.ts`, then validators, then tests and SCRIPTS.md.

## 12. Open questions

None. The CLI contract, seed semantics, and validation surfaces are verified above.

---

## 13. Addendum (2026-09-24) — Upgrade Seed Step (PM Ruling, Option 1)

### 13.1 Conflict record (engineer Phase-A evidence)

The original design assumed the `ADD_IF_MISSING` claim in `upgrade-policy.ts` would deliver `docs/project.md` to existing projects. It cannot. Verbatim dry-run on a fresh scratch scaffold (downgraded to footer 2.12, `docs/project.md` deleted) proved AC5's seed half never fires:

- The TEMPLATE TREE SYNC pass enumerates TEMPLATE-SIDE files only: `for (const { rel, abs } of iterEffectiveTemplateFiles(commonDir, variantTplDir))` (`scripts/upgrade-project.ts:2246`). It visits `docs/project.template.md` (TEMPLATE_ONLY → skipped) and never produces a walk entry with `rel === 'docs/project.md'`.
- The `ADD_IF_MISSING` policy handler only runs for entries the walk produces. `grep "project\.md" scripts/upgrade-project.ts` → zero hits.
- Every ADD_IF_MISSING precedent (`.codex/**`, `procedures/**`, `docs/specs/*`) has template-side presence at the delivered path; `docs/project.md` uniquely does not, because the design deliberately keeps only the `.template.md` in the tree (R3).

Net effect if unamended: the v2.13 upgrade delivers context.md's pointer into all 12 existing projects while `docs/project.md` never exists — a dangling in-project reference, violating the self-containment policy the design exists to serve. All other Phase-A results were green (918/918 tests, typecheck 0, fresh-scaffold flag rendering correct, battery pass); spec stays `draft`.

Options adjudicated by PM: (1) dedicated seed step in upgrade-project.ts — **chosen**; (2) put `docs/project.md` itself template-side — kills the `.template.md` SSOT and risks raw-template delivery to existing projects; (3) no seed — leaves the dangling pointer.

### 13.2 Seed-step contract (normative for implementation)

- **Placement**: a dedicated step in `scripts/upgrade-project.ts`, executed AFTER the TEMPLATE TREE SYNC pass completes. The sync pass and its template-side walk stay untouched.
- **Trigger**: seed only when `<projectDir>/docs/project.md` is absent. When present: no write, no verdict line (silent, or a debug-level line if the report style supports one).
- **Render source**: `templates/common/docs/project.template.md` read from the SAME resolved `commonDir` the run already uses (tag-extracted copy under `--version <tag>`, mirroring the H6 rule at `scripts/new-project.ts:984-986`).
- **Rendering path**: the SAME substitution machinery new-project uses — import `applySubstitutions` from `scripts/helpers/substitute-placeholders.ts` (exported since helper v1.3.0). Params: project name = basename of the project directory; variant from the run's `--variant` resolution; description/characteristics/country defaults. The template must therefore use only the existing token vocabulary (`[Project Name]`, `<variant-name>`); the `TODO(project-overview)` lines are not tokens and survive rendering untouched — an undescribed seeded project lands in exactly the WARN-visible state R4 intends. One render path for scaffold and seed means flag rendering and seed rendering cannot diverge.
- **Log style**: match the upgrade report's seed verdicts — `  NEW    docs/project.md  (identity seed — add-if-missing)` — and count the write in `treeChanged` like other seed paths. Honor `--dry-run` (verdict printed, no write).
- **Flow coverage**: adopt-project's settling pass invokes upgrade-project subprocess delivery, so adopted projects seed automatically; no adopt-side change. Fresh scaffolds already have the file (new-project renders it), so the step is a no-op there.
- **Guard retention**: the `upgrade-policy.ts` `ADD_IF_MISSING` claim for `docs/project.md` stays as a defensive no-op (comment pointing at the seed pass) — if a future change ever puts `docs/project.md` template-side, the fallback-SYNC clobber is still blocked. The `docs/project.template.md` TEMPLATE_ONLY classification is unchanged. AC4's never-overwrite assertion now binds the seed step (an existing file produces no verdict from the new pass).

### 13.3 Cascade

- `scripts/upgrade-project.ts`: `@version` 1.45.3 → **1.46.0** (new behavior = minor bump; header verified: `// @version 1.45.3`).
- SCRIPTS.md rows, both sides: update the `upgrade-project.ts` row (1.46.0 + identity-seed note) and the row of the test script carrying the AC5a regression (extend the upgrade dry-run/scratch fixture coverage note).
- Lifecycle record: Check H (`scripts/lifecycle-sync-audit.ts:13`) binds only scripts that carry a `docs/lifecycle/scripts/<name>.md` record; `upgrade-project.ts` has none today (the dir holds `new-project.md`, `error-handling.md`, `validate-pm-extends.md`). Recommended, not mandatory: create `docs/lifecycle/scripts/upgrade-project.md` at 1.46.0 following the `new-project.md` precedent, after which Check H tracks it. If skipped, the SCRIPTS.md row remains the version record of note.
- §11 table: `upgrade-project.ts` row added (above).

### 13.4 Incidental pre-existing finding (for the record — NOT in scope)

The engineer observed that a co-design scaffold's post-scaffold audit fails `skill-lifecycle-audit`: the variant `SKILLS.md` 5-row overlay clobbers the common registry while common ships 35 skill dirs. The failure is identical at workspace HEAD — pre-existing, unrelated to this design. PM will ticket it separately; this design makes no change to skill registries or SKILLS.md delivery.
