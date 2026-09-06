---
name: token-usage-lint
description: >
  Lint procedure that scans project UI code for hardcoded design values (raw hex colors,
  rgb()/hsl() literals, raw px spacing) that bypass the tokens.json SSOT. Use when:
  reviewing generated UI code, auditing for hardcoded design values, or checking design
  token compliance in playground demos and handoff artifacts.
version: 1.1.0
scope: common
status: active
owner: pm
last_reviewed: 2026-09-06
prerequisites: none
relates_to:
  - skill: ui-ux-design-intelligence
    type: follows
metadata:
  type: review
  triggers:
    - token lint
    - hardcoded color
    - design token compliance
    - raw hex values
    - hardcoded spacing
---

## Context

`tokens.json` is the single source of truth for the project's design language: colors, typography, spacing, radii, and shadows. `scripts/compile-tokens.ts` compiles it into the two consumed forms, `tokens.css` (CSS custom properties such as `--color-primary`) and `tokens.ts` (typed constants plus `CSS_VARS`). Every styled surface must consume one of those forms, never a literal value. Theme presets live in the reserved top-level `themes` key (`dark`, `high-contrast`); the compiler emits each as a `[data-theme="<name>"]` CSS block after `:root` plus a `themes` export in `tokens.ts` — consumers switch themes via the `data-theme` attribute, never by re-declaring values.

A hardcoded palette hex (e.g. a raw `#rrggbb` value) or `padding: 12px` in a demo or prototype file forks the design language silently: it renders correctly today, but the next palette change in `tokens.json` never reaches it. This skill is the detection half of that contract. Reference implementation: the co-design variant (`templates/co-design/tokens.json` + `scripts/design-lint.ts`), whose playground binds demo authoring to it ("hardcoded hex/px values defeat the SSOT").

Decision record: closes the backlog Low row "No token-usage lint (detecting hardcoded colors/spacing that bypass the SSOT)" in `docs/variant-benchmark-backlog.md` §3, closed 2026-08-25.

## When to Use

- After generating or editing playground code (`playground/src/main.ts`, `playground/src/style.css`, `playground/src/demos/`)
- Before handing off prototype code or interaction specifications to development
- When auditing any scaffolded project for token compliance
- Trigger phrases: "token lint", "hardcoded color", "design token compliance", "raw hex values", "hardcoded spacing"

## Exempt Paths

The scan must exclude paths that legitimately contain raw values:

| Path | Why it is exempt |
|------|------------------|
| `**/src/generated/` | Compiler output (`tokens.css`, `tokens.ts` are regenerated here) |
| `tokens.json` | The SSOT itself; raw values are its content |
| Standalone `tokens.ts` / `tokens.css` | Compiler outputs wherever `--output-ts` / `--output-css` point |
| `**/node_modules/` | Third-party code, not ours to lint |
| `**/dist/` | Build output, regenerated |

## Execution Steps

**Preferred (v1.1.0)**: run the runnable companion script, which implements the
same detection rules, exempt paths, and classification scheme and exits non-zero
on should-be-token findings (audit-integrable):

```bash
bun scripts/design-lint.ts                # default roots: ./playground/src ./src
bun scripts/design-lint.ts --dir <path>   # explicit scan root (repeatable)
```

Inline suppression for documented one-offs: append `design-token-exempt: <reason>`
on the same line as the literal.

The manual grep procedure below remains valid as the fallback when the script is
unavailable. Run from the project root (the template playground or a scaffolded project). Both shells report `file:line:match`.

### Step 1: Scan for raw hex colors

Git Bash:

```bash
grep -rInE --include='*.css' --include='*.ts' --include='*.tsx' --include='*.js' --include='*.html' \
  --exclude-dir=generated --exclude-dir=node_modules --exclude-dir=dist \
  --exclude='tokens.ts' --exclude='tokens.css' --exclude='tokens.json' \
  '#[0-9a-fA-F]{3,8}\b' .
```

PowerShell:

```powershell
Get-ChildItem -Recurse -Include *.css,*.ts,*.tsx,*.js,*.html |
  Where-Object { $_.FullName -notmatch '\\(generated|node_modules|dist)\\' -and $_.Name -notmatch '^tokens\.(ts|css|json)$' } |
  Select-String -Pattern '#[0-9a-fA-F]{3,8}\b'
```

### Step 2: Scan for rgb()/hsl() literals and raw px spacing

Rerun the same commands, replacing only the trailing pattern (identical in both shells):

- Color function literals: `(rgba?|hsla?)\(`
- Raw px spacing: `[0-9]+(\.[0-9]+)?px\b`

### Step 3: Verify generated outputs are current

If findings led to token changes, regenerate the compiled outputs before re-scanning:

```bash
cd playground && bun run tokens
```

`bun run tokens` wraps `bun scripts/compile-tokens.ts --input ../tokens.json --output-css src/generated/tokens.css --output-ts src/generated/tokens.ts`; add `--check` to the underlying script call to verify without writing.

## Output Format

Findings are reported as a classification table (one row per hit) followed by a summary line:

```text
| file:line                  | match              | classification      | action                          |
|----------------------------|--------------------|---------------------|---------------------------------|
| src/demos/hero.tsx:14      | (raw palette hex)  | should-be-token     | -> color.primary via CSS_VARS   |
| src/demos/chart.ts:31      | #7b3fe4            | one-off (documented)| keep; rationale comment added   |
| src/main.ts:8              | href="#dec"        | false positive      | none                            |

token-usage-lint: 3 findings (1 should-be-token, 1 one-off, 1 false positive) - NEEDS REMEDIATION
```

The summary reads `CLEAN` when no hits remain or every remaining hit is a documented one-off; otherwise `NEEDS REMEDIATION` with the should-be-token count.

## Reviewing Findings

Classify every hit before acting on it.

**False positive (leave as is):**
- URL fragments and anchor ids caught by the hex regex (`href="#dec"`), hex-like strings in comments, and hex-looking codes in non-styling logic

**Legitimate one-off (document, leave in place):**
- Data-visualization palette extensions where a chart needs more stops than `tokens.json` defines; record the rationale in a comment next to the value
- Third-party integration overrides that require raw values by contract

**Should-be-token (remediate):**
- Any color, spacing, radius, or shadow that mirrors an existing token or will recur across components
- Hex/px values inside a `var()` fallback, for example `var(--color-text, <fallback>)`: the fallback duplicates the SSOT value and drifts silently on the next recompile. In the playground `tokens.css` is always loaded, so drop the fallback; keep fallbacks only in stylesheets consumed outside the compiled-token bundle, and document each one

Remediation for should-be-token findings:

1. Propose the token addition in `tokens.json` under the correct group (`color`, `typography`, `spacing`, `borderRadius`, `shadow`); theme-preset additions go under the reserved `themes` key and may override `color`/`shadow` only — layout tokens are theme-invariant ([DESIGN-R2])
2. visual-designer reviews and approves the addition (see Escalation)
3. Recompile with `bun run tokens` from `playground/` (or `bun scripts/compile-tokens.ts` with explicit `--input`, `--output-css`, `--output-ts` flags)
4. Replace the literal with the `CSS_VARS` entry (TS/TSX) or the `var(--...)` custom property (CSS/HTML)
5. Re-run Steps 1 and 2 until the scan is clean or every remaining hit is a documented one-off

## Escalation

The project's token-palette owner (the visual-designer agent where the role exists, otherwise the project design owner) approves additions or changes to `tokens.json`; never edit it unilaterally to make a lint hit go away. If a hardcoded value looks intentional but undocumented, ask the palette owner to classify it before dismissing the finding.

## Related Skills

- **ui-ux-design-intelligence**: designs the token system this lint enforces
- **accessibility-audit**: validates contrast after any palette change that remediation triggers
