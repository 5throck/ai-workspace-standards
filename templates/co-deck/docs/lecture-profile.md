---
lang: ko
lang_reason: source-material
# ⚠️ MASTER TEMPLATE — DO NOT EDIT DIRECTLY FOR SPECIFIC LECTURES
# This file acts as the master template.
# It is automatically copied to 'presentations/<project>/lecture-profile.md' when you start a new project.
# Please edit the local copy in your presentation folder instead.

# ── Lecture Profile ──────────────────────────────────────────────
# Edit the fields below before starting research.
# The pm, research, storyline, and html-build agents all read this file.
# ─────────────────────────────────────────────────────────────────

title: "강의 제목을 입력하세요"
subtitle: ""                          # optional — shown on cover slide

# Target audience
# Options: graduate | undergraduate | practitioner | general | mixed
audience: practitioner

# Lecture depth
# Options: intro | intermediate | advanced
level: intermediate

# Estimated number of slides (used by research & storyline agents)
slide_count: 40

# Presentation language
# Options: ko | en | ko-en (bilingual)
language: ko

# Instructor information (auto-injected into cover and speaker-intro slides)
instructor:
  name: ""
  title: ""
  organization: ""
  email: ""

# Presentation rendering settings (used by html-build and storyline agents)
# theme   — HTML structure and navigation paradigm
#   Options: notebook | pitch | scroll | slideshow
#   - notebook  : ruled-paper card, chapter tabs, print-friendly (classic/minimal/academic)
#   - pitch     : floating card + speaker notes panel + footer bar (classic/minimal/premium-dark)
#   - scroll    : vertical scroll, all slides visible, TOC panel (default)
#   - slideshow : fullscreen single-slide, prev/next navigation
# style   — CSS visual variable set (color, font, spacing)
#   Options: premium-dark | classic | minimal | visual-heavy | academic
#   - premium-dark : dark navy + gold accent + serif typography (default; scroll/slideshow/pitch only)
#   - classic      : text left, image right panel
#   - minimal      : text-only, clean whitespace
#   - visual-heavy : full-bleed images with text overlay (scroll only)
#   - academic     : dense layout for research/thesis (notebook/scroll only)
# Compatibility: see docs/html-themes/THEMES.md for valid theme × style combinations.
presentation:
  theme: scroll
  style: classic

# Keywords used by research agent to focus search queries
# Add 5-10 domain-specific terms
keywords:
  - ""

# Image acquisition preferences (used by image-curator agent)
image:
  # Primary source strategy
  # Options: auto | pixabay | unsplash | pexels | wikimedia
  # - auto (default): Pixabay keyless → Unsplash URL method → API keys if provided
  # All sources are commercial-use unlimited, no attribution required
  source: auto
  # Style hint appended to image search queries
  # Examples: "professional", "minimalist", "tech", "nature", "abstract"
  style_hint: "professional"
  # API keys are loaded from `.env.local` (gitignored) — do not store keys in this file.

# ── Optional: Chapter overview ────────────────────────────────────
# Pre-seed chapter titles to guide the storyline agent.
# Leave empty ([]) to let the agent decide.
chapters: []
# chapters:
#   - title: "1부: 개요"
#     slides: 8
#   - title: "2부: 핵심 개념"
#     slides: 15
#   - title: "3부: 실습"
#     slides: 12
#   - title: "4부: 결론"
#     slides: 5

# ── Divider settings ──────────────────────────────────────────────
dividers:
  # auto (recommended): insert dividers at each chapter boundary automatically to reduce prompts
  # manual: pm/storyline agent confirms each divider position
  # none: no dividers
  mode: auto

# ── Source Verification settings ──────────────────────────────────
# Options: true | false
# - true (default): Runs the source-verifier agent to validate references.
# - false: Skips source verification (equivalent to --skip-verify).
source_verification: true

# ── Per-project layout overrides ──────────────────────────────────
# Override global theme/style defaults for this project only.
# Uncomment and edit any of the sections below as needed.
# PM will warn at Stage 0 if any override differs from theme defaults.
#
# layout_overrides:
#   page:
#     width_mm: 254.0      # 4:3 ratio (default: 338.7)
#     height_mm: 190.5
#   content_rules:
#     max_bullets_per_slide: 7   # default per theme.json (scroll: 5, slideshow: 3)
#   colors:
#     accent: [180, 30, 50]      # institution CI color override
#   # ── fonts / line_heights — the primary PDF-fitting levers (read by gen-slides-pdf.ts) ──
#   # pitch theme reference (calibrated 2026-06-22 on a 20-slide B2B deck).
#   # Math: font_mm = pt/2.835; line_mm = px*190.5/750; line_mm must exceed font_mm.
#   # At 28pt: font=9.88mm, title_px=48 → lh=12.19mm (ratio 1.23) ✓
#   # At 36pt: font=12.70mm, div_title_px=62 → lh=15.74mm (ratio 1.24) ✓
#   fonts:
#     title_pt: 28
#     bullet_pt: 13
#     div_title_pt: 36
#     div_desc_pt: 14
#   line_heights:
#     title_px: 48
#     bullet_px: 28
#     bullet_gap_px: 16
#     div_title_px: 62
#     div_desc_px: 30
---

# Lecture Profile

This file is the single source of truth for this lecture project.

**How agents use it:**

| Agent | How it uses this profile |
|-------|-------------------------|
| `pm` | Reads `source_verification` to decide whether to dispatch `source-verifier` |
| `research` | Loads `audience`, `level`, `keywords` to tailor search queries |
| `storyline` | Uses `slide_count`, `chapters`, `instructor`, `dividers.mode` |
| `html-build` | Reads `presentation.theme` + `presentation.style`, `instructor` for cover/speaker-intro slides |
| `image-curator` | Reads `image.source`, `image.style_hint` for search queries |

**Getting started:**

1. Fill in `title`, `audience`, `level`, `keywords` (minimum required fields)
2. Optionally pre-seed `chapters` and `instructor`
3. Run the PM agent to begin Stage 1 (research)

**Divider modes:**
- `auto` (default/recommended): inserts a divider slide at every chapter boundary automatically to reduce prompts
- `manual`: storyline agent asks which chapter boundaries get dividers
- `none`: no divider slides — pure content flow
