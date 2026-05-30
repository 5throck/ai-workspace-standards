# Meeting Transcript
**Date**: 2026-05-31
**Topic**: Model Name SSOT Dispersion Problem Resolution
**Participants**: architect, auditor, lifecycle-manager, docs-writer
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

### Round 1

**architect**: (Round 1)

The root cause is clear: model names are authored in at least five separate locations with no enforcement mechanism linking them. When a model is updated, the person making the change updates `agents/*.md` (the runtime path) but has no automated signal that `docs/constitution/05-multi-agent-architecture.md` §5.1, `GEMINI.md`, `CLAUDE.md`, and template agent files also need updating. The result is what we see today — four different model strings across the workspace claiming to be authoritative.

My proposal: introduce a `model-registry.json` at workspace root (or merged into `workspace-schema.json`) as the single declarative source. All agent frontmatter comments would reference this registry. A validation script reads the registry and checks every `agents/*.md` frontmatter against it at pre-commit time.

I want to hear from lifecycle-manager about whether this creates governance overhead, and from auditor about whether existing scripts can absorb the validation or need a new entry point.

---

**lifecycle-manager**: (Round 1)

architect's diagnosis is correct. I've tracked three separate update events in the past two weeks where model names changed in `agents/*.md` but documentation was not updated. The governance gap is that there's no checklist item in the agent modification checklist (`docs/lifecycle/agents/`) requiring model-name propagation.

On the registry question: I prefer merging into `workspace-schema.json` rather than adding another file. We already have the `agent_tiers` map there — adding a `models` block keeps all workspace-level configuration co-located. A new standalone file adds cognitive overhead and another sync point.

However, I fully agree with the validation automation. The agent modification checklist must be updated to include a step: "verify model names match model-registry." I'll also flag that `templates/common/agents/pm.md` and all four variant `pm.md` files carry duplicate model name comments — these need to be corrected as part of A5.

docs-writer: can you clarify the policy for how documentation should reference model names going forward?

---

**docs-writer**: (Round 1)

The principle should be: documentation files (`CONSTITUTION.md`, `CLAUDE.md`, `GEMINI.md`) must never hard-code model names. They should reference tier labels only (`high`, `medium`, `low`) and point readers to `workspace-schema.json` (or `model-registry.json`) for the current canonical mapping.

The current §5.1 in CONSTITUTION uses a model name table — this should be replaced with a tier table that says "see model-registry for current model assignments." This means future model updates require only one file change (the registry) and documentation remains evergreen.

I'd also note that `GEMINI.md`'s execution plan table uses Claude model names (`opus/sonnet/haiku`) — that is a separate documentation error from the gemini model name issue, but both symptoms have the same root cause: model names copy-pasted into documentation without a link to the authoritative source.

auditor: from a compliance perspective, can validate-agents.ts absorb the registry check?

---

**auditor**: (Round 1)

The validation architecture question is important. Currently `validate-agents.ts` checks frontmatter structure (required fields, status values, lifecycle fields) but does not validate model name values. Adding a model-name check is straightforward — load the registry, iterate `agents/*.md`, compare the `antigravity` and `gemini-cli` model comment values against the registry's `high/medium/low` mapping for each agent's declared tier.

However, I want to flag a parsing complexity: frontmatter comments like `# gemini-3.1-pro (thinking_level="medium")` are freeform strings, not structured fields. The validator needs a regex or parser that extracts just the model name substring. This is doable but should be scoped carefully.

My recommendation: create a dedicated `validate-model-registry.ts` rather than burdening `validate-agents.ts` further. This new script checks (1) registry file exists and is valid JSON, (2) every agent frontmatter model comment matches the registry for its tier. Add it to pre-commit hook and register in `SCRIPTS.md`.

---

### Round 2

**architect**: (Round 2)

lifecycle-manager makes a good point about `workspace-schema.json` co-location. I'll revise my position: merge the `models` block into `workspace-schema.json`. The key is that whatever file holds it must be the canonical reference — `docs/constitution/05-multi-agent-architecture.md` §5.1 table becomes a pointer, not an authoritative source.

On the immediate fix (A5): `docs/constitution/05-multi-agent-architecture.md` currently says `gemini-2.5-pro` and `gemini-2.0-flash`. The user confirmed `agents/*.md` is correct with `gemini-3.1-pro` (high) and `gemini-3.5-flash` (medium/low). So §5.1 must be updated to match agent files. This is not a future change — it is a current correctness issue.

I want to confirm with auditor: should the §5.1 update happen before or after the registry is introduced?

---

**lifecycle-manager**: (Round 2)

The §5.1 update should happen immediately and independently of the registry introduction. The registry is a structural improvement; the §5.1 correction is a bug fix. Conflating them risks delaying the bug fix while the registry design is debated.

Concrete sequencing recommendation:
1. Fix §5.1 now (correct model names to match agents/*.md)
2. Fix GEMINI.md execution plan table now
3. Fix template pm.md files now
4. Introduce model-registry as workspace-schema.json models block (separate PR)
5. Write validate-model-registry.ts and hook it (same PR as #4)
6. Update agent modification checklist to require registry check

This gives us immediate correctness and a sustainable long-term structure.

---

**docs-writer**: (Round 2)

I agree with lifecycle-manager's sequencing. On the documentation side, the §5.1 fix needs one additional change beyond just updating model names: add a note "Model names are maintained in workspace-schema.json models block. This table reflects the current registry values." This future-proofs the documentation so the next model update has a clear process.

For GEMINI.md: the execution plan table header row currently says `| opus/sonnet/haiku |` — this should be replaced with `| high/medium/low (see model-registry) |`. The body rows that reference specific model families should also use tier labels.

I want to flag one more location: `CLAUDE.md §5 Cost Optimization` has inline model name mentions. These should also move to tier labels with a registry reference. However, given CLAUDE.md's role as a behavioral config file (not a reference doc), model names there serve a practical purpose for Claude Code's dispatching logic. lifecycle-manager should assess whether removing them from CLAUDE.md is safe.

---

**auditor**: (Round 2)

Completing lifecycle-manager's sequencing with validation specifics:

The immediate correctness fixes (§5.1, GEMINI.md, template pm.md files) can be one PR — they are all documentation-only changes with no behavior change.

The registry introduction (workspace-schema.json models block + validate-model-registry.ts) should be a separate PR because it changes the schema file and adds a new pre-commit check, which requires its own audit pass.

CLAUDE.md §5 model names: docs-writer raises a valid concern. My assessment is that CLAUDE.md's model names are operational (they guide dispatching decisions by the PM agent) and should NOT be converted to tier labels — an agent reading CLAUDE.md needs the actual model name. However, CLAUDE.md should add a note: "Current model assignments are maintained in workspace-schema.json models block." This way the documentation is linked without losing operational specificity.

Synthesis follows.

---

## Action Items

| # | Owner | Deliverable | Phase |
|---|-------|-------------|-------|
| A-01 | automation-engineer | Add `models` block to `workspace-schema.json` with gemini-3.1-pro / gemini-3.5-flash values | Phase 4 |
| A-02 | automation-engineer | Update `docs/constitution/05-multi-agent-architecture.md` §5.1 model table to match agents/*.md | Phase 4 |
| A-03 | docs-writer | Update `GEMINI.md` execution plan table — replace Claude model names with tier labels + registry reference | Phase 4 |
| A-04 | automation-engineer | Write `scripts/validate-model-registry.ts` + register in SCRIPTS.md + add to pre-commit hook | Phase 4 |
| A-05 | lifecycle-manager | Update `templates/common/agents/pm.md` + 4 variant `pm.md` model name comments | Phase 6 |
| A-06 | docs-writer | Add registry reference note to `CLAUDE.md §5` and `docs/constitution/05-multi-agent-architecture.md` §5.1 | Phase 4 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-1 | `workspace-schema.json` contains `models` block with correct values | `bun scripts/validate-model-registry.ts` exits 0 |
| AC-2 | All `agents/*.md` model comments match registry | validate-model-registry.ts check passes |
| AC-3 | `docs/constitution/05-multi-agent-architecture.md` §5.1 shows gemini-3.1-pro / gemini-3.5-flash | Manual review |
| AC-4 | No Claude model names in GEMINI.md execution plan table | grep audit |
| AC-5 | pre-commit hook includes model-registry validation | hook execution test |
