# MAINTENANCE_PLAYBOOK — Maintaining Fielded Handbooks (M-Stage)

> Audience: agents and maintainers updating an **existing** handbook
> (fielded references: `Handbooks/intro-to-ai-harness`,
> `Handbooks/multi-agent-harness-handbook`).
> Source: the 2026-09-20 upstream-sync session — new Ch. 13 + capstone
> renumber to Ch. 14, `--platform both→all`, graft-first scaffolding, and
> the lecture-schedule accuracy review (three sweeps were needed before
> every renumber reference was caught; two stale note strings survived the
> first pass).
>
> Creation of a NEW handbook is the H-Stage (see SKILL.md). This playbook
> covers everything that happens after launch.

## 0. Ground rules (apply to every M-stage)

1. A handbook is an **independent git repository** (not part of the
   workspace repo). Land changes PR-only, English commit/PR text, one PR
   per handbook per sync.
2. **Four languages, one commit**: ko (canonical, no suffix) + `_en/_ja/_es`
   change together. Structural parity (h1/h2/h3/`<pre>` counts) is a hard
   gate — see I18N_PARITY_PLAYBOOK.md.
3. **Local gate = `bun run ci` + `bun run check-i18n`** before pushing.
   `bun run ci` runs the exact CI chain: validate-handbook, check-symmetry,
   check-links, check-labels, check-authoring, handbook-doctor, check-a11y,
   check-spell, check-lint, check-external-links, check-search.
4. Finish every content sync with: `build-search-index` (after manifest or
   body changes) → `bun run ci` → `check-i18n` → CHANGELOG entry → PR.
5. Before attributing any warning to your change, rerun the failing check
   on a clean tree (`git stash` → run → `git stash pop`). Known noisy,
   usually-pre-existing signals: i18n numeric-token warns; transient
   external-link timeouts (retry once before diagnosing).

## 1. M-1 Upstream sync (reflecting source-of-truth changes)

1. **Inventory the upstream delta first** — list what changed since the
   handbook's last sync (upstream CHANGELOG / ADRs / script usage lines),
   and decide per item: teach it (which page, which depth), ignore (with a
   one-line reason), or defer.
2. **Impact-scan the docs before writing**: grep for every identifier the
   delta touches — CLI flags and their value lists (`both`/`all`), category
   counts (`5분류` vs the chapter's 8), script names and versions, chapter
   number references, platform enumerations. Expect stale copies in
   schedule tables and instructor notes, not just the chapter body.
3. **Verify against the chapter source**, not against another summary:
   update the handbook's own claims (counts, defaults, semantics), then
   edit ko, then translate in the same commit.
4. Record the sync window in the handbook CHANGELOG ("Synced with
   `ai-workspace-standards` main (YYYY-MM-DD)") and bump the footer
   baseline (M-4).

## 2. M-2a Add a chapter (checklist)

Everything below, ×4 languages, one PR:

1. Page file in a chapter folder, following the chapter template's 5-part
   structure comment (title/number/lead → nav → keypoints → h2/h3 body →
   chapter-nav). Every `<pre>` needs a copy button; inline SVG only (no
   `<img>`); design tokens only.
2. **chapter-nav chain**: previous chapter's `next` → new page; new page's
   `prev`/`next`; successor's `prev` → new page. check-symmetry enforces
   the back-links; **check-labels enforces that the chapter number in a
   nav label matches the target page title's number**.
3. Adjacent pages' `<nav>` sidebars (`다른 장` lists) get a link too.
4. `index.html` ×4: chapter card in the right day/group, localized tag
   (`13장` / `Ch.13` / `13章` / `Cap.13`) and go-label.
5. `docs/search-manifest.json`: 4 entries (ko/en/ja/es) with localized
   titles → run `build-search-index` (regenerates `search-data.js`;
   `check-search` verifies manifest ↔ index sync).
6. Lecture guide: schedule-table row (`구분/내용/형태/시간` columns), per-chapter
   instructor note, comprehension quiz. Update the day-total row and the
   breaks note.
7. Course overview: schedule block (time + h4 + description + tags),
   topics-table row; keep block order = teaching order.
8. README curriculum list ×4 languages.
9. Nav title of the page and its `nav-title`/`chapter-eyebrow` carry the
   chapter number — they feed check-labels.

## 3. M-2b Renumber / rename a chapter (sweep list)

Renumbering is mechanical but sweeping is the whole job — the 2026-09-20
capstone 13→14 renumber needed **three passes** because number variants
escaped the first sed. Full sweep:

1. `git mv` all language files (keeps history; check-structure's
   language-pair rule tracks the rename).
2. Inside the renamed pages: `<title>`, meta description, `nav-title`,
   `chapter-eyebrow`, lead text, self-referential links.
3. **Href sweep**: `<old-stem>.html` → `<new-stem>.html` across every file
   (docs + manifest + search-data).
4. **Localized number-variant sweep** — all of these, per language:
   `13장` · `Chapter 13` · `第13章` · `第13章・` (separator variants) ·
   `Capítulo 13` · lowercase `capítulo 13` · `Ch. 13` · `Ch.13` ·
   `13章` (no prefix) · `Cap. 13` · `Cap.13` · SVG `<text>` labels
   (e.g. `Ch. 13`, `第11~13章` ranges). Ranges: replacing `13章→14章`
   inside `第11~13章` yields the correct `第11~14章` — sweep by substring,
   not by whole-phrase.
5. Downstream registries: `search-manifest.json` (paths + titles),
   READMEs (curriculum lines, all languages), lecture guide (schedule row,
   instructor-note h3, quiz title, `1~N장` range phrasing), course
   overview (schedule block h4, topics-table row), FAQ links, glossary
   `see` links.
6. Re-verify nav symmetry + labels (validate-handbook) — they catch any
   href/label you missed.

## 4. M-3 Schedule consistency (lecture guide ↔ course overview)

The lecture guide and course overview are two views of one schedule. The
2026-09-20 review found: stale category counts, a day total that didn't
match its rows, a both-days total that didn't match the day totals, and
instructor notes in a different order than the teaching sequence. Rules:

1. **Lockstep**: any schedule change (add/reorder/retime a block) lands in
   BOTH files, all 4 languages, same PR.
2. **Order = chapter order** for the theory blocks; the unnumbered Common
   Reference (tool comparison, incl. the exercise-tool selection guide)
   sits directly before the hands-on track as a bridge. Instructor notes
   follow the same order as the schedule table.
3. **Recompute totals programmatically** — sum the `<td>` minute cells per
   table (per language) and compare with the printed total row, the break
   notes, and the both-days total. Never hand-sum; re-verify after any
   time change.
4. **Note strings that cite times move with the rows**: e.g. a note saying
   "exercise (D-1) 40 min" silently contradicts a retimed 50-min row.
   Grep the notes for each changed time value.
5. Day totals: 2026-09-20 baseline — Day 1 ≈ 5 h 45 min, Day 2 ≈ 6 h 25
   min (excl. breaks; Day-2 note carries a compression lever for shorter
   venues). Change these only with a new schedule review.

## 5. M-4 Footer baseline + page-level dates

1. The per-language site footer (with the "ai-workspace-standards main
   (YYYY-MM-DD) `기준`" baseline) is the `FOOTERS` constant in
   `scripts/update-footers.ts`. To advance the baseline: edit the constant,
   run `bun run update-footers`, and commit both (constant + pages).
2. Do NOT hand-edit footer blocks per page — the footer checker enforces
   byte-identical footers per language site-wide.
3. `version-row` values on manual pages (e.g. `문서 수집일` / document
   collection date) are page **content** dates — leave them alone during a
   baseline bump.

## 6. M-5 Verification triage

1. `bun run ci` + `bun run check-i18n` — both green, all 4 languages.
2. Clean-tree triage for surprises: `git stash` → rerun the failing check
   → `git stash pop`. Pre-existing warns seen in the field: i18n
   numeric-token warns (translated prose drops `$0`-style tokens),
   check-authoring mid-word-strong warns.
3. Transient failures: external-link checks time out on flaky hosts
   (YouTube) — retry once on the working tree before investigating.
4. Ship: CHANGELOG entry (Added/Changed/Fixed per Keep-a-Changelog) +
   PR. PR body lists the upstream items reflected, the sweep performed,
   and the verification result.
