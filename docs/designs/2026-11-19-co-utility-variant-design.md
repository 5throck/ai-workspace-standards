# co-utility variant landing + i18n-audit Runtime Loader Sync + co-deck src-layout adapter — design

- **Spec ID**: 2026-11-19-co-utility-variant-design
- **Status**: Implemented (2026-11-19)
- **Date**: 2026-11-19
- **Scope**: L0 (variant-type-registry, promotion-policy, template-utils, propagation-map) · L2 (templates/co-utility, templates/common/skills/i18n-audit, templates/co-deck adapter)

## 1. Problem

QuickDL (the founding utility engagement, 5throck/QuickDL PR #48) restructured to a src/
layout, migrated graft→trail, and consolidated to a lean domain roster. Its doctrine —
multi-interface utility apps, runtime-output isolation, locale-matrix i18n, external-input
security audits — is reusable for future utility/tool projects, but no variant carries it.
Two follow-on gaps: the common i18n-audit skill had no runtime-loader-sync check
(QuickDL's i18n.py SUPPORTED↔locales check was project-local), and the co-deck QuickDL
adapter's selftest pinned the root cli.py path, which the src/ restructure invalidates for
future pin moves.

## 2. Decisions

1. **New beta variant `templates/co-utility`** (variant_type `utility`, registered in
   variant-type-registry 1.3.0 with canonicalExtensionSource; promotion-policy 1.4.0
   mirrors learning's maturity-only posture). Roster: pm, backend, frontend, qa, security
   + common i18n-specialist extends-stub. Variant-exclusive skill post-write-check
   (5-copy platform parity). Doctrine doc docs/co-utility.context.md carries the five
   specialization areas; COMMON-CONTEXT + HERMES-bootstrap marker zones wired;
   designLint disabled (token-free vanilla CSS is the variant posture). Deliberately
   omits the design-system/procedure doc set QuickDL tombstoned.
2. **i18n-audit 1.0.1 → 1.0.2**: new "Runtime Loader Sync" step generalizing QuickDL's
   runtime supported-locale registry ↔ locale-directory check. common-contract version
   rows bumped; 5 platform mirrors synced byte-identically.
3. **co-deck download-videos.ts 1.1.0 → 1.2.0**: resolve/selftest/CLI accept BOTH layouts
   (root cli.py = pin v1.0.x; src/cli.py = v1.1.0+). Current pin v1.0.1 clones unaffected.
4. **Registrations**: propagation-map.json governance-agents / variant-context /
   hermes-bootstrap targets (L0 + L1), common.lifecycle.json propagatedTo, 6 WS-12 index
   READMEs, DEFAULT_PM_ROLE_DESCRIPTIONS["co-utility"], template-utils 1.4.0, CHANGELOG.

## 3. Verification

- validate-variant-readiness --variant co-utility: READY
- validate-templates --variant co-utility: 0 errors
- end-to-end new-project --variant co-utility scaffold: audit exit 0 (scaffold removed)
- workspace audit.ts: all checks passed; workspace pytest n/a (no test tree touched)
- co-deck adapter selftest against the src/-layout QuickDL clone: OK
