# 3-Phase Execution Roadmap: Variant Template Enhancements (2026 Q3–Q4)

**Document Version**: 1.1.0  
**Target Execution Timeline**: 2026 Q3 – 2026 Q4 (Weeks 1 through 10)  
**Scope**: All 7 Workspace Variant Templates (`co-develop`, `co-design`, `co-consult`, `co-deck`, `co-game`, `co-security`, `co-work`)  
**Governance Alignment**: [CONSTITUTION.md](../CONSTITUTION.md), [VERSION_MANIFEST.md](VERSION_MANIFEST.md), [Variant Contract](governance/variant-contract.md), [Variant Registry Architecture](designs/variant-registry-architecture-design.md), [Variant Templates Advancement Design](designs/variant-templates-advancement-design.md)  
**Status**: Approved & Execution Ready  

---

## 1. Executive Summary & Goals for 2026 Q3–Q4

### 1.1 Context & Strategic Vision
The AI Workspace platform provides standardized multi-agent development environments categorized into 7 domain-specific L2 variant templates. While the Phase A/B baseline infrastructure established governance compliance, schema validation (`validate-templates.ts`), and platform file symmetry, the 2026 Q3–Q4 roadmap elevates these 7 variants into enterprise-grade, domain-specialized execution engines.

By integrating proven industry methodologies and open-source benchmark architectures, each variant template will deliver automated, self-contained capabilities directly accessible to AI subagents and human engineers, fully synchronized with [docs/designs/variant-templates-advancement-design.md](designs/variant-templates-advancement-design.md).

### 1.2 Version Manifest & Infrastructure Baseline
The execution of the 2026 Q3–Q4 roadmap is anchored directly in the core platform architecture and infrastructure toolsets:
- **Template Inheritance Model**: Built firmly upon the `template-v0.5.3` L0 -> L1 -> L2 inheritance architecture. Base settings, core capabilities, and governance rules propagate seamlessly from L0 (core base) to L1 (domain layer) and down to L2 (variant templates).
- **Core Infrastructure Tooling**:
  - `dev-sync.ts` (v1.5.0): Used as the primary link validation gate across all variant folder layouts, verifying symlinks, structural integrity, and cross-layer references.
  - `test-runner.ts` (v1.1.0): Operates a high-concurrency parallel worker pool for rapid execution of variant-specific unit tests, security checks, and Playwright PDF renders.
  - `validate-templates.ts`: Enforces strict schema validation for all variant metadata, agent definitions, skill bindings, and frontmatter structures.

### 1.3 Core Objectives
1. **Domain Specialization**: Equip every variant template with deep domain tooling, including automated token compilation, live financial data parsing, threat modeling, presenter displays, audio synthesis, and native document compilation.
2. **Open-Source Benchmark Parity**: Align core agent capabilities with top-tier open-source projects (SWE-agent, MetaGPT, shadcn/ui, OpenBB, Slidev, Phaser, OWASP SAMM, n8n).
3. **Strict Runtime Contracts & Safety**: Implement schema-first validation (Zod, SARIF, WCAG 2.1 AA) to ensure data integrity and security across agent outputs.
4. **Autonomous Execution**: Advance `co-develop` towards end-to-end issue resolution (`swe-solve`) with test-driven validation and pull-request synthesis.
5. **Governance Parity**: Maintain 100% compliance with L0/L1 workspace standards, ensuring all scripts, skills, and agents synchronize seamlessly via `upgrade-project.ts`.

---

## 2. Comprehensive Benchmark & Capability Matrix

The 7 workspace variants map directly to industry-standard open-source benchmarks and frameworks, detailing the exact agent counts and specialized rosters specified in [docs/designs/variant-templates-advancement-design.md](designs/variant-templates-advancement-design.md):

| Variant ID | Registry Type | Target Open-Source Benchmark Reference | Exact Agent Count & Roster | Baseline Capabilities | 2026 Q3–Q4 Enhanced Capabilities | Primary Value Proposition |
|---|---|---|---|---|---|---|
| **`co-develop`** | `development` | **SWE-agent** (Princeton) & **MetaGPT** | **7 agents**<br>(`pm`, `architect`, `code-writer`, `designer`, `security-monitor`, `stack-setup`, `test-runner`) | Basic scaffold, linting, agent roster | `.cursorrules` & `.clauderules` generator, Zod API contract gate, Autonomous `swe-solve` issue-to-PR pipeline | Autonomous issue resolution with strict runtime contract validation |
| **`co-design`** | `design` | **shadcn/ui** & **Tailwind CSS** | **8 agents**<br>(`design pm`, `design-lead`, `prototype-engineer`, `service-designer`, `storyteller`, `typography-expert`, `ux-researcher`, `visual-designer`) | Basic UI rules, style guidelines | `tokens.json` design token compiler (CSS vars + TS types), `axe-core` accessibility audit engine, Vite component playground | Single SSOT for design tokens with automated WCAG AA compliance |
| **`co-consult`** | `consulting` | **OpenBB Platform** & **McKinsey frameworks** | **11 agents**<br>(`pm`, `market-researcher`, `financial-analyst`, `strategy-consultant`, `data-analyst`, `esg-analyst`, `risk-analyst`, `deliverable-writer`, `k-dart` lead, `industry-analyst`, `qa-reviewer`) | Financial report templates, basic analysis skills | Live DART Open API corporate disclosure parser, MECE logic tree auditor, Executive HTML dashboard compiler | Real-time regulatory filing ingestion with structured logic auditing |
| **`co-deck`** | `lecture` | **Slidev** & **Marp** | **13 agents**<br>(`presentation-architect`, `scriptwriter`, `slide-designer`, `theme-stylist`, `audio-narrator`, `source-verifier`, `curriculum-planner`, `handbook-writer`, `qa-auditor`, `slide-layout-specialist`, `slide-content-editor`, `presentation-pm`, `deck-compiler`) | Slide markdown tools, theme assets | Dual-screen Presenter Mode (`BroadcastChannel` API), Multi-speaker TTS audio narrator, Playwright paged-media PDF renderer | Multi-screen state synchronization and high-fidelity PDF generation |
| **`co-game`** | `game` | **Phaser** & **jsfxr** | **12 agents**<br>(`game-pm`, `game-designer`, `game-programmer`, `canvas-artist`, `audio-designer`, `qa-tester`, `level-designer`, `ui-programmer`, `math-balancer`, `physics-programmer`, `shader-artist`, `game-architect`) | Game loop templates, basic asset structure | 150-line TypeScript ECS engine core, Web Audio `sound-synth` procedural audio generator, Single-file HTML game bundler | Zero-dependency modular ECS engine with asset-free procedural audio |
| **`co-security`** | `security` | **OWASP SAMM** & **DefectDojo** | **6 agents**<br>(`sec-lead`, `threat-modeler`, `code-auditor`, `compliance-expert`, `cloud-sec-architect`, `incident-responder`) | Security checklist, gitleaks rules | STRIDE automated threat matrix generator, SPDX SBOM generator, SARIF security report exporter | Automated threat modeling and standardized CI security reporting |
| **`co-work`** | `collaboration` | **n8n** & **Apache POI / docx** | **7 agents**<br>(`work-pm`, `business-analyst`, `content-writer`, `ms365-expert`, `work-coordinator`, `process-automation-engineer`, `document-specialist`) | Task tracking, team collaboration skills | Markdown to native MS Office OOXML (`.docx`/`.xlsx`) compiler, Daily standup digest synthesizer, No-code workflow connector schemas | Native Office document compilation without external office dependencies |

### 2.1 Industry Benchmark & Agent Roster Alignments

- **`co-develop` → SWE-agent & MetaGPT (7 Agents)**: Features an explicit roster of 7 agents (`pm`, `architect`, `code-writer`, `designer`, `security-monitor`, `stack-setup`, `test-runner`). Replicates SWE-agent's trajectory search and tool-use interface for issue resolution, combined with MetaGPT's multi-agent software engineering roles. `stack-setup` generates IDE rules (`.cursorrules`, `.clauderules`), `architect` and `security-monitor` enforce Zod runtime gates, while `code-writer` and `test-runner` coordinate via `swe-solve` backed by the `test-runner.ts` (v1.1.0) parallel worker pool.
- **`co-design` → shadcn/ui & Tailwind CSS (8 Agents)**: Features an explicit roster of 8 agents (`design pm`, `design-lead`, `prototype-engineer`, `service-designer`, `storyteller`, `typography-expert`, `ux-researcher`, `visual-designer`). Emulates component primitives driven by central design tokens (`tokens.json`), compiled by `visual-designer` and `prototype-engineer` to CSS custom properties and TypeScript definitions, while `service-designer` and `ux-researcher` coordinate `axe-core` accessibility audits gated by `dev-sync.ts` (v1.5.0).
- **`co-consult` → OpenBB & McKinsey Frameworks (11 Agents)**: Features an explicit roster of 11 agents (`pm`, `market-researcher`, `financial-analyst`, `strategy-consultant`, `data-analyst`, `esg-analyst`, `risk-analyst`, `deliverable-writer`, `k-dart` lead, `industry-analyst`, `qa-reviewer`). Modeled after OpenBB's financial ingestion pipeline and McKinsey structured reasoning. `k-dart` lead agent fetches and parses South Korean DART corporate disclosures, `strategy-consultant` and `qa-reviewer` run MECE logic tree checks, and `data-analyst` with `deliverable-writer` synthesize executive HTML dashboards validated by `dev-sync.ts` (v1.5.0).
- **`co-deck` → Slidev & Marp (13 Agents)**: Features an explicit roster of 13 agents (`presentation-architect`, `scriptwriter`, `slide-designer`, `theme-stylist`, `audio-narrator`, `source-verifier`, `curriculum-planner`, `handbook-writer`, `qa-auditor`, `slide-layout-specialist`, `slide-content-editor`, `presentation-pm`, `deck-compiler`). Integrates Slidev's web-native presentation engine architecture. `presentation-architect` manages dual-screen Presenter Mode state via `BroadcastChannel`, `scriptwriter` and `audio-narrator` orchestrate TTS multi-speaker audio narration, and `deck-compiler` leverages Playwright headless rendering executed across `test-runner.ts` (v1.1.0) workers.
- **`co-game` → Phaser & jsfxr (12 Agents)**: Features an explicit roster of 12 agents (`game-pm`, `game-designer`, `game-programmer`, `canvas-artist`, `audio-designer`, `qa-tester`, `level-designer`, `ui-programmer`, `math-balancer`, `physics-programmer`, `shader-artist`, `game-architect`). Adopts Phaser's Entity-Component-System pattern stripped down to a zero-dependency ~150-line TypeScript ECS core (`game-architect`, `game-programmer`), coupled with jsfxr-inspired Web Audio procedural sound generation (`audio-designer`), and single-file HTML game bundling overseen by `game-pm` and validated by `validate-templates.ts`.
- **`co-security` → OWASP SAMM & DefectDojo (6 Agents)**: Features an explicit roster of 6 agents (`sec-lead`, `threat-modeler`, `code-auditor`, `compliance-expert`, `cloud-sec-architect`, `incident-responder`). Implements OWASP security assurance maturity levels. `threat-modeler` generates automated STRIDE threat matrices, `compliance-expert` extracts dependencies for SPDX SBOM generation, and `code-auditor` converts `test-runner.ts` security test results into SARIF v2.1.0 telemetry for CI integration.
- **`co-work` → n8n & Apache POI (7 Agents)**: Features an explicit roster of 7 agents (`work-pm`, `business-analyst`, `content-writer`, `ms365-expert`, `work-coordinator`, `process-automation-engineer`, `document-specialist`). Draws from n8n workflow automation concepts and Apache POI document generation. `document-specialist` and `ms365-expert` compile Markdown directly to native Microsoft Office OOXML packages (`.docx`/`.xlsx`), `work-coordinator` synthesizes daily standup digests, and `process-automation-engineer` maintains no-code workflow connector schemas validated by `validate-templates.ts`.

---

## 3. Detailed 3-Phase Timeline & Milestone Breakdown

```
2026 Q3 (Weeks 1-3)           2026 Q3/Q4 (Weeks 4-6)          2026 Q4 (Weeks 7-10)
+------------------------+    +------------------------+    +------------------------+
|       PHASE 1          |    |       PHASE 2          |    |       PHASE 3          |
| Short-term Foundations | -> | Mid-term Core Engines  | -> | Long-term Automation   |
| co-develop / co-deck   |    | co-design / co-consult |    | co-work / co-develop   |
| co-security            |    | co-game                |    | swe-solve pipeline     |
+------------------------+    +------------------------+    +------------------------+
```

---

### Phase 1: Short-term Roadmap (2026 Q3 - Weeks 1-3)
**Theme**: Developer Tooling, Presentation Rendering & Security Compliance Foundation

#### 1.1 `co-develop`: IDE Rules Generator & Zod API Contract Gate
- **Milestone 1.1.1: IDE Context Rules Generator (`scripts/generate-ide-rules.ts`)**
  - Dynamically synthesizes workspace configuration, active agent profiles, and coding standards into context-specific `.cursorrules` and `.clauderules` files.
  - Automatically triggered during `new-project.ts` initialization and updated via `upgrade-project.ts`.
- **Milestone 1.1.2: Zod API Runtime Contract Gate (`skills/zod-contract-gate/`)**
  - Implements runtime schema validation using `zod` for internal API endpoints, IPC channels, and agent payload boundaries.
  - Auto-generates TypeScript type definitions from schemas and rejects invalid payloads before processing.

#### 1.2 `co-deck`: Dual-Screen Presenter Mode & Playwright PDF Renderer
- **Milestone 1.2.1: Dual-Screen Presenter Mode (`skills/presenter-mode/`)**
  - Utilizes the browser `BroadcastChannel` API to maintain state synchronization between Presenter Window (speaker notes, current/next slide preview, elapsed timer) and Audience Window.
  - Sub-50ms synchronization latency with auto-reconnection logic.
- **Milestone 1.2.2: Playwright Paged-Media PDF Renderer (`scripts/render-pdf-deck.ts`)**
  - Employs headless Chromium via Playwright to convert HTML presentation decks into paginated PDF documents.
  - Respects `@page` CSS print rules, preserves custom typography, and captures high-DPI canvas visuals.

#### 1.3 `co-security`: STRIDE Threat Matrix Generator & SARIF Exporter
- **Milestone 1.3.1: STRIDE Threat Matrix Generator (`skills/stride-threat-matrix/`)**
  - Analyzes architecture specs, route definitions, and data flow manifests to generate a structured STRIDE threat model (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege).
  - Produces actionable risk ratings and mitigation checklists.
- **Milestone 1.3.2: SARIF Security Report Exporter (`skills/sarif-exporter/`)**
  - Formats static analysis and threat scanning outputs into Static Analysis Results Interchange Format (SARIF v2.1.0).
  - Integrates natively with GitHub Advanced Security dashboard and CI upload actions.

---

### Phase 2: Mid-term Roadmap (2026 Q3/Q4 - Weeks 4-6)
**Theme**: Design Systems, Live Financial Ingestion & Minimalist Game Architecture

#### 2.1 `co-design`: `tokens.json` Compiler & `axe-core` Accessibility Auditor
- **Milestone 2.1.1: `tokens.json` Design Token Compiler (`scripts/compile-tokens.ts`)**
  - Establishes `tokens.json` as the Single Source of Truth for visual design tokens (colors, typography, spacing, shadows, radii).
  - Compiles tokens into CSS Custom Properties (`:root { --color-primary: ... }`) and strongly-typed TypeScript constant files (`tokens.ts`).
- **Milestone 2.1.2: `axe-core` Accessibility Audit Engine (`skills/accessibility-audit/`)**
  - Integrates `axe-core` into the test suite and dev server to perform real-time accessibility evaluation against WCAG 2.1 Level AA benchmarks.
  - Outputs detailed violation reports containing DOM selectors, impact severity, and remediation guidance.

#### 2.2 `co-consult`: DART Open API Disclosure Parser & MECE Logic Auditor
- **Milestone 2.2.1: DART Open API Live Disclosure Parser (`skills/dart-disclosure-parser/`)** — *superseded: merged into `k-dart` v2.0.0, standalone skill removed 2026-08-10*
  - Connects directly to South Korea's DART (Data Analysis, Retrieval and Transfer System) Open API.
  - Fetches and parses corporate filings, financial balance sheets, income statements, and major disclosures into structured JSON datasets.
- **Milestone 2.2.2: MECE Logic Tree Auditor (`skills/mece-logic-auditor/`)**
  - Structural logic checker that analyzes proposed strategic frameworks and issue trees for Mutually Exclusive, Collectively Exhaustive principles.
  - Flags overlapping logic branches and unaddressed domain coverage gaps.

#### 2.3 `co-game`: 150-Line TS ECS Engine Core & Web Audio `sound-synth`
- **Milestone 2.3.1: 150-Line TypeScript ECS Engine Core (`templates/co-game/src/ecs/`)**
  - Minimalist Entity-Component-System framework contained within ~150 lines of TypeScript with zero external dependencies.
  - High-performance bitmask component allocation, entity lifecycle management, and system execution loops.
- **Milestone 2.3.2: Web Audio `sound-synth` Procedural Generator (`skills/sound-synth/`)**
  - Browser-native Web Audio API synthesizer for procedural retro 8-bit sound effect creation (jump, laser, explosion, pickup, coin).
  - Requires zero external audio assets or audio files; generates audio programmatically at runtime.

---

### Phase 3: Long-term Roadmap (2026 Q4 - Weeks 7-10)
**Theme**: Enterprise Office Generation & Autonomous Issue-to-PR Pipeline

#### 3.1 `co-work`: Markdown to OOXML Compiler & Standup Digest Synthesizer
- **Milestone 3.1.1: Markdown to Native MS Office OOXML Compiler (`scripts/md-to-ooxml.ts`)**
  - Native compilation engine that compiles Markdown source files into valid Microsoft Office Open XML formats (`.docx` and `.xlsx`).
  - Supports styled headings, formatted tables, bullet lists, callout boxes, and spreadsheet formulas without requiring Microsoft Office binary dependencies.
- **Milestone 3.2.2: Daily Standup Digest Synthesizer (`skills/standup-synthesizer/`)**
  - Automated agent pipeline aggregating git commit logs, issue status updates, pull request reviews, and ticket queue events over a 24-hour window.
  - Synthesizes concise, structured standup digests organized by Accomplished, In Progress, Blockers, and Planned Tasks.

#### 3.2 `co-develop`: Autonomous `swe-solve` Issue-to-PR Resolution Pipeline
- **Milestone 3.2.1: Autonomous `swe-solve` Resolution Pipeline (`skills/swe-solve/`)**
  - Multi-stage autonomous problem-solving workflow for software engineering tasks:
    - **Stage 1 (Ingest & Inspect)**: Parses issue descriptions, identifies relevant files, and retrieves AST/code contexts.
    - **Stage 2 (Localization & Plan)**: Isolates root cause, formulates fix hypothesis, and writes failing unit test (TDD).
    - **Stage 3 (Mutation & Test)**: Applies code edits, executes test suite, and iterates until all unit/integration tests pass.
    - **Stage 4 (Review & PR)**: Runs static analysis, verifies lint rules, and generates structured GitHub Pull Request.

---

## 4. Deliverable Acceptance Criteria & Verification Protocol

### 4.1 General Governance Criteria
To achieve final sign-off, every feature and deliverable across all phases must satisfy the following invariants:
1. **Schema & Template Integrity**: All new scripts and skills must pass `bun scripts/validate-templates.ts` with 0 errors.
2. **TypeScript Strictness**: Zero TypeScript compilation errors (`tsc --noEmit`) across all template codebases.
3. **Test Coverage Threshold**: Core compilers (`compile-tokens.ts`, `md-to-ooxml.ts`, `ecs`, `zod-contract-gate`) must maintain **>= 90%** unit test coverage.
4. **Documentation Completeness**: Every newly added skill must include a valid `SKILL.md` written in English per [CONSTITUTION.md](../CONSTITUTION.md).

### 4.2 Automated Verification Protocol

The following suite of commands must be executed to verify the deliverables at each phase checkpoint:

```bash
# ===================================================================
# PHASE 1 VERIFICATION PROTOCOL (2026 Q3 - Weeks 1-3)
# ===================================================================

# 1.1 co-develop IDE Rules Generator & Zod Contract Gate
bun scripts/generate-ide-rules.ts --check
bun test templates/co-develop/tests/zod-contract-gate.test.ts

# 1.2 co-deck Presenter Mode & PDF Renderer
bun test templates/co-deck/tests/presenter-mode.test.ts
bun scripts/render-pdf-deck.ts --input templates/co-deck/preview.html --output scratch/test.pdf

# 1.3 co-security Threat Matrix & SARIF Exporter
bun test templates/co-security/tests/stride-matrix.test.ts
bun test templates/co-security/tests/sarif-exporter.test.ts

# ===================================================================
# PHASE 2 VERIFICATION PROTOCOL (2026 Q3/Q4 - Weeks 4-6)
# ===================================================================

# 2.1 co-design Tokens Compiler & Accessibility Audit
bun scripts/compile-tokens.ts --input templates/co-design/tokens.json --output-css scratch/tokens.css --output-ts scratch/tokens.ts
bun test templates/co-design/tests/accessibility-audit.test.ts

# 2.2 co-consult DART Parser & MECE Auditor
bun test templates/co-consult/tests/dart-parser.test.ts
bun test templates/co-consult/tests/mece-auditor.test.ts

# 2.3 co-game ECS Engine & Sound Synth
bun test templates/co-game/tests/ecs-core.test.ts
bun test templates/co-game/tests/sound-synth.test.ts

# ===================================================================
# PHASE 3 VERIFICATION PROTOCOL (2026 Q4 - Weeks 7-10)
# ===================================================================

# 3.1 co-work OOXML Compiler & Standup Synthesizer
bun scripts/md-to-ooxml.ts --input README.md --output scratch/README.docx
bun test templates/co-work/tests/standup-digest.test.ts

# 3.2 co-develop swe-solve Autonomous Resolution Pipeline
bun test templates/co-develop/tests/swe-solve.test.ts

# ===================================================================
# FINAL GOVERNANCE & PLATFORM PARITY GATE
# ===================================================================
bun scripts/validate-templates.ts
```

---

## 5. Governance & Compliance Notes

- **Language Requirement**: All documentation, code comments, and error messages in this roadmap and associated implementations MUST be written in **English** per [CONSTITUTION.md](../CONSTITUTION.md).
- **Cross-Referencing & Specification Alignment**: All relative links within `docs/` must remain valid and fully aligned with [VERSION_MANIFEST.md](VERSION_MANIFEST.md), [Variant Contract](governance/variant-contract.md), [Variant Registry Architecture](designs/variant-registry-architecture-design.md), and [Variant Templates Advancement Design](designs/variant-templates-advancement-design.md).
- **Template Inheritance Architecture (`template-v0.5.3`)**: All variant templates strictly inherit from the `template-v0.5.3` L0 -> L1 -> L2 model. Any core helper scripts or shared tools (`dev-sync.ts` v1.5.0, `test-runner.ts` v1.1.0, `validate-templates.ts`) introduced or modified in this roadmap must be tracked in `script_manifest` within `variant.json` and registered for synchronized downstream updates via `upgrade-project.ts`.
