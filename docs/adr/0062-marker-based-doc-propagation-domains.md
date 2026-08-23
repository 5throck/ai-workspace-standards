---
status: Accepted
date: 2026-08-24
author: PM + Docs Writer
---

# ADR-0062: Marker-Based Doc Propagation Domains

## Context

The wholesale `docs` propagation domain has been **disabled since 2026-07-08** (`"disabled": true`, `scripts/propagation-map.json:81-85`) pending exactly this ADR. Its own history field records why: activating it as-is would copy **~143 previously-unmatched files** on the next `--apply`, including L0-only content (e.g. `docs/constitution/`) that `scripts/audit.ts`'s L0-leakage check **forbids** under `templates/`. A full mirror is not merely undecided — it is structurally prohibited.

Meanwhile, seven artifact classes are maintained **manually with no or soft gates today**:

1. CONSTITUTION → L1 docs — no propagation path at all.
2. Variant context.md duplicated sections — detect-only (intentional-duplicate hash WARN, ADR-0059 Stage 1b).
3. Post-promotion READMEs — never regenerated after the variant evolves.
4. User guides — 100% hand-written in EN/KO pairs, with no drift check between the pair.
5. AGENTS rosters — hand-maintained per variant.
6. `SKILLS.md` — manual registry.
7. Template → variant context refresh — absent entirely.

Four mechanisms that **do** work are already in production: marker-inject mode (`<!-- COMMON-AGENTS:START/END -->` zones), the intentional-duplicate hash gate (`verify-adr-governance.ts`, detect-then-reseed via `--update-marker-hashes`), the README rendering engine (`helpers/generate-variant.ts`), and the CONSTITUTION → context scrub transform (`scrubConstitutionRefs`). This ADR composes those proven mechanisms instead of inventing new plumbing.

## Decision

### 1. Marker-Rewrite Engine

`propagate-to-templates.ts --marker-rewrite` **replaces marked-section content with the current source slice** — covering both `<!-- COMMON-*:START/END -->` zones and `<!-- intentional-duplicate: ... hash -->` markers. This upgrades the duplicate-marker lifecycle from **detect-then-reseed** (human copies the section, then re-hashes) to **detect-then-rewrite** (engine writes, then re-hashes).

Zone contract:

- **Local customizations live OUTSIDE markers** — anything inside a marked zone is engine-owned and will be overwritten.
- **Rewrites log every overwritten section** — the operator sees exactly what changed.
- **One-cycle WARN-only rollout** before the rewrite path becomes enforcing (ADR-0055/0059 playbook).

### 2. New Whitelisted Propagation Domains

Two new domains in `propagation-map.json`, mode `marker-inject` + rewrite, operating **per-file on marked sections** (never whole-file copies):

| Domain | Source → Target | Transform |
|--------|-----------------|-----------|
| `constitution-context` | `CONSTITUTION.md` section slices → `templates/common/docs/context.md` marker zones | Reuses the existing `scrubConstitutionRefs` scrub transform |
| `variant-context` | L1 common context sections → each variant's `docs/<variant>.context.md` marker zones | Marker-rewrite |

Because sections land only inside marker zones, the L0-leakage boundary is preserved by construction: constitution prose reaches templates only through the scrubbed, whitelisted slices — never as a `docs/` mirror.

### 3. Pilot Scope (Owner-Confirmed)

**co-news, co-hr, co-export, co-consult** adopt the marker zones first; the remaining 7 variants convert **after stabilization**. The pilot variants span the strongest (co-news) and weakest (co-consult) upstream chains from the ADR-0061 audit, so the zone contract is proven at both ends before fleet-wide rollout.

### 4. README Regeneration

`helpers/generate-variant.ts --regenerate <variant>` re-runs the existing rendering engine (`README.template.md` + variant metadata + `readmeNarrative`) for a single variant, **invoked post-apply** for promoted variants. This closes the "post-promotion READMEs never regenerate" gap by reusing the same renderer that `validate-templates.ts` WS-08 and `verify-readme-sync.ts` already enforce, rather than adding a second rendering path.

### 5. User-Guide Drift Gate

`translated_from_hash` enforcement on `user-guide.md` / `user-guide_ko.md` pairs: when the EN guide changes, the KO guide's recorded source hash goes stale and the check flags the pair. **WARN for 2 PRs, then error.** Guide prose itself **stays human-authored** — generating user-facing guide text automatically carries legal-text generation risk (the same reason ADR-0059 chose detection over auto-writing governance prose), so the gate checks drift, it never writes prose.

### 6. The Wholesale `docs` Domain Stays Disabled

This ADR **is** the answer to the pending decision recorded in `propagation-map.json` — a whitelist/transform-based design — and explicitly **not** a reversal. The `disabled: true` flag remains; the note field is updated to point here instead of "ADR required".

### 7. Shared Marker Parser

The rewrite engine and `verify-adr-governance.ts` **share one marker parser**, so a section rewritten by the engine produces exactly the marker state the strict gate expects — avoiding a `--marker-rewrite` vs step-3.97 `--strict` conflict where the writer and the checker disagree about marker syntax or hash computation.

### Rejected Alternatives

| Alternative | Why rejected |
|-------------|--------------|
| **Enable the wholesale `docs` domain** | Copies ~143 files including constitution mirrors that the L0-leakage audit forbids under `templates/` — prohibited, not just unwise. |
| **Generate user-guide prose automatically** | Legal-text generation risk on user-facing EN/KO guides; drift detection gives the safety without the generation risk. |
| **Extend drift detection without rewriting** | Keeps classes 1-7 manual forever — detection without a rewrite path leaves the human copy-paste gap this ADR exists to close. |

## Consequences

**Positive:**

- Seven manual artifact classes get a mechanical propagation path built entirely from **already-proven mechanisms** (marker-inject, hash gate, README renderer, scrub transform).
- The L0-leakage boundary is enforced by construction — marked zones only, scrubbed constitution slices.
- Detect-then-rewrite removes the human copy step that made intentional duplicates drift in the first place.
- The disabled `docs` domain gains a decided disposition after 6+ weeks pending.

**Negative / Trade-offs:**

- **Marker discipline becomes load-bearing** — a local edit inside a marked zone is silently overwritten on the next rewrite; the zone contract (customizations outside markers) must be learned per variant, and the WARN cycle is the buffer.
- **Pilot variants carry the conversion cost first** — retrofitting marker zones into existing context.md files is real editorial work before any automation pays off.
- **A shared parser couples two scripts** — `propagate-to-templates.ts` and `verify-adr-governance.ts` now evolve their marker syntax together or break together.
- **User-guide gate is eventually blocking** — after 2 PRs of WARN, an EN guide edit without a KO update fails sync, which is the intended discipline but adds a failure mode for solo-language edits.

## Implementation

| File | Change |
|------|--------|
| `docs/adr/0062-marker-based-doc-propagation-domains.md` | This ADR |
| `scripts/propagate-to-templates.ts` | `--marker-rewrite` mode + shared marker parser (lands in follow-up PRs) |
| `scripts/propagation-map.json` | `constitution-context` + `variant-context` domains; `docs` domain note updated to point at this ADR, `disabled` unchanged (lands in follow-up PRs) |
| `scripts/helpers/generate-variant.ts` | `--regenerate <variant>` single-variant re-render (lands in follow-up PRs) |
| `scripts/verify-adr-governance.ts` | Consume the shared marker parser; keep step-3.97 `--strict` semantics (lands in follow-up PRs) |
| Pilot variant context.md files (co-news, co-hr, co-export, co-consult) | Marker-zone retrofit (lands in follow-up PRs) |
| User-guide drift gate script | `translated_from_hash` check, WARN-then-error (lands in follow-up PRs) |
| `docs/constitution/00-ssot-architecture.md` | Pointer near "Three Types of Flows": marker-based domains extend the downward flow for designated doc sections (this PR) |

## References

- ADR-0059 — Governance reflection validators: this ADR must appear in the governance corpus (`verify-adr-governance.ts --strict`); its Stage 1b/2b marker-hash machinery is upgraded by §1 and shared by §7
- ADR-0055 — WARN-first → hard-gate playbook followed by §1's rollout and §5's 2-PR WARN window
- ADR-0013 — Committed generated-artifact pattern (README sync) reused by §4
- ADR-0057 — Country-profile mechanism (L0-leakage boundary context)
- ADR-0060 / ADR-0061 — Skill Relationship Graph and Decision Record Standard (sibling ADRs from the same 2026-08-24 design series)
- `scripts/propagation-map.json:71-86` — the disabled `docs` domain whose pending decision this ADR resolves
