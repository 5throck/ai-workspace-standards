# Marker-Based Doc Propagation Engine — Implementation Design

| Field | Value |
|-------|-------|
| Date | 2026-08-24 |
| Status | implemented |
| Governing anchor | [ADR-0062: Marker-Based Doc Propagation Domains](../adr/0062-marker-based-doc-propagation-domains.md) |
| Related | ADR-0059 (governance reflection validators), ADR-0060 (skill graph), ADR-0061 (decision records), PR7 of the 10-PR design series |

## Problem

Seven artifact classes were maintained manually with no or soft gates:
1. CONSTITUTION → L1 docs — no propagation path at all
2. Variant context.md duplicated sections — detect-only (intentional-duplicate hash WARN, ADR-0059 Stage 1b)
3. Post-promotion READMEs — never regenerated after variant evolution
4. User guides — 100% hand-written in EN/KO pairs, with no drift check
5. AGENTS rosters — hand-maintained per variant
6. SKILLS.md — manual registry
7. Template → variant context refresh — absent entirely

The wholesale `docs` propagation domain has been disabled since 2026-07-08 (`"disabled": true` in `propagation-map.json`) pending a whitelist-based design — activating it as-is would copy ~143 files including L0-only constitution mirrors that the L0-leakage audit forbids under `templates/`.

## What Was Built

### D1 — marker-rewrite engine (v2.5.0)

**`propagate-to-templates.ts --marker-rewrite`** — upgrades the intentional-duplicate lifecycle from detect-then-reseed (human copies, then re-hashes) to detect-then-rewrite (engine writes, then re-hashes).

For every existing `<!-- COMMON-<DOMAIN>:START/END -->` zone in a target file: replaces the zone's content with the current source slice. For every `<!-- intentional-duplicate: <name>; source: <path>; hash: <sha256-8> -->` marker: replaces the section content with the current source slice AND refreshes the hash.

Logs EVERY overwritten zone/marker to stdout before writing (file, marker name, +/- line counts). Zones/markers left byte-identical → log "in sync". Preserves each file's existing line-ending style (CRLF vs LF detection per file) and writes with UTF-8 (no BOM).

Contract note in the script header: local customization belongs OUTSIDE zones; content inside a marked zone is engine-owned and will be overwritten.

### D2 — two new propagation domains

| Domain | Source → Target | Transform | Mode |
|--------|-----------------|-----------|------|
| `constitution-context` | `CONSTITUTION.md` section slices → `templates/common/docs/context.md` marker zones | Scrubs `docs/constitution/` path links via existing `scrubConstitutionRefs()` transform | marker-inject + rewrite |
| `variant-context` | `templates/common/docs/context.md` sections → pilot variant `docs/<variant>.context.md` marker zones | None | marker-inject + rewrite |

**Pilot scope** (owner-confirmed): co-news, co-hr, co-export, co-consult. Remaining 7 variants convert after stabilization.

Both domains use file-level whitelists (exactly the files above) and insert marker zones into the target files. Zone boundaries chosen to NOT overlap existing `intentional-duplicate` sections — if overlap is unavoidable, the file is skipped and reported as a PM-adjudication deviation.

### D3 — shared marker parser (v1.0.0)

**`helpers/markers.ts`** — extracts marker-zone + intentional-duplicate parsing into a shared module imported by BOTH `propagate-to-templates.ts` and `verify-adr-governance.ts`. Zero behavior change to `verify-adr-governance`: after refactor, `bun scripts/verify-adr-governance.ts --strict` still reports 9/9 markers in sync and exits 0 (this protects dev-sync step 3.97 from parser divergence — ADR-0062 requirement).

Exports:
- `findMarkerZones(filePath)` — returns `MarkerZone[]` with `{marker, startLine, endLine, fullBlock, innerContent}`
- `extractMarkerZones(content, marker)` — returns `ZoneExtractionResult[]` with `{heading, fullBlock, marker}`
- `scanIntentionalDuplicateMarkers()` — returns `IntentionalDuplicateMarker[]`
- `computeSectionHash(filePath)` — sha256-8 of section body (from first `###` to EOF, CRLF-normalized)
- `resolveConstitutionSource(section)` — maps §3 → `docs/constitution/03-pr-workflow.md`
- `extractSectionContent(filePath)` — reads section body for re-seeding

### D4 — README regeneration flag (v1.13.0)

**`helpers/generate-variant.ts --regenerate <variant>`** — re-runs the existing README rendering engine (`README.template.md` + variant metadata + `readmeNarrative`) for a single variant, invoked post-apply for promoted variants. Closes the "post-promotion READMEs never regenerate" gap by reusing the same renderer that `validate-templates.ts` WS-08 and `verify-readme-sync.ts` already enforce.

NOT wired into `dev-sync` (out of scope this PR).

### D5 — skill graph generator extension (v1.1.0)

**`generate-skill-graph.ts`** — extended to also scan `templates/common/agents/` (previously discovered only L0 `agents/` and variant `templates/co-*/agents/`).

**Dedup rule**: if an agent name already exists as an L0 node (e.g., `pm`), keep the L0 node and skip the common-layer duplicate. This prevents double-counting the `pm` agent which appears at both layers (L0 is the SSOT, common-layer version uses `extends: frontmatter`).

Result: +1 node (`i18n-specialist`, with `used_by` edges to its 3 `required_skills`) → **203 nodes** from 202. Regenerated `docs/skill-graph.json` and `docs/skill-graph.md`.

### D6 — fixture tests

Extended `tests/propagate-to-templates.test.ts` (via new sibling file `tests/marker-rewrite.test.ts`) with:

1. **marker-zone with local modification → --marker-rewrite restores source content** (overwrite verified)
2. **intentional-duplicate section drifted → rewrite restores content AND refreshes hash** (then `verify-adr-governance` passes)
3. **idempotency: running --marker-rewrite twice → second run reports all in sync, no diff**

Tests run via `bun test tests/` and pass.

### Registrations

| Site | Change |
|------|--------|
| `scripts/propagation-map.json` | `constitution-context` + `variant-context` domains added (v1.5.0 → v1.6.0, incl. `scrub_constitution_refs` flag); `docs` domain note updated to point at ADR-0062, `disabled` unchanged |
| `scripts/helpers/markers.ts` | New shared parser module (v1.0.0) |
| `scripts/propagate-to-templates.ts` | v2.4.0 → v2.5.1 (`--marker-rewrite` mode; v2.5.1 = PM post-review fixes, see Deviations) |
| `scripts/verify-adr-governance.ts` | v1.3.0 → v1.4.0 (refactored to use shared parser) |
| `scripts/helpers/generate-variant.ts` | v1.12.0 → v1.13.0 (`--regenerate` flag) |
| `scripts/generate-skill-graph.ts` | v1.0.1 → v1.1.0 (common-agent scan) |
| `scripts/SCRIPTS.md` | Version bumps + new `helpers/markers.ts` row; updated flags for `propagate-to-templates.ts` |
| `docs/specs/registry.json` | New entry `2026-08-24-marker-propagation-engine-design` |
| `docs/skill-graph.json` / `docs/skill-graph.md` | Regenerated: 202 → 203 nodes, edges increased |
| `tests/marker-rewrite.test.ts` | New fixture test file (companion to `tests/propagate-to-templates.test.ts`) |

### L1 propagation

All modified scripts are **L0-only** and do NOT propagate to `templates/common/scripts/` per SCRIPTS.md `layer` column:
- `helpers/markers.ts`: layer L0
- `propagate-to-templates.ts`: layer L0
- `verify-adr-governance.ts`: layer L0
- `generate-variant.ts`: layer L0 (variant scaffolding tool, never copied to L3)
- `generate-skill-graph.ts`: layer L0

No L1 copies required, no `lifecycle-sync-audit.ts Check X` entries needed.

## Verification

| Check | Result |
|-------|--------|
| `bun test tests/` | all tests pass (incl. new marker-rewrite fixtures) |
| `bun scripts/audit.ts` | all-pass (incl. L0-Leakage — scrub transform holds) |
| `bun scripts/validate-templates.ts` | 0 errors (2 pre-existing co-deck WARNs) |
| `bun scripts/verify-adr-governance.ts --strict` | 9/9 markers in sync, exit 0 (shared parser verified) |
| `bun scripts/verify-skill-graph.ts` | exit 0, 203 nodes |
| `bun scripts/verify-scripts.ts --check-drift` | clean |
| `bun scripts/validate-md-language.ts` | exit 0 |

## Deviations

PM post-review verification (2026-08-24) found and fixed four engine defects before merge; the fixes ship in `propagate-to-templates.ts` v2.5.1 and `generate-skill-graph.ts` v1.1.0 (same PR):

1. **`--domain` was silently ignored in `--marker-rewrite` mode** — an unknown domain name fell through to "all domains" instead of erroring. Now validated against `propagation-map.json` (exit 1 + stderr listing available domains), and a known name restricts the marker-inject loop to that domain. Caught by `tests/marker-rewrite.test.ts`.
2. **Cross-domain zone pollution + brittle source pairing** — the zone scan processed ALL marker zones in a target file (so the `constitution-context` pass also saw the `COMMON-CONTEXT` zone and skipped it as unmatched), and source↔target pairing used a first-inner-line substring heuristic. Consequence: all four pilot `COMMON-CONTEXT` zones were permanently skipped — the `variant-context` domain did not function. Fixed by filtering zones to the domain's own marker and pairing by document order (k-th target zone ↔ k-th source zone).
3. **CRLF double-conversion** — the write path applied `.replace(/\n/g, '\r\n')` to content that already contained `\r\n`, producing `\r\r\n`. Fixed by LF-normalizing before re-applying the detected ending (both the zone path and the intentional-duplicate path).
4. **Scrub transform not wired into marker-rewrite** — the constitution-context domain note promised scrubbed output, but the engine copied source slices verbatim, leaking a `docs/constitution/06-skill-lifecycle.md` part-file link into `templates/common/docs/context.md`. Fixed by a `scrub_constitution_refs` domain flag (map v1.6.0) applied to source zone content, plus a new scrub rule A-5 rewriting part-file markdown links (`[docs/constitution/NN-*.md](…)`) to `[docs/context.md](docs/context.md)` — A-2 already covered links whose text mentions CONSTITUTION.md, so no L0↔L1 script-parity comparison is affected (those compare `.ts` files via the comment-only code branch).

Two accepted scope deviations (content-neutral, kept after PM adjudication):

- **`CONSTITUTION.md` carries the source-side `COMMON-CONSTITUTION:START/END` marker pair** (two inert HTML comment lines around the Language Policy Exception → Pluggable Variant Audit Hook span; no content changed). The implementation brief said "do not modify CONSTITUTION.md", but the marker-inject mechanism needs the source slice delimited in the source file — accepted as the mechanically minimal declaration.
- **11 variant `AGENTS.md` files refreshed inside their existing `COMMON-AGENTS` zones** during the rewrite cycle: stale `l2-to-variant-pipeline.ts` references corrected to `l3-to-variant-pipeline.ts` (the 2026-08-15 rename). This is the engine working as designed — zone content is engine-owned — and doubles as the first live demonstration of zone refresh.

Also fixed during verification: the new common-agent graph scan counted `templates/common/agents/_COMMON.md` (a directory README, not an agent) as a node — 204 vs the designed 203. The scan now excludes underscore-prefixed files; `_COMMON.md`'s stale "Only `pm.md` exists" line was updated to include `i18n-specialist.md`.

## Out of Scope / Follow-ups

- D8 (spec governance) requires a manual `docs/designs/2026-08-24-marker-propagation-engine-design.md` creation (this file) plus a surgical `docs/specs/registry.json` edit — both completed in this PR.
- D9 (CHANGELOG) requires a manual `CHANGELOG.md` edit — completed in this PR.
- User-guide drift gate (`translated_from_hash`) — PR8 of the design series (WARN phase).
- Pilot `COMMON-CONTEXT` zones are inserted and in sync in all four pilot variants (co-news, co-hr, co-export, co-consult); conversion of the remaining 7 variants stays gated on stabilization per ADR-0062.
- **dev-sync step 4.5 wiring — RESOLVED 2026-08-25 (WARN stage)**: the pilot held 0 would-overwrite across both domains (constitution-context, variant-context) through ~10 subsequent PRs after this design landed, satisfying the stabilization bar. `dev-sync.ts` 1.7.4 wires a dry-run drift check after the L0→L1 publish (L0-only): per-domain `would-overwrite > 0` prints a non-fatal WARN with the manual refresh command. Auto-apply inside the pipeline and promotion to a hard gate remain unwired, per the ADR-0055 WARN-first → soak → promote playbook; conversion of the remaining 7 variants stays gated on the same soak.

## References

- ADR-0059 — Governance reflection validators (marker-hash machinery)
- ADR-0055 — WARN-first → hard-gate playbook
- ADR-0062 — Marker-Based Doc Propagation Domains (governing ADR for this design)
