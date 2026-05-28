# Meeting Transcript
**Date**: 2026-05-28
**Topic**: Variant structural gaps and improvement plan
**Participants**: PM (facilitator), Architect, Security-Expert, Scaffolding-Expert
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

### PM (Opening)

This meeting was convened to review structural inconsistencies found across the four template variants (co-develop, co-design, co-work, co-security) and finalize an improvement plan. Key findings from analysis:

- co-security missing **5 agent files** (red-team-lead, pentester, threat-modeler, patch-engineer, report-writer)
- co-security missing **README.md / README_ko.md**
- co-security **skills/ directory location inconsistent** with other variants (`.claude/skills/` vs `skills/`)
- **`.gemini/commands/meeting.md` missing from all variants**
- co-work / co-security **AGENTS.md missing sections**
- Potential undiscovered issues

PM steps back as observer. Participants to present priorities and resolution directions.

---

### Architect (Round 1)

The root cause of structural inconsistencies is that the **Variant Contract is misaligned with actual validation criteria**. `VARIANT_CONTRACT.md` lists `agents/README.md` and `agents/README_ko.md` as required, but individual agent files are not Required. This is why co-security's 5 missing agent files were not caught as a contract violation.

Direct question to Security-Expert: The `skills/` location issue could be a simple inconsistency, but `.claude/skills/` is only exposed to Claude Code while root `skills/` is accessible from Gemini CLI as well. Is there a security reason to keep verify-authorization **platform-neutral**? Or should this be treated as a mistake?

Structural proposals:
1. Rather than dynamically adding `agents/<name>.md` to Variant Contract, add a **required-agents array to each variant's `variant.json`** and extend `validate-templates.ts` to cross-validate. This separates contract (common structure) from variant.json (variant-specific required agents).
2. `.gemini/commands/meeting.md` absence: add to `templates/common/.gemini/commands/` so new projects automatically include it. Existing projects need a migration guide.
3. co-work and co-security AGENTS.md section gaps: Scaffolding-Expert's opinion needed — should these sections be managed as a common baseline in `templates/common/`, or maintained independently per variant?

---

### Security-Expert (Round 1)

Architect's question about skills location has a clear answer: **verify-authorization must be in a platform-neutral location. This is not a mistake.**

If a co-security engagement team using Gemini CLI cannot access verify-authorization because it is only in `.claude/skills/`, the authorization gate becomes **bypassable by choice of AI tool**. Security controls must not be tool-dependent. Co-security's root `skills/` location is intentional and should be maintained.

However, the larger problem: `VARIANT_CONTRACT.md`'s Skill Placement Rule documents the distinction between `.claude/skills/` and `skills/`, but **there is no criterion defining which skills MUST be platform-neutral**. A rule must be codified: skills acting as security gates must be forced into platform-neutral location.

Question to Scaffolding-Expert: Does `new-project.sh/ps1` treat `.claude/skills/` and `skills/` differently, or copy both the same way? Need to verify co-security scaffolding correctly produces both locations.

Additional point: `.gemini/commands/meeting.md` absence is also significant in a security training context. In co-security, the meeting skill is used for red team and threat modeler alignment on attack paths. Gemini users lacking `/meeting` access creates a gap in collaboration protocol.

---

### Scaffolding-Expert (Round 1)

Direct answer to Security-Expert: `new-project.sh` performs a **full directory copy** of the variant directory. It preserves paths regardless of whether `skills/` is at root or in `.claude/skills/`. Selecting co-security correctly creates the `skills/` directory at project root.

However, there is a validation gap: `validate-templates.ts`'s Variant Contract check must know that co-security skill paths are in `skills/` not `.claude/skills/`. Whether `variant-contract.json` has co-security skill paths correctly registered needs verification.

Architect's proposed required-agents array in `variant.json` is supported from a scaffolding perspective. One practical issue: `new-project.sh` currently does simple directory copy, so required-agents validation only has meaning as **post-creation validation** (`validate-templates.ts`), not pre-creation validation. An incomplete variant template will scaffold without agent files. A pre-flight validation check must be added to the start of `new-project.sh`.

co-security `README.md` and `README_ko.md` absence is a **template gap, not a scaffolding gap**. `new-project.sh` only copies existing files, so content must be added to the template first — this is content for architect to design and docs-writer to write.

Response to Architect's AGENTS.md common baseline question: **Placing a common baseline in `templates/common/` does not fit the current structure.** common has no AGENTS.md; each variant maintains its own. Commonizing baseline sections would require changing the scaffolding approach from "simple copy" to "partial merge," significantly complicating new-project.sh. Practically, **updating each variant's AGENTS.md individually against co-develop as reference is the better path**.

---

### Architect (Round 2)

Scaffolding-Expert's identification of pre-flight validation and the "simple copy vs partial merge" trade-off hits the core issue. I revise my position: common AGENTS.md commonization is too complex relative to its value. I agree with individual updates.

Security-Expert's clarification resolves the skills location question. Building on that, the concrete rule text for `VARIANT_CONTRACT.md`:

```
## Security-Critical Skill Rule
Any skill that acts as an authorization gate, access control, or
security enforcement mechanism MUST be placed in skills/ (platform-neutral),
not .claude/skills/ (Claude-only). This ensures the gate cannot be
bypassed by choice of AI tool.
```

Priority order for all work:

**P0 (immediate):** co-security 5 agent files. AGENTS.md already has the spec so implementation cost is low.

**P1 (this PR):** co-security README.md / README_ko.md. Add Security-Critical Skill Rule to `VARIANT_CONTRACT.md`. Add `.gemini/commands/meeting.md` to all variants.

**P2 (next PR):** Add required-agents array to `variant.json` + extend `validate-templates.ts` + add `new-project.sh` pre-flight validation. Strengthen co-work / co-security AGENTS.md sections.

Final confirmation question to Scaffolding-Expert: If `.gemini/commands/meeting.md` is added to `templates/common/.gemini/commands/`, does the current `new-project.sh` copy logic correctly include it? Any risk of meeting.md being dropped in the common-to-variant overlay order?

---

### Security-Expert (Round 2)

Architect's proposed Security-Critical Skill Rule text is accurate and I support it. One addition: the rule must include **verification method**. A rule without automated validation is unenforceable — someone could accidentally move verify-authorization to `.claude/skills/` and no one would notice.

```
## Security-Critical Skill Rule
...
Enforcement: validate-templates.ts checks that skills listed as
security-gate: true in their frontmatter are NOT located in .claude/skills/.
```

Add `security-gate: true` field to `SKILL.md` frontmatter, and have `validate-templates.ts` error when a skill with this attribute is found in `.claude/skills/`. This is the only way to enforce the rule in code.

Regarding co-security agent file creation: from a security perspective, each agent file must have an **authorization prerequisite explicitly in its Constraints section**. Stating in AGENTS.md that "PM runs verify-authorization" is insufficient. red-team-lead.md, pentester.md, and others must each contain: "This agent may only be dispatched after PM has confirmed verify-authorization PASS." Any AI reading the agent file on any platform will then recognize the constraint.

---

### Scaffolding-Expert (Round 2)

Answer to Architect: Adding `.gemini/commands/meeting.md` to `templates/common/.gemini/commands/` **will be correctly included** by `new-project.sh`. The script copies common first, then variant overlays it. Since co-develop and other variants do not have `.gemini/commands/meeting.md`, there is no override risk.

Note: co-develop currently also lacks `.gemini/commands/meeting.md`, so co-develop would also receive it from common. If co-develop later adds its own `.gemini/commands/meeting.md`, it would override the common version. A policy must define which version is authoritative when both exist — common is the recommended authority.

Security-Expert's `security-gate: true` frontmatter field and validate-templates.ts integration is supported from scaffolding perspective. Implementation burden is low since validate-templates.ts already parses frontmatter.

Additional point: `test-security-project/` was left in the workspace root and recently deleted. This reveals that **scaffolding post-verification cleanup is not automated**. Recommend adding `--test` flag to `new-project.sh` for auto-cleanup after validation, or at minimum adding `test-*/` pattern to `.gitignore`.

---

## Action Items

| # | Owner | Deliverable | Priority |
|---|-------|-------------|----------|
| A-01 | docs-writer | Create co-security `README.md` and `README_ko.md` | P0 |
| A-02 | automation-engineer | Create 5 co-security agent files (`red-team-lead`, `pentester`, `threat-modeler`, `patch-engineer`, `report-writer`) — each Constraints section must include verify-authorization prerequisite | P0 |
| A-03 | architect | Add Security-Critical Skill Rule to `VARIANT_CONTRACT.md` (including security-gate frontmatter enforcement spec) | P1 |
| A-04 | automation-engineer | Add `templates/common/.gemini/commands/meeting.md` + validate across all variants | P1 |
| A-05 | architect | Design required-agents array schema for `variant.json` + extend `validate-templates.ts` + add pre-flight validation to `new-project.sh` | P2 |
| A-06 | automation-engineer | Strengthen co-work / co-security `AGENTS.md` missing sections (Dispatch Rules, Superpowers 3-Tier, Role Boundary Matrix) | P2 |
| A-07 | scaffolding-expert | Add `--test` flag to `new-project.sh` or add `test-*/` pattern to `.gitignore` | P2 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-01 | All 5 co-security agent files exist with verify-authorization prerequisite in Constraints | `validate-templates.ts` passes; grep for "verify-authorization" in each agent file |
| AC-02 | co-security README.md and README_ko.md present | `validate-templates.ts` Variant Contract check passes |
| AC-03 | VARIANT_CONTRACT.md contains Security-Critical Skill Rule with enforcement spec | Manual review |
| AC-04 | `.gemini/commands/meeting.md` present in all variants after scaffolding | Create test project, verify file exists |
| AC-05 | `validate-templates.ts` errors when security-gate skill found in `.claude/skills/` | Unit test |

## Open Questions

- Criteria for which skills beyond verify-authorization should carry `security-gate: true` — Architect and Security-Expert to define offline.
