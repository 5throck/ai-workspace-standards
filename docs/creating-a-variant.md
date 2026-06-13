# Creating a New Variant

This guide walks you through creating a new variant under `templates/`. Follow every step — the post-scaffolding validator (`validate-templates.ts`) will catch omissions.

## Prerequisites

- Understand the existing variants: `co-work`, `co-design`, `co-develop`, `co-security`
- Read `docs/templates/common-contract.json` to know which agents and skills are inherited automatically

> **Naming constraint** (enforced by `l2-to-variant-pipeline.ts` since Wave 1, security fix C-09):
> All variant names MUST match the regex `^co-[a-z][a-z0-9-]{1,30}$` — that is, start with `co-`
> followed by a lowercase letter and 1–30 lowercase alphanumeric/hyphen characters.
> Valid examples: `co-develop`, `co-safety`, `co-design`.
> Invalid: `my-variant`, `codevelop`, `co_develop`.

> **Conditional context.md generation** (introduced in Wave 1, fix C-03):
> When `new-project.ts` runs, it creates `<variant>.context.md` **only if the file does not already exist**.
> An existing file is preserved unchanged. To force regeneration from the canonical template, delete
> the existing file first: `rm docs/<variant>.context.md && bun scripts/new-project.ts <name> <variant>`

---

## Step 1 — Scaffold from the common template

```bash
bash scripts/new-project.sh "my-variant" --variant <closest-existing-variant>
```

This copies `templates/common/` as a base and the chosen variant's overrides on top.

---

## Step 2 — Define the agent team

Edit `templates/<variant>/agents/` to reflect your domain:

1. **Remove** any workspace-root agents that were copied in (`scaffolding-expert`, `architect`, `automation-engineer`, `docs-writer`, `security-expert`, `auditor`, `lifecycle-manager`). These do not belong in variants.
2. **Add** domain-specific agent `.md` files following the frontmatter specification in `CONSTITUTION.md §5.1`.
3. **Each agent file must include these frontmatter fields:**

```yaml
---
name: agent-name
phases: [1, 3]               # phases this agent is active in
handoff_to: [other-agent]    # agents this agent passes work to
handoff_from: [pm]           # agents that hand off to this agent
required_skills: [skill-name] # skills this agent needs (empty list if none)
---
```

4. Update `templates/<variant>/agents/README.md` with the new roster.

---

## Step 3 — Select skills (3-step process)

### 3.1 Inherited common skills (automatic)

All skills in `common-contract.json → common_skills` and `common_platform_skills` are inherited automatically. You do **not** need to declare or copy them. Current list: see `docs/templates/common-contract.json`.

### 3.2 Identify domain-specific skills

For each agent, check `required_skills` in its frontmatter. If a required skill does not exist in the common set, you must create or copy it.

**Skill placement rule (3-layer):**

| Layer | Location | When to use |
|-------|----------|-------------|
| A — Engine-agnostic | `skills/<name>/SKILL.md` | Lifecycle management, meeting facilitation — works on all AI engines |
| B — Platform | `.claude/skills/<name>/SKILL.md` + `.gemini/skills/<name>/SKILL.md` | Skills using Claude Code or Gemini CLI tools |

For Layer B skills: **both `.claude/` and `.gemini/` copies are required** unless the SKILL.md frontmatter explicitly sets `gemini-parity: skip`.

### 3.3 Declare variant-specific skills in variant.json

Add a `skill_manifest` section to `templates/<variant>/variant.json`:

```json
"skill_manifest": {
  "variant_specific": [
    {
      "name": "my-skill",
      "layer": "platform",
      "used_by_agents": ["my-agent"],
      "phases": [3],
      "platform_parity": "required"
    }
  ]
}
```

`inherited_from_common` is **not needed** — common skills are resolved automatically from `inherits_common` version pin.

---

## Step 4 — Update AGENTS.md Phase Summary

Replace the Phase Summary table in `templates/<variant>/AGENTS.md` with your variant's actual agents. The table must reference only agents that exist in `templates/<variant>/agents/`.

Example structure:
```
| Phase | Name | PM Facilitation | Specialist Agents |
|-------|------|-----------------|-------------------|
| 0 | Project Initiation | Orchestrator | — (PM only) |
| 1 | ... | Observer | my-agent-a |
| ...
```

---

## Step 5 — Update pm.md Agent Roster

Edit `templates/<variant>/agents/pm.md` — find the `## Agent Roster` section and replace it with a table listing only your variant's specialist agents and their phases.

---

## Step 6 — Run validation

```bash
bun scripts/validate-templates.ts --variant <your-variant>
```

Fix all **errors** before committing. Warnings are advisory.

Key checks that will run:
- **VA-01**: Phase Summary agents must all exist in `agents/` directory
- **VA-02**: Workspace-root agents must not appear in variant Phase Summary
- **VA-03**: `.claude/skills/` ↔ `.gemini/skills/` parity
- **WS-03**: Common skills must be present in variant `.claude/skills/`

---

## Checklist

Before opening a PR for a new variant:

- [ ] All workspace-root agents removed from `agents/`
- [ ] All agent files have `phases`, `handoff_to`, `handoff_from`, `required_skills` frontmatter
- [ ] `AGENTS.md` Phase Summary uses only variant-local agents
- [ ] `agents/pm.md` Agent Roster updated
- [ ] `variant.json` has `skill_manifest.variant_specific`
- [ ] Variant-specific skills exist in both `.claude/skills/` and `.gemini/skills/`
- [ ] `docs/phase-definitions.md` created for the variant
- [ ] `bun scripts/validate-templates.ts --variant <name>` passes with 0 errors
