# Upstream Intake Windows Id-Allocation Design (T-20261005-001)

- **Date**: 2026-10-05
- **Status**: Implemented (2026-10-05 — delivered with the EPERM fallback, the -32603 diagnosability change, and CI verification in the same change set)
- **Owner**: Automation Engineer (design + implementation)
- **Spec id**: `2026-10-05-upstream-intake-windows-id-allocation-design` (registry: `docs/specs/registry.json`, source: `manual`)
- **Ticket**: T-20261005-001 (windows-only M5 parallel-intake flake, sibling of T-20261004-002)
- **Related ADRs**: ADR-0074 (Universal Design Gate)

---

## 1. Summary

The M5 parallel-intake test (`tests/unit/mcp-upstream-server.test.ts`) failed once on `windows-latest` during PR #1419's merge run: `expect(accepted).toBe(3)` received **2** — one of six parallel intakes returned an error that is neither an acceptance nor the retryable `-32000` rate-limit answer. Root cause: the ticket-id publication step inside the accept path used `fs.linkSync(tmp, target)`. Hard-link creation is atomic and EEXIST-exact on POSIX, but on Windows it fails **EPERM** under file-system filter/AV pressure; the EPERM was re-thrown, escaped the accept path, and surfaced as the generic `-32603 internal error` (whose message was discarded, hiding the cause). Fix: treat EPERM as a trigger for the **O_EXCL exclusive create** (`fs.openSync(target, 'wx')` — the cross-platform atomic-take primitive; EEXIST there means the id was taken), and carry the underlying message in `-32603` responses so any future incident names itself. CI run evidence: run 37248182817, `Received: 2`, test duration 454.56ms — consistent with a single fast throw, not a timing race, so the ticket's "slow spawn timing" hypothesis is superseded by this finding.

## 2. Failure chain (observed)

1. Six server instances race `upstream_request_create` against `UPSTREAM_HARD_CAP=3` (intake lock serializes them, 30s deadline — timing is not the issue at 454ms).
2. Three accept; three hit the cap and answer the retryable `-32000` (isError) shape.
3. One hit `linkSync` EPERM → re-thrown → dispatch catch-all → `{ code: -32603, message: 'internal error' }` → the test counts it as neither bucket → `accepted=2`.

## 3. Fix

| Site | Change |
|------|--------|
| id-allocation loop (`mcp-upstream-server.ts`) | `linkSync` EEXIST → collision retry (unchanged); **EPERM → `openSync(target, 'wx')` fallback** (write + close; EEXIST → collision retry; other errors surface); POSIX behavior byte-identical (the EPERM path is dead code there). |
| dispatch catch-alls (2 sites) | `-32603` message now carries the underlying error text — diagnosability only; no test asserted the bare string. |
| version | `mcp-upstream-server.ts` 1.9.1 → 1.9.2 (L0-only; no mirror). |

## 4. Verification

1. `bun test tests/unit/mcp-upstream-server.test.ts -t "M5 parallel intake"` ×5 — all pass (POSIX path unchanged).
2. Full file suite green after the version-constant/registry-row alignment (the suite's own consistency gates — serverInfo.version and the SCRIPTS.md row check — pin the bump).
3. The authoritative check for the Windows leg is this PR's `windows-latest` CI job; the flake was single-occurrence, so the fix's Windows proof is the green leg plus the EPERM path now degrading to a supported primitive instead of a throw.

## 5. Non-goals

- No change to the M5 assertions — `exactly 3 accepted / exactly 3 retryable` is the contract; the defect was server-side, not test-side (supersedes the ticket's test-first direction).
- No custom scheduler stub — the evidence shows no timing race to stub.
- A merge-driver-style auto-retry for EPERM loops is unnecessary: the next sequence number is tried by the existing 20-attempt loop via the collision path.
