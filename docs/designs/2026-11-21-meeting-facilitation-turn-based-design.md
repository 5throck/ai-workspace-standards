---
lang: ko
lang_reason: source-material
---

# Meeting-Facilitation Turn-Based Dialogue Redesign (v1.5.0 → v1.6.0) — Design (Row 0)

- **Spec id**: `2026-11-21-meeting-facilitation-turn-based-design`
- **Date**: 2026-11-21
- **Status**: implemented (registered via spec-register, source manual)
- **Author**: architect (PM-dispatched, ticket U-20261121-001)
- **Upstream request**: U-20261121-001 (co-newbiz, triaged ready, suspected layer L1). The requirements are owner-verified: co-newbiz live measurements 2026-11-20 and ADR-0204 (`Projects/co-newbiz/docs/adr/0204-committee-turn-based-meeting.md`, owner decisions in chat, default switched to turn-based 2026-11-21). ADR-0204 already names this file as the upstream-follow surface: "The CLI `committee-deliberation.ts` and `skills/meeting-facilitation` (common scope, goes upstream) follow in phase 3 for parity" (Consequences) and §14.1 M8.
- **Related**: `skills/meeting-facilitation/SKILL.md` v1.5.0 (the single hand-edited file), prior design `docs/designs/2026-11-09-meeting-facilitation-committee-alignment-design.md` (v1.5.0, the round-based flow this design replaces; also the format and verification precedent), retirement record `docs/lifecycle/skills/meeting.md`

## 1. Problem statement

The common meeting-facilitation skill (v1.5.0, 2026-11-10) specifies a **round-based** meeting: a fixed round count set at agenda time, an opening round where every participating agent speaks, then deliberation rounds where **every** participant MUST contribute on **every** issue (`skills/meeting-facilitation/SKILL.md` L40-53). Verified in production by co-newbiz (dev measurement, 2026-11-20, ADR-0204 §16.1): a 3-issue committee meeting ran 8m06s, 36 of 40 seat turns, 78 total rows; **every seat spoke in fixed order, most turns were "amend: add my domain's condition", and every issue closed 11/11 accept** — exhaustive participation, but no challenge and unanimous accept carrying no signal. Owner complaints (chat, 2026-11-20, ADR-0204 verbatim record): the minutes read as agent evaluations, not an exchange of views reaching consensus; and long meetings give no progress signal, so the owner cannot tell where the meeting is.

The generic skill has the same three defects: (P1) per-round everyone-speaks makes transcripts parallel evaluations — participants are never required to engage a specific peer in a specific turn; (P2) no progress reporting exists anywhere in the flow; (P3) the Output Format minutes have no dialogue — "attributed exchanges (who said what to whom), round by round" (L62) invites summarized position roundups, and there is no verbatim-exchange body, no full-transcript appendix, and no handling for resumed meetings.

## 2. Requirements (owner-verified, U-20261121-001)

Seven requirements, each traced to the upstream evidence:

| # | Requirement | Upstream source (ADR-0204 / design) |
|---|---|---|
| R1 | The facilitator picks 3-5 relevant participants per issue; the dissent/veto seat is ALWAYS included; non-participants are recorded as "not participating" and NEVER counted as agreement | §16.2 (phase 2.1 decision 1, owner "그렇게 해줘") |
| R2 | Speakers alternate with ask/answer/rebut turns and address peers by display name | §4.1, §4.3, §16.3 |
| R3 | Repeated amendment lists are limited | §16.4 (at most one amend per seat per issue unless answering a question) |
| R4 | Per-issue consensus is proposed by the chair and voted only by participants | §4.1 consensus step; §16.2 vote rule; chair votes nothing per ADR-0097 |
| R5 | Progress is reported as "issue i/n, speaker, turns used" | §4.2 progress / §4.8 status line; owner complaint 2 |
| R6 | Minutes: short body with verbatim key exchanges + appendix with the full turn transcript (+ "interrupted attempts" appendix when a meeting was resumed) | §4.6 minutes v2 + Q7; resume marking §15.2/Phase 2 decisions |
| R7 | Governance rules 1-3 (dissent seat; PROPOSAL never decision; dissent verbatim) stay UNCHANGED | ADR-0204 "Boundaries (binding, unchanged)" |

## 3. Verified current state (2026-11-21, origin/main ff8cf84b)

`skills/meeting-facilitation/SKILL.md` v1.5.0, 81 lines: frontmatter L1-21 (`version: 1.5.0` L10, `last_reviewed: 2026-11-10` L11); Context L23-28; When to Use L30-35; Execution Steps L37-56 (6 steps: agenda with round count L40-41, opening round L42-43, facilitator agenda pass L44-46, deliberation rounds with the four-clause response contract L47-53, outcome synthesis L54-55, transcript logging L56); Output Format L58-69 (7 committee-form sections); Governance Rules L71-76; Related Skills L78-81.

**Delivery census — 12 workspace copies, all byte-identical today (sha256 prefix `9e51bb7a`)**:

| Layer | Copies |
|---|---|
| L0 SSOT (hand-edited) | `skills/meeting-facilitation/SKILL.md` |
| L0 platform mirrors (sync-skills.ts Phase 1) | `.claude/skills/`, `.gemini/skills/`, `.agents/skills/`, `.codex/skills/`, `.hermes/skills/` |
| L1 canonical (dev-sync publish/cascade) | `templates/common/skills/meeting-facilitation/SKILL.md` |
| L1 in-template platform mirrors (same cascade) | `templates/common/.{claude,gemini,agents,codex,hermes}/skills/meeting-facilitation/SKILL.md` |

**Downstream consumers verified**:

- **Variant customization**: none. No `VARIANT-ROLE-BOUNDARY` zone exists in any delivered copy (searched all `Projects/*/skills/meeting-facilitation/` and `templates/*/skills/meeting-facilitation/`). The only divergent lineage is the **co-safety declared variant-maintained fork** (`templates/co-safety/skills/meeting-facilitation/SKILL.md` + `Projects/co-safety/` twin, sha256 prefix `2d36e71b`, legacy `/meeting` command style) — out of scope, untouched; its structural pin (`tests/unit/meeting-command-retirement.test.ts` leg 3) enforces co-safety-internal parity only.
- **18 project copies** (`Projects/co-abap` … `Projects/co-work`) — delivered artifacts, updated via the upgrade-project wave, not this PR.
- **estimate-layout**: a co-deck slide-layout measurement script (`scripts/co-deck/estimate-layout.ts`); unrelated to meeting-facilitation. No audit or script parses the skill's round structure.
- **Structural pins** (all unaffected — see §8): `tests/unit/meeting-command-retirement.test.ts`, `tests/unit/meeting-participation-boilerplate.test.ts`, `scripts/validate-skills.ts` (frontmatter fields name/status/description/owner/version + required sections — all retained).
- **Instruction-surface pointer**: the invocation one-liner "...options (`--agents a,b`, `--rounds N`, `--dialogue`)..." appears in root `AGENTS.md` L236, `CLAUDE.md` L241, `GEMINI.md` L253, `CODEX.md` L113, the corresponding per-variant template instruction files, and `.agents|claude|gemini/skills/project-review/SKILL.md` L153 (`--rounds 2`). The skill file itself never mentions `--rounds`; the flag is caller-side vocabulary (see §6).
- **Governance text**: `AGENTS.md` §3.7 Meeting Facilitation (open → facilitate → synthesize → write transcript) contains no round mechanics — no change needed.

## 4. Design — section-by-section change spec

Single-file rewrite at the SSOT; mirrors regenerate through machinery. Non-goals: same frontmatter shape, same section order (Context → When to Use → Execution Steps → Output Format → Governance Rules → Related Skills), same invocation, same transcript path convention (`memory/meeting-YYYY-MM-DD-[slug].md`), same triggers/owner/scope, Governance Rules byte-identical.

### 4.1 Frontmatter (two-line change)

`version: 1.5.0` → `version: 1.6.0`; `last_reviewed: 2026-11-10` → `last_reviewed: 2026-11-21`. All other frontmatter lines byte-identical (description keeps triggering behavior; validate-skills required fields unaffected).

### 4.2 Context / When to Use / Related Skills — unchanged

Byte-identical. The turn-based default is declared in Execution Steps, not Context.

### 4.3 Execution Steps — full replacement (current L37-56)

```markdown
## Execution Steps

The skill runs the facilitation flow directly, as a turn-based dialogue meeting:

1. **Agenda setting**: state the topic, objectives, and the participant roster, then
   distill 2-5 named agenda issues and state the issue list before any discussion.
   New topics raised mid-meeting go to the facilitator, who may append an issue with
   its own participant selection.
2. **Per-issue participant selection**: for each agenda issue, the facilitator selects
   3-5 relevant participants and records a one-line reason for each. The dissent seat
   (Governance Rule 1) is ALWAYS selected, for every issue. Agents not selected are
   recorded as "not participating in this issue" — their silence is never counted as
   agreement. A non-participant whose domain has a material stake in the issue may
   raise one floor request; the facilitator accepts or declines, and the decision is
   recorded.
3. **Turn-based discussion**: the facilitator opens each issue and hands the floor to
   the first selected participant. Speakers alternate in turns; each turn is ONE move:
   - `propose` — state a position or recommendation;
   - `ask` — a direct question addressed to a named peer;
   - `answer` — respond to a question addressed to you (its target speaks next);
   - `rebut` — challenge a named peer's statement with reasoning;
   - `concede` — accept a peer's point;
   - `amend` — refine the standing proposal (at most ONE amend per participant per
     issue, unless it answers a question addressed to that participant);
   - `pass` — decline the floor.
   Every turn addresses at least one peer by display name — never by agent key or
   role placeholder. Speaker order: the target of a pending `ask` speaks next;
   otherwise pending asks and rebutts take priority over new amendments; otherwise
   round-robin over the issue's participants. Turns are bounded: a per-issue budget
   of 3 turns per selected participant (cap 12 per issue) applies; a caller-supplied
   round count (the `--rounds N` invocation convention) maps to a budget of N turns
   per participant per issue.
4. **Progress reporting**: at every speaker change the facilitator emits one line:
   `issue i/n · speaker <display name> · turns used t/<budget>`.
5. **Per-issue consensus**: when the budget is reached or no new ask or rebut
   remains, the facilitator, as chair, proposes a consensus statement and names the
   positions it rests on. Only the issue's participants vote: `accept`, or `reserve`
   with a one-line reason. The chair never votes. The issue closes as `agreed`,
   `narrowed` (reservations recorded verbatim), or `unresolved`. These outcomes
   describe the agent exchange only — every consensus statement is a PROPOSAL for
   the user's approval, never a decision (Governance Rule 2).
6. **Minutes logging**: write the minutes to `memory/meeting-YYYY-MM-DD-[slug].md`
   in the Output Format below.
```

Design notes: (a) the agenda pass moves to meeting open — turn mechanics select participants **per issue**, so issues must exist before selection (v1.5.0 derived the agenda from an opening round in which everyone spoke; that round is the defect being removed); the mid-meeting append rule preserves v1.5.0's "new topics go to the facilitator". (b) The v1.5.0 per-turn stance line (`changed:` / `no change:`) is dropped — turn moves make engagement explicit per turn, and stance is recorded where it matters, at the consensus vote (`accept`/`reserve` + reason). (c) The 3-5 / cap-12 budget numbers are the upstream engine defaults (ADR-0204 Q2); the `--rounds N` mapping preserves the caller-facing flag (§6). (d) The `request_floor` escape (step 2) is from upstream §16.2 and keeps a shut-out domain from becoming silent pseudo-consent.

### 4.4 Output Format — full replacement (current L58-69)

```markdown
## Output Format

Meeting minutes written to `memory/meeting-YYYY-MM-DD-[slug].md`, in order:
- Overview: date, facilitator, participant roster, and per-issue participants, with
  non-participants marked "not participating in this issue"; when the meeting was
  resumed after an interruption, the overview states the number of sittings
- Per issue: the outcome label (`agreed` / `narrowed` / `unresolved`), the consensus
  statement labelled a PROPOSAL for the user's approval — never a decision or PASS
  stamp (Governance Rule 2) — and the KEY EXCHANGES quoted verbatim as
  `display name: utterance`, never summarized into agreement
- Preserved dissent: recorded disagreements transcribed VERBATIM — never summarized,
  never averaged into consensus (Governance Rule 3)
- Open questions carried forward
- Action items with owner assignments
- Appendix A — full turn transcript: every turn in order as `display name: move —
  utterance`, including floor requests, the consensus proposal, and the votes
- Appendix B — interrupted attempts (only when the meeting was resumed): the turns
  of the interrupted sitting(s), kept verbatim and excluded from the body's
  consensus citations
```

Design notes: the body is deliberately short — per issue, outcome + PROPOSAL + a handful of verbatim exchanges (R6); the full record moves to Appendix A so the body stays readable without losing any utterance; Appendix B exists only for resumed meetings (upstream resume-marking, ADR-0204 Phase 2 decisions). The PROPOSAL-labelled recommendation per issue and the verbatim-dissent section carry over from v1.5.0 (they were the prior design's Governance-Rule enforcement through the format) with back-references kept.

### 4.5 Governance Rules — unchanged (R7)

Current L71-76 stays byte-identical (diff-verifiable): dissent seat; PROPOSAL, never decision; dissent preserved verbatim. Every new mechanic in §4.3-§4.4 references these rules rather than re-editing them.

### 4.6 Length check

Frontmatter 21 + Context 6 + When to Use 7 + Execution Steps ~42 + Output Format ~18 + Governance Rules 7 + Related Skills 4 + headings/blanks ≈ **110-120 lines** (from 81) — target band 100-130.

## 5. Trade-offs considered

| Option | Pro | Con | Decision |
|---|---|---|---|
| A. Keep invocation surface; map `--rounds N` to a per-issue turn budget in the skill text | Zero change to the ~24 instruction-file one-liners (root ×4 + per-variant templates) and project-review L153; interface stable per the dispatch mandate | "Rounds" is vestigial vocabulary for a turn mechanic | **A** |
| B. Rename the flag to `--turns N` and sweep all instruction surfaces | Honest vocabulary | Root ×4 instruction files + every variant template's AGENTS.md/CODEX.md + project-review ×12 mirrors + Projects copies — large blast radius, contradicts "mechanics redesign, not interface change" | — |
| No runtime round-mode fallback in the skill (rollback = version revert) | Single-format prose stays simple | Unlike upstream's code engine, no in-place opt-out | **Chosen** — prose has no runtime state; git revert restores v1.5.0 exactly (see §9) |

## 6. Interface stability

Invocation (skill name + topic + `--agents` + `--dialogue`) is unchanged. The `--rounds N` flag keeps a defined meaning under the new mechanics: a per-issue turn budget of N turns per participant (§4.3 step 3), so every existing pointer (root `AGENTS.md` L236 / `CLAUDE.md` L241 / `GEMINI.md` L253 / `CODEX.md` L113, variant template one-liners, project-review L153 `--rounds 2`) remains accurate without edits. `--dialogue` becomes the default (harmless redundancy). A cosmetic `--rounds` → `--turns` rename, if the owner ever wants it, is a COMMON-AGENTS propagation wave of its own — explicitly out of scope here.

## 7. Delivery surface

- **Hand edit**: `skills/meeting-facilitation/SKILL.md` (SSOT) only.
- **L0 platform mirrors** (`.claude/`, `.gemini/`, `.agents/`, `.codex/`, `.hermes/`): regenerated by `scripts/sync-skills.ts` Phase 1 (SSOT → five platform dirs; atomic copy; idempotent).
- **L1 template** (`templates/common/skills/` + the five in-template platform mirrors): regenerated by the dev-sync publish (step 4.5) / cascade re-publish (step 4.62) — no hand edits.
- **Registries at implementation**: `docs/VERSION_MANIFEST.md` row (1.5.0 → 1.6.0, last-reviewed date), `docs/templates/common-contract.json` two version fields (`common_skills.meeting-facilitation.version`, `skills.meeting-facilitation.version`), `docs/lifecycle/skills/meeting-facilitation.md` (L0 hand-maintained record — add the 1.6.0 phase-history and changelog rows), `docs/skill-graph.json` (regenerated, dev-sync step 4.65), `scripts/skill-lifecycle-audit` / `sync-skill-registries.ts` (step 4.63) keep everything converged; generated lifecycle projections (step 4.505) refresh delivered-skill records.
- **18 project copies**: updated through the normal `upgrade-project` wave — out of this PR's diff. U-20261121-001 closes when the L1 redesign is delivered.
- **co-safety fork**: untouched (declared variant-maintained; its internal parity pin is unaffected).

## 8. Back-compatibility

- **No transcript parser exists.** `memory/meeting-*.md` files are human-read. `tests/unit/memory-union-verify.test.ts` only exempts the path pattern; `resync-audit` retention prunes by filename pattern; `skill-session-review.ts` parses session-log skill-usage blocks, not meeting transcripts. A repo-wide grep found zero consumers of round structure. Old-format minutes remain readable as history.
- **No backfill / no conversion**: old round-based transcripts are not retro-converted into turn dialogue — that would fabricate exchanges that never happened (the same no-fabrication rule the upstream adopted for minutes v1 → v2, design §14.3).
- **Structural pins stay green**: `meeting-command-retirement.test.ts` (co-safety internal hash parity; `meeting.md` stub scan) and `meeting-participation-boilerplate.test.ts` (the "In a `meeting-facilitation` session" sentence in agent files) reference the skill by **name** only — the name is unchanged. `validate-skills.ts` frontmatter/section requirements are retained.
- **Governance text**: `AGENTS.md` §3.7 and the retirement records contain no round mechanics.

## 9. Test / verification plan

The skill is agent-executed prose; the established verification method for skill redesigns (2026-11-09 precedent, acceptance criteria + a live dry-run) applies, plus the standard sync battery:

1. **Content criteria (grep/diff-verifiable at implementation)**:
   - Execution Steps contain: 3-5 per-issue participant selection with the one-line reason; the dissent-seat-always-included sentence; the "silence is never counted as agreement" rule; the seven turn moves with display-name addressing; the one-amend-per-issue limit; the chair-proposed consensus with participant-only vote; the exact progress line format `issue i/n · speaker <display name> · turns used t/<budget>`.
   - Output Format contains: overview with per-issue participants and sittings count, verbatim key exchanges, PROPOSAL labelling with the Rule-2 back-reference, verbatim dissent with the Rule-3 back-reference, Appendix A (full turn transcript), Appendix B (interrupted attempts).
   - The retired text is gone: no "round count is a meeting parameter", no "Opening round (round 1)", no per-round "every participating agent MUST".
   - Governance Rules byte-identical to v1.5.0 (git diff).
   - File length 100-130 lines; frontmatter `version: 1.6.0`, `last_reviewed: 2026-11-21`.
2. **Parity battery**: all 12 workspace copies byte-identical after the sync machinery (hash equality — the established mirror md5-parity check); `bun scripts/validate-skills.ts` green; `audit.ts` green; `sync-skill-registries.ts` convergence green; spec-check passes with this design registered.
3. **Live dry-run (PM spot-check at implementation, per the skill's own invocation)**: one low-stakes meeting — verify per-issue participant selection is stated with reasons, turns alternate with display names, progress lines appear at speaker changes, per-issue consensus is proposed by the chair and voted by participants only, and the minutes show the short body + Appendix A. Appendix B is text-verified (staging a real interruption is not worth a forced failure; the upstream resume behavior is already production-verified).
4. **Behavioral risk is bounded by upstream evidence**: the mechanics were live-verified in co-newbiz production (default switched to turns 2026-11-21, ADR-0204 "Default switched"); this design ports verified behavior into doctrine, it does not invent it.

## 10. Platform Impact (mandatory)

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | Mirror regeneration of `.claude/skills/meeting-facilitation/SKILL.md` via sync-skills.ts Phase 1; no settings/command change | mirror copy only |
| Antigravity (GEMINI.md) | Mirror regeneration of `.gemini/skills/meeting-facilitation/SKILL.md` via sync-skills.ts Phase 1; no other `.gemini/` change | mirror copy only |
| templates/common | **Propagation required**: canonical `templates/common/skills/meeting-facilitation/SKILL.md` + five in-template platform mirrors regenerate byte-identically via dev-sync publish/cascade; the 18 project copies update via the upgrade wave, not this PR | 6 files |

(Codex and Hermes platform mirrors are covered by the same sync-skills.ts Phase 1 as part of the L0 mirror set.)

## 11. Rollback

Single-file revert of the SSOT restores v1.5.0; mirrors and templates/common regenerate through the same machinery on the next sync run. No script, registry schema, or pipeline behavior changes — the skill is prose consumed at facilitation time. Project copies at v1.6.0 continue to work alongside a v1.5.0 root (both describe valid facilitation flows; no cross-version contract exists between copies, verified in the 2026-11-09 design §7). Old minutes stay valid history under either version.

## 12. Risks

| Risk | Mitigation |
|---|---|
| Cost/latency: turn-based dialogue costs more exchanges than one monologue per agent per round (upstream estimate 1.5-3× tokens; their live run: 8m06s for a full committee) | Per-issue budget (3 per participant, cap 12) bounds every issue; early consensus stop rule; the 3-5 participant cap cuts seats per issue |
| Staged theatre / seats agree too fast (the upstream failure mode: 11/11 accept) | Dissent seat always seated (Rule 1); ask/rebut priority in speaker order; `unresolved` is a legal outcome; reservations and dissent verbatim (Rule 3) |
| Facilitator (PM) load grows — chair duties (selection, order, consensus proposal, progress lines) are now inline | Budget caps bound meeting length; the flow replaces the old round-dispatch overhead rather than adding to it |
| Agenda-at-open loses the round-1 positions that v1.5.0 used to distill issues | Mid-meeting issue append rule; issues are named from topic + objectives; open question 4 |
| Vestigial `--rounds` vocabulary confuses callers | §6 defines the mapping in the skill text itself; cosmetic rename deferred |

## 13. Open questions (defaults stated; upstream spec wins at gate review, per the 2026-11-09 precedent)

1. **`--rounds N` mapping** — default: keep the flag with the turn-budget meaning (trade-off A). A rename wave is possible later.
2. **Per-turn stance line dropped** — default: drop (votes record stance via `accept`/`reserve` + reason). If the owner wants per-turn stance tracking, restore the v1.5.0 line as a clause of every `propose`/`amend` turn.
3. **`request_floor` escape** — default: keep (upstream §16.2; prevents silent pseudo-consent). It is an addition beyond the ticket's seven bullets — PM may strike it at gate review.
4. **Issue-count bound 2-5 carried over from v1.5.0** — default: keep; 6+ issues split the meeting.

## 14. PR sequence

**ONE PR**: SSOT `skills/meeting-facilitation/SKILL.md` rewrite (§4) + regenerated mirrors (5 L0 platform dirs, 5 in-template platform dirs + `templates/common/skills/` canonical) + registry/lifecycle surfaces (VERSION_MANIFEST row, common-contract.json ×2, L0 lifecycle record changelog, `docs/skill-graph.json` regenerated) + this design doc + spec-registry entry. No AGENTS.md / platform instruction-file edits (interface preserved, §6). No Projects changes.

## 15. References

- U-20261121-001 (`tickets/governance/U-20261121-001.yaml`) — requirements and triage
- `Projects/co-newbiz/docs/adr/0204-committee-turn-based-meeting.md` — owner decisions 2026-11-20/21, live measurement §16.1, per-issue participants §16.2, display names §16.3, amendment limit §16.4, resume marking, default switch
- `Projects/co-newbiz/docs/designs/2026-11-20-committee-turn-based-meeting-design.md` — engine design §4 (flow, speaker selection, budgets, minutes v2), §14 (scope), §15-16 (addenda)
- `skills/meeting-facilitation/SKILL.md` v1.5.0 (81 lines; line cites in §3 verified 2026-11-21 at origin/main ff8cf84b)
- `docs/designs/2026-11-09-meeting-facilitation-committee-alignment-design.md` (v1.5.0 round-based design; verification precedent)
- `scripts/sync-skills.ts` (SSOT → 5 platform dirs), `scripts/dev-sync.ts` (steps 4.5 / 4.62 / 4.63 / 4.65 / 4.505), `scripts/validate-skills.ts`
- `tests/unit/meeting-command-retirement.test.ts`, `tests/unit/meeting-participation-boilerplate.test.ts` (structural pins, verified unaffected)
- `docs/VERSION_MANIFEST.md` L68 (v1.5.0 row), `docs/templates/common-contract.json` (two meeting-facilitation version fields), `docs/lifecycle/skills/meeting-facilitation.md`
