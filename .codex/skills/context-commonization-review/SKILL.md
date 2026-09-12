---
name: context-commonization-review
description: >
  Reviews cross-variant docs/<variant>.context.md duplication and promotes genuinely
  shared content into the common docs/context.md (ADR-0050 Part 3).
  Use when: after scaffolding a new variant, on a periodic cadence (every 5 new
  variants or quarterly, whichever first), or on-demand when asked to check for or
  reduce context.md duplication across variants.
status: active
scope: workspace
l2_propagate: false
version: "1.1.0"
owner: architect
last_reviewed: 2026-08-21
relates_to:
  - skill: promote-variant
    type: follows
  - skill: meeting-facilitation
    type: follows
metadata:
  type: process
  triggers:
    - context commonization review
    - variant context duplication
    - commonization review
    - context.md duplication review
    - context.md commonization
---

# Skill: context-commonization-review

## When to Use

- Immediately after scaffolding a new variant (`create-variant` skill) — a natural checkpoint
  to check whether the new variant's `docs/<variant>.context.md` duplicates existing patterns.
- At minimum every 5 new variants or once per quarter since the last review, whichever comes
  first (ADR-0050 Part 3) — variant count, not just calendar time, drives duplication risk.
- On-demand, whenever asked to look for or reduce `docs/context.md` / `docs/<variant>.context.md`
  duplication.

This skill is the execution half of a two-part mechanism: `scripts/audit.ts`'s
`checkVariantContextCommonization()` is the detection half (always runs, WARN-only).

## Step-by-Step Procedure

### 1. Detect candidates

```bash
bun scripts/audit.ts 2>&1 | grep "Context commonization candidate"
```

Each line names a section heading, the overlap percentage, and which variants are involved
— e.g. `"git / pr workflow" section is >50% similar (83-100% overlap) across 6/10 variants: ...`.

### 2. Decide, per candidate (architect judgment — not automatable)

For each flagged heading, per ADR-0050 Part 3's criteria:

| Situation | Decision |
|---|---|
| Shared by nearly all variants, content is genuinely identical or should be | **Promote** to `docs/context.md` |
| Shared by only a subset of variants (e.g. a domain cluster) | **Extract** into a shared skill or `docs/_common/` reference those variants opt into — do not bloat `docs/context.md` for variants that don't need it |
| Similar today by coincidence, variants expected to diverge later | **Leave alone** |
| High overlap % but with a meaningful per-variant difference (e.g. a different commit-type convention, a different threshold) | **Do not promote as-is** — either exclude the diverging variant from the promotion, or conclude the sections aren't actually the same thing despite the heading match |

`scripts/promote-context-section.ts` (step 3) always prints a line-level diff against the
canonical source before writing anything — read it. A high overlap percentage is a hint, not
a verdict; text that reads as "83% similar" can still carry a deliberate, load-bearing
difference (verified in practice: a `git / pr workflow` promotion attempt across 6 variants
found `co-security` used `/sync "security: ..."` where the others used `/sync "feat: ..."`
— textually close, semantically not interchangeable).

### 3. Execute a promotion

```bash
bun scripts/promote-context-section.ts \
  --heading "<heading text, exactly as it appears in audit.ts's output>" \
  --variants co-a,co-b,co-c \
  [--source <variant>]         # which variant's text becomes canonical (default: first listed)
  [--after-heading "<text>"]   # where in docs/context.md to insert (default: before Lifecycle Management)
  [--dry-run]                  # always run this first
```

Review the dry-run output — the per-variant content preview and any divergence warnings —
before re-running without `--dry-run`. The script:
- Inserts the canonical section into `templates/common/docs/context.md` and bumps its version footer
- Removes the section from each listed variant's `templates/<variant>/docs/<variant>.context.md`
- Does **not** decide anything and does **not** touch already-scaffolded projects (see step 4)

**⚠️ Known defect — nested `###` subsections are silently dropped, not promoted.** The
removal regex stops at the *next* `#{2,3}` heading, so if the promoted `##` section has a
nested `###` subsection, that subsection is excluded from both the removal (left behind as an
orphaned, parent-less duplicate in the variant file) *and* the canonical content copied into
`docs/context.md` (never appears there either) — real content loss if no other copy of that
subsection exists elsewhere in the file. Hit in practice promoting "Scripts" (`### Hybrid
Scripting` nested underneath): 7 variant files were left with an orphaned duplicate, and
`co-consult`/`co-export` genuinely lost the content since neither had a second copy elsewhere.
**Before running without `--dry-run`, check whether the candidate section (per `audit.ts`'s
output) has a nested `###` subsection** — if so, verify after promotion that the subsection
landed in `docs/context.md` and manually add it if not, then manually remove any orphaned
leftover from each variant file. The tool itself is not yet fixed for this case.

### 4. Handle already-scaffolded projects

Removing a section from `templates/<variant>/docs/<variant>.context.md` only fixes *future*
scaffolds (`new-project.ts`, `create-l3-scaffold.ts`) and stops `audit.ts` from re-flagging the
*template*. Existing `Projects/*/docs/<variant>.context.md` files keep the old duplicated text
— there is no automated cleanup path for this (the file isn't a managed-block merge target, so
`upgrade-project.ts` can't safely delete arbitrary content from it). Either:
- manually remove the now-redundant section from each affected existing project, or
- accept the duplication there until an unrelated future edit touches that section.

Then, for each existing project of the affected variants, pick up the *promoted* content into
`docs/context.md`:

```bash
bun scripts/upgrade-project.ts <project-path> --variant <variant> --dry-run
```

### 5. Extraction path (subset-shared content)

When step 2 decides a candidate should become a shared skill instead of promoting to
`docs/context.md`: create `skills/<name>/SKILL.md` with the shared content, update the affected
variants' `agents/pm.md` or `AGENTS.md` to reference it, then manually remove the duplicated
prose from each affected variant's `docs/<variant>.context.md` (`promote-context-section.ts`
only targets `docs/context.md` as the promotion destination — it's not a general dedup tool for
skills, since skill placement/wiring per variant needs its own review).

### 6. Verify and log

```bash
bun scripts/audit.ts   # the promoted heading should no longer appear as a candidate
```

Log the decision and rationale in the session's `memory/YYYY-MM-DD.md` — this is the audit
trail ADR-0050 Part 3 relies on for "why was this promoted/left alone" questions later.

## See Also

- ADR-0050 Part 3 (Variant Script Inheritance and Golden-Reference SSOT — Context Commonization
  Review) — full rationale, thresholds, and open questions
- `templates/common/docs/context.md` § Lifecycle Management § Context Commonization Review
- `skills/upgrade-project/SKILL.md` — how promoted `docs/context.md` content reaches existing projects
- `skills/create-variant/SKILL.md` — the natural trigger point after scaffolding a new variant
- `docs/governance/variant-contract.md` § Context.md Structure Standard (`validate-templates.ts`
  Check WS-09) — a related but distinct concern: this skill promotes/dedups *content* that's
  duplicated across variants; WS-09 instead enforces that every variant's `docs/<variant>.context.md`
  has the same top-level *structure* (slot presence + order), regardless of whether the content in
  each slot is shared or variant-specific. Content standardization was explicitly considered and
  rejected during WS-09's design — see that doc for why.
