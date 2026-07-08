/**
 * @file Variant Plugin Interface and Registry
 * @version 1.0.0
 *
 * Defines the plugin interface for variant-type-specific behavior and the
 * internal plugin registry. The plugin system provides procedural, code-driven
 * extensions that complement the declarative policies in the registries layer.
 *
 * Design: docs/designs/variant-registry-architecture-design.md §5.2
 *
 * Rule of thumb: If it can be expressed as static data (a list of required strings,
 * a numeric threshold), it belongs in a registry policy. If it requires conditional
 * logic, computation, or external I/O, it belongs in a plugin.
 */

import type { VariantType } from '../registries/variant-type-registry.ts';
import type { PromotionPolicy } from '../registries/promotion-policy.ts';

// ---------------------------------------------------------------------------
// Plugin Lifecycle Interfaces
// ---------------------------------------------------------------------------

/**
 * Context provided to validation hooks.
 *
 * Contains all the data a plugin needs to perform type-specific validation:
 * the variant directory, its type, the parsed agent frontmatters, and the
 * raw variant.json content.
 */
export interface ValidationContext {
  /** Absolute or workspace-relative path to the variant directory. */
  readonly variantDir: string;
  /** The variant type being validated (e.g., 'game', 'security'). */
  readonly variantType: VariantType;
  /** Parsed frontmatter from each agent file in the variant. */
  readonly agentFrontmatters: ReadonlyArray<{
    name: string;
    capabilities: readonly string[];
  }>;
  /** Raw parsed variant.json content (structure varies by variant type). */
  readonly variantJson: unknown;
}

/**
 * A single validation issue found during validation.
 *
 * Issues carry a severity level, a category for grouping, and a human-readable
 * message. Optional fields allow pinpointing the specific agent or capability
 * that caused the issue.
 */
export interface ValidationIssue {
  /** Severity level — see Appendix B of the design doc for semantics. */
  readonly severity: 'error' | 'warning' | 'info';
  /** Category for grouping (e.g., 'capability-coverage', 'performance-budget'). */
  readonly category: string;
  /** Human-readable description of the issue. */
  readonly message: string;
  /** The agent file name that caused the issue, if applicable. */
  readonly agentName?: string;
  /** The capability string that is missing or invalid, if applicable. */
  readonly capability?: string;
}

/**
 * Metadata about a variant being generated.
 *
 * Passed to generation lifecycle hooks so plugins can prepare for or react
 * to variant artifact generation.
 */
export interface VariantMetadata {
  /** The variant name (e.g., 'co-game'). */
  readonly name: string;
  /** The variant type (e.g., 'game'). */
  readonly variantType: VariantType;
  /** The version string (e.g., '0.1.0'). */
  readonly version: string;
}

/**
 * A workspace registration to be committed.
 *
 * Describes the set of workspace files that will be modified when a variant
 * is registered in the workspace (propagation-map.json, VERSION_REGISTRY.json,
 * README.md, new-project scripts, AGENTS.md).
 */
export interface WorkspaceRegistration {
  /** The variant name being registered. */
  readonly variantName: string;
  /** The variant type of the variant being registered. */
  readonly variantType: VariantType;
  /** The version of the variant being registered. */
  readonly version: string;
  /** List of workspace files that will be modified by this registration. */
  readonly targetFiles: readonly string[];
}

/**
 * Golden reference structure for a variant type.
 *
 * Defines the expected section headings for agent files and skill files.
 * Validators compare actual template content against this reference to
 * ensure structural completeness.
 */
export interface GoldenReference {
  /** Expected agent file section headings. */
  readonly agentSections: {
    /** Sections that MUST be present in every agent file. */
    readonly required: readonly string[];
    /** Sections that SHOULD be present but are not mandatory. */
    readonly optional: readonly string[];
  };
  /** Expected skill file section headings. */
  readonly skillSections: {
    /** Sections that MUST be present in every skill file. */
    readonly required: readonly string[];
    /** Sections that SHOULD be present but are not mandatory. */
    readonly optional: readonly string[];
  };
}

/**
 * Result of a promotion evaluation.
 *
 * Indicates whether a variant type is eligible for promotion from beta
 * to stable, along with human-readable reasons for the decision.
 */
export interface PromotionEvaluation {
  /** True if the variant type meets all criteria for promotion. */
  readonly eligible: boolean;
  /** Human-readable reasons explaining the eligibility decision. */
  readonly reasons: readonly string[];
}

/**
 * Engagement record for promotion evaluation.
 *
 * Represents a single completed engagement involving a variant,
 * used to determine whether the variant has enough real-world
 * usage to qualify for promotion to stable.
 */
export interface Engagement {
  /** ISO 8601 date string of when the engagement occurred. */
  readonly date: string;
  /** The variant name used during this engagement. */
  readonly variantName: string;
  /** The outcome of the engagement. */
  readonly outcome: 'success' | 'failure' | 'partial';
}

// ---------------------------------------------------------------------------
// VariantPlugin Interface
// ---------------------------------------------------------------------------

/**
 * Interface for variant-type-specific plugins.
 *
 * All lifecycle hook methods are optional — a plugin only implements the
 * hooks it needs. The framework calls each hook if and only if the method
 * is defined on the plugin instance.
 *
 * Lifecycle phases:
 *   - Validation:  beforeValidation → validate → afterValidation
 *   - Generation:  beforeGeneration → afterGeneration
 *   - Registration: beforeRegistration → afterRegistration
 *   - Data:        goldenReference, evaluatePromotion
 */
export interface VariantPlugin {
  /** The variant type this plugin handles (e.g., 'game', 'security'). */
  readonly type: VariantType;

  // --- Validation Lifecycle ---

  /**
   * Called before any validation runs.
   * Useful for setup, logging, or initializing type-specific state.
   *
   * @param ctx - The validation context for this variant.
   */
  beforeValidation?(ctx: ValidationContext): Promise<void>;

  /**
   * Type-specific validation logic.
   * Returns an array of issues found. The framework aggregates these with
   * issues from standard validators.
   *
   * @param ctx - The validation context for this variant.
   * @returns Array of validation issues (may be empty).
   */
  validate?(ctx: ValidationContext): Promise<ValidationIssue[]>;

  /**
   * Called after all validation completes.
   * Useful for summary reporting or cleanup.
   *
   * @param ctx - The validation context for this variant.
   * @param issues - All validation issues collected (from this plugin and standard validators).
   */
  afterValidation?(ctx: ValidationContext, issues: ValidationIssue[]): Promise<void>;

  // --- Generation Lifecycle ---

  /**
   * Called before variant generation begins.
   * Useful for pre-generation setup or validation.
   *
   * @param variantDir - The directory where variant artifacts will be generated.
   * @param metadata - Metadata about the variant being generated.
   */
  beforeGeneration?(variantDir: string, metadata: VariantMetadata): Promise<void>;

  /**
   * Called after variant generation completes.
   * Useful for post-generation cleanup, verification, or enrichment.
   *
   * @param variantDir - The directory where variant artifacts were generated.
   * @param metadata - Metadata about the variant that was generated.
   */
  afterGeneration?(variantDir: string, metadata: VariantMetadata): Promise<void>;

  // --- Registration Lifecycle ---

  /**
   * Called before workspace registration is committed.
   * Useful for validating the registration payload or performing pre-commit checks.
   *
   * @param registration - The workspace registration about to be committed.
   */
  beforeRegistration?(registration: WorkspaceRegistration): Promise<void>;

  /**
   * Called after workspace registration is committed.
   * Useful for post-registration notifications or downstream updates.
   *
   * @param registration - The workspace registration that was committed.
   */
  afterRegistration?(registration: WorkspaceRegistration): Promise<void>;

  // --- Type-Specific Data ---

  /**
   * Returns the golden reference structure for this variant type.
   * Used by the golden-reference-validator to check structural completeness
   * of agent and skill files.
   *
   * @returns The golden reference for this variant type.
   */
  goldenReference?(): GoldenReference;

  /**
   * Evaluates whether a variant of this type is eligible for promotion
   * from beta to stable.
   *
   * @param policy - The promotion policy for this variant type.
   * @param engagements - Historical engagement records for this variant.
   * @returns The promotion evaluation result.
   */
  evaluatePromotion?(policy: PromotionPolicy, engagements: Engagement[]): PromotionEvaluation;
}

// ---------------------------------------------------------------------------
// Plugin Registry (internal)
// ---------------------------------------------------------------------------

/**
 * Internal map of registered plugins, keyed by variant type.
 * Not exported — access via registerPlugin(), getPlugin(), hasPlugin(), getAllPlugins().
 */
const pluginMap: Map<VariantType, VariantPlugin> = new Map();

/**
 * Registers a plugin for a variant type.
 *
 * Throws an Error if a plugin is already registered for that type.
 * This enforces a one-plugin-per-type contract to prevent ambiguous behavior.
 *
 * @param plugin - The plugin instance to register.
 * @throws {Error} If a plugin is already registered for the same variant type.
 *
 * @example
 * ```typescript
 * import { registerPlugin } from './helpers/plugins/index.ts';
 * import { GamePlugin } from './helpers/plugins/game-plugin.ts';
 *
 * registerPlugin(new GamePlugin());
 * ```
 */
export function registerPlugin(plugin: VariantPlugin): void {
  if (pluginMap.has(plugin.type)) {
    throw new Error(
      `Plugin already registered for variant type "${String(plugin.type)}"`,
    );
  }
  pluginMap.set(plugin.type, plugin);
}

/**
 * Returns the plugin registered for a variant type, or undefined if none is registered.
 *
 * Use this when you need to access a specific plugin's methods for a known variant type.
 *
 * @param type - The variant type to look up.
 * @returns The registered plugin, or undefined if no plugin is registered for this type.
 *
 * @example
 * ```typescript
 * const plugin = getPlugin('game');
 * if (plugin?.goldenReference) {
 *   const ref = plugin.goldenReference();
 * }
 * ```
 */
export function getPlugin(type: VariantType): VariantPlugin | undefined {
  return pluginMap.get(type);
}

/**
 * Returns true if a plugin is registered for the given variant type.
 *
 * Use this for quick existence checks before calling getPlugin().
 *
 * @param type - The variant type to check.
 * @returns True if a plugin is registered for this variant type.
 */
export function hasPlugin(type: VariantType): boolean {
  return pluginMap.has(type);
}

/**
 * Returns a readonly view of all registered plugins.
 *
 * Useful for iteration, debugging, or listing available plugins.
 * The returned map cannot be modified — use registerPlugin() to add plugins.
 *
 * @returns Readonly map of variant type → plugin instance.
 *
 * @example
 * ```typescript
 * for (const [type, plugin] of getAllPlugins()) {
 *   console.log(`Plugin registered for: ${type}`);
 * }
 * ```
 */
export function getAllPlugins(): ReadonlyMap<VariantType, VariantPlugin> {
  return pluginMap;
}
