# Design: Variant Registry Architecture

**Date**: 2026-07-08
**Status**: Proposed
**Spec ID**: 2026-07-08-variant-registry-architecture
**Scope**: scripts/helpers/registries/, scripts/helpers/plugins/, scripts/helpers/workspace-integration.ts, scripts/validators/, scripts/l2-to-variant-pipeline.ts, scripts/validate-templates.ts

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Decision Summary](#2-decision-summary)
3. [Architecture Overview](#3-architecture-overview)
4. [Registry Architecture](#4-registry-architecture-scriptshelpersregistries)
5. [Plugin System](#5-plugin-system-scriptshelpersplugins)
6. [Validator Architecture](#6-validator-architecture-scriptsvalidators)
7. [Workspace Integration](#7-workspace-integration-scriptshelpersworkspace-integrationts)
8. [Pipeline Scope Change](#8-pipeline-scope-change)
9. [Implementation Phases](#9-implementation-phases)
10. [Consumer Refactoring Details](#10-consumer-refactoring-details)
11. [Future Extensibility](#11-future-extensibility)

---

## 1. Problem Statement

The current variant management system suffers from eight distinct architectural problems that compound to make the system fragile, error-prone, and difficult to extend:

### 1.1 Duplicated Source of Truth

Variant types are hardcoded across 5+ files, each maintaining its own independent definition:

| File | Hardcoded Variant Type Artifact |
|------|-------------------------------|
| `variant-governance-rules.ts` | `VariantPromotionCriteria` union type + `PROMOTION_CRITERIA_BY_TYPE` record |
| `golden-reference-loader.ts` | Local `VariantType` union + `LAYER2_*_SECTIONS` hardcoded maps |
| `beta-lifecycle.ts` | String literal unions in function parameters |
| `generate-variant.ts` | `VariantMetadata.variantType` union + `getRequired*()` functions |
| `l2-to-variant-pipeline.ts` | `PipelineConfig.variantType` union |

Adding a new variant type requires locating and editing all five files independently. Forgetting any one produces subtle runtime mismatches between the type system and actual data.

### 1.2 No Capability-Based Validation

The current system validates only agent **names** (e.g., "does agent `red-team-lead` exist?"). It does not validate **capabilities** — whether an agent actually possesses the skills required for its variant type. An agent named `game-developer` with no game-engineering frontmatter passes validation today.

### 1.3 No Plugin System for Type-Specific Behavior

Type-specific logic (game-specific section checks, security authorization gate validation, etc.) is scattered across framework code in hardcoded `if/switch` branches. There is no extension point for per-type procedural behavior.

### 1.4 No Rollback Mechanism for Workspace Registration

The workspace registration step (updating propagation-map.json, VERSION_REGISTRY.json, README.md, new-project scripts, AGENTS.md) has no transactional semantics. If step 4 of 5 fails, steps 1–3 are already written with no automatic rollback.

### 1.5 VERSION_REGISTRY.json Schema Mismatch

Two separate writers produce incompatible VERSION_REGISTRY.json formats:

- **`integration-helpers.ts`** writes an **array format**
- **`validate-templates.ts`** reads a **nested object format**

This causes validation to fail silently or throw runtime errors after integration.

### 1.6 Manual Propagation Map Updates

Adding a new variant requires manually editing propagation-map.json to inject the variant name into all three `target_variants` marker-injection entries. This is error-prone and undocumented.

### 1.7 Pipeline Couples Generation with Workspace Writes

The `l2-to-variant-pipeline.ts` mixes artifact generation (Phases 1–6) with workspace registration (Phase 7). This means:
- Dry-run generation cannot be separated from destructive workspace writes
- Testing generation logic requires full workspace setup
- Failed registrations leave partially-written templates

### 1.8 No CI-Friendly Validation Reports

Current validation output is human-readable log text. CI systems cannot programmatically parse pass/fail status, count errors, or identify which checks ran.

---

## 2. Decision Summary

After four rounds of architectural review, the following decisions are finalized:

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | **Centralize into `registries/` directory** (3-file split: metadata, promotion, validation) | Single source of truth; `keyof typeof` prevents type/data drift |
| D2 | **Capability Registry as `const` object** (typo-safe, rename-safe) | Runtime `isCapability()` guard catches typos at execution time; TypeScript narrows to exact string literal union |
| D3 | **Plugin System with TypeScript interface + explicit registration** | Policy (declarative, data-driven) is separated from behavior (procedural, code-driven); explicit `registerPlugin()` is testable and tree-shaking safe |
| D4 | **Workspace Integration with preflight transaction** (using existing `pipeline-state.ts`) | Preflight validates before any writes; rollback on failure; builds on proven snapshot mechanism |
| D5 | **Validators split into `scripts/validators/` directory** with dependency ordering | One file per domain; prerequisite declarations prevent cascading error noise |
| D6 | **Pipeline scope limited to generate-only** (Phases 1–6) | Clean separation of concerns; generation and registration are independent, testable steps |
| D7 | **`requiredCapabilities` as ERROR, `requiredAgents` as WARNING only** | Capabilities represent hard functional requirements; agents are soft organizational recommendations that vary by project |

---

## 3. Architecture Overview

The architecture is organized into five distinct layers, each with a clear responsibility boundary:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Layer 1: SSOT Data (Declarative)                                   │
│  scripts/helpers/registries/                                        │
│  ├── variant-type-registry.ts    ← Type definitions                │
│  ├── capability-registry.ts       ← Capability enum-like constants  │
│  ├── promotion-policy.ts          ← Beta→Stable promotion rules     │
│  ├── validation-policy.ts         ← Per-type validation rules        │
│  └── index.ts                     ← Barrel + cross-validation       │
├─────────────────────────────────────────────────────────────────────┤
│  Layer 2: Procedural Behavior (Code-driven)                          │
│  scripts/helpers/plugins/                                           │
│  ├── variant-plugin.ts            ← Interface + registry           │
│  ├── game-plugin.ts               ← Game-specific behavior          │
│  └── index.ts                     ← Explicit plugin registration    │
├─────────────────────────────────────────────────────────────────────┤
│  Layer 3: Validation Rules (One per domain)                          │
│  scripts/validators/                                               │
│  ├── variant-json-validator.ts                                  │
│  ├── extends-validator-wrapper.ts                               │
│  ├── capability-validator.ts                                    │
│  ├── orphan-reference-validator.ts                               │
│  ├── duplicate-validator.ts                                     │
│  ├── platform-parity-validator.ts                                │
│  ├── golden-reference-validator.ts                               │
│  └── index.ts                     ← Barrel + runAllValidators()   │
├─────────────────────────────────────────────────────────────────────┤
│  Layer 4: Workspace Integration (Transactional)                     │
│  scripts/helpers/workspace-integration.ts                           │
│  └── Preflight → Snapshot → Write → Verify → Commit/Rollback       │
├─────────────────────────────────────────────────────────────────────┤
│  Layer 5: Pipeline (Generate Only)                                   │
│  scripts/l2-to-variant-pipeline.ts  ← Phases 1–6 only              │
│  scripts/validate-templates.ts       ← Post-creation validation    │
└─────────────────────────────────────────────────────────────────────┘
```

**Data flow:**

```
Consumer Script
    │
    ├─→ Layer 1 (registries/) ──→ type definitions, policies, capabilities
    │
    ├─→ Layer 2 (plugins/) ────→ type-specific procedural hooks
    │
    ├─→ Layer 3 (validators/) ──→ validation rules (dependency-ordered)
    │
    ├─→ Layer 4 (workspace) ───→ transactional registration (separate step)
    │
    └─→ Layer 5 (pipeline) ────→ generate variant artifacts only
```

**Dependency rule:** Layers may only import from their own layer or layers with a lower number. Layer 5 (pipeline) may import from all layers. Layer 1 (registries) imports from nothing.

---

## 4. Registry Architecture (`scripts/helpers/registries/`)

The registries layer is the **single source of truth (SSOT)** for all variant type metadata, capability definitions, promotion policies, and validation policies. All other layers import from this layer; no other layer defines variant type data.

### 4.1 `variant-type-registry.ts` — Type Definitions

```typescript
// scripts/helpers/registries/variant-type-registry.ts

/**
 * Runtime definition for a single variant type.
 * No `createdAt` field — git tracks history.
 */
export interface VariantTypeDefinition {
  readonly name: string;
  readonly description: string;
}

/**
 * Central registry of all variant types.
 * Type derived from data via `keyof typeof` — no drift between runtime values and the TypeScript type.
 */
export const VARIANT_TYPE_REGISTRY = {
  security: {
    name: 'security',
    description: 'Security review, pentesting, threat modeling, and patch engineering',
  },
  development: {
    name: 'development',
    description: 'Software development workflow with PM, Architect, and implementation agents',
  },
  design: {
    name: 'design',
    description: 'UI/UX design, design systems, prototyping, and design handoff',
  },
  consulting: {
    name: 'consulting',
    description: 'Strategy consulting for AI-assisted business consulting engagements',
  },
  collaboration: {
    name: 'collaboration',
    description: 'General work, research, documentation, and project coordination',
  },
  lecture: {
    name: 'lecture',
    description: 'Lecture and presentation material production workflow',
  },
  game: {
    name: 'game',
    description: 'Game development for HTML5 Canvas games using Vanilla TypeScript',
  },
} as const;

/**
 * Type representing all valid variant type keys.
 * Derived from the registry object — adding a key here automatically extends the type.
 */
export type VariantType = keyof typeof VARIANT_TYPE_REGISTRY;

/**
 * Runtime type guard. Catches typos at execution time.
 * Usage: if (!isVariantType(input)) throw new Error(`Unknown variant type: ${input}`);
 */
export function isVariantType(value: string): value is VariantType {
  return value in VARIANT_TYPE_REGISTRY;
}

/**
 * Returns an array of all registered variant type definitions.
 */
export function listVariantTypes(): readonly VariantTypeDefinition[] {
  return Object.values(VARIANT_TYPE_REGISTRY);
}

/**
 * Returns the definition for a specific variant type, or undefined if not registered.
 */
export function getVariantTypeDefinition(type: VariantType): VariantTypeDefinition {
  return VARIANT_TYPE_REGISTRY[type];
}
```

**Design decisions:**

- **No `createdAt` field.** Variant type metadata is immutable configuration, not temporal data. Git history provides the audit trail.
- **`as const` assertion.** Freezes the object deeply at the type level, ensuring TypeScript infers literal types for all string values.
- **`keyof typeof` pattern.** The `VariantType` union is derived from the data object. If a developer adds a new key to `VARIANT_TYPE_REGISTRY`, `VariantType` automatically includes it — and any `satisfies Record<VariantType, ...>` check in other registries will produce a compile error until that registry is also updated.

### 4.2 `capability-registry.ts` — Capability Definitions

```typescript
// scripts/helpers/registries/capability-registry.ts

/**
 * Central registry of all capabilities.
 * Capabilities represent functional requirements that agents must satisfy for specific variant types.
 *
 * Agents declare their capabilities in frontmatter:
 *   capabilities: [game-design, game-loop, debugging]
 *
 * Validators check that agents within a variant possess the capabilities
 * required by the variant's validation policy.
 */
export const CAPABILITY_REGISTRY = {
  // Game Design
  GAME_DESIGN:           'game-design',
  GAME_LOOP:             'game-loop',
  LEVEL_DESIGN:          'level-design',
  ARCADE_MECHANICS:      'arcade-mechanics',
  PUZZLE_MECHANICS:      'puzzle-mechanics',

  // Implementation
  ENGINE_IMPLEMENTATION: 'engine-implementation',
  ASSET_PIPELINE:        'asset-pipeline',
  VISUAL_DESIGN:         'visual-design',
  AUDIO_DESIGN:          'audio-design',

  // Quality
  DEBUGGING:             'debugging',
  TESTING:               'testing',
  SECURITY:              'security',

  // Cross-cutting
  ARCHITECTURE:          'architecture',
  ENVIRONMENT_SETUP:     'environment-setup',
  AUTHORIZATION_GATE:    'authorization-gate',
  ESCALATION_PROTOCOL:   'escalation-protocol',

  // Design & UX
  SERVICE_DESIGN:        'service-design',
  UI_UX_INTELLIGENCE:   'ui-ux-intelligence',

  // Consulting
  ENGAGEMENT_CONTEXT:    'engagement-context',
  DELIVERABLE_STANDARDS: 'deliverable-standards',
} as const;

/**
 * Union of all valid capability string values.
 */
export type Capability = (typeof CAPABILITY_REGISTRY)[keyof typeof CAPABILITY_REGISTRY];

/**
 * Runtime type guard for capability values.
 * Usage: if (!isCapability(agentCap)) console.warn(`Unknown capability: ${agentCap}`);
 */
export function isCapability(value: string): value is Capability {
  return Object.values(CAPABILITY_REGISTRY).includes(value as Capability);
}
```

**Design decisions:**

- **`const` object (not an enum).** Const objects provide the same type narrowing as enums but are:
  - Iterable at runtime (no reverse-mapping hacks)
  - Tree-shakeable (unused values can be eliminated)
  - Serializable (plain JSON-compatible strings)
- **Runtime `isCapability()` guard.** When agents declare capabilities in frontmatter, a typo like `'game-desgin'` will be caught by the guard at validation time rather than silently ignored.

### 4.3 `promotion-policy.ts` — Beta-to-Stable Promotion Rules

```typescript
// scripts/helpers/registries/promotion-policy.ts

import type { VariantType } from './variant-type-registry.ts';

/**
 * Defines the criteria for promoting a variant type from beta to stable.
 */
export interface PromotionPolicy {
  /** Minimum number of completed engagements before promotion is eligible. */
  readonly minEngagements: number;
  /** Minimum number of months in beta before promotion is eligible. */
  readonly minBetaMonths: number;
  /** Optional additional checks that must pass (e.g., authorization-gate-review for security). */
  readonly additionalChecks?: readonly string[];
}

/**
 * Promotion policies keyed by variant type.
 * Uses `satisfies Record<VariantType, PromotionPolicy>` to ensure compile-time
 * completeness — adding a new variant type to variant-type-registry.ts without
 * a corresponding entry here produces a TypeScript error.
 */
export const PROMOTION_POLICIES = {
  security: {
    minEngagements: 5,
    minBetaMonths: 3,
    additionalChecks: ['authorization-gate-review'] as const,
  },
  development: {
    minEngagements: 3,
    minBetaMonths: 2,
  },
  design: {
    minEngagements: 2,
    minBetaMonths: 2,
  },
  consulting: {
    minEngagements: 2,
    minBetaMonths: 2,
  },
  collaboration: {
    minEngagements: 2,
    minBetaMonths: 2,
  },
  lecture: {
    minEngagements: 2,
    minBetaMonths: 2,
  },
  game: {
    minEngagements: 3,
    minBetaMonths: 3,
  },
} satisfies Record<VariantType, PromotionPolicy>;

/**
 * Returns the promotion policy for a variant type.
 */
export function getPromotionPolicy(type: VariantType): PromotionPolicy {
  return PROMOTION_POLICIES[type];
}
```

**Game type rationale:** The `game` variant requires `minEngagements: 3` and `minBetaMonths: 3` (higher than the default of 2/2) because game variants involve an asset pipeline, engine architecture, gameplay loop, and debugging subsystems — all of which need extended real-world validation before promotion to stable.

### 4.4 `validation-policy.ts` — Per-Type Validation Rules

```typescript
// scripts/helpers/registries/validation-policy.ts

import type { VariantType } from './variant-type-registry.ts';
import { CAPABILITY_REGISTRY } from './capability-registry.ts';
import type { Capability } from './capability-registry.ts';

/**
 * Defines validation rules for a variant type.
 *
 * Severity semantics:
 *   - requiredCapabilities:  ERROR level — hard functional requirements
 *   - requiredAgents:         WARNING level — organizational recommendations
 *                             (project-specific team structures may vary)
 */
export interface ValidationPolicy {
  /**
   * Capabilities that MUST be present across agents in this variant type.
   * Checked at ERROR severity — missing capabilities fail validation.
   */
  readonly requiredCapabilities: readonly Capability[];

  /**
   * Agent names that SHOULD be present in this variant type.
   * Checked at WARNING severity — missing agents produce warnings, not errors.
   */
  readonly requiredAgents?: readonly string[];

  /**
   * Agent section headings that are optional but expected.
   * Validators produce INFO-level messages if these are missing.
   */
  readonly optionalAgentSections?: readonly string[];

  /**
   * Skill section headings that are optional but expected.
   * Validators produce INFO-level messages if these are missing.
   */
  readonly optionalSkillSections?: readonly string[];

  /**
   * If true, this variant type has a plugin that provides custom validation.
   * The framework should invoke the plugin's validation hooks.
   */
  readonly hasSpecialHandling?: boolean;
}

/**
 * Validation policies keyed by variant type.
 * Uses `satisfies Record<VariantType, ValidationPolicy>` for compile-time completeness.
 */
export const VALIDATION_POLICIES = {
  security: {
    requiredCapabilities: [
      CAPABILITY_REGISTRY.AUTHORIZATION_GATE,
      CAPABILITY_REGISTRY.ESCALATION_PROTOCOL,
    ],
    requiredAgents: ['red-team-lead', 'pentester', 'threat-modeler'],
    optionalAgentSections: ['## Authorization Gate', '## Escalation Protocol'],
    optionalSkillSections: ['## Security Gate'],
  },
  development: {
    requiredCapabilities: [],
    optionalAgentSections: ['## Phase Handoff Protocol'],
  },
  design: {
    requiredCapabilities: [],
    optionalAgentSections: [],
  },
  consulting: {
    requiredCapabilities: [
      CAPABILITY_REGISTRY.ENGAGEMENT_CONTEXT,
      CAPABILITY_REGISTRY.DELIVERABLE_STANDARDS,
    ],
    optionalAgentSections: ['## Engagement Context', '## Deliverable Standards'],
    optionalSkillSections: ['## Prerequisites', '## Quality Criteria'],
  },
  collaboration: {
    requiredCapabilities: [],
  },
  lecture: {
    requiredCapabilities: [],
    hasSpecialHandling: true,
    optionalAgentSections: ['## Stage Gate Checklist'],
  },
  game: {
    requiredCapabilities: [
      CAPABILITY_REGISTRY.GAME_DESIGN,
      CAPABILITY_REGISTRY.GAME_LOOP,
      CAPABILITY_REGISTRY.ASSET_PIPELINE,
      CAPABILITY_REGISTRY.DEBUGGING,
    ],
    requiredAgents: ['game-designer', 'game-developer', 'visual-artist', 'sound-designer', 'game-debugger'],
    optionalAgentSections: ['## Game Mechanics', '## Performance Budget'],
  },
} satisfies Record<VariantType, ValidationPolicy>;

/**
 * Returns the validation policy for a variant type.
 */
export function getValidationPolicy(type: VariantType): ValidationPolicy {
  return VALIDATION_POLICIES[type];
}
```

### 4.5 `registries/index.ts` — Barrel + Cross-Validation

```typescript
// scripts/helpers/registries/index.ts

export { VARIANT_TYPE_REGISTRY, type VariantType, type VariantTypeDefinition, isVariantType, listVariantTypes, getVariantTypeDefinition } from './variant-type-registry.ts';
export { CAPABILITY_REGISTRY, type Capability, isCapability } from './capability-registry.ts';
export { PROMOTION_POLICIES, type PromotionPolicy, getPromotionPolicy } from './promotion-policy.ts';
export { VALIDATION_POLICIES, type ValidationPolicy, getValidationPolicy } from './validation-policy.ts';

import { VARIANT_TYPE_REGISTRY } from './variant-type-registry.ts';
import { CAPABILITY_REGISTRY, isCapability } from './capability-registry.ts';
import { PROMOTION_POLICIES } from './promotion-policy.ts';
import { VALIDATION_POLICIES } from './validation-policy.ts';

/**
 * Result of cross-registry integrity validation.
 */
export interface RegistryIntegrityReport {
  readonly passed: boolean;
  readonly errors: readonly RegistryIntegrityError[];
}

export interface RegistryIntegrityError {
  readonly registry: string;
  readonly message: string;
  readonly severity: 'error' | 'warning';
}

/**
 * Validates cross-registry integrity. Called during preflight checks
 * and at pipeline startup.
 *
 * Checks performed:
 *   1. VARIANT_TYPE_REGISTRY keys == PROMOTION_POLICIES keys (exact match)
 *   2. VARIANT_TYPE_REGISTRY keys == VALIDATION_POLICIES keys (exact match)
 *   3. No duplicate variant type names
 *   4. Every variant type has non-empty description
 *   5. Every VALIDATION_POLICIES entry references valid CAPABILITY_REGISTRY values
 *   6. Every PROMOTION_POLICIES entry has minEngagements >= 1 and minBetaMonths >= 1
 *   7. No registered type references unregistered capabilities
 */
export function validateRegistryIntegrity(): RegistryIntegrityReport {
  const errors: RegistryIntegrityError[] = [];

  const typeKeys = Object.keys(VARIANT_TYPE_REGISTRY) as string[];
  const promotionKeys = Object.keys(PROMOTION_POLICIES) as string[];
  const validationKeys = Object.keys(VALIDATION_POLICIES) as string[];

  // Check 1: Type registry keys match promotion policy keys
  const missingPromotion = typeKeys.filter(k => !promotionKeys.includes(k));
  const extraPromotion = promotionKeys.filter(k => !typeKeys.includes(k));
  if (missingPromotion.length > 0) {
    errors.push({ registry: 'promotion-policy', message: `Missing promotion policies for types: ${missingPromotion.join(', ')}`, severity: 'error' });
  }
  if (extraPromotion.length > 0) {
    errors.push({ registry: 'promotion-policy', message: `Promotion policies for unregistered types: ${extraPromotion.join(', ')}`, severity: 'error' });
  }

  // Check 2: Type registry keys match validation policy keys
  const missingValidation = typeKeys.filter(k => !validationKeys.includes(k));
  const extraValidation = validationKeys.filter(k => !typeKeys.includes(k));
  if (missingValidation.length > 0) {
    errors.push({ registry: 'validation-policy', message: `Missing validation policies for types: ${missingValidation.join(', ')}`, severity: 'error' });
  }
  if (extraValidation.length > 0) {
    errors.push({ registry: 'validation-policy', message: `Validation policies for unregistered types: ${extraValidation.join(', ')}`, severity: 'error' });
  }

  // Check 3: No duplicate variant type names
  const names = Object.values(VARIANT_TYPE_REGISTRY).map(v => v.name);
  const duplicateNames = names.filter((n, i) => names.indexOf(n) !== i);
  if (duplicateNames.length > 0) {
    errors.push({ registry: 'variant-type', message: `Duplicate variant type names: ${[...new Set(duplicateNames)].join(', ')}`, severity: 'error' });
  }

  // Check 4: Every variant type has non-empty description
  for (const [key, def] of Object.entries(VARIANT_TYPE_REGISTRY)) {
    if (!def.description || def.description.trim().length === 0) {
      errors.push({ registry: 'variant-type', message: `Type "${key}" has empty description`, severity: 'warning' });
    }
  }

  // Check 5: Every VALIDATION_POLICIES entry references valid CAPABILITY_REGISTRY values
  const validCapabilities = new Set(Object.values(CAPABILITY_REGISTRY));
  for (const [type, policy] of Object.entries(VALIDATION_POLICIES)) {
    for (const cap of policy.requiredCapabilities) {
      if (!validCapabilities.has(cap)) {
        errors.push({ registry: 'validation-policy', message: `Type "${type}" references unregistered capability: ${cap}`, severity: 'error' });
      }
    }
  }

  // Check 6: Every PROMOTION_POLICIES entry has valid bounds
  for (const [type, policy] of Object.entries(PROMOTION_POLICIES)) {
    if (policy.minEngagements < 1) {
      errors.push({ registry: 'promotion-policy', message: `Type "${type}" has minEngagements < 1`, severity: 'error' });
    }
    if (policy.minBetaMonths < 1) {
      errors.push({ registry: 'promotion-policy', message: `Type "${type}" has minBetaMonths < 1`, severity: 'error' });
    }
  }

  // Check 7: No orphan capabilities in validation policies (implied by check 5, but explicit)
  // (Covered by check 5 above — each capability in any validation policy must exist in CAPABILITY_REGISTRY)

  return {
    passed: errors.filter(e => e.severity === 'error').length === 0,
    errors,
  };
}
```

---

## 5. Plugin System (`scripts/helpers/plugins/`)

### 5.1 Responsibility Boundary: Policy vs. Plugin

The architecture enforces a strict separation between **policy** (declarative, data-driven) and **plugin** (procedural, code-driven):

| Aspect | Policy (registries/) | Plugin (plugins/) |
|--------|---------------------|-------------------|
| Nature | Declarative rules | Procedural logic |
| Defined in | `const` objects in registries | TypeScript classes implementing `VariantPlugin` |
| Examples | `requiredCapabilities`, `requiredAgents`, `optionalSections` | Game 60fps budget check, security gate custom validation |
| Applied by | Framework code (uniform) | Plugin-specific code (per-type) |
| Extensibility | Add object to registry | Create class + `registerPlugin()` |

**Rule of thumb:** If it can be expressed as static data (a list of required strings, a numeric threshold), it belongs in a registry policy. If it requires conditional logic, computation, or external I/O, it belongs in a plugin.

### 5.2 Plugin Interface

```typescript
// scripts/helpers/plugins/variant-plugin.ts

import type { VariantType } from '../registries/variant-type-registry.ts';
import type { PromotionPolicy } from '../registries/promotion-policy.ts';

/**
 * Context provided to validation hooks.
 */
export interface ValidationContext {
  readonly variantDir: string;
  readonly variantType: VariantType;
  readonly agentFrontmatters: ReadonlyArray<{ name: string; capabilities: readonly string[] }>;
  readonly variantJson: unknown;
}

/**
 * A single validation issue found during validation.
 */
export interface ValidationIssue {
  readonly severity: 'error' | 'warning' | 'info';
  readonly category: string;
  readonly message: string;
  readonly agentName?: string;
  readonly capability?: string;
}

/**
 * Metadata about a variant being generated.
 */
export interface VariantMetadata {
  readonly name: string;
  readonly variantType: VariantType;
  readonly version: string;
}

/**
 * A workspace registration to be committed.
 */
export interface WorkspaceRegistration {
  readonly variantName: string;
  readonly variantType: VariantType;
  readonly version: string;
  readonly targetFiles: readonly string[];
}

/**
 * Golden reference structure for a variant type.
 */
export interface GoldenReference {
  readonly agentSections: {
    readonly required: readonly string[];
    readonly optional: readonly string[];
  };
  readonly skillSections: {
    readonly required: readonly string[];
    readonly optional: readonly string[];
  };
}

/**
 * Result of a promotion evaluation.
 */
export interface PromotionEvaluation {
  readonly eligible: boolean;
  readonly reasons: readonly string[];
}

/**
 * Engagement record for promotion evaluation.
 */
export interface Engagement {
  readonly date: string;
  readonly variantName: string;
  readonly outcome: 'success' | 'failure' | 'partial';
}

/**
 * Interface for variant-type-specific plugins.
 *
 * All methods are optional — a plugin only implements the hooks it needs.
 * The framework calls each hook if and only if the method is defined.
 */
export interface VariantPlugin {
  /** The variant type this plugin handles. */
  readonly type: VariantType;

  // --- Validation Lifecycle ---
  /** Called before any validation runs. Useful for setup/logging. */
  beforeValidation?(ctx: ValidationContext): Promise<void>;

  /** Type-specific validation logic. Returns array of issues found. */
  validate?(ctx: ValidationContext): Promise<ValidationIssue[]>;

  /** Called after all validation completes. Useful for summary reporting. */
  afterValidation?(ctx: ValidationContext, issues: ValidationIssue[]): Promise<void>;

  // --- Generation Lifecycle ---
  /** Called before variant generation begins. */
  beforeGeneration?(variantDir: string, metadata: VariantMetadata): Promise<void>;

  /** Called after variant generation completes. */
  afterGeneration?(variantDir: string, metadata: VariantMetadata): Promise<void>;

  // --- Registration Lifecycle ---
  /** Called before workspace registration is committed. */
  beforeRegistration?(registration: WorkspaceRegistration): Promise<void>;

  /** Called after workspace registration is committed. */
  afterRegistration?(registration: WorkspaceRegistration): Promise<void>;

  // --- Type-Specific Data ---
  /** Returns the golden reference structure for this variant type. */
  goldenReference?(): GoldenReference;

  /** Evaluates whether a variant is eligible for promotion. */
  evaluatePromotion?(policy: PromotionPolicy, engagements: Engagement[]): PromotionEvaluation;
}

// --- Plugin Registry (internal) ---

const pluginMap = new Map<VariantType, VariantPlugin>();

/**
 * Registers a plugin for a variant type.
 * Throws if a plugin is already registered for that type.
 */
export function registerPlugin(plugin: VariantPlugin): void {
  if (pluginMap.has(plugin.type)) {
    throw new Error(`Plugin already registered for variant type "${plugin.type}"`);
  }
  pluginMap.set(plugin.type, plugin);
}

/**
 * Returns the plugin for a variant type, or undefined if none is registered.
 */
export function getPlugin(type: VariantType): VariantPlugin | undefined {
  return pluginMap.get(type);
}

/**
 * Returns true if a plugin is registered for the given variant type.
 */
export function hasPlugin(type: VariantType): boolean {
  return pluginMap.has(type);
}

/**
 * Returns all registered plugins.
 */
export function getAllPlugins(): ReadonlyMap<VariantType, VariantPlugin> {
  return pluginMap;
}
```

### 5.3 Explicit Registration (NOT Self-Register on Import)

```typescript
// scripts/helpers/plugins/index.ts

export {
  type VariantPlugin,
  type ValidationContext,
  type ValidationIssue,
  type VariantMetadata,
  type WorkspaceRegistration,
  type GoldenReference,
  type PromotionEvaluation,
  type Engagement,
  registerPlugin,
  getPlugin,
  hasPlugin,
  getAllPlugins,
} from './variant-plugin.ts';

// --- Explicit Plugin Registration ---
// Plugins are registered explicitly here, NOT via self-registering side effects on import.
// This approach is:
//   - Order-independent: registration order is controlled in one place
//   - Tree-shaking safe: unused plugin files can be eliminated by bundlers
//   - Testable: tests can import individual plugins without triggering global state
//   - Debuggable: all registered plugins are visible in a single file

import { registerPlugin } from './variant-plugin.ts';
import { GamePlugin } from './game-plugin.ts';

registerPlugin(new GamePlugin());

// Future plugins:
// import { SecurityPlugin } from './security-plugin.ts';
// registerPlugin(new SecurityPlugin());
```

### 5.4 GamePlugin Implementation

```typescript
// scripts/helpers/plugins/game-plugin.ts

import type { VariantPlugin, ValidationContext, ValidationIssue, GoldenReference } from './variant-plugin.ts';

export class GamePlugin implements VariantPlugin {
  readonly type = 'game' as const;

  async validate(ctx: ValidationContext): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Check 1: Game-specific capability coverage
    // Verify that agents collectively cover game-design, game-loop, asset-pipeline, debugging
    const agentCapabilities = new Set(ctx.agentFrontmatters.flatMap(a => a.capabilities));
    const expectedCapabilities = ['game-design', 'game-loop', 'asset-pipeline', 'debugging'];
    for (const cap of expectedCapabilities) {
      if (!agentCapabilities.has(cap)) {
        issues.push({
          severity: 'error',
          category: 'capability-coverage',
          message: `Missing game capability: ${cap}`,
          capability: cap,
        });
      }
    }

    // Check 2: 60fps performance budget mention
    // Game variants should reference a performance budget in their documentation
    const variantContent = JSON.stringify(ctx.variantJson);
    if (!variantContent.toLowerCase().includes('fps') && !variantContent.toLowerCase().includes('performance budget')) {
      issues.push({
        severity: 'warning',
        category: 'performance-budget',
        message: 'Game variant should reference a performance budget (e.g., 60fps target)',
      });
    }

    // Check 3: Tile-based collision grid reference
    // Standard game architecture pattern for 2D games
    if (!variantContent.toLowerCase().includes('collision') && !variantContent.toLowerCase().includes('tile')) {
      issues.push({
        severity: 'info',
        category: 'architecture-pattern',
        message: 'Consider documenting collision/tile grid architecture pattern',
      });
    }

    return issues;
  }

  goldenReference(): GoldenReference {
    return {
      agentSections: {
        required: [
          '## Role',
          '## Responsibilities',
          '## Collaboration Protocol',
        ],
        optional: [
          '## Game Mechanics',
          '## Performance Budget',
          '## Asset Pipeline',
          '## Technical Constraints',
        ],
      },
      skillSections: {
        required: [
          '## Overview',
          '## Key Activities',
          '## Output Standards',
        ],
        optional: [],
      },
    };
  }
}
```

---

## 6. Validator Architecture (`scripts/validators/`)

### 6.1 File Structure

```
scripts/validators/
├── variant-json-validator.ts        ← Schema validation of variant.json
├── extends-validator-wrapper.ts     ← Wraps existing extends-validator.ts
├── capability-validator.ts         ← Checks requiredCapabilities coverage
├── orphan-reference-validator.ts   ← Detects references to non-existent agents/skills
├── duplicate-validator.ts          ← Checks for duplicate section/content
├── platform-parity-validator.ts     ← Cross-platform consistency checks
├── golden-reference-validator.ts    ← Validates against golden reference structure
└── index.ts                        ← Barrel + runAllValidators()
```

### 6.2 Validator Definition Interface

Each validator implements the `ValidatorDefinition` interface and declares its prerequisites:

```typescript
// scripts/validators/types.ts

/**
 * Context provided to each validator.
 */
export interface ValidatorContext {
  readonly variantDir: string;
  readonly variantType: string;
  readonly variantJson: unknown;
  readonly agentFiles: ReadonlyArray<{ name: string; path: string; content: string; frontmatter: unknown }>;
  readonly skillFiles: ReadonlyArray<{ name: string; path: string; content: string; frontmatter: unknown }>;
  readonly policy: unknown; // ValidationPolicy for the variant type
}

/**
 * A single validation issue.
 */
export interface ValidationIssue {
  readonly severity: 'error' | 'warning' | 'info';
  readonly category: string;
  readonly message: string;
  readonly file?: string;
  readonly line?: number;
  readonly agentName?: string;
  readonly capability?: string;
}

/**
 * Result of a single validator execution.
 */
export interface ValidatorResult {
  readonly validator: string;
  readonly duration_ms: number;
  readonly checks: number;
  readonly issues: readonly ValidationIssue[];
}

/**
 * Definition of a validator with dependency ordering.
 */
export interface ValidatorDefinition {
  /** Unique name (used for prerequisite references and reporting). */
  readonly name: string;

  /** Human-readable description. */
  readonly description: string;

  /**
   * Names of validators that must pass before this one runs.
   * If any prerequisite produced errors, this validator is SKIPPED
   * to prevent cascading error noise.
   *
   * Example: capability-validator declares prerequisite ['variant-json'] —
   * if variant.json is structurally invalid, capability checks would produce
   * spurious errors about missing fields.
   */
  readonly prerequisites: string[];

  /** The validation function. */
  readonly validate: (ctx: ValidatorContext) => Promise<ValidationIssue[]>;
}
```

### 6.3 Dependency Ordering Execution

The `runAllValidators()` function in `index.ts` respects prerequisite chains:

```typescript
// scripts/validators/index.ts

import type { ValidatorContext, ValidatorResult, ValidationIssue } from './types.ts';

// Validator definitions (each imported from its file)
import { variantJsonValidator } from './variant-json-validator.ts';
import { extendsValidatorWrapper } from './extends-validator-wrapper.ts';
import { capabilityValidator } from './capability-validator.ts';
import { orphanReferenceValidator } from './orphan-reference-validator.ts';
import { duplicateValidator } from './duplicate-validator.ts';
import { platformParityValidator } from './platform-parity-validator.ts';
import { goldenReferenceValidator } from './golden-reference-validator.ts';

const validators: readonly ValidatorDefinition[] = [
  variantJsonValidator,        // No prerequisites
  extendsValidatorWrapper,     // prerequisites: ['variant-json']
  capabilityValidator,         // prerequisites: ['variant-json']
  orphanReferenceValidator,    // prerequisites: ['variant-json', 'extends']
  duplicateValidator,          // prerequisites: ['variant-json']
  platformParityValidator,     // prerequisites: ['variant-json', 'extends']
  goldenReferenceValidator,     // prerequisites: ['variant-json', 'extends']
];

/**
 * Runs all validators against a variant, respecting dependency ordering.
 * Validators whose prerequisites produced errors are skipped.
 */
export async function runAllValidators(
  ctx: ValidatorContext,
): Promise<ValidatorResult[]> {
  const results: ValidatorResult[] = [];
  const failedValidators = new Set<string>();

  for (const validator of validators) {
    // Check prerequisites
    const prereqFailed = validator.prerequisites.some(p => failedValidators.has(p));
    if (prereqFailed) {
      results.push({
        validator: validator.name,
        duration_ms: 0,
        checks: 0,
        issues: [{
          severity: 'info',
          category: 'skipped',
          message: `Skipped: prerequisite validator(s) failed [${validator.prerequisites.join(', ')}]`,
        }],
      });
      continue;
    }

    const start = performance.now();
    const issues = await validator.validate(ctx);
    const duration_ms = Math.round(performance.now() - start);

    results.push({
      validator: validator.name,
      duration_ms,
      checks: issues.length, // Each issue represents a check; could be refined
      issues,
    });

    // Track failures for downstream prerequisite checks
    if (issues.some(i => i.severity === 'error')) {
      failedValidators.add(validator.name);
    }
  }

  return results;
}
```

### 6.4 Metadata-Rich Report Format

Validation output is a structured JSON report designed for both human readability and CI consumption:

```json
{
  "variant": "co-game",
  "variant_type": "game",
  "timestamp": "2026-07-08T12:00:00.000Z",
  "validations": [
    {
      "category": "variant-json",
      "status": "PASS",
      "duration_ms": 12,
      "validator": "variant-json-validator",
      "severity": "error",
      "checks": 8,
      "issues": []
    },
    {
      "category": "extends-resolution",
      "status": "PASS",
      "duration_ms": 45,
      "validator": "extends-validator-wrapper",
      "severity": "error",
      "checks": 12,
      "issues": []
    },
    {
      "category": "capability-coverage",
      "status": "PASS",
      "duration_ms": 18,
      "validator": "capability-validator",
      "severity": "error",
      "checks": 4,
      "issues": []
    },
    {
      "category": "orphan-references",
      "status": "PASS",
      "duration_ms": 22,
      "validator": "orphan-reference-validator",
      "severity": "error",
      "checks": 15,
      "issues": []
    },
    {
      "category": "duplicate-content",
      "status": "PASS",
      "duration_ms": 8,
      "validator": "duplicate-validator",
      "severity": "warning",
      "checks": 6,
      "issues": []
    },
    {
      "category": "platform-parity",
      "status": "WARN",
      "duration_ms": 95,
      "validator": "platform-parity-validator",
      "severity": "warning",
      "checks": 18,
      "issues": [
        {
          "severity": "warning",
          "category": "platform-parity",
          "message": "PowerShell new-project script missing .sh counterpart check"
        }
      ]
    },
    {
      "category": "golden-reference",
      "status": "PASS",
      "duration_ms": 45,
      "validator": "golden-reference-validator",
      "severity": "error",
      "checks": 13,
      "issues": []
    }
  ],
  "summary": {
    "errors": 0,
    "warnings": 1,
    "total_checks": 76,
    "total_duration_ms": 245,
    "passed": true
  }
}
```

**CI Usage:**

```bash
# Extract error count (single number check for CI exit code)
jq '.summary.errors' _pipeline_report.json

# GitHub Action integration
if [ $(jq '.summary.errors' _pipeline_report.json) -gt 0 ]; then
  echo "::error::Variant validation failed with $(jq '.summary.errors' _pipeline_report.json) errors"
  exit 1
fi

# Full report for artifact upload
cp _pipeline_report.json "$GITHUB_WORKSPACE/validation-report.json"
```

**Report properties:**

| Field | Type | Purpose |
|-------|------|---------|
| `variant` | `string` | Variant identifier being validated |
| `variant_type` | `string` | Variant type from registry |
| `timestamp` | `string` | ISO 8601 validation timestamp |
| `validations[]` | `array` | Per-validator results |
| `validations[].status` | `"PASS"` / `"WARN"` / `"FAIL"` / `"SKIP"` | Aggregated status for this validator |
| `validations[].duration_ms` | `number` | Execution time in milliseconds |
| `validations[].checks` | `number` | Number of individual checks performed |
| `validations[].issues[]` | `array` | Detailed issue list (empty if PASS) |
| `summary.errors` | `number` | Total ERROR-severity issues across all validators |
| `summary.warnings` | `number` | Total WARNING-severity issues |
| `summary.total_checks` | `number` | Sum of all validator check counts |
| `summary.total_duration_ms` | `number` | Total validation execution time |
| `summary.passed` | `boolean` | `true` if errors === 0 |

---

## 7. Workspace Integration (`scripts/helpers/workspace-integration.ts`)

### 7.1 Transaction Model

Workspace integration uses a **five-phase transaction model** built on top of the existing `pipeline-state.ts` rollback mechanism. No writes occur until all preflight checks pass.

```
┌──────────────────────────────────────────────────────────────────────┐
│ Phase 1: PREFLIGHT (validate, no writes)                            │
│                                                                      │
│   Checks (ALL must pass; ANY failure → abort with no writes):       │
│   ├── All target files exist and are writable                        │
│   ├── propagation-map.json structure is valid                       │
│   ├── VERSION_REGISTRY.json structure is valid (nested object fmt)  │
│   ├── README.md has ## Variants section (or can be created)          │
│   ├── new-project scripts directory exists                           │
│   ├── AGENTS.md exists                                               │
│   └── validateRegistryIntegrity() passes                             │
├──────────────────────────────────────────────────────────────────────┤
│ Phase 2: BEGIN (snapshot via pipeline-state.ts)                      │
│                                                                      │
│   ├── Hash each target file before modification (SHA-256)            │
│   └── Record rollback action per file in pipeline-state.ts            │
├──────────────────────────────────────────────────────────────────────┤
│ Phase 3: WRITE (ordered)                                             │
│                                                                      │
│   1. propagation-map.json (all 3 marker-inject target_variants)    │
│   2. VERSION_REGISTRY.json (nested object format)                    │
│   3. README.md (## Variants section)                                 │
│   4. new-project scripts (.ts, .sh, .ps1)                            │
│   5. AGENTS.md (PM Dispatch table)                                   │
├──────────────────────────────────────────────────────────────────────┤
│ Phase 4: VERIFY (re-read, confirm changes)                          │
│                                                                      │
│   ├── Re-read each written file                                      │
│   ├── Verify expected content is present                             │
│   └── Verify file hashes differ from pre-write snapshots             │
├──────────────────────────────────────────────────────────────────────┤
│ Phase 5: COMMIT or ROLLBACK                                          │
│                                                                      │
│   ├── All verify OK → pipeline-state status = "completed"           │
│   └── Any failure → restore all files from snapshots (reverse order) │
└──────────────────────────────────────────────────────────────────────┘
```

### 7.2 Interface

```typescript
// scripts/helpers/workspace-integration.ts

import type { VariantType } from './registries/variant-type-registry.ts';

/**
 * Configuration for workspace registration.
 */
export interface WorkspaceRegistrationConfig {
  readonly variantName: string;
  readonly variantType: VariantType;
  readonly version: string;
  readonly description: string;
  readonly sourceProject: string;
}

/**
 * Result of workspace registration.
 */
export interface WorkspaceRegistrationResult {
  readonly success: boolean;
  readonly preflightPassed: boolean;
  readonly filesModified: readonly string[];
  readonly rollbackAvailable: boolean;
  readonly errors: readonly string[];
}

/**
 * Registers a variant in the workspace using a transactional model.
 *
 * Phases:
 *   1. PREFLIGHT — validate all targets without writing
 *   2. BEGIN     — snapshot current file states
 *   3. WRITE     — apply changes in order
 *   4. VERIFY    — confirm changes were applied
 *   5. COMMIT    — finalize or rollback
 *
 * Returns a result object with success status and details.
 * On failure, all files are restored to their pre-registration state.
 */
export async function registerVariantInWorkspace(
  config: WorkspaceRegistrationConfig,
): Promise<WorkspaceRegistrationResult>;

/**
 * Dry-run version of registerVariantInWorkspace.
 * Runs preflight checks only and reports what would be written, without any writes.
 */
export async function dryRunRegistration(
  config: WorkspaceRegistrationConfig,
): Promise<{
  readonly preflightPassed: boolean;
  readonly plannedChanges: readonly PlannedChange[];
  readonly errors: readonly string[];
}>;
```

### 7.3 VERSION_REGISTRY Fix

**Current bug:** `integration-helpers.ts` writes VERSION_REGISTRY.json as an **array format**:
```json
[
  { "name": "co-game", "latest": "0.1.0", ... }
]
```

`validate-templates.ts` reads VERSION_REGISTRY.json expecting a **nested object format**:
```json
{
  "variants": {
    "co-game": {
      "latest": "0.1.0",
      "released": "2026-07-08",
      "status": "beta",
      ...
    }
  }
}
```

**Fix:** `workspace-integration.ts` is the single writer of VERSION_REGISTRY.json, using the correct nested object format:

```json
{
  "variants": {
    "co-game": {
      "latest": "0.1.0",
      "released": "2026-07-08",
      "status": "beta",
      "changelog": [],
      "security_advisories": [],
      "migration_guides": [],
      "source_project": "Projects/co-game",
      "promoted_via": "l2-to-variant-pipeline.ts"
    }
  }
}
```

The existing `integration-helpers.ts` will be refactored to delegate VERSION_REGISTRY writes to `workspace-integration.ts`, eliminating the dual-writer problem.

---

## 8. Pipeline Scope Change

### 8.1 Current Pipeline (Before)

```
Phase 1:  Validate inputs
Phase 2:  Load L2 scaffold
Phase 3:  Transform content
Phase 4:  Validate output
Phase 5:  Write templates/<name>/
Phase 6:  Generate report
Phase 7:  Update workspace files (propagation-map, VERSION_REGISTRY, README, scripts, AGENTS.md)  ← REMOVED
```

### 8.2 New Pipeline (After)

```
Phase 1:   Validate inputs
Phase 2:   Load L2 scaffold
Phase 3:   Transform content
Phase 3.7: Plugin-based type validation (NEW)
           - validateRegistryIntegrity()
           - Capability coverage checks via VALIDATION_POLICIES
           - Plugin hooks (beforeValidation, validate, afterValidation)
Phase 4:   Validate output
Phase 4.5: Enhanced CI-friendly report format (ENHANCED)
           - Metadata-rich JSON report (see §6.4)
Phase 5:   Write templates/<name>/
Phase 6:   Generate report
           Phase 7: REMOVED — workspace registration is now a separate explicit step
```

### 8.3 Key Changes

| Aspect | Before | After |
|--------|--------|-------|
| Workspace writes | Phase 7 (inside pipeline) | Separate `registerVariantInWorkspace()` call |
| Type validation | Ad-hoc checks in Phase 3 | Phase 3.7 with registry + plugin hooks |
| Report format | Human-readable log text | Structured JSON with metadata |
| Pipeline output | Templates + workspace files | Templates only |
| Rollback | None | Handled by workspace-integration.ts |

**Pipeline does NOT write to workspace files.** Generation output goes to `templates/<name>/`. Workspace registration is a separate, explicit step invoked by the operator after reviewing the generated artifacts.

---

## 9. Implementation Phases

### Phase A: Infrastructure Refactoring

| Step | Task | Files Created/Modified |
|------|------|----------------------|
| A1 | Create `registries/` directory (4 files) | `variant-type-registry.ts`, `capability-registry.ts`, `promotion-policy.ts`, `validation-policy.ts` |
| A2 | Create `registries/index.ts` with barrel exports + `validateRegistryIntegrity()` | `registries/index.ts` |
| A3 | Create `plugins/` directory (3 files) | `variant-plugin.ts`, `game-plugin.ts`, `plugins/index.ts` |
| A4 | Create `workspace-integration.ts` + refactor `integration-helpers.ts` | `workspace-integration.ts`, `integration-helpers.ts` |
| A5 | Create `validators/` directory (7+ files) | All validator files + `index.ts` |
| A6 | Refactor `validate-templates.ts` to use validators/ | `validate-templates.ts` |
| A7 | Enhance pipeline: add Phase 3.7, enhance Phase 4.5, remove Phase 7 | `l2-to-variant-pipeline.ts` |
| A8 | Refactor 5 consumer scripts to import from registries/ | See §10 for details |
| A9 | Validate: run `validate-templates --variant all` + `audit.ts` (zero regressions) | — |
| A10 | `/sync` — commit all infrastructure changes | — |

**Invariant:** All existing type values migrate with identical behavior. No functional changes to validation rules, promotion criteria, or golden references during Phase A.

### Soak Period: 24h+ Freeze

After Phase A commits:

- Run existing variant workflows end-to-end
- Verify CI (if configured) passes on the refactored code
- Monitor for hidden bugs introduced by the refactoring
- **No new features or variant additions during soak period**

### Phase B: co-game Variant Generation

| Step | Task |
|------|------|
| B1 | Add capabilities to co-game agent frontmatter |
| B2 | Run pipeline (Phases 1–6 only, using new infrastructure) |
| B3 | Run `registerVariantInWorkspace()` (transactional registration) |
| B4 | Validate + regression test (dry-run new-project scripts) |
| B5 | `/sync` — commit co-game variant |

---

## 10. Consumer Refactoring Details

Five consumer scripts currently maintain their own variant type definitions. Each will be refactored to import from the centralized registries.

### Refactoring Matrix

| File | Remove | Import From |
|------|--------|-------------|
| `variant-governance-rules.ts` | `VariantPromotionCriteria` union type, `PROMOTION_CRITERIA_BY_TYPE` record | `getPromotionPolicy()` from registries |
| `golden-reference-loader.ts` | Local `VariantType` union, `LAYER2_*_SECTIONS` hardcoded maps | `VariantType`, `getValidationPolicy()` from registries |
| `beta-lifecycle.ts` | String literal unions in function parameters | `VariantType`, `getPromotionPolicy()` from registries |
| `generate-variant.ts` | `VariantMetadata.variantType` union, `getRequired*()` functions, `getVariantTypeDescription()` | `VariantType`, `getPromotionPolicy()`, `getVariantTypeDefinition()` from registries |
| `l2-to-variant-pipeline.ts` | `PipelineConfig.variantType` union | `VariantType` from registries, dynamic CLI type listing via `listVariantTypes()` |

### Refactoring Guidelines

1. **Delete local type definitions** — Remove local `VariantType` unions, string literal types, and hardcoded maps.
2. **Import from registries** — Use the centralized types and accessor functions.
3. **Replace `as const` objects** with accessor functions (e.g., `getPromotionPolicy(type)` instead of `PROMOTION_CRITERIA_BY_TYPE[type]`).
4. **Verify behavior equivalence** — Every existing type value must produce identical runtime behavior after refactoring. No silent behavior changes.

### Before/After Example: `variant-governance-rules.ts`

**Before (local definitions):**
```typescript
// Local type — drifts from other files
type VariantPromotionCriteria = {
  variantType: 'security' | 'development' | 'design' | 'consulting' | 'collaboration' | 'lecture';
  minEngagements: number;
  minBetaMonths: number;
};

// Local data — duplicated across files
const PROMOTION_CRITERIA_BY_TYPE: Record<string, VariantPromotionCriteria> = {
  security: { variantType: 'security', minEngagements: 5, minBetaMonths: 3 },
  development: { variantType: 'development', minEngagements: 3, minBetaMonths: 2 },
  // ...
};
```

**After (centralized imports):**
```typescript
import type { VariantType } from './registries/variant-type-registry.ts';
import { getPromotionPolicy } from './registries/promotion-policy.ts';

// Type comes from SSOT — automatically includes new types
function checkPromotionEligibility(type: VariantType, engagements: number, betaMonths: number): boolean {
  const policy = getPromotionPolicy(type);
  return engagements >= policy.minEngagements && betaMonths >= policy.minBetaMonths;
}
```

---

## 11. Future Extensibility

The architecture is designed to make common extension operations require minimal, localized changes.

### 11.1 Adding a New Variant Type (e.g., `mobile`)

| Step | File | Change |
|------|------|--------|
| 1 | `variant-type-registry.ts` | Add entry to `VARIANT_TYPE_REGISTRY` (1 object literal) |
| 2 | `promotion-policy.ts` | Add entry to `PROMOTION_POLICIES` (1 object literal) — compile error if omitted due to `satisfies` |
| 3 | `validation-policy.ts` | Add entry to `VALIDATION_POLICIES` with capabilities (1 object literal) — compile error if omitted |
| 4 | `plugins/mobile-plugin.ts` | (Optional) Create plugin class with type-specific behavior |
| 5 | `plugins/index.ts` | (Optional) Add `registerPlugin(new MobilePlugin())` |

**No other files need modification.** The `VariantType` union auto-extends. All `satisfies Record<VariantType, ...>` checks enforce completeness at compile time.

### 11.2 Adding a New Capability

| Step | File | Change |
|------|------|--------|
| 1 | `capability-registry.ts` | Add entry (1 line: `NEW_CAP: 'new-capability'`) |
| 2 | `validation-policy.ts` | Reference in relevant types' `requiredCapabilities` arrays |

**No other files need modification.** The `Capability` union auto-extends.

### 11.3 Adding a New Validator

| Step | File | Change |
|------|------|--------|
| 1 | `scripts/validators/<name>-validator.ts` | Create validator implementing `ValidatorDefinition` |
| 2 | `scripts/validators/index.ts` | Add to validators array, specify prerequisites |

### 11.4 Plugin Lifecycle Expansion

The `VariantPlugin` interface supports lifecycle hooks that can be extended without breaking existing plugins:

```typescript
// Current hooks (all optional):
beforeValidation?(ctx: ValidationContext): Promise<void>;
validate?(ctx: ValidationContext): Promise<ValidationIssue[]>;
afterValidation?(ctx: ValidationContext, issues: ValidationIssue[]): Promise<void>;
beforeGeneration?(variantDir: string, metadata: VariantMetadata): Promise<void>;
afterGeneration?(variantDir: string, metadata: VariantMetadata): Promise<void>;
beforeRegistration?(registration: WorkspaceRegistration): Promise<void>;
afterRegistration?(registration: WorkspaceRegistration): Promise<void>;
goldenReference?(): GoldenReference;
evaluatePromotion?(policy: PromotionPolicy, engagements: Engagement[]): PromotionEvaluation;

// Future hooks (add new optional methods to the interface):
// beforeDeploy?(config: DeployConfig): Promise<void>;
// afterDeploy?(result: DeployResult): Promise<void>;
// customizeReport?(report: ValidationReport): ValidationReport;
```

New lifecycle events are added as **new optional methods** to the `VariantPlugin` interface. Existing plugins that don't implement the new methods continue to work unchanged — the framework checks for method existence before calling.

---

## Appendix A: File Summary

| Path | Layer | Purpose |
|------|-------|---------|
| `scripts/helpers/registries/variant-type-registry.ts` | SSOT Data | Variant type definitions + helpers |
| `scripts/helpers/registries/capability-registry.ts` | SSOT Data | Capability constants + type guard |
| `scripts/helpers/registries/promotion-policy.ts` | SSOT Data | Beta→Stable promotion rules |
| `scripts/helpers/registries/validation-policy.ts` | SSOT Data | Per-type validation rules |
| `scripts/helpers/registries/index.ts` | SSOT Data | Barrel exports + `validateRegistryIntegrity()` |
| `scripts/helpers/plugins/variant-plugin.ts` | Procedural | Plugin interface + registry functions |
| `scripts/helpers/plugins/game-plugin.ts` | Procedural | Game-specific plugin implementation |
| `scripts/helpers/plugins/index.ts` | Procedural | Explicit plugin registration |
| `scripts/validators/types.ts` | Validation | Shared validator types |
| `scripts/validators/variant-json-validator.ts` | Validation | variant.json schema validation |
| `scripts/validators/extends-validator-wrapper.ts` | Validation | Wraps existing extends-validator.ts |
| `scripts/validators/capability-validator.ts` | Validation | Capability coverage checks |
| `scripts/validators/orphan-reference-validator.ts` | Validation | Dangling reference detection |
| `scripts/validators/duplicate-validator.ts` | Validation | Duplicate content detection |
| `scripts/validators/platform-parity-validator.ts` | Validation | Cross-platform consistency |
| `scripts/validators/golden-reference-validator.ts` | Validation | Golden reference structure validation |
| `scripts/validators/index.ts` | Validation | Barrel + `runAllValidators()` |
| `scripts/helpers/workspace-integration.ts` | Integration | Transactional workspace registration |
| `scripts/l2-to-variant-pipeline.ts` | Pipeline | Generate-only pipeline (Phases 1–6) |
| `scripts/validate-templates.ts` | Validation | Post-creation validation entry point |

## Appendix B: Severity Level Semantics

| Severity | Usage | CI Behavior | Example |
|----------|-------|-------------|---------|
| `error` | Hard failures — must be fixed | CI fails (`exit 1`) | Missing required capability |
| `warning` | Soft failures — should be reviewed | CI passes, annotated | Missing recommended agent |
| `info` | Informational — no action needed | CI passes, silent | Optional section missing |

## Appendix C: Review History

| Round | Date | Focus Area | Outcome |
|-------|------|------------|---------|
| 1 | 2026-07-08 | Registry structure, SSOT design | Approved 3-file registry split, `as const` pattern |
| 2 | 2026-07-08 | Plugin system design, policy vs. behavior | Approved explicit registration, separated policy from plugins |
| 3 | 2026-07-08 | Validator architecture, CI report format | Approved dependency ordering, JSON report structure |
| 4 | 2026-07-08 | Pipeline scope, workspace integration, severity levels | Approved generate-only pipeline, transaction model, ERROR/WARNING split |
