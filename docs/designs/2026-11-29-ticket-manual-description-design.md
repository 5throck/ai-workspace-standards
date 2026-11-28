# Design: First-class description field for manual ticket creation

- **Spec ID**: `2026-11-29-ticket-manual-description`
- **Date**: 2026-11-29
- **Author**: Automation Engineer + Architect (Design Gate Row 0, draft)
- **Status**: approved (owner confirmation 2026-11-29; Q1 cap 2000, Q2 show-only rendering, Q3 upstream allowed — recorded in DEC-20261129-002)
- **Tickets**: T-20261129-013 (filed this session)
- **Related**: `docs/designs/2026-08-16-governance-backlog-design.md` (manual-kind governance tickets), `docs/designs/2026-10-01-upstream-request-mcp-design.md` §5 (upstream block on kind: manual — adjacent surface, unchanged), AGENTS.md §3.7.5 (L0-only scope of `tickets/` + `scripts/ticket.ts`)

2026-11-29 amendment: approved by the owner on 2026-11-29 (status line updated to `approved`; ruling recorded in DEC-20261129-002). Implementation follows immediately in the same train (branch `feat/ticket-manual-description`, change table §4 as written). The three open questions (§10) resolve to the recommended options: Q1 the length cap is 2000 chars (aligned with the upstream prose-field caps, not `blocked_reason`'s 500), Q2 rendering is show-only — `list` stays a one-line summary with no description column, Q3 `description` is allowed on upstream tickets (kind: manual) with no new invariant — `upstream.symptom` remains the canonical symptom surface.

## 0. Conclusion

The manual-create path of the ticket CLI has no way to carry multi-paragraph context: the schema, the store input type, and the CLI flag set all lack a description field, so authors stuff whole disclosures into `title`. Ruling: add a first-class, optional `description?: string` to manual ticket creation via a `--description "<text>"` CLI flag, persisted as a top-level yaml field and rendered by `ticket.ts show` when present. Reusing the service path's `--inputs '{"description": ...}'` shape for manual is rejected: it collides with the "manual tickets carry no inputs" boundary (ticket-store.ts:389-391; upstream invariant at ticket-schema.ts:508) and `show` renders no `inputs` surface today, so Option B would need a new rendering surface anyway — it is not the smaller change. The change is L0-only; no template propagation.

## 1. Problem (verified evidence)

### 1.1 Manual create cannot express a description

Code path, all read this session:

- `scripts/ticket.ts:321-338` — the manual branch accepts only `title` (one positional), `--priority`, `--priority-alias`, `--not-before`, `--hub`, `--allow-duplicate`. The usage string at line 325 lists no description flag. The store call at lines 331-335 passes `{ kind: "manual", title, priority, not_before, hub }` — nothing else.
- `scripts/helpers/ticket-store.ts:342-352` — `CreateTicketInput` is `{ kind, service?, title?, inputs?, priority, not_before?, hub? }`. No `description`.
- `scripts/helpers/ticket-schema.ts:184-215` — the `Ticket` interface has no `description` field. The only `description?: string` in the schema file (line 117) belongs to `ServiceDef` — the service *catalog* entry, a different type. A description simply cannot be typed on a ticket.
- `scripts/helpers/ticket-store.ts:453-469` — `createTicketUnlocked` builds the ticket as an explicit field-by-field object literal, then `validateTicket`s and atomically writes it. A new field must be added to this literal or it is silently never persisted.

The service path, by contrast, carries multi-paragraph content as `--inputs '{"description": ...}'` (`scripts/ticket.ts:339-362`), persisted as the `inputs` map in the ticket yaml.

### 1.2 Live symptom: title stuffing, and a blind `show`

- `tickets/governance/T-20261124-014.yaml` — `title:` is a yaml `>-` folded block containing a full multi-sentence disclosure (billing forensics, twelve repositories, action required). The title field is doing description duty because it must.
- Today's T-20261129-001 had to be filed through the *service* path purely to obtain a description field.
- Live repro this session: `bun scripts/ticket.ts show T-20261129-013` prints `Title:` and nothing else — and `show` never renders `inputs` for service tickets either (`scripts/ticket.ts:476-486` prints id/status/kind/priority/sev/blocked/hub/service-or-title/not_before/upstream only).
- Meta-fact: this defect's own ticket (T-20261129-013) had to compress its whole rationale into its title — the workaround is the bug.

## 2. Goals and non-goals

Goals: a manual ticket can carry a multi-paragraph description alongside a one-line title; `show` surfaces it; existing tickets parse unchanged; the service path is untouched.

Non-goals: changing service tickets' `inputs.description` convention (its consumers exist; do not churn a working surface); migrating already title-stuffed tickets; new upstream-block fields; MCP server changes.

## 3. Design decision

### 3.1 Option A (RULED): first-class `description?: string` via `--description "<text>"`

- `Ticket` gains `description?: string`; `CreateTicketInput` gains it; the create literal writes it; the CLI manual branch accepts it and extends the usage line; `show` renders it when present.
- Tolerance-compatible, with two exact in-house precedents: v1.10.0 `sev`/`blocked_reason` and v1.11.0 `hub` (changelog, ticket-schema.ts:13-31) — each was "optional field + validate-when-present + create-literal write + show guard", and each shipped with zero migration.
- Multi-line input works with no interactive prompt: a single shell-quoted string containing literal newlines is one argv element, and `parseFlags` (ticket.ts, `flags[key] = next` for any next element not starting with `--`) binds it. Documented caveat: a description whose first characters are `--` cannot be passed with this parser (same limitation as `--result`/`--error` today) — accepted, consistent with existing flags.

### 3.2 Option B (rejected): reuse `--inputs '{"description": ...}'` for manual

- Semantically wrong at the store boundary: the duplicate-title scanner documents "Manual tickets carry no inputs, and service tickets carry no title" as the kind-discriminating convention (`scripts/helpers/ticket-store.ts:389-391`), and `validateTicket` hard-forbids `inputs` on upstream tickets (`scripts/helpers/ticket-schema.ts:508`) — upstream tickets are kind: manual, so a manual-`--inputs` convention presses exactly on the seam the schema guards.
- Not smaller in practice: `show` renders no `inputs` today, so Option B fixes persistence but leaves the operator blind unless a new inputs-rendering surface is built — strictly more surface than one `show` line-guard (the pattern `sev`/`blocked`/`hub` already established at `scripts/ticket.ts:473-475`).
- Usability: single-quoted multi-line prose inside valid JSON inside a shell command is the most error-prone quoting in this CLI; `--description "<text>"` is plain.

### 3.3 Ruled shape details

- **Length cap**: validate-when-present as a non-empty (trimmed) string of ≤ 2000 chars — aligns with the upstream prose-field caps (`upstream.symptom` 20–2000, ticket-schema.ts:534; `upstream.repro` ≤2000, line 549) rather than `blocked_reason`'s 500 (line 413), because a description is multi-paragraph. *(Open question Q1.)*
- **Kind scope**: validated when present on any kind; only the manual CLI path writes it today. The service path keeps `inputs.description`; the two kinds become symmetric "where it matters" — both can carry multi-paragraph context, and both render prose where the operator looks (`show`).
- **Upstream interplay**: no new invariant forbidding `description` on upstream tickets (they are kind: manual); the MCP server never writes it and `upstream.symptom` remains the canonical symptom surface. *(Open question Q3.)*

## 4. Change table (file-level)

| File | Action |
|------|--------|
| `scripts/helpers/ticket-schema.ts` | Add `description?: string` to `Ticket` (after `hub`, ~line 202). In `validateTicket`, add validate-when-present: non-empty trimmed string ≤ 2000 chars (pattern: `blocked_reason`, lines 411-416). Bump `@version` to 1.13.0 with a changelog entry citing T-20261129-013. |
| `scripts/helpers/ticket-store.ts` | Add `description?: string` to `CreateTicketInput` (~line 346) and `description: input.description` to the create object literal (~line 459). Undefined keys are skipped by the yaml dump — verified on existing tickets, where absent optionals (`service`, `inputs`, `not_before`, `hub`) are omitted entirely. Bump `@version` + changelog. |
| `scripts/ticket.ts` | Manual branch (lines 321-338): accept `--description "<text>"`, pass through to `createTicket`, extend the usage line (325). `show` branch: after the Title line (~479), `if (ticket.description)` print an indented multi-line block (same style as the upstream block boundary, lines 483-486). Bump `@version` + changelog. |
| `tests/unit/ticket-store.test.ts` | New cases (see §6). |
| `tests/unit/` (schema cases) | Empty/oversized/non-string description rejection cases co-located with the existing schema-validation tests. |

`scripts/procedure-coverage.ts:211` (the other `createTicket` caller, manual) takes the field as optional — no change required.

## 5. Back-compat and guardrail alignment

- **Existing tickets unchanged**: the field is optional; absence means no yaml key and validation passes (identical tolerance argument to `sev`/`hub`). Title-stuffed tickets such as T-20261124-014 remain valid records; repairing them into title + description is an optional human hand-edit, not part of this change.
- **Store allowlist question**: there is **no strict unknown-key allowlist** in the read path — `validateTicket` (`scripts/helpers/ticket-schema.ts:389-608`) validates known fields when present and tolerates unknown keys. So adding `description` does not require extending a rejection list; what it *does* require is (a) the `Ticket` interface field (ticket-schema.ts:184-215), (b) shape validation when present, and (c) the create-literal write at ticket-store.ts:453-469 — without (c) the field can never persist regardless of typing.
- **Duplicate scan unaffected**: `findDuplicateByTitle` keys on normalized `title` (+ optional `inputs` equality on the service edge, ticket-store.ts:398-425); a description on the manual edge changes nothing.
- **Untouched surfaces**: MCP upstream server, `move`/`triage`/`reprioritize`/`resolve`, archive, `repair-history` — all pass the ticket object through or operate on validated fields; none construct new manual tickets from CLI prose.

## 6. Tests (tests/unit/, L0)

1. **Create persists**: `createTicket(dir, { kind: 'manual', title, description: 'line one\nline two', ... })` — returned object carries the field; the written yaml round-trips it through `readTicket`.
2. **Show renders**: CLI-level `show` on a description-bearing ticket prints the block (co-locate with existing CLI-invoking tests if present, else assert via store + a thin render check).
3. **Legacy tolerance**: a seed yaml without `description` (the existing `validSeedTicketYaml` shape, tests/unit/ticket-store.test.ts:22-38) still validates and lists — already the default for every existing test; add one explicit case naming the back-compat contract.
4. **Shape rejection**: empty/whitespace-only, >2000 chars, non-string — `validateTicket` fails with the field-scoped message.
5. **Service path unchanged**: service create with `inputs` only produces byte-identical yaml keys to today (no stray `description`).
6. **Upstream interplay**: an upstream ticket (kind: manual + upstream block) without `description` parses as today.

## 7. Rollout (L0-only)

`scripts/ticket.ts`, `scripts/helpers/ticket-store.ts`, and `scripts/helpers/ticket-schema.ts` are workspace-root-only (`@l2-propagate: false` on ticket-schema.ts:67; `tickets/` + `scripts/ticket.ts` are root-only per AGENTS.md §3.7.5). Tests land in `tests/unit/`. No template propagation, no variant delivery, no schema-version migration (`CURRENT_SCHEMA_VERSION` stays 1 — the field is additive-optional, same as v1.10.0/v1.11.0).

## 8. Out of scope

- Upstream U-ticket symptom fields (`upstream.symptom` etc.) — separate surface, MCP-owned.
- Kind conversion (manual ↔ service) in any direction.
- MCP server changes (`scripts/mcp-upstream-server.ts`).
- Retroactive migration of title-stuffed tickets.
- `list` rendering (one-line summaries stay one-line).

## 9. Rollback

Revert the three source-file changes. The only residue is tickets already carrying `description`: pre-change code tolerates the unknown key on read (no allowlist rejection) but drops type coverage and `show` rendering; no data migration is required in either direction. Tests revert with the branch.

## 10. Open questions for the Row 0 approval gate

1. **Q1 — cap**: 2000 chars (proposed, aligned with upstream prose caps) vs `blocked_reason`'s 500.
2. **Q2 — rendering**: show-only (proposed) vs a truncated description column in `list`.
3. **Q3 — upstream tickets**: allow `description` on upstream tickets with no new invariant (proposed, smallest change) vs forbid it where an `upstream` block exists (symptom already lives there).
