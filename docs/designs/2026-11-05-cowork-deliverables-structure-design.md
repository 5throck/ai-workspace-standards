# Design: co-consult-style `deliverables/` Structure for co-work

**Date**: 2026-11-05
**Status**: Implemented (user-approved 2026-11-05; registered in `docs/specs/registry.json`)
**Spec ID**: 2026-11-05-cowork-deliverables-structure
**Scope**: L0 scaffold (`scripts/new-project.ts` §2.6a), L2 template (`templates/co-work/`), L2 project (`Projects/co-work/`)

---

## 1. Problem & Goal

co-work currently has no dedicated home for client-facing artifacts. Its File
Organization Policy (`docs/co-work.context.md` "Recommended Folder Structure")
sends final deliverables to `docs/reports/`, which conflates governance and
process documentation (project review reports, hub-probe records) with
client-ready output. The actual `docs/{reports,drafts,research}/` directories
exist in both the project and the template but are empty except `.gitkeep` —
the convention is declared but unused.

**User directive**: adopt co-consult's 5-directory `deliverables/` structure
verbatim (same structure as co-consult (user directive, original in Korean)) across three tiers:

1. **L2 project** — `Projects/co-work/`
2. **L2 template** — `templates/co-work/`
3. **L0 scaffold** — `scripts/new-project.ts` so future co-work scaffolds get it at creation

The design doc lives at the workspace root `docs/designs/` (not project-local)
because the change spans L0 + L2-template + L2, per the ADR-0074 Design Gate
convention for multi-tier changes.

## 2. Target Structure (co-consult convention)

| Folder | Purpose |
|--------|---------|
| `deliverables/reports/` | Final deliverables, client-ready reports |
| `deliverables/drafts/` | Work-in-progress documents and drafts |
| `deliverables/research/` | Research findings, analytical outputs, data analysis results |
| `deliverables/references/` | Reference materials, source archives, citations |
| `deliverables/presentations/` | Client presentation decks |
| `memory/` | Session logs, meeting transcripts (unchanged) |

Each subdirectory gets a `README.md` adapted from co-consult's wording but
pointing to the **Output Destination Mapping** in `docs/co-work.context.md`
(co-consult's READMEs point to `docs/co-consult.context.md`).

**Deck pipeline note**: the in-flight presentation pipeline uses working files
→ `deliverables/drafts/` and final PPTX output → `deliverables/presentations/`.

## 3. Proposed Change per Tier

### 3.1 L2 project (`Projects/co-work/`)

| File / Path | Action |
|------|--------|
| `deliverables/{reports,drafts,research,references,presentations}/` | Create; each with `README.md` (co-work.context.md pointer) |
| `docs/reports/`, `docs/drafts/`, `docs/research/` | `git rm -r` (each contains only `.gitkeep`; all three are tracked — verified) |
| `docs/co-work.context.md` L148-152 | Replace the 3-row folder table with the 5-row `deliverables/` table + add an Output Destination Mapping section (naming table) |
| `docs/user-guide.md` L99-101, `docs/user-guide_ko.md` L104-106 | Update folder tables to `deliverables/` rows |
| `docs/context.md` L341, L375 | File Type Routing row `docs/drafts/` → `deliverables/drafts/`; Research Output section `docs/research/` → `deliverables/research/` |
| `docs/stack-profile.json` | `artifacts[].path` + 3 `handoffs[].artifact` entries: `docs/drafts/` → `deliverables/drafts/` |
| `docs/workspace-schema.json` L1821 | Hub-probe report path `docs/reports/YYYY-MM-DD-hub-probe-<hub>.md` → `deliverables/reports/...` |
| `.claude/commands/project-review.md` L11, `.gemini/commands/project-review.md` L11, `.codex/prompts/project-review.md` L11 | Persist path `docs/reports/YYYY-MM-DD-project-review-<scope>.md` → `deliverables/reports/...` |
| `project-review/SKILL.md` (copies: `skills/`, `.agents/skills/`, `.claude/skills/`, `.gemini/skills/`, `.codex/skills/`, `.hermes/skills/`) | L10, L195, L235: same path replacement in all byte-copy siblings, same commit |

Project copies of L1 scripts (`scripts/audit.ts` L831-842, `scripts/validate-md-language.ts`
L39/L53, `scripts/lifecycle-sync-audit.ts` L122, `scripts/helpers/scaffold-markers.ts` L89)
reference the old paths in comments/log strings only — see §5 and §7 (follow-up, not in scope).

### 3.2 L2 template (`templates/co-work/`)

Identical restructure:

- Create `deliverables/{reports,drafts,research,references,presentations}/` + READMEs
- `git rm` `docs/{reports,drafts,research}/` (each contains only `.gitkeep` — verified)
- Update `templates/co-work/docs/co-work.context.md` L156-158 (same table replacement as §3.1)
- Update `templates/co-work/docs/user-guide.md` L99-101 and `user-guide_ko.md` L104-106
- Update `templates/co-work/docs/stack-profile.json` (same 4 entries)

The `project-review` skill/commands are project-local (not delivered from this
template — verified by grep), so no template changes for them.

### 3.3 L0 scaffold (`scripts/new-project.ts` §2.6a, lines ~1128-1152)

Today §2.6a is hardcoded to `variant === 'co-consult'` and creates only 4 dirs
(`reports,drafts,research,presentations` — no `references/`).

**Change**: add a parallel co-work branch in the same section, creating the
full 5 dirs with READMEs that reference `docs/co-work.context.md`. The
co-consult block remains **byte-identical**.

**Recorded drift (not fixed here)**: co-consult's context doc lists 5
directories and its live tree has `deliverables/references/` with a README,
but the scaffold creates only 4. Fixing that is a separate follow-up so the
co-consult block stays untouched in this change (§7).

## 4. Naming & Language Convention

Adopt co-consult's pattern: `{topic}-YYYY-MM-DD[_ko].md`.

- **Korean default for client deliverables**, `_ko.md` suffix; English
  deliverables (explicit client request only) use `.md` without suffix.
- **Explicit carve-out**: this is a deliverable-language exception to the
  English-only repo-documentation rule in the workspace Language Policy.
  Rationale: files under `deliverables/` are client artifacts, not repository
  documentation; the carve-out matches established co-consult practice.
  The English-only rule continues to govern `docs/`, `agents/`, `skills/`,
  root files, etc.
- **Gate compatibility**: `deliverables/` is not in
  `templates/common/scripts/validate-md-language.ts`'s allowlist, so Korean
  deliverables are not gated and no script change is needed. This also means
  the language gate does not *enforce* the convention — it is documented in
  context.md only (acceptable; same as co-consult today).

## 5. Compatibility & Risk

| Item | Assessment |
|------|------------|
| `audit.ts` docs/research References check (L831-842) | Guarded by `fs.existsSync()` — dir removed → check silently skipped. Harmless. Follow-up: repoint to `deliverables/research/` in L1 common scripts. |
| `validate-md-language.ts` docs/reports scan | `docs/reports/` is in the allowlist; dir removed → no-op. `deliverables/` ungated (see §4). Follow-up only. |
| `validate-doc-folder.ts --workspace` | Validates the **workspace root** `docs/` only — `workspaceRoot` resolves from `import.meta.dir/..` (verified L150-154). Project `docs/` folder layout is not manifest-governed; no manifest change needed. Confirmed and stated. |
| upgrade-project tree-sync | Both template and project remove the same paths → no re-delivery expected and no tombstone needed. `.claude/last-upgrade-delivery.json` still lists the old `.gitkeep` paths, but it is a historical delivery record, not a delivery source. Dry-run verification is mandatory before real run (§6c). |
| In-flight deck task | Working-file output path shifts `docs/drafts/` → `deliverables/drafts/`; final PPTX lands in `deliverables/presentations/`. Coordinate with the live task before switching. |
| Agent/handbook references | All in-project functional references enumerated in §3.1; residual comments in project script copies are cosmetic. |

## 6. Verification Plan

| # | Check | Expected |
|---|-------|----------|
| a | `bun scripts/validate-doc-folder.ts` (in co-work, project mode) | Clean pass |
| b | `bun scripts/audit.ts` (in co-work) | Clean pass; no new warnings from removed dirs or deliverables/ |
| c | `bun scripts/upgrade-project.ts Projects/co-work --dry-run` (workspace root) | **No delivery of `docs/{reports,drafts,research}/` paths**; clean pass; confirms no tombstone requirement |
| d | `bun scripts/validate-templates.ts` (workspace root) | Clean pass |
| e | `grep -rn "docs/reports\|docs/drafts\|docs/research"` in project + template (excluding `memory/`, `.claude/last-upgrade-delivery.json`, script comments) | Zero functional hits |
| f | Register spec: `bun scripts/spec-register.ts --file docs/designs/2026-11-05-cowork-deliverables-structure-design.md --source manual` | Registry entry created (ADR-0074; before `/sync`) |

## 7. Out of Scope (documented follow-ups)

1. **L1 common script path updates** — `templates/common/scripts/audit.ts`
   (docs/research References check) and `templates/common/scripts/validate-md-language.ts`
   (docs/reports translation zone). PM ruling: stale-path-only impact (scanning
   a nonexistent dir passes); repoint in a dedicated L1 change.
2. **co-consult scaffold drift** — §2.6a co-consult block creates 4 dirs while
   co-consult's convention/scaffolded-tree expectation includes
   `deliverables/references/`. Separate change to keep the co-consult block
   byte-identical here.
3. **Workspace-root docs/ manifest** — no changes; `--workspace` mode does not
   govern project docs/ (verified).
4. **Language-gate enforcement of the `_ko` convention** — documented policy
   only; adding `deliverables/` handling to the language gate is deferred with
   item 1.

## References

- co-consult convention: `Projects/co-consult/docs/co-consult.context.md` L198-211 (File Organization Policy + Output Destination Mapping)
- co-work current convention table: `Projects/co-work/docs/co-work.context.md` L147-152; template copy L155-158
- L0 scaffold block: `scripts/new-project.ts` §2.6a (~L1128-1152)
- L1 script touchpoints: `templates/common/scripts/audit.ts` L831-842; `templates/common/scripts/validate-md-language.ts` L39, L53
- Upgrade mechanics: `scripts/upgrade-project.ts` (tree-sync delivery)
