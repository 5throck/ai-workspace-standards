# ssrf.ts Script Lifecycle

## Metadata

- **Script**: ssrf (scripts/lib/ssrf.ts)
- **Status**: active
- **Version**: 1.1.1
- **Owner**: automation-engineer
- **Last Updated**: 2026-10-31
- **Note**: per-script records are optional (SCRIPTS.md is the script lifecycle SSOT per docs/constitution/06.5-script-lifecycle.md); this record is maintained best-effort — created 2026-10-31 with the current entry; full version detail lives in the SCRIPTS.md registry row.

## Created

2026-10-31

## Description

SSRF protection library: URL validation with pre-resolve + blocked-CIDR checks, DNS-pinned connection (fetchPinned) closing the TOCTOU DNS rebinding window, and safeFetch as the validate-then-pin entry point. L0+L1 delivered. SSOT: `scripts/SCRIPTS.md` registry row (`lib/ssrf.ts`).

## Phase History

| Date | From | To | Change | Actor |
|------|------|----|--------|-------|
| 2026-10-31 | production | production | v1.1.0 → v1.1.1 (spec docs/designs/2026-10-31-template-security-hardening-design.md R2.3, U-20261031-003): BLOCKED_CIDRS corrections — the current-network entry ends at 0x00ffffffn (0.0.0.0/8; was 0x0fffffffn) and the private-10 entry ends at 0x0affffffn (10.0.0.0/8; was 0x0fffffffn). The old shared end over-blocked public 1.x–15.x addresses (8.8.8.8 was refused as current-network; 11.0.0.0–15.255.255.255 as private-10) — a fail-closed availability bug. Strictly widens availability for public IPs only; private/loopback/metadata coverage unchanged. isBlockedIp exported for pin tests (tests/unit/ssrf-safe-fetch.test.ts). | automation-engineer |
