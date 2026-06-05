# Meeting Transcript
**Date**: 2026-06-05
**Topic**: L0/L1/L2 Project Review Findings Discussion
**Participants**: architect, auditor, automation-engineer, scaffolding-expert, lifecycle-manager
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

### Round 1

**architect** (Round 1):
Raised C-1 and C-2 as the most critical combination. C-1 (L0-only scripts leaked into co-consult) is evidence that the Fork Model was bypassed once. `team-builder.ts` is a workspace orchestration script that has no place in an L2 variant. C-2 (103 missing helpers/hooks) is the opposite problem — files added to L1 after the last scaffold without a propagation run. Proposed: (1) delete L0-only files from co-consult and trace via `git log --follow`, (2) extend `validate-templates.ts` Check 10 to cover `scripts/helpers/`. Asked automation-engineer to confirm Check 10 scope.

**automation-engineer** (Round 1):
Confirmed Check 10 only covers `scripts/` root files — `scripts/lib/` and `scripts/helpers/` are both outside its scope (drift tool caught them separately). Noted that C-3 may be an intentional omission (comment in `_ORIGIN.md` says "add manually"), but if audit.ts checks for CLAUDE.md presence, freshly scaffolded L2 projects fail immediately. Agreed with dev-sync.ts fatal branching (H-8) but asked scaffolding-expert whether the non-fatal behavior was intentional design.

**scaffolding-expert** (Round 1):
Confirmed non-fatal was intentional — variant projects without `propagation-map.json` would fail otherwise. Proposed fix: detect L0 context (e.g. CONSTITUTION.md presence) and treat publish failure as fatal only in that context. For C-3, suggested that instead of empty stubs, `_CLAUDE.md.template` / `_GEMINI.md.template` files in `templates/common/` could be auto-renamed during scaffold. Asked lifecycle-manager whether `common.lifecycle.json` tracks skill-level propagation status.

**lifecycle-manager** (Round 1):
Confirmed `common.lifecycle.json` only tracks variant names in `propagatedTo`, not skill-level propagation — this is why H-1 was not detected. Acknowledged H-5 and H-6 (co-safety and co-consult omissions) as lifecycle manager errors from prior sessions. Confirmed VERSION_REGISTRY.json and common.lifecycle.json updates are immediately feasible. Asked auditor whether `validate-templates.ts` WS-02 Check requires `inherits_common` field.

**auditor** (Round 1):
Confirmed Check 2 does not require `inherits_common` — only `name`, `description`, `status`, `lifecycle.statusSince`, `lifecycle.lastTransition` are mandatory. Highlighted the detection gap: Critical and High issues that passed `audit.ts` and `validate-templates.ts`. Proposed: (1) integrate `--check-drift` into CI or `/sync`, (2) extend `validate-templates.ts` to cover `helpers/` directory and `inherits_common` field. Suggested architect consider adding a `variant_commands` section to `common-contract.json` to track platform parity for variant-specific commands (H-2).

---

### Round 2

**architect** (Round 2):
Confirmed M-3 requires an ADR because `validate-templates.ts` Check 9 explicitly forbids CLAUDE.md/GEMINI.md in `templates/common/`. Changing this requires a governance policy decision. Proposed processing order: C-1 → C-2 → C-3 + M-1 → H-5, H-6 → rest. Classified issues into three groups: (a) immediate mechanical fixes, (b) scaffold pipeline changes, (c) governance design requiring ADRs first.

**automation-engineer** (Round 2):
Confirmed Check 9 (lines 191-198) forbids CLAUDE.md/GEMINI.md in `templates/common/` — M-3 requires Check 9 policy change. Clarified C-2 fix is two steps: (1) republish L0→L1 via `publish-to-template.ts`, (2) manual copy of `helpers/` to each L2 variant (not automatic — Fork Model). Agreed with dev-sync.ts fatal branching using `CONSTITUTION.md` existence as L0 context signal.

**scaffolding-expert** (Round 2):
Clarified that one-time sync of existing L2 variants to current L1 state is not a Fork Model violation — it is a recovery operation, not ongoing propagation. Proposed template-based approach for C-3: `_CLAUDE.md.template` + `_GEMINI.md.template` in `templates/common/`, renamed by `create-l2-scaffold.ts`. This also partially addresses M-3. Asked lifecycle-manager to consider adding skill propagation domain to `common.lifecycle.json` when fixing H-5/H-6.

**lifecycle-manager** (Round 2):
Agreed to add skill propagation tracking to `common.lifecycle.json` in format: `propagated_skills: { "meeting-facilitation": { "co-develop": true, ... } }`. Confirmed H-5, H-6, M-5 fix sequence: (1) add co-safety to VERSION_REGISTRY.json, (2) add co-consult to common.lifecycle.json `propagatedTo`, (3) add skill propagation domain, (4) add `scope: workspace` to ui-ux-pro-max/SKILL.md, (5) re-run verification scripts. Asked architect whether M-4 (common-contract.json scripts section) is ADR-level.

**architect** (Round 2 supplement):
Confirmed M-4 is ADR-level — adding a scripts section requires governance decisions about which of the 138 drift items are "allowed L2 customization" vs "missing files." Summarized three-group classification: (a) immediate mechanical, (b) scaffold pipeline, (c) governance ADRs first.

**auditor** (Synthesis):
Synthesized all findings into agreed actions and open items.

---

## Agreed Actions

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-01 | automation-engineer | Low | Delete 5 L0-only scripts from co-consult; trace via git log | L0-only | 4 |
| A-02 | automation-engineer | Low | Re-run publish-to-template.ts (L0→L1); manually sync helpers/ to all 5 L2 variants | L0-only | 4 |
| A-03 | automation-engineer | Low | create-l2-scaffold.ts: add _CLAUDE.md.template/_GEMINI.md.template generation + .gitattributes/.editorconfig copy | Both | 4 |
| A-04 | automation-engineer | Low | dev-sync.ts: fatal branch when L0 context detected (CONSTITUTION.md presence); non-fatal otherwise | Both | 4 |
| A-05 | automation-engineer | Low | l2-to-variant-pipeline.ts: change shebang from tsx to bun | L0-only | 4 |
| A-06 | lifecycle-manager | Medium | Update VERSION_REGISTRY.json (co-safety), common.lifecycle.json (co-consult + skill propagation domain), ui-ux-pro-max SKILL.md (scope field) | L0-only | 6 |
| A-07 | architect | High | Write ADRs for M-3 (L1 CLAUDE.md baseline policy), M-4 (common-contract scripts section), H-2 (variant_commands parity model) | Both | 1-2 |

## Open / Unresolved Items

| # | Item | Owner | Notes |
|---|------|-------|-------|
| U-01 | H-1: Whether common_skills absence from .claude/skills/ is design or missing propagation | PM | Re-read common-contract.json `overridable: false` semantics |
| U-02 | M-3: L1 CLAUDE.md baseline — requires Check 9 policy change ADR | architect | Block on A-07 |
| U-03 | M-4: common-contract.json scripts section — requires governance decision on 138 drift items | architect | Block on A-07 |
| U-04 | H-2: security-check.md variant_commands governance model | architect | Block on A-07 |
| U-05 | validate-templates.ts Check 10 extension to helpers/ and inherits_common field | automation-engineer | After A-07 scope is clear |
