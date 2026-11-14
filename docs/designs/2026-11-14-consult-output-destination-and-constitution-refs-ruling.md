# Architect Ruling — Output Destination Standard and CONSTITUTION.md Reference Scrub

- **Spec ID**: 2026-11-14-consult-output-destination-and-constitution-refs-ruling
- **Date**: 2026-11-14
- **Author**: Template Architect (ruling only — implementation dispatches through the PM Gateway)
- **Adjudicates**: tickets/governance/U-20261113-008.yaml (L2, co-consult), U-20261113-009.yaml (L1, cross-variant), U-20261113-010.yaml (L1, scrub policy)
- **Status**: Ruled — awaiting PM dispatch (Design Gate registered with this doc)

## 1. Summary of Rulings

| Ticket | Layer | Ruling | One-line decision |
|--------|-------|--------|-------------------|
| U-20261113-008 | L2 | **APPROVED** (absorbed into 009's edit wave) | co-consult §7 must defer to the context-doc Output Destination Mapping; no mapping duplication into AGENTS.md |
| U-20261113-009 | L1 | **APPROVED WITH MODIFICATION** | Two-tier §7 routing sentence in common + all 15 variant AGENTS.md bodies; **reject** promoting the deliverables/ scaffold into common; co-deck `presentations/` registered as declared deviation |
| U-20261113-010 | L1 | **APPROVED WITH MODIFICATION** | Fix user-facing pointers **at source** (context-detection precedent) + reword terms-ko.json notes; extend the **leak scan**, not the auto-scrub, to .ts/.json |

## 2. Findings (architecture facts driving the rulings)

1. **The §7 File Organization bullet is variant-body content, not injected.** The COMMON-AGENTS:START/END zone covers only the injected roster block; every template carries its own §7 body (`templates/common/AGENTS.md:270`, `templates/co-consult/AGENTS.md:320`, … — 16 files total: common + 15 variants). There is no §7 propagation mechanism; §7 parity is only machine-checked by the `agents-md-destructive-file-ops-pin` WARN arm (validate-templates v1.71.0), which greps every template AGENTS.md §7 for a marker phrase. Any §7 change is therefore a 16-file hand-edited wave that needs its own pin to prevent silent rot.
2. **Output scaffolds are confirmed fragmented**: co-consult and co-work ship `deliverables/{drafts,presentations,references,reports,research}` (identical, plus per-dir READMEs scaffolded by new-project.ts §2.6a/2.6a-2); co-deck ships top-level `presentations/`; co-abap ships `deliverables/{index.md,templates}` (code templates, not client deliverables); the other 11 variants and common ship no output scaffold. co-work's context doc declares the same Output Destination Mapping shape as co-consult's; co-deck's `presentations/<project>/` layout is pipeline-load-bearing (lecture-profile.md, image-manifest.json, shared asset pool) — it is a system, not a folder convention.
3. **The scrub's comment-vs-literal design is correct and must not be weakened.** `scripts/lib/constitution-scrub.ts` (v1.3.0) deliberately leaves code string literals and JSON untouched: blanket-scrubbing literals broke delivered root-detection (`existsSync(join(dir,"CONSTITUTION.md"))`) in 2026-08-15, and JSON field values are read by code (T-20260912-005). Two prior incidents (T-20261004-022) show how fragile comment-state classification already is.
4. **The structural gap in 010 is a scan-scope gap, not a scrub gap.** audit.ts's L0 Leakage check (line ~3329) scans **only `.md` files** under templates/ via `findL0LeakLines`; `.ts` and `.json` are out of scope. That is exactly why 19 delivered L1 scripts and the 7 skill reference JSONs (× 4 platform mirrors: .claude/.gemini/.agents/.codex) carry CONSTITUTION references that the .md-only scan never sees and the scrub never touches.
5. **A context-detection precedent already exists for user-facing pointers**: `gen-pr-body.ts:34` — `existsSync("CONSTITUTION.md") ? "CONSTITUTION.md §3" : "docs/context.md §3"`. One identical source, runtime-correct output at L0 and in delivered projects. Several other messages are already L0-only-guarded (fire only when `IS_WORKSPACE_ROOT`/`isL0Context` is true, e.g. dev-sync L0→L1 publish errors, validate-surface-registry "skip: no CONSTITUTION.md at this context") and are context-correct as-is.
6. **Delivery mechanics**: AGENTS.md is in upgrade's DOCS_MERGE_FILES, so template §7 edits reach projects at the next upgrade visit; core/standardized scripts (dev-sync.ts, audit.ts, validate-md-language.ts) are kept byte-identical root↔L1 by the Core Script Standardization rule and delivered canonical-wins at upgrade (L2 forks are forbidden — which is why the co-consult project correctly did **not** patch its delivered scripts); skill reference JSON mirrors regenerate from the `templates/common/skills/` SSOT via the skill-mirror sync (lifecycle-sync-audit Check C / propagate-to-templates).
7. **Registry precedent**: `country_scoped_assets` in docs/workspace-schema.json is a hand-maintained, registry-only SSOT read by scripts — the model if output-destination mappings ever need schema backing. The schema exists as a hand-maintained root/L1 pair (docs/workspace-schema.json ↔ templates/common/docs/workspace-schema.json).

## 3. Ruling U-20261113-008 (L2, co-consult) — APPROVED

The diagnosis is correct: agents bootstrap AGENTS.md first, so the inherited `docs/` sentence overrides the context doc's mapping, and deliverables land in `docs/reports/`. The failure is real and reproduced (four research reports + three market analyses relocated manually on 2026-11-13).

**Ruling**: the §7 File Organization bullet in `templates/co-consult/AGENTS.md` must route client-facing deliverables to the deliverables layout **by deferring to the context doc**, not by restating the mapping. The Output Destination Mapping in `docs/co-consult.context.md` remains the single source of truth for destinations and naming (including the `_ko` default); AGENTS.md carries a one-sentence pointer. Restating the table in AGENTS.md would create a second SSOT and guarantee drift.

The project-side LOCAL-PATCH workaround is accepted as interim and is **retired at the first post-fix upgrade visit** (AGENTS.md is merge-managed; the L2 template fix supersedes it — remove the LOCAL-PATCH marker lines in the same visit).

Edit shape (see §6.1, shape B).

## 4. Ruling U-20261113-009 (L1, cross-variant) — APPROVED WITH MODIFICATION

**Approved**: the two-tier routing standard. `docs/` routing for *all* deliverable-type outputs is wrong wherever a variant declares a deliverables layout; and variants without a scaffold genuinely have no declared destination. The fix is one conditional sentence in every template AGENTS.md §7:

> Client-facing deliverables (research findings, analyses, reports, presentations, references) follow the project's deliverables layout per the Output Destination Mapping in the project context doc, when the project ships one; otherwise place analysis and reports in `docs/`.

The conditional phrasing is deliberate: bare variants need no scaffold and no context-doc edit — `docs/` becomes their *explicitly declared* destination, closing the "no destination standard" gap at zero scaffold cost. Internal project analysis docs stay in `docs/`; session logs stay in `memory/`.

**Rejected — proposal 2 (promote the 5-subfolder deliverables/ scaffold into common)**. The scaffold is a *variant-domain* concern: co-develop/co-design/co-security/co-architect produce code, ADRs, tokens, and security artifacts, not client deliverables; forcing a client-deliverables tree onto every future scaffold of 11 variants changes delivered file trees for no observed failure, and contradicts the no-speculative-abstraction baseline. The two-tier sentence covers bare variants without it. Revisit only if a bare variant grows a real client-deliverable use case.

**co-deck `presentations/` — declared deviation, not migration**. `presentations/<project>/` is the co-deck pipeline's working root (lecture profiles, image manifests, theme assets); migrating to `deliverables/presentations/` would break the deck pipeline for cosmetic conformity. Ruling: co-deck's context doc gains a short "Output Destination Mapping" section declaring `presentations/<project>/` as its deck destination and the deviation from the deliverables/ convention. This also satisfies the §7 pin (finding 1) by giving the phrase a defined home.

**co-abap** — its `deliverables/` holds index.md + code templates; no client-deliverable semantics. Out of scope for reshaping; its context doc MAY declare the folder's purpose in a mapping section if desired. Not required by this ruling.

**Naming-convention standardization (proposal 4)** — deferred. co-consult's agent-keyed table and co-work's output-type table serve different operating models; the shared `{topic}-{report-type}-{YYYY-MM-DD}[_ko].md` skeleton is already consistent. No L1-wide naming mandate now.

**Phase 2 (optional, gated)**: if a third variant needs a distinct mapping, add an `output_destinations` domain to docs/workspace-schema.json following the `country_scoped_assets` precedent (hand-maintained root/L1 pair), and converge new-project.ts's duplicated §2.6a/2.6a-2 scaffold branches onto it. Not built now.

## 5. Ruling U-20261113-010 (L1, scrub policy) — APPROVED WITH MODIFICATION

**Approved**: the problem is real (80 files in the live co-consult project reference CONSTITUTION; ticket said 79 — same survey), the reported failure message is user-facing dead in project context, and the terms-ko.json citations propagate to 4 platform mirrors per skill.

**Modified — the extension is a scan extension plus source fixes, NOT a scrub-transform extension**:

1. **Do not teach the auto-scrub to rewrite string literals or JSON.** The scrub's non-target rules (finding 3) exist because the scrub cannot tell a root-detection literal from a message literal without breaking delivered code — it already broke root detection once, and its comment-state machine needed two repair releases. Auto-transforming `console.log("See: CONSTITUTION.md …")` strings has the same failure mode at larger blast radius. JSON stays a scrub non-target permanently (field values are read by code).
2. **Fix user-facing pointers at the L1 source, using the gen-pr-body.ts context-detection shape** (finding 5): identical code everywhere, `existsSync("CONSTITUTION.md")` picks the correct doc name per context; or plain policy wording with no L0 pointer where a section citation adds nothing. Per-message triage, not a blanket sweep — the triage table is in §6.3.
3. **Reword the terms-ko.json `_note` fields at the L1 SSOT** (`templates/common/skills/{k-opendata,k-kosis,k-krx,k-ecos,k-dart,k-law,company-intelligence}/references/terms-ko.json`): replace `(CONSTITUTION §6.7)` with policy wording ("workspace English-only doc policy, non-Markdown reference asset exemption") and regenerate the four platform mirrors via the skill-mirror sync. This is a deliberate hand edit of functional data at its SSOT — consistent with, not contrary to, the scrub's JSON non-target rule.
4. **Enforce by extending the leak scan to `.ts`/`.json`** (audit.ts L0 Leakage arm), closing the structural gap so L1 content cannot re-introduce references silently:
   - `.ts`: flag unannotated `CONSTITUTION.md` occurrences; exempt lines carrying a new line-scoped marker `// l0-functional:` (same occurrence-scoped mechanics as `intentional-duplicate`, added to `findL0LeakLines` in `scripts/helpers/l0-ref-policy.ts` — the policy SSOT, so scrub/scan/sanitizer stay in agreement).
   - `.json`: exempt by filename registry (`workspace-schema.json`, `propagation-map.json` — functional registries whose CONSTITUTION.md values are read by code); all other JSON occurrences flag.
   - Severity **WARN first**, promoted to FAIL after one full fleet sync cycle soaks without new findings (same WARN→FAIL posture as other recent arms).
5. **merge-frontmatter.ts is left as-is.** Its frontmatter/managed-block scope is correct for what it manages; enforcement for code/JSON belongs to the leak scan (item 4), which reports at L0 where fixes are cheapest.

## 6. Implementation Plan

### 6.1 Exact files and edit shapes

**Wave A — source fixes (010), no delivery dependency:**

| File | Edit |
|------|------|
| `scripts/validate-md-language.ts` + `templates/common/scripts/validate-md-language.ts` (identical pair) | Line ~620 message: context-detect like gen-pr-body.ts — `existsSync("CONSTITUTION.md") ? "See: CONSTITUTION.md — Language Policy Exception…" : "Policy: English-only documents; Korean exception requires 'lang: ko' + 'lang_reason' frontmatter (docs/context.md §6.7)"`. Keep lines 177/243/618 (functional scan-path lists) untouched. |
| `scripts/dev-sync.ts` + L1 copy | Lines ~647/2395/2661 language-gate messages: same context-detection shape (`CONSTITUTION.md §3` at L0, `docs/context.md §3` elsewhere). Lines behind `isL0Context` guards stay. |
| `scripts/agent-create.ts`, `scripts/agent-delete.ts` + L1 copies | Checklist lines "Update CONSTITUTION.md §5.2 …": context-detect (these fire only at L0 in practice, but the delivered copies exist, so make them safe rather than relying on reachability). |
| 7 skill `references/terms-ko.json` SSOTs under `templates/common/skills/` | `_note`: `(CONSTITUTION §6.7)` → `(workspace English-only doc policy, non-Markdown reference asset exemption)`; then regenerate `.claude/.gemini/.agents/.codex` mirrors (28 files) via the skill-mirror sync. |
| `scripts/helpers/l0-ref-policy.ts` | Add `L0_FUNCTIONAL_MARKER = "l0-functional:"`; extend `findL0LeakLines` to skip marker lines. |
| `scripts/audit.ts` (+ L1 copy) | L0 Leakage arm: iterate `.ts`/`.json` alongside `.md`; JSON filename exemption set; WARN severity initially. |
| 19 L1/root script files with functional literals | Annotate root-detection lines with trailing `// l0-functional: root detection` (~30 lines; verify-scripts.ts:154/175, lifecycle-sync-audit.ts:238, audit.ts:465/475/1175/2144/2737, dev-sync.ts:1335/1434, agent-verify.ts:20, validate-surface-registry.ts:302/370, validate-model-registry.ts:378, agent-lifecycle-audit.ts:102, readme-lifecycle-audit.ts:61, verify-adr-governance.ts:69, gen-pr-body.ts:34, validate-md-language.ts:177, agent-create/agent-delete existsSync guards, validate-templates.ts refs). |

**Wave B — §7 rewrite (008/009) + pin:**

| File | Edit |
|------|------|
| `templates/common/AGENTS.md:270` and all 15 `templates/co-*/AGENTS.md` §7 bullets | Shape B (variant bullet, preserve each file's existing root-file list verbatim; only the routing sentence changes): `…SECURITY.md). Client-facing deliverables (research findings, analyses, reports, presentations, references) follow the project's deliverables layout per the Output Destination Mapping in the project context doc, when the project ships one; otherwise place analysis and reports in `docs/`. Place internal project analysis docs in `docs/`, session logs and meeting transcripts in `memory/`. Create all temporary code and scratch scripts in `tests/`.` |
| `templates/co-deck/docs/co-deck.context.md` | New short "Output Destination Mapping" section declaring `presentations/<project>/` as the deck destination (documented deviation from deliverables/). |
| `scripts/validate-templates.ts` | New WARN arm `agents-md-output-destination-pin` (pattern: `agents-md-destructive-file-ops-pin`, v1.71.0): every template AGENTS.md §7 must contain the marker phrase `Output Destination Mapping`; missing §7 or missing phrase warns per file. |

### 6.2 Delivery mechanics

- **Scripts (core-locked)**: single edit applied to the root copy AND the `templates/common/scripts/` copy in the same commit (byte-identical invariant); delivered to projects canonical-wins at their next upgrade visit. L2 must never patch delivered copies — the co-consult project already correctly abstained.
- **AGENTS.md §7**: 16 template files hand-edited (no §7 propagation exists); projects receive the new bullet at next upgrade via the AGENTS.md merge path. In the same co-consult visit, remove the LOCAL-PATCH marker and patched bullet (008 retirement).
- **Skill JSONs**: edit the 7 SSOTs under `templates/common/skills/`, regenerate the platform mirrors from them; delivered at upgrade/scaffold from the L1 tree.
- **Schema pair (Phase 2 only)**: `docs/workspace-schema.json` (root) + `templates/common/docs/workspace-schema.json` (L1 mirror) are hand-maintained — never script-synced.
- **Dispatch**: Wave A/B script edits → automation-engineer (medium tier); §7/context-doc wording → docs-writer (medium tier). This ruling doc is the registered design (`spec-register.ts --file <this doc> --source manual --status implemented` before `/sync`).

### 6.3 What NOT to change

1. **Functional root-detection literals stay verbatim**: every `existsSync(join(...,"CONSTITUTION.md"))` / `isL0Context` / `IS_WORKSPACE_ROOT` guard — they are how scripts know which layer they run in. Annotate, never rewrite.
2. **L0-only-guarded messages stay**: errors that only fire when CONSTITUTION.md is present are context-correct by construction.
3. **The scrub's JSON and literal non-target rules stay.** No auto-scrub of `.json`, no literal rewriting arm.
4. **The scrub's comment-only behavior in `.ts` stays** — comments may keep projecting CONSTITUTION.md→context.md; only the scan exemptions change.
5. **Root (L0) scripts' own CONSTITUTION references stay** — L0 is the document's home; nothing in the projects should silence it there.
6. **co-deck's `presentations/` pipeline layout stays** — only the declaration is added.
7. **new-project.ts scaffold branches stay** until the Phase 2 registry (if ever) — do not restructure §2.6a/2.6a-2 in this wave.

## 7. Rollout order and risk notes

**Order**: Wave A (source fixes + scan extension, WARN) → Wave B (16-file §7 wave + pin + co-deck declaration) → Wave C (fleet upgrade visits deliver both; retire the co-consult LOCAL-PATCH; run ticket 010's repro in a scaffolded project to confirm the language-gate message is context-safe) → Phase 2 registry only if a third mapping need appears. Wave A first because it is single-SSOT, mechanically small, and unblocks the scan that guards the rest.

**Risks**:

- **Scale (80-file survey / ~30 annotated lines)**: triage per §6.3 — three categories stay untouched (functional guards, L0-guarded messages, L0-only scripts); only the message-pointer category is edited. Do not attempt a blanket sed.
- **JSON functional-values**: the terms-ko fix is a hand edit at SSOT; if the `.json` scan arm were ever pointed at registry files, `workspace-schema.json`'s rootAllowlist `"CONSTITUTION.md"` entry and `propagation-map.json`'s `constitution-context` source_file would false-fail — hence the filename exemption set. The scrub itself must never gain a JSON arm.
- **Windows CI**: path separators in the new scan must reuse `L0_REF_PATTERN` (already `[\/\\]`); line splitting on `\n` leaves `\r` on CRLF lines, which `includes()`-based marker matching tolerates. Keep the audit arm free of `path.sep` assumptions on template-relative paths.
- **False positives in the new `.ts` arm**: prose-shaped hits like verify-adr-governance.ts:489 ("…the CONSTITUTION.md ADR-0073-Amendment-2 → ADR-0074 pattern") are L0-only scripts; they either get annotated or the arm's WARN phase absorbs them — one fleet soak before FAIL promotion.
- **§7 wave rot**: the 16-file edit has no propagation; the pin arm is not optional — it lands in the same wave or the wave is deferred.
- **Standardization invariant**: root↔L1 script pairs must be edited together; the existing parity checks (validate-templates / verify-scripts) will catch a half-edit.

## 8. Out of scope

- Migrating co-deck's `presentations/` pipeline to `deliverables/presentations/`.
- Reshaping co-abap's `deliverables/` (code templates).
- Promoting any output scaffold into `templates/common/`.
- Retroactive relocation of already-delivered project files (owner-side; the 2026-11-13 relocations are done).
- An L1-wide deliverable naming mandate (co-consult vs co-work table shapes differ by design).
- Scrubbing or restructuring L0 root doctrine (AGENTS.md/CONSTITUTION.md root copies).
- merge-frontmatter.ts changes.

## References

- tickets/governance/U-20261113-008.yaml, U-20261113-009.yaml, U-20261113-010.yaml
- scripts/lib/constitution-scrub.ts (v1.3.0 header doc — non-targets rationale)
- scripts/helpers/l0-ref-policy.ts (L0_REF_PATTERN, findL0LeakLines, intentional-duplicate mechanics)
- scripts/audit.ts L0 Leakage arm (~line 3329, .md-only scope)
- scripts/validate-templates.ts v1.71.0 `agents-md-destructive-file-ops-pin` (§7 parity pin precedent)
- scripts/new-project.ts §2.6a/2.6a-2 (per-variant deliverables scaffold), scripts/upgrade-project.ts DOCS_MERGE_FILES
- docs/workspace-schema.json (`country_scoped_assets` registry precedent; rootAllowlist functional CONSTITUTION.md entry)
- templates/common/AGENTS.md:270; templates/co-consult/AGENTS.md:320; Projects/co-consult/docs/co-consult.context.md (Output Destination Mapping); templates/co-work/docs/co-work.context.md; templates/co-deck/docs/co-deck.context.md
