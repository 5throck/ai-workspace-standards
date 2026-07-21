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

# Language of the TTS narration script (primary `script` field in slide_deck.md)
# Controls: (1) what language storyline writes the script in, (2) which script field NarrationEngine reads as primary
# Options: ko | en | ja | <any lang code>
# Default: falls back to `language` field if not set
script_language: ko

# Instructor information (auto-injected into cover and speaker-intro slides)
instructor:
  name: ""
  title: ""
  organization: ""
  email: ""

# Presentation rendering settings (used by html-build and storyline agents)
# theme   — HTML structure and navigation paradigm
#   Options: outline | pitch | pitch-enhanced | vertical | zen
#   - outline          : Research Notebook — text-only, no image panel, TOC drawer, all 5 styles (visual-heavy: partial)
#   - pitch            : floating card + speaker notes + TOC drawer (classic/minimal/premium-dark only)
#   - pitch-enhanced   : PPT Presenter View — pitch aesthetics + TOC drawer + transitions + timer (all 5 styles; visual-heavy: partial)
#   - vertical         : True Vertical Scroll — all slides stacked, sticky top bar with TOC drawer, IntersectionObserver, all 5 styles (visual-heavy: full)
#   - zen              : Presentation Zen — full-bleed backgrounds, centered message, max 3 bullets (classic/minimal/premium-dark; visual-heavy, academic: incompatible)
# style   — CSS visual variable set (color, font, spacing)
#   Options: premium-dark | classic | minimal | visual-heavy | academic
#   - premium-dark : dark navy + gold accent + serif typography (default; all themes)
#   - classic      : text left, image right panel
#   - minimal      : text-only, clean whitespace
#   - visual-heavy : full-bleed images with text overlay (partial for PPT themes)
#   - academic     : dense layout for research/thesis (all themes except pitch)
# tocStyle — Table-of-contents visual style (glass-drawer | solid-drawer, default: glass-drawer)
# Compatibility: see docs/html-themes/THEMES.md for valid theme × style combinations.
presentation:
  theme: pitch-enhanced
  style: premium-dark
  tocStyle: glass-drawer

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

# ── Background image settings ──────────────────────────────────────
# When enabled, slides use a downloaded image as background instead of
# a solid color. A semi-transparent overlay preserves text readability.
# Currently supported in PDF output and HTML (visual-heavy style).
background_image:
  # Enable background images for this presentation
  enabled: false
  # Which slides get the background image
  # Options: all | divider-cover | individual
  #   all            : every slide uses the background image
  #   divider-cover  : only divider, cover/title, and punchline slides
  #   individual     : per-slide assignment via image-manifest image_role: background
  scope: divider-cover
  # Image source
  # Options: download | none
  #   download : search and download from image.source provider (Pixabay/Unsplash/Pexels)
  #   none     : no background image (solid color only)
  source: download
  # Overlay applied on top of the background image for text readability
  overlay:
    # Overlay color [R, G, B] (0-255)
    color: [0, 0, 0]
    # Opacity 0.0 (fully transparent) to 1.0 (fully opaque)
    opacity: 0.4
  # Keywords for background image search (used when source: download)
  # If empty, falls back to the top-level `keywords` field above
  keywords: []
  # Fallback solid background color when no image is available
  # If null, uses the style's pdf_color_spec.json background color
  fallback_color: null

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

# ── Narration (TTS) settings ──────────────────────────────────────
# Controls the Web Speech API text-to-speech feature in the HTML viewer.
# Independent from auto_advance — both can run simultaneously or separately.
# The storyline agent generates a `script` field for every slide regardless.
narration:
  # Whether to show TTS narration controls in the HTML viewer
  # false → hides TTS play button, language dropdown, voice selector;
  #          disables 'P' keyboard shortcut
  # true  → shows TTS controls (default)
  enabled: true
  # Whether to auto-start TTS narration on page load
  # true  → begins reading slide 1 script automatically
  # false → narration starts paused; user clicks Play or presses 'P' (default)
  auto_play: false
  # Languages for which to generate translated narration scripts.
  # The primary language (from `script_language` field, defaults to `language`) always gets a `script` field.
  # Additional languages generate `scriptEn`, `scriptJa`, etc.
  # Options: empty list (primary only) | [ko, en, ja] (all three)
  # Example: [ko, en]    — Korean primary + English translation
  #          [ko, en, ja] — all three languages
  #          []           — primary language only (no extra translations)
  languages: []
  # Default narration language in the HTML player
  # Options: ko | en | ja (must be in `languages` or match `language` field)
  default_language: ko

# ── Auto-Advance settings ─────────────────────────────────────────
# Controls automatic slide progression in the HTML viewer.
# Independent from narration — both can run simultaneously or separately.
# When narration IS playing and auto-advance is ON: slides advance after
# narration ends (~800ms delay). When narration is NOT playing: slides
# advance on a timer.
auto_advance:
  # Whether to show auto-advance controls in the HTML viewer
  # false → hides auto-advance toggle button; disables 'A' keyboard shortcut
  # true  → shows auto-advance controls (default)
  enabled: true
  # Whether to start auto-advance as "Auto" on page load (config-driven)
  # true  → auto-advance timer starts immediately on page load
  # false → auto-advance starts as "Manual"; user toggles via button or 'A' key (default)
  start_as_auto: false
  # Interval between auto-advance slides when narration is NOT playing (seconds)
  # When narration IS playing, slides advance after narration ends (~800ms).
  interval: 8

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
#     max_bullets_per_slide: 7   # default per theme.json
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
| `pm` | Reads `source_verification` to decide whether to dispatch `source-verifier`; asks user about `background_image` at Stage 0 |
| `research` | Loads `audience`, `level`, `keywords` to tailor search queries |
| `storyline` | Uses `slide_count`, `chapters`, `instructor`, `dividers.mode`, `script_language`, `narration.languages` for multi-lang scripts |
| `html-build` | Reads `presentation.theme` + `presentation.style`, `instructor`, `background_image`, `script_language`, `narration`, `auto_advance` for slide rendering |
| `image-curator` | Reads `image.source`, `image.style_hint` for search queries; reads `background_image` for deck-wide background download |
| `pdf-export` | Reads `background_image` for PDF background image rendering with overlay |

**Getting started:**

1. Fill in `title`, `audience`, `level`, `keywords` (minimum required fields)
2. Optionally pre-seed `chapters` and `instructor`
3. Run the PM agent to begin Stage 1 (research)

**Divider modes:**
- `auto` (default/recommended): inserts a divider slide at every chapter boundary automatically to reduce prompts
- `manual`: storyline agent asks which chapter boundaries get dividers
- `none`: no divider slides — pure content flow
