---
name: promote-variant
description: >
  Guides Phase B promotion of a completed Phase A prototype to an official workspace variant template.
  Use when: PROMOTION_CHECKLIST conditions are all met, ready to create templates/co-<name>/.
status: active
scope: common
l2_propagate: false
version: 1.0.1
owner: pm
last_reviewed: 2026-06-05
metadata:
  type: process
  triggers:
    - promote variant
    - Phase B
    - variant promotion
    - promote to template
    - create template from prototype
---

# Skill: promote-variant

## When to Use

Use this skill after all `PROMOTION_CHECKLIST.md` conditions are satisfied in `Projects/<variant-name>/`.

**Prerequisites**:
- All PROMOTION_CHECKLIST.md conditions show Done
- `bun scripts/audit.ts` passes (0 errors)
- `bun run agent:verify` passes (0 errors)
- User has reviewed `_ORIGIN.md §Manual Phase B Steps`

---

## Phase B Process

### Step 1: Final verification

```bash
cd Projects/<variant-name>

# Verify all conditions
bun run agent:verify          # Conditions 1, 5
bun scripts/validate-skills.ts  # Condition 2
bun scripts/audit.ts          # Conditions 3, 4

# Review PROMOTION_CHECKLIST.md manually
# Conditions 6, 7 require human review
```

All conditions must show Done before proceeding.

### Step 2: Update pre-promotion metadata

Before running the pipeline, update these fields in `Projects/<variant-name>/`:

**`variant.json`**:
- Confirm `inherits_common` matches current workspace common version
- `phaseAComplete`: leave as `false` (pipeline sets this)

**`_ORIGIN.md`**:
- Confirm §Manual Phase B Steps lists all domain-specific folders
- Confirm §Reconcile Survival Notes is complete

### Step 3: Run l2-to-variant-pipeline.ts

```bash
# From workspace root C:\git\
bun scripts/l2-to-variant-pipeline.ts \
  --source Projects/<variant-name> \
  --variant co-<variant-name> \
  --variantType <security|development|design|consulting|collaboration>
```

Expected output:
- `templates/co-<variant-name>/` created
- Common files reconciled (duplicates removed)
- Platform parity validated

### Step 4: Manual copy — pipeline-excluded directories

Check `_ORIGIN.md §Manual Phase B Steps` for domain-specific folders NOT scanned by the pipeline.

Common exclusions (must copy manually):
```bash
# Domain-specific directories (not auto-scanned by reconcile):
cp -r Projects/<variant-name>/workflows  templates/co-<variant-name>/workflows
cp -r Projects/<variant-name>/regulations  templates/co-<variant-name>/regulations
cp -r Projects/<variant-name>/evidence-models  templates/co-<variant-name>/evidence-models
cp -r Projects/<variant-name>/industry-profiles  templates/co-<variant-name>/industry-profiles
# Add others per _ORIGIN.md
```

### Step 5: Verify common skills in generated template

```bash
ls templates/co-<variant-name>/.claude/skills/
ls templates/co-<variant-name>/.gemini/skills/
```

If common skills were stripped by reconcile (identical to L0), manually restore:
```bash
cp -r templates/common/.claude/skills/. templates/co-<variant-name>/.claude/skills/
cp -r templates/common/.gemini/skills/. templates/co-<variant-name>/.gemini/skills/
```

> **Reconcile boundary**: `l2-to-variant-pipeline.ts` strips files from L2 that are identical to L0. Skills (`.claude/skills/`, `.gemini/skills/`) are **excluded from reconcile** and must always be present in L2. If skills are missing after pipeline run, restore them manually from `templates/common/.claude/skills/` and `templates/common/.gemini/skills/`.

### Step 6: Verify new-project.sh/ps1 picks up the new variant

`new-project.sh` and `new-project.ps1` automatically detect valid variants from `templates/` at runtime — **no manual update required**.

Verify detection works:
```bash
bash ./scripts/new-project.sh --help
# Should list co-<name> in the available variants output
```

### Step 6.5: Verify Antigravity coverage

Before running validate-templates.ts, confirm Antigravity parity is complete:

```bash
# Verify .gemini/ mirrors .claude/
diff <(ls templates/co-<variant-name>/.claude/commands/) \
     <(ls templates/co-<variant-name>/.gemini/commands/)
diff <(ls templates/co-<variant-name>/.claude/skills/) \
     <(ls templates/co-<variant-name>/.gemini/skills/)
```

Check that:
- [ ] All commands in `.claude/commands/` have a matching file in `.gemini/commands/` (or explicit `gemini-parity: skip` frontmatter)
- [ ] All skills in `.claude/skills/` have a matching file in `.gemini/skills/` (or `gemini-parity: skip`)
- [ ] `GEMINI.md` variant context section identical to `CLAUDE.md` variant context section
- [ ] Each `agents/*.md` file has Section C (Antigravity Integration)

If any gap found: fix before running validate-templates.ts.

### Step 7: Run validate-templates.ts

```bash
# From workspace root C:\git\
bun scripts/validate-templates.ts
```

Fix any P-01 parity failures before proceeding.

### Step 8: Update lifecycle metadata

**`templates/co-<variant-name>/variant.json`**:
```json
{
  "status": "beta",
  "lifecycle": {
    "statusSince": "<today-date>",
    "lastTransition": "beta -> promoted on <today-date>",
    "stablePromotedOn": null
  }
}
```

**`Projects/<variant-name>/variant.json`**:
```json
{
  "phaseAComplete": true
}
```

### Step 9: Run tag-template.ts

After all template changes are committed and verified:

```bash
# From workspace root C:\git\
bun scripts/tag-template.ts
```

This publishes a `template-v{VERSION}` git tag.

### Step 10: Update workspace AGENTS.md

Add the new variant to the workspace root `AGENTS.md` if it has a unique agent roster that should be documented.

Run:
```bash
bun run agent:verify
```

---

## Post-Promotion Checklist

- [ ] `templates/co-<name>/` created and passes validate-templates.ts
- [ ] `new-project.sh` and `new-project.ps1` correctly list co-<name> in `--help` output (auto-detected from `templates/`)
- [ ] `templates/co-<name>/variant.json` status is `beta` with correct lifecycle dates
- [ ] `Projects/<variant-name>/variant.json` has `phaseAComplete: true`
- [ ] `tag-template.ts` run and tag published
- [ ] Workspace AGENTS.md updated (if needed)
- [ ] `SECURITY.md` completed (not just stub)
- [ ] `.gemini/commands/` mirrors `.claude/commands/` (or gemini-parity: skip declared)
- [ ] `.gemini/skills/` mirrors `.claude/skills/` (or gemini-parity: skip declared)
- [ ] All `agents/*.md` have Section C: Antigravity Integration

---

## Testing the New Variant

After Phase B, verify new-project.sh creates a working instance:

```bash
# Dry run (if supported):
bash ./scripts/new-project.sh "my-test-project" --variant co-<name>

# Verify created project structure:
ls Projects/my-test-project/
```

---

## Previous Skill

<- `skills/create-variant/SKILL.md` — Phase A creation process
