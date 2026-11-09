# Meeting-Facilitation Committee Alignment (v1.4.4 → v1.5.0) — Design (Row 0)

- **Spec id**: `2026-11-09-meeting-facilitation-committee-alignment-design`
- **Date**: 2026-11-09
- **Status**: proposed (Design Gate — registration happens at implementation via /sync)
- **Author**: architect (PM-dispatched)
- **Upstream request**: U-20261109-001 (co-newbiz; their ADR-0196 committee-minutes design — the requirements quoted in the ticket are the spec)
- **Related**: `skills/meeting-facilitation/SKILL.md` v1.4.4 (the single file this design rewrites), retirement record `docs/lifecycle/skills/meeting.md` (the `/meeting` command, retired 2026-09-26), `docs/designs/2026-11-08-gw-tenant-loop-and-hardening-design.md` (format exemplar)

## 1. Problem statement

The workspace's meeting facilitation skill predates co-newbiz's committee-minutes doctrine (ADR-0196). Verified current state (2026-11-09): `skills/meeting-facilitation/SKILL.md` is v1.4.4 at root (65 lines; frontmatter L1-21, Context L23, When to Use L30, Execution Steps L37-45, Output Format L49-53, Governance Rules L55-60, Related Skills L62-65). Three gaps against the committee requirements:

1. **No response contract after round 1.** The current step 2 ("round-robin dialogue: each participating agent contributes per round") lets later rounds degrade into parallel monologues — participants never have to engage each other, answer direct questions, or declare whether their stance moved. Committee-grade deliberation requires named, attributable engagement.
2. **No agenda distillation.** All rounds run on the single opening topic; a meeting with several live issues never separates them, so synthesis mixes unrelated threads.
3. **Output format tension.** The current Output Format bullet "Synthesized outcomes and decisions" (L52) contradicts governance invariant 2 ("PROPOSAL, never decision", L59) in its own file — the minutes format invites decision-shaped artifacts that the governance rules forbid. The committee-form minutes spec (issues → attributed discussion → agreements → verbatim dissent → open questions → action items → proposal) resolves the tension structurally and makes verbatim dissent (invariant 3) a mandatory section instead of a convention.

Also verified: root `.claude/commands/meeting.md` does **not exist** (retired 2026-09-26; record at `docs/lifecycle/skills/meeting.md`) — the request's second target file is moot at root and is not part of this design. Cascade state: root + the three dot-dir mirrors (`.claude/`, `.gemini/`, `.agents/skills/`) + `templates/common/skills/` are byte-identical at v1.4.4; the 16 scaffolded project copies receive updates through upgrade machinery (untouched at L0). Two divergent lineages exist — 38 legacy v1.4.3 command stubs and a co-safety-only v1.5.0 copy — pre-existing divergence, **out of scope**, to be flagged for a separate hygiene ticket.

## 2. Goals and non-goals

**Goals**

- G1: Round 2+ response contract — every participant addresses at least two named peers (agree/rebut/ask), answers questions addressed to them in the previous round, states an explicit stance-change line, and stays on agenda issues.
- G2: Facilitator agenda pass — after round 1, the facilitator distills 2-5 named agenda issues; remaining rounds run per issue. Execution Steps are rewritten for this flow (not bolted on).
- G3: Committee-form minutes Output Format replacing the 4-bullet list, resolving the L52 "decisions" wording against invariant 2, and making verbatim dissent a mandatory minutes section.
- G4: The three existing governance invariants survive byte-for-byte in meaning (dissent seat; PROPOSAL-never-decision; dissent verbatim). Skill stays ~100 lines (from 65). Version 1.5.0 + last_reviewed 2026-11-09.

**Non-goals**

- No structural re-architecture: same frontmatter shape, same section order (Context → When to Use → Execution Steps → Output Format → Governance Rules → Related Skills), single-file change.
- No new round-count maximum, no silent cap — the round count stays a meeting parameter set at agenda time.
- No change to who invokes the skill (PM), the transcript path convention (`memory/meeting-YYYY-MM-DD-[slug].md`), triggers, owner, or scope fields.
- No cleanup of the divergent lineages (38 v1.4.3 stubs, co-safety-only v1.5.0) — hygiene ticket, see §1.
- No resurrection of the retired `/meeting` command.

## 3. Design — exact proposed section text

### 3.1 Frontmatter (two-line change)

`version: 1.4.4` → `version: 1.5.0`; `last_reviewed: 2026-09-26` → `last_reviewed: 2026-11-09`. All other frontmatter lines byte-identical.

### 3.2 Execution Steps — full replacement (current L37-45)

```markdown
## Execution Steps

The skill runs the facilitation flow directly:
1. **Agenda setting**: state the topic, objectives, participants, and round count. The
   round count is a meeting parameter fixed here — never reduced silently mid-meeting.
2. **Opening round (round 1)**: each participating agent states its position and
   supporting evidence on the topic.
3. **Facilitator agenda pass**: after round 1, the facilitator (or PM) distills the
   contributions into 2-5 named agenda issues reflecting where positions spread
   (criteria and recommendations), and states the issue list before round 2.
4. **Deliberation rounds (round 2+)**: run the remaining rounds issue by issue. For
   each agenda issue, every participating agent MUST:
   - address at least two named peers with an explicit agree / rebut / ask;
   - answer every question another participant addressed to it in the previous round;
   - state an explicit stance line: `changed: <from> → <to>` or `no change: <position>`;
   - stay on the agenda issue — new topics go to the facilitator for the issue list.
   The PM facilitates and keeps contributions on-agenda.
5. **Outcome synthesis**: a cross-domain agent (or the PM) synthesizes agreements,
   open points, and a proposed recommendation per issue.
6. **Transcript logging**: write the transcript to `memory/meeting-YYYY-MM-DD-[slug].md`.
```

Design notes: step 1 keeps round-count-as-parameter and adds the no-silent-reduction sentence (requirement in the ticket). Steps 2-3 implement the agenda pass; the 2-5 issue bound is the committee spec's own number. Step 4 is the response contract verbatim from the requirements — "at least two named peers" is a floor, not a cap. The stance line's two exact forms make stance tracking mechanical in the transcript.

### 3.3 Output Format — full replacement (current L47-53)

```markdown
## Output Format

Meeting transcript written to `memory/meeting-YYYY-MM-DD-[slug].md` containing, in order:
- Agenda, objectives, participants, and the issue list from the facilitator agenda pass
- Discussion by issue: attributed exchanges (who said what to whom), round by round
- Agreements reached per issue
- Preserved dissent: recorded disagreements transcribed VERBATIM — never summarized,
  never averaged into consensus (Governance Rule 3)
- Open questions carried forward
- Action items with owner assignments
- Proposed recommendation per issue, explicitly labelled a PROPOSAL for the user's
  approval — never a decision or PASS stamp (Governance Rule 2)
```

This replaces the L52 bullet ("Synthesized outcomes and decisions") — the word "decisions" disappears from the output contract, and the proposal-only labeling is now enforced by the format itself with an explicit back-reference to the governance rule. Verbatim dissent becomes a named, ordered minutes section with the same back-reference — invariant 3 is now structurally impossible to skip in the artifact.

### 3.4 Governance Rules — unchanged

Current L55-60 stays byte-identical. The three invariants (dissent seat; PROPOSAL, never decision; dissent preserved verbatim) already ground everything the new sections reference — the design deliberately strengthens enforcement through the Output Format rather than by re-editing the invariants.

### 3.5 Context / When to Use / Related Skills — unchanged

Sections at current L23-35 and L62-65 stay byte-identical, including the retirement sentence naming 2026-09-26 (the request's second target file — root `.claude/commands/meeting.md` — does not exist and needs nothing).

### 3.6 Length and structure check

Frontmatter 21 + Context 6 + When to Use 7 + Execution Steps 24 + Output Format 12 + Governance Rules 7 + Related Skills 4 + headings/blank lines ≈ **95-100 lines** (from 65) — inside the target band.

## 4. Cascade and versioning

- **SSOT**: `skills/meeting-facilitation/SKILL.md` (root) — the single edited file.
- **Dot-dir mirrors** (`.claude/skills/`, `.gemini/skills/`, `.agents/skills/`): regenerate through the existing mirror-sync machinery (`scripts/sync-agent-mirrors.ts`, dev-sync step 4.61) — no hand edits.
- **`templates/common/skills/meeting-facilitation/`**: synced by the existing dev-sync publish/skill-sync step — no hand edits. Delivered to new scaffolds from there.
- **16 project copies**: updated through the normal `upgrade-project` wave — out of this PR's diff.
- **`docs/VERSION_MANIFEST.md`**: skill row updated to 1.5.0 in the implementation PR (registry edit happens at implementation, not in this design).
- **Known divergences flagged, not fixed**: 38 legacy v1.4.3 command stubs and the co-safety-only v1.5.0 copy (version collision is coincidental — different trees, pre-existing divergence). PM files a hygiene ticket referencing this design's §1 census.

## 5. Affected surfaces

| File | Action | Description |
|------|--------|-------------|
| `skills/meeting-facilitation/SKILL.md` | modify | §3.1-§3.5 exact text; version 1.5.0; last_reviewed 2026-11-09 |
| `.claude/skills/`, `.gemini/skills/`, `.agents/skills/` mirrors | regenerate | Existing mirror-sync machinery (step 4.61); no hand edits |
| `templates/common/skills/meeting-facilitation/SKILL.md` | regenerate | Existing skill-sync step; no hand edits |
| `docs/VERSION_MANIFEST.md` | modify | Skill row → 1.5.0 (implementation PR) |
| `docs/lifecycle/skills/meeting-facilitation.md` (if the skill carries a lifecycle record) | verify | Status/date hygiene at implementation per the lifecycle conventions |

## 6. Acceptance criteria (each verifiable)

- [ ] Root SKILL.md is v1.5.0 with `last_reviewed: 2026-11-09`; all three dot-dir mirrors and the templates/common copy are byte-identical to root (existing parity checks green).
- [ ] Execution Steps contain the four round-2+ contract clauses verbatim (two named peers with agree/rebut/ask; answer prior-round questions; explicit `changed:`/`no change:` stance line; stay on agenda issue) and the facilitator agenda pass with the 2-5 issue bound.
- [ ] Round count appears only as a parameter fixed at agenda setting, with the no-silent-reduction sentence; no maximum is introduced anywhere in the file.
- [ ] Output Format contains all seven committee-form sections in order, with the VERBATIM dissent section and the PROPOSAL-labelled recommendation; the string "decisions" no longer appears anywhere in the file's Output Format or Execution Steps (grep-verifiable).
- [ ] Governance Rules section is byte-identical to v1.4.4 (diff-verifiable).
- [ ] File length is 90-110 lines.
- [ ] A dry-run facilitation (one low-stakes topic, two rounds) produces a transcript matching the new Output Format — PM spot-check at implementation.

## 7. Rollback

Single-file revert restores v1.4.4 at root; mirrors and templates/common regenerate through the same sync machinery on the next sync run. No script, registry schema, or pipeline behavior changes — the skill is prose consumed at facilitation time. Project copies at v1.5.0 continue to work with the v1.4.4 root (both describe valid facilitation flows; no cross-version contract exists between copies).

## 8. Platform Impact (mandatory)

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | Mirror regeneration of `.claude/skills/meeting-facilitation/SKILL.md` via step 4.61; no settings/command change | mirror copy only |
| Antigravity (GEMINI.md) | Mirror regeneration of `.gemini/skills/meeting-facilitation/SKILL.md` via step 4.61; no other `.gemini/` change | mirror copy only |
| templates/common | **Propagation required via existing machinery**: `templates/common/skills/meeting-facilitation/SKILL.md` regenerates byte-identically through the skill-sync step; the 16 project copies update via the upgrade wave, not this PR | 1 file |

## 9. Accessibility note

Documentation-only change — a single SKILL.md prose rewrite with no UI, no code, and no rendered artifact surfaces; the accessibility audit is exempt for this design.

## 10. Open questions

1. **Stance-line grammar** (confirmation only): the design pins two exact forms (`changed: <from> → <to>` / `no change: <position>`) to make stance tracking mechanical. If co-newbiz's ADR-0196 uses a different canonical wording, their spec wins — confirm at the gate which grammar is canonical.
2. **Issue-count bound**: 2-5 issues comes from the committee requirements; if a meeting legitimately needs 6+ issues, the facilitator currently must split the meeting. Confirm this hard bound is intended (default: keep 2-5, per the spec).
3. **Hygiene ticket split-point**: the 38 legacy stubs and the co-safety-only v1.5.0 lineage are flagged but unscheduled — confirm the PM files the hygiene ticket at this design's implementation rather than folding the cleanup into this PR (default: separate ticket).

## 11. References

- `skills/meeting-facilitation/SKILL.md` v1.4.4 (65 lines; line cites in §1 verified 2026-11-09)
- U-20261109-001 (co-newbiz; ADR-0196 committee-minutes requirements quoted in the ticket)
- `docs/lifecycle/skills/meeting.md` (retirement record, 2026-09-26 — second target file moot)
- Mirror/sync machinery: `scripts/sync-agent-mirrors.ts` (dev-sync step 4.61), dev-sync skill-sync step, `tests/unit/generate-scripts-mirror.test.ts` registry conventions
- `docs/designs/2026-11-08-gw-tenant-loop-and-hardening-design.md` (format exemplar)
