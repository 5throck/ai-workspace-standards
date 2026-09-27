# Hermes.md Instruction File Design — a Hermes-Specific Behavioral File for the Hermes Agents Platform

- **Date**: 2026-09-27
- **Status**: Approved (Row 0 design; user directive 2026-09-27 — implementation in a single PR per approved plan)
- **Related**: ADR-0093 (decision record — amends ADR-0088 D2), ADR-0088 (Hermes platform support — spike evidence F1–F4, D1–D8, Addendum 1 truncation finding), ADR-0077 (Codex platform support — the twin-file delivery pattern this follows), ADR-0035/ADR-0048 (AGENTS.md structure & SSOT), ADR-0090 (AGENTS.md thin dispatcher)
- **Scope**: One root file (`Hermes.md`) + its 3-tier delivery (L0 → L1 `templates/common` → L2 all 13 `templates/co-*`) + gate/policy wiring + scaffold/upgrade delivery for the `hermes` platform profile. No changes to skill mirrors, no AGENTS.md body rewrite, no variant AGENTS.md header updates (explicitly out of scope this pass).

---

## 1. Background & Current-State Analysis

### 1.1 User Directive (2026-09-27)

The user directed creating `Hermes.md` — an instruction file for the Hermes Agents platform — at L0 root, L1 `templates/common/`, and L2 all 13 `templates/co-*` variants, referencing `CLAUDE.md`/`GEMINI.md`/`CODEX.md`/`AGENTS.md`.

### 1.2 The ADR-0088 D2 Anti-Goal — and Why This Design Does Not Hit It

ADR-0088 D2 (2026-09-25) rejected a `HERMES.md` **copy-twin** of `AGENTS.md` for two reasons:

1. **Shadowing**: Hermes' context chain is first-found-wins (`HERMES.md` → `AGENTS.md` → `CLAUDE.md` → `.cursorrules` — spike evidence F3), so a twin would take precedence over `AGENTS.md`.
2. **SSOT fork**: a copy of AGENTS.md immediately forks the instruction source of truth — every governance edit must then be applied twice.

This design respects both objections because `Hermes.md` is **not an AGENTS.md copy**. It is a **Hermes-specific behavioral instruction file** in the same family as `CLAUDE.md`/`GEMINI.md`/`CODEX.md`: each platform reads its own file, and each file is self-sufficient on behavioral essentials while pointing at the shared registry. Concretely, `Hermes.md`:

- carries the behavioral essentials inline (role declaration, PM Gateway summary, skill resolution priority, language policy, boundary policy, baseline behaviors) — one merge-managed `COMMON-HERMES` zone per the `COMMON-CLAUDE`/`COMMON-GEMINI`/`COMMON-CODEX` convention;
- explicitly instructs the agent to read `AGENTS.md` as the neutral SSOT registry (roster §1, PM Gateway §3, workflows §4–5, skills §6, baseline §7) plus the referenced governance docs when needed;
- contains **no duplicated registry content** — the roster, phase protocol, execution-plan templates, and skill registry remain single-sourced in `AGENTS.md` and the thin-dispatcher doc set (ADR-0090).

The one true behavioral overlap with `AGENTS.md` (the PM Gateway and baseline summaries) is the same intentional, marker-managed overlap `CLAUDE.md`/`GEMINI.md`/`CODEX.md` already carry — a summary, not a fork.

### 1.3 The 20,000-Character Truncation Becomes the Design Constraint

Design-doc Addendum 1 (2026-09-25, live verification T-20260925-008) established that Hermes caps project context files at `context_file_max_chars` (default **20,000**; explicit config wins) and that **every AGENTS.md in the ecosystem exceeds it** (L0: 56,837 chars; L1: 49,190; L2: 27,927–82,099) — truncation is silent and drops the COMMON-AGENTS governance zone entirely on some variants.

For this design the finding inverts from problem to **hard constraint**: because Hermes loads exactly ONE context file and `Hermes.md` now takes the first-found-wins slot, `Hermes.md` must stay under the cap at every layer. This is achievable precisely because the file is thin-plus-pointers: the budget is spent on behavioral essentials, not on a registry copy that already overflows. Delivery gate: **< 19,000 characters** at L0 and L1 (1,000-char safety margin below the default cap), verified by `wc -c` in the gate battery.

### 1.4 Current State

- Hermes platform support shipped via ADR-0088 (`.hermes/skills/` mirror, `hermes` scaffold profile, AGENTS.md header note "Hermes Agent reads THIS file directly — no separate instruction file exists for it"). That header sentence becomes false with this change and is amended.
- Platform instruction files: `CLAUDE.md`, `GEMINI.md`, `CODEX.md` exist at L0 + L1; variant templates carry only `AGENTS.md` (twins are delivered from L1 at scaffold time and pruned per platform profile). Per the user directive, `Hermes.md` additionally ships as an L2 copy in all 13 variants (rides the deny-list fallback claim of TEMPLATE TREE SYNC — safe: the file is variant-inert).

## 2. Goals / Non-Goals

**Goals**

- G1: `Hermes.md` exists at L0, L1 (`templates/common/`), and all 13 L2 `templates/co-*` variants, with the L1/L2 copies carrying the project-scope transforms (no CONSTITUTION.md refs, Project Boundary Policy instead of the workspace section).
- G2: The file is self-sufficient on behavioral essentials, points at `AGENTS.md` as the SSOT registry, and stays under the Hermes truncation cap at every layer (< 19,000 chars at L0/L1, verified by gate).
- G3: The full delivery machinery treats `Hermes.md` exactly like the sibling platform docs: governance-L1 propagation with a B-7 boundary transform + B-8 fatal guard, language-gate protection, MERGE-managed upgrade delivery on the `hermes`/`all` platform profiles, scaffold delivery/retention on the `hermes` profile, and standard-root-md allowlisting.
- G4: ADR-0088 D2 is amended (not rewritten) via ADR-0093; the AGENTS.md header pointer is corrected in one line.

**Non-Goals**

- N1: No AGENTS.md body size reduction (tracked separately by the AGENTS.md size-reduction design, `docs/designs/2026-09-25-agents-md-size-reduction-design.md`).
- N2: No variant `AGENTS.md` header-line updates (out of scope this pass — L2 AGENTS.md headers still carry the pre-ADR-0093 wording until the AGENTS.md size effort touches them).
- N3: No `COMMON-HERMES` injection domain in `propagation-map.json` (`--docs`) and no `--check-drift` coverage for `Hermes.md` this pass — L2 copies are produced by direct copy from L1; adding the marker-inject domain is a follow-up if section-level variant overrides are ever needed.
- N4: No end-to-end Hermes session run (follow-up from ADR-0088 N4 remains open).

## 3. Requirements & Acceptance Criteria

| # | Requirement | Acceptance criterion |
|---|---|---|
| R1 | Root `Hermes.md` (L0) | Exists; ≤ ~250 lines; `wc -c` < 19,000; carries H1 + role line, AGENTS.md SSOT pointer, Hermes platform mechanics (F3 chain, D1/D4 no-commands, D7 trust, truncation), one `COMMON-HERMES:START/END` zone with the shared governance sections, workspace-flavor "Workspace & Template Boundary Policy" block (exact title, contiguous), graft block from CLAUDE.md tail |
| R2 | L1 copy | `templates/common/Hermes.md` produced by `propagate-to-templates.ts --governance-l1`; zero `CONSTITUTION.md` refs (shared scrub); "Workspace & Template Boundary Policy" replaced by "Project Boundary Policy" (B-7 Hermes branch, same replacement body as CODEX); B-8 fatal guard covers the file; `wc -c` < 19,000 |
| R3 | L2 copies | `templates/co-*/Hermes.md` for all 13 variants, byte-identical to L1 |
| R4 | Gates | `audit.ts` STANDARD_ROOT_MD includes `Hermes.md`; `validate-md-language.ts` allowlists `Hermes.md` as an official document AND lists it as a protected no-`lang:`-exception path; `lib/upgrade-policy.ts` MERGE_MANAGED_FILES includes `Hermes.md` (resolveClaim → MERGE_MANAGED/MERGE); `upgrade-project.ts` MERGE push delivers it for `hermes`/`all`; `new-project.ts` hermes profile retains it (non-hermes/non-all profiles prune it alongside `.hermes/`); `adopt-project.ts` GOVERNED_PLATFORM_TWINS includes it |
| R5 | AGENTS.md pointer | L0 AGENTS.md line 8 names `Hermes.md (Hermes Agents)` and drops the "no separate instruction file exists" sentence; L1 AGENTS.md updated via the governance-l1 re-run |
| R6 | Governance records | ADR-0093 (Amends ADR-0088 D2, Status Accepted); ADR-0088 D2 carries a one-line "Amended by ADR-0093" pointer (no history rewrite); design doc registered in `docs/specs/registry.json` via `spec-register.ts` |
| R7 | Tests | `upgrade-policy` pins cover `Hermes.md`; `test-new-project.ts` Test 8 hermes branch expects `Hermes.md` present (and `all` branch includes it); `test-platform-parity.ts` FILE_MAPPINGS includes the L1 mapping (informational existence check) |
| R8 | Battery | `audit.ts`, `validate-templates.ts`, `verify-scripts.ts --verify`, `bun test`, `propagate-to-templates.ts --check-drift`, `generate-version-manifest.ts` (if manifest gate complains), `bun run typecheck` (if defined) all green; root and L1 `wc -c` < 19,000 |

## 4. Alternatives Considered

- **Full copy twin of AGENTS.md** (`HERMES.md` mirror) — **rejected**: forks the instruction SSOT (every AGENTS.md edit needs a second landing spot), and the copy exceeds Hermes' 20,000-char context cap at every layer (L0 AGENTS.md is 56,837 chars), so the fork would be delivered truncated — the worst of both worlds. This is exactly ADR-0088 D2's anti-goal.
- **No file; wait for the AGENTS.md thin-dispatcher size reduction** — **rejected**: the user directive (2026-09-27) requires a Hermes instruction file now, and Hermes-specific mechanics (first-found-wins slot, truncation budget, `.hermes/skills` native invocation, `trusted_project_dirs` onboarding) need a platform-owned home regardless of how thin AGENTS.md eventually becomes. The thin+pointers file IS the mechanism by which the truncation problem is avoided rather than awaited.

## 5. Design Decisions

- **D1 — Behavioral-file family, not a registry copy**: `Hermes.md` is the Hermes member of the `CLAUDE.md`/`GEMINI.md`/`CODEX.md` family (§1.2). It shares the family's conventions: L0-only header block, one merge-managed `COMMON-HERMES` zone, graft block, English-only protection.
- **D2 — Thin + pointers within a hard budget**: < 19,000 chars (design margin below the 20,000 default cap). Registry content is pointed at, never duplicated; the shared-zone summaries mirror what the sibling files already inline.
- **D3 — Propagation parity with the siblings**: `Hermes.md` joins GOVERNANCE_L1_FILES; its B-7 boundary branch reuses the CODEX replacement body (CODEX shape — heading-to-next-heading inside the single COMMON-HERMES zone); B-8 gains a fourth protected filename. The constitution-ref scrub applies unchanged (shared Phase A).
- **D4 — MERGE-managed delivery**: `resolveClaim('Hermes.md')` → MERGE_MANAGED/MERGE (same rationale as CODEX.md joining in v1.13.0 — prevents the blanket root-file SYNC claim from wholesale-overwriting project edits). The `COMMON-HERMES` marker zone is recognized by the COMMON-* genus in `managed-block-merge.ts`, so upgrades union-merge the zone; scaffold (`new-project.ts`) retains the file only for `hermes`/`all` profiles.
- **D5 — L2 direct copy**: variant copies are byte-identical copies of L1 (no marker-inject domain this pass, N3). TEMPLATE_TREE_SYNC's deny-list fallback claim governs them; no dedicated pass.
- **D6 — AGENTS.md pointer amendment is one line**: the false "no separate instruction file exists" sentence is replaced by naming `Hermes.md`; L1 gets it via the normal governance-l1 re-run.

## 6. Verification Plan

1. `wc -c Hermes.md templates/common/Hermes.md` — both < 19,000.
2. `grep -c "CONSTITUTION.md" templates/common/Hermes.md` → 0; `grep -c "Project Boundary Policy" templates/common/Hermes.md` ≥ 1; `grep -c "Workspace & Template Boundary Policy" templates/common/Hermes.md` → 0.
3. `bun scripts/audit.ts` — non-standard-root-md check green with `Hermes.md` present.
4. `bun scripts/validate-md-language.ts` — green (allowlisted + protected).
5. `bun scripts/propagate-to-templates.ts --check-drift` — green (no new domain).
6. `bun scripts/validate-templates.ts`, `bun scripts/verify-scripts.ts --verify`, `bun test` — green.
7. `bun scripts/test-new-project.ts` — hermes profile delivers `Hermes.md` + `.hermes/`.
8. `git status --porcelain` — exactly the intended paths.

## 7. Accessibility & Preview Verification Statements

- **Accessibility (ADR-0065)**: N/A — documentation and developer tooling only; no web/app/CLI user-facing UI is produced.
- **Preview Verification (ADR-0070)**: exempt — no rendered UI artifact; verification is script-based (§6).

## 8. References

- ADR-0093 — decision record (amends ADR-0088 D2)
- ADR-0088 — Hermes platform support (spike F1–F4, D1–D8, Addendum 1 truncation finding)
- ADR-0077 — Codex platform support (twin delivery pattern; codex-profile scaffold precedent)
- ADR-0090 — AGENTS.md thin dispatcher (why the registry bodies live outside platform files)
- `docs/designs/2026-09-25-hermes-agent-platform-support-design.md` — the platform-support design this extends
- `docs/designs/2026-09-25-agents-md-size-reduction-design.md` — the separate AGENTS.md size remedy (N1)
