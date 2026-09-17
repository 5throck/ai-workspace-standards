---
schemaVersion: 1.0.0
spec-id: instruction-policy-wiring
---

# Instruction Policy Wiring (ADR-0078/0079 duty distribution) — 2026-09-17

## 1. Overview

A 2026-09-17 audit of the two 2026-09-13 instruction policies found a
distribution gap: both ADRs are accepted, propagated to all 13 variant
templates, and machine-guarded for reference presence, but the actors the
ADRs name as enforcers carry no standing duty in their own manuals.

- **ADR-0078** (LLM work routing) assigns PM the routing enforcement
  point. `agents/pm.md` has the duty section; the `/sync` skill — the
  last step of the mandated route — and `docs/constitution/03-pr-workflow.md`
  do not reference the ADR.
- **ADR-0079** (ASD-STE100) assigns PM the triage-time conformance check,
  the architect the Design Gate requirement check, and specialists the
  authoring duty. None of `agents/pm.md`, `agents/architect.md`,
  `agents/docs-writer.md`, or any skill references ADR-0079. ADR-0078
  demonstrably received a dedicated duty section in `agents/pm.md`;
  ADR-0079 did not.

The audit also found standing STE violations in governed text: an
ownership idiom at `AGENTS.md:95` (replicated in 15 managed copies) and
two over-limit sentences in `skills/sync/SKILL.md` (step 0 ~60 words,
step 3.9 chain ~70 words).

## 2. Requirements and acceptance criteria

1. Add an Instruction Writing Duty section to `agents/pm.md`. Follow the
   pattern of the ADR-0078 duty section.
2. Mirror the same section into `templates/common/agents/pm.md`. Use
   project-relative wording (no `§3.9` reference).
3. Add an STE requirement-check constraint to `agents/architect.md`.
4. Add an STE authoring constraint to `agents/docs-writer.md`.
5. Reference ADR-0078 in `skills/sync/SKILL.md` step 3.9.
6. Add one LLM-routing rule bullet to `docs/constitution/03-pr-workflow.md`
   §3.2, next to the ADR-0074 bullet.
7. Replace the ownership idiom at `AGENTS.md:95` with plain wording in
   L0 and all managed copies.
8. Split the step 0 sentence in `skills/sync/SKILL.md` to ≤ 25 words per
   sentence. Keep all technical content (WARN, scoped-staging flags,
   design link).
9. Do not add machine detection. Both ADRs declare advisory/structural
   enforcement; this change wires the human/agent duties only.
10. Do not retro-edit existing design docs. ADR-0079 Consequences exclude
    retro-edits; new text only.

Acceptance criteria:

- `grep -c "ADR-0079" agents/pm.md agents/architect.md agents/docs-writer.md`
  returns ≥ 1 for each file.
- A workspace-wide grep for the ownership idiom returns no matches.
- `templates/common/agents/pm.md` contains the new duty section with
  project-relative wording.
- The 13 `templates/co-*/AGENTS.md` copies carry the corrected
  Task Owner line.
- `bun scripts/sync-skills.ts` redistributes the SKILL.md changes to all
  four platform mirrors without drift warnings.
- `bun scripts/audit.ts` passes; validate-templates PM-02 marker-zone
  parity stays green.

## 3. Chosen approach

### 3.1 PM duty section (ADR-0079)

Insert an `## Instruction Writing Duty (ADR-0079)` section directly after
the ADR-0078 duty section in both PM files. Content: PM conforms task
briefs and execution-plan rows at triage; PM flags substantive rewrites
to the owner; the standard is advisory (AGENTS.md §3.10). L0 wording
cites `AGENTS.md §3.10`; the L1 mirror cites `AGENTS.md` bare, matching
the ADR-0078 section's L0/L1 wording split.

### 3.2 Architect and docs-writer constraints

One bullet each, in the existing Constraints lists. The architect bullet
covers requirement/acceptance sections at Design Gate review. The
docs-writer bullet covers newly authored and touched instruction text,
placed next to the Korean Plain-Language bullet (same authoring-standard
family).

### 3.3 Sync skill

Step 3.9 table cell gains "LLM work routes through PM first (ADR-0078)"
in its escape-hatch clause. Step 0's 60-word sentence is split into
three sentences; no content is dropped. SKILL.md version bumps 1.5.0 →
1.6.0 with `last_reviewed: 2026-09-17`; `bun scripts/sync-skills.ts`
redistributes the mirrors.

### 3.4 Idiom replacement

Replace the Task Owner line (the ownership idiom at `AGENTS.md:95`) in
every managed copy with:

```
- **Task owner (PM)**: PM is accountable for task progress and final delivery
```

The executor line stays unchanged. Sites: `AGENTS.md`,
`templates/common/AGENTS.md`, `templates/common/agents/pm.md`, and the
variant `templates/co-*/AGENTS.md` copies (the propagator skips
`templates/common/agents/pm.md`, so it is edited by hand; variant
AGENTS.md §3.1.2 sits outside marker zones, so those copies are also
manual).

### 3.5 PR workflow constitution

Add one bullet to `docs/constitution/03-pr-workflow.md` §3.2 after the
ADR-0074 bullet: substantive LLM-assisted work must route through the
agent team per ADR-0078 before it can reach `/sync`.

## 4. Files that change

| File | Change |
|------|--------|
| `agents/pm.md` | + Instruction Writing Duty section |
| `templates/common/agents/pm.md` | + same section (project-relative wording); Task Owner line fix |
| `agents/architect.md` | + one STE constraint bullet |
| `agents/docs-writer.md` | + one STE constraint bullet |
| `skills/sync/SKILL.md` | step 0 sentence split; step 3.9 ADR-0078 ref; version 1.6.0 |
| `docs/constitution/03-pr-workflow.md` | + one routing-rule bullet in §3.2 |
| `AGENTS.md`, `templates/common/AGENTS.md`, 13 × `templates/co-*/AGENTS.md` | Task Owner line fix |

## 5. Rollout

Single PR. The `/sync` pipeline deploys governance-l1 (L0 AGENTS.md → L1)
and re-runs skill sync; the 13 variant AGENTS.md edits are manual because
§3.1.2 sits outside marker zones and no channel propagates it. verify-adr-governance
(≥0078 post-cutoff linkage) is unaffected — no ADR file changes.

## 6. Verification

- Grep acceptance criteria from Section 2.
- `bun scripts/audit.ts` exit 0.
- `bun scripts/validate-templates.ts` PM-02 parity green.
- `bun scripts/sync-skills.ts` mirror check clean.

## 7. Accessibility

Documentation-only governance work. No user-facing UI is produced.
Exempt from ADR-0065 WCAG scope; the WCAG 2.1 AA baseline does not apply.

## 8. Preview Verification

Non-UI work — no rendered surface exists. Exempt from ADR-0070 preview
verification; verification is the executed battery in Section 6.

## References

- [Source: docs/adr/0078-agent-mediated-llm-work-routing.md — Decision ¶5–6]
- [Source: docs/adr/0079-simplified-english-development-instructions.md — Decision ¶4]
- [Source: agents/pm.md:62-70 — ADR-0078 duty section pattern]
- [Source: AGENTS.md:95 — ownership idiom, removed by this spec; skills/sync/SKILL.md:42,88 — over-limit sentences]
