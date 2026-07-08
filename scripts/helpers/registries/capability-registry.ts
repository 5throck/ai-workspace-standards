// scripts/helpers/registries/capability-registry.ts
// @version 1.0.0
// SSOT for capability definitions

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
 * Catches typos in agent frontmatter capability declarations at validation time.
 *
 * Usage: if (!isCapability(agentCap)) console.warn(`Unknown capability: ${agentCap}`);
 *
 * @param value - The string value to check.
 * @returns `true` if the value is a registered capability.
 */
export function isCapability(value: string): value is Capability {
  return Object.values(CAPABILITY_REGISTRY).includes(value as Capability);
}
