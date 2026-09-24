# Design: Variant-Template Content Hygiene Batch (PR A — T-005 / T-007 / T-001)

- **Spec ID**: 2026-09-25-variant-hygiene-batch
- **Date**: 2026-09-25
- **Status**: Implemented (automation-engineer, 2026-09-25; per-variant zone diff-gate evidence, trio 4-way parity/byte proofs, and the full battery capture in the implementation PR; WARN->FAIL soak for checkVariantAgentReferences = ticket T-20260925-004, not_before 2026-10-09)
- **Source**: architect (PM-dispatched; PR A of the backlog-processing program)
- **Tickets**: T-20260924-005, T-20260924-007, T-20260925-001
- **Baseline**: main @ 522fb094, clean tree

## 1. Background (verified 2026-09-25 against current code)

All three tickets describe real, currently reproducible drift. Line numbers from the
2026-09-24 audit were re-verified; several shifted.

### 1.1 T-20260924-005 — variant-context zone drift

`bun scripts/propagate-to-templates.ts --marker-rewrite --dry-run` reports
**Would overwrite: 26, In sync: 18** — 13 variants x 2 COMMON-CONTEXT zones each, all in
`templates/<v>/docs/<v>.context.md`. Source zones live in
`templates/common/docs/context.md` at lines 49-65 (ADR-0079 STE + ADR-0080 PM Authority)
and 317-325 (coding standards). Per-variant zone diff (script-extracted, all 13 variants):

| Variant | Zone #1 (lines) | Zone #2 (lines) | Non-source lines |
|---------|-----------------|-----------------|------------------|
| co-abap | 509-517 | 522-538 | 1 |
| co-consult | 258-266 | 276-292 | 1 |
| co-deck | 678-686 | 696-712 | 1 |
| co-design | 152-160 | 162-178 | 1 |
| co-develop | 187-195 | 197-213 | 1 |
| co-export | 197-205 | 212-228 | 1 |
| co-game | 206-214 | 227-243 | 1 |
| co-hr | 126-134 | 200-216 | 1 |
| co-news | 111-119 | 223-239 | 1 |
| co-price | 183-191 | 195-211 | 1 |
| co-safety | 260-268 | 272-288 | 1 |
| co-security | 230-238 | 240-256 | 1 |
| co-work | 175-183 | 185-201 | 1 |

The drift shape is identical in all 13 variants:

1. **Zone order is swapped** relative to the source. Each variant carries the
   coding-standards zone first and the STE/ADR-0080 zone second; the source has
   STE/ADR-0080 (line 49) before coding standards (line 317).
2. **One stale line** in the coding-standards zone: every variant says
   `This project follows the workspace coding standards defined in the project's Coding Guidelines section.`
   where the source says `This project follows the coding standards in the key-rules list below.`
   All key-rule bullets match the source exactly.
3. The STE/ADR-0080 zone is an **exact source copy** in all 13 variants.

**Triage verdict (per-variant, uniform)**: zero variant-unique content would be lost.
The 13 "unique" lines are one stale sentence, identical across all variants — a stale
copy, not variant-specific content. Safe to remediate with `--marker-rewrite --apply`.
No overlay declarations are needed.

Runtime audit baseline (2026-09-25 run): `Stale promoted content check: 26 variant
section(s) duplicate content already promoted to docs/context.md` — 26 WARNs
(13 variants x 2 sections, `checkStalePromotedContent()` at scripts/audit.ts:2050-2097),
mapping 1:1 onto the 26 drifted zones. The STE rows read 100% overlap today; the PM
Authority rows read 86-100%.

### 1.2 T-20260924-007 — stack-setup phantom

- Root `agents/` (9 files) has no stack-setup; `templates/common/agents/` has 3 files
  (`_COMMON.md`, `i18n-specialist.md`, `pm.md`) — none. Root + L1 AGENTS.md were already
  fixed (R16 pattern; root AGENTS.md:622 now reads "request installation through the
  PM — never install tools without security review and explicit user approval").
- **10 variant AGENTS.md copies** still carry the pre-R16 bullet — exactly one hit each,
  in the Computational Integrity bullet, located AFTER the (in-sync) COMMON-AGENTS zone,
  i.e. in variant-unique tail content that never self-heals:
  co-abap:404, co-consult:620, co-deck:740, co-design:576, co-export:643, co-hr:671,
  co-news:601, co-safety:1068, co-security:546, co-work:560.
- **co-develop / co-game** ship real `agents/stack-setup.md` (plus roster rows in their
  AGENTS.md and lifecycle copies) — references there resolve at L2. Leave untouched.
- **Sharpest instance**: `templates/co-abap/scripts/co-abap/setup.ts` line 20 (header
  comment: `Unknown (none of the above) → stack-setup agent invocation required`) and
  lines 373-385 (user-facing UNKNOWN-STACK guidance: "invoke the stack-setup agent",
  `Agent: agents/stack-setup.md`, plus a 4-step agent procedure and a
  "Do NOT run any install commands without agent security review" warning).
  co-abap ships 24 agent files, none named stack-setup — user-facing broken guidance.
- No standing detector exists for unresolvable agent references. The landed T-20260924-004
  check (`classifyVariantMirrorCopy`, validate-templates.ts:2082-2102) covers a different
  universe: skill platform-mirror DIRECTORIES and version comparison, not agent-name
  references in prose/scripts.
- Observed but out of scope (L0/L1, non-deliverable or fallback-only):
  `templates/common/scripts/generate-ide-rules.ts:149,256` (stack-setup appears only in
  the fallback default roster used when no roster is discoverable),
  `templates/common/scripts/helpers/merge-frontmatter.ts:860` (display-name map),
  `skills/zod-contract-gate/SKILL.md:57` + `templates/common{,/.claude,/.gemini,/.agents,/.codex}/skills/zod-contract-gate/SKILL.md:57`
  (example zod enum using the co-develop roster), and `templates/README.md:40` /
  `templates/README_ko.md:40` (co-develop roster description — legal, co-develop ships
  the agent).

### 1.3 T-20260925-001 — trio versions, stale copies, WS-05a ruling

- The "L0-common trio" is `finishing-a-development-branch` (canonical v1.0.1),
  `platform-command-lifecycle-manager` (v1.0.2), `platform-skill-lifecycle-manager`
  (v1.0.2) — canonical in `skills/` (SSOT), all four root platform mirrors, and
  `templates/common/skills/` + its four mirrors.
- **8 variants** carry trio copies in their platform mirrors: co-consult, co-deck,
  co-design, co-develop, co-game, co-hr, co-security, co-work. In each:
  - `.claude` + `.gemini` copies: **stale v1.0.0** (24 finding-pairs = the ticket's
    "24 mismatches"; 48 physical files), but already WS-05a-remediated (0 hits on
    `validate-templates` — the D7 hand-heal adapted content in all four platforms and
    version-bumped only `.agents`/`.codex`).
  - `.agents` + `.codex` copies: **canonical version + adapted content** — already at
    the target state (verified by diff: only the line-59 swap differs from canonical).
- **5 variants** (co-abap, co-export, co-news, co-price, co-safety) have all four
  platform dirs but carry no trio copies at all. Nothing to refresh there; delivering
  the trio to them is an upgrade-project/copyL0CommonSkills concern, not this PR.
- No standing detector flags the version mismatches: `classifyVariantMirrorCopy`
  returns `ok` for peer-shared copies (peerCount = 7 > 0), by design.
- **WS-05a scope (verified)**: `checkL0OnlyToolRefsInVariantCommandSkills`
  (validate-templates.ts:3931-3979) scans ONLY
  `templates/<variant>/{.claude,.gemini,.agents}/{commands,skills}` + `<variant>/skills`.
  The workspace root (`skills/`, root platform mirrors) and `templates/common/` are
  outside its scan roots.
- **Regrowth vector (verified)**: `copyL0CommonSkills` (scripts/helpers/generate-variant.ts:1256)
  seeds the trio into all four variant mirrors from `templates/common/.<platform>/skills/`,
  whose `platform-command-lifecycle-manager` copies carry the raw
  `bun scripts/validate-templates.ts` line (1 hit each). Every future variant promotion
  therefore re-delivers unadapted copies and re-trips WS-05a until hand-remediated (the
  exact D7 deviation this ticket wants to retire).

## 2. Goals

1. Heal the 26 variant-context zones with verified zero content loss (T-005).
2. Eliminate every unresolvable `stack-setup` reference in variant AGENTS.md copies and
   variant scripts; keep co-develop/co-game real agents intact (T-007 a/b).
3. Add a regrowth-prevention detector for unresolvable agent references, WARN-soaked
   with a dated promotion ticket (T-007 c).
4. Refresh the 48 stale trio mirror copies to canonical version + WS-05a-adapted
   content, preserving the `.agents`/`.codex` state (T-001 i).
5. Rule on the WS-05a L0-source question and make the adapted-copy pattern structural
   at the delivery seam so future promotions stop re-tripping WS-05a (T-001 ii).
6. Align the audit's context-overlap checks with the marker-propagation contract so
   sanctioned marker zones stop producing stale-promoted false WARNs (T-005 follow-on).

## 3. Non-Goals

- T-20260924-004 (landed via #1060; this design only documents distinctness from its check).
- T-20260925-002 WARN-soak promotion.
- `Projects/**` real content — delivered projects keep the phantom bullet until
  upgrade-project replays the fixed templates (known residual, accepted).
- Delivering the trio to the 5 variants that never received it.
- L0 SSOT or `templates/common` content changes for the trio (ruled legal, §5.2).
- The L0/L1 stack-setup residuals listed in §1.2 (fallback roster, display map,
  zod-contract-gate example enum) — none are actionable variant deliverables; tracked
  as follow-up candidates.
- The common-contract project-delivery seam (§5.2 note) — separate follow-up ticket.
- Extending `classifyVariantMirrorCopy` to WARN on peer-shared version-stale copies
  (considered, deferred — §5.4).
- T-010/T-011/T-006/T-001-class other backlog tickets (separate PRs).

## 4. Requirements (ASD-STE100)

### R1 — T-005 zone heal

- Run the triage gate per variant before apply. Record the verdict table in the PR.
  Require zero variant-unique lines inside every would-overwrite zone. Halt on any
  variant-unique line; preserve it outside the zone or file a new ticket.
- Apply `bun scripts/propagate-to-templates.ts --marker-rewrite --domain variant-context --apply`.
- Re-run `--dry-run`. Require `Would overwrite: 0` for the variant-context domain.
- Accept the zone-order swap: after apply, the STE/ADR-0080 zone precedes the
  coding-standards zone in each variant context.md, matching source order.

### R2 — T-005 audit alignment

- Exempt COMMON-CONTEXT marker-zone content from `checkStalePromotedContent()` and
  `checkVariantContextCommonization()` in scripts/audit.ts. Extract the zone-stripping
  into a pure exported helper. Keep both checks WARN-only.
- Preserve detection of non-zone duplicates. A duplicate section outside a marker zone
  must still warn (regression fixture).

### R3 — T-007 content fixes

- Replace the Computational Integrity bullet line in the 10 variant AGENTS.md copies
  with the R16 pattern (§5.3). Change one line per file.
- Rewrite co-abap setup.ts line 20 comment and the lines 373-385 guidance block.
  Remove every `stack-setup` mention. Route tool installation through the PM with the
  security-review clause (§5.3).

### R4 — T-007 detector

- Add `checkVariantAgentReferences()` to scripts/validate-templates.ts. Scan
  `templates/<v>/AGENTS.md` and `templates/<v>/scripts/**/*.ts` per variant.
- Extract agent-reference candidates from `agents/<name>.md` path references and
  backtick-adjacent `<name>` agent mentions. Resolve each candidate against, in order:
  `templates/<v>/agents/`, `templates/common/agents/`, root `agents/`.
- WARN on unresolved candidates (ADR-0055 soak). Support an explicit exemption list.
- Extract the decision into a pure exported classifier; unit-test it (T-004 convention).
- File a dated promotion ticket (WARN -> FAIL after a green soak) at implementation,
  via `bun scripts/ticket.ts create`.

### R5 — T-001 trio heal

- For each of the 8 variants carrying the trio, refresh `.claude` and `.gemini` copies
  of all three skills to canonical content from `templates/common/skills/<name>/`.
- Apply the WS-05a one-line adaptation (§5.2) to all four platform copies of
  `platform-command-lifecycle-manager` in those variants. Re-apply — never regress —
  the existing adaptation in `.agents`/`.codex` copies.
- Verify 4-way parity after heal: per variant x skill, all four copies share the
  canonical version and the canonical-except-adapted content.

### R6 — T-001 delivery seam

- Teach `copyL0CommonSkills` to apply the WS-05a one-line adaptation to delivered
  SKILL.md content when the source line is present. Keep byte-preserving behavior for
  content without the line. Keep the export for its regression test.

## 5. Design Decisions and Trade-offs

### 5.1 T-005: heal, then align the audit (both in this PR)

The heal alone does NOT clear the audit: `checkStalePromotedContent()` has no
marker-zone exemption, so post-heal the 26 WARNs persist (six 86% rows rise to 100%).
The check's charter (audit.ts:2044-2049) is leftover-duplicate detection after a
promotion cleanup — marker zones are the sanctioned ADR-0062 delivery channel, not
leftovers, and zone drift already belongs to dev-sync Step 4.55. Exempting marker-zone
content aligns the check with its charter.

- Alternative A (heal only): minimal diff, but the PR ends with 26 standing WARNs that
  directly contradict the ticket's hygiene intent, and "post-apply audits green" (the
  triage requirement) is unmeasurable. Rejected.
- Alternative B (heal + exemption): one small, testable helper + two call sites.
  Chosen.

Answer to the ticket's enforcement question: **dev-sync Step 4.55 already gates
regrowth** — `variant-context` is in its hardcoded WARN-stage domain list
(scripts/dev-sync.ts:720) and prints the would-overwrite count on every L0 sync. No new
mechanism. Promoting that WARN to FAIL is T-20260925-002-class soak territory.

### 5.2 T-001 WS-05a ruling: L0 naming is LEGAL

`checkL0OnlyToolRefsInVariantCommandSkills` scans only `templates/<variant>/...` trees.
The concern it enforces is: variant-delivered files must not give actionable commands
for tooling that does not exist inside a project. At L0 (root `skills/`, root platform
mirrors) and L1 (`templates/common/skills/`), `scripts/validate-templates.ts` exists and
the reference resolves. Therefore:

- The root SSOT `skills/platform-command-lifecycle-manager/SKILL.md:59`, all four root
  mirrors, and `templates/common/skills/` + its four mirrors **stay unchanged**.
- The Step-2 heal's adapted-copy pattern is the **permanent** delivery contract for
  variant mirrors. T-001's "L0 cleanup" scope reduces to the version-mismatch heal
  (R5) + the stale-copy refresh, exactly as the ticket's scope-confirmation anticipated.
- The D7 one-line adaptation is canonical and specified here (line 59 replacement):

  ```
  - bun scripts/validate-templates.ts
  + # Workspace-only template validator: run it from the workspace root (L0-only
  + # tooling — not shipped inside projects), never inside a variant/project.
  ```

- To stop the per-promotion hand-remediation treadmill, the adaptation moves into the
  delivery seam itself (`copyL0CommonSkills`, R6). Alternative: leave the seam byte-
  identical and hand-remediate every future promotion — rejected; it re-creates the D7
  deviation class this ticket exists to retire, and WS-05a would FAIL each new variant
  until someone notices.

> **Flagged follow-up (out of scope)**: the common-contract project-delivery path also
> ships `templates/common` skill copies (which still name the L0 script) into scaffolded
> projects, where the script does not exist. Same phantom-guidance class, different seam.
> Recommend a follow-up ticket to apply the same adaptation at that seam.

### 5.3 T-007 exact replacement contracts

(a) **10 variant AGENTS.md** — one line each (line numbers in §1.2). Replace:

```
... Julia, etc.) via the `stack-setup` agent. Label any AI-generated numerical estimate ...
```

with the R16 pattern (root AGENTS.md:622):

```
... Julia, etc.). If the tool is missing, request installation through the PM — **never install tools without security review and explicit user approval**. Label any AI-generated numerical estimate ...
```

(b) **co-abap setup.ts** — line 20 comment becomes
`//   Unknown    (none of the above)   → manual setup via PM-approved tool installation`.
Lines 373-385 block becomes direct tool-installation guidance with no agent name:
identify the stack's canonical installer, request installation through the PM, security
review before any install command, execute only after explicit approval. Preserve the
existing YELLOW/RED console framing and section separators.

(c) **Detector placement**: validate-templates.ts, as a new top-level check function.
Rationale: (1) the ticket names it the sibling of T-20260924-004, whose check lives
there; (2) validate-templates.ts is L0-only governance — audit.ts and dev-sync.ts must
stay identical across all templates and variants (workspace Pluggable Variant Audit Hook
policy), and inside a scaffolded project the resolution universe (root `agents/`,
`templates/`) does not exist, so an audit.ts placement would ship a meaningless check;
(3) lifecycle-sync-audit.ts governs lifecycle records, not template content.
**Distinctness from T-004 in code**: T-004 = `checkVariantMirrorParity` +
`classifyVariantMirrorCopy` (skill mirror directories, version-vs-common comparison);
T-007(c) = `checkVariantAgentReferences` (agent-name references in AGENTS.md prose and
variant scripts, existence resolution). Different functions, different inputs, no shared
logic beyond the existing variant iteration loop.

Severity: WARN per ADR-0055 soak, with a dated promotion ticket filed at
implementation (house convention from the verifier-platform-expansion Step 3).

### 5.4 Considered and deferred: peer-shared version-stale WARN

Extending `classifyVariantMirrorCopy` to WARN when a peer-shared common-skill mirror is
older than common would catch future trio staleness after common version bumps. Deferred:
the stale-orphan design explicitly sanctions the peer-shared uniform baseline; the change
deserves its own design + soak cycle. The healed state (R5/R6) is stable because
promotions now seed adapted, canonical copies.

## 6. Platform Impact (MANDATORY)

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | Variant `.claude` mirrors refreshed (trio heal); root `.claude` untouched | `templates/{8 variants}/.claude/skills/<trio>/SKILL.md` |
| Antigravity (GEMINI.md) | Variant `.gemini` mirrors refreshed (trio heal); `.agents` mirrors verify-only (already canonical+adapted); root mirrors untouched | `templates/{8 variants}/.gemini/skills/<trio>/SKILL.md`; `templates/{8 variants}/.agents/...` verified |
| Codex | Variant `.codex` mirrors verify-only (already canonical+adapted) | `templates/{8 variants}/.codex/...` verified |
| templates/common | None — trio sources are canonical and stay (§5.2 ruling); variant templates healed under `templates/co-*/` only | None in `templates/common/` (verified assertion in the battery) |

Justification for no `templates/common` writes: the WS-05a ruling (§5.2) makes the L0/L1
copies legal as-is; healing direction is templates/common -> variants, never the reverse.

## 7. Acceptance Criteria

- [ ] AC-1 (T-005): `--marker-rewrite --domain variant-context --dry-run` reports `Would overwrite: 0` after apply.
- [ ] AC-2 (T-005): per-variant no-loss diff table shows 0 variant-unique lines lost across all 13 variants (pre-apply evidence recorded in the PR).
- [ ] AC-3 (T-005): audit.ts `Stale promoted content check` reports 0 flagged sections post-heal+exemption; the non-zone duplicate fixture still warns.
- [ ] AC-4 (T-007): `grep -rn "stack-setup" templates/` returns zero hits outside the legal set: co-develop/**, co-game/** (real agents + their docs), templates/README.md:40, templates/README_ko.md:40 (co-develop roster row), templates/common/scripts/generate-ide-rules.ts (fallback default), templates/common/scripts/helpers/merge-frontmatter.ts (display map), skills/zod-contract-gate + templates/common{,/.claude,/.gemini,/.agents,/.codex}/skills/zod-contract-gate SKILL.md:57 (example enum).
- [ ] AC-5 (T-007): `bun scripts/validate-templates.ts` runs the new agent-reference check with 0 WARNs at PR end; positive fixture produces a WARN naming file:line.
- [ ] AC-6 (T-001): all 48 `.claude`/`.gemini` trio copies refreshed; per variant x skill, all four platform copies share the canonical version (1.0.1 / 1.0.2 / 1.0.2); `platform-command-lifecycle-manager` copies carry 0 `validate-templates` hits in all 8 variants.
- [ ] AC-7 (T-001): `.agents`/`.codex` trio copies are byte-identical before and after the heal (they already hold the target state).
- [ ] AC-8 (T-001): copyL0CommonSkills unit test proves adaptation on seeded content containing the forbidden line, byte-preservation otherwise.
- [ ] AC-9: `bun test` green; `bun scripts/audit.ts` shows no new FAILs vs the 2026-09-25 baseline; `bun scripts/validate-templates.ts` shows no new FAILs.
- [ ] AC-10: dated WARN->FAIL promotion ticket for checkVariantAgentReferences exists (filed at implementation).
- [ ] AC-11: cascade table (§9) applied: validate-templates 1.42.0, audit 2.44.0, generate-variant 1.19.0, VERSION_MANIFEST rows updated.

## 8. Verification Plan

Per-ticket before/after evidence, all captured in the PR:

1. **T-005**: before = the §1.1 dry-run + triage table (this doc); after =
   `--marker-rewrite --domain variant-context --dry-run` (`Would overwrite: 0`),
   `git diff --stat` showing exactly the 13 context.md files, and the audit excerpt
   showing the stale-promoted check at 0 with the fixture still warning.
2. **T-007**: `grep -rn "stack-setup" templates/` before/after with the AC-4 exclusion
   set applied; validate-templates output showing the new check named, 0 WARNs on the
   fleet, and a WARN on the injected phantom fixture (removed before commit).
3. **T-001**: version sweep script output (8 variants x 3 skills x 4 platforms) before
   (24 stale pairs, 48 stale files) and after (all canonical); byte-diff proof that
   `.agents`/`.codex` copies are unchanged; WS-05a section of validate-templates green
   for all 8 variants.
4. **Full battery**: `bun test`; `bun scripts/audit.ts`; `bun scripts/validate-templates.ts`;
   dev-sync Step 4.55 segment (all three domains at 0 would-overwrite).

## 9. Cascade

| Artifact | Before | After | Trigger |
|----------|--------|-------|---------|
| scripts/validate-templates.ts | 1.41.0 | 1.42.0 | R4 checkVariantAgentReferences |
| scripts/audit.ts | 2.43.0 | 2.44.0 | R2 marker-zone exemption |
| scripts/helpers/generate-variant.ts | 1.18.0 | 1.19.0 | R6 delivery-seam adaptation (header bump; not VERSION_MANIFEST-tracked) |
| scripts/propagate-to-templates.ts | 2.17.0 | 2.17.0 | No change (existing --marker-rewrite suffices) |
| docs/VERSION_MANIFEST.md | — | 2 row updates | validate-templates, audit.ts |
| Tickets T-005 / T-007 / T-001 | backlog | done via ticket.ts at implementation | heal evidence attached |
| New promotion ticket | — | created | R4 WARN->FAIL soak, dated |

## 10. Accessibility (ADR-0065)

**EXEMPT.** This change modifies developer-facing template content and verification
scripts only. No user-facing web/app/CLI/document UI is affected.

## 11. Preview Verification (ADR-0070)

**EXEMPT.** No rendered UI exists. Evidence is CLI output capture per §8.

## 12. Implementation Brief (automation-engineer, ordered)

1. **T-005 heal** — record the §1.1 triage table in the PR; run
   `bun scripts/propagate-to-templates.ts --marker-rewrite --domain variant-context --apply`;
   verify AC-1, AC-2. Expected: 13 files changed.
2. **audit.ts exemption** (2.44.0) — extract `stripMarkerZones` (pure, exported; handles
   COMMON-CONTEXT START/END spans, tolerates unterminated zones by not stripping);
   apply in `checkStalePromotedContent` + `checkVariantContextCommonization`; add fixture
   test `tests/unit/marker-zone-exemption.test.ts` (positive: non-zone duplicate warns;
   negative: identical marker-zone content stays silent). Verify AC-3.
3. **T-007(a)** — one-line R16 replacement in the 10 AGENTS.md copies (§5.3a, §1.2 line
   numbers). Expected: 10 files, 1 line each.
4. **T-007(b)** — co-abap setup.ts rewrite (§5.3b). Expected: 1 file, lines 20 and
   373-385. Run `bun templates/co-abap/scripts/co-abap/setup.ts --help` (or a dry
   invocation) to prove the script still parses.
5. **T-007(c)** (validate-templates 1.42.0) — implement `classifyAgentReference` (pure,
   exported) + `checkVariantAgentReferences`; wire into the per-variant loop next to
   WS-05a; unit test `tests/unit/variant-agent-reference.test.ts` (decision table +
   injected-phantom fixture in a temp variant dir); file the dated promotion ticket.
   Verify AC-5, AC-10.
6. **T-001 heal** — refresh the 48 `.claude`/`.gemini` trio copies per R5 (adaptation
   re-applied to `platform-command-lifecycle-manager` in all four platforms of the 8
   variants); assert AC-6, AC-7 with the sweep script; leave `.agents`/`.codex`
   untouched (byte-identical proof).
7. **R6 seam fix** (generate-variant 1.19.0) — adaptation inside `copyL0CommonSkills`;
   extend `tests/unit/generate-variant-l0-common-mirrors.test.ts` (AC-8).
8. **Battery + cascade** — full §8 battery; VERSION_MANIFEST rows; hand back for
   docs-writer (CHANGELOG) and /sync.

Execution order note: steps 1-2 precede 3-5 so the detector lands on already-clean
content; step 6-7 are independent of 3-5 and may run in parallel by the same engineer
(serial writes).
