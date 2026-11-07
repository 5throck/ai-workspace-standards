# Trail fleet standard (repo context graph + learnings notes) — design

- **Status**: implemented (registry SSOT; Phase A design — implementation is gated on the §11 user rulings at the approval gate)
- **Date**: 2026-11-08
- **Ticket**: T-20261108-001
- **Related**: design `2026-10-31-graft-trail-migration-design.md` (vendor rename + surface-flip predecessor; U-20261031-009), design `2026-10-02-self-managed-tool-surfaces-design.md` (self-managed custody), ADR-0076 (graft fleet integration), ADR-0074 (Design Gate), design `2026-11-04-project-loss-hardening-design.md` (16-file §7 wave + validate-arm precedent this design reuses)
- **UI exemption**: Documentation, template, and script-gate changes only. No UI surface. Exempt per ADR-0065 and ADR-0070.
- **Scope guard**: This design standardizes what the workspace SHIPS. It does not run `trail init` on any project and does not force migration — projects converge at their natural upgrade visits (2026-10-31 design R2.6 precedent, restated here).

## 1. Problem

The trail feature (vendor `@trailhq/trail-code` 0.28.x — repo context graph in
`.trail/cache/`, session-start learnings injection, MCP server) is a fleet
standard by accident, not by design. Its four surfaces have four different
delivery states:

1. **AGENTS.md prose** — the `<!-- trail:start -->…<!-- trail:end -->` block
   exists in the root AGENTS.md and in exactly 2 of 16 template AGENTS.md files
   (templates/common + templates/co-architect). The copies are currently
   byte-identical, but nothing gates them: the block sits OUTSIDE the
   COMMON-AGENTS zone (templates/common/AGENTS.md:294-334, zone = 160-194), so
   PM-04b (COMMON-AGENTS parity), VA-05 (CLAUDE/GEMINI twin sections), and the
   propagation passes all ignore it. The 14 other variant templates ship
   scaffolds whose AGENTS.md never mentions trail.
2. **`.trail` wiring** (hook.cjs + README.md + .gitignore, plus the SessionStart
   hook registration) — delivered by NOTHING. templates/common does not carry a
   `.trail/` skeleton and its `.claude/settings.json` has no trail hook entry.
   Only repos where an operator ran `trail init` have it. The vendor's own
   doctrine ("Commit this folder and `.claude/settings.json` once", .trail/README.md:13)
   and the self-managed registry both treat the wiring as TRACKED repo assets —
   the workspace just never made them fleet assets.
3. **Learnings notes** — the feature's core value (session-start injection of
   distilled repo knowledge, working even WITHOUT trail installed via the
   hook's fallback mode) is used at exactly one project (co-newbiz, 6 notes) and
   the root (2 notes). No workspace surface documents the note format, naming,
   or lifecycle; skills/trail/SKILL.md (208 lines) contains zero learnings
   doctrine (grep: no "learning" matches).
4. **Contrast with the MCP surface** — templates/common already ships trail MCP
   entries in `.mcp.json`, `opencode.json`, and `.agents/mcp.json` (2026-10-31
   design addendum A2 items 5-7), and new-project.ts §7.7 runs `trail build` on
   every fresh scaffold (new-project.ts:1912-1932). The fleet therefore already
   depends on trail tooling while missing the prose, the wiring, and the
   learnings channel that make it useful — the incoherent middle state.

## 2. Evidence (file:line)

All line numbers verified against origin/main @ 34170b919 (PR branch worktree),
2026-11-08. Fleet census is the operator machine's local `Projects/` checkouts
(Projects/ is gitignored per .gitignore `/*/` — machine-local, not repo state).

| Claim | Evidence |
|---|---|
| Root trail block exists, tool-managed markers | AGENTS.md:291-331 (`<!-- trail:start -->` at :291) |
| Root wiring is tracked; cache/statusline ignored | git ls-files `.trail/` → `.trail/.gitignore`, `README.md`, `hook.cjs`, 2 learnings; .trail/.gitignore = `cache/` + `statusline.cjs` (22 bytes); root .gitignore:80-89 (`!.trail/` negation + `.trail/cache/` + helper ignores) |
| Hook registration (root) | .claude/settings.json:114 — SessionStart, `node "${CLAUDE_PROJECT_DIR:-.}/.trail/hook.cjs" session-start \|\| exit 0`, timeout 10 |
| Hook is a self-locating loader over the vendor package | .trail/hook.cjs:11 (`PKGS = ['@trailhq/trail-code', '@nanonets/graft', '@trailhq/trail']`), :17-26 (remembered install.json, owner-checked), :108-117 (`entry()` resolution order) |
| Hook fallback = learnings injection WITHOUT trail installed; empty learnings = silent no-op | .trail/hook.cjs:124 (`else if session-start → offerTrail()`), :126-131 (`readdirSync` in try/catch; `files.length === 0 → return`), :160 (SessionStart `additionalContext`) |
| Learnings "live" lifecycle is machine-parsed from front matter | .trail/hook.cjs:166-200 (`liveFiles`: `status` ∈ active/held/replaced/retired, `replaces` chains, date from front matter or filename prefix `^\d{4}-\d{2}-\d{2}`) |
| Learnings note format (naming + front matter + body) | .trail/learnings/2026-10-31-open-bug-tracked-as-ticket-t-sunghyuk.md (front matter `title/author/date/id: l-97f7c11c/scope/status/touches`; body Decided/Why/Watch out; trailing attribution); Projects/co-newbiz/.trail/learnings/ = 6 notes, all `YYYY-MM-DD-<slug>-sunghyuk.md` |
| Vendor commit-once doctrine for the wiring | .trail/README.md:9-16 ("what Claude Code runs at session start (`.claude/settings.json`)… Commit this folder and `.claude/settings.json` once") |
| Wiring is "TRACKED but remain tool-owned" (registry-sanctioned) | docs/self-managed-surfaces.json — trail entry `reason`: "trail init's wiring files (.trail/hook.cjs, .trail/README.md, .trail/.gitignore) are now TRACKED but remain tool-owned … validators do not police their content"; `paths[0]` = `.trail/` |
| The AGENTS.md block is tool-owned and self-healing | skills/trail/SKILL.md:106-110 ("The AGENTS.md trail block is tool-managed … `reconcileWiring` treats a hand-deleted instruction block as accidental loss and re-appends it (`upsertSection` on the tool's markers)") |
| Template copies sit OUTSIDE the COMMON-AGENTS zone (ungated) | templates/common/AGENTS.md: zone 160-194 (`COMMON-AGENTS:START/END`), block 294-334; templates/co-architect/AGENTS.md block 600-640 (grep: only these 2 of 16 template AGENTS.md carry "Trail — repo context graph") |
| Zone parity gate exists but covers only the COMMON-AGENTS zone | scripts/validate-templates.ts:5627 (`checkCommonAgentsBlockParity`, PM-04b — extract/compare `COMMON-AGENTS:START/END` blocks, Error severity) |
| `trail init` writes shared + personal surfaces (dry-run probe, 0.28.1) | `trail init --dry-run -y --no-agents` in a scratch git repo: writes `.claude/settings.json` (trail SessionStart hook, "shared"), `.trail/hook.cjs` ("shared"), `.claude/settings.local.json` (statusline + allowlist, "yours"), `.trail/statusline.cjs` ("git-ignored"), plus `~/.claude/*` machine-level ("suppress … with --no-global") |
| Block text is byte-stable across trail-init'd repos | diff of the marker block: root == templates/common == templates/co-architect == Projects/co-architect == Projects/co-develop == Projects/co-newbiz (all installed 2026-11-01…11-07, same 0.28.1 text) |
| MCP surface already fleet-delivered | templates/common/.mcp.json, opencode.json, .agents/mcp.json all carry the `trail` server (2026-10-31 design A2 items 5-7) |
| Scaffold copies the whole common tree; skip list excludes only node_modules/.gateguard-state | scripts/new-project.ts:896 (`copyDir(commonDir, projectDir)`), :826-840 (`copyDir` recurses all entries incl. dotdirs), scripts/helpers/scaffold-markers.ts:265 (`NEW_PROJECT_COPY_SKIP_ENTRIES = ['node_modules', '.gateguard-state']`) |
| Scaffold builds the graph per project | scripts/new-project.ts:1912-1932 (§7.7 plain `trail build`, non-fatal) |
| Upgrade walks dotdirs; claims resolved per path class | scripts/lib/upgrade-policy.ts:743-753 (`walkFiles` skips only node_modules/.git/.gateguard_state/.DS_Store), :759-774 (`iterEffectiveTemplateFiles` — variant overlaid on common) |
| Upgrade seed precedents for this exact mechanism | scripts/lib/upgrade-policy.ts:436-444 (`TRAIL_RETIRED_SEEDS` + `isTrailRetiredSeed` — graft-era seeds SEED_SKIP'd when `.trail/` marker present), scripts/upgrade-project.ts:4540-4542 (SEED_SKIP arm), :4558-4593 (hook-entry existsSync guard in settings JSON_MERGE) |
| AGENTS.md reaches projects via DOCS_MERGE (managed-zone replace + census-guarded out-of-zone reconcile) | scripts/upgrade-project.ts:2888-2930 (`DOCS_MERGE_FILES = ['AGENTS.md']`, `mergeWorkspaceManaged`), :2087+ (managed blocks, instruction-region census, skeleton sections) |
| Variant settings.json is synced FROM templates/common | scripts/sync-variant-settings.ts:37 ("templates/common/.claude/settings.json into every variant's settings.json", delete-guard entry precedent at :5) |
| Fleet census (local Projects/, 2026-11-08) | 17 checkouts; AGENTS.md trail section: co-architect, co-develop, co-newbiz (3); `.trail/` dir: co-develop (wiring trio only), co-newbiz (full: trio + cache + 6 learnings + statusline.cjs); 14 checkouts have neither |
| Template census | 15 variant templates (co-*) + templates/common = 16 template AGENTS.md; 2 carry the trail section |
| Root anomaly (personal surface, out of repo scope) | `~/.claude/settings.json` statusLine points at `.claude/helpers/graft-statusline.cjs` — deleted by trail init at the root; the trail-era shim is `.trail/statusline.cjs` (untracked) |

## 3. Goals / Non-goals

**Goals**

- G1: the AGENTS.md trail block becomes a fleet standard with machine-enforced
  parity — every template AGENTS.md carries the identical tool-managed marker
  block, and a validate arm detects divergence (template drift is currently
  invisible).
- G2: the `.trail` wiring (hook.cjs + README.md + .gitignore + the SessionStart
  hook registration) ships to every fresh scaffold on arrival and to existing
  projects at their next upgrade visit, so the learnings channel exists
  fleet-wide WITHOUT requiring trail to be installed.
- G3: the learnings-notes standard (naming, front matter, lifecycle, body
  shape, relationship to memory/) is documented in the workspace trail skill —
  the single doctrine surface for the feature.
- G4: root (L0) stays conformant with zero changes required; co-develop and
  co-newbiz (already `.trail`-equipped) are untouched by upgrade seeds.

**Non-goals**

- N1: running `trail init` on any project from the workspace (vendor doctrine:
  init is a per-repo operator action; the 2026-10-31 design R2.6 rule stands).
- N2: moving the trail block into the COMMON-AGENTS zone (rejected — §4 D1-A).
- N3: standardizing the statusline (`.trail/statusline.cjs` + statusLine
  registration live in personal surfaces — `.claude/settings.local.json` /
  user-level settings; probe evidence, §2). Recorded as an operator note, not a
  workspace deliverable.
- N4: authoring learnings notes fleet-wide (content is per-repo knowledge; this
  design standardizes the FORMAT and the channel, not the notes).
- N5: retiring graft-era legacy blocks in root/templates .gitignore (kept until
  fleet convergence — 2026-10-31 design R2.2/A4).
- N6: any change to `skills/trail/` platform mirrors or `.trail/` instance
  content (self-managed; tool-owned).

## 4. Alternatives considered

### D1 — where the AGENTS.md trail prose lives in the template tree

| Option | Pro | Con | Decision |
|---|---|---|---|
| A. Move the section INTO the COMMON-AGENTS zone | one delivery channel (PM-04b + propagation already gate the zone); no new arm | **double-master conflict**: the tool's `reconcileWiring` re-appends its own marker block on every trail-init'd repo (skills/trail/SKILL.md:106-110), so a project would carry the zone copy AND the tool's copy — overlapping doctrine that drifts; next governance propagation clobbers vendor text updates and vice versa; the prose opens "This repo is indexed in `.trail/cache/`" — false for 14/17 projects and for fresh scaffolds whose 0.28.1 graph lands in `<repo>/graft` until their own init migrates it; changes the zone's semantic class (policy doctrine → tool usage) | Rejected |
| B. Keep the tool-managed marker block; standardize presence + parity in templates (chosen) | aligns workspace propagation with tool ownership — templates ship the same bytes the tool writes; projects converge via the existing DOCS_MERGE union/insert; hand-deleted instances self-heal via reconcileWiring; TB-01 arm closes the drift gap | needs a new validate arm (the zone gates cannot see the block); vendor text changes require a re-sync wave | **Chosen** |
| C. Templates carry nothing; prose arrives only via per-project `trail init` | zero conflict surface; prose always accurate (indexed repos only) | abandons the fleet-standard goal; leaves today's 2-template drift ungated and unexplained; fresh scaffolds run `trail build` (new-project.ts:1912-1932) — indexed repos without the usage doctrine their index was built for | Rejected |

### D2 — `.trail` wiring delivery policy

| Option | Pro | Con | Decision |
|---|---|---|---|
| A. Ship a skeleton (hook.cjs + README.md + .gitignore in templates/common) + SessionStart hook entry (chosen) | vendor's own commit-once doctrine (.trail/README.md:13); hook works standalone as the learnings injector with trail NOT installed (hook.cjs:124-160) and is a silent no-op with zero learnings (:126-131); `    | vendored bytes can lag vendor updates (mitigation: the hook is a self-locating loader; `trail init` refreshes it; an outdated hook no-ops safely) | **Chosen** |
| B. Document `trail init` as an operator action; templates carry instructions only (current root posture generalized) | no vendored bytes | contradicts the commit-once doctrine the workspace already adopted at L0; 15/17 projects keep NO learnings channel indefinitely; the MCP surface is already fleet-delivered (§1 item 4) — wiring becomes the ONLY trail surface not shipped, which is incoherent | Rejected |

### D3 — where the learnings doctrine lives

| Option | Pro | Con | Decision |
|---|---|---|---|
| A. New "Learnings notes" section in skills/trail/SKILL.md (chosen) | the skill is the trail doctrine SSOT (workspace-tracked, lifecycle-gated frontmatter — self-managed-surfaces.json reason); discoverable exactly where an agent looks before using trail | one more section in a 208-line file | **Chosen** |
| B. `.trail/README.md` | the file agents see first | tool-owned bytes — hand edits are reverted/overwritten at the next init (tool-managed surface, skills/trail/SKILL.md:106-110 mechanics) | Rejected |
| C. Standalone doc (docs/governance/…) | unconstrained length | fragments doctrine: trail usage lives in the skill; a second surface goes stale | Rejected |

### D4 — parity enforcement shape

| Option | Pro | Con | Decision |
|---|---|---|---|
| A. Extend PM-04b to also extract trail markers | no new check function | couples two unrelated contracts (zone parity, tool-block parity); PM-04b's failure messages/remediation are zone-specific | Rejected |
| B. New TB-01 arm in validate-templates.ts, PM-04b's shape (chosen) | mirrors the ADR-0081 arm precedent (validate-templates.ts:5627); independent severity (WARN on root divergence — root is tool-owned) | one more arm to maintain | **Chosen** |

## 5. Chosen design

### 5.1 D1 — AGENTS.md trail block: tool-managed marker block, fleet-pinned

The block stays a `<!-- trail:start -->…<!-- trail:end -->` marker block,
outside every workspace-managed zone. Changes:

1. `templates/common/AGENTS.md` keeps its copy (294-334) as the canonical L1
   seed — byte-identical to root's (AGENTS.md:291-331), which is what the tool
   writes at init (verified across four independent installs, §2).
2. All 15 variant templates' AGENTS.md gain the identical block. Delivery into
   projects: DOCS_MERGE union/insert (upgrade-project.ts:2888-2930) — a project
   lacking the block gets it; a project whose block is byte-equal produces zero
   census rows; a tool-rewritten or hand-adapted block is classified by the
   instruction-region census (upgrade-project.ts:2109-2130) and — if divergent —
   blocked as CONFLICT with the adjudicated-port disposition, never silently
   overwritten.
3. The block text is NOT reworded by the workspace (the "This repo is indexed
   in `.trail/cache/`" opening is vendor text; rewording invites a
   template-vs-tool fight the next time `upsertSection` runs). Accuracy
   caveats are recorded here, not patched into the vendor prose.

### 5.2 D2 — `.trail` skeleton shipped at L1, registered as upgrade seeds

1. **New `templates/common/.trail/`** — exactly three files, byte-identical to
   root's tracked trio: `hook.cjs`, `README.md`, `.gitignore`. No learnings dir
   is seeded (git cannot track empty directories; `offerTrail` handles the
   missing dir as a silent no-op, hook.cjs:126-131; the dir appears with the
   first note). `templates/common/.gitignore` already carries the trail-era
   block (verified lines 75-78: `.trail/cache/`, helper ignores).
2. **`templates/common/.claude/settings.json`** gains the SessionStart entry,
   mirroring root (.claude/settings.json:114):
   `node "${CLAUDE_PROJECT_DIR:-.}/.trail/hook.cjs" session-start || exit 0`
   (timeout 10). `|| exit 0` makes the hook fail-safe when `.trail/hook.cjs`
   is absent (pre-skeleton projects, hand-deleted trees). Variant settings.json
   propagate mechanically via sync-variant-settings.ts (delete-guard entry
   precedent, sync-variant-settings.ts:5, :37).
3. **Scaffold delivery**: automatic — copyDir copies the whole common tree and
   the skip list is only `['node_modules', '.gateguard-state']`
   (new-project.ts:896, scaffold-markers.ts:265). Zero scaffold-code change.
4. **Upgrade delivery**: explicit ADD_IF_MISSING claims in
   scripts/lib/upgrade-policy.ts for `.trail/hook.cjs`, `.trail/README.md`,
   `.trail/.gitignore` (claim-table precedent: `.claude/skills/graft/**`,
   upgrade-policy.ts:331). ADD_IF_MISSING semantics guarantee: absent → seeded;
   present → withheld (tool-refreshed copies are never clobbered). The existing
   trail-migration guards are untouched (`TRAIL_RETIRED_SEEDS`/
   `isTrailRetiredSeed`, upgrade-policy.ts:436-444; hook-entry existsSync guard,
   upgrade-project.ts:4558-4593).
5. **Registry note**: docs/self-managed-surfaces.json trail entry `reason`
   gains one sentence: the L1 template ships the tracked tool-owned wiring
   (skeleton) so scaffolds and upgrade seeds deliver it; skip semantics
   unchanged.

### 5.3 D3 — learnings-notes standard (skills/trail/SKILL.md § "Learnings notes")

New section in skills/trail/SKILL.md, codifying what the hook parses and the
vendor writes:

- **Naming**: `YYYY-MM-DD-<slug>-<author>.md` — date prefix is load-bearing
  (liveFiles derives the note date from it when front matter omits `date`,
  hook.cjs:180).
- **Front matter** (what the hook's parser reads — hook.cjs:166-200): `title`,
  `author`, `date` (YYYY-MM-DD), `id` (`l-` + 6-16 hex; stable identity for
  `replaces` chains), `scope` (`repo`), `status` (`active` | `held` |
  `replaced` | `retired`), `touches` (repo paths), optional `replaces: l-…`.
  Only `status: active` notes are injected; a note is retired by writing a new
  note with `replaces: <old id>` — never by editing the old one.
- **Body**: `## Decided` (+ inline **Why**), `## Watch out`; short summaries,
  never transcripts (.trail/README.md:14-15); cite ticket ids / design paths
  instead of restating them; trailing one-line attribution.
- **Who writes**: trail itself when installed (the co-newbiz corpus is
  tool-written); by hand following the same shape when it is not — the
  learnings-only hook injects hand-written notes identically.
- **Read/credit protocol**: read what bears on the task before exploring;
  credit the author when a learning shapes the reply (the hook's own injected
  instruction, hook.cjs:152-158).
- **vs memory/**: `memory/` is the L0 workspace session-log audit trail
  (agent-authored, workflow record). Learnings are per-repo distilled technical
  knowledge for the next session (human-attributed, git-tracked, auto-injected
  at session start). Dedupe rule: a learning DISTILLS — it cites
  tickets/designs/memory blocks and never duplicates a transcript; overlap
  between the two is complementary by design, not drift.

### 5.4 D4 — TB-01: trail-block parity arm (validate-templates.ts)

New check in the PM-04b family (function after checkCommonAgentsBlockParity,
validate-templates.ts:5627):

- Extract the `<!-- trail:start -->…<!-- trail:end -->` block from every
  template AGENTS.md (common + 15 variants) and from root AGENTS.md.
- **Error**: a template AGENTS.md missing the block, or carrying a block whose
  normalized content (line-trimmed, blank-line-collapsed — PM-04b's
  normalization precedent) differs from templates/common's.
- **WARN** (not Error): root's block differs from templates/common's. Root's
  copy is tool-owned — a vendor update lands there first and the WARN names the
  re-sync action (copy the root block into templates/common, re-run the wave).
  Forcing root to match templates as an Error would make the workspace fight
  `upsertSection` mid-vendor-update.

## 6. Scope table (L0–L3)

| Level | Changes | Notes |
|---|---|---|
| L0 (workspace root) | **None required — already conformant** (block tool-written at AGENTS.md:291-331; wiring tracked; hook registered at .claude/settings.json:114; 2 learnings). TB-01 reads root's block as the WARN reference. Operator note (out of repo scope): user-level statusLine still points at the deleted graft-era helper — `trail init` wrote the trail-era shim to `.trail/statusline.cjs` and statusline registration lives in personal surfaces (§3 N3) | the reference deployment for the wiring state |
| L1 (templates/common) | AGENTS.md block kept (canonical seed); NEW `.trail/` skeleton (hook.cjs, README.md, .gitignore); `.claude/settings.json` SessionStart entry; upgrade-policy.ts ADD_IF_MISSING claims ×3; self-managed-surfaces.json reason note; TB-01 arm + unit tests | everything a scaffold needs on arrival |
| L2 (15 variant templates) | 15 × AGENTS.md gains the byte-identical trail block; settings.json hook entry arrives via sync-variant-settings.ts; TB-01 pins parity | **>3-template-file wave — high-risk threshold, explicit user confirmation required (§11 OQ1; project-loss-hardening R2 precedent: full wave in one PR, single phrase machine-pinned)** |
| L3 (Projects/*, machine-local checkouts) | converge via upgrade visits — skeleton seeds (ADD_IF_MISSING) + AGENTS.md block (DOCS_MERGE union/insert); NEVER hand-edited (2026-10-31 R2.6). Already-converged: co-architect / co-develop / co-newbiz carry the block (byte-equal → zero-row upgrades); co-develop + co-newbiz have `.trail` (seeds withheld); co-newbiz is the learnings reference deployment | census 2026-11-08: 3/17 with block, 2/17 with `.trail`, 1/17 with learnings |

**Platform Impact (mandatory)**

| Platform | Impact | Files |
|---|---|---|
| Claude Code | changes required — the hook registration surface | templates/common/.claude/settings.json (+15 variants via sync-variant-settings.ts) |
| Antigravity (GEMINI.md) | None — **justification**: hook.cjs implements Claude Code's hook contract (SessionStart `hookSpecificOutput`, hook.cjs:160); Antigravity does not fire hooks and GEMINI.md is not in scope; trail's own per-agent wiring (AGENTS.md block) is platform-neutral | N/A |
| Gemini CLI | None v1 — **justification**: the vendor wires Gemini at `trail init` time (its own per-agent surface); this design ships the Claude-convention wiring the vendor marks "shared" | N/A |
| Codex / Hermes / ZCode | None v1 — **justification**: same as Gemini; the AGENTS.md block and MCP entries (already fleet-delivered) are the cross-platform surfaces | N/A |
| templates/common | propagation required | listed in the L1 row |

## 7. Test / gate plan

- **Unit tests (new)**:
  - `tests/unit/validate-trail-block-parity.test.ts` — TB-01 extraction and
    verdicts: block present/equal → pass; variant missing the block → Error;
    variant block diverged → Error; root differs from common → WARN; the
    16 real template AGENTS.md files + root pass as a fixture set.
  - `tests/unit/upgrade-trail-skeleton.test.ts` — upgrade-policy claims:
    `.trail/{hook.cjs,README.md,.gitignore}` resolve ADD_IF_MISSING; present
    copies are withheld (SEED_SKIP row, INFO); a `.trail`-marked project's
    graft-era retired seeds still SEED_SKIP (TRAIL_RETIRED_SEEDS regression);
    scaffold fixture: `copyDir` delivers `templates/common/.trail/` to a fresh
    project.
- **Gates**: `bun scripts/validate-templates.ts` (0 errors; TB-01 green on
  16/16); `bun scripts/audit.ts`; Design Gate spec-check via
  `bun scripts/spec-register.ts --file docs/designs/2026-11-08-trail-fleet-standard-design.md --source manual --status implemented`.
- **Tool-side verification (probe only, no fleet writes)**: `trail init
  --dry-run` inside a scaffolded fixture confirms the skeleton is init-stable
  (init rewrites hook.cjs with vendor bytes / hands over — seed withholding
  means the workspace never re-overwrites it afterwards).

## 8. Rollout order

1. **Phase B1 — L1** (one PR, this design's implementation): common skeleton +
   settings entry + upgrade-policy claims + registry note + TB-01 (WARN-only
   posture until the wave lands) + unit tests. `bun install --frozen-lockfile`
   first in a fresh checkout (PR #1899 precedent).
2. **Phase B2 — L2 wave**: the 15 variant AGENTS.md blocks + TB-01 Enforcement
   Error severity + sync-variant-settings run; same PR as B1 if the §11 ruling
   approves the full wave, otherwise an immediately-following PR.
3. **Phase B3 — L3 convergence**: projects pick the skeleton and block up at
   their natural upgrade visits; no scripted fleet migration.
4. **Closeout**: spec-register, VERSION_MANIFEST/SCRIPTS.md rows for any
   version-bumped scripts (upgrade-policy.ts, validate-templates.ts),
   T-20261108-001 → done with the §11 ruling decisions recorded
   (docs/decisions/DEC-20261108-0N.md).

## 9. Risks

| Risk | Mitigation |
|---|---|
| 15-file AGENTS.md wave churn (high-risk threshold) | same shape as the approved project-loss-hardening R2 wave: one identical block, machine-pinned by TB-01; explicit ruling requested (§11 OQ1) |
| Vendor changes the block text → root (tool-rewritten) diverges from templates | TB-01 WARN names the re-sync; project-side divergent blocks hit the census CONFLICT path (upgrade-project.ts:2128-2134) which BLOCKS and names adjudicated-port — no silent clobber either direction; observed vendor text is byte-stable across four installs spanning 2026-11-01…11-07 |
| Skeleton hook.cjs lags vendor updates | the hook is a self-locating loader (resolves the installed package at runtime, hook.cjs:11-117); `trail init` refreshes it in place; ADD_IF_MISSING seeds never overwrite a tool-refreshed copy; an outdated hook degrades to no-op, never to error (`|| exit 0`, :124 catch) |
| Trail not installed on a machine | hook fallback IS the designed no-trail path: learnings injected from plain files; zero learnings → silent return (hook.cjs:126-131); MCP entries already tolerate the missing binary (non-fatal scaffold pattern, new-project.ts:1924-1932) |
| Tracked `.trail/` in templates vs self-managed validators | the registry reason already sanctions tracked tool-owned wiring (§2); validators skip instance content and the tracked `skills/trail/` SSOT stays lifecycle-gated; the added reason sentence documents the L1 skeleton |
| Project hand-edited its trail block | census classifies it as an adapted span → CONFLICT (ERROR) → upgrade exits non-zero with the adjudicated-port procedure; pre-upgrade stash covers rollback |
| co-newbiz / co-abap-plugin have no variant template | upgrade resolution for these instances verified at implementation time (B1 test fixture uses a standard variant; the two exceptions are noted in the ticket, not silently assumed) |
| Fresh scaffold's graph dir is `<repo>/graft` (0.28.1 vendor note) while the block says `.trail/cache/` | vendor-known; the project's own `trail init` migrates it; `trail ask`/`trail mcp` resolve both layouts (2026-10-31 design A1); recorded, not patched into vendor prose |

## 10. Accessibility

Documentation, template, and script-gate changes only — no UI, no user-facing
rendered surfaces. **Exempt from ADR-0065 accessibility review** (no UI change).

## 11. Open questions (user ruling needed before implementation)

1. **Variant wave scope (OQ1)**: updating all 15 variant `AGENTS.md` files
   exceeds the architect's 3-template-file high-risk threshold — approve the
   full 15-file wave in the B1/B2 PR (recommended: one PR, TB-01-pinned,
   project-loss-hardening R2 precedent), or L1-only first with the wave as a
   follow-up?
2. **D2 confirmation (OQ2)**: ship the `.trail` skeleton + SessionStart hook
   entry fleet-wide (Option A, recommended — vendor commit-once doctrine,
   learnings channel works without trail installed), or keep `trail init` as a
   per-project operator action (Option B)?
3. **TB-01 root severity (OQ3)**: root's tool-owned block checked at WARN
   (recommended — the workspace must not fight `upsertSection`), with
   templates/common + variants at Error — confirm.
4. **Statusline out of scope (OQ4)**: `.trail/statusline.cjs` and its
   registration live in personal surfaces (`.claude/settings.local.json`,
   user-level settings — probe evidence §2); standardizing them is proposed as
   a non-goal (N3) with the dangling user-level registration recorded as an
   operator note — confirm, or pull statusline into scope as a follow-up.
