# Country-Prune Context-Doc Scrub Reference-Shape Design

- **Date**: 2026-10-05
- **Status**: Implemented (2026-10-05 — delivered with the scrub-filter fix, upgrade-path parity fix, and verifier regression test in the same change set)
- **Owner**: Automation Engineer (design + implementation); diagnosis and reproduction logged in the 2026-10-05 session review
- **Spec id**: `2026-10-05-country-prune-context-scrub-design` (registry: `docs/specs/registry.json`, source: `manual`)
- **Related ADRs**: ADR-0057/0058 (country-scoped asset registry), ADR-0074 (Universal Design Gate), ADR-0036 (TypeScript-only scripts)

---

## 1. Summary

The country-prune reference scrub removes dangling references to pruned country-scoped skills from `AGENTS.md` and the variant context doc, but its context-doc filter matches only one reference shape: an inline-code name (`` `k-dart` ``). The co-consult variant's context doc records its skill roster as a **bold table row with a backticked skill path** (`| **k-dart** | `skills/k-dart/SKILL.md` | strategy-analyst |`), which the filter misses — so region-neutral co-consult scaffolds deliver a context doc whose skill table lists a skill directory that no longer exists (observed 2026-10-05 on a fresh region-neutral scaffold; reproduced end-to-end from the template tree). This design extends the context-doc scrub predicate to three reference shapes (inline-code name, bold name, skill-path mention) in both scrub sites — the scaffold-time helper and the upgrade-time country-prune pass — and pins the behavior with a verifier regression test. The template row itself stays: it is correct for `--country KR` scaffolds.

## 2. Background

### 2.1 Provenance

A fresh region-neutral `co-consult` project scaffold left `docs/co-consult.context.md:73` as `| **k-dart** | `skills/k-dart/SKILL.md` | strategy-analyst |` while all six `k-*` skill directories were correctly pruned. Reproduction from the template tree (`templates/co-consult` + `templates/common/skills` + `bun scripts/helpers/prune-country-scoped-assets.ts <proj> none co-consult`) confirmed: skill directories pruned (6), `AGENTS.md` rows scrubbed (2 — the `K-DART` and `K-Law` path-form rows), context doc untouched (0 lines) — the bold row survives every run.

### 2.2 Why co-consult is the only affected variant

`docs/workspace-schema.json → country_scoped_assets.skills` registers six KR-scoped skills (`k-law`, `k-dart`, `k-kosis`, `k-opendata`, `k-ecos`, `k-krx`). A grep over all 13 variant context docs found exactly one bold-form scoped-skill row: `templates/co-consult/docs/co-consult.context.md:73`. Every other variant either omits scoped skills from its context doc or refers to them in prose already covered elsewhere, so the five existing region-neutral projects (co-design, co-develop, co-game, co-security, co-work) audit clean.

### 2.3 The filter, precisely

Both scrub sites use the same shape:

- `scripts/helpers/prune-country-scoped-assets.ts` `scrubPrunedSkillReferences()` (added 2026-09-21, T-20260921-006): context-doc filter `line.includes(\`\`${n}\`\`)`.
- `scripts/upgrade-project.ts` COUNTRY-SCOPED SKILL PRUNE scrub (added v1.39.0, same ticket): context-doc filter `line.includes(\`\`${n}\`\`)`.

In the surviving row, the characters around `k-dart` are `**` and `/` — never a matched backtick pair — so the predicate is false. The `AGENTS.md` filters are path-based (`line.includes(\`skills/${n}/SKILL.md\`)`) and already catch their row shape; they are unchanged.

## 3. Design

### 3.1 Extended context-doc predicate (both sites, identical)

A context-doc line is dropped when it references a pruned skill in any of the three shapes the docs actually use:

1. Inline-code name: `` `k-dart` `` (existing behavior);
2. Bold name: `**k-dart**` (the failing case);
3. Skill-path mention: `skills/k-dart/SKILL.md` (defense in depth; also catches prose links).

The `AGENTS.md` filters keep their path-based predicate — adding name-shape matching there would widen the removal surface for prose without fixing any observed failure.

### 3.2 Upgrade-path parity

`upgrade-project.ts` mirrors the extended predicate in its scrub (same block, same semantics). Effect: any region-neutral project scaffolded before this fix self-heals its context doc on the next upgrade, because the COUNTRY-SCOPED SKILL PRUNE pass records pruned skills and now scrubs the row.

### 3.3 Verifier coverage

`scripts/verify-country-prune.ts` gains a fixture test that runs the pruner with the variant argument against a synthetic project whose `docs/<variant>.context.md` carries all three reference shapes plus two must-survive neighbor rows, and whose `AGENTS.md` carries a path-form row plus a must-survive row. `runPrune` accepts the optional variant argument.

### 3.4 Non-goals

- **Template row removal** — `templates/co-consult/docs/co-consult.context.md:73` stays; the row is correct whenever the scaffold target is `--country KR` (the skill ships from `templates/common/skills/`). Removal belongs to the prune step, not the template.
- **Prose references inside variant skill bodies** — `financial-statement-analysis`, `sample-driven-report-writing`, and `company-intelligence` mention `k-dart` in prose; a region-neutral scaffold leaves those dangling and the skill-lifecycle-audit reference-integrity check flags them. The 2026-09-21 allowlist mechanism (`docs/lifecycle/reference-allowlist.json`) is the established surface for that class; no change here.
- **`docs/skill-graph.md` projections** — derived per project from the registry; KR projects list `k-*` legitimately. No scrub.

## 4. Changes

| Site | Change |
|------|--------|
| `scripts/helpers/prune-country-scoped-assets.ts` | v0.3.4 → v0.4.0 — context-doc scrub predicate extended to bold + skill-path shapes |
| `scripts/upgrade-project.ts` | v1.62.0 → v1.63.0 — same predicate extension in the COUNTRY-SCOPED SKILL PRUNE scrub (dry-run semantics unchanged: scrub stays behind `!dryRun`) |
| `scripts/verify-country-prune.ts` | v1.1.0 → v1.2.0 — new reference-shape regression test; `runPrune` variant argument |
| `scripts/SCRIPTS.md` | Registry rows for the three scripts |
| `CHANGELOG.md` | Unreleased entry |

## 5. Verification

1. `bun scripts/verify-country-prune.ts` — all tests pass, including the new reference-shape test.
2. End-to-end repro: template copy + common skills + `prune … none co-consult` → context doc contains no `k-*` row; both must-survive neighbor rows intact; `AGENTS.md` rows still scrubbed.
3. No-match safety: the five existing region-neutral projects audit clean before and after (the predicate only fires on pruned-skill names).

## 6. Risks

A context-doc line that legitimately mentions a pruned skill name in passing (e.g. "re-enable with --country KR") is now dropped with the table rows. Accepted: the scrub already drops whole lines by design (T-20260921-006), such lines are dangling references in the delivered project, and the pre-fix behavior for AGENTS.md accepted the same trade-off for path mentions since 2026-09-21.
