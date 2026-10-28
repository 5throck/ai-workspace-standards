# Upstream Adjudication Mechanical Batch — 2026-10-29 (U-20261028-004/-007/-008/-009/-010/-011/-015/-017/-018/-020/-022 + T-20261028-015)

- **Status**: implemented
- **Date**: 2026-10-29
- **Owner**: automation-engineer + docs-writer (PM Gateway dispatch)
- **Tickets**: U-20261028-008, U-20261028-009, U-20261028-010, U-20261028-011,
  U-20261028-015, U-20261028-017, U-20261028-018, U-20261028-020 (upstream
  requests from co-abap / co-safety), U-20261028-007 residual (L1 pm.md
  roster-neutral phrasing), U-20261028-004 rider (gitleaks config guidance),
  T-20261028-015 (dangling cross-layer reference hygiene)
- **Tier**: L0 workspace root + L1 (templates/common) + L2 (templates/co-abap,
  templates/co-safety, templates/co-price)
- **Precedent**: docs/designs/2026-10-28-ticket-runner-mechanical-batch-design.md
  (one batch design doc, registered implemented after gates pass)

## 1. Context

The 2026-10-28 upstream adjudication sweep produced nine upstream tickets and
one cross-layer reference inventory item. All are mechanical repairs (each
≤2 files at the fix locus, no policy change). This doc is the Design Gate
artifact for the batch; every item below records the verified evidence and
the fix shape applied.

## 2. U-20261028-008 — L1 transforms for workspace-root-scoped prose (co-abap)

**Evidence** (verified): L0 `AGENTS.md` §6 Location Rules bullet (line ~220)
states the L1-only common skills are "delivered to scaffolded projects via
`docs/templates/common-contract.json`" — the sentence propagates verbatim into
`templates/common/AGENTS.md:226` and from there into every delivered project,
where `docs/templates/` does not exist (it is workspace-root delivery
machinery). L0 `AGENTS.md` §3.7.5 (line 157) links
`docs/designs/2026-08-16-governance-backlog-design.md`; the link survives into
L1 (`templates/common/AGENTS.md:154`) and the delivered AGENTS.md, where the
target does not exist (spot-check in the ticket: the only broken relative link
in a 100-link sample).

**Fix shape**:
1. L0 source text edit — qualify the delivery sentence as workspace-root
   machinery: "delivered to scaffolded projects via the workspace delivery
   contract (workspace-root `docs/templates/common-contract.json`)". The path
   mention stays (it is a backtick code mention, not a link) but is now
   explicitly scoped to the workspace root.
2. New governance-l1 transforms in `applyGovernanceTransforms()` (AGENTS.md
   branch, following the B-PGW T-pair house style) so the L1 rendition carries
   the qualified wording even if the L0 source ever regresses, and strips the
   §3.7.5 link while keeping the text (plain workspace-root mention — the
   smallest correct form; the §3.7.5 section itself is L0-scoped prose and
   stays).
3. Coverage of T-20261028-015(d): the same transform pair covers the
   `common-contract.json` mention; grep confirms AGENTS.md is the only
   GOVERNANCE_L1 file carrying it.

## 3. U-20261028-009 — VARIANT-PHASE-GATE generator shape (co-abap)

**Evidence** (verified): `scripts/regenerate-agents-md.ts:218-220` emits the
VARIANT-PHASE-GATE block as bare data rows; the sibling VARIANT-DISPATCH-TRIGGERS
block (:213-216) emits `| Agent | Phase | Dispatch Trigger |` + separator rows.
`derivePhaseGateRow:188` renders `"Phase ?"` when `agent.phases` is empty.
The delivered `Projects/co-abap/AGENTS.md:343-364` shows both defects (no
header row; `| Internationalization & Localization Guidance Specialist | Phase ? | …`).

**Fix shape**: emit the same header+separator shape as the sibling block;
empty phases render `Phase —`. **Explicitly out of scope**: pinning
i18n-specialist phases (owner call — the variant owns its phase ladder;
`Phase —` is the defined placeholder). Regeneration surface: the defect site
`Projects/co-abap/AGENTS.md` is regenerated in place via the script's
`--source` mode (block now carries the header row); the four MISALIGNED_VARIANTS
are NOT regenerated in this batch (see §14 — the regenerator rebuilds whole
files from the drifted L1 base). The L1 script copy rides
`propagate-to-templates.ts --apply`.

## 4. U-20261028-010 — context.md Standard Root Files list (co-abap)

**Evidence** (verified): `templates/common/docs/context.md:341` lists
`README.md, CHANGELOG.md, AGENTS.md, SECURITY.md, workspace standards,
CLAUDE.md, GEMINI.md` while the same file's Supported Surfaces table
(:511-521) mandates `CODEX.md` (surfaces 5-6) and `HERMES.md` (surfaces 7-8),
and both files exist at delivered project roots.

**Fix shape**: add `CODEX.md` and `HERMES.md` to the list. Locus check per
ticket: there is **no L0 `docs/context.md`** — the propagation-map `docs`
domain is `disabled: true`, so `templates/common/docs/context.md` is a
hand-maintained single source (the `File Organization Policy` section sits
outside the COMMON-CONTEXT marker zones), and the L1 file is the only copy to
fix. No test pins the list (grep over scripts/ + tests/ confirms; the
context-purification test uses its own fixture text).

## 5. U-20261028-011 — LC lifecycle-record check gated behind IS_WORKSPACE_ROOT (co-abap)

**Evidence** (verified): `scripts/skill-lifecycle-audit.ts` — the LC block
(:792-806, with the MV version-drift arm :808-824) is nested inside the
`if (IS_WORKSPACE_ROOT && !isPlatformSkill && frontmatter.name)` block (:766),
so delivered projects never run it; `generateSummary` (:949-953) prints
"All N skills healthy" whenever `warnings == 0`, over-claiming project health
(ticket: 49 active skills, 7 lifecycle records, zero project-level signals).

**Fix shape**: move the LC/MV block out of the `IS_WORKSPACE_ROOT` gate (own
`!isPlatformSkill && frontmatter.name` guard; RI/SD/SVP stay workspace-gated —
RI needs the L0 reference-allowlist surface, SD/SVP semantics are unchanged).
`selfManaged` and `lifecycleRecordPath` are recomputed in the moved block.
The over-claim resolves naturally: projects now report the lifecycle-record
gap as warnings instead of printing an unqualified "All N skills healthy".
Version 1.8.0 → 1.9.0 + SCRIPTS.md row note.

## 6. U-20261028-018 — pre-push gitleaks invocation omits --config (co-safety)

**Evidence** (verified): `scripts/hooks/pre-push.ts:198` runs
`gitleaks detect --redact --log-opts=…` with no `--config`, while
`pre-commit.ts:435-441` passes `['protect','--staged','--no-banner',
'--log-level','error','--config','.gitleaks.toml']` guarded by `existsSync`
(comment documents the empty-arg fallback that previously weakened that
gate). `.gitleaks.toml` carries the reviewed allowlist, so push-time scans
deviate from commit-time policy when implicit config discovery misses the
dot-named file.

**Fix shape**: build the gitleaks argv conditionally (pre-commit's guard
shape): `--config .gitleaks.toml` appended only when `existsSync('.gitleaks.toml')`.
`existsSync` imported from `node:fs`. Version 1.6.0 → 1.7.0; L0 + L1 copies
(`templates/common/scripts/hooks/pre-push.ts` rides `--apply`); delivered
copies ride upgrade.

## 7. U-20261028-020 — common CI workflow install-step posture (co-safety)

**Evidence** (verified): `templates/common/.github/workflows/ci.yml:32-36` —
comment says "package.json lives at the repository root, not under scripts/"
and the guard `hashFiles('package.json') != ''` skips `bun install`; in
co-safety the only package.json is `scripts/package.json` (with its own
`bun.lock`), so the install never runs and `bun scripts/audit.ts` executes on
Bun's implicit auto-install cache — an undeclared dependency posture the
comment presents as a normal step. L0 has no `ci.yml` (`ls .github/workflows/`
— the L1 file is the only source; no sync needed).

**Fix shape**: minimal comment/guard truthing — the guard keeps root-package
installs working, and the comment states the dependency-free design
explicitly: audit.ts is deliberately dependency-free (its own header comment
says so), the step is a no-op for scripts/-scoped layouts, and no run relies
on implicit auto-install. Delivered copies ride upgrade.

## 8. U-20261028-015 — co-abap install-vsp.ts password guidance (L2)

**Evidence** (verified): `templates/co-abap/scripts/co-abap/install-vsp.ts:170`
prints `export SAP_PASSWORD=your-password` post-install guidance; the delivered
`Projects/co-abap/scripts/co-abap/install-vsp.ts:169-174` already carries the
patched wording (.env with chmod 600 / OS keychain, never export), marked
`LOCAL-PATCH(upstream-request: pending)`.

**Fix shape**: port the patched wording into the L2 template verbatim (minus
the LOCAL-PATCH marker — the template is now the source of truth);
`@version 1.1.0 → 1.2.0`; co-abap `SCRIPTS.md` row bumped so re-delivery
clears the project's local patch by version.

## 9. U-20261028-017 — co-safety audit-variant.ts gate 0 parses nonexistent raw.skills (L2)

**Evidence** (verified): `templates/co-safety/scripts/co-safety/audit-variant.ts:23-41`
gate 0 reads `variant.json` top-level `skills` (`raw.skills`). In the delivered
co-safety variant.json there is no top-level `skills` key, and
`skill_manifest.variant_specific` entries carry `name` but no `file` field —
so gate 0 is a silent no-op ("0 skill(s)"). `JSON.parse` is also unguarded.
The four `variant_specific` names (risk-assessment, permit-to-work,
emergency-response, compliance-gap) all resolve to `skills/<name>/SKILL.md`
in both the L2 template and the delivered project (verified by existsSync).

**Fix shape**: guard JSON.parse (fail with a clear message on malformed
variant.json), parse `skill_manifest.variant_specific`, require `name`, and
check the normalized derived path `skills/<name>/SKILL.md` with existsSync.
`@version 1.1.0 → 1.2.0` + co-safety `SCRIPTS.md` row. Delivered copy
converges via upgrade (the delivered copy differs only in an ADR-number
comment; the template is authoritative).

## 10. U-20261028-007 residual — L1 pm.md names L0 roster agents as dispatch targets

**Evidence** (verified): `templates/common/agents/pm.md:39` "(delegate to
docs-writer)", :40 "(delegate to architect)", :217/:227 Row-0 routing "via
architect", :281 "automation-engineer or the project's implementation
specialist … lifecycle-manager duties" — L0 roster names delivered into
variants whose rosters differ.

**Fix shape**: variant-neutral phrasing on the L1 file only (L0
`agents/pm.md` keeps its names — they are correct there): `delegate to
[docs specialist]`, `delegate to [design specialist]`, Row-0 "via the
variant's design specialist (per its AGENTS.md dispatch table)", :281
"the project's implementation specialist per its AGENTS.md dispatch table;
governance-record duties where the role exists". `agents/pm.md` version
1.4.1 → 1.4.2. Same treatment for the delivered
`templates/common/docs/governance/agents/execution-plan-templates.md:89-92,103`
example tables — that file is an L1-authored HAND-MAINTAINED doc (excluded
from the agents-governance-docs mirror per DEC-20261028-05), so the same
neutralization is applied directly to the L1 copy; the L0 source
(`docs/governance/agents/execution-plan-templates.md`) carries the matching
edit using the `[docs specialist]` / `[implementation specialist]` placeholder
idiom the AGENTS.md B-A12 transform precedent already uses, so both levels
converge by construction.

## 11. U-20261028-004 rider — gitleaks custom-pattern guidance

One sentence added to the pre-push hook header docs (the smallest sanctioned
surface touched by this batch): custom secret patterns and allowlists belong
in `.gitleaks.toml` (merge-aware, upgrade-preserving) — never as local
patches inside hook files.

## 12. T-20261028-015 — dangling cross-layer references (a)-(f)

- **(a) docs/adr/0078 refs**: L0 `AGENTS.md:179` carries the ADR path inside
  the COMMON-AGENTS LLM Work Routing section (backtick mention, so the
  constitution-scrub A-9 link rule never matches it). L0 keeps the mention
  (L0 has the file); new governance-l1 transform replaces the path mention
  with the in-file policy anchor (the LLM Work Routing Policy section itself —
  the same anchor L1 `agents/pm.md:80` already cites). CONSTITUTION.md's ADR
  link is already handled by the scrub (A-9) in marker-injected zones.
- **(b) co-safety CONSTITUTION.md links**: the cited fix locus
  `templates/co-safety/CLAUDE.md` / `GEMINI.md` does not exist — variant
  templates carry only AGENTS.md + HERMES.md; the stale link lives in the
  delivered `Projects/co-safety/CLAUDE.md:3` / `GEMINI.md:3` (a pre-bootstrap
  snapshot; CODEX.md/HERMES.md in the same project already carry the
  L0-ONLY-banner convention). Fix: make the CLAUDE/GEMINI line a plain-text
  workspace-root mention (not a link) plus the project-applicable
  `docs/context.md` pointer, matching the CODEX/HERMES shape. `Projects/` is
  gitignored, so this is a local working-tree repair in the L3 project, not
  PR content (the stale line has no template source to fix).
- **(c) skill-modification-checklist.md**: referenced by
  `Projects/co-consult/AGENTS.md:494` and `Projects/co-deck/AGENTS.md:591`
  (stale §10 snapshots); grep confirms the target exists nowhere and no L1/L2
  source carries the text (L1 AGENTS.md §10 is already the "Moved to
  workflows.md" pointer). Fix: retarget the sentence to the
  `docs/lifecycle/skills/` lifecycle-record convention (Created / Phase
  History / Acceptance Criteria / Metadata) in both project files.
- **(d) docs/templates/ + common-contract.json**: covered by item 2's
  transform pair (§2).
- **(e) vague paths**: `docs/implementation` appears only in
  `Projects/co-architect` (no co-architect template exists; `Projects/` is
  gitignored, so the fix is a local working-tree repair) — prose slash
  reading "design docs/implementation plans" reworded to "design docs and
  implementation plans" in `AGENTS.md:136`, `agents/README.md:52` (the
  `agents/architect.md` frontmatter — the regeneration source for the roster
  row — is already clean). `docs/logs` appears in
  `templates/co-price/docs/co-price.context.md:162` as prose "code/docs/logs"
  — reworded to "code, docs, and logs" in the template (the L3 copies
  `Projects/co-price/AGENTS.md:268` and `docs/co-price.context.md` carry the
  same prose and are fixed identically as local working-tree repairs).
- **(f) governance-backlog-design link (co-abap)**: covered by item 2's
  transform pair (§2).

Every L0/L1 text edit that machine-regenerated surfaces carry is implemented
as an `applyGovernanceTransforms` rule so the next propagate run cannot
resurrect the dangling reference (the PR #1696 T1-T6 pattern).

## 13. Validation

Per PR: `bun run test:unit`, `bun scripts/audit.ts`,
`bun scripts/validate-templates.ts`, `bun scripts/verify-scripts.ts --verify`,
`bun scripts/propagate-to-templates.ts --check-drift` (after `--governance-l1`
+ `--apply` + `--docs`), `bun scripts/validate-docs-links.ts --all`.

## 14. Decisions

- **transforms, not just source edits (U-008 / T-015a)** — the text is
  machine-regenerated by `--governance-l1`; an L0-only edit would be
  resurrected as qualified-unqualified drift on the next run. Literal
  replace pairs + the L0 source edit converge both directions.
- **LC un-gated, RI stays gated (U-011)** — the ticket offers "document
  workspace-only" as an alternative; running LC in projects is strictly more
  honest and costs nothing (warnings, not errors).
- **template locus corrections** — three ticket-cited paths do not exist or
  are not mirrors (`templates/co-safety/CLAUDE.md`,
  `templates/co-architect/`, the L1 execution-plan-templates.md fork); the
  fixes land at the real source of each stale line and are recorded as
  deviations.
- **no phase pinning for i18n-specialist** — `Phase —` is the defined
  placeholder; the phase ladder is an owner call.
- **`templates/co-abap/AGENTS.md` left untouched** — it is a hand-authored
  variant AGENTS.md without the VARIANT zone structure; regenerating it is a
  structural rewrite, not a mechanical fix. The generator fix prevents the
  defect for every future regeneration.
- **`regenerate-agents-md.ts --all` NOT run for the four misaligned variants**
  — a trial run showed the current L1 template has drifted far past those
  variants' AGENTS.md files (the regenerator rebuilds the whole file from the
  L1 base, clobbering variant-authored headers such as co-work's
  "**co-work Variant Agent Ecosystem**"); a 700+ line structural rewrite is
  not a mechanical fix. Reverted; the generator fix stands and the
  regeneration pass is left to a dedicated alignment session.
- **`Projects/co-abap/AGENTS.md` regenerated in place** (`--source` mode) —
  the U-009 defect site; the regenerated block now carries the header row and
  `Phase —`. `Projects/` is gitignored, so this is the delivered project's
  own working tree (the PR carries the generator fix; the project converges
  fully via its next upgrade).

## 15. Rollback

Single-commit reverts per PR; no registry schema changes, no data migrations.
