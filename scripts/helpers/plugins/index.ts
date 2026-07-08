/**
 * @file Plugin System — Barrel Exports + Explicit Registration
 * @version 1.0.0
 *
 * Serves as the entry point for the plugin system. Re-exports all public
 * types and functions from variant-plugin.ts, then explicitly registers
 * all known plugins.
 *
 * Design: docs/designs/variant-registry-architecture-design.md §5.3
 *
 * Registration approach: EXPLICIT (not self-register on import).
 * This approach is:
 *   - Order-independent: registration order is controlled in one place
 *   - Tree-shaking safe: unused plugin files can be eliminated by bundlers
 *   - Testable: tests can import individual plugins without triggering global state
 *   - Debuggable: all registered plugins are visible in a single file
 */

// ---------------------------------------------------------------------------
// Public API re-exports
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Explicit Plugin Registration
// ---------------------------------------------------------------------------

import { registerPlugin } from './variant-plugin.ts';
import { GamePlugin } from './game-plugin.ts';

// Register the game variant plugin.
// The 'game' type is defined in variant-type-registry.ts.
registerPlugin(new GamePlugin());

// Future plugins:
// import { SecurityPlugin } from './security-plugin.ts';
// registerPlugin(new SecurityPlugin());
