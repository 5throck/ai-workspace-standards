---
status: Accepted
date: 2026-08-17
author: PM + Automation Engineer
---

# ADR 0056: Positional Matching for Multi-Block Managed-Section Merges

## Context

`upgrade-project.ts`'s `mergeWorkspaceManaged()` merges managed content blocks (delimited by markers like `<!-- COMMON-CLAUDE:START -->` … `<!-- COMMON-CLAUDE:END -->`) from a variant/common template into a project's copy of the same file (`CLAUDE.md`, `GEMINI.md`, `AGENTS.md`, `agents/pm.md`, etc.) during `upgrade-project.ts` runs.

A single marker type is not always used exactly once per file. `templates/common/CLAUDE.md` legitimately contains **9 separate `COMMON-CLAUDE:START`/`END` block pairs**, each wrapping a distinct section — Native Slash Commands, Language Policy, Execution Plan Boilerplate, Native Plan Mode, Task Tracking, Project/Workspace Boundary Policy, Custom Command Error Recovery, Windows Platform Requirement, and Git & PR Additions. `GEMINI.md` similarly has multiple `COMMON-GEMINI` blocks. The marker itself carries no per-block label to distinguish which section it wraps (unlike `VARIANT-INJECT:label` or `WORKSPACE-MANAGED:description`, which support an inline description suffix).

The merge implementation did not account for this. For each pattern type, it iterated the template's list of blocks and, for every single block, ran a **global regex replace** against the project's content — `updated.replace(/<!-- COMMON-CLAUDE:START -->[\s\S]*?<!-- COMMON-CLAUDE:END -->/g, tplBlock.matched)`. Because the regex has no way to target a specific occurrence, each iteration overwrote **every** matching block in the project file with that iteration's content. The net effect after the full loop: all N project-side blocks ended up containing the **last** template block processed (in practice, "Git & PR Additions", the final entry) — duplicated N times, with the other N−1 sections' content silently destroyed.

This went undetected for at least one prior upgrade cycle (evidence: the corrupted content already carried a "Last Updated: 2026-08-17" stamp from a previous run) and was discovered on 2026-08-17 while upgrading `Projects/co-consult`, then confirmed to have also corrupted `Projects/co-architect`, `co-deck`, `co-game`, and `co-news` — 5 of 10 active variant projects.

## Decision

**Match template blocks to project blocks positionally**: for a given marker type, the template's Nth occurrence (in document order) is merged into the project's Nth occurrence of that same marker type, not "every occurrence gets replaced by every block in sequence."

Implementation (`mergeWorkspaceManaged()`, `upgrade-project.ts` 1.8.0→1.8.1):

1. For each marker pattern, collect the project file's occurrences as `{start, end}` offset pairs via `matchAll()` (not a mutating `.replace()`).
2. If the project has zero occurrences of that marker, append all template blocks (unchanged prior behavior).
3. If occurrence counts differ between project and template, log a `WARNING` and merge positionally up to `min(projectCount, templateCount)` — extra blocks on either side are left alone rather than guessed at.
4. Replace matched pairs **back-to-front** (highest offset first) via string slicing, so earlier offsets in the same pass remain valid after each splice.

Positional matching was chosen over alternatives because:
- **Per-block labels** (extending the marker syntax to `<!-- COMMON-CLAUDE:START:label -->`) would fix this more robustly but requires updating every existing template file's markers across `templates/common/` and all 10 variants — a much larger, riskier change for a same-day fix.
- **Content-hash matching** (pairing blocks by similarity to their prior content) is fragile exactly when it matters most — after corruption, the project's "prior content" for 8 of 9 blocks *is* the wrong content, so similarity scoring would degrade to the same failure mode.
- Document order is already the implicit contract the template author relies on (block N in the template corresponds to block N in the project, by construction, since projects are scaffolded from templates in a fixed sequence) — positional matching just enforces the assumption the code always implicitly depended on.

## Consequences

**Positive:**
- Managed-block merges are now correct for any marker type used multiple times per file with distinct content per occurrence.
- The mismatch warning surfaces (rather than silently guessing) when a project's block count has drifted from the template's — e.g. a project locally added or removed a numbered section.
- Re-running the fixed `upgrade-project.ts` against an already-corrupted project file correctly restores the original per-block content, since the template side is unaffected by the bug (L0/L1 sources were never corrupted, only L2 project outputs).

**Negative / Trade-offs:**
- Still relies on document order matching between template and project; if a project's blocks are ever manually reordered independently of the template, positional matching would silently pair the wrong sections. No detection exists for reordering specifically (only for count mismatches).
- Marker types remain unlabeled at the syntax level — a future per-block-label scheme (see rejected alternative above) is still the more robust long-term fix if this class of bug recurs in a new form.

## Related Fix (same investigation): `dev-sync.ts` Reused-Branch PR State Check

Restoring the corrupted projects required re-running `/sync` on branches whose earlier PR had already been merged (a normal outcome of `dev-sync.ts` reusing a non-`main` branch rather than always minting a new one). The "PR already exists for branch" guard used `gh pr view <branch> --json url`, which resolves to **any** PR for that branch regardless of state. On a reused branch whose prior PR was already `MERGED`, this made the pipeline log "commit pushed, no new PR needed" while the new commit actually had **zero PR coverage** — a silent gap between what was reported and what was true.

**Fix** (`dev-sync.ts` 1.5.3→1.5.4): the check now queries `--json url,state` and only short-circuits when `state == "OPEN"`; otherwise it proceeds to `gh pr create` as normal. Verified against `co-deck`, `co-game`, `co-news`, and `co-architect` — each correctly opened a fresh PR on a branch whose earlier PR had already merged.

## Implementation

| File | Version | Change |
|------|---------|--------|
| `scripts/upgrade-project.ts` | 1.8.0 → 1.8.1 | Positional block matching in `mergeWorkspaceManaged()` |
| `scripts/dev-sync.ts` | 1.5.3 → 1.5.4 | PR-exists check now requires `state == OPEN` |
| `scripts/audit.ts` | 2.13.0 → 2.13.1 | See ADR-0021 Amendment 3 (Homoglyph check directory exemption) — same investigation, unrelated bug |

### Affected projects restored (same-day)

`Projects/co-consult`, `co-architect`, `co-deck`, `co-game`, `co-news` — all had `CLAUDE.md`/`GEMINI.md` managed sections re-merged correctly after the fix; `co-architect` and `co-game` additionally had unrelated pre-existing `scripts/SCRIPTS.md` version drift, unregistered scripts, and (co-game only) missing agent `lifecycle:` frontmatter fixed to unblock their `/sync` audit gates.

**References:**

- ADR-0021: Platform Settings Parity Policy (Amendment 3, same-day, unrelated Homoglyph check fix from the same investigation)
- `docs/designs/upgrade-project-content-sync-plan.md` (does not cover `mergeWorkspaceManaged()` — out of that document's scope; this ADR is the first formal record of the managed-block merge design)
- `scripts/upgrade-project.ts` header comment (`v1.8.1` changelog entry)
