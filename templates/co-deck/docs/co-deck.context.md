# co-deck — Variant Configuration

> Extends docs/context.md. This file IS the customization layer for this project.
> context.md is IMMUTABLE — all project-specific changes belong here.
>
> Read order for all AI tools:
>   1. docs/context.md              — immutable project identity (architecture, standards)
>   2. docs/co-deck.context.md      — THIS FILE — tech stack, agents, skills, workflow

---

## Tech Stack

<!-- VARIANT-INJECT: tech-stack -->
| Layer | Technology |
|-------|-----------|
| **Language** | Python 3.11+ (domain scripts), TypeScript 5+ (audit/sync) |
| **Framework** | None — standalone scripts |
| **PDF Engine** | fpdf2 + Pillow |
| **HTML Renderer** | Playwright (Chromium) for layout measurement |
| **Package Manager** | pip (Python), Bun (TypeScript scripts) |
| **Testing** | Manual gate-based workflow (5 approval gates) |
<!-- END VARIANT-INJECT -->

---

## Agents

<!-- VARIANT-INJECT: agents -->
| Agent | File | Role | Status |
|-------|------|------|--------|
| PM (Orchestrator) | `agents/pm.md` | Single entry point; reads project_state.json; dispatches all specialists | active |
| Version | `agents/version.md` | Snapshots files before every edit; cross-cutting safety net | active |
| Research | `agents/research.md` | Stage 1 — web research, source collection, research_notes.md | active |
| Storyline | `agents/storyline.md` | Stages 2-3 — storyline.md + slide_deck.md | active |
| Design | `agents/design.md` | Stage 4 — design_spec.md (colors, fonts, layout) | active |
| Build | `agents/html-build.md` | Stages 5-8 — lecture_vN.html + images/ | active |
| Measure | `agents/measure.md` | Stages 9-10 — layout_spec.json + pdf_layout_spec.md + fonts/ | active |
| Export | `agents/pdf-export.md` | Stage 11 — sample PDF → Gate 5 → full PDF | active |
<!-- END VARIANT-INJECT -->

> Lifecycle management: `bun scripts/agent-lifecycle-audit.ts`
> After any agent change, update AGENTS.md and this table.

---

## Skills

<!-- VARIANT-INJECT: skills -->
| Skill | File | Used By | Status |
|-------|------|---------|--------|
| version | `skills/version/SKILL.md` | version | active |
| research | `skills/research/SKILL.md` | research | active |
| storyline | `skills/storyline/SKILL.md` | storyline | active |
| design | `skills/design/SKILL.md` | design | active |
| html-build | `skills/html-build/SKILL.md` | html-build | active |
| measure | `skills/measure/SKILL.md` | measure | active |
| pdf-export | `skills/pdf-export/SKILL.md` | pdf-export | active |
<!-- END VARIANT-INJECT -->

> Skill layer: A (engine-agnostic) — platform parity copies in `.claude/skills/` and `.gemini/skills/`

---

## Scripts

<!-- VARIANT-INJECT: scripts -->
| Script | Type | Purpose | Status |
|--------|------|---------|--------|
| `scripts/snapshot.py` | Python | File versioning / restore per project | active |
| `scripts/measure_layout.py` | Python | Playwright layout measurement → layout_spec.json | active |
| `scripts/download_font.py` | Python | Korean font TTF download | active |
| `scripts/extract_slidedata.mjs` | ESM/Bun | HTML slideData → /tmp/slidedata.json | active |
| `scripts/gen_full.py` | Python | Full PDF generation via fpdf2 | active |
| `scripts/gen_sample5.py` | Python | 5-slide sample PDF | active |
| `scripts/audit.ts` | TypeScript | Documentation + agent frontmatter audit | active |
| `scripts/dev-sync.ts` | TypeScript | memlog → audit → commit → PR pipeline | active |
<!-- END VARIANT-INJECT -->

### Python Dependencies

```bash
pip install fpdf2 pillow playwright
playwright install chromium
```

### Bun Dependencies

```bash
# Bun required for TypeScript scripts
bun --version
```

---

## Environment Setup

<!-- VARIANT-INJECT: environment-setup -->
- No `.env` required — all configuration is via script arguments
- Python: `pip install fpdf2 pillow playwright && playwright install chromium`
- Bun: install from https://bun.sh (required for audit.ts, dev-sync.ts)
<!-- END VARIANT-INJECT -->

---

## Development Workflow

<!-- VARIANT-INJECT: development-workflow -->
```
User: "make a lecture about X"
  —→ PM Agent reads/creates project_state.json
  —→ Dispatches Research → Content → Design → Build → Measure → Export
  —→ Gates 2, 3, 5 require explicit user approval before advancing
```

### Lecture Workflow Phases (internal)

| Stage | Agent | Gate | Output |
|-------|-------|------|--------|
| 0 | PM | — | project_state.json initialized |
| 1 | Research | Gate 1 (optional) | research_notes.md |
| 2-3 | Content | **Gate 2 (required)** | storyline.md, slide_deck.md |
| 4 | Design | **Gate 3 (required)** | design_spec.md |
| 5-8 | Build | Gate 4 (optional) | lecture_vN.html, images/ |
| 9-10 | Measure | — | layout_spec.json, pdf_layout_spec.md, fonts/ |
| 11 | Export | **Gate 5 (required)** | sample_5slides.pdf → full .pdf |

### Dev Sync Workflow

```
/sync "feat: description"
  — 1. memlog — memory/YYYY-MM-DD.md session log
  — 2. MEMORY.md index update
  — 3. CHANGELOG.md [Unreleased] auto-add
  — 4. audit.ts — must exit 0
  — 5. git checkout -b pr/<date>-<slug>
  — 6. git commit + push
  — 7. gh pr create
```
<!-- END VARIANT-INJECT -->

---

<!-- VARIANT-INJECT: guidelines [REQUIRED] -->
## Presentation Production Guidelines

### Content Rules
1. Research must cover both Korean and English sources
2. Slide count: 30-60 per lecture (discuss with user before exceeding)
3. Each slide: ≤ 5 bullet points; visual gaps must be filled
4. Speaker intro (slide 2) and contact (last slide) are mandatory

### Design Rules
1. 8-role color palette: defined in design_spec.md CSS variable block
2. Font: Korean-compatible (MaruBuri, NanumSquare Neo, or Noto Sans KR)
3. Layout: two-panel (left text, right visual) as default

### Build Rules
1. Always run Version Agent before editing any file
2. HTML must embed `slideData` array for PDF extraction
3. Images: named `images/cover.jpg`, `images/slide_N.jpg`

### Approval Gate Rules
- Gates 2, 3, 5 are **MANDATORY** — PM must NOT advance without user approval
- Gate 1 and Gate 4 are optional — PM may ask user or auto-advance
- Gate 5: always generate 5-slide sample first; full PDF only after approval
<!-- END VARIANT-INJECT -->

---

## File Organization Policy

<!-- VARIANT-INJECT: file-organization -->
| Folder | Purpose |
|--------|---------|
| `presentations/<lecture_name_year>/` | All outputs for a single lecture project |
| `presentations/<project>/_versions/` | Version snapshots (Version Agent) |
| `presentations/<project>/memory/` | Project-specific domain dictionary |
| `agents/` | Agent role definitions |
| `skills/` | Skill trigger descriptors |
| `scripts/` | Python domain scripts + TS infrastructure |
| `memory/` | Dev session logs |
| `docs/` | Project context + ADRs |
<!-- END VARIANT-INJECT -->

---

## Domain Rules

<!-- VARIANT-INJECT: domain-rules -->
1. **Version Agent is always called first** — before any file modification by any agent
2. **project_state.json is the single source of truth** for lecture progress state
3. **`--workspace presentations/<project>`** must always be passed to snapshot.py to scope backups
4. **PDF requires layout measurement** — always run Measure Agent before Export Agent
5. **Playwright dependency** — Measure Agent requires `playwright install chromium` on the host
<!-- END VARIANT-INJECT -->

---

*co-deck.context.md version: 1.0 — created by co-deck_mig variant migration 2026-06-17*
