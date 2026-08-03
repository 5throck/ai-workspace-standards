# Explain Me — Single-File Interactive Report Build Instructions (Generic, Multi-Language, Self-Contained)

Based on [beret21/reportme](https://github.com/beret21/reportme) v0.4.1, MIT license. Translated and adapted for multi-platform use.

> This document is a **"report generation engine"** not tied to any specific topic or language.
> Swap in the topic (`TOPIC`), user data (`SOURCE_DATA`), and language (`LANG`) to produce
> a **single self-contained HTML report** with identical design, interaction, and quality.
>
> **The output is a single file.** CSS, JS, and data are all inlined — **opens directly from
> disk with no server or build step.** Delivered as a local file by default; only when the
> user **explicitly requests `publish`** is it uploaded to GitHub Pages via §12.5.
> Multi-language versions use separate files per language + a static switcher (§2-C).
>
> **Validation is mandatory, not optional.** Completion only after passing §6 (content) and
> §7 (language expression). §7.5 (SVG diagramming) is recommended.

"this skill's directory" = the folder where this skill is installed (parent of `references/`).

---

## 0. Before You Start — Parameter Definitions (obtained from the user)

Each new session must first **confirm these values with the user.** Topic/data and language
must always come from the user — never be set arbitrarily.

| Parameter | Meaning | Example |
|-----------|---------|---------|
| `TOPIC` | Subject to cover — **user input required in research mode** | "Domestic EV Market 2026" |
| `SOURCE_DATA` | User-provided data (**file path / URL / pasted text**) — used in render mode | `./analysis.md`, `./data.json` |
| `SOURCE_MODE` | `research` (investigate & write) / `data` (render provided data) — **auto-detected** | `data` |
| `LANG` | Content writing language — **suggest request language as default, then confirm** | Korean / English / 日本語 |
| `LANGS` | (Optional) Multi-language list — **default 1 (=LANG). Recommended ≤3, >5 prohibited** (§2-C) | ko,en / ko,en,ja |
| `DEPTH` | Report depth — `brief` / `standard` (default) / `deep`. **Minimums per level in §2-D** | standard |
| `REPO`/`OWNER`/`VIS` | (Optional — `publish` only) Repo slug · GitHub account · visibility | `ev-report-2026` / beret21 / private |
| `TABS` | Top-tab layout (= section groups) — **propose based on report nature, get approval** | Overview · Market Analysis · Appendix |
| `OFFICIAL_SOURCES` | (research) Official primary sources (URLs, CLIs, etc.) | Stats office, manufacturer releases |
| `VERSION_TARGET` | Data reference point / version | "As of June 2026" |
| `PROJECT_DIR` | Absolute path for output folder | `…/Reports/EV` |
| `OUT` | Output HTML filename | `<slug>.html` (folder-name default) |

> **`LANG`:** Auto-detect the prompting language as default. Lightly confirm. If `--lang` is
> specified, use that. Write all prose in `LANG`. **Code, commands, identifiers, file paths,
> URLs: keep original English. Proper nouns: do not force-translate.** `<html lang>` matches `LANG`.
>
> **`SOURCE_MODE` (hybrid):** If user **provided data** → `data` (structure/visualize, skip research).
> If **no data** → `research` (investigate official docs, then write). Partial data → render what
> exists, research-fill the rest. If ambiguous, ask the user.

Always follow: **"Verify over assume — only write what is confirmed from official docs or provided data."**

---

## 1. Single-File Principle (backbone of this skill)

- **Output = exactly 1 HTML file.** No separate CSS, JS, image, or data files. Everything inlined.
- **No external resources or `fetch()`/XHR.** `file://` CORS blocks external loading. Data is
  **baked into** markup or `<script>` constants (e.g., template's `REFS`).
- **Images (if truly needed):** `data:` URIs only. Prefer inline SVG (§7.5) for diagrams.
- **No deployment by default.** Deliver as-is. Only **explicit `publish` request** triggers §12.5.
- Multi-language: **each language gets its own complete single file**, linked by static links
  (no in-script language switching — avoids bloat, complexity, and Pages script errors).

---

## 2. Content Source Determination + Tab/Section Layout (no guessing)

### 2-A. Source Mode
- **`research`:** Investigate `OFFICIAL_SOURCES` via `WebSearch`/`WebFetch`. **Write only
  confirmed facts.** Record version (`VERSION_TARGET`) and **collection date**.
- **`data`:** **Structure** user data — file paths fetched with `Read`, URLs with `WebFetch`.
  No fabricating facts absent from the data. Cite sources with links per §5.
- Both modes: list scope → **propose tab/section split** → get user approval.

### 2-B. Tab/Section Layout — Dynamic Proposal (no forcing)

Top tab = major topic group (one panel). Inside each tab, `<h2>` sections. Common patterns:

| Report Type | Example Tabs |
|-------------|-------------|
| **Market/Industry Analysis** | Overview · Market Analysis · Competitive Landscape · Outlook · Appendix |
| **Technology/Product Comparison** | Overview · Comparison Matrix (Heatmap) · Details · References |
| **Planning/Roadmap** | Background · Goals · Timeline (block cards) · Risks · Appendix |
| **Survey/Research Summary** | Summary · Findings · Evidence Data · Methodology · Sources |
| **Catalog/Lineage** | Overview · Item List (reference drawer) · Relationship Diagram (SVG) · Appendix |

- Example proposal: "I propose **4 tabs: Overview · Market Analysis · Competitive Landscape
  (heatmap) · Appendix**. Shall I proceed?"
- 1–2 tabs may be sufficient for short reports. Do not pad.
- **Reference drawers (§8)** add detail without breaking body flow. Not required for every report.

### 2-C. Multi-Language Versions (Optional — `LANGS`): Per-Language Files, No In-File Switching

**Create one complete single file per language**, linked by the header's `.lang-switch`
via **relative-path links.** In-script language switching is **not used** — it bloats files,
complicates search/drawer logic, and causes script errors on static hosts.

- **Language count: default 1, ≤3 recommended, >5 prohibited.** Each added language means
  §6+§7 runs **one full extra pass**, and edits must **sync across all language files**.
  If user requests ≥6, refuse and propose ≤3.
- **Naming:** Primary = `<slug>.html`, additional = `<slug>.<lang>.html`. If deploying,
  use `index.html` / `index.<lang>.html` from the start.
- **Order:** Complete primary language through §5–§7 → translate to per-language files
  (identical content/numbers/structure, prose only translated) → §7 review per language →
  §13-0 per language. §6 content validation on primary language once suffices.
- **Switcher:** All files get the same `.lang-switch` block (`cur` on self). Code/identifiers/
  proper nouns stay original. `<html lang>` matches each file's language.
- Single-language: **delete the `.lang-switch` `<nav>` block entirely** (§13-0 catches leftovers).

### 2-D. Depth Criteria (`DEPTH`) — Do Not Complete if Minimums Unmet

Primary cause of "accurate but thin" reports: **no depth standards + cost pressure leads the
agent to silently reduce volume.** Enforce these minimums. Default: `standard`.

| Criterion | `brief` | `standard` (default) | `deep` |
|-----------|---------|---------------------|--------|
| Independent sources | ≥4 | **≥8** | ≥12 |
| Full-text reading (WebFetch) | ≥1 | **≥3** | ≥5 |
| Real-world cases | Optional | **≥1** | ≥3 + failure cases ≥1 |
| Tab layout | 2–3 tabs, summary-focused | **3–5 tabs, 2–4 `<h2>` per tab** | 4–6 tabs + subtabs, frameworks/cases/industry views |
| §6 validation | 4 lenses (combined 1 pass OK) | **4 personas + 4 lenses — mandatory** | standard + completeness critique round |

- **Do not lower depth for multi-language.** Burden solution: **fewer languages** (§2-C), not
  less content. Depth reduction requires **user approval with trade-off explanation.**
- Do not write from search snippets alone — "full-text reading" means actually reading the
  document body and reflecting context beyond snippets.
- Count sources by **distinct publishing entity** (≥4 publishers recommended for diversity).
- If `--depth` unspecified and topic is broad → default `standard`+; urgent summary → propose `brief`.

---

## 3. Output Structure

```
PROJECT_DIR/
└── <slug>.html        ★ Output — single self-contained report
```
Multi-language adds `<slug>.<lang>.html` alongside. For publish (§12.5), files go into `docs/`:
```
PROJECT_DIR/
├── docs/
│   ├── index.html                 ★ Primary language (single self-contained, as-is)
│   ├── index.<lang>.html          (multi-language per-language files)
│   └── .nojekyll
├── .gitignore                     (local-only, not committed)
└── README.md                      (post-deployment, outside docs/)
```

- `<slug>`: lowercase no-space recommended. If deploying, use `index.html` from the start.
- Output is only the report file(s). Supplementary materials may be separate but HTML stays self-contained.

---

## 4. Template Copy + Placeholders

Templates are in **this skill's directory.** Do not look in external repos.

```bash
# Claude Code (Bash tool) / Antigravity/Gemini (run_command tool):
cp "this skill's directory/templates/report.html" "$PROJECT_DIR/<slug>.html"
```

After copying, **modification points** (template markers `{{…}}` / `[note: …]`):
1. `<html lang>` → `LANG`. `<title>` · `{{REPORT_TITLE}}` · `{{REPORT_SUBTITLE}}` ·
   `{{REPORT_DATE}}` · `{{SOURCES_SUMMARY}}`.
2. **Tabs:** `.tabs` buttons with `data-p` paired to `<section class="panel">` with matching
   `id`. (Template has 3 examples — duplicate/delete to match.)
3. **Panel content:** Fill `<h2>`, tables, `.kv`, `.card`, `.block`, heatmap, SVG, reference
   chips. Remove unused components (no empty shells).
4. **Reference drawer:** `<span class="ref" data-ref="key">label</span>` in body + matching entry
   in `REFS` object. Delete `.ref`/`REFS` examples if unused.
5. **Authoring date** set to actual date in §11.

CSS and interaction JS are **left as-is.** Use **only design tokens** (no inline hex).

---

## 5. Content Creation Standards

- **Only confirmed facts** — research: official docs; data mode: provided data. No fabrication.
- **Report style** — conclusion first. Each section: "one-line takeaway → evidence → detail."
  Dense tables, KV, cards over verbose prose.
- **Components (§8):** Core conclusions → `blockquote.key`; caveats → `.warn`; attributes → `.kv`;
  parallel items → `.card` grid; steps/timeline → `.block`; comparisons → heatmap; flows/
  structures → SVG; side detail → reference drawer.
- **Writing language = `LANG`.** No literal translation (§7 reviews). Code/commands/identifiers/
  file paths/URLs: English original. Proper nouns: original, briefly explain on first use only.
- **Table readability:** Even-row bg = `var(--even)`. Long descriptions → `<ul>`/`<ol>`.
- **Column crushing prevention:** Tables with 5+ columns or long cells → wrap in
  `<div class="tbl-wrap">…</div>`. Non-wrapping columns → `class="nw"`.
- **Inline data:** All tables, heatmaps, reference details in markup/`REFS`. No external files (§1).
- **Sources must be actual hyperlinks (mandatory):** Source tables, body data table source columns,
  KV evidence rows, `.src` lines, `REFS` evidence — all as `<a href="…" target="_blank"
  rel="noopener">label</a>`, **not plain-text domain strings.** Readers must click to verify.
  Links only use network on click (no conflict with §1). URL-less sources may remain plain text.
  Multi-language: **label translated, URL identical across languages.**

---

## 6. ★ Mandatory ① — Multi-Agent "Content" Validation

Content accuracy, logic, and contextual validity must be **validated via multi-agent harness
before application.** Do not write alone and call it done.

> **For `DEPTH`=standard+: §6-A (reader personas) cannot be skipped.** Running only §6-B lets
> "accurate but thin" reports pass — catching depth/omissions is §6-A's job.

### 6-A. Reader Personas → Writer (comprehension & persuasiveness)
- **Reader personas (parallel, minimum 4):**
  | Persona | Perspective |
  |----------|-------------|
  | Non-specialist decision-maker | Is conclusion visible first? Is evidence convincing? |
  | Domain practitioner | Are figures/claims accurate? What variables are missing? |
  | Skeptical reviewer | Any counterexamples, exaggerations, logical leaps? |
  | Data verifier | Are sources, collection dates, units, aggregation clear? |
- Each persona generates **specific questions/objections** → **writer agent** addresses all.

### 6-B. Review Lenses → Synthesis → Apply (fact & expression validation)
- **Review lenses (parallel):** Factual accuracy / Logical consistency / Data integrity
  (figures, units, sums) / Source reliability
- Each lens flags `{original, severity, problem, fix}` → **synthesis agent** deduplicates
  and finalizes → applied to file. **No over-editing** — only fix what's wrong or misleading.

### Harness Dispatch (Platform-Agnostic)

Dispatch subagents for each persona/lens using the platform's native subagent mechanism.
See `PLATFORM_HARNESS.md` for platform-specific dispatch patterns.

**Required flow:** (1) 4 reader persona subagents in parallel → (2) 1 writer subagent →
(3) 4 review lens subagents in parallel → (4) 1 synthesis subagent → (5) apply subagents
with exact-string replacements.

> Always **validate → synthesize → apply.** Never guess and modify the wrong location.

> **If subagent dispatch is unavailable** — perform one full manual review using the reader
> personas (§6), review lenses (§6), and language review perspectives (§7, §7-A-1 for Korean)
> as a checklist. Do not mark complete until passed.

---

## 7. ★ Mandatory ② — Language-Specific Grammar & Expression Review (pre-completion gate)

All prose must **pass the review harness for `LANG` before completion.** Polish for native
readability. Korean (`LANG`=Korean) is evaluated most strictly.

### 7-A. Proofreader Personas (parallel, per perspective — all languages)
| Proofreader | What They Catch |
|-------------|-----------------|
| Spelling/punctuation | Typos, grammar, punctuation. (Korean: Hangul spelling, spacing, particles) |
| Word order / literal translation | Translation tone — unnatural word order, passive/inanimate subject overuse → natural phrasing |
| Terminology consistency | Same concept not mixed with different terms; loanword/spelling consistency |
| Readability / tone | Excessive sentence length, active voice, conciseness, appropriate reader level |

### 7-A-1. Korean-Only — Strictest Additional Gate (only when `LANG`=Korean)
- **Unnecessary English loanwords (guideline-based judgment):** Per
  `references/loanword-refinements.json`, replace with natural Korean suited to context.
  Basis: National Institute of Korean Language 「Refined Words」. **Do not mechanically apply
  the dictionary** (exclude unsettled refined terms; keep established identifiers `API`·`HTML`·`URL`).
- Strictly catch: passive overuse (e.g. "~doeeojinda" patterns), inanimate subjects, excessive "~eul gajinda" patterns.

> **Other languages:** Review against that language's standard orthography/style.
> `loanword-refinements.json` is Korean-only. Search authoritative references for uncertain items.

### 7-B. Absolute Rules (all languages)
- **Never touch code, commands, identifiers, file paths, URLs, HTML tags, proper nouns,
  figures, or units.** Only **prose** is corrected.
- **Do not change meaning.** Only polish expression (accuracy already validated in §6).
- No over-correction — leave natural sentences as-is.

### 7-C. Flow

Dispatch proofreader subagents for each lens using the platform's native subagent mechanism.
See `PLATFORM_HARNESS.md` for platform-specific dispatch patterns.

- Scope: entire output HTML — **tables, KV, cards, callouts, `REFS` html, SVG captions, no exception.**
- After review, **report what was changed and why** to the user (with samples).

> Order: §6 (content) first → finalize → then §7 (expression).

---

## 7.5 ★ Recommended ③ — SVG Specialist Subagent for Diagramming

**Flows, states, structures, comparisons, relationships** hard to convey in text → visualize
as **inline SVG diagrams.** Delegate to an **SVG specialist subagent.**

### Candidates
- **Flows/procedures** → flowcharts (nodes + arrows, branches, loops)
- **Composition/hierarchy/relations** → trees, structure diagrams, relationship diagrams
- **State/mode comparison** → side-by-side comparison diagrams
- **Step sequences** → numbered-node sequences

### SVG Specifications (mandatory)
- **Inline SVG** (no external resources — §1). `<figure>` + `<figcaption>` "Figure N. Description."
- Responsive: `viewBox` + `width="100%" height="auto"` + `class="dgm"` + `style="max-width:<px>"`.
- Accessibility: `role="img"` + `<title>`/`<desc>`.
- **Only §8 design-token colors**, as `style="fill:var(--token);stroke:var(--token)"` — attribute
  `fill="var()"` does not work, **hardcoded hex breaks in dark theme.** System fonts for labels,
  monospace for commands/identifiers, `<marker>` for arrows. CJK labels: generous box sizing
  (~13px per char at 13px).
- **No overlap:** Badges + labels easily overlap — the #1 SVG defect. Labels start at
  **badge right edge + padding with `text-anchor="start"`.** Arrows must not cover nodes/labels.
- No excessive gradients/shadows. Information delivery takes priority.

### Validation / Order
- Content must **match §6-validated body text.**
- §13 render validation includes **SVG visual checks** (visibility, viewBox, no mobile overflow,
  no overlap). **Visually verify each figure via screenshot** (automated assertions cannot catch
  overlap). Fix and re-capture until clean.
- Recommended order: §6 content finalization → **SVG diagramming** → §7 language review.
- **Place only at optimal points** — do not force into every section.

---

## 8. Design System & Components (built into template `report.html`)

Inline `<style>` (no external CSS) + **light/dark 2-theme.** Same token names, different values:
```css
:root{ --bg --fg --muted --border --even --gray-bg --accent --green --amber --red --purple
       --card --accent-soft --key-bg --warn-bg --note-bg --fit2-bg --fit2-fg --fit1-fg
       --hit --hit-active --hit-line --chip-u --shadow }
:root[data-theme="dark"]{ /* same tokens, values swapped */ }
```
- **Theme toggle built-in** — button cycles auto→light→dark, remembered in `localStorage`.
  **Do not modify.**
- Colors: **tokens only** (no inline hex). Hex = **dark theme break.**
- Do not split themes into separate CSS file (§1 violation).
- SVG colors: `style="fill:var(--token)"` (§7.5). Attribute `fill="var()"` does not work.

**Core Components (pre-built into template):**
| Component | Class | Purpose |
|-----------|-------|---------|
| Top tabs | `.tabs`/`.tab[data-p]` + `.panel[id]` | Major topic switching (signature) |
| **Nested subtabs** | `.sidewrap`/`.sidetabs`/`.subtab[data-sp]` + `.subpanel[data-sp]` | 2-level tab subdivision |
| **Accordion** | `<details class="acc">`/`<summary>` (HTML5, no JS) | Collapse appendix/FAQ/long lists |
| Reference chip → drawer | `.ref[data-ref]` + `REFS{}` + `.drawer`/`.overlay` | Side detail without breaking flow (signature) |
| KV table | `.kv` | Attribute/meta listing |
| Card grid | `.grid2/3/4` + `.card` (`.tint`) | Parallel items |
| Block card | `.block`/`.blocks`/`.blk` (`.blk-l t/d/p`) | Steps, timeline, composition |
| Callout | `blockquote.key`/`.warn`/`.note` | Key/warning/note |
| Status chip | `.chip.g/a/r/b/u` | Labels, status |
| Heatmap | `.hm`/`.hm-wrap` + `td.fit3/2/1` + `.legend` | Comparison / fit metrics |
| **Wide table wrapper** | `.tbl-wrap` (+ `th/td.nw`) | Horizontal scroll instead of column crush |
| SVG diagram | `<figure>`/`.svgwrap`/`.dgm` | Flow/structure/relations (§7.5) |
| In-page search | Auto-injected (JS) | Search all panels, highlight, count |
| **Theme toggle** | Auto-injected `.theme-btn` | Auto/Light/Dark cycle |
| **Mobile subtab collapse** | Auto-injected `.subtab-toggle` | ≤720px: collapse left subtabs to "Current ▾" |

- Unused components: **delete** (no empty shells/placeholders).

### 8-A. Structure Choice — flat / nested subtabs / accordion

| Structure | When | How |
|-----------|------|-----|
| **flat (default)** | Most cases | Top tabs only, `<h2>`/`<h3>` sections inside |
| **Nested subtabs** | One tab has many sub-topics, long scroll | `.sidewrap` with `.subtab[data-sp]` → `.subpanel[data-sp]`, first pair `active` |
| **Accordion** | FAQ, terms, long evidence — **collapsed by default** | `<details class="acc"><summary>Title</summary><div class="acc-body">…</div></details>`, `open` attr to start expanded |

- Accordion: content in DOM → **in-page search finds it** and **auto-expands on navigation.**
- In-page search auto-reveals hidden tabs/subtabs/accordions when navigating to matches.

---

## 9. Search (Built Into Template — No Modification Needed)

- Template JS **auto-injects search bar** below tabs — highlights, counts, Enter navigation
  across all panels. Auto-reveals hidden tabs/subtabs/accordions on match navigation.
- SVG `<text>`, drawers, tabs, scripts excluded from search. **Do not modify.**
- No cross-page links (single file).

---

## 10. Authoring Date & Version

- Set header `.meta` date (`{{REPORT_DATE}}`) to actual date. Note `VERSION_TARGET` if different.
- Auto-inject before completion:
  ```bash
  # Claude Code (Bash tool) / Antigravity/Gemini (run_command tool):
  TODAY=$(date +"%Y-%m-%d")
  sed -i '' "s#Written <strong>[^<]*</strong>#Written <strong>$TODAY</strong>#" "$PROJECT_DIR/<slug>.html"
  ```

---

## 11. ★ Security — Prevent Secrets in Report Data

Report files are **delivered and shared.** Inlined credentials = leaked credentials.

- Before completion, scan for **API keys, tokens, passwords, PII, internal URLs:**
  ```bash
  # Claude Code (Bash tool) / Antigravity/Gemini (run_command tool):
  grep -InE '(AKIA[0-9A-Z]{16}|ghp_[0-9A-Za-z]{36}|xox[baprs]-[0-9A-Za-z-]+|-----BEGIN [A-Z ]*PRIVATE KEY-----|(api[_-]?key|secret|password|passwd|token)\s*[:=]\s*["'\''][^"'\'' ]{8,})' "$PROJECT_DIR/<slug>.html" \
    && echo "⛔ Secret suspected — remove before completion" || echo "✓ No secret patterns"
  ```
- If `SOURCE_DATA` contains sensitive info → **mask/exclude before report.** Confirm if unsure.

---

## 12. Delivery & Viewing (Default — No Deployment)

- Deliver `<slug>.html` **as-is.** Recipient double-clicks → browser opens. No server needed.
  ```bash
  # Claude Code (Bash tool) / Antigravity/Gemini (run_command tool):
  open "$PROJECT_DIR/<slug>.html"
  ```
- To update: edit HTML → §13-0 script → §6/§7 re-validate (changed scope) → update date → re-deliver.
  **File editing, not rebuild.**
- **Do not deploy without explicit user request.**

---

## 12.5 Deployment (Optional — Only When User Requests `publish`): GitHub Pages

Execute only on explicit `publish` request. Artifact = same single file(s) from §1, no build.
Prerequisites: `git`·`gh` (logged in), git user set. **Only deploy after §6·§7·§11·§13 all pass.**

### 12.5-A. Policy
- **Default: private repo + public Pages** (requires GitHub Pro+).
- **Free accounts:** cannot enable private Pages — inform user, let them choose public or Pro upgrade.
- Publish folder: `/` or `docs` only → **use `docs/`**.
- Pages URLs are public — re-run §11 scan before deploy.

### 12.5-B. Repository Setup → Deployment

```bash
cd "$PROJECT_DIR"
mkdir -p docs
cp "<slug>.html" docs/index.html
cp "this skill's directory/templates/publish/.nojekyll" docs/.nojekyll
cp "this skill's directory/templates/publish/dot-gitignore" .gitignore

git init -b main
# (macOS) Prevent cloud sync from corrupting .git:
xattr -w 'com.apple.fileprovider.ignore#P' 1 "$(pwd)/.git"

# Verify docs/ only contains publishables:
git add .
git ls-files docs | grep -vE '(index([.a-z-]+)?\.html|\.nojekyll)$' \
  && echo "⛔ Non-publish files in docs/" || echo "✓ docs/ clean"

git commit -m "Publish $REPO (single-file report, docs/)"
gh auth status  # Verify active account matches OWNER
gh repo create "$REPO" $VIS --source=. --push
gh api -X POST "/repos/$OWNER/$REPO/pages" \
  -f build_type=legacy -f "source[branch]=main" -f "source[path]=/docs"
```

### 12.5-C. Post-Deployment Verification
```bash
# Claude Code (Bash tool) / Antigravity/Gemini (run_command tool):
CURL=$(command -v curl || echo /usr/bin/curl)
$CURL -s -o /dev/null -w "%{http_code}" "https://$OWNER.github.io/$REPO/?cb=$(date +%s)"
```
Then **open live URL in agent-browser** → verify §13-1 interactions (tabs, drawer, search,
theme, mobile collapse, language switcher). Script errors here = leaked external resources.

### 12.5-D. Post-Deployment README — Mandatory
Create `README.md` at repo root (`outside docs/`). Include: report title, description,
**live link `https://<OWNER>.github.io/<REPO>/`**, per-language links, data reference point.

### 12.5-E. Updates
Edit local → §13-0 → §6/§7 re-validate → update date → **sync all language files** (§2-C) →
§11 re-scan → copy to `docs/` → `git add . && git commit && git push`.

---

## 13. Validation Procedures

### 13-0. Structural Consistency Script (mandatory after edits/section moves)

Before render validation, **mechanically catch broken pairs** with the bundled script.
Tab↔panel, ref↔REFS, subtab pairs **silently break during editing** — always re-run:

```bash
# Claude Code (Bash tool) / Antigravity/Gemini (run_command tool):
python3 "this skill's directory/scripts/validate_report.py" "$PROJECT_DIR/<slug>.html"
```

Checks: `data-p`↔`id` pairs · 1 active · `.ref`↔`REFS` keys · `data-sp` pairs · duplicate ids ·
remaining placeholders (`{{…}}`/`[note:`) · external resources · `fetch()` · `<html lang>`.
**Fix until 0 errors (exit 0)** before render validation.

### 13-1. Render & Interaction (Actual Browser)

Render in **actual browser** (prefer `agent-browser`, fallback Playwright). Verify:
- **Tab switching:** Each tab → only its panel visible.
- **Reference drawer:** `.ref` click → drawer opens, content shown, closes via ×/Esc/overlay.
- **In-page search:** Highlights, count, Enter navigation, auto-tab-reveal for hidden matches.
- **Theme:** Toggle cycles auto→light→dark — **all components change bg/text in dark?**
  Non-changing parts = inline hex (replace with token).
- **Mobile subtab collapse** (sidewrap): At 375px, left panel → "Current ▾" button, expand→select→auto-close.
- **Heatmap:** Horizontal scroll, colors OK, no 375px overflow.
- **Wide table** (`.tbl-wrap`): No page overflow at 375px; scroll only within table.
- **SVG:** Screenshot visual check — (a) no text overflow, (b) **no badge/label overlap**,
  (c) arrows don't cover nodes. Fix and re-capture until clean.
- **`file://` self-sufficiency:** All interactions work at `file://` (no external fetch).

---

## 14. Pitfalls & Lessons Learned (Do Not Repeat)

| Pitfall | Fix |
|---------|-----|
| External data file (`data.json`) + `fetch` | `file://` CORS blocks → **Inline everything** (§1) |
| External CSS/font/image links | Single file breaks → inline `<style>`, system fonts, `data:` URI / inline SVG |
| Inline hex colors | Dark theme breaks on that part → **Design tokens only** (`var(--…)`) (§8) |
| Tab `data-p` vs panel `id` mismatch | Panel won't show → match exactly (§4) |
| `.ref` key vs `REFS` key mismatch | Drawer won't open → use same key (§4) |
| Subtab `data-sp` mismatch / missing `active` | Subpanel won't show → same `data-sp`, `active` on first pair (§8-A) |
| **Pairs silently break after section moves** | **Re-run §13-0 after editing** — invisible to eye |
| Empty component shells / remaining placeholders | **Delete** (§8) — §13-0 catches leftovers |
| **Sources as plain text (domain names)** | Must be **`<a href>` hyperlinks** (§5). §13-0 warns "0 external links" |
| Table even-row bg as arbitrary hex | Use only `var(--even)` (breaks dark theme) |
| **Column crushing after table edits** | Wrap with `.tbl-wrap` for horizontal scroll (§5). Numeric cols → `.nw` |
| `1) 2) 3)` plain text in paragraphs | Use `<ol>`/`<ul>` |
| English literal-translation tone / unnecessary loanwords | §7 language review (Korean: 7-A-1). Preserve code/figures/proper nouns |
| SVG badge/label overlap | `text-anchor=start` after badge right edge (§7.5). **Screenshot visual check** |
| In-page search `<mark>` in SVG `<text>` → label corruption | Built-in guard in template — **do not modify** |
| Secrets/PII inlined in output | Pass §11 scan. Mask sensitive source data |
| In-file JS language switching for multi-language | **Per-language files + static switcher** (§2-C). ≤3 languages, >5 prohibited |
| **Silent depth/volume reduction under cost pressure** | Enforce §2-D minimums. Reduction needs **user approval**. Reduce languages, not content |
| Writing from search snippets only (no full-text reading) | Enforce §2-D full-text reading (standard: ≥3 via WebFetch) |
| Updating only some language files → content divergence | **Sync all languages** on every update (§12.5-E) |
| (publish) Cloud sync corrupts `.git` | `xattr -w 'com.apple.fileprovider.ignore#P' 1 .git` (§12.5-B) |
| (publish) Active `gh` account ≠ `OWNER` | `gh auth status` + `gh api user --jq .login` before deploy (§12.5-B) |
| (publish) Free plan can't have private Pages | Check plan → inform user (§12.5-A) |
| (publish) CDN cache hides updates | Verify with `?cb=$(date +%s)` or Ctrl+Shift+R (§12.5-C) |
| **Skipping validation and marking complete** | Must pass **all:** §6 + §7 + §11 + §13-0 **before** completion |

---

## 15. Execution Checklist

- [ ] Confirm parameters (**TOPIC/SOURCE_DATA and LANG from user** / SOURCE_MODE / TABS / OFFICIAL_SOURCES / VERSION_TARGET / PROJECT_DIR / OUT)
- [ ] **Propose tab/section layout + user approval** (§2-B)
- [ ] Gather content — (research) investigate official docs (record version/date, **preserve URLs**) / (data) structure user data
- [ ] **§2-D `DEPTH` minimums met** — sources, readings, cases, tab density. Do not proceed if unmet
- [ ] **Source hyperlinks** — all sources in tables/drawers are `<a href>` links (§5)
- [ ] **Copy `templates/report.html`** → `<slug>.html` (§4)
- [ ] Fill content — **`LANG` prose, English code, original proper nouns, inline data**, `<html lang>`. Delete unused components
- [ ] **§6 content validation harness** (personas→writer, lenses→synthesis→apply)
- [ ] **§7.5 SVG diagramming** (selective) — `text-anchor=start`, **visual screenshot check**
- [ ] **§7 language review harness** (Korean: 7-A-1 loanword refinement). Prose only, no over-correction
- [ ] Inject authoring date (§10)
- [ ] **Pass §11 secret/PII scan**
- [ ] **Pass §13-0 consistency script** (0 errors) — re-run after edits. Per-language files too
- [ ] **Pass §13-1 render & interaction** (tabs, drawer, search, **theme (dark)**, **mobile collapse**, heatmap, SVG, file:// self-sufficiency)
- [ ] (Multi-language §2-C) Language count ≤3 · §7 per language · switcher filenames match
- [ ] Deliver file + viewing instructions
- [ ] (Optional — **only on explicit `publish` request**) §12.5: docs/ → §11 re-scan → account check → repo+Pages → live verify → README

---

## 16. Kickoff Prompt Template (fill in parameters, paste into new session)

```text
Read this skill's build instructions (references/BUILD_GUIDE.md) start to finish, then follow exactly.

[TASK] Create a single-file interactive HTML report from <TOPIC or SOURCE_DATA> in <LANG>. Default: local file (no deployment). Publish to GitHub Pages via §12.5 only if I explicitly instruct.

[PARAMETERS]
- TOPIC / SOURCE_DATA = <topic (research) or data file path/URL (render)>
- SOURCE_MODE = <research | data — auto-detected>
- LANG  = <writing language. Default: my request language>
- LANGS = <(optional) multi-language list — ≤3 recommended, >5 prohibited. Per-language files + switcher (§2-C)>
- DEPTH = <brief | standard (default) | deep — observe §2-D minimums. Do not reduce for multi-language>
- TABS  = <proposed tab layout. E.g., Overview · Analysis · Appendix>
- OFFICIAL_SOURCES = <(research) official documents/data sources>
- VERSION_TARGET = <data reference point>
- PROJECT_DIR = <output folder absolute path>
- OUT = <slug>.html (index.html if deploying)
- REPO / OWNER / VIS = <(publish only) repo slug · gh account · private|public>

[MANDATORY — do not skip]
- No guessing: (research) write only after WebSearch/WebFetch verification / (data) only what's in provided data. Record version and collection date.
- Propose tab/section layout and get my approval before writing (§2).
- Single file, all inlined: no external CSS/JS/images/fetch. Data in markup/REFS (§1). Opens from file://.
- Write in LANG. Code/identifiers/figures: English/original. Proper nouns: original. Set <html lang>. Design tokens only.
- Run §6 content validation harness (personas→writer, lenses→synthesis→apply).
- Run §7.5 SVG specialist subagent for diagrams (optimal points, visual overlap check).
- Run §7 language review harness before completion (Korean: 7-A-1 loanword refinement). Prose only, no over-correction.
- Copy from this skill's templates/report.html. Write only new content.
- Security: pass §11 scan before delivery.
- Validation: scripts/validate_report.py for structural consistency (0 errors), then agent-browser/Playwright for tabs, drawer, search, theme (dark), mobile collapse, heatmap, SVG, file:// self-sufficiency.

[PROCESS] First (1) determine source mode/content plan, (2) present tab/section proposal. Get my confirmation on key decisions before implementing.
```

---

*Domain- and language-agnostic instructions. Reusable assets (template, `.gitignore`/`.nojekyll`,
consistency script, loanword refinement guidelines) are in `templates/`,
`scripts/`, and `references/`. Output is a single HTML report opening from disk; published to
GitHub Pages only upon explicit request (§12.5).*
