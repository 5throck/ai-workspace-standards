// scripts/helpers/registries/variant-type-registry.ts
// @version 1.0.0
// SSOT for variant type definitions

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
 * Returns an array of all registered variant type keys.
 */
export function listVariantTypes(): readonly VariantType[] {
  return Object.keys(VARIANT_TYPE_REGISTRY) as VariantType[];
}

/**
 * Returns the definition for a specific variant type.
 *
 * @param type - A registered variant type key.
 * @returns The variant type definition.
 * @throws {Error} If the type is not registered (should not happen when using VariantType type).
 */
export function getVariantTypeDefinition(type: VariantType): VariantTypeDefinition {
  return VARIANT_TYPE_REGISTRY[type];
}
