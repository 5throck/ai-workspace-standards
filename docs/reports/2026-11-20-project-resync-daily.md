# Project Resync Daily — 2026-11-20 (unified 03:00 runner)

## STEP 0
- Stop-file: 1 stale wall record consumed (ledger preserved). Lock: stale 'unified-20261119' broken (dead pid, same host) → 'unified-20261120'.
- Checkout: root was left on pr/20261119-batch2-pra1 (HEAD == origin/main content-identical) → restored to main; foreign batch-2 WIP preserved untouched. repo-config snapshot TAKEN this run (last night's deviation resolved).
- Fleet drifts restored: co-architect/co-safety (merged-PR branches → main).

## STEP I — upgrade waves (dry-run gate)
- Clean + delivered (4): co-architect (#409, version-gated agents 1.0.2 completing T-20261119-001 — battery post-hoc 0 fails, process deviation battery-after-merge DISCLOSED), co-consult (#132, wall-exception with exit-code-verified battery), co-utility (QuickDL#49 — no-CI external spoke, workspace battery by design; pre-adoption memory record restored per step-3.88; worktree renamed earlier per user ruling), co-safety (#238, 9/9 real green + memory tombstone provenance re-repair — last night's fixes were lost in the checkout restore).
- SKIPPED (3): co-deck (#257 held OPEN — template suite 8 fails in env = T-20261119-008; battery exit-code harness blocked the merge correctly), co-newbiz (structural — T-20261120-002), co-security (active session).

## PARTIAL DELIVERY DEFECT (major finding)
The 2026-11-19 co-deck wave (T-20261119-004) delivered only PART of its adopt-template set: 20 variant-script/test files never delivered while their sibling test files did — the project copy's tests expected newer script surfaces (16 html-to-pdf fails). Root cause: adopt-template grants silently don't take on the scripts/co-deck/ variant subtree (agents/ has explicit D4 version-gating; variant-scripts swallows grants — hypothesis + manual-copy workaround in .trail/learnings/2026-11-20-adopt-template-grants-not-taking-on-variant-scripts-subtree.md). Fixed tonight by direct delivery (co-deck#257 open pending template suite; engine fix → T-20261119-009). Battery harness hardened: exit-code assertion now blocks merges (last night's pattern-miss cannot recur).

## STEP G/H
- 2d ledger: upstream U-20261119-003/004..010 + U-20261120-001 all in structured states; U-20261119-001's defect FIXED on a branch (7ca8088a5 era, main pending — corrected 2026-11-20 backfill audit: misattributed and already stale at report time; U-20261119-001 (co-newbiz archive-memory) was fixed by PR #2112, merge 05afee1e0, on main 00:48 KST, while 7ca8088a5 is U-20261119-002's adopt-project fix, merged to main 01:42 KST via PR #2113, d62ec06e2 — both before this report was written).
- 2e learning extraction: 1 landing (.trail/learnings/2026-11-20-adopt-template-grants-not-taking-on-variant-scripts-subtree.md) — includes last night's deferred learnings content.

## STEP J
- Open PRs at report time: co-deck#257 (held — battery).
- Root landing of this report + memory block: DEFERRED (root gates blocked by batch-2 WIP debts; the landing rides the next free window — superseded 2026-11-20 ~07:30 KST backfill-audit note: landed same morning via PR #2116, 639edbef1).
