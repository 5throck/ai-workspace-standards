# Workspace Documentation Master Table of Contents

Welcome to the central documentation index for the AI Workspace Standards repository. This directory houses the governance rules, system architecture specifications, developer guides, design documents, lifecycle registries, and extension frameworks that govern the workspace.

---

## 1. Governance & Core Architecture

Core system rules, constitution modules, system architecture, security policies, and foundational schemas.

- **Root Governance Documents**:
  - [`CONSTITUTION.md`](../CONSTITUTION.md) — Workspace constitution and core governance principles
  - [`AGENTS.md`](../AGENTS.md) — Agent ecosystem definition and PM Gateway workflow
  - [`CHANGELOG.md`](../CHANGELOG.md) — Historical version change log and release notes
- [**Constitution Sections**](constitution/) — Detailed constitutional specification modules:
  - [00 - SSOT Architecture](constitution/00-ssot-architecture.md) — Single Source of Truth rules
  - [01 - Folder Structure](constitution/01-folder-structure.md) — Standard directory layout rules
  - [02 - Memory System](constitution/02-memory-system.md) — Workspace memory & state management
  - [03 - PR Workflow](constitution/03-pr-workflow.md) — Pull request standards and merge policies
  - [04 - Internationalization (i18n)](constitution/04-i18n.md) — Multi-language and localization standards
  - [05 - Multi-Agent Architecture](constitution/05-multi-agent-architecture.md) — Agent roles and delegation framework
  - [05.6 - Agent Lifecycle](constitution/05.6-agent-lifecycle.md) — Agent state transitions and management
  - [06 - Skill Lifecycle](constitution/06-skill-lifecycle.md) — Skill registration, testing, and lifecycle
  - [06.5 - Script Lifecycle](constitution/06.5-script-lifecycle.md) — Script lifecycle guidelines and quality gates
  - [07 - New Project Setup](constitution/07-new-project.md) — Rules for bootstrapping new project repositories
  - [08 - Coding Guidelines](constitution/08-coding-guidelines.md) — Code style, linting, and quality criteria
  - [09 - Operations Workflow](constitution/09-operations-workflow.md) — Operational execution workflows
- [**Architecture Guides**](architecture/) — Workspace design patterns and architectural concepts:
  - [Extends Pattern](architecture/extends-pattern.md) — Layer inheritance and configuration overriding
  - [Governance Docs Architecture](architecture/governance-docs-architecture.md) — Structural design of governance documentation
  - [L0/L1 Differences](architecture/l0-l1-differences.md) — Distinctions between Core (L0) and Common (L1) layers
- [**Security Policies**](security/) — Workspace security standards and audit records:
  - [Extends Chain Security](security/extends-chain-security.md) — Validation rules for extends inheritance chains
  - [Dependency Overrides](security/dependency-overrides.md) — Security policies for package dependency overrides
  - [A-11 Completion Report](security/A-11-completion-report.md) — Security compliance and audit completion report
- [**VERSION MANIFEST**](VERSION_MANIFEST.md) — Single Source of Truth for component versions across workspace layers
- [**Workspace Schema**](workspace-schema.json) — Structural JSON schema for workspace validation

---

## 2. Guides & Developer Workflows

Standard operating procedures, developer guides, variant creation workflows, and external framework references.

- [**Getting Started Guide**](getting-started.md) — Comprehensive onboarding guide for workspace setup, setup commands, and initial workflows
- [**Project Upgrade & Template Syncing Guide**](project-upgrade-guide.md) — Detailed procedure for upgrading projects and synchronizing common templates
- [**Creating a Variant Guide**](creating-a-variant.md) — Step-by-step guide for scaffolding and initializing a new variant project
- [**Variant Conversion Guide**](variant-conversion-guide.md) — Operational guide for converting existing non-variant repositories into workspace variants
- [**Variant Creation Workflow**](variant-creation-workflow.md) — Detailed workflow stages and lifecycle milestones for variant initialization
- [**External Framework References**](external-references.md) — Mappings, integrations, and compatibility references for external tools and frameworks

---

## 3. Architecture Decision Records (ADRs)

Formal records documenting architectural decisions, design rationale, and evolution history.

- [**ADR Index**](adr/) — Master index of Architecture Decision Records (ADRs 0001 through 0049)
  - Key ADRs include [ADR-0039 (L0/L1/L2 Hierarchy & Extends)](adr/0039-l0-l1-l2-hierarchy-and-extends.md), [ADR-0040 (L0/L1 Deployment Strategy)](adr/0040-l0-l1-deployment-strategy.md), [ADR-0042 (L2 Variant Pipeline Golden Reference)](adr/0042-l2-variant-pipeline-wave15-golden-reference.md), and [ADR-0048 (Variant PM AGENTS.md Workflow SSOT)](adr/0048-variant-pm-agents-md-workflow-ssot.md).
- [**Retired ADRs**](adr/retired/) — Historical ADRs that have been retired or superseded by newer specifications (e.g., [ADR-0030 (Auto Mode Architecture)](adr/retired/0030-auto-mode-architecture.md))
- [**ADR Templates**](adr/templates/) — Standardized templates for authoring new Architecture Decision Records (e.g., [Variant Creation Template](adr/templates/variant-creation-template.md))

---

## 4. Designs & Specifications

Detailed technical design documents, system improvement proposals, and machine-readable specification registries.

- [**Design Specifications**](designs/) — Technical designs and architectural proposals:
  - [Variant Templates Advancement Design](designs/variant-templates-advancement-design.md) — Specification for advancing variant templates
  - [Variant Templates Sync Design](designs/variant-templates-sync-design.md) — Architecture for variant template synchronization
  - [Workspace Q3 Improvements Design](designs/workspace-q3-improvements-design.md) — Comprehensive Q3 workspace improvement roadmap and design
  - [Variant Registry Architecture Design](designs/variant-registry-architecture-design.md) — Architecture for variant metadata registration and tracking
  - Additional design proposals: [L2 to Variant Conversion Pipeline](designs/l2-to-variant-conversion-pipeline.md), [Workspace Hardening Design](designs/workspace-hardening-design.md), [Governance Docs Consolidation Design](designs/governance-docs-consolidation-design.md)
- [**Workspace Specifications**](specs/) — Structural specifications and JSON schema definitions:
  - [Specification Registry](specs/registry.json) — Schema registry index for workspace specifications

---

## 5. Templates & Governance Contracts

JSON contracts, schema definitions, variant governance rules, and standard markdown templates.

- [**Common Contract**](templates/common-contract.json) — Structural and governance schema contract for Common (L1) layer
- [**Variant Contract**](governance/variant-contract.md) — Formal specification and governance contract requirements for variant projects
- [**Governance Frameworks**](governance/) — Core governance policies and procedural rules:
  - [Lifecycle Governance](governance/LIFECYCLE_GOVERNANCE.md) — Comprehensive lifecycle governance policy
  - [Branch Strategy](governance/branch-strategy.md) — Git branch naming, PR merging, and environment strategy
  - [PR Workflow Policy](governance/pr-workflow.md) — Pull request standards and merge gate validation
  - [Platform Parity Rules](governance/platform-parity-rules.md) — Multi-agent platform parity enforcement
  - [Script Quality Gate](governance/script-quality-gate.md) — Testing and quality criteria for scripts
  - [Skill Update Procedure](governance/skill-update-procedure.md) — Standard procedure for deploying skill updates
  - [Variant Lifecycle](governance/variant-lifecycle.md) — Lifecycle stages and state transitions for variants
  - [Version Registry Schema](governance/version-registry-schema.md) — Schema for tracking component versions
- [**Templates Registry & Schemas**](templates/) — Configuration templates and JSON schemas:
  - [Variant Contract Schema](templates/variant-contract.json) — JSON schema validating variant contracts
  - [Variant Schema](templates/variant.schema.json) — JSON schema for variant configuration files
  - [Version Registry](templates/VERSION_REGISTRY.json) — Single Source of Truth version registry
  - [Common Lifecycle Registry](templates/common.lifecycle.json) — Lifecycle registry for common layer
  - [Promotion Checklist Template](templates/PROMOTION_CHECKLIST-template.md) — Standard checklist for variant promotion
  - [Quality Gates Template](templates/QUALITY_GATES-template.md) — Standard checklist for workspace quality gates

---

## 6. Lifecycle Management & Execution Roadmaps

Lifecycle registries for workspace components, audit reports, historical reviews, and multi-quarter roadmaps.

- [**Lifecycle Registries**](lifecycle/) — Registries tracking active, deprecated, and experimental workspace components:
  - [Lifecycle Architecture Overview](lifecycle/README.md) — Design and usage of component lifecycle registries
  - [Agent Lifecycle Registries](lifecycle/agents/) — Registration and status for workspace agents (e.g., `pm.md`, `architect.md`, `auditor.md`, `docs-writer.md`)
  - [Skill Lifecycle Registries](lifecycle/skills/) — Catalog of registered skills and lifecycle metadata
  - [Script Lifecycle Registries](lifecycle/scripts/) — Index of workspace operational scripts and lifecycle state
  - [Template Lifecycle Registries](lifecycle/templates/) — Variant template lifecycle specifications (e.g., `co-develop.md`, `co-work.md`)
- [**Workspace Audit Reports**](reports/) — Workspace evaluation, governance diet, and audit reports:
  - [Governance Docs Diet Analysis](reports/governance-docs-diet-analysis.md) — Optimization and consolidation audit of governance docs
  - [Variant Promotion Roadmap 2026-07](reports/variant-promotion-roadmap-2026-07.md) — Variant promotion status and targets (July 2026)
- [**Historical Variant Review Report**](variant-review-report-2026-07-14.md) — Comprehensive audit and historical evaluation of variant infrastructure (July 14, 2026)
- [**Variant Roadmap 2026 Q3-Q4**](variant-roadmap-2026-q3-q4.md) — Official 3-phase execution roadmap for workspace variants (2026 Q3–Q4)

---

## 7. Superpowers & Extension Frameworks

Documentation for the Superpowers extension framework, including implementation plans and design specifications.

- [**Superpowers Documentation**](superpowers/) — Core documentation for the Superpowers extension ecosystem:
  - [Superpowers Execution Plans](superpowers/plans/) — Concrete implementation plans and task breakdown documents
  - [Superpowers Design Specifications](superpowers/specs/) — Technical design specs for superpower features and deliverables SSOT
