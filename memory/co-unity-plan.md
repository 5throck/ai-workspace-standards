# co-unity Variant — Adaptation & Promotion Plan

**Status:** Scoping complete. All owner decisions are ruled (2026-09-01); two technical verification items remain for Phase A (§13). No implementation has started.
**Source workflow:** `D:\Game Development\.claude\` shared roster (agents + orchestration skills, its own git repo) plus the parent `CLAUDE.md` Design & Build Workflow, as bound by the `VR FTL-Like 3` ("The Long Burn") Unity/VR project.
**Target:** this repo — a new L2 variant `templates/co-unity/`, developed as an L3 draft first per the standard Phase A → B → C route.

---

## 1. Objective

Promote the gated Unity/VR game-development workflow (two decoupled tracks, human gates G0/G1/G2, process-docs-before / product-docs-after, delegated verification) into a first-class variant of this harness, and eventually migrate all game-dev projects under `D:\workspace` onto it. The workflow's core stance already matches the harness's: the L2 Design Gate exemption ("L2 variant projects are exempt — they manage their own design workflow") makes the G-gate scheme legal as-is, and the promotion-hold principle ("Green readiness checks are not an approval") is the same sentence as the workflow's "Preflight PASS is not acceptance."

## 2. Locked rulings (owner, 2026-09-01)

1. **Version control: Plastic SCM.** co-unity deliberately deviates from every other variant by binding Unity Version Control (Plastic, `cm.exe` from WSL) instead of git. Consequences in §5.
2. **Consumption model: copy-fork.** The harness default is accepted: projects get a physical copy at scaffold time; updates flow only through `upgrade-project.ts` (LOCKED/MERGE/PRESERVE tiers). Roster fixes become template releases.
3. **Orchestration: PM/code-writer dispatch — and the PM IS the main thread.** The `pm.md` persona rides the interactive session; it is not a subagent. Only write-authorship moves: `architect` authors plans and design docs, `code-writer` writes and fixes code. Judgment, dedup, gate presentation, human rulings, and the Plastic merge ceremony stay on the main thread as PM. Superseded source-workflow rules: "never spawn an agent to write the plan," fix-on-main-thread. Surviving verbatim: "judgment and the human gates" belong to the main thread.
4. **Agents: tool-agnostic personas.** The variant ships `agents/*.md` personas only — no `.claude/agents/` in the template. Each project re-derives tool-native agents (e.g. Claude Code agents with tool restrictions) at scaffold time. Personas carry declarative `access: read-only | write` frontmatter plus intended-tool notes so the derivation can re-enforce restrictions mechanically.
5. **Ceremony overhead: accepted.** Bilingual docs (README_ko, user-guide_ko), platform skill mirrors (with liberal `platform_parity: skip`), per-agent lifecycle governance records, PROMOTION_CHECKLIST — all in scope, traded for stability and consistency.

**Secondary rulings (owner, 2026-09-01):**

6. **Board: retired into `memory/` conventions.** No separate board file; PM bookkeeping stays entirely inside its permitted write scope.
7. **Process-doc root: harness-style `docs/`.** The two-track taxonomy is kept at `docs/design/<topic>.md` and `docs/features/<feature>/{requirements,architecture}.md`; the `raw/` name does not carry over.
8. **Current scope: harness work only.** Building and promoting the variant is the whole of the present effort. Onboarding any real project — including a pilot — is project-migration work and is deferred. Validation during Phases B/C uses fresh throwaway scaffolds, which stay inside harness scope.
9. **The intent/as-built doc split is a permanent workflow concept, and the as-built area is named the codex.** Design docs capture intent (immutable once locked); the **codex** is what a teammate reads to understand the game's codebase and systems as built, written only after acceptance. A wiki is one per-project *binding* of the codex, not the concept's name. Variant default convention: `docs/codex/`.

## 3. Variant identity

- **Name: `co-unity`.** A stable `co-game` variant already exists (HTML5 Canvas / Vanilla TS) — the name is taken. The two name validators contradict each other (`^co-[a-z][a-z0-9-]{1,30}$` in the L3→variant pipeline vs `^co-[a-z]+$` in `docs/templates/variant.schema.json`), so the name must be hyphen-free to pass both.
- **`variant_type: "game"`** — reuses the registered type; no edit to `scripts/helpers/registries/variant-type-registry.ts` needed.
- `variant.json` starts with `promotionHold: { hold: true }` and keeps it until the owner approves promotion in plain language.

## 4. Base and borrowings

- **Fork `templates/co-develop`** (leanest template, 69 files) for the workflow skeleton: 7-phase frame with a hard user-approval design gate, `pm.md` as a pure-`extends` stub, the procedures layer, `handoff-spec.md` JSON agent-handoff contract, benchmark-fixtures pattern.
- **Borrow precedent (not content) from `templates/co-game`:** variant scripts in `scripts/co-unity/`, shipped convention docs, sample project scaffolds.
- **Distill the codex default schema from The Long Burn's wiki schema** (`VR FTL-Like 3/The Long Burn Wiki/CLAUDE.md`) — its generic core ships as a variant asset (a `CODEX.md` schema template): the self-maintained schema-file pattern ("co-evolve this schema"), the `status:` trust signal (`stable` = verified against current code / `draft` = mixes built with intent / `stub` / `needs-review` = suspected drift), the "code is a live source" drift rules ("the codebase, not a codex page, is the source of truth for what the code does; the codex records how it's organized and why"), the Ingest/Query/Lint operations triad (ingest post-G2 only; lint catches **layer violations** — design content in the codex, or pages written pre-acceptance), the five golden rules (never invent, always cite, flag contradictions, same-pass bookkeeping, co-evolve), the division of labor (human curates and reads; the LLM writes every page), the page-type template set (system/concept/entity/decision/source-summary), the default domain taxonomy (`code/art/narrative/audio/production`, `vr-ux` optional), and the "design is not a codex domain" boundary. Left behind as per-project binding: Obsidian mechanics (wikilinks, embeds, graph groups, no-hard-wrap), concrete paths and project names, the `raw/` naming, the VC section.

## 5. The Plastic deviation — consequences

**Drops (git-shaped, no Plastic analogue):**

- `review-pr` skill (source roster) — salvage two ideas into the review procedure: depth-by-lane profiles (slim/full) and the materiality floor ("wrong vs. could-be-better, never big vs. small").
- `swe-solve`, `finishing-a-development-branch` (co-develop skills).
- `.githooks/` battery, GitHub Actions CI, gitleaks, Conventional-Commits `commit-msg` enforcement — all inert without git. Pre-commit-grade enforcement moves into the `vc-checkin` ceremony, which already verifies before checkin.

**Survives unchanged:** the Claude-side hooks in `.claude/settings.json` (SessionStart, PostToolUse lifecycle check, TaskCompleted → `audit.ts`) — they do not need git.

**Ports as-is, now first-class variant IP (previously flagged as debt):** the `vc-checkin` persona with its full Plastic/Unity/WSL bug catalogue, `merge-ceremony.md` (main-thread/PM-run, human hand-off when the Windows GUI Mergetool appears), `gate-preflight`'s `cm.exe` checks and `.meta`-completeness item, the `PIT` (C#/Unity pitfalls) review angle.

**Open verification items (Phase A, before anything depends on them):**

- `create-l3-scaffold.ts` / `new-project.ts` do `git init` + hooks-path setup. Determine whether the variant overlay can exclude the git machinery; otherwise ship a `scripts/co-unity/` post-scaffold step that strips it and registers the Plastic workspace instead.
- Confirm `upgrade-project.ts` runs cleanly on a git-less project tree.

## 6. Agent roster plan

All entries become `agents/*.md` personas (harness frontmatter: `phases`, `handoff_to/from`, `lifecycle:` block, 4-platform `tier` object) plus the ruling-4 `access:` field.

| Persona | Source | Access | Disposition |
|---|---|---|---|
| `pm` | co-develop (extends stub, 7 lines) | per §3.1.1 + carve-out | Adopt. G1/G2 hard-stop language moves into the AGENTS.md `VARIANT-PHASE-GATE` section (§9). |
| `architect` | co-develop, absorbing source main-thread roles | write (docs) | Adopt. Owns design docs, requirements, architecture docs, and the persisted phase plan. Owns the three rewritten doc-authoring skills (§7). |
| `code-writer` | co-develop | write (code) | Adopt, with Unity guardrails: `.meta` discipline on new assets/folders, `scratch/` call-site-audit rule on public-member changes, asmdef awareness, no VC commands. |
| `test-runner` | **merge**: co-develop name, `compile-check` body | read-only + run | The one true overlap. Keeps compile-check's contract: binding lookup order (`verification-bindings.md` → project context), "never invent a build command," honesty rules on ambiguous output, environment-quirk attribution, dated baselines. |
| `code-mapper` | source roster | read-only | Keep. Pre-plan/pre-review code recon; verified line refs; negative results are findings. |
| `doc-extractor` | source roster | read-only | Keep. Verbatim process-doc extraction with `NOT ANSWERED IN DOCS` discipline. |
| `plan-validator` | source roster | read-only | Keep. Audits the architect's persisted plan against canon — the artifact-vs-canon independence gets stronger under PM dispatch. |
| `review-angle` | source roster | read-only | Keep. Executes one named angle against the shared brief; angle roster and brief template travel with the review skill (§7). |
| `finding-verifier` | source roster | read-only | Keep. Adversarial verify of exactly one finding; `CONFIRMED / REFUTED / CONFIRMED-AS-CLARITY`. |
| `gate-preflight` | source roster | read-only | Keep, Plastic content intact (workspace clean, tests claimed-vs-run, arch doc reconciled, board/bookkeeping current, `.meta` completeness). "The gate ruling belongs to the human" closing line is mandatory. |
| `vc-checkin` | source roster | commits only | Keep as-is. The entire Plastic ceremony: status → categorize → re-register → add → checkin → verify; board/bookkeeping commit always a separate changeset; comment-length and directory-checkin traps documented. |
| `codex-reconcile` | source roster `wiki-reconcile`, generalized | write (codex only) | Keep as a **core** persona (ruling 9): reconciles the codex after G2, verify-then-write against live code ("code is the primary truth"). The codex's structure binds per project — a schema-bearing wiki (The Long Burn) is one binding, a plain `docs/codex/` tree is the default. Its license-to-write ("caller must state the human explicitly ruled G2, and when") becomes a procedure `precondition`. |
| `vr-ux-designer` | co-develop `designer`, repurposed | write (docs) | Optional. |
| `stack-setup` | co-develop | write (config) | Optional. Owns `environment-bootstrap`: Plastic workspace registration, WSL↔Windows toolchain checks (`cm.exe`, `dotnet.exe`, `Unity.exe`), authoring per-project `verification-bindings.md`. |
| `security-monitor` | co-develop | read-only | Optional / mostly folded into a security review angle rather than a standing phase. |

## 7. Skills plan

| Skill | Source | Disposition |
|---|---|---|
| `code-review` | co-develop shell, source-roster body | Replace the body with the source review assets: the 11-angle roster (Correctness `LINE GONE XFILE PIT WRAP`, Quality `REUSE SIMP EFF ALT`, Sweep `CONV GAP`, each with its "Do NOT report" delimiter) and the review-brief template with the Plastic diff idiom (`br:/… \| cs:A → cs:B`). Used by `review-angle` dispatches. |
| `test-driven-development` | co-develop | Adopt, adapted to Unity EditMode/PlayMode, plus the standing caveat that authored content (e.g. voice lines) has no automated gate — human-only. |
| `refactoring` | co-develop | Adopt as-is (`platform_parity: skip`). Angles find the issues; this executes the fix pattern via `code-writer`. |
| `system-design-doc` | `~/.claude/skills/` — **rewrite** | Prerequisite work (§10). Generic rewrite, owned by `architect` (`used_by_agents: [architect]`). Targets the `docs/` process-doc root (ruling 7). |
| `feature-requirement-doc` | `~/.claude/skills/` — **rewrite** | Same. |
| `architecture-doc` | `~/.claude/skills/` — **rewrite** | Same. Includes the "persisted build plan" section contract (plan-mode output evaporates; the doc is the record). |
| `handoff` | `~/.claude/skills/` — near-clean | Generalize (one board reference to fix). Coexists with `handoff-spec.md`, which is the agent-to-agent JSON contract — different layers, both kept. |
| `unity-custom-package` | VoXR-SR project-local | Promote into the variant — generic UPM authoring; co-game precedent for shipping domain conventions. |
| `platform-command-lifecycle-manager`, `platform-skill-lifecycle-manager` | co-develop `.claude/skills/` | Keep untouched — harness plumbing. |
| `review-pr`, `swe-solve`, `finishing-a-development-branch` | — | **Dropped** (git-only; see §5). |
| `voice-interaction-design`, `tackle-issue`, `release` | project-local | **Excluded** — stay with their projects (SDK-specific / git-only). |

Every shipped skill: `SKILL.md` with `relates_to` typed edges, declared in `variant.json → skill_manifest.variant_specific` with `used_by_agents` + `phases`, mirrored into `.claude/` / `.gemini/` / `.agents/` unless parity-skipped.

## 8. Procedures plan (`procedures/*/schema.yaml`)

The source orchestration skills re-encode as procedures under PM dispatch — this is where G0/G1/G2 live declaratively (`preconditions`, `quality_gates`, `evidence`, `failure_modes`):

| Procedure | Encodes | Key gates |
|---|---|---|
| `environment-bootstrap` | Onboarding checklist + `verification-bindings.md` authoring (new content; `stack-setup`) | Bindings exist and are runnable before any feature work. |
| `system-design` | Design track: G0 branch + scope → design doc (`architect`) → **G1 human lock** → feature backlog → merge to main | G1 = explicit human sign-off; no product docs touched. |
| `feature-planning` | Source `phase-pickup`: orient from `memory/` (ruling 6) → recon (`code-mapper` + `doc-extractor`, parallel read-only) → `architect` drafts + persists plan into architecture doc → `plan-validator` audit → PM reconciles | Canon-conflict = stop-the-line; scope change = re-gate. |
| `feature-implementation` | `code-writer` ↔ `test-runner` loop (≤3 iterations before PM escalation) | All bound gates green; quirks attributed per bindings. |
| `feature-review` | Source `review-cycle`: brief (scratchpad, absolute path) → fan out `review-angle` per roster entry → PM dedups → `finding-verifier` per survivor → **human ruling per finding** → `code-writer` fixes → `test-runner` → `vc-checkin` | No finding reaches the human unverified; no fix applied unruled. |
| `release-verification` | Source `accept-feature`: `gate-preflight` → present verbatim → **G2 human ruling** → **codex reconcile** (`codex-reconcile`, a named stage — ruling 9) → separate `vc-checkin` commits → merge ceremony (PM-run, human hand-off on GUI conflicts) | G2 = explicit in-conversation human ruling; in-headset playtest is a human-only quality gate ("the headset is the human's only test gate"); the codex is written only after the ruling, never before. |

All `output_type` values must be registered in `procedures/_output-types.yaml`.

## 9. Where the source workflow text lands

- **`docs/phase-definitions.md`** — co-unity writes its own (two decoupled tracks; design may run ahead of implementation), not co-develop's linear 7 phases.
- **AGENTS.md `VARIANT-PHASE-GATE`** — the G1/G2 hard-stop language, verbatim: "do not proceed on silence, enthusiasm, or a 'looks good' about anything other than the gate itself."
- **AGENTS.md `VARIANT-ROLE-BOUNDARY`** — PM Direct Execution Scope carve-out: PM (the main thread) additionally runs the `cm.exe` merge ceremony as an operational action; the §3.1.1 Write/Edit limit (`memory/*.md`, `CHANGELOG.md`) otherwise stands.
- **AGENTS.md `VARIANT-DISPATCH-TRIGGERS`** — the delegation policy, restated for PM dispatch (verification never on the main thread; recon before planning; reviews always via the procedure, never ad hoc).
- **`docs/co-unity.context.md` Domain Rules** — the load-bearing binding sentence survives as a rule: "an agent or skill that finds no binding reports that and stops, never improvises one." Plus: design-contradicts-implementation → stop, reopen design, re-lock G1; process docs before implementation, codex only after G2. And the ruling-9 separation as a standing rule: design docs capture intent and are immutable once locked; the codex (`docs/codex/` by default) describes the systems as built and is the teammate-facing entry point — two areas, never merged.
- **No nested CLAUDE.md in the variant** (follows from ruling 4). The source stack's three levels each resolve differently: the parent workflow CLAUDE.md dies (copy-fork replaces directory-walk inheritance); the project-root CLAUDE.md remains only as the harness's common-sourced MERGE-tier platform adapter; the wiki's nested CLAUDE.md becomes `CODEX.md`, loaded **by contract** (the persona's read-the-schema precondition — which is how it already worked; it was never auto-injected). Projects may derive thin platform shims at scaffold time (e.g. a one-line nested CLAUDE.md pointing at `CODEX.md`) the same way personas derive into `.claude/agents/` — canon stays tool-agnostic, shims are per-project derivations.

## 10. Prerequisite work (before Phase A)

1. **Rewrite the four `~/.claude/skills/` doc-authoring skills generically** (`system-design-doc`, `feature-requirement-doc`, `architecture-doc`, `handoff`). They are outside the roster repo, hardwired to The Long Burn (`raw/`, `cm.exe`, `workflow-status.md`, headset references), and are the only elements that author process docs. Worth doing regardless of the migration.
2. **Distill the codex schema template** from The Long Burn's wiki schema per §4 — the product-layer counterpart of item 1's process-layer rewrites.
3. Resolve the two Plastic-deviation verification items (§5).

## 11. Promotion route

- **Phase A — L3 draft.** `bun scripts/create-l3-scaffold.ts co-unity --domain game` (verify where L3 drafts actually live first — `Projects/` is documented but absent from this checkout). Port roster, skills, procedures; write the WS-09 8-slot `docs/co-unity.context.md`; set the promotion hold immediately. Resolve derivation/persona questions here where rollback is cheap.
- **Validation without migration (ruling 8).** All end-to-end validation uses fresh throwaway Plastic-bound scaffolds — onboarding a real project is migration work and out of the current scope. (For the record: VoXR-Speech-Recognition could never be the pilot anyway — it is git+GitHub and does not fit a Plastic variant; it stays on the legacy roster.)
- **Phase B — promotion decision.** `PROMOTION_CHECKLIST.md`, drift verification, audit. Hold comes off only on the owner's plain-language approval.
- **Phase C — template creation.** `l3-to-variant-pipeline.ts` → `validate-templates.ts` → `validate-variant-readiness.ts` → end-to-end `new-project.ts` test.
- **Non-negotiables before beta/stable:** 6 `VARIANT-*` marker pairs in AGENTS.md (pipeline Phase 3.5 blocks without them); WS-09 context skeleton (hard FAIL); WS-10 `lifecycle:` block with resolvable `governance:` path on every agent (hard FAIL); WS-11 bilingual user guide (hard FAIL); `README.md`/`README_ko.md`; `pm.md` as extends stub ≤200 lines; no `docs/context.md` in the variant; no constitution references in variant `.md` files; a hand-authored `docs/lifecycle/templates/` record (six existing variants are missing theirs — do not copy that gap).

## 12. Project migration order — DEFERRED (ruling 8)

Project migration is explicitly out of the current effort's scope; this section is the standing plan for when it begins:

1. **VR FTL-Like 3** migrates first, via the existing-repo conversion guide (not `new-project.ts`), and only after its in-flight feature clears G2 — never mid-feature. Its 69k-line workflow history and 245 KB wiki log do not migrate as-is; its wiki becomes one binding of the codex (ruling 9).
2. New projects scaffold from the variant thereafter.
3. `VoXR-Speech-Recognition` stays on the legacy roster (git; out of co-unity's scope) — revisit if a git sibling variant ever exists. `VoXR TestGround` is only its Unity test host — moves as a satellite, un-onboarded. `VR FTL-like 2` and older projects: archive, don't migrate.

## 13. Remaining items — technical verifications only (Phase A)

All owner decisions are ruled (§2, rulings 1–9). What remains is verification work, not judgment:

1. **Git-machinery excision mechanics** — overlay exclusion vs. post-scaffold strip script (§5).
2. **`upgrade-project.ts` on a git-less tree** — verify (§5).

## 14. Harness defects to sidestep (found during scoping)

Do not build on: `schemas/` validators (dead code — nothing imports `scripts/validators/`); `generate-ide-rules.ts` (corrupt Cursor-rules output); `docs/variant-creation-workflow.md` (references removed scripts `new-project.sh` / `publish-to-template.ts`); the Q3–Q4 variant roadmap's co-game description (doesn't match the shipped variant); `dispatch*.ts` / `retry-handler.ts` (orphan infrastructure — the production dispatch path is the platform's native Agent tool).

## 15. First actions when work begins

1. Register this plan: `bun scripts/spec-register.ts --file memory/co-unity-plan.md --source manual`.
2. Execute §10 prerequisite work.
3. Phase A scaffold per §11.
