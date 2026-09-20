# Handbook Skill Maintenance Mode — Design

- **Spec ID**: 2026-09-20-handbook-skill-maintenance-mode
- **Date**: 2026-09-20
- **Status**: Implemented (same day)
- **Scope**: `templates/common/skills/handbook/` (L1 common skill, v0.4.0 → v0.5.0)
- **Related**: ADR-0074 (Universal Design Gate), I18N_PARITY_PLAYBOOK.md (skill reference)

## 1. Context

Two handbooks are fielded from this workspace (`Handbooks/intro-to-ai-harness`,
`Handbooks/multi-agent-harness-handbook`; four languages each, independent git
repositories, PR-only landing). The `handbook` skill (v0.4.0, last reviewed
2026-08-17) covers only **creation** — the H-Stage pipeline (H-0..H-7).

The 2026-09-20 maintenance session exposed the gap. Work performed on the
fielded handbooks that day:

- Upstream sync of `ai-workspace-standards` changes (`--platform both→all`,
  Domain Operating Model / ADR-0083·0084, graft-first scaffolding).
- A new chapter added to a running handbook (Ch. 13) with capstone renumbered
  (Ch. 13 → Ch. 14) — requiring a cross-reference sweep that took three passes
  before localized number variants (`Ch.13`, `13章`, `Cap. 13`, lowercase
  `capítulo 13`, SVG `<text>` labels, range labels) were all caught.
- A lecture-schedule accuracy review: stale counts, day totals disagreeing
  with their own rows, lecture guide ↔ course overview drift, instructor-note
  ordering drift, and time strings inside notes contradicting retimed rows.

None of this workflow (or the guardrails it produced) exists in the skill.
Additionally, the skill's verification step still prescribed
`validate-handbook --checks all`, while both fielded handbooks landed a
`bun run ci` one-command chain on 2026-08-24 precisely to prevent
doctor-green-but-CI-red failures.

## 2. Decision

Upgrade the skill to **v0.5.0** with a maintenance mode, without changing the
creation pipeline:

1. **M-Stage (M-1..M-5) added to SKILL.md** — maintenance mode for existing
   handbooks: M-1 upstream sync, M-2 structural changes (add / rename /
   renumber chapter), M-3 schedule consistency, M-4 footer baseline,
   M-5 verification triage. New triggers (`update handbook`, `handbook sync`,
   `handbook maintenance`, `교재 업데이트`, `핸드북 유지보수`).
2. **New reference** `references/MAINTENANCE_PLAYBOOK.md` holding the detailed
   checklists and the field incidents that motivate each rule (three-pass
   renumber sweep; localized number-variant list; programmatic schedule-total
   re-summation; clean-tree warning triage; transient external-link timeouts).
3. **Verification commands corrected**: H-5 and the `verify` subcommand now
   prescribe `bun run ci` + `bun run check-i18n` (the real gate), not
   `validate-handbook --checks all`.
4. **Output-format script list updated** to the fielded toolchain (nav-utils,
   symmetry/labels/links/search checks, check-i18n-parity, update-footers,
   vendoring note), and the footer-baseline rule (FOOTERS constant is the
   SSOT; version-row dates are page content) documented under M-4.

Alternatives rejected: a separate `handbook-maintenance` skill (splits one
workflow across two trigger sets and duplicates the ground rules); folding
maintenance into H-Stages (creation and maintenance have different
inventories — H-1 research / H-2 structure proposal do not exist in a
maintenance pass).

## 3. Consequences

- Future handbook syncs follow a documented checklist; the sweep lists encode
  the failure modes actually observed (escaped number variants, note-time
  drift, totals recomputation).
- Skill consumers get correct verification commands; the `bun run ci` chain
  includes external-links and search checks the old prescription missed.
- VERSION_MANIFEST updated to 0.5.0 with the new triggers.
- No runtime/code change; SKILL.md + one new reference document.

## 4. Accessibility

Not applicable — documentation-only change to skill guidance; no UI, no user
interaction surface.

## 5. Acceptance Criteria

1. `bun scripts/validate-skills.ts` passes with the updated SKILL.md (0 errors).
2. SKILL.md frontmatter version = 0.5.0, `last_reviewed` = 2026-09-20; manifest row matches.
3. M-Stage section present with M-1..M-5; MAINTENANCE_PLAYBOOK.md referenced from SKILL.md and present on disk.
4. H-5/`verify` prescribe `bun run ci` and `check-i18n`.

## 6. Addendum (same day): v0.6.0 — Korean language support + teachme parity

Follow-up comparison of the fielded handbooks and the attribution source
(`beret21/teachme` v0.3.1) surfaced two more gaps. Skill bumped 0.5.0 → 0.6.0:

1. **Korean language characteristics first-class** — new
   `references/KOREAN_LANGUAGE.md` (register, `순우리말`-first preference,
   spacing/typography, SVG-label localization, automated-check interplay,
   the strictest-standard Korean proofreading pass, ko→out translation
   mappings). The file declares the Language Policy exception
   (`lang: ko`, `lang_reason: source-material`) because Korean strings are
   its subject matter. H-0 gains a Korean-canonical authoring note.
2. **teachme feature comparison** — adopted: an `add` subcommand (extend an
   existing handbook in place: chapter / quiz / appendix, routed through
   M-2a), the add-only-edit safety ground rule (never delete
   participant-facing content; supersede instead), and teachme's
   strictest-Korean-proofreading standard. Already covered by the skill
   (no change): quiz model-answers + rubric, per-language editions,
   secret scan, themes. Rejected: `--no-verify` (contradicts mandatory
   gates), theme `ink` (native covers it), separate Korean command set
   (semantic trigger matching suffices).

Validation: validate-skills 0 errors, validate-templates 0 errors,
validate-md-language pass (code-span containment + declared exception).
