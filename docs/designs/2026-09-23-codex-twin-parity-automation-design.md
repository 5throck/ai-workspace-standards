# Cross-Twin Common Section Parity (VA-06) + Variant Checklist CODEX Coverage

- Spec ID: `2026-09-23-codex-twin-parity-automation`
- Date: 2026-09-23
- Status: **Implemented**
- Related: ADR-0077 (Codex platform twin, D11 governance-l1), ADR-0021 (document parity), ADR-0085 D2 (platform mirrors shared), design `2026-09-12-codex-platform-support-design`, validate-templates VA-05, co-newbiz design `2026-09-23-docker-image-retention-deploy-restore` (the triage that surfaced this)

## Background

Co-newbiz triage found its `CODEX.md` missing the Language Policy section while `CLAUDE.md`/`GEMINI.md` both carry it (fixed at the content level in co-newbiz PR #407 and upstream PR #1023). Root-cause chain: governance waves added the section to the CLAUDE/GEMINI **roots** only; nothing compares the twins against each other, so the root-level asymmetry persisted invisibly. The deployment automation is NOT at fault — correction to the #1023 notes: `--governance-l1` (a fatal dev-sync step per ADR-0077 D11) already deploys CLAUDE/GEMINI/AGENTS/**CODEX.md** root→`templates/common` with ref transforms; `propagate:apply`/`propagate:docs` exclusions are by design and not part of the twin path. The gap was (1) missing cross-twin detection and (2) operator checklist coverage.

## Requirements

- REQ-P1: A validator check fails when any of the three instruction twins lacks a shared policy section that the others carry — checked at both the root layer and the `templates/common` layer.
- REQ-P2: The check is anchor-based (policy presence), not full-content equality — platform-specific sections legitimately differ across twins (ADR-0021's same-intent/different-platform rationale applied to instruction docs).
- REQ-P3: The variantization manual-review checklist names the full twin set (CODEX.md included) so operators consider the COMMON-CODEX markers at variant-creation time.
- REQ-D1: `generate-variant.ts`'s `generateClaudeMd`/`generateGeminiMd` are dead code (never invoked — variant templates ship no twins by design; `templates/common` supplies them at scaffold/upgrade). No `generateCodexMd` is added to a dead path; dead-code removal is deferred to a dedicated cleanup.

## Design

- **`validate-templates.ts` 1.37.0 → 1.38.0**: new `checkTwinCommonSectionParity()` (check id **VA-06**) — for each layer (`root`, `templates/common`) × each twin (`CLAUDE.md`, `GEMINI.md`, `CODEX.md`) × each anchor in `TWIN_COMMON_ANCHORS` (Language Policy for Documentation; Execution Plan Boilerplate; Cost Optimization (3-Tier Model Strategy); Custom Command Error Recovery; Windows Platform Requirement; Git & PR Additions): missing anchor → **FAIL** with a port-from-sibling fix hint; present → pass. Wired into the root-level check block beside `checkModelLiteralPlacement()`.
- **`project-to-variant.ts` 1.4.0 → 1.4.1**: the variantization checklist twin line now names CODEX.md, `templates/common/{CLAUDE,GEMINI,CODEX}.md`, and the COMMON-CODEX marker pairs.
- **L1 registry mirror**: `templates/common/scripts/SCRIPTS.md` (hand-maintained — propagate does not copy root SCRIPTS.md) rows bumped to match.

## Verification

- [x] Negative fixture: stripping the "Language Policy for Documentation" anchor from root `CODEX.md` → `validate-templates.ts` exits 1 with a VA-06 FAIL naming the twin; restored → 36 VA-06 passes (3 files × 6 anchors × 2 layers), exit 0.
- [x] `validate-templates.ts` exit 0 after L0→L1 script propagation + L1 registry mirror.
- [x] Typecheck gate (root `scripts/` zero-error baseline) clean.
- [ ] Fleet effect: the next co-newbiz upgrade wave delivers the twin via MERGE (`platform` defaults to `all`).
