# Meeting Transcript — Team Gateway Evolution (2026-09-27)

- **Facilitator**: PM
- **Participants**: Template Architect, Automation Engineer, Security & Git Expert, Consistency Auditor (red-team seat)
- **Rounds**: 2 + synthesis
- **Evidence base**: live-verified gateway state as of 2026-09-27 (#1122–#1132 merged) — 8 stable variants cataloged, wire surfaces for OpenAI/Anthropic/Gemini, runtimes hermes + antigravity, Phase 2 hardening (auth/quotas/toolsets/docker isolation) landed in #1125/#1126.

## Agenda

1. Beta variants in the catalog
2. OpenAI SDK client coverage
3. Claude Code / Codex CLI as session runtimes
4. Direct-LLM-calling architecture vs CLI-runtime architecture
5. Provider-neutral principle (OpenAI + Anthropic + Google)

---

## Round 1

### Template Architect

- **(1) Beta**: `resolveVariants` filters `status: stable` by design — betas are opt-in via explicit lists. Proposal: keep the filter but add `TEAM_GATEWAY_VARIANTS_INCLUDE_BETA=true` (compose: beta tagged in the catalog). Better than removing the filter: beta means "unpromoted lifecycle", and cataloging it silently would mislead clients about maturity. The models payload should carry a `status` metadata field (OpenAI wire tolerates extra fields) so clients can render maturity.
- **(3) Runtimes**: Claude Code headless (`claude -p --output-format stream-json --resume <session-id>`) and Codex CLI (`codex exec --json`) both exist and stream NDJSON. The runtime adapter interface (proven by hermes + antigravity) extends naturally: argv builder + event normalizer + continuity handle. Claude Code's session resume is by session-id (like our hermes named threads); Codex has `codex exec` resume semantics that need live probing.
- **(4) Direct-LLM**: the variant's value is NOT its persona text — it is the executable harness (PM dispatch, skills that run scripts, subagent fan-out, file deliverables in the tenant workspace). A direct call reduces a variant to a persona prompt. Direct mode is still valuable as a tier, not a replacement.
- **(5) Provider-neutral**: two distinct layers — (a) wire surfaces for clients (done: all three), (b) model providers behind the runtimes. Each CLI runtime brings its own provider: claude→Anthropic, codex→OpenAI, agy→Google, hermes→operator-configured. So "support all three providers" is achieved by supporting the four runtimes; a direct-LLM tier additionally needs its own provider layer with keys.

### Automation Engineer

- **(3)**: adapter cost per runtime is 1 file + ~10 unit tests (measured: antigravity.ts adapter + tests took one session; the event-normalizer pattern is established). Facts to verify per runtime before implementation: exact NDJSON event shapes (live probe, as done for agy), session-continuity flags (`claude --resume <id>`; `codex exec resume`/`--last`), per-tenant isolation story (Claude Code/codex honor cwd; credentials live in `~/.claude` / `~/.codex` — per-tenant credential isolation would follow the shared-store pattern rather than home copies).
- **(2)**: OpenAI SDK coverage today = `/v1/models`, `/v1/chat/completions` (stream + non-stream) — the SDK's core path. Gap: `tool_calls` passthrough does not exist (runtimes execute tools internally; the gateway streams text). Decision needed: document text-only as the contract, or add a `tools` parameter mapping to specific runtimes later.
- **(4)**: direct-LLM tier is mechanically trivial for the gateway (we already speak all three provider wires... for CLIENTS; the direct tier needs us to be the CLIENT: three provider SDKs/HTTP calls with API keys, no runtime). The engineering risk is prompt assembly (AGENTS.md + variant context) and history management — solvable, but it duplicates what the harness does well.

### Security & Git Expert

- **(1) Beta**: acceptable to catalog IF the maturity tag is explicit AND beta tenants inherit the same hardening (they do — isolation is per-tenant, variant-agnostic). Beta skills/scripts have weaker soak; recommend the catalog response marks them and README lists which are beta.
- **(3) Credentials**: Claude Code (`~/.claude`) and Codex (`~/.codex`) hold their own OAuth logins — same single-use-refresh-token hazard we just fixed for Nous (Addendum 4). Design rule going forward: runtimes must reference a shared credential location or the gateway re-seeds per turn; never copy token files per tenant.
- **(4/5) Direct-LLM**: gateway-held provider API keys is a NEW secret class (Phase 0 kept operator-side). Requires the secret surface design (env/file mount) before shipping; also per-tenant attribution of spend gets harder (shared key → per-key/user counters only).

### Consistency Auditor (red-team seat — dissent preserved verbatim)

- Dissent on **direct-LLM tier**: "The gateway's entire reason to exist is the variant TEAMS. A direct-LLM tier with a persona prompt is a different product wearing the same name. If we ship it, ship it as an explicitly separate catalog entry (e.g., `co-consult-lite`), never as a flag on the same model id — otherwise users cannot tell which mode answered, and trust in deliverables erodes."
- Dissent on **beta in catalog**: "Cataloging beta invites production usage of unpromoted teams. The lifecycle gate (beta → stable) exists precisely to prevent that. If business demands beta exposure, the lifecycle record should gain a `beta-exposed` annotation with a review date — not a silent catalog row."
- Challenge on **Claude Code/Codex runtimes**: "Both CLIs bring their OWN model providers and their own auth; that is provider expansion by side effect. Confirm the operator accepts that a `claude` runtime answer is generated by Anthropic models and a `codex` runtime answer by OpenAI models — the provider-neutral principle is about the gateway's CONTRACT (wires), not about the gateway choosing providers. Say this in the docs, or we promise neutrality we do not have."
- Process challenge: "Round count is fine, but every runtime addition has repeated the same three-step cost: live protocol probe, continuity design, credential model. Budget it as a pattern, not per-CLI heroics."

### PM (facilitator note)

Convergent so far: (1) beta = tagged opt-in, (2) SDK = already served, confirm text-only contract, (3) two new runtimes via the adapter pattern, (4) direct-LLM = separate lite tier with its own identity, (5) provider-neutrality = contract-level; runtime-level providers are disclosed per runtime.

## Round 2 — responses to dissent, convergence

- **Architect → Auditor**: accept the `lite` naming — separate model id `co-<variant>-lite` is cleaner than a flag; the lite tier reads the same tenant workspace (read-only Q&A over its context) so the variant is still utilized, answering the user's utilization worry partially. Full engagements (deliverables, multi-turn engagements with files) remain full-runtime.
- **Automation Engineer → Auditor**: accept the pattern budget — a RUNTIME_ADDITION checklist (probe → continuity → credentials → isolation matrix) captured in the README so each new CLI is a mechanical pass.
- **Security → all**: credential rule adopted as an invariant: "no token-file copies across homes; shared store or per-turn re-seed only" (Addendum 4 pattern generalized).
- **Auditor (closing dissent, preserved)**: "Accept `lite` as a separate id and the checklist — but if lite is ever sold as equivalent to the team experience, I will re-open this. And the provider disclosure must live in the models payload, not just prose."
- Converged: provider disclosure in the models payload (`metadata: {runtime, provider}` per model) — satisfies the auditor's demand and the provider-neutrality principle in one stroke.

---

## Synthesized Proposal (for user approval — NOT decided)

**P1. Beta variants**: `TEAM_GATEWAY_VARIANTS_INCLUDE_BETA=true` + per-model `status` metadata (`stable`/`beta`) in `/v1/models`; compose keeps `all` (now = stable + beta when the flag is on). Owner: automation-engineer. Size: S.

**P2. OpenAI SDK clients**: already served (chat completions, streaming, models). Formalize the contract: text-out only; `tools` passthrough deferred to Phase 3 unless a concrete client demands it. Owner: docs-writer. Size: S (docs only).

**P3. Claude Code + Codex CLI runtimes**: `TEAM_GATEWAY_RUNTIME=claude|codex` via the existing adapter pattern; per-runtime credential model documented (shared-store or per-turn re-seed — never copies); isolation matrix documented (container isolation: hermes-only initially). Prerequisite per runtime: live protocol probe + continuity design. Owner: automation-engineer. Size: M each.

**P4. Direct-LLM "lite" tier**: separate model ids (`co-<variant>-lite`) served by the gateway's own provider layer (OpenAI/Anthropic/Gemini API keys, provider-neutral per the principle); reads the tenant workspace context read-only (AGENTS.md + deliverables) as system context. Does NOT run skills/agents — positioned as fast Q&A over a team's knowledge. Ships only after the provider-key secret surface design. Owner: architect + automation-engineer. Size: M.

**P5. Provider disclosure**: `/v1/models` payload gains `metadata: {runtime, provider}` per model (e.g., hermes→"operator-configured", claude→"Anthropic", codex→"OpenAI", agy→"Google", lite→"per-key"). This operationalizes the provider-neutral principle: the CONTRACT is neutral; the GENERATOR is disclosed. Owner: automation-engineer. Size: S.

**P6. Runtime Addition Checklist** (pattern budget): probe → continuity → credential model → isolation matrix → provider disclosure, captured in the README as the standing procedure for any future CLI runtime. Owner: docs-writer. Size: S.

## Action Items

| # | Action | Owner | Size |
|---|---|---|---|
| 1 | P1 beta flag + status metadata | automation-engineer | S |
| 2 | P5 provider/runtime disclosure in models payload | automation-engineer | S |
| 3 | P2 SDK contract documentation | docs-writer | S |
| 4 | P6 Runtime Addition Checklist | docs-writer | S |
| 5 | P3 Claude Code runtime (probe → adapter → live) | automation-engineer | M |
| 6 | P3 Codex runtime (probe → adapter → live) | automation-engineer | M |
| 7 | P4 lite tier design (provider keys secret surface first) | architect | M |

## Disposition (2026-09-27, user review)

- **P4 (direct-LLM lite tier): REJECTED by user** — "해당 기능은 의미가 없을 듯 함". The Auditor's original dissent is ratified: a persona-prompt tier is a different product, not the team. The lite model ids (`co-<variant>-lite`) and the provider-key secret surface design are dropped from the roadmap. Full-runtime remains the single execution path for a variant team.
- P1, P2, P3, P5, P6: proposed, awaiting user go-ahead (P1+P5 as the first wave).

## Wave 3 (2026-09-27, user-requested additions — proposed)

- **P7. User-named projects (S)**: `POST /sessions` accepts `name` (sanitized `[a-z0-9-]`, uniqueness-suffixed); the scaffold uses it instead of the internal `gw-<id>`. OpenAI wire keeps internal ids (no name field in the wire — documented).
- **P8. Provisioning progress visibility (S)**: (a) SSE comment lines (`: provisioning co-work team…`) streamed during lazy provisioning so Open WebUI shows progress without breaking the wire; (b) tenant record gains a `progress` field (scaffolding → relocating → seeding → ready) surfaced via `/tenants/:id`; (c) demo page polls and renders it.
- **P9. Multi-user, per-user variants (M)**: per-(variant, user) tenant separation already works; adds (1) key-file format `key:label` → label = trusted principal (replaces spoofable `user`), (2) `GET /tenants?mine` filtered by the authenticated principal, (3) optional per-USER quota rollup across their tenants, (4) demo page user input.
- Order: P8 → P7 → P9.

## Open Points (explicitly unresolved)

- Which client (if any) requires `tools` passthrough on the OpenAI wire.
- Whether upstream will publish a hermes image whose auth resolution matches host behavior (affects container credential path).
- Lite-tier pricing/attribution when provider keys are gateway-held.
