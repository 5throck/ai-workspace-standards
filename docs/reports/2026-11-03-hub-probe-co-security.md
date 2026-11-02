# Hub Probe — co-security (2026-11-03)

- **Probe**: root-side, READ-ONLY (design docs/designs/2026-11-01-hub-consolidation-design.md §3.5)
- **Verdict**: MATCH
- **Hub dir**: Projects/co-security
- **head_hash**: 23ac79763d291c6d54c719ef91e821c1100bb2505a55d66c98f07bbf1ba72866
- **Prior probed head**: none

## Observed (root-side signals)

- repo_present: true
- variant_json_parses: true
- template_version_txt: present
- hooks_integrity: match (8 files)
- tickets_store: absent

## Declared (hub state file)

- bootstrap_state: READY
- operational_state (declared): AVAILABLE
- ttl_lease: 2026-11-02T16:38:09.349Z → 2026-11-03T00:38:09.349Z
- head_hash: 23ac79763d291c6d54c719ef91e821c1100bb2505a55d66c98f07bbf1ba72866
- journal: 4 entr(ies), chain VALID

## References

- Design §3.5 (probe contract, keep-latest-4 retention, divergence → SEV ticket)
- Runbook: docs/guides/hub-operator-guide.md §Bootstrap & lifecycle
