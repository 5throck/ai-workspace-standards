# Skill Hygiene & Layer Conventions: Cross-Variant Leak, Per-Skill README Standard, scripts/<variant> Layout

| Field | Value |
|-------|-------|
| Date | 2026-08-28 |
| Status | accepted, **partially superseded 2026-08-29** — the per-skill README mandatory standard was reversed by `docs/decisions/DEC-20260829-01.md` (SKILL.md is the sole required file; README sections of this design are historical). The cross-variant leak guard (B-11/`variant_scoped_skills`) and `scripts/<variant>/` layout decisions remain in force. |
| Spec ID | `skillhygiene` |
| Governing anchor | ADR-0031 (fork model); CONSTITUTION §6.2 (skill frontmatter); ADR-0057/0058 (scoped-asset prune precedent) |
| Related | `docs/designs/2026-08-28-skill-graph-template-rollout-design.md`; `docs/designs/2026-08-28-nested-skill-dir-check-design.md` |

## Problem

Four audit findings (2026-08-28 session):

1. **Cross-variant skill leak.** On 2026-08-06 (workspace PR #450) the co-game skill
   `sound-synth` was promoted into BOTH `templates/co-game/skills/` (correct) and
   `templates/common/skills/` (incorrect). Two filter-less amplifiers then spread it:
   `upgrade-project.ts`'s SYNC_IF_NEWER skills pass (lines ~1112-1161) copies every
   `templates/common/skills/` entry into every project's `skills/` SSOT with no
   variant-scope filter, and the stock `sync-skills.ts` mirrors the whole `skills/`
   tree into `.claude/.gemini/.agents` with no gate. Net effect: **10 of 11 projects**
   carry a co-game domain skill in all four locations. Only co-deck is clean (PR #32
   removed it and added allowlist enforcement). co-consult additionally carries the
   orphan skill `dart-disclosure-parser`, present in NO template layer.
2. **SKILL.md / README quality.** Project-layer SKILL.md files (581) are structurally
   sound for `version`/`description` but 14 lack the required `scope` field
   (co-abap 10, co-architect 4) and co-safety has 36 non-semver (2-part) versions
   (fixes already staged in its working tree). Templates are clean. Separately, the
   OWNER has decided per-skill `README.md` + `README_ko.md` become **mandatory**
   (currently §6.2 defines SKILL.md-only folders; only 3 folders project-wide have a
   README), with template-layer enforcement first and a project-layer grace period.
3. **scripts/<variant> layout convention.** Six projects carry variant-specific
   scripts under `scripts/<variant>/` (co-abap, co-abap-plugin, co-consult, co-deck,
   co-game, co-newbiz); five do not; 4 of 13 templates do. co-deck's copy is
   functionally referenced (variant.json, AGENTS.md, package.json) — the structure is
   legitimate but UNDOCUMENTED and UNVALIDATED: no scaffold, upgrade, or
   validate-templates check catches double nesting (`scripts/<v>/scripts/…`), foreign
   variant subfolders, or registry drift. OWNER DECISION: adopt the convention
   (optional to have, mandatory to be correct) and add validation.
4. **`Projects/co-news/ko/`** contains only 2 stale `README_ko.md` files, referenced
   nowhere → remove.

## User-Confirmed Decisions

- Per-skill `README.md` + `README_ko.md`: **mandatory standard** (CONSTITUTION §6.2
  amendment). Templates must be 100% compliant this cycle (FAIL gate); projects get a
  WARN grace period and author during subsequent upgrade cycles (581 folders).
- `scripts/<variant>/`: adopted convention. Having it is OPTIONAL; when present it
  must satisfy: own-variant name only, no nested `scripts/` recursion, all scripts
  carry `@version`, and entries mirrored in the layer's SCRIPTS.md registry.
- Full execution this cycle (source fix + systemic prune + project cleanup).

## Change Design

### D1 — Source removal (templates/common)

Delete `templates/common/skills/sound-synth/`. The legitimate copies remain at L0
`skills/sound-synth/` and `templates/co-game/skills/sound-synth/`.

### D2 — `upgrade-project.ts` v1.12.0 → v1.13.0: variant-scope skill prune

New pass after the COUNTRY-SCOPED SKILL PRUNE, mirroring its registry pattern:

- Build the set of skills present in `templates/common/skills/` that ALSO exist in
  exactly one `templates/co-*/skills/` (a variant-exclusive skill mistakenly
  duplicated into common).
- If that owning variant ≠ the project's own variant: remove the skill from the
  project's `skills/` SSOT and the three platform mirrors (dry-run aware; counts
  reported). Skills exclusive to common (genuinely shared) are untouched.

### D3 — `validate-templates.ts` skill quality & layout gates

New per-variant checks:

- **B-xx scope required**: every SKILL.md frontmatter must carry `scope` (§6.2).
- **B-xx semver versions**: `version:` must be `X.Y.Z` (reject 2-part).
- **B-xx per-skill README**: every skill folder must contain `README.md` AND
  `README_ko.md` (FAIL at template layer; project layer WARN via upgrade output
  until the follow-up cycle).
- **B-xx scripts/<variant> layout** (when `scripts/<variant>/` exists): variant name
  must equal the template's own name; no nested `scripts/` directory inside it; every
  `.ts` inside must appear in the variant's SCRIPTS.md registry; no `scripts/<other-variant>/`
  directories.

### D4 — CONSTITUTION §6.2 amendment (docs-writer)

Amend `docs/constitution/06-skill-lifecycle.md` §6.2: skill folder standard structure
`SKILL.md` + `README.md` + `README_ko.md` (README content: purpose, when-to-trigger,
prerequisites, usage example), enforcement = template layer FAIL immediately, project
layer WARN until the next upgrade cycle. `skill-lifecycle-audit.ts` gains a README
presence check (WARN at L0/L3, FAIL at L1/L2 — implemented with the validate-templates
gate, D3).

### D5 — Scaffold-side guard

`create-l3-scaffold.ts` / `new-project.ts`: after composition, assert no
`scripts/<variant>/scripts/` recursion, no foreign-variant skill folders (skills that
exist in another variant template but neither common nor the project's own variant
template), and warn on missing per-skill READMEs (inherited from templates).

## Registrations

| File | Change |
|------|--------|
| `templates/common/skills/sound-synth/` | deleted |
| `scripts/upgrade-project.ts` | v1.13.0 — variant-scope prune |
| `scripts/validate-templates.ts` | new checks (scope/semver/README/scripts layout) |
| `docs/constitution/06-skill-lifecycle.md` | §6.2 README mandatory amendment |
| `scripts/create-l3-scaffold.ts`, `scripts/new-project.ts` | composition-time guards |
| `scripts/SCRIPTS.md` (+L1 mirror) | version rows |
| `docs/designs/2026-08-28-skill-hygiene-and-conventions-design.md` | this document |

## Verification

| Check | Expected |
|-------|----------|
| `ls templates/common/skills/sound-synth` | absent |
| prune dry-run on 10 affected projects | lists sound-synth for removal; after cleanup → CLEAN |
| `grep -r sound-synth Projects/ (post-cleanup, excluding co-game + .git)` | 0 |
| `validate-templates.ts` | new gates pass on templates (post-PR2 for README) |
| `validate-md-language`/audit | unchanged green |

## Out of Scope

- Authoring 581 project-layer skill READMEs (follow-up cycle; WARN grace).
- co-safety language-gate owner decision (separate, still pending).
- Promoting co-deck's allowlist fork into the stock template (separate proposal).

## Execution Follow-Up (same day, user-directed)

All three follow-ups were executed; this section records them as amendments to this design.

### F1 — Per-skill README backlog completed (project layer)

All **571 project-layer skill folders** (11 projects) received `README.md` + `README_ko.md`
seeded from each SKILL.md's frontmatter (same generator as the template pass; per-project
PRs). Coverage is now 100% at every layer (template 206/206, projects 571/571). co-safety
domain-skill README.md files additionally carry `lang: ko` declarations (their descriptions
contain official Korean statute names).

### F2 — co-safety language gate resolved via glossary separation

The previously-open "co-safety language-gate owner decision" was resolved as the
`lang: ko` exception route (option b of the documented decision):

- New `Projects/co-safety/docs/glossary/kr-safety-glossary.md` (`lang: ko` +
  `lang_reason: legal`): KO routing keywords, domain descriptors, and the full official
  statute registry moved verbatim out of AGENTS.md (statute names are Korean proper nouns
  required for `k-law` Open API queries).
- AGENTS.md / CLAUDE.md / GEMINI.md de-Koreanized (0 Hangul; English routing tables +
  glossary pointer).
- `lang: ko` + `lang_reason: legal` declared on the 91 flagged domain skills/agents
  (Korean citations and KO dispatch triggers are intrinsic to this Korea-only EHS variant).
- **Back-ported to `templates/co-safety/`** (project → template direction): glossary file
  copied, template AGENTS.md de-Koreanized with the same pointer, and `lang: ko` declared
  on 108 template domain files.

### F3 — scripts/<variant> layout applied to co-safety (template + project)

The adopted layout convention was enforced on the one remaining variant carrying
variant-specific scripts at the `scripts/` root:

- `templates/co-safety/scripts/co-safety/` created; 15 variant-specific scripts moved
  (`safety-audit.ts`, `audit-variant.ts`, `domain-config.ts`, `new-domain.ts`,
  `scaffold-industry.ts`, `training-ingest.ts`, `start-mcp.ts`, `risk-register-rollup.ts`,
  `check-pm-approval.ts`, `migrate-registry-to-coordinates.ts`, and 5 `test-*.ts` suites).
- 67 template files' `scripts/<name>.ts` references rewritten to `scripts/co-safety/<name>.ts`
  (AGENTS.md, .claude/.gemini commands+settings+skills, READMEs); `SCRIPTS.md` registry
  created for the nested dir.
- **Project `Projects/co-safety`**: same move + reference rewrite (116 files) + registry
  path updates; `.github/workflows/safety-audit.yml` and regulation YAML comments updated.
- The other 8 variants without variant-specific scripts (co-design, co-develop, co-export,
  co-hr, co-news, co-price, co-security, co-work) correctly remain without the directory
  (convention: optional to have, mandatory to be correct when present); co-abap/co-consult/
  co-deck/co-game already conformed.

## References

- Leakage evidence: workspace commit af6d8f87 (2026-08-06, PR #450); co-consult 627f05a;
  co-deck 2d3d3d0 (PR #32).
- Session audit log: `memory/2026-08-28.md`.
