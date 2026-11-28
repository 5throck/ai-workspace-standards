# External-Dependency LLM Configuration — Design

> Spec-id: `2026-11-28-external-llm-config` · Status: approved (owner confirmation 2026-11-29; OQ1-OQ6 resolved to the design's recommendations — recorded in DEC-20261129-001) · Date: 2026-11-28
> Author: architect (design-phase analysis) · Scope: workspace-root machinery + template seeds + humanize-consuming projects

2026-11-29 amendment: approved by the owner on 2026-11-29 (status line updated to `approved`; ruling recorded in DEC-20261129-001). Implementation is deliberately deferred by the owner — the machinery (external-deps parser `config` field, verify V11, adapter materialization, seed/docs changes) is held as service ticket T-20261129-001 (backlog), not scheduled; this landing records the approval only and touches no implementation code. OQ1-OQ6 resolved to the design's recommendations: OQ1 wire nothing now (the mechanism stays dormant until a real consumer arrives with its own spec), OQ2 symlink materialization with the real-file WARN, OQ3 the gate rejects empty values only (no deeper value sniffing), OQ4 the `external-config/` directory name is fleet-fixed, OQ5 the co-newbiz pin divergence stays out of scope (normal pin-divergence machinery), OQ6 one ADR-0091 cross-reference paragraph in the rollout PRs, no new ADR.

## 0 Conclusion

**No external dependency's consumed surface needs LLM configuration today.** The owner-observed problem ("some externals require separate LLM config; without it they may not work") is real but **latent**: it applies to humanize's *unconsumed* upstream surfaces only. Verified per-external:

| External | LLM config needed? | Verdict basis |
|----------|--------------------|---------------|
| `humanize` (co-work seed, co-deck seed, co-work/co-deck/co-newbiz projects) | **No — for everything the fleet consumes.** The adapter path is `POST /api/analyze`, a deterministic offline rules engine (`Projects/co-work/external/humanize/serve.ts:524` — "Zero LLM calls"). The upstream LLM surfaces (browser-UI polish via the `/proxy` key-injection endpoint, the eval harness) need a clone-root `.env` — a surface the fleet never calls and its doctrine forbids agents from touching. | §3.2 |
| `ppt-master` (co-work seed) | No — "Their LLM/agent authoring stages are never wired" (manifest fact, `templates/co-work/external-deps.json` `$comment`) | §3.1 |
| `kordoc` / `rhwp` / `officecli` (co-work project) | No — offline converters / Mach-O binaries; no key references in their consumer scripts | §3.1 |
| `quickdl` (co-deck seed) | No — video downloader, no key references | §3.1 |
| App-level LLM stacks (`CO_NEWBIZ_LLM_*`, `CO_PRICE_LLM_*`, `CAD_LLM_*`) | Out of scope (app-level, not fleet/external tooling) — cited as **convention precedent** (ADR-0091 `<PROJ>_LLM_PROVIDER/BASE_URL/API_KEY/MODEL`) | §3.5 |

The two real defects this design closes:

1. **Config-path gap**: the only config surface humanize's LLM mode accepts is a file *inside the pinned clone* (`serve.ts:74` hardcodes `ENV_FILE = path.join(ROOT, ".env")`), while project doctrine says agents "never edit files inside `external/`" (`templates/co-work/docs/co-work.context.md:168`). There is today **no sanctioned way** to configure an LLM-requiring external, and if one is ever wired, nothing detects the missing config.
2. **Compat-gate honesty gap (prospective)**: all three humanize selftests are offline by construction, so a compat PASS is honest *for the consumed surface* — but if a future pin, adapter, or newly wired surface needed an LLM key, the gate would still PASS while runtime breaks. Worse, if a selftest ever needed a key via env, the gate would become **environment-dependent**: `runCompatibilityTest` spawns *uncontained* with the inherited env (`scripts/lib/external-deps.ts:1092-1105`), so it could pass in the operator session and fail (or silently degrade) in the 03:00 batch, whose env carries no keys.

**Recommendation — Option B, file-based config, containment-neutral**: a gitignored, project-level `external-config/<id>.env` file, declared per dependency by an optional `config` block in `external-deps.json` (same additivity precedent as `market_scope`, T-20261121-001). The adapter — the single coupling point — materializes it into the clone's `.env` at serve time (symlink). The compat gate gains a presence check (V11): a dep declaring `mode: required` config **FAILS the gate with a remediation message when the file is absent** — the gate verifies the config exists *without ever reading key values*. `scripts/contained-run.ts` is untouched: keys never travel through env, so the deny-by-omission allowlist and the DENIED list keep their exact meaning. Nothing in the fleet wires the LLM mode today, so this lands as dormant schema support + honest-gate plumbing with **zero behavior change for current consumers**.

## 1 Problem

Owner statement: among the external dependencies (humanize and similar), some require separate LLM configuration (API keys / model config) to work properly; without it they may not work. Design a solution.

Three sub-problems emerge from the survey:

- **P1 — No sanctioned config path.** An external whose LLM mode needs a key can only be configured by writing inside the pinned clone, which doctrine forbids. Today that is unreachable-by-design; tomorrow it is a silent misconfiguration.
- **P2 — Containment conflict for env-based keys.** `scripts/contained-run.ts` implements deny-by-omission: env vars are denied unless allowlisted, and secret-shaped vars are additionally hard-denied (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `ZAI_API_KEY`, … at `contained-run.ts:163-176`). Allowlisting a key env var for a project would defeat exactly what the DENIED list exists to prevent, and "the env allowlist is a hardcoded invariant, not a project-controlled knob" is the machinery's recorded posture (v1.0.0 header, meeting-2026-11-20-batch-runner-hardening).
- **P3 — Gate honesty.** The compat gate must be able to *verify* that a config-requiring external has its config — without possessing the secret, without depending on the invoking shell's env, and without a false PASS.

## 2 Goals

- **G1** — A sanctioned, documented configuration path for externals that need LLM keys, outside the clone, surviving pin re-fetch.
- **G2** — Containment neutrality: `contained-run.ts` env semantics unchanged; keys never in env, never in argv, never in gate output.
- **G3** — Honest compat gate: config presence is checked deterministically at pin-bump time and in `verify`; missing required config = FAIL with a clear remediation message, not a silent PASS.
- **G4** — Typed startup behavior: a config-requiring external without config produces a typed error naming the file to create; a degradable one proceeds and says so. No silent skips.
- **G5** — A per-external LLM-config documentation surface (manifest `$comment` + project context doc), aligned with the ADR-0091 fleet convention.
- **G6** — Zero behavior change for the current fleet: no dependency declares config today; the mechanism lands dormant.

## 3 Current state (evidence)

### 3.1 The external inventory and its LLM needs

Manifests carrying dependencies (schema v2 seeds; projects may carry more than their seed):

| Manifest | Deps | LLM config need |
|----------|------|-----------------|
| `templates/co-work/external-deps.json` | `ppt-master` v6.10.0, `humanize` v1.0.2 | ppt-master: none (manifest `$comment`: LLM/agent authoring stages never wired). humanize: none for the consumed lint path (§3.2) |
| `templates/co-deck/external-deps.json` | `quickdl` v1.0.1, `humanize` v1.0.2 | quickdl: none (no key references in `download-videos.ts`). humanize: none for the consumed lint path |
| `templates/common/external-deps.json` | (empty) | — |
| `Projects/co-work/external-deps.json` | + `kordoc` v4.24.53, `rhwp` v0.9.1, `officecli` v1.0.161 | none — HWP/office converters; `rhwp` is a Mach-O binary (`external/rhwp/rhwp`); contract tests offline |
| `Projects/co-newbiz/external-deps.json` | `humanize` **v1.0.0** (seed divergence, out of scope here) | none — see §3.3 |

### 3.2 humanize: the LLM-dependency verdict, per surface

The upstream clone (`5throck/Humanize`, MIT; local evidence at `Projects/co-work/external/humanize/`) splits cleanly:

- **Consumed surface — offline, deterministic.** `serve.ts:524`: "`/api/*` — deterministic rules engine over HTTP. **Zero LLM calls**". Both adapters call only `/api/analyze`:
  - co-work adapter: `templates/co-work/scripts/humanize/humanize-adapter.ts:123-134` (single `fetch` to `/api/analyze`; advisory posture — unreachable server prints and exits 0, lines 39-41, 135-137).
  - co-deck adapter: `templates/co-deck/scripts/co-deck/humanize-adapter.ts:151` (probe), `:302` (analyze), `:357` (selftest) — all `/api/analyze`.
- **Upstream selftest — offline fixtures.** `test.mjs` loads `engine/rules.js` into a sandbox and asserts analyze/polish behavior on a fixed Korean sample (lines 1-100); it makes **no network calls** (grep: no `fetch`/proxy/key usage). Detect-only residuals are explicitly deferred: "they need sentence restructuring -> LLM mode territory" (`test.mjs:92`) — i.e. the LLM path is *deliberately outside* what the selftest covers.
- **LLM surfaces — real but unconsumed.** The server proxies browser-initiated LLM calls with the key injected from `.env`: `/proxy/<host>/<path>` (`serve.ts:8-11`, `proxyPost` at `:489`), provider presets for zai/openai/anthropic/gemini/deepseek/bigmodel (`serve.ts:220-223`), and config management endpoints `/env-config` (returns `keyConfigured` + provider, never the key value — `serve.ts:5`, `:713`, `:712-724`) and `/env-save` (writes `.env`, loopback/same-origin only — `serve.ts:6-7`). The eval harness (`lib/eval-core.mjs:55` — "engine polish (offline mode) or LLM output (llm mode)") and `scripts/eval.mjs` / `bootstrap-fewshot.mjs` call providers directly. None of this is invoked by any fleet script, adapter, or skill.
- **Config surface — clone-root `.env` only.** `serve.ts:74` `const ENV_FILE = path.join(ROOT, ".env")`; `loadEnv` reads only that file (`:81-99`); upstream ships `.env.sample` (4-tuple: `LLM_PROVIDER` / `LLM_API_KEY` / `LLM_MODEL` / optional `LLM_BASE_URL` — the same shape as the ADR-0091 fleet convention; upstream's header even cites "co-newbiz llm.ts convention", `serve.ts:16`). Upstream gitignores `.env` (clone `.gitignore:1`). Without it: `keyConfigured:false`, the rules endpoints work, the proxy/LLM-mode features fail per-request — an upstream-native graceful degradation.

### 3.3 co-newbiz humanize flow — the rewrite needs no key

`Projects/co-newbiz/scripts/humanize/humanize-adapter.ts:5-9`: the adapter wraps "an LLM rewrite step that **the calling session** performs between `prepare` and `finalize`" — the dispatched agent rewrites with its own model; the humanize server is used for deterministic classify/prepare/gates only (gates "narrowed to the deterministic set", header). Server-unreachable is FATAL there (exit 3 at prepare), but **no provider API key is involved**. Its compat test (`bun test scripts/humanize/tests/humanize-contract.test.ts`) states "No LLM; the server is spawned on …" (`humanize-contract.test.ts:5-7`).

### 3.4 Containment and the compat gate — actual topologies

- **Compat gate (pin-bump time)**: `runCompatibilityTest` (`scripts/lib/external-deps.ts:1092-1105`) spawns the manifest's `compatibility_test` **directly, uncontained**, inheriting the caller's full env (argv-array spawnSync, 600 s timeout). Invoked from the upgrade-project EXTERNAL DEPS pass (`scripts/upgrade-project.ts:5232`, `:5323`). The task framing "the compat gate also runs under containment" is **not** what the code does — containment applies elsewhere (next bullet). The honesty hazard is therefore inverted from the naive reading: today the gate *could* see operator-exported keys an automated run would not — an environment-dependent PASS/FAIL if a selftest ever needed a key.
- **Nightly project reviews**: the unified batch runner (ADR-0105, STEP E) runs each project's `bun scripts/audit.ts` + test suite through `scripts/contained-run.ts` (meeting-2026-11-20 lineage; v1.2.0, U-20261128-001). Containment: env allowlist (`PATH`, scratch `HOME`, `TMPDIR`, `LANG`, `BUN_INSTALL_CACHE_DIR`, `PLAYWRIGHT_BROWSERS_PATH`, git identity — `contained-run.ts:147-161`) plus the explicit credential DENIED list (`GITHUB_TOKEN`, `GH_TOKEN`, `ANTHROPIC_API_KEY`, `ZAI_API_KEY`, `OPENAI_API_KEY`, AWS, `NPM_TOKEN`, `SSH_AUTH_SOCK` — `:163-176`), listed "so a future edit cannot 'helpfully' forward them". A project test suite that needed an LLM key would be denied under containment — correctly, per the machinery's threat model (project-controlled code must not receive runner secrets).

### 3.5 App-level LLM config — convention precedent (out of scope)

ADR-0091 standardizes project-level LLM env as `<PROJ>_LLM_PROVIDER|BASE_URL|API_KEY|MODEL`, optional-by-design with deterministic fallback: co-newbiz `app/web-next/lib/llm.ts:8-10` — "With no provider configured, `complete()` returns null and callers fall back to deterministic synthesis — the platform must stay fully functional without an LLM", source-tagged outcomes (`:32-38`); co-price renamed `PRICE_AI_*` → `CO_PRICE_LLM_*` (its 2026-09-26 design); co-architect's LLMCFG-001 uses the same 4-tuple with a `none` provider. humanize upstream independently adopted the same shape. These are app-level stacks consumed by app code, not by fleet/external tooling — out of scope, but they fix the vocabulary (4-tuple, explicit provider, degradation-by-design) this design reuses.

### 3.6 The gap, precisely

- Compat-gate declared selftests for humanize: co-work seed = key-file existence (`humanize-adapter.ts:148-157`); co-deck seed = spawn + probe + findings>0 (`co-deck humanize-adapter.ts:340-375`); co-newbiz = contract test. All offline. **Compat PASS is honest for the consumed surface** — no current pin ships broken for lack of LLM config. Blast radius of the *prospective* gap: any future humanize pin bump or newly wired surface (UI polish, eval, an adapter endpoint moving to `/proxy`) would PASS the gate regardless of config.
- The only runtime config write path upstream offers (`/env-save`) is loopback + same-origin browser UI flow — no fleet surface drives it, and doctrine forbids the direct alternative (agents writing `external/humanize/.env`).
- The manifest schema parser rejects unknown fields (`scripts/lib/external-deps.ts:68-69`; field sets at `:180-201`), so a config declaration is a deliberate, additive schema extension — precedent: `market_scope` (optional v2 field, T-20261121-001, spread via channel-2c verbatim adoption).

## 4 Proposed design

### 4.1 Alternatives assessed

| Option | Mechanism | Security | Compat-gate honesty | Fleet rollout | Verdict |
|--------|-----------|----------|--------------------|--------------|---------|
| **(a) Per-project env allowlist** — project declares needed key env vars; contained-run honors a project-declared allowlist file | Keys flow through env into contained processes | **Fails the machinery's core invariant**: deny-by-omission (`contained-run.ts:148-176`) exists so project-controlled code cannot name its own secrets; a project-controlled allowlist that can say `OPENAI_API_KEY` re-creates the exact threat the v1.0.0 hardening removed (security-expert: "project-controlled code with runner authority"). Key also risks leaking into inherited stdio (`stdio: "inherit"`). | Gate would check env presence at pin-bump time — but the gate runs uncontained in the operator session while the nightly batch runs contained key-less: **environment-dependent verification**, flaky PASS/FAIL across contexts. | Requires contained-run (protected machinery) to trust a per-project file — a governance-level change to the most security-sensitive script in the repo. | **Rejected** |
| **(b) File-based config (recommended)** — project-level gitignored config file; adapter materializes it into the clone; gate checks file presence, never values | Keys live on disk once, in a fixed gitignored path; never in env/argv | Key surface identical to the fleet's existing `.env` practice (co-newbiz/co-price/co-architect precedent). Deny-list semantics untouched. Upstream already refuses to return the key over HTTP (`serve.ts:713`). Residual: the contained process can read the file — inherent to any usable secret; same class as `.env` app config, recorded as accepted. | **Deterministic and environment-independent**: file exists or it doesn't, in the operator session and in the 03:00 batch alike. Gate checks existence + key *names* present — never reads values, so the gate never handles the secret. | Purely additive: optional manifest field (market_scope precedent), adapter-local behavior, one new verify check. contained-run untouched. | **Chosen** |
| **(c) Operator-level allowlist with explicit approval** — contained-run gains `--allow-env KEY` passed per invocation | Operator grants a named key for one run | Stronger than (a) (approval is operator-side, not project-side) but still env-borne; key can reach argv/ps; approval does not compose with automation. | Same environment-dependence as (a) — and the batch runner has no operator to approve. | Per-invocation burden; unusable in the 03:00 pipeline; protected-machinery change for a case (b) covers better. | **Rejected** |

### 4.2 The mechanism (Option B, full design)

**D1 — Manifest declaration (additive, dormant until used).** New optional per-dep field `config` in schema v2 (appended to `ENTRY_FIELDS_V2`, `scripts/lib/external-deps.ts:193-201`; parser accepts absent-or-valid; channel-2c seed adoption carries it verbatim like other fields; **not** added to `V2_CONTRACT_FIELDS` — v1→v2 migration never fabricates config declarations):

```jsonc
{
  "id": "humanize",
  "...": "existing fields unchanged",
  "config": {
    "path": "external-config/humanize.env",   // project-relative, MUST be outside install_dir
    "requires": ["LLM_PROVIDER", "LLM_API_KEY", "LLM_MODEL"],
    "mode": "required",                        // or "optional-degrade"
    "materialize": "clone-env"                 // adapter copies/links it to <install_dir>/.env
  }
}
```

Validation rules (parse-time): `path` non-empty, project-relative, outside any `install_dir`, not `..`-escaping; `requires` a non-empty array of env-style key names; `mode` ∈ {`required`, `optional-degrade`}; `materialize` ∈ {`clone-env`} for now. Unknown `mode`/`materialize` values are parse errors (the strict-parser precedent).

**D2 — Config file contract.** `<project>/external-config/<id>.env`, gitignored. Content: the upstream `.env.sample` 4-tuple filled in (humanize's native keys — the manifest `requires` list names exactly the keys the gate checks). Gitignore coverage is validated and auto-appended by the same D5 machinery that guards `install_dir`, generalized to declared config paths. The file is the **single** on-disk copy of the secret; the clone gets a symlink, not a copy (D3).

**D3 — Adapter materialization (single coupling point).** The humanize adapters (co-work `serve`/`analyze` lifecycle, co-deck `ensureServer`) gain a pre-spawn step: if the manifest declares `config` and the config file exists, ensure `<install_dir>/.env` is a symlink to it (idempotent — recreated on every serve, so pin re-fetch cannot strand a stale copy; if a real file is found there — e.g. written by the upstream UI's `/env-save` — it is left alone and a WARN names both surfaces). Materialization never prints file contents. Writing a symlink into the clone is an amendment to the "never edit files inside `external/`" doctrine: the amendment is narrow — *the adapter may manage `.env` as runtime configuration state, exactly as the upstream's own `/env-save` does; no other clone file is ever touched* — and it is recorded in the project context docs (G5).

**D4 — Startup behavior (typed, no silent skips).**
- `mode: required`, config file missing → typed error naming the remediation: e.g. `humanize: LLM config required by external-deps.json (config.path external-config/humanize.env) — file absent; create it from external/humanize/.env.sample` with a distinct exit code; the flow aborts loudly (the co-newbiz FATAL posture, not the co-work advisory one — the *lint* stays advisory; what becomes fatal is a *declared-required config* being absent).
- `mode: optional-degrade`, config missing → proceed, one line: `humanize: LLM mode unconfigured (external-config/humanize.env absent) — rules engine unaffected`. The upstream already degrades this way (`keyConfigured:false`, `serve.ts:717-724`).
- Current fleet: no dep declares `config` → zero new errors, zero behavior change (G6).

**D5 — Degradation classes (per external, documented).**

| External / surface | Config need | Missing-config behavior |
|---------------------|-------------|------------------------|
| humanize lint via adapters (co-work, co-deck) | never needed (offline engine) | advisory skip, unchanged |
| humanize LLM mode (UI polish via `/proxy`, eval harness) | declared `config`, `optional-degrade` by default; `required` only if a project actually wires a flow that cannot proceed without it | upstream-native degrade / typed error per D4 |
| co-newbiz rewrite step | none (session-performed) | n/a |
| co-newbiz app `CO_NEWBIZ_LLM_*` | out of scope | deterministic synthesis (`llm.ts:8-10`) |
| ppt-master, kordoc, rhwp, officecli, quickdl | none | n/a |

**D6 — Compat-gate extension (the honesty change).**
- New verify check **V11** in `scripts/lib/external-deps.ts` + surfaced by `scripts/external-deps.ts verify`: for every dep with `config.mode: required` — config file must exist, parse as `KEY=VALUE` lines (upstream `loadEnv` semantics: tolerate `export ` prefix and quotes — `serve.ts:81-99`), and declare every name in `requires`. **The check reads key names only; values are never read, compared, logged, or emitted** (a value-bearing diff is impossible by construction). Missing/malformed → FAIL with the D4 remediation message. `optional-degrade` → INFO row only.
- Ordering in the EXTERNAL DEPS pass (`scripts/upgrade-project.ts:5232`, `:5323`): V11 runs **before** `compatibility_test` for any candidate pin move; a missing required config FAILs the dep (pin HELD + the remediation message) without running the selftest — an honest gate cannot bless a pin whose declared runtime config is absent.
- Because the check is file-based, it is **identical in the operator session and in the 03:00 batch** — the environment-dependence hazard of §3.4 cannot recur for config.

**D7 — Documentation surface (per external).**
- Manifest `$comment` gains one sentence per config-declaring dep pointing at `external-config/<id>.env` and the upstream `.env.sample`.
- Project context docs (the "Humanize External" section pattern, `templates/co-work/docs/co-work.context.md:150-170`) gain an "LLM configuration" subsection: file path, 4-tuple meaning, degrade behavior, the D3 doctrine amendment, and the ADR-0091 cross-reference (project app keys `<PROJ>_LLM_*` are separate from external config keys — do not conflate).
- `docs/VERSION_MANIFEST.md` / scripts `SCRIPTS.md` rows updated for the touched machinery by the normal lifecycle flow.

## 5 Rollout

- **Affected projects**: co-work, co-deck, co-newbiz (the humanize consumers) — all via the standard machinery delivery path; the other 13 projects receive the extended parser/verify harmlessly (no deps, or deps without `config`). co-newbiz is standalone-track (not yet a template seed): it takes the machinery through its own upgrade wave; its v1.0.0-vs-v1.0.2 seed pin divergence is pre-existing and explicitly out of scope (§3.1).
- **Delivery path** (one PR per layer, Design-Gate-registered):
  1. Workspace root: `scripts/lib/external-deps.ts` (field + V11 + gitignore generalization), `scripts/external-deps.ts` (verify surface), `scripts/upgrade-project.ts` (pass ordering) — core delivered scripts, so the change flows to projects through the normal sync/upgrade machinery; unit tests in `tests/unit/`.
  2. Template seeds: co-work + co-deck `external-deps.json` `$comment` docs; context-doc subsections. **No seed declares `config` yet** — nothing consumes the LLM mode (G6); the schema support lands dormant so the first real wiring has a sanctioned path.
  3. Projects: fleet upgrade waves deliver the machinery; project context docs updated by each project's own `/sync`.
- **Compat-gate honesty change**: V11 + pass ordering as D6. For the current fleet this is a no-op (zero `required` declarations); the gate becomes opinionated only when a project actually declares a requirement — at which point FAIL-on-missing is the desired honesty.
- **Operator action required today**: none. First time an external's LLM mode is wired, the operator creates one gitignored file per project.

## 6 Risks

- **R1 — Dormant schema invites premature or divergent wiring.** Mitigation: this design fixes the declaration shape and the degradation classes; any actual wiring still goes through the normal Design Gate.
- **R2 — Doctrine tension with D3** (adapter-managed file inside the clone). Mitigation: narrow amendment (`.env` only, adapter-only, upstream-sanctioned runtime state — upstream's own `/env-save` writes it), recorded in context docs; `verify` V5-style manifest checks can assert the symlink target stays outside the clone.
- **R3 — Secret on disk.** One copy, gitignored, outside the clone, never logged; exposure class identical to the fleet's accepted `.env` practice. Gate value-blindness (D6) keeps the secret out of gate output and decision logs. Residual: a contained review process can read the file — inherent to any usable secret; accepted and recorded (same class as app `.env`).
- **R4 — Upstream `.env` format drift** breaks the V11 parser. Mitigation: name-presence parsing only, mirroring `loadEnv`'s documented tolerance (`export `, quotes, comments — `serve.ts:81-99`); a parse failure FAILs loudly (honest), never passes silently.
- **R5 — Symlink surprises** on platforms/flows that copy rather than clone, or the UI's `/env-save` replacing the symlink with a real file. Mitigation: idempotent re-link at serve time; real-file-found → WARN naming both surfaces (D3); open question OQ2 on copy-vs-symlink.
- **R6 — Someone reads "dormant schema" as a mandate to wire LLM mode without a design.** Mitigation: G6/R1 wording; the compat gate and docs consistently state that no current consumer needs it.

## 7 Acceptance criteria

1. `bun scripts/external-deps.ts verify` passes on every current project unchanged (zero `config` declarations → zero new rows beyond an optional INFO note).
2. A manifest with a malformed `config` block (bad `path`, unknown `mode`, empty `requires`) is a **parse error** with a precise message; a valid block parses and channel-2c adoption copies it verbatim.
3. With a humanize dep declaring `mode: required` and no config file: `verify` V11 FAILs with the remediation message; the upgrade pass HELDs the pin and does not run the selftest; the adapter start errors with the typed D4 message and a distinct exit code.
4. With the config file present and correct: V11 PASSes **without any output containing a key value** (asserted by test); the adapter materializes `<install_dir>/.env` → config file (symlink) idempotently; a pin re-fetch followed by serve re-creates the link.
5. `scripts/contained-run.ts` is byte-for-byte unchanged (no env/allowlist/DENIED-list edits); its existing unit tests stay green.
6. With `mode: optional-degrade` and no config: adapter prints the one-line degrade notice and proceeds; V11 emits an INFO row only.
7. Both humanize adapters' selftests and the upstream `test.mjs` remain offline and green before and after (no consumed-surface behavior change).
8. Documentation (manifest `$comment`, context-doc subsection, SCRIPTS/VERSION_MANIFEST rows) landed in the same PRs as the machinery (house rule: docs travel with code).

## 8 Test plan

- **Unit — parser** (`tests/unit/external-deps-config.test.ts`): valid block round-trips; each malformed shape rejected with the precise message; `path` traversal/outside-project/install_dir-inside rejections; v1 manifests still parse (no config fabrications in migration); channel-2c adoption carries `config` verbatim.
- **Unit — V11** (`tests/unit/external-deps-verify-config.test.ts`): present-and-complete → PASS; absent → FAIL + message names `config.path` + `.env.sample`; missing one `requires` name → FAIL; `export FOO=…` and quoted values tolerated (loadEnv semantics); **value-blindness assertion** — run the check against a fixture file with a canary secret and assert the canary appears in no stdout/stderr/decision-row output.
- **Unit — adapter materialization** (`tests/unit/humanize-adapter-config.test.ts`): symlink created; idempotent re-run; re-fetch simulation (delete clone, re-serve) re-creates; real-file-present → WARN, no overwrite; `optional-degrade` degrade notice; typed error exit code for `required`-missing.
- **Negative control (gate honesty)**: fixture project with a humanize dep declaring `mode: required`, config absent → upgrade-project `--external-deps-only` FAILs the dep with pin HELD; config present → dep passes and pin moves. Mirrors the co-deck v1.0.2 negative-control pattern (pre-change adapter FAILing is the proof the gate bites).
- **Containment regression**: existing `tests/unit/contained-run-*.test.ts` suites green, unchanged (criterion 5).
- **E2E (manual, one-time)**: co-deck selftest + upstream `test.mjs` in a scratch project with a real `external-config/humanize.env` (operator-provided key) — confirms the symlink path feeds `/env-config` (`keyConfigured:true`) without the key ever appearing in adapter output; then delete the file and confirm the degrade/typed-error paths. This E2E is the *only* test that exercises a live provider and is run by the operator, never by the gate or the batch.

## 13 Open questions for the owner

1. **OQ1 — Wire anything now?** The survey shows no current consumer needs LLM config. Recommendation: land the dormant mechanism (D1-D7) and wire nothing; the first real LLM-mode consumer arrives with its own small spec. Confirm, or direct that the UI-polish/eval surface should be wired now.
2. **OQ2 — Symlink vs copy for materialization.** Symlink keeps the secret to one on-disk copy and auto-tracks operator edits; copy is more portable but duplicates the secret and can go stale. Recommendation: symlink, with the real-file WARN (D3/R5).
3. **OQ3 — Gate depth.** V11 checks key-name presence only. Should it also reject placeholder values (e.g. an unfilled `.env.sample` copy with `LLM_API_KEY=` empty, or the literal sample default `gpt-4.1-mini` left as-is)? Empty-value rejection is cheap and value-blind; model-default sniffing is not. Recommendation: reject empty values for `requires` names; nothing deeper.
4. **OQ4 — Config directory name.** `external-config/` (sibling of `external/`, proposed) vs per-project choice. Recommendation: fix the name fleet-wide so docs, gitignore auto-append, and gate messages can be exact.
5. **OQ5 — co-newbiz pin alignment.** Its humanize pin (v1.0.0) trails the seeds (v1.0.2). Out of scope here; flag for the normal pin-divergence machinery rather than this design.
6. **OQ6 — ADR-0091 relationship.** External config keys are humanize-native (`LLM_*` inside a gitignored file), while app keys are `<PROJ>_LLM_*` env. Should a future ADR note the two-layer split explicitly to prevent conflation in docs? Recommendation: yes, one paragraph in the rollout PRs' ADR cross-reference (no new ADR needed unless the owner prefers).
