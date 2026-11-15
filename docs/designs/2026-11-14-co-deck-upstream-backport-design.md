# co-deck Upstream Backport (U-20261114-006..010) — Design (Row 0)

- **Spec ID**: `2026-11-14-co-deck-upstream-backport-design`
- **Date**: 2026-11-14
- **Status**: implemented (partial — per-item status below)
- **Author**: governance-ticket runner (user-directed backport pass, 2026-11-14)
- **Tracking tickets**: U-20261114-006, U-20261114-007, U-20261114-008, U-20261114-009, U-20261114-010 (all filed by co-deck)

## 1. Problem statement

The 2026-11-14 co-deck sessions produced five upstream requests whose fixes live only in the project (`Projects/co-deck`), at risk of clobber by the next template delivery (the affected scripts are variant-delivered L2 scripts). The user directed a backport pass: reflect the project's superseding state into `templates/co-deck` (and `templates/common` where applicable), then disposition the tickets.

## 2. Ported (this landing)

### U-20261114-006 — html-to-pdf v1.2.0 + validate-image-manifest v1.4.0

- `html-to-pdf.ts` 1.1.0 → 1.2.0: pool-asset intercept-fallback (`/assets/…` deck-local misses re-resolve against the shared pool dir beside the deck, containment-guarded), per-request `⚠️ 404 (missing)` WARN + final missing-asset summary (favicon.ico excluded), exit code unchanged. Template keeps its `presentations/<project>` usage example (the project's `deliverables/` rename is a project-side structure change, not ported).
- `validate-image-manifest.ts` 1.1.0 → 1.4.0 (three-version delta ported): (v1.2.0) deliverables asset-pool path-style rule + sibling diagram-manifest location check + pool-wide duplicate scan; (v1.3.0) pool-wide duplicate scan promoted WARN → ERROR (blocking, Follow-up 3; precondition satisfied by PR #225 cleanup); (v1.4.0) deck-wide photo background doctrine — a REGISTERED global background (background_image.path + matching slides[] entry at slide_index −1) is the approved deck-wide backdrop, not a family-reuse defect; the U-20261029-007 family-reuse ERROR fires only for UNREGISTERED globals. The path-style rule accepts BOTH conventions (repo-root-relative `deliverables/assets/…` and deck-relative `../assets/…`), so the template's `presentations/` structure remains valid — no structural coupling.

### U-20261114-008 item 3 — gen-slides-pdf profile-type background parity

- `gen-slides-pdf.ts` 1.10.1 → 1.14.5 (four-version delta, wholesale port of the project's test-verified copy): slideData.backgroundImage renders full-bleed on every slide type (profile-type background parity), plus the accumulated project improvements the template lacked (previews, python checker parity era changes, U-20261114-008's v1.14.6-era profile-bg fix included in the project copy).

### U-20261114-009 item 1 (partial) — inject-video-players v1.3.0

- `inject-video-players.ts` 1.2.0 → 1.3.0: sidecar-driven subtitle selection — `<assets-dir>/subs/yt-<id>.{ko,en}.vtt` inline VTT map + CC language pill, local-mp4 mode only, conditional emission preserves v1.2.0 behavior when no sidecars exist.

## 3. NOT ported (remaining, with reasons)

- **U-20261114-007 / U-20261114-008 item 1 (white-bubble systemic flex-shrink fix + fix-f cap retirement)**: the fix is NOT yet implemented in the project either — the deck-local `!important` neutralizer is the reference implementation, and the shared-pattern authoring requires visual verification against real decks (U-20261114-008 item 4's forced-load render-clip method). Design+implementation session scope.
- **U-20261114-008 item 2 (poster min-resolution acceptance + video-manifest schema promotion from v0)**: not implemented in the project at filing; re-triage against the project's current video-manifest.json needed.
- **U-20261114-009 items 1b/2/3/4**: download-videos subtitle-download mode (YouTube 429 doctrine — needs the documented fallback decision); zen theme.json content_rules authoring doctrine (identical both sides — needs writing, not porting); Humanize pre-build lint integration (external tool at `/Users/techcross/git/project/Humanize` — security review + user approval per §7); slidedata generator hygiene (lecture-profile single-source + round-trip parity gate).
- **U-20261114-010 (snapshot.ts three failures + DX flag unification)**: the fixes are requested but NOT implemented in the project either (project and template snapshot.ts are at the same v1.0.0) — an implementation task, mechanically specified in the ticket. Next session scope.
- **download-videos / snapshot / estimate-layout usage-line renames (presentations → deliverables)**: the co-deck project consolidated to `deliverables/`; the TEMPLATE still scaffolds `presentations/`. Porting the usage strings would desync the delivered scripts from the scaffolded structure — deferred to the structure-adjudication ticket (T-20261109-003-adjacent / the deliverables doctrine decision).

## 4. Deliverables doctrine note

The co-deck project's `presentations/ → deliverables/` consolidation (2026-11-14, following the co-work deliverables convention) is a STRUCTURE decision now pending template-side adoption. This landing ports only the code/check deltas that are convention-agnostic (the validate-image-manifest path-style rule accepts both forms). The structure question itself belongs to the co-deck session's next doctrine ruling.

## 5. Verification

- Full four-gate suite at the workspace root (audit / validate-templates / verify-scripts / bun test).
- U-20261114-006's own E2E evidence (keynote deck → 58 pool hits, 0 missing-asset warnings, valid 15.6 MB PDF) was produced in the project and the code is ported verbatim.
