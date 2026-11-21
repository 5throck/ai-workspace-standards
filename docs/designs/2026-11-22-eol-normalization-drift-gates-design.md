# EOL-Normalized Comparison in Generated-Projection Drift Gates

- **Date**: 2026-11-22
- **Status**: implemented
- **Source**: U-20261121-002 (upstream request from co-newbiz)
- **Tier**: L0 scripts + L1 template `.gitattributes`

## Problem

A generated-projection drift gate must report *content* drift, not *checkout*
drift. Two workspace gates compared a projection built from LF-joined strings
against a file read with its on-disk line endings, so a Windows working copy
(`core.autocrlf=true`) reported drift on an unchanged repository:

| Gate | Defect | Measured |
|---|---|---|
| `scripts/generate-scripts-mirror.ts` | `extractRegistrySpan` kept the raw `\r` while `synthesizeMirrorRow` emits LF-only rows | both files CRLF → `actual !== expected` (probe: `both CRLF: equal=false`) |
| `scripts/sync-agent-mirrors.ts` | SSOT body embedded verbatim (`\r\n`) into a mirror whose frontmatter is `"\n"`-joined → mixed-EOL projection, compared byte-exactly to the CRLF mirror on disk | every agent `differing` on a CRLF checkout |
| `templates/common/.gitattributes` | `*.yaml` / `*.yml` / `*.ts` / `*.tsx` were absent from the `eol=lf` set, so `* text=auto` smudged the sources in the first place | co-newbiz observed 283 git-clean CRLF sources |

The workspace root `.gitattributes` already enforced `eol=lf` for those
extensions, which is why the defects stayed latent at L0 while a delivered
project hit them.

## Decision

1. **Normalize at the boundary.** `scripts/generate-scripts-mirror.ts` applies
   `normalizeLineEndings()` (the canonical helper in `scripts/lib/encoding-utils.ts`)
   inside `extractRegistrySpan` and `parseRegistryTable`, so both the extracted
   span and the parsed rows are EOL-free before any comparison or re-emission.
   `scripts/sync-agent-mirrors.ts` normalizes the SSOT read and the composed
   stub body, and normalizes the on-disk mirror before comparison.
2. **Close the source of the smudge at L1.** `templates/common/.gitattributes`
   now declares `eol=lf` for `*.yaml`, `*.yml`, `*.ts`, `*.tsx`, `*.jsx`,
   `*.toml` and `*.mjs`, matching the workspace root. The attribute fix is the
   root cause for delivered projects; the script fixes make the gates
   independent of checkout EOL either way.
3. **No change to `scripts/lib/generator-manifest.ts`.** It is a runner, not a
   comparator: it spawns a project's declared generator and stages its outputs,
   so an EOL-unsanitized comparison lives entirely in the child generator.

## Verification

- `tests/unit/generate-scripts-mirror.test.ts`: two new cases assert a CRLF
  content string yields the same span as LF, and that a CRLF root registry plus
  a CRLF mirror report no drift.
- `tests/unit/sync-agent-mirrors.test.ts`: the previous "body bytes preserved
  verbatim" pin was replaced with "body normalized to LF, and a CRLF-checked-out
  mirror still reports parity" — a deliberate contract change, recorded here.
- Live-tree checks: `bun scripts/generate-scripts-mirror.ts --check` green;
  `bun scripts/lifecycle-sync-audit.ts` green.
- A/B probes over the pure builders: pre-fix `both CRLF: equal=false`,
  post-fix `equal=true` for all four LF/CRLF permutations.

## Consequences

- A CRLF checkout no longer produces false drift; a real content edit still
  fails both gates (verified by hand on the co-newbiz twin).
- The agent mirror is now written with LF endings regardless of the SSOT
  checkout, so `git status` on Windows stays clean after a sync run.
