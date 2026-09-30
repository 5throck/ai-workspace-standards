# Evidence Ledger

Base format per the `evidence-ledger` skill (five columns, append-vs-supersede).
Row IDs (`EV-YYYYMMDD-NN`) are stable — decision records cite them via `evidence_refs[]`.

| ID | Claim | Source | url/ref | Verification | Status |
|----|-------|--------|---------|--------------|--------|
| EV-20260825-001 | A workspace-root `.env.sample` is a stray file under the rootAllowlist policy and blocks commit | Pre-commit lifecycle gate (audit.ts stray-file check) | docs/decisions/DEC-20260825-01.md | Reproduced: dev-sync FAILed with the stray-file message before removal and passed after; ruling recorded as DEC-20260825-01 | VERIFIED |
| EV-20260825-002 | Direct `git commit` is restricted to the /sync pathway; `--no-verify` is forbidden | TS pre-commit hook denial output on the samm-maturity commit attempt | docs/decisions/DEC-20260825-02.md | Reproduced live in session; routed through dev-sync → PR #651 (merged) | VERIFIED |
| EV-20260825-003 | Exact-token consumes inference reached precision 1/1 on this workspace's procedure corpus | co-newbiz multi-element graph v0.4.0 derivation; greenfield-dd schema steps 1–4 | Projects/co-newbiz PR #137; kill-criteria `dd_finding_with_value_impact_not_in_valuation_bridge` | The single inferred edge (greenfield-dd#4 ← dd_finding) is independently encoded as an enforcement predicate by the registry | VERIFIED |
| EV-20260825-004 | The three "unknown" co-newbiz step agents are registered HUMAN roles, not missing agents | `procedures/_human-roles.yaml` (ADR-0053, boundary #2) | Projects/co-newbiz `graph-map.ts --check` output | Gate pins exactly 4 human-authority steps; unit suite skill-graph.test.ts 18/18 after projection v0.2.0 adopted the same registry | VERIFIED |
| EV-20260930-001 | co-newbiz fixed three validator gaps (agent-lifecycle-audit 1.4.0, verify-scripts 1.10.0, validate-templates 1.50.2) that L0/L1 still carry | co-newbiz project review 2026-09-30 remediation commit | Projects/co-newbiz commit a66f2446 | Commit exists on co-newbiz review branch; subject "fix(review): project review 2026-09-30 remediations - validator gaps, agent frontmatter"; port scope recorded in docs/designs/2026-09-30-validator-gap-port-design.md | VERIFIED |
| EV-20260930-002 | Check 11 (stale agent last_updated) in the L0 agent-lifecycle-audit flags agents whose only newer commits are template-sync commits | L0 validator source | scripts/agent-lifecycle-audit.ts | Check 11 compares last commit date to last_updated with no filter on sync-only commits; ruling recorded as DEC-20260930-01 | VERIFIED |
