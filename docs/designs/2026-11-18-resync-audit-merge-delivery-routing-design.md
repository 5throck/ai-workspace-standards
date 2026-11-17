# Design: resync-audit merge-delivery routing — PRESUME-STALE, never auto-discard

- **Spec ID**: 2026-11-18-resync-audit-merge-delivery-routing
- **Ticket**: T-20261117-010 (fix) · T-20261117-011 (related mirror redeploy, separate one-file fix)
- **Status**: implemented (this doc retro-documents the landed behavior per the QA ruling)
- **Scripts touched**: `scripts/resync-audit.ts` v1.9.0 → v1.10.0
- **Tests**: `tests/unit/resync-audit-merge-managed.test.ts` (new, 11 cases); existing
  `tests/unit/resync-audit-corroboration.test.ts` + `tests/unit/resync-audit-tombstone.test.ts` unchanged and passing

## 1. Problem

The 2026-11-17 fleet sweep discarded `Projects/co-game`, `co-hr`, and `co-news` `.agents/mcp.json`
on a STALE-RESIDUE verdict whose basis was "content equals current template source". The discard was
unsound on two independent grounds, exposed by the T-20261117-007 chain (which showed the TEMPLATE
side was the stale one in the same incident window):

1. **"Upgrade re-delivers" is false for merge-delivered paths.** STALE-RESIDUE's discard
   justification is that the next upgrade wave re-delivers the file fresh. For a path whose upgrade
   claim is a merge-delivery policy, the wave does NOT wholesale-overwrite: it delivers a
   **union** (managed-block merge / JSON key merge / schema leaf merge), and the project's
   merge-block edits are authoritative between waves. A project's hand-removal of a project-owned
   MCP server (the graft) is project state the wave must preserve — discarding on
   content-equality destroyed exactly that state (the committed `.agents/mcp.json` files still
   carry graft+trail entries in the three projects).
2. **Content-equality can be the wave's own output.** After a wave delivers the union, the
   working-tree file equals the template source *by construction*. Equality with the template is
   therefore not evidence of staleness for merge-delivered paths — in the observed incident it was
   the wave re-injecting a retired graft server the template side still carried.

## 2. Merge-delivery set

`mergeDeliveryPolicy(relFile, variant)` (new export in `scripts/resync-audit.ts`) is backed by
`resolveClaim` from `scripts/lib/upgrade-policy.ts` (single SSOT for delivery claims — no second
hard-coded list, the T-20260924-011 drift class) and returns the claim's policy name for the
merge-delivery family, else null:

| Policy | Pass | Example |
|---|---|---|
| `MERGE_MANAGED` | MERGE (managed-block merge) | `CLAUDE.md`, `AGENTS.md`, `agents/pm.md`, `.gitignore` |
| `MERGE_MANAGED` | DOCS_MERGE | `docs/<variant>.context.md` (variant-resolved) |
| `JSON_MERGE` | TEMPLATE TREE SYNC (union) | `.agents/mcp.json`, `.claude/settings.json`, `.gemini/settings.json`, `.mcp.json`, `opencode.json` |
| `SCHEMA_MERGE` | TEMPLATE TREE SYNC (leaf merge) | `docs/workspace-schema.json` |

Note the transitive coverage: `DOCS_MERGE` returns policy `MERGE_MANAGED`, so variant context
files are protected by the same single policy check without a pass-name comparison.

## 3. Routing decision

Chosen: route merge-delivered files to the **existing `PRESUME-STALE` verdict** rather than
introducing a new enum value. Rationale:

- PRESUME-STALE already carries exactly the required semantics: "human confirm before discard;
  routes to commit-side review like LOCAL-WORK; never auto-discarded, never snapshotted as a
  discard candidate" (`snapshotDiscardables` only collects STALE-RESIDUE rows).
- Zero enum churn: `FileRow.verdict`, `groupRows` MIXED collapse, the JSON shape, and the
  `project-resync` skill's operator table all keep their vocabulary; only meanings gain a clause.
- The basis string names the policy (`merge-delivered (JSON_MERGE)`) so the human-confirm step
  knows which claim applies.

## 4. Guard placement — 4 branches, one exclusion

`classify()` consults `mergeDeliveryPolicy` once per file and guards all template-source
comparison outcomes, in both the modified and untracked paths:

1. modified, `dirty === srcContent` → PRESUME-STALE (was STALE-RESIDUE)
2. modified, `isOlderRevision` + corroboration (`corroboratedStale` → STALE-RESIDUE) → PRESUME-STALE
   with the original corroboration basis preserved and the merge-delivery clause appended
3. untracked, `dirty === srcContent` → PRESUME-STALE (was STALE-RESIDUE)
4. untracked, corroborated stale → PRESUME-STALE (same as 2)

**Deliberate exclusion — `dirty === HEAD` branch**: the "content equals HEAD (whitespace/EOL
churn)" verdict stays STALE-RESIDUE regardless of policy. Discarding there restores the project's
own committed state — no project-owned content can be lost, because HEAD *is* the project state.
The unsoundness in §1 exists only when the comparison target is the template source.

Non-merge verdicts are byte-for-byte unchanged: the guard is a pure additional branch. The
divergent-content outcome (LOCAL-WORK) also never touches the guard — genuinely divergent
merge-delivered content remains a commit candidate.

## 5. Incident reproduction (test plan)

`tests/unit/resync-audit-merge-managed.test.ts`:

- **Pure pins** (6): `mergeDeliveryPolicy` mappings for the table above plus null for non-merge
  template-delivered paths (`.codex/skills/...` → SYNC, `skills/...`, `scripts/...`).
- **E2E `classify()` fixtures** (5): temp git repo; template source is the REAL
  `templates/common/.agents/mcp.json` read at runtime, reproducing the exact incident shape
  (working tree == template source): modified → PRESUME-STALE, untracked → PRESUME-STALE,
  corroborated older-revision (mtime older) → PRESUME-STALE (each asserting NOT STALE-RESIDUE);
  non-merge control (`.codex/skills/explain-me/SKILL.md`) still STALE-RESIDUE with identical
  basis (behavior-unchanged pin); divergent merge file still LOCAL-WORK.

Battery: resync-audit suites 36/36; `bun run test:unit`; `bun scripts/verify-scripts.ts`
(283 scripts, 0 warnings); `bun scripts/audit.ts` all-pass; `bun scripts/qa-gate.ts` full PASS
(exit 0, step 4 green — first visit of the day after the T-20261117-011 mirror redeploy).

## 6. Doc consistency

`skills/project-resync/SKILL.md` v1.8.0 → v1.9.0: the Step 0 verdict table's STALE-RESIDUE and
PRESUME-STALE rows now state the merge-delivery routing. The five platform mirrors
(`.claude/.gemini/.agents/.codex/.hermes/skills/project-resync/SKILL.md`) and the L1 platform
copies are healed by the standard dev-sync steps 4.5/4.6/4.62 (`sync-skills.ts` +
`propagate-to-templates.ts` platform domains — SKILL.md-only pattern, which project-resync
needs: it ships no subfiles).

## 7. Follow-ups

- T-20261118-002 (filed): cheap subfile-mirror drift gate for `templates/common/skills/*`
  non-SKILL.md files — the T-20261117-011 root cause (propagation-map `skills` domain
  `include_pattern */SKILL.md` never crosses `/`; `sync-skills.ts` targets platform dirs, not
  `templates/common/skills/`; subfile mirrors update only on hand-synced workspace-sync commits;
  qa-gate step 4 was the sole detector and short-circuits behind audit.ts).
- Registry rows updated in-repo (`scripts/SCRIPTS.md` → 1.10.0 + Guide section,
  `docs/VERSION_MANIFEST.md` regenerated).
