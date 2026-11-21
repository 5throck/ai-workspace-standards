# Design: co-work seed drops im-not-ai — the adapter is the sole Humanize coupling surface (L2 seed + template parity)

- **Spec ID**: 2026-11-21-cowork-imnotai-retirement-design
- **Date**: 2026-11-21
- **Status**: Implemented
- **Ticket**: T-20261121-003 (filed from docs/designs/2026-11-21-humanize-seed-country-profiles-design.md §9.1, item N2)
- **Ruling**: owner correction 2026-11-21 on docs/designs/2026-11-16-humanize-external-design.md — the external dependency is 5throck/Humanize ONLY; epoko77-ai/im-not-ai is NEVER installed as a project dependency (its rulebook and prompt are already ported inside Humanize's `rules.js`/`prompt.js`)
- **Governing principle (owner-confirmed)**: the adapter is the sole coupling surface — external repo characteristics are absorbed ONLY in the adapter + compatibility_test; workspace content (docs, skills, records) never references external internals
- **Companion L3 design**: Projects/co-work `docs/designs/2026-11-21-imnotai-retirement-design.md` (adapter revision v1.1.0 + project manifest alignment — landed first, co-work PR #53)
- **Owner**: architect+automation-engineer hybrid (PM Gateway dispatch)
- **Tiers**: L2 (templates/co-work seed, adapter copy, context doc, SCRIPTS.md row, variant version) · L3 delivered by the companion PR · L0 no change (the lib has no seed-set equality gate; V10 registry untouched — co-work keeps `humanize` with `market_scope: ["ko-language"]`, so the B-10 consistency rule stays satisfied)

## 1. Context

The co-work variant seed still carries the im-not-ai entry (pin v2.4.7) after the
owner correction, so every fresh co-work scaffold clones a dependency the owner
ruled out, and the delivered adapter v1.0.0 fails selftest without it. The
country-profiles design (§3 N2 / §9.1) ruled the disposition out of scope there and
flagged it for this dedicated change. Part 1 verification (T-20261121-003) found
zero consumers of im-not-ai beyond the adapter: the arms are pure existence checks
on clone files the adapter never reads, and no skill, doc process, or script
consumes them.

## 2. Decisions

- **D1 — Seed entry removal**: the im-not-ai entry is deleted from
  `templates/co-work/external-deps.json`; the `$comment` prose is amended to the
  single-clone posture with a pointer to this design (the retirement record), not
  to im-not-ai internals.
- **D2 — Template adapter parity (byte-identical)**: `templates/co-work/scripts/humanize/humanize-adapter.ts`
  is replaced by the merged project adapter v1.1.0 (co-work PR #53, commit 8a35186),
  byte-identical. Mandated companion: without it, fresh scaffolds fail the selftest
  that both remaining entries declare as `compatibility_test`, and the next upgrade
  visit would resurrect the retired arms project-side.
- **D3 — Registry/context hygiene**: the template `scripts/co-work/SCRIPTS.md` row
  mirrors the project row (v1.1.0, single clone); `docs/co-work.context.md` Humanize
  External section drops the im-not-ai row and the `--id im-not-ai` install comment
  (minimal edits; the section's historical version footer is left verbatim — records
  are not coupling surfaces). No workspace doc gains im-not-ai internals content.
- **D4 — Variant version bump: evaluated, STRUCK at execution**. A 1.2.0 → 1.3.0
  bump was considered (behavioral scaffold change takes a minor, per the
  country-profiles design §9.2 house convention), but the country-profiles landing
  pinned `version` to `"1.2.0"` in `tests/unit/validate-templates-market-scope-country.test.ts:134`
  — a bump now additionally requires editing that pin, expanding this change into
  workspace test edits for no behavioral gain. The seed change is recorded by this
  design + T-20261121-003 instead; `variant.json` stays 1.2.0.
- **D5 — Transitional rule**: no co-work upgrade visit between the L3 merge (PR #53)
  and this PR's merge — otherwise the old template would re-deliver the retired arms.

## 3. Consequences

- Fresh scaffolds install and verify `humanize` + `ppt-master` only; the delivered
  selftest checks 2 Humanize key files (`serve.ts`, `rules.js`) — the real interface
  contract. The 4 dropped arms verified nothing the lint path uses; zero functional
  coverage lost.
- `bun scripts/external-deps.ts verify --project Projects/co-work` stays green: the
  verify loop iterates only the project manifest, V6 (clone absent) is WARN, and the
  co-work `humanize` entry keeps `market_scope: ["ko-language"]` (B-10 rule intact —
  `tests/unit/validate-templates-market-scope-country.test.ts` needs no change; its
  co-deck id-set assertion is unaffected).
- Historical records (dated design documents, memory logs, upgrade-delivery logs,
  the L0 `scripts/SCRIPTS.md` lib-row version history) retain past mentions by
  design — they are records of what was true when written.

## 4. Platform Impact

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | None — no skill/agent/command references the im-not-ai arms (verified by the Part 1 sweep; co-deck is already Humanize-only) | N/A |
| Antigravity (GEMINI.md) | None — the variant's Gemini surface carries no humanize/im-not-ai references (GEMINI.md is a platform bootstrap, not a dependency consumer) | N/A |
| templates/common | None — the common seed carries no humanize entries; `scripts/lib/external-deps.ts` unchanged (no seed-set gate, V10 registry untouched) | N/A |

## 5. Acceptance criteria

- [ ] `templates/co-work/scripts/humanize/humanize-adapter.ts` byte-identical to the merged project adapter (v1.1.0)
- [ ] `templates/co-work/external-deps.json` parses; entries = ppt-master + humanize; no im-not-ai anywhere in the seed
- [ ] `bun scripts/external-deps.ts verify --project Projects/co-work` → 0 fail
- [ ] `tests/unit/validate-templates-market-scope-country.test.ts` green (B-10 rule on the repo as changed)
- [ ] Vendoring guard clean (no `external/im-not-ai` in templates/)
