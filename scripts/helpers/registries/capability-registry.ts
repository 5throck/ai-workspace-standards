// scripts/helpers/registries/capability-registry.ts
// @version 1.0.1
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
  CLIENT_ENGAGEMENT:     'client-engagement',
  ANALYSIS:              'analysis',
  REPORTING:             'reporting',
  PRESENTATION:          'presentation',
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
/** Lazily-created Set for O(1) capability lookups */
let _capabilitySet: Set<string> | undefined;

function getCapabilitySet(): Set<string> {
  if (!_capabilitySet) {
    _capabilitySet = new Set(Object.values(CAPABILITY_REGISTRY));
  }
  return _capabilitySet;
}

export function isCapability(value: string): value is Capability {
  return getCapabilitySet().has(value);
}
