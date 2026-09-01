// scripts/helpers/registries/validation-policy.ts
// @version 1.2.0
// SSOT for per-type validation policies

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
      CAPABILITY_REGISTRY.CLIENT_ENGAGEMENT,
      CAPABILITY_REGISTRY.ANALYSIS,
      CAPABILITY_REGISTRY.REPORTING,
      CAPABILITY_REGISTRY.PRESENTATION,
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
  'abap-development': {
    requiredCapabilities: [],
    optionalAgentSections: ['## Phase Handoff Protocol'],
  },
  safety: {
    // No safety/EHS/GxP capability is registered in CAPABILITY_REGISTRY yet, and
    // requiredCapabilities is ERROR-severity/blocking — so it stays empty until a
    // real capability exists to require.
    requiredCapabilities: [],
    // WARNING severity. Matched by a shallow glob of the L3 project's agents/*.md,
    // so only templates/co-safety's two top-level, domain-agnostic managers qualify
    // (the _shared/ and domains/ rosters are nested and invisible to that check).
    requiredAgents: ['safety-governance-manager', 'safety-workflow-manager'],
    optionalAgentSections: [],
  },
} satisfies Record<VariantType, ValidationPolicy>;

/**
 * Returns the validation policy for a variant type.
 *
 * @param type - A registered variant type key.
 * @returns The validation policy for the given type.
 * @throws {Error} If the type is not registered (should not happen when using VariantType type).
 */
export function getValidationPolicy(type: VariantType): ValidationPolicy {
  return VALIDATION_POLICIES[type];
}
