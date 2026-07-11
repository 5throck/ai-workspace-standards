# Design: M11/M12 Heading Consistency, M15 Real SSRF TOCTOU Fix, Retroactive Beta-Lifecycle Design Doc

**Date**: 2026-07-11
**Status**: Approved
**Spec ID**: 2026-07-11-m11-m12-m15-fixes
**Scope**: AGENTS.md (+ templates/common + 7 L2 variants via propagation), scripts/lib/ssrf.ts, scripts/ingest-security-frameworks.ts, scripts/ingest-external-skills.ts, docs/designs/ (retroactive doc for already-shipped PR #397)

---

## 1. Problem Statement

Three items were deferred from the 2026-07-10 review (M11, M12, M15) as "no functional impact." Re-investigation for this session found that assessment was wrong for two of the three:

1. **M11/M12** ("co-design AGENTS.md format cleanup") is not a co-design-specific issue — the root `AGENTS.md` SSOT itself has inconsistent heading numbering: `§3.1`–`§3.8` use a `§` prefix, but `4.1`–`5.3` do not. `templates/co-design/AGENTS.md` simply inherits this inconsistency via propagation from the same source. This is a real (if cosmetic) SSOT bug, not a variant-local formatting slip.
2. **M15** ("ssrf.ts TOCTOU DNS rebinding — known limitation, documented") is not actually mitigated. `validateUrl()` pre-resolves DNS and returns `resolvedAddresses`, but both call sites (`ingest-security-frameworks.ts`, `ingest-external-skills.ts`) discard that result and call `fetch(url)` again — which performs its own independent DNS lookup. An attacker controlling DNS (rebinding) can pass validation with a safe IP at T1 and serve a private/internal IP at the actual fetch at T2. The "known limitation" framing understated this as accepted risk; it is a fixable gap.
3. **Doc-reflection audit finding**: PR #397 (`beta-lifecycle.ts` variant.json summary sync) shipped without a Design Gate document, despite being a behavior change (not an E1–E5 exempt category). This design doc retroactively documents that already-merged change to close the gap, per the user's explicit request to verify design/doc reflection.

## 2. Decision Summary

- **M11/M12**: Add the missing `§` prefix to `AGENTS.md` headings `4.1`, `4.2`, `4.3`, `5.1`, `5.1.1`, `5.2`, `5.3` for consistency with `§3.x`. Verified via the existing `#36-3-tier-strategy`-style anchor precedent that GitHub-flavored Markdown slug generation strips the `§` symbol identically whether present or not (confirmed empirically: `§3.6 3-Tier Strategy` and a hypothetical `3.6 3-Tier Strategy` both slug to `#36-3-tier-strategy`) — so this is a pure text-consistency fix with zero anchor-link risk to the links added in the 2026-07-11 governance-docs-consolidation work (PR #398). Propagate via the same `propagate:governance` + `propagate:docs` mechanism used for that prior change.
- **M15**: Add `safeFetch(url, init)` to `scripts/lib/ssrf.ts`. It calls `validateUrl()` once, then performs the actual HTTP(S) request using Node/Bun's `https.request`/`http.request` with a custom `lookup` override that returns ONLY the pre-validated address — eliminating the second DNS query entirely (verified empirically: Bun's `https.request` accepts `lookup(hostname, options, callback)` with `callback(null, [{address, family}])`, and passing the original hostname as the connection target preserves the correct `Host` header and TLS SNI while the `lookup` override redirects only the socket-level connection). Update both call sites to use `safeFetch()` instead of the `validateUrl()` + `fetch()` pair.
- **Beta-lifecycle retroactive doc**: Document the already-shipped `syncSummaryToVariantJson()` mechanism (PR #397) per the standard Design doc format, for the historical record and to close the Design Gate compliance gap.

## 3. Files to Change

| File | Action | Description |
|------|--------|-------------|
| `AGENTS.md` | Modify | Add `§` prefix to 7 headings (`4.1`→`§4.1`, `4.2`→`§4.2`, `4.3`→`§4.3`, `5.1`→`§5.1`, `5.1.1`→`§5.1.1`, `5.2`→`§5.2`, `5.3`→`§5.3`) |
| `templates/common/AGENTS.md`, `templates/co-*/AGENTS.md` (7 variants) | Propagate | Via `propagate:governance` + `propagate:docs` (no manual edits) |
| `scripts/lib/ssrf.ts` | Modify | Add `safeFetch()`; bump to v1.1.0 |
| `scripts/ingest-security-frameworks.ts` | Modify | Replace `validateUrl()` + `fetch()` with `safeFetch()` |
| `scripts/ingest-external-skills.ts` | Modify | Same replacement (2 call sites) |
| `tests/unit/ssrf-safe-fetch.test.ts` (new) | Create | Test-first regression coverage for the DNS-pinning behavior |
| `docs/designs/beta-lifecycle-variant-sync-design.md` (new) | Create | Retroactive design doc for already-shipped PR #397 |

## 4. Trade-offs Considered

| Option | Pro | Con | Decision |
|--------|-----|-----|----------|
| Leave M15 as "documented known limitation" | Zero risk, zero effort | Leaves a real, exploitable TOCTOU gap in production security code | Rejected — user explicitly asked for a real fix |
| Fix M15 by re-validating IPs post-connection (inspect socket.remoteAddress after connect) | Simpler than a lookup override | Reactive, not preventive — the malicious connection still happens before being detected | Rejected |
| Fix M15 via custom DNS `lookup` override pinning the pre-validated address | Preventive — the rebinding IP is never dialed at all | Requires switching from `fetch()` to `https.request`/`http.request` (slightly more verbose API); Bun's `Response`-compatible wrapping needs a small adapter | **Selected** |
| M11/M12: rewrite AGENTS.md's whole heading scheme | Cleaner en masse | Higher risk of unrelated collateral edits given the file's size (630+ lines) | Rejected |
| M11/M12: minimal targeted fix (add missing `§` only, no renumbering) | Low risk, directly closes the reported inconsistency | N/A | **Selected** |

## 5. Cross-Platform Considerations

- M11/M12: pure Markdown text change; propagation covers Claude Code and Antigravity template copies identically (no platform-specific content touched).
- M15: `dns`, `net`, `http`, `https` are Node/Bun built-ins available identically on Windows/Linux/macOS; the `lookup` override technique is part of the documented Node.js `http.request`/`https.request` options API (Bun implements this compatibly, verified empirically in this environment).

## 6. Platform Impact (MANDATORY)

| Platform | Impact | Files Affected |
|----------|--------|-----------------|
| Claude Code | None beyond the AGENTS.md heading text (cosmetic) | `AGENTS.md` |
| Antigravity (GEMINI.md) | None — GEMINI.md is not touched by this change; `AGENTS.md` propagation targets both platforms' variant directories identically | `templates/*/AGENTS.md` |
| templates/common | Yes — `AGENTS.md` heading fix propagates via the standard `--governance-l1` + `--docs` mechanism (same as PR #398) | `templates/common/AGENTS.md`, `templates/co-*/AGENTS.md` |

## 7. Acceptance Criteria

- [ ] All 7 previously-unprefixed `AGENTS.md` headings now use `§`, consistently matching `§3.x`.
- [ ] `bun scripts/audit.ts` and `bun run validate-templates` pass after propagation; no anchor-link regressions in cross-references added by PR #398.
- [ ] `safeFetch()` makes exactly one DNS resolution per call (verified in tests via a call counter on a stubbed `lookup`), and the actual socket connection uses only the pre-validated address.
- [ ] `ingest-security-frameworks.ts` and `ingest-external-skills.ts` no longer call `fetch()` directly on an unvalidated hostname after `validateUrl()` — both go through `safeFetch()`.
- [ ] `docs/designs/beta-lifecycle-variant-sync-design.md` exists and accurately describes the already-merged PR #397 mechanism.

## 8. Open Questions

None — user explicitly requested M11/M12/M15 be fixed in this session; scope and approach follow directly from the investigation above.
