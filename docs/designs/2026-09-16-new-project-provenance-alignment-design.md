---
schemaVersion: 1.0.0
spec-id: new-project-provenance-alignment
---

# New-Project Provenance Fallback Alignment — 2026-09-16

## 1. Overview

Lands ticket T-20260916-002 (residual of M11/T-20260915-011):
`scripts/new-project.ts` resolved scaffold provenance as
`--version <tag> || templates/VERSION || silent "unknown"`, while
`scripts/create-l3-scaffold.ts` v1.15.0 was already aligned to the
fail-loud policy (reads `templates/VERSION` via
`scripts/helpers/template-version.ts`, fails loud on
missing/unparseable, no silent fallback). The silent `"unknown"` tail
is removed so a project scaffold can never record fabricated
provenance.

## 2. Problem

Without `--version`, `new-project.ts` §5.5 read `templates/VERSION`
with `existsSync` + a bare `.trim()` and fell back to the string
`"unknown"` when the file was missing — and any unparseable content
flowed into provenance unvalidated. That value is written to
`docs/<variant>.context.md` (`Template-Version:`),
`.claude/template-version.txt` (`version=`, consumed by
`upgrade-project.ts` version-sync), and the context template
substitution. A scaffold from a workspace with a lost or corrupted
version SSOT therefore shipped `"unknown"`/garbage provenance that
downstream tooling then treats as a real version — exactly the
fabricated-provenance class M11 eliminated for `create-l3-scaffold.ts`.

## 3. Chosen approach

- **Shared decision helper.** New
  `resolveProvenanceVersion(explicit, rootDir)` in
  `scripts/helpers/template-version.ts` (the provenance SSOT module
  M11 introduced) pins the resolution order in one place:
  1. an explicit `--version` value wins **as-is** — it is a git tag
     lookup string (`template-v<value>`), allowlisted by the caller;
     semver validation is deliberately NOT applied to it (the
     flag-first contract is preserved), and the flag path gains no new
     `templates/VERSION` dependency;
  2. otherwise `readTemplateVersion(rootDir)` — which throws on a
     missing or unparseable `templates/VERSION`.
- **Fail loud, pre-flight.** `new-project.ts` resolves the provenance
  version right after workspace-root/managed-dir validation and
  BEFORE variant detection, tag extraction, the readiness gate, and
  any copying — so the abort happens before any scaffolding work (no
  partial project, no M13 rollback churn). The error message names
  `templates/VERSION` (via the helper's existing messages). The
  script's established `import.meta.main` guard pattern is used;
  non-main (imported) contexts rethrow rather than continue without a
  version.
- **Downstream formats unchanged.** §5.5/§5.6 keep writing
  `docs/<variant>.context.md` provenance and
  `.claude/template-version.txt` with identical field formats; only
  the value's provenance resolution changed.

## 4. Test plan

`tests/unit/provenance-version-resolution.test.ts` (new, modeled on
the M11 block in `tests/unit/scaffold-delivery-parity.test.ts`)
exercises `resolveProvenanceVersion` directly (the script body is
top-level imperative and subprocess-tested by
`scripts/test-new-project.ts`; a missing-SSOT run cannot be simulated
against the real workspace):

- explicit flag wins as-is — including non-semver tag suffixes and
  with no `templates/` dir present (no new SSOT dependency on the
  flag path);
- no flag: reads and trims the `templates/VERSION` SSOT from a
  synthetic root;
- no flag + missing SSOT: throws, message naming `templates/VERSION`
  and "cannot record scaffold provenance" (never `"unknown"`);
- no flag + unparseable SSOT (`unknown`): throws the
  `valid x.y.z version` error;
- `TEMPLATE_VERSION_RELPATH` stays `templates/VERSION`.

Battery: `bun run test:unit`, `bun scripts/validate-templates.ts`
(0 errors), `bun scripts/typecheck.ts` (delta 0), `bun scripts/audit.ts`
(PASS), `bun scripts/lifecycle-sync-audit.ts` (0 errors),
`bun scripts/review-baseline.ts` (6/6).

## 5. Version bumps (minor — behavior change)

| File | Version | Surfaces |
|------|---------|----------|
| `scripts/new-project.ts` | 1.19.0 → 1.20.0 | `@version` + header changelog; L0 + L1 SCRIPTS.md rows (hand-maintained; script itself is L0-only, layer column `L0`) |
| `scripts/helpers/template-version.ts` | 1.0.0 → 1.1.0 | `@version` + header changelog; L0 SCRIPTS.md row (helper is L0-only — no L1 row exists) |
| `tests/unit/provenance-version-resolution.test.ts` | new 1.0.0 | unit suite (auto-discovered) |
| `tests/unit/lifecycle-sync-checks.test.ts` | 1.1.0 → 1.2.0 | pinned new-project lifecycle-record version 1.19.0 → 1.20.0 |
| `docs/lifecycle/scripts/new-project.md` | record 1.19.0 → 1.20.0 | lifecycle record (Check H parity); `docs/VERSION_MANIFEST.md` regenerated |

Grep confirmed no callers/tests consume the removed `"unknown"`
fallback: the only remaining `unknown` hits in `scripts/` are
unrelated TypeScript `unknown` types and platform-detection sentinels;
the E2E harness (`scripts/test-new-project.ts` Test 12) asserts
`version=` field presence only, and `upgrade-project.ts` consumes the
written `version=` value without an `"unknown"` expectation.

## 6. Accessibility

Backend/CLI-only work (a scaffold script's provenance resolution, a
shared helper, and unit tests). No user-facing UI is produced. Exempt
from ADR-0065 WCAG scope; the WCAG 2.1 AA baseline does not apply.

## 7. Preview Verification

Non-UI work — no rendered surface exists to screenshot. Exempt from
ADR-0070 preview verification; verification is via the executed
validation battery (unit suite, validate-templates, typecheck, audit,
lifecycle-sync-audit, review-baseline).
