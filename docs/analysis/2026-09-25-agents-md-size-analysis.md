# AGENTS.md Size Analysis — Truncation Exposure Across L0/L1/L2 (Hermes Context Cap)

- **Date**: 2026-09-25
- **Type**: Analysis report (input to a future Row 0 design; decides nothing by itself)
- **Trigger**: T-20260925-008 live finding — Hermes Agent (v0.21.4) caps project context files at `context_file_max_chars` (default 20,000 chars) and **every AGENTS.md in the ecosystem exceeds it**, so the governance body beyond the cap is silently truncated for every harness consumer that relies on context-file loading
- **Method**: mechanical measurement over all 15 AGENTS.md files (L0 root, L1 `templates/common`, 13 × L2 `templates/co-*`): zone split by managed markers, H2-section byte shares, cross-variant content hashing, and a per-file cut-position map at the 20,000-char cap

---

## 1. Size Inventory and Zone Split

Every L1/L2 file decomposes into three zones: **owned body** (variant-authored/forked), **COMMON-AGENTS injected zone** (marker-managed, byte-identical everywhere — 7,644 chars), and the **graft block** (managed marker, 2,308 chars).

| File | Total | Owned body | Common-injected | Graft |
|---|---:|---:|---:|---:|
| `AGENTS.md` (L0) | 57,018 | 47,056 | 7,654 | 2,308 |
| `templates/common/AGENTS.md` (L1) | 49,190 | 39,238 | 7,644 | 2,308 |
| `templates/co-abap/AGENTS.md` | 33,904 | 23,952 | 7,644 | 2,308 |
| `templates/co-consult/AGENTS.md` | 45,300 | 35,348 | 7,644 | 2,308 |
| `templates/co-deck/AGENTS.md` | 55,288 | 45,336 | 7,644 | 2,308 |
| `templates/co-design/AGENTS.md` | 41,536 | 31,584 | 7,644 | 2,308 |
| `templates/co-develop/AGENTS.md` | 42,241 | 32,289 | 7,644 | 2,308 |
| `templates/co-export/AGENTS.md` | 53,325 | 43,373 | 7,644 | 2,308 |
| `templates/co-game/AGENTS.md` | 47,959 | 38,007 | 7,644 | 2,308 |
| `templates/co-hr/AGENTS.md` | 53,832 | 43,880 | 7,644 | 2,308 |
| `templates/co-news/AGENTS.md` | 46,195 | 36,243 | 7,644 | 2,308 |
| `templates/co-price/AGENTS.md` | 27,927 | 17,975 | 7,644 | 2,308 |
| `templates/co-safety/AGENTS.md` | 82,099 | 72,147 | 7,644 | 2,308 |
| `templates/co-security/AGENTS.md` | 39,628 | 29,676 | 7,644 | 2,308 |
| `templates/co-work/AGENTS.md` | 40,580 | 30,628 | 7,644 | 2,308 |

The injection system works: the managed zones are byte-constant. **The owned body is the weight** — and it varies 4× between variants.

## 2. Where the Weight Is

L0 top sections: §3 PM Gateway Workflow (13,574), §6 Skills (8,702), §4 Other Workflows (6,465), §5 Execution Plan Templates (5,793).

The same four section families dominate every variant. Largest three variants:

| Section family | co-safety (72k owned) | co-deck (45k owned) | co-export (44k owned) |
|---|---:|---:|---:|
| §3 PM Gateway Workflow | 15,135 | 13,396 | 9,038 |
| §2 Individual Agent Definitions | 14,821 | 3,878 | 6,991 |
| §4 Other Workflows | 14,009 | 12,127 | 7,058 |
| §1 Agent Ecosystem Overview (roster) | 10,549 | 2,698 | 2,972 |
| §6 Skills | 4,858 | 3,037 | 4,858 |
| §5 Execution Plan Templates | 4,489 | 2,674 | 4,489 |

Roster depth scales the file: §1+§2 carry 39 H3 agent entries in co-safety vs 12 in co-deck vs 9 in co-export.

## 3. Duplication Analysis — Fork-Drift, Not Copy-Paste

Cross-variant hashing at H2 granularity found **zero byte-identical sections across all 13 variants** (only `# AGENTS.md`, `## §1`, `## §2` exist in all 13 — each with 13 distinct versions). The owned bodies are **the same governance skeleton forked 13 ways**: every variant carries a §3 PM Gateway Workflow and §4 Other Workflows with the same purpose and near-the-same shape, but 13 diverged editions. Two consequences:

1. **No cheap dedupe**: there is no identical boilerplate pool to collapse; the divergence must be adjudicated section-by-section (which edition is authoritative, what is genuinely variant-specific).
2. **Consistency hazard, not just size**: the PM Gateway rules exist in 14 editions (L0 + 13 variants) with no marker governance over the owned body — the exact drift class the COMMON-AGENTS zone was built to eliminate for the injected part.

Secondary duplication: rosters and skill tables restate data that has an SSOT elsewhere — `variant.json` `agents[]` (roster rows), `agents/*.md` frontmatter (definitions), `docs/VERSION_MANIFEST.md` (skills — L0 §6 itself says "always reference VERSION_MANIFEST" while carrying an 8.7k curated table).

## 4. Truncation Impact Map (20,000-char cut)

11 of 13 variants are cut **inside the COMMON-AGENTS injected zone**; co-abap/co-safety/co-deck cut earlier (in owned workflow sections). Lost-section counts range 9 (co-price) to 58 (co-safety). What falls beyond the cap is precisely the load-bearing governance: **Universal Design Gate (ADR-0074), LLM Work Routing (ADR-0078), ASD-STE100 standard, PM Team-Management Authority (ADR-0080)**, plus §4 workflows, §5 execution-plan boilerplate, and the graft block. Example cuts: co-price loses from "Korean Plain-Language Preference" onward (9 sections); co-safety loses from "### semicon-agent" onward (58 sections, ~75% of the file).

## 5. Strategy Options (analysis only — not decisions)

- **S1 — Onboarding config (shipped)**: `hermes config set context_file_max_chars 100000`. Covers the cap today at zero structural cost; documented in AGENTS.md §6 / CONSTITUTION §11 / ADR-0088 design Addendum 1. Does nothing for other context-file-based harnesses with hard caps.
- **S2 — Thin-dispatcher split (progressive disclosure)**: keep AGENTS.md under the cap (~≤15k) as a dispatcher — header, roster summary, section index with file pointers — and move §3/§4/§5/§6 bodies into reference files agents Read on demand (agents are file-capable in every supported harness). Mirrors the skills model (SKILL.md body + `references/`). Biggest structural win; requires a load-contract note so harnesses know to read the references.
- **S3 — Extend marker governance to the owned body**: a second marker zone (e.g. COMMON-AGENTS-GOVERNANCE) for the §3/§5 skeleton, ending 14-edition drift; roster generated from `variant.json` + `agents/*.md` frontmatter. Fixes consistency; reduces size only via roster generation and dedupe of the re-synced editions.
- **S4 — Content diet at L0**: §6 curated skills table → pointer to VERSION_MANIFEST (SSOT already declared); §3's duplicated tables (PM execution scope also lives in `agents/pm.md`) → single home. L0-only relief (~10–15k), helps every downstream copy that injects from it.

Likely end-state combines S2 (structure) + S3 (consistency) + S4 (L0 diet), sequenced L0 → L1 → L2 with the propagation machinery re-using the existing marker-inject path. Each needs its own Row 0 design with per-variant adjudication of the 13 diverged editions (the expensive part).

## 6. Recommended Next Step

Proceed directly to the Row 0 design (`docs/designs/2026-09-25-agents-md-size-reduction-design.md`) choosing the S1–S4 mix, setting the size budget, and planning the per-variant edition adjudication. No file changes are proposed by this report.
