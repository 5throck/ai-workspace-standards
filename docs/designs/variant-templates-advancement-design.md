# Variant Templates Advancement Design

**schemaVersion:** 1.0.0
**spec-id:** variant-templates-advancement

## 1. Overview & Objectives

The `variant-templates-advancement` specification defines the architectural design for seven workspace variant templates. These enhancements aim to provide specialized, domain-specific capabilities within the AI workspace, standardizing workflows and integrations across development, design, consulting, presentations, gaming, security, and general productivity.

### 1.1 Version & Infrastructure Baseline
- **Template Inheritance Model:** Built firmly upon the `template-v0.5.3` L0 -> L1 -> L2 inheritance model, ensuring consistent core capabilities propagate down to all specific variants.
- **Infrastructure Tools:**
  - `dev-sync.ts` (v1.5.0): Used as the primary link validation gate across all variant folder layouts.
  - `test-runner.ts` (v1.1.0): Utilizes a parallel worker pool for executing variant-specific testing rapidly.
  - `validate-templates.ts`: Enforces strict schema validation for all variant metadata and agent definitions.

## 2. Detailed Technical Specifications & Agent Rosters by Variant

Each variant defines a concrete set of specialized agents that utilize the established baseline skill registry and folder layout to achieve advanced domain-specific functionality.

### 2.1 `co-develop`: Software Engineering & Development
**Roster (7 agents):** `pm`, `architect`, `code-writer`, `designer`, `security-monitor`, `stack-setup`, `test-runner`.

**Enhancements on Baseline:**
*   **IDE Rules Generator:** The `stack-setup` agent automatically generates IDE-specific context rules (e.g., `.cursorrules`, `.clauderules`) based on project configuration mapped in the L2 folder layout.
*   **Issue-to-PR Pipeline (`swe-solve`):** The `code-writer` and `test-runner` coordinate via a custom skill (`swe-solve`) to parse issue descriptions, navigate the codebase, propose fixes, and run the parallel worker pool (`test-runner.ts` v1.1.0) before generating a PR.
*   **Zod API Runtime Contract Gate:** The `architect` and `security-monitor` enforce Zod for strict runtime validation across API boundaries mapped in the variant's skill registry.

### 2.2 `co-design`: UI/UX Design & Frontend Prototyping
**Roster (8 agents):** `design pm`, `design-lead`, `prototype-engineer`, `service-designer`, `storyteller`, `typography-expert`, `ux-researcher`, `visual-designer`.

**Enhancements on Baseline:**
*   **Design Token Compiler:** The `visual-designer` and `prototype-engineer` use a unified `tokens.json` mapped within the L2 layer as the source of truth, compiling to CSS properties and TypeScript definitions.
*   **Accessibility Audit (`axe-core`):** The `service-designer` and `ux-researcher` coordinate `axe-core` audits integrated into the CI/CD pipeline, gated by `dev-sync.ts` validation.
*   **Vite-based Component Playground:** Utilizes the workspace folder layout to provide an isolated Vite-powered component environment for rapid iteration.

### 2.3 `co-consult`: Consulting & Analysis
**Roster (11 agents):** `pm`, `market-researcher`, `financial-analyst`, `strategy-consultant`, `data-analyst`, `esg-analyst`, `risk-analyst`, `deliverable-writer`, `k-dart` lead, `industry-analyst`, `qa-reviewer`.

**Enhancements on Baseline:**
*   **DART Open API Parser:** The `k-dart` lead agent uses a specialized skill within the registry to parse live corporate disclosures.
*   **MECE Logic Tree Auditor:** The `strategy-consultant` and `qa-reviewer` use MECE analytic engines to evaluate arguments and validate outputs against the variant schema.
*   **Executive HTML Dashboard Compiler:** The `data-analyst` and `deliverable-writer` synthesize outputs into standalone HTML dashboards, rigorously checked by `dev-sync.ts`.

### 2.4 `co-deck`: Presentations & Narrations
**Roster (13 agents):** `presentation-architect`, `scriptwriter`, `slide-designer`, `theme-stylist`, `audio-narrator`, `source-verifier`, `curriculum-planner`, `handbook-writer`, `qa-auditor`, `slide-layout-specialist`, `slide-content-editor`, `presentation-pm`, `deck-compiler`.

**Enhancements on Baseline:**
*   **Dual-screen Presenter Mode:** The `presentation-architect` maps states across windows using L2 presentation structures and the BroadcastChannel API.
*   **Multi-speaker TTS Audio Narrator:** The `scriptwriter` and `audio-narrator` orchestrate automated TTS workflows utilizing specific audio generation skills registered in the variant.
*   **Playwright Paged-media PDF Renderer:** The `deck-compiler` uses Playwright integration to render HTML presentations, orchestrated by the parallel `test-runner.ts` workers.

### 2.5 `co-game`: Web Game Development
**Roster (12 agents):** `game-pm`, `game-designer`, `game-programmer`, `canvas-artist`, `audio-designer`, `qa-tester`, `level-designer`, `ui-programmer`, `math-balancer`, `physics-programmer`, `shader-artist`, `game-architect`.

**Enhancements on Baseline:**
*   **ECS Engine Core:** The `game-architect` and `game-programmer` coordinate a highly optimized ECS engine mapping to the L2 structure.
*   **Web Audio Synth (`sound-synth`):** The `audio-designer` builds upon custom Web Audio API integrations in the skill registry for procedural generation.
*   **Single-file HTML Game Bundler:** The `game-pm` coordinates bundling strategies to inline all assets securely, fully validated by `validate-templates.ts`.

### 2.6 `co-security`: Threat Modeling & Compliance
**Roster (6 agents):** `sec-lead`, `threat-modeler`, `code-auditor`, `compliance-expert`, `cloud-sec-architect`, `incident-responder`.

**Enhancements on Baseline:**
*   **Automated STRIDE Threat Matrix:** The `threat-modeler` utilizes workspace diagramming skills and architectural mappings to generate a STRIDE matrix.
*   **SPDX SBOM Generator:** The `compliance-expert` taps into dependency parsing schemas established in the L1 core to generate standard SBOMs.
*   **SARIF Security Report Exporter:** The `code-auditor` converts outputs from `test-runner.ts` security checks into SARIF format for CI integration.

### 2.7 `co-work`: Productivity & Documentation
**Roster (7 agents):** `work-pm`, `business-analyst`, `content-writer`, `ms365-expert`, `work-coordinator`, `process-automation-engineer`, `document-specialist`.

**Enhancements on Baseline:**
*   **Markdown to OOXML Compiler:** The `document-specialist` and `ms365-expert` utilize core mapping skills to compile extended Markdown to native Microsoft Office formats.
*   **Daily Standup Digest Synthesizer:** The `work-coordinator` aggregates git hooks and tracker events (L0 capabilities) to automate daily digests.
*   **No-code Workflow Connector Schemas:** The `process-automation-engineer` defines integration schemas stored safely in the workspace structure and validated by `validate-templates.ts`.

## 3. Quality, Security, and Governance Standards

*   **Schema & Validation:** The `validate-templates.ts` script guarantees all configurations are structured correctly according to the schema.
*   **Architecture & Concurrency:** Implementations rely on `dev-sync.ts` (v1.5.0) for valid inter-folder links, while `test-runner.ts` (v1.1.0) executes heavy tests (like the playwright compiler) utilizing a robust parallel worker pool.
*   **Inheritance:** Adherence to the `template-v0.5.3` L0->L1->L2 model is strictly enforced. Any changes to foundational configuration (L0/L1) requires an architecture review before adoption by the L2 variants.
