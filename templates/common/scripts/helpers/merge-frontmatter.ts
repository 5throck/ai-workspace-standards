#!/usr/bin/env -S bun
/**
 * YAML Frontmatter Merger for Template Files
 * @version 1.8.4
 *
 * Handles two patterns:
 * 1. `extends` pattern: Variant file with `extends: path/to/skeleton.md`
 * 2. VARIANT-SECTION pattern: Marker-based section substitution
 *
 * Security features:
 * - YAML injection protection (path whitelisting, external URL blocking)
 * - Circular reference detection (depth limiting, visited tracking)
 * - Agent path validation
 *
 * Error recovery (v1.7.0):
 * - Error classification: unrecoverable (circular, security) vs recoverable (missing file, invalid YAML)
 * - Graceful fallback for recoverable errors with default L0 content
 * - Edge case handling: missing sections, conflicting actions, invalid actions
 *
 * Testing (v1.8.0):
 * - Comprehensive unit test coverage for Phase 1 stability improvements
 * - Security validation tests for path traversal and external URL blocking
 * - Circular reference detection and depth limit tests
 * - variant_sections semantics tests (prepend, replace, append actions)
 * - Edge case handling tests (missing sections, conflicting actions, invalid YAML)
 * - Error recovery strategy tests (recoverable vs unrecoverable errors)
 *
 * Integrated with ADR-0033 circular reference prevention via extends-validator.ts
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname, normalize } from 'path';
import { load, dump } from 'js-yaml';
import { safeValidateExtends, ExtendsValidationResult } from './extends-validator.js';

/**
 * Error type classification for error recovery strategy
 */
enum ErrorType {
  // Unrecoverable (fatal) - terminate processing
  CIRCULAR_REFERENCE = "circular_reference",
  SECURITY_VIOLATION = "security_violation",

  // Recoverable (warning) - attempt fallback
  MISSING_FILE = "missing_file",
  MISSING_SECTION = "missing_section",
  INVALID_YAML = "invalid_yaml"
}

/**
 * Resolution error structure with recovery information
 */
interface ResolutionError {
  type: ErrorType;
  path: string;
  message: string;
  recoverable: boolean;
  suggestion: string;
}

/**
 * Default L0 content for fallback recovery
 */
const DEFAULT_L0_BODY = `You are a project manager agent responsible for coordinating multi-agent workflows.

## Role Declaration

You ARE the PM agent for this session. Load and follow \`agents/pm.md\` at all times.

**Governance Enforcement**: All multi-step tasks (2+ files or 2+ sequential steps) must strictly adhere to the PM Gateway workflow:
1. Display execution plan table first (task | agent | tier | model | platform)
2. Only then invoke the \`Agent\` tool to dispatch specialist agents
3. Never bypass PM workflow — direct specialist invocation is forbidden

> **Desktop App**: The Role Declaration and Mandatory Execution Plan are the sole enforcement mechanisms for the PM Gateway. Treat them as strictly binding.`;

/**
 * Security: Allowed base paths for extends resolution
 */
const ALLOWED_PATHS = new Set(["agents/", "templates/", "vendors/", "scripts/", "docs/", "skills/", ".claude/", ".gemini/", "tests/fixtures/"]);

/**
 * Security: Maximum extends chain depth to prevent infinite recursion
 */
const MAX_EXTENDS_DEPTH = 10;

interface Frontmatter {
  extends?: string;
  [key: string]: any;
}

interface ParsedFile {
  frontmatter: Frontmatter;
  content: string;
  raw: string;
}

/**
 * Variant section definition with action field
 */
interface VariantSection {
  section: string;
  action: "prepend" | "replace" | "append";
  content?: any;
}

/**
 * Resolution result with error tracking
 */
interface ResolutionResult {
  success: boolean;
  content: string;
  errors: ResolutionError[];
  warnings: string[];
}

/**
 * Classify error into recoverable vs unrecoverable with actionable suggestions
 */
function classifyError(error: Error, filePath: string): ResolutionError {
  const message = error.message.toLowerCase();

  // Circular reference - unrecoverable
  if (message.includes("circular")) {
    return {
      type: ErrorType.CIRCULAR_REFERENCE,
      path: filePath,
      message: error.message,
      recoverable: false,
      suggestion: "Check extends paths for cycles and fix circular references in the chain"
    };
  }

  // Security violation - unrecoverable
  if (message.includes("security") || message.includes("whitelist") || message.includes("protocol") || message.includes("traversal")) {
    return {
      type: ErrorType.SECURITY_VIOLATION,
      path: filePath,
      message: error.message,
      recoverable: false,
      suggestion: "Review security configuration: check extends path is within allowed directories and contains no protocol injection or path traversal"
    };
  }

  // Missing file - recoverable (use fallback)
  if (message.includes("no such file") || message.includes("file not found") || message.includes("cannot find")) {
    return {
      type: ErrorType.MISSING_FILE,
      path: filePath,
      message: error.message,
      recoverable: true,
      suggestion: "Create missing file, fix extends path, or continue with default L0 fallback"
    };
  }

  // Invalid YAML - recoverable (attempt recovery)
  if (message.includes("yaml") || message.includes("parse") || message.includes("dump")) {
    return {
      type: ErrorType.INVALID_YAML,
      path: filePath,
      message: error.message,
      recoverable: true,
      suggestion: "Check YAML syntax and fix formatting errors, or continue with partial content"
    };
  }

  // Missing section - recoverable (warning only)
  if (message.includes("section") || message.includes("heading")) {
    return {
      type: ErrorType.MISSING_SECTION,
      path: filePath,
      message: error.message,
      recoverable: true,
      suggestion: "Section not found - continuing without it (may affect content structure)"
    };
  }

  // Default - treat as unrecoverable for safety
  return {
    type: ErrorType.INVALID_YAML,
    path: filePath,
    message: error.message,
    recoverable: false,
    suggestion: "Review error details - unknown error type treated as unrecoverable for safety"
  };
}

/**
 * Get default L0 content for error recovery
 */
function getDefaultL0Content(): { frontmatter: Frontmatter; content: string } {
  return {
    frontmatter: {
      extends: null
    },
    content: DEFAULT_L0_BODY
  };
}

/**
 * Security: Extract agent path from agent string (e.g., "automation-engineer (agents/automation-engineer.md)")
 */
function extractAgentPath(agent: string): string | null {
  const match = agent.match(/\((.*?)\)/);
  return match ? match[1] : null;
}

/**
 * Security: Validate YAML configuration against injection attacks
 * P0 - Implements whitelist-based path validation, external URL blocking, and agent path validation
 */
function validateYAMLSecurity(config: any, basePath: string): void {
  // 1. Whitelist-based path validation for extends directive
  if (config.extends) {
    // 1.1 External URL blocking - prevent http(s) URLs in extends (check BEFORE path resolution)
    if (/^https?:\/\//.test(config.extends)) {
      throw new Error("Security: external extends URLs are not allowed");
    }

    // 1.2 Protocol injection prevention (file://, data://, etc.)
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(config.extends)) {
      throw new Error(`Security: protocol-based extends not allowed: ${config.extends}`);
    }

    // 1.3 Whitelist-based path validation (AFTER security checks)
    const resolvedPath = resolve(basePath, config.extends);
    const normalizedPath = normalize(resolvedPath).replace(/\\/g, '/');

    // Check if path contains allowed directories (handle both forward and backslashes)
    const isAllowed = Array.from(ALLOWED_PATHS).some(allowed => {
      const normalizedAllowed = allowed.replace(/\\/g, '/');
      return normalizedPath.includes(normalizedAllowed);
    });

    if (!isAllowed) {
      throw new Error(`Security: extends path outside workspace whitelist: ${resolvedPath}`);
    }
  }

  // 5. Agent path validation for variant_overrides.agent_roster
  if (config.variant_overrides?.agent_roster) {
    for (const entry of config.variant_overrides.agent_roster) {
      const agentsList = Array.isArray(entry.agents) ? entry.agents : [entry.agents];

      for (const agentRaw of agentsList) {
        if (!agentRaw) continue;

        const agentStr = typeof agentRaw === 'string' ? agentRaw : agentRaw.name || '';
        const agentPath = extractAgentPath(agentStr);

        if (agentPath) {
          // Validate agent path is within allowed directories
          const isAllowed = agentPath.startsWith("agents/") ||
                          agentPath.startsWith("vendors/") ||
                          agentPath.startsWith("templates/");

          if (!isAllowed) {
            throw new Error(`Security: invalid agent path: ${agentPath}`);
          }

          // Check for path traversal in agent paths
          if (agentPath.includes('..')) {
            throw new Error(`Security: path traversal not allowed in agent path: ${agentPath}`);
          }
        }
      }
    }
  }

  // 6. Validate remove_sections and variant_sections are arrays
  if (config.remove_sections && !Array.isArray(config.remove_sections)) {
    throw new Error("Security: remove_sections must be an array");
  }

  if (config.variant_overrides?.variant_sections && !Array.isArray(config.variant_overrides.variant_sections)) {
    throw new Error("Security: variant_sections must be an array");
  }
}

/**
 * Parse variant sections with backward compatibility for remove_sections
 * P1 - Handles both legacy remove_sections and new variant_sections with action field
 *
 * Edge cases handled:
 * - Missing section in replace action: throws Error with guidance
 * - Conflicting actions for same section: last action wins (warning logged)
 * - Invalid action: throws Error with valid action list
 */
function parseVariantSections(config: any): VariantSection[] {
  // Backward compatibility: remove_sections (deprecated)
  if (config.variant_overrides?.remove_sections) {
    console.warn("remove_sections is deprecated, use variant_sections with action field");
    return config.variant_overrides.remove_sections.map((section: string) => ({
      section,
      action: "prepend" as const,
      content: null
    }));
  }

  // New variant_sections with action field support
  if (config.variant_overrides?.variant_sections) {
    const sectionMap = new Map<string, VariantSection>();

    for (const s of config.variant_overrides.variant_sections) {
      const action = s.action || "prepend";

      // Validate action
      if (!["prepend", "replace", "append"].includes(action)) {
        throw new Error(
          `Invalid action "${action}" for section "${s.section}". ` +
          `Valid actions: prepend, replace, append`
        );
      }

      const variantSection: VariantSection = {
        section: s.section,
        action: action as "prepend" | "replace" | "append",
        content: s.content || null
      };

      // Detect conflicting actions
      if (sectionMap.has(s.section)) {
        const existing = sectionMap.get(s.section)!;
        if (existing.action !== action) {
          console.warn(
            `⚠️  Conflicting actions for section "${s.section}": "${existing.action}" vs "${action}". Using last action: "${action}"`
          );
        }
      }

      sectionMap.set(s.section, variantSection);
    }

    return Array.from(sectionMap.values());
  }

  return [];
}

/**
 * Parse YAML frontmatter from markdown content
 */
function parseFrontmatter(content: string): ParsedFile {
  const match = content.match(/^---\n([\s\S]+?)\n---\n?([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, content: content.trim(), raw: content };
  }

  try {
    const frontmatter = load(match[1]) as Frontmatter;
    return {
      frontmatter,
      content: match[2] ? match[2].trim() : '',
      raw: content
    };
  } catch (error) {
    console.error('Failed to parse YAML:', error);
    return { frontmatter: {}, content: content, raw: content };
  }
}

/**
 * Recursively resolve the extends chain of a skeleton file with circular reference protection
 * P0 - Enhanced with visited Set tracking and depth limiting
 *
 * Edge cases handled:
 * - Missing sections: extractSection returns empty string (warning)
 * - Conflicting variant_sections: last action wins (warning)
 * - Invalid action: throws Error with guidance
 */
function resolveExtendsRecursively(
  filePath: string,
  visited = new Set<string>(),
  depth = 0
): { frontmatter: Frontmatter; content: string } {
  // Check circular reference
  const normalizedPath = normalize(resolve(filePath));
  if (visited.has(normalizedPath)) {
    throw new Error(`Circular extends detected: ${normalizedPath}`);
  }

  // Check depth limit
  if (depth > MAX_EXTENDS_DEPTH) {
    throw new Error(`Extends depth exceeded: ${depth} (max: ${MAX_EXTENDS_DEPTH})`);
  }

  // Add to visited set
  visited.add(normalizedPath);

  const absolutePath = resolve(filePath);
  const content = readFileSync(absolutePath, 'utf-8');
  const parsed = parseFrontmatter(content);

  if (!parsed.frontmatter.extends) {
    return {
      frontmatter: parsed.frontmatter,
      content: parsed.content
    };
  }

  const currentDir = dirname(absolutePath);
  const skeletonPath = resolve(currentDir, parsed.frontmatter.extends);

  // Security validation before recursing
  validateYAMLSecurity(parsed.frontmatter, currentDir);

  try {
    const skeletonResolved = resolveExtendsRecursively(skeletonPath, visited, depth + 1);

    // Merge skeleton resolved frontmatter and current frontmatter
    const mergedFrontmatter = { ...skeletonResolved.frontmatter };
    for (const key of Object.keys(parsed.frontmatter)) {
      if (key !== 'extends') {
        mergedFrontmatter[key] = parsed.frontmatter[key];
      }
    }
    delete (mergedFrontmatter as any).extends;

    // Use current content if it exists, otherwise skeleton's content
    const useCurrentContent = parsed.content.trim().length > 0;
    const finalContent = useCurrentContent ? parsed.content : skeletonResolved.content;

    return {
      frontmatter: mergedFrontmatter,
      content: finalContent
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to resolve extends from ${filePath}: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Resolve extends with error recovery strategy
 * Returns structured result with errors, warnings, and fallback content
 */
function resolveExtendsWithRecovery(
  filePath: string,
  visited = new Set<string>(),
  depth = 0
): ResolutionResult {
  const errors: ResolutionError[] = [];
  const warnings: string[] = [];

  try {
    const result = resolveExtendsRecursively(filePath, visited, depth);
    return {
      success: true,
      content: `---
${dump(result.frontmatter).trim()}
---

${result.content}`,
      errors,
      warnings
    };

  } catch (error) {
    const resolutionError = classifyError(error as Error, filePath);
    errors.push(resolutionError);

    console.error(`❌ Error resolving extends: ${resolutionError.type}`);
    console.error(`   Path: ${resolutionError.path}`);
    console.error(`   Message: ${resolutionError.message}`);
    console.warn(`💡 Suggestion: ${resolutionError.suggestion}`);

    // Attempt recovery for recoverable errors
    if (resolutionError.recoverable) {
      console.warn(`🔄 Recoverable error - attempting fallback...`);

      try {
        const fallback = getDefaultL0Content();
        warnings.push(`Using fallback L0 content due to: ${resolutionError.message}`);

        return {
          success: true,
          content: `---
${dump(fallback.frontmatter).trim()}
---

${fallback.content}`,
          errors,
          warnings
        };
      } catch (fallbackError) {
        // Fallback failed - return original error
        return {
          success: false,
          content: '',
          errors,
          warnings: ['Fallback recovery failed - returning original error']
        };
      }
    }

    // Unrecoverable error - terminate with clear message
    console.error(`🚨 Unrecoverable error - cannot continue`);
    return {
      success: false,
      content: '',
      errors,
      warnings
    };
  }
}

/**
 * Remove markdown sections listed in `remove_sections` from a content string.
 */
function removeSections(content: string, sectionsToRemove: string[]): string {
  if (!sectionsToRemove || sectionsToRemove.length === 0) return content;

  const lines = content.split('\n');
  const headingRegex = /^(#{1,6})\s+(.+)$/;

  const toRemove = sectionsToRemove.map(s => {
    const trimmed = s.trim().replace(/\s+/g, ' ');
    const spaceIdx = trimmed.indexOf(' ');
    return {
      hashes: spaceIdx >= 0 ? trimmed.slice(0, spaceIdx) : trimmed,
      prefix: spaceIdx >= 0 ? trimmed.slice(spaceIdx + 1).toLowerCase() : ''
    };
  });

  function cleanText(str: string): string {
    return str
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function shouldRemove(hashes: string, title: string): boolean {
    const cleanTitle = cleanText(title);
    return toRemove.some(r => {
      if (r.hashes !== hashes) return false;
      const cleanPrefix = cleanText(r.prefix);
      return cleanTitle === cleanPrefix || cleanTitle.startsWith(cleanPrefix + ' ') || cleanTitle.startsWith(cleanPrefix + '(');
    });
  }

  const result: string[] = [];
  let skipping = false;
  let skipLevel = 0;

  for (const line of lines) {
    const match = line.match(headingRegex);
    if (match) {
      const level = match[1].length;
      const hashes = match[1];
      const title = match[2];

      if (shouldRemove(hashes, title)) {
        skipping = true;
        skipLevel = level;
        continue;
      }

      if (skipping && level <= skipLevel) {
        skipping = false;
        skipLevel = 0;
      }
    }

    if (!skipping) {
      result.push(line);
    }
  }

  return result.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Clean text for robust matching of sections
 */
function cleanSectionName(str: string): string {
  return str.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

/**
 * Extract a markdown section content from a content string by heading title
 *
 * Edge cases handled:
 * - Missing section: returns empty string (warning logged)
 * - Empty section: returns empty string (no warning)
 */
function extractSection(content: string, headingTitle: string): string {
  const lines = content.split('\n');
  const headingRegex = /^(#{1,6})\s+(.+)$/;
  let sectionLines: string[] = [];
  let found = false;
  let startLevel = 0;

  const cleanTarget = cleanSectionName(headingTitle);

  for (const line of lines) {
    const match = line.match(headingRegex);
    if (match) {
      const level = match[1].length;
      const title = match[2];

      if (found) {
        if (level <= startLevel) {
          break;
        }
      } else {
        if (cleanSectionName(title) === cleanTarget) {
          found = true;
          startLevel = level;
          continue;
        }
      }
    }
    if (found) {
      sectionLines.push(line);
    }
  }

  // Edge case: missing section
  if (!found && headingTitle.trim()) {
    console.warn(`⚠️  Section not found: "${headingTitle}" - returning empty content`);
  }

  return sectionLines.join('\n').trim();
}

/**
 * Parse constraint subpoints (plan, version, strategy) from L0 Constraints section
 */
function parseConstraintSubPoints(constraintsContent: string): { plan: string; version: string; strategy: string } {
  const lines = constraintsContent.split('\n');
  let planLines: string[] = [];
  let versionLines: string[] = [];
  let strategyLines: string[] = [];
  
  let current: 'plan' | 'version' | 'strategy' | 'none' = 'none';

  for (const line of lines) {
    if (line.trim().startsWith('- **Mandatory Execution Plan')) {
      current = 'plan';
    } else if (line.trim().startsWith('- **Script modification')) {
      current = 'version';
    } else if (line.trim().startsWith('- **Mandatory 3-Tier')) {
      current = 'strategy';
    } else if (line.trim().startsWith('- **Phase Determination')) {
      current = 'none';
    }

    if (current === 'plan') planLines.push(line);
    if (current === 'version') versionLines.push(line);
    if (current === 'strategy') strategyLines.push(line);
  }

  return {
    plan: planLines.join('\n').trim(),
    version: versionLines.join('\n').trim(),
    strategy: strategyLines.join('\n').trim()
  };
}

/**
 * Assigns match scores for a variant agent name to a target L0 agent
 */
function getAgentScore(agentName: string, phase: string, group: string, target: string): number {
  const name = agentName.toLowerCase();
  const p = phase.toLowerCase();
  const g = group.toLowerCase();
  
  let score = 0;

  switch (target) {
    case 'automation-engineer':
      if (name === 'code-writer') score += 100;
      if (name.includes('engineer')) score += 20;
      if (name.includes('developer')) score += 15;
      if (name.includes('specialist')) score += 10;
      if (name.includes('patch')) score += 10;
      if (name.includes('expert')) score += 5;
      if (p.includes('implement')) score += 50;
      if (p.includes('execute')) score += 40;
      if (p.includes('prototype')) score += 30;
      if (p.includes('remediation')) score += 20;
      if (p.includes('tech')) score += 10;
      if (g.includes('execution')) score += 30;
      if (g.includes('tools')) score += 15;
      break;

    case 'docs-writer':
      if (name === 'code-writer') {
        score = 0;
      } else {
        if (name === 'docs-writer') score += 100;
        if (name.includes('writer')) score += 30;
        if (name.includes('storyteller')) score += 20;
        if (name.includes('comm')) score += 15;
        if (p.includes('document')) score += 50;
        if (p.includes('content')) score += 40;
        if (p.includes('report')) score += 30;
        if (p.includes('technical')) score += 20;
        if (p.includes('narrative')) score += 20;
        if (g.includes('documentation')) score += 30;
        if (g.includes('content')) score += 20;
      }
      break;

    case 'auditor':
      if (name === 'auditor') score += 100;
      if (name.includes('test')) score += 30;
      if (name.includes('runner')) score += 25;
      if (name.includes('analyst')) score += 20;
      if (name.includes('researcher')) score += 15;
      if (p.includes('qa') || p.includes('verification')) score += 50;
      if (p.includes('test')) score += 40;
      if (p.includes('audit')) score += 30;
      if (p.includes('analysis')) score += 20;
      if (p.includes('research')) score += 15;
      if (g.includes('analysis')) score += 30;
      if (g.includes('qa')) score += 30;
      break;

    case 'architect':
      if (name === 'architect') score += 100;
      if (name.includes('architect')) score += 50;
      if (name.includes('designer')) score += 30;
      if (name.includes('lead')) score += 25;
      if (name.includes('coordinator')) score += 20;
      if (name.includes('manager')) score += 15;
      if (p.includes('design')) score += 50;
      if (p.includes('architect')) score += 40;
      if (p.includes('direction')) score += 30;
      if (p.includes('consult')) score += 20;
      if (p.includes('coordination')) score += 15;
      if (g.includes('design')) score += 30;
      if (g.includes('architecture')) score += 30;
      if (g.includes('strategy')) score += 20;
      break;

    case 'security-expert':
      if (name === 'security-expert') score += 100;
      if (name.includes('security')) score += 50;
      if (name.includes('pentester')) score += 40;
      if (name.includes('threat')) score += 30;
      if (name.includes('patch')) score += 20;
      if (name.includes('red-team') || name.includes('blue-team')) score += 20;
      if (p.includes('security')) score += 50;
      if (p.includes('threat')) score += 40;
      if (p.includes('penetration')) score += 30;
      if (g.includes('security')) score += 30;
      if (g.includes('red team') || g.includes('blue team')) score += 30;
      break;

    case 'scaffolding-expert':
      if (name === 'scaffolding-expert') score += 100;
      if (name.includes('scaffold')) score += 50;
      if (name.includes('setup')) score += 40;
      if (name.includes('installer')) score += 20;
      if (name.includes('specialist')) score += 15;
      if (p.includes('setup')) score += 50;
      if (p.includes('scaffold')) score += 40;
      if (p.includes('environment')) score += 30;
      if (p.includes('delivery')) score += 20;
      if (g.includes('setup')) score += 30;
      if (g.includes('infrastructure')) score += 20;
      break;
  }

  return score;
}

/**
 * Builds substitution mapping between L0 agent names and variant agent names
 */
function buildSubstitutionMap(agentRoster: any[]): Record<string, string> {
  const l0Agents = [
    'automation-engineer',
    'docs-writer',
    'auditor',
    'architect',
    'security-expert',
    'scaffolding-expert'
  ];

  const map: Record<string, string> = {};

  for (const l0 of l0Agents) {
    let bestAgent = l0;
    let maxScore = 0;

    for (const entry of agentRoster) {
      const phase = entry.phase || '';
      const group = entry.group || '';
      const agentsList = Array.isArray(entry.agents) ? entry.agents : [entry.agents];

      for (const agentRaw of agentsList) {
        if (!agentRaw) continue;
        const name = typeof agentRaw === 'string' ? agentRaw : agentRaw.name || '';
        if (!name) continue;

        const score = getAgentScore(name, phase, group, l0);
        if (score > maxScore) {
          maxScore = score;
          bestAgent = name;
        }
      }
    }

    map[l0] = maxScore >= 30 ? bestAgent : l0;
  }

  return map;
}

/**
 * Replaces L0 agent names with mapped variant agent names (handles capitalization and spacing)
 */
function substituteAgentNames(text: string, map: Record<string, string>): string {
  let result = text;
  for (const [l0Agent, varAgent] of Object.entries(map)) {
    if (l0Agent === varAgent) continue;
    
    const replaceAll = (t: string, from: string, to: string) => t.split(from).join(to);

    // 1. Lowercase hyphenated
    result = replaceAll(result, l0Agent, varAgent);
    // 2. Capitalized hyphenated
    const l0Cap = l0Agent.charAt(0).toUpperCase() + l0Agent.slice(1);
    const varCap = varAgent.charAt(0).toUpperCase() + varAgent.slice(1);
    result = replaceAll(result, l0Cap, varCap);
    // 3. Fully Capitalized hyphenated
    const l0FullCap = l0Agent.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('-');
    const varFullCap = varAgent.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('-');
    result = replaceAll(result, l0FullCap, varFullCap);

    // 4. Space separated versions
    const l0Space = l0Agent.replace(/-/g, ' ');
    const varSpace = varAgent.replace(/-/g, ' ');
    result = replaceAll(result, l0Space, varSpace);
    
    const l0SpaceCap = l0Cap.replace(/-/g, ' ');
    const varSpaceCap = varCap.replace(/-/g, ' ');
    result = replaceAll(result, l0SpaceCap, varSpaceCap);
    
    const l0SpaceFullCap = l0FullCap.replace(/-/g, ' ');
    const varSpaceFullCap = varFullCap.replace(/-/g, ' ');
    result = replaceAll(result, l0SpaceFullCap, varSpaceFullCap);
  }
  return result;
}

/**
 * Parses agent entry from variant_overrides.agent_roster
 */
function parseAgent(agent: any): { name: string; file: string; responsibility: string } {
  const defaultRespMap: Record<string, string> = {
    'architect': 'Architecture design',
    'code-writer': 'Code implementation',
    'test-runner': 'QA and verification',
    'stack-setup': 'Environment setup',
    'security-monitor': 'Security monitoring'
  };

  if (typeof agent === 'string') {
    return {
      name: agent,
      file: `agents/${agent}.md`,
      responsibility: defaultRespMap[agent] || ''
    };
  } else if (agent && typeof agent === 'object') {
    const name = agent.name || '';
    const file = agent.file || `agents/${name}.md`;
    const responsibility = agent.responsibility || defaultRespMap[name] || '';
    return { name, file, responsibility };
  }
  return { name: '', file: '', responsibility: '' };
}

/**
 * Generates 4-column roster table from variantOverrides.agent_roster
 */
function generateAgentRosterTable(agentRoster: any[]): string {
  const lines = [
    `## Agent Roster`,
    ``,
    `| Phase | Group | Agent file | Responsibility |`,
    `|-------|-------|------------|----------------|`,
  ];
  for (const entry of agentRoster) {
    const agentsList = Array.isArray(entry.agents) ? entry.agents : [entry.agents];
    for (const agentRaw of agentsList) {
      if (!agentRaw) continue;
      const agent = parseAgent(agentRaw);
      lines.push(`| ${entry.phase ?? ''} | ${entry.group ?? ''} | \`${agent.file}\` | ${agent.responsibility} |`);
    }
  }
  return lines.join('\n');
}

interface InjectedSections {
  role: string;
  agentRoster: string;
  constraints: string;
  governanceWorkflow: string;
  dispatchProtocol: string;
}

/**
 * Generate separate markdown sections from variant_overrides YAML structure (non-PM files fallback)
 */
function injectVariantSections(variantOverrides: Record<string, any> | undefined, variant: string): InjectedSections {
  const result: InjectedSections = {
    role: '',
    agentRoster: '',
    constraints: '',
    governanceWorkflow: '',
    dispatchProtocol: ''
  };

  if (!variantOverrides || Object.keys(variantOverrides).length === 0) return result;

  // 1. ## Role
  const r = variantOverrides.role || variantOverrides.updated_role;
  if (r) {
    const lines = [`## Role`];
    if (r.description) lines.push(``, r.description);
    if (r.scope) lines.push(``, `**Scope**: ${r.scope}`);
    result.role = lines.join('\n');
  }

  // 2. ## Agent Roster
  if (Array.isArray(variantOverrides.agent_roster) && variantOverrides.agent_roster.length > 0) {
    result.agentRoster = generateAgentRosterTable(variantOverrides.agent_roster);
  }

  // 3. ## ⚠️ CRITICAL: PM Direct Execution Constraints
  if (Array.isArray(variantOverrides.agent_roster) && variantOverrides.agent_roster.length > 0) {
    const lines = [
      `## ⚠️ CRITICAL: PM Direct Execution Constraints`,
      ``,
      `**FORBIDDEN**: PM performing Write/Edit on any file except:`,
      `- \`memory/*.md\` (session logs)`,
      `- \`CHANGELOG.md\` (sync pipeline only)`,
      ``,
      `**MANDATORY**: All file modifications MUST be dispatched to:`
    ];

    const agentMap = new Map<string, { groups: Set<string>; phases: Set<string> }>();
    for (const entry of variantOverrides.agent_roster) {
      if (!entry.agents) continue;
      const agentsList = Array.isArray(entry.agents) ? entry.agents : [entry.agents];
      for (const agent of agentsList) {
        if (!agent) continue;
        const agentName = typeof agent === 'string' ? agent : agent.name || '';
        if (!agentName) continue;
        if (!agentMap.has(agentName)) {
          agentMap.set(agentName, { groups: new Set<string>(), phases: new Set<string>() });
        }
        const info = agentMap.get(agentName)!;
        if (entry.group) info.groups.add(entry.group);
        if (entry.phase) info.phases.add(entry.phase);
      }
    }

    for (const [agentName, info] of agentMap.entries()) {
      const groupsStr = Array.from(info.groups).join(', ');
      const phasesStr = Array.from(info.phases).join(', ');
      let taskDesc = '';
      if (groupsStr && phasesStr) {
        taskDesc = `Dispatch for ${groupsStr} / ${phasesStr} tasks`;
      } else if (groupsStr) {
        taskDesc = `Dispatch for ${groupsStr} tasks`;
      } else if (phasesStr) {
        taskDesc = `Dispatch for phasesStr tasks`;
      } else {
        taskDesc = `Dispatch for assigned tasks`;
      }
      lines.push(`- **${agentName}**: ${taskDesc}`);
    }

    lines.push(
      ``,
      `**Rationale**: PM is orchestrator, not executor. Direct execution violates governance separation of concerns.`
    );
    result.constraints = lines.join('\n');
  }

  // 4. ## Governance Workflow
  if (variantOverrides.governance_workflow) {
    const g = variantOverrides.governance_workflow;
    const lines = [`## Governance Workflow`];
    if (Array.isArray(g.phases) && g.phases.length > 0) {
      lines.push(``, `**Orchestrated Phases**: ${g.phases.map((p: number) => `Phase ${p}`).join(', ')}`);
    }
    if (typeof g.triage_required === 'boolean') {
      lines.push(``, `**Triage Required**: ${g.triage_required ? 'Yes' : 'No'}`);
    }
    result.governanceWorkflow = lines.join('\n');
  }

  // 5. ## Dispatch Protocol
  if (variantOverrides.dispatch_protocol) {
    const d = variantOverrides.dispatch_protocol;
    const lines = [`## Dispatch Protocol`];
    if (Array.isArray(d.can_lead_phases)) {
      lines.push(``, `**Can Lead Phases**: [${d.can_lead_phases.join(', ')}]`);
    }
    if (Array.isArray(d.can_support_in) && d.can_support_in.length > 0) {
      lines.push(`**Can Support In**: [${d.can_support_in.join(', ')}]`);
    }
    if (Array.isArray(d.auto_dispatch_to) && d.auto_dispatch_to.length > 0) {
      lines.push(`**Auto-Dispatch To**: ${d.auto_dispatch_to.map((a: string) => `\`${a}\``).join(', ')}`);
    }
    if (d.tier) lines.push(`**Tier**: ${d.tier}`);
    if (d.communication_style) lines.push(`**Communication Style**: ${d.communication_style}`);
    result.dispatchProtocol = lines.join('\n');
  }

  return result;
}

/**
 * Process a single file with `extends` directive
 * Enhanced with security validation before processing
 *
 * Edge cases handled:
 * - Security validation failure: throws unrecoverable error
 * - Extends validation failure: falls back to original content
 * - Missing/invalid files: uses recovery strategy with fallback
 */
function processFile(filePath: string, explicitSkeletonPath?: string, originalContextPath?: string, explicitVariantLevel?: string): string {
  const absolutePath = resolve(filePath);
  const content = readFileSync(absolutePath, 'utf-8');
  const parsed = parseFrontmatter(content);

  if (!parsed.frontmatter.extends) {
    // Even without extends, validate security if variant_overrides present
    if (parsed.frontmatter.variant_overrides) {
      try {
        validateYAMLSecurity(parsed.frontmatter, dirname(absolutePath));
      } catch (error) {
        const resolutionError = classifyError(error as Error, filePath);
        console.error(`❌ Security validation failed: ${resolutionError.type}`);
        console.error(`   Message: ${resolutionError.message}`);
        console.warn(`💡 Suggestion: ${resolutionError.suggestion}`);
        throw error;
      }
    }
    return content;
  }

  // P0: Security validation before extends resolution
  try {
    validateYAMLSecurity(parsed.frontmatter, dirname(absolutePath));
  } catch (error) {
    const resolutionError = classifyError(error as Error, filePath);
    console.error(`❌ Security validation failed: ${resolutionError.type}`);
    console.error(`   Message: ${resolutionError.message}`);
    console.warn(`💡 Suggestion: ${resolutionError.suggestion}`);
    throw error;
  }

  // ADR-0033: Validate extends chain before processing
  // Skip validation if explicitSkeletonPath is provided (already validated by caller)
  if (!explicitSkeletonPath) {
    const validationPath = originalContextPath ? resolve(originalContextPath) : absolutePath;
    console.log(`🔍 Validating extends chain for: ${validationPath}`);
    const validationResult: ExtendsValidationResult = safeValidateExtends(validationPath);

    if (!validationResult.valid) {
      console.error(`❌ Extends validation failed: ${validationResult.message}`);
      console.warn(`⚠️  Falling back to safe default: returning original content without extends resolution`);
      return content;
    }

    console.log(`✅ Extends validation passed (depth: ${validationResult.depth})`);
  } else {
    console.log(`⏭️  Skipping extends validation (explicit skeleton path provided: ${explicitSkeletonPath})`);
  }

  let skeletonPath: string;
  if (explicitSkeletonPath) {
    skeletonPath = explicitSkeletonPath;
  } else {
    const variantDir = dirname(absolutePath);
    skeletonPath = resolve(variantDir, parsed.frontmatter.extends);
  }

  try {
    const skeletonResolved = resolveExtendsRecursively(skeletonPath);

    // Merge: variant frontmatter overrides the resolved skeleton frontmatter
    const mergedFrontmatter = { ...skeletonResolved.frontmatter };
    for (const key of Object.keys(parsed.frontmatter)) {
      if (key !== 'extends') {
        mergedFrontmatter[key] = parsed.frontmatter[key];
      }
    }
    delete (mergedFrontmatter as any).extends;

    const useCurrentContent = parsed.content.trim().length > 0;
    let baseContent = useCurrentContent ? parsed.content : skeletonResolved.content;

    const variantOverrides = mergedFrontmatter.variant_overrides;
    if (variantOverrides && typeof variantOverrides === 'object') {
      if (variantOverrides.frontmatter_overrides && typeof variantOverrides.frontmatter_overrides === 'object') {
        for (const [k, v] of Object.entries(variantOverrides.frontmatter_overrides)) {
          mergedFrontmatter[k] = v;
        }
        delete variantOverrides.frontmatter_overrides;
      }
    }

    // Edge case: validate variant_sections for missing sections before replace
    if (variantOverrides?.variant_sections) {
      const parsedSections = parseVariantSections({ variant_overrides: variantOverrides });
      for (const section of parsedSections) {
        if (section.action === 'replace') {
          const sectionExists = extractSection(baseContent, section.section).length > 0;
          if (!sectionExists) {
            console.warn(
              `⚠️  Replace action for missing section "${section.section}" - section may not exist in base content`
            );
          }
        }
      }
    }

    const isPMFile = filePath.toLowerCase().endsWith('agents/pm.md');

    let prependContent = '';
    let appendContent = '';

    // Use explicit variant level if provided, otherwise determine from path
    const currentVariantLevel = determineVariantLevel(filePath, explicitVariantLevel);

    console.error(`[DEBUG 1135] filePath: ${filePath}`);
    console.error(`[DEBUG 1135] explicitVariantLevel: ${explicitVariantLevel}`);
    console.error(`[DEBUG 1135] currentVariantLevel: ${currentVariantLevel}`);
    console.error(`[DEBUG 1135] isPMFile: ${isPMFile}`);

    if (isPMFile && currentVariantLevel === 'L2') {
      // For L2 PM files, use reconstructPMLayout to remove L0 content
      return reconstructPMLayout(mergedFrontmatter, baseContent, currentVariantLevel);
    }

    if (isPMFile) {
      console.error(`✅ PM File detected: applying force-strip, substitution mapping, and layout restructuring`);
      console.error(`✅ PM File path: ${filePath}`);

      // 1. Extract L0 sections before stripping
      const skeletonContent = skeletonResolved.content;
      const roleClarificationText = extractSection(skeletonContent, "ROLE CLARIFICATION");
      const singleEntryPointText = extractSection(skeletonContent, "YOU ARE THE SINGLE ENTRY POINT");
      const rawConstraintsText = extractSection(skeletonContent, "Constraints");

      // 2. Build substitution map from variant_overrides
      const substitutionMap = buildSubstitutionMap(variantOverrides?.agent_roster || []);
      const map = substitutionMap;

      // 3. Parse Constraint subpoints
      const subpoints = parseConstraintSubPoints(rawConstraintsText);

      // 4. Construct Constraints section
      const constraintsSection = `## Constraints

${substituteAgentNames(subpoints.plan, map)}

${substituteAgentNames(subpoints.version, map)}

- **Phase Determination (Deliverable-Type Gate)**:
  Before assigning an agent to any task, PM MUST classify the deliverable type and assign the correct Phase:

  ${generatePhaseDeterminationTable(variantOverrides, mergedFrontmatter.variant || 'unknown')}

  **Tier ceiling rule**: An agent's tier may NOT be elevated beyond its defined tier. \`${map['automation-engineer']}\` is always Low — assigning it High is a governance violation.

**Platform Note**: The execution plan table format has been simplified to remove the \`Platform\` column. PM will still internally manage the L0-only task classification.

${substituteAgentNames(subpoints.strategy, map)}`;

      // 5. Force-strip list from baseContent
      const forceRemove = [
        "## Role",
        "## ⚠️ ROLE CLARIFICATION",
        "## 🚨 YOU ARE THE SINGLE ENTRY POINT",
        "## ?좑툘 YOU ARE THE SINGLE ENTRY POINT",
        "## Governance Workflow",
        "## Updated Role",
        "## Agent Roster",
        "## Dispatch Protocol",
        "## Constraints"
      ];

      // For L2 variants, add additional sections to remove
      const currentVariantLevel = determineVariantLevel(filePath, explicitVariantLevel);
      console.log(`[DEBUG] PM file processing - variant level: ${currentVariantLevel}`);
      if (currentVariantLevel === 'L2') {
        console.log(`[DEBUG] Applying L2-specific section removal`);
        forceRemove.push(
          "## Consensus-Driven Facilitation Model",
          "## Permission Denial Protocol",
          "## Execution Plan Boilerplate Policy",
          "## Meeting Facilitation",
          "## Required Tools",
          "## ⚠️ CRITICAL: PM Direct Execution Constraints",
          "## Task Tracking vs Execution",
          "## User Communication for Specialist Tasks"
        );
        console.log(`🔪 L2 variant: additional ${forceRemove.length - 10} sections marked for removal`);
      } else {
        console.log(`[DEBUG] Not L2 variant, skipping additional removal`);
      }

      baseContent = removeSections(baseContent, forceRemove);
      baseContent = substituteAgentNames(baseContent, substitutionMap);

      // 6. Prepend parts assembly
      const prependParts: string[] = [];
      const r = variantOverrides?.role || variantOverrides?.updated_role;
      if (r) {
        const lines = [`## Role`];
        if (r.description) lines.push(``, r.description);
        if (r.scope) lines.push(``, `**Scope**: ${r.scope}`);
        prependParts.push(lines.join('\n'));
      }
      if (roleClarificationText) {
        prependParts.push(`## ⚠️ ROLE CLARIFICATION\n\n${substituteAgentNames(roleClarificationText, substitutionMap)}`);
      }
      if (singleEntryPointText) {
        prependParts.push(`## 🚨 YOU ARE THE SINGLE ENTRY POINT\n\n${substituteAgentNames(singleEntryPointText, substitutionMap)}`);
      }
      if (variantOverrides?.agent_roster) {
        prependParts.push(generateAgentRosterTable(variantOverrides.agent_roster));
      }
      prependParts.push(constraintsSection);
      prependContent = prependParts.join('\n\n');

      // 7. Append parts assembly
      const appendParts: string[] = [];
      if (variantOverrides?.governance_workflow) {
        const g = variantOverrides.governance_workflow;
        const lines = [`## Governance Workflow`];
        if (Array.isArray(g.phases) && g.phases.length > 0) {
          lines.push(``, `**Orchestrated Phases**: ${g.phases.map((p: number) => `Phase ${p}`).join(', ')}`);
        }
        if (typeof g.triage_required === 'boolean') {
          lines.push(``, `**Triage Required**: ${g.triage_required ? 'Yes' : 'No'}`);
        }
        appendParts.push(lines.join('\n'));
      }
      if (variantOverrides?.dispatch_protocol) {
        const d = variantOverrides.dispatch_protocol;
        const lines = [`## Dispatch Protocol`];
        if (Array.isArray(d.can_lead_phases)) {
          lines.push(``, `**Can Lead Phases**: [${d.can_lead_phases.join(', ')}]`);
        }
        if (Array.isArray(d.can_support_in) && d.can_support_in.length > 0) {
          lines.push(`**Can Support In**: [${d.can_support_in.join(', ')}]`);
        }
        if (Array.isArray(d.auto_dispatch_to) && d.auto_dispatch_to.length > 0) {
          const mappedAuto = d.auto_dispatch_to.map((a: string) => {
            const mapped = substitutionMap[a] || a;
            return `\`${mapped}\``;
          }).join(', ');
          lines.push(`**Auto-Dispatch To**: ${mappedAuto}`);
        }
        if (d.tier) lines.push(`**Tier**: ${d.tier}`);
        if (d.communication_style) lines.push(`**Communication Style**: ${d.communication_style}`);
        appendParts.push(lines.join('\n'));
      }
      appendContent = appendParts.join('\n\n');

    } else {
      // Normal skeleton section removal and fallback assembly
      let sectionsToRemove: string[] = mergedFrontmatter.remove_sections || [];

      // For L2 variants, merge remove_sections from L1 (skeleton) if available
      const variantLevel = determineVariantLevel(filePath, explicitVariantLevel);
      if (variantLevel === 'L2' && skeletonResolved.frontmatter.remove_sections) {
        const l1RemoveSections = skeletonResolved.frontmatter.remove_sections || [];
        const l2RemoveSections = mergedFrontmatter.remove_sections || [];
        sectionsToRemove = mergeRemoveSections(l1RemoveSections, l2RemoveSections);
        console.log(`🔗 Merged remove_sections: L1 (${l1RemoveSections.length}) + L2 (${l2RemoveSections.length}) = ${sectionsToRemove.length} total`);
      }

      if (sectionsToRemove.length > 0) {
        baseContent = removeSections(baseContent, sectionsToRemove);
        if (baseContent !== (useCurrentContent ? parsed.content : skeletonResolved.content)) {
          console.log(`✂️  Removed ${sectionsToRemove.length} section(s) from content: ${sectionsToRemove.join(', ')}`);
        }
      }

      const variantName: string = mergedFrontmatter.variant || 'unknown';
      const sections = injectVariantSections(variantOverrides, variantName);

      const prependParts: string[] = [];
      if (sections.role) prependParts.push(sections.role);
      if (sections.agentRoster) prependParts.push(sections.agentRoster);
      if (sections.constraints) prependParts.push(sections.constraints);
      prependContent = prependParts.join('\n\n');

      const appendParts: string[] = [];
      if (sections.governanceWorkflow) appendParts.push(sections.governanceWorkflow);
      if (sections.dispatchProtocol) appendParts.push(sections.dispatchProtocol);
      appendContent = appendParts.join('\n\n');
    }

    // Combine final body content
    let finalBody = '';
    if (prependContent) {
      finalBody += prependContent + '\n\n';
    }
    finalBody += baseContent;
    if (appendContent) {
      finalBody += '\n\n' + appendContent;
    }

    // Do not include remove_sections / extends directives in final output frontmatter
    delete (mergedFrontmatter as any).remove_sections;

    // Remove L0-only content from L2 variants
    const variantLevel = determineVariantLevel(filePath, explicitVariantLevel);
    console.log(`🔍 Variant Level: ${variantLevel}, File: ${filePath}`);
    let processedFinalBody = removeL0OnlyContent(finalBody, variantLevel);

    // Debug: Check if CONSTITUTION.md was removed
    if (variantLevel === 'L2' && processedFinalBody.includes('CONSTITUTION.md')) {
      console.warn('⚠️  CONSTITUTION.md still present after removeL0OnlyContent!');
    } else if (variantLevel === 'L2') {
      console.log('✅ CONSTITUTION.md successfully removed from L2 variant');
    }

    const result = `---
${dump(mergedFrontmatter).trim()}
---

${processedFinalBody}`;

    return result;
  } catch (error) {
    // Use error recovery strategy
    const resolutionError = classifyError(error as Error, skeletonPath);
    console.error(`❌ Failed to resolve skeleton: ${skeletonPath}`);
    console.error(`   Error type: ${resolutionError.type}`);
    console.error(`   Message: ${resolutionError.message}`);
    console.warn(`💡 Suggestion: ${resolutionError.suggestion}`);

    // Attempt recovery for recoverable errors
    if (resolutionError.recoverable) {
      console.warn(`🔄 Recoverable error detected - attempting fallback...`);
      try {
        const fallback = getDefaultL0Content();
        console.warn(`✅ Using fallback L0 content for ${filePath}`);

        const mergedFrontmatter = { ...fallback.frontmatter };
        for (const key of Object.keys(parsed.frontmatter)) {
          if (key !== 'extends') {
            mergedFrontmatter[key] = parsed.frontmatter[key];
          }
        }
        delete (mergedFrontmatter as any).extends;

        return `---
${dump(mergedFrontmatter).trim()}
---

${fallback.content}`;
      } catch (fallbackError) {
        console.error(`❌ Fallback recovery failed: ${fallbackError instanceof Error ? fallbackError.message : fallbackError}`);
        console.warn(`⚠️  Falling back to safe default: returning original content`);
        return content;
      }
    }

    // Unrecoverable error - return original content with error logged
    console.error(`🚨 Unrecoverable error - cannot apply extends resolution`);
    console.warn(`⚠️  Falling back to safe default: returning original content`);
    return content;
  }
}

/**
 * Determine variant level from file path with explicit level support
 * @param filePath - File path to analyze
 * @param explicitLevel - Optional explicit variant level
 * @returns Variant level (L0, L1, or L2)
 */
function determineVariantLevel(filePath: string, explicitLevel?: string): string {
  // Use explicit level if provided
  if (explicitLevel) {
    return explicitLevel;
  }

  const normalizedPath = filePath.replace(/\\/g, '/');

  // L2 variants (co-*)
  // Check both absolute (with leading /) and relative paths (without leading /)
  // Also check for co-work variant directories (e.g., co-work/, co-creation/)
  if (normalizedPath.includes('templates/co-') || normalizedPath.match(/\/co-[a-z]+\/agents\//)) {
    return 'L2';
  }

  // L1 variant (common)
  if (normalizedPath.includes('templates/common/')) {
    return 'L1';
  }

  // L0 (workspace root)
  return 'L0';
}

/**
 * Group → Type Mapping based on specification document
 * Used for Phase Determination table generation
 */
interface GroupTypeMapping {
  [groupName: string]: string;
}

/**
 * Default Group → Type mappings from specification
 */
const DEFAULT_GROUP_TYPE_MAPPING: GroupTypeMapping = {
  'Design': 'design',
  'Direction': 'design',
  'Visual': 'design',
  'Typography': 'design',
  'Service': 'design',
  'Execution': 'execution',
  'Prototype': 'execution',
  'Implementation': 'execution',
  'Analysis': 'qa',
  'Research': 'qa',
  'Subject Matter': 'qa',
  'SME': 'qa',
  'Data': 'qa',
  'Strategy': 'qa',
  'Coordination': 'pm',
  'Management': 'pm',
  'PMO': 'pm',
  'Tools': 'infrastructure',
  'Office': 'infrastructure',
  'Tech': 'infrastructure',
  'Technology': 'infrastructure',
  'Architecture': 'infrastructure',
  'Setup': 'infrastructure',
  'Content': 'documentation',
  'Narrative': 'documentation',
  'Comm': 'documentation',
  'Security': 'security',
  'Red Team': 'security',
  'Blue Team': 'security',
  'Delivery': 'delivery',
  'Workstream': 'delivery'
};

/**
 * Fallback hierarchy for missing agent types
 * Based on specification document
 */
const FALLBACK_HIERARCHY: Record<string, string[]> = {
  'design': ['designer', 'architect'],
  'execution': ['code-writer', 'prototype-engineer', 'automation-engineer'],
  'qa': ['analyst', 'researcher', 'auditor'],
  'pm': ['project-coordinator', 'delivery-manager', 'pm'],
  'infrastructure': ['technology-specialist', 'solutions-architect', 'security-expert'],
  'documentation': ['technical-writer', 'content-writer', 'docs-writer'],
  'security': ['security-monitor', 'threat-modeler', 'security-expert'],
  'delivery': ['delivery-manager', 'workstream-lead', 'pm']
};

/**
 * Extract agent types from roster based on group → type mapping
 * @param agentRoster - Agent roster from variant_overrides
 * @param variant - Variant name for context-aware classification
 * @returns Object mapping agent types to agent names
 */
function extractAgentTypes(agentRoster: any[], variant: string): Record<string, string> {
  const types: Record<string, string> = {
    design: null,
    execution: null,
    qa: null,
    pm: null,
    infrastructure: null,
    documentation: null,
    security: null,
    delivery: null
  };

  // Create a mapping of available agents
  const availableAgents: Record<string, string> = {};

  for (const phaseGroup of agentRoster) {
    const group = phaseGroup.group;
    const agents = phaseGroup.agents;

    // Handle Strategy group context-aware classification
    let agentType = DEFAULT_GROUP_TYPE_MAPPING[group];

    if (group === 'Strategy') {
      // Context-based override for Strategy group
      if (variant === 'co-design') {
        agentType = 'design'; // Design strategy
      } else {
        agentType = 'qa'; // Strategic analysis (default)
      }
    }

    // Handle Analysis group in security context
    if (group === 'Analysis' && phaseGroup.phase?.toLowerCase().includes('threat')) {
      agentType = 'security';
    }

    // Map first agent in group to type
    if (agentType && agents && agents.length > 0) {
      const agentName = typeof agents[0] === 'string' ? agents[0] : agents[0].name;

      // Only assign if type not already assigned
      if (agentType && !types[agentType]) {
        types[agentType] = agentName;
      }

      // Track available agents for fallback
      availableAgents[agentName] = agentType || 'unknown';
    }
  }

  // Apply fallback hierarchy for missing types
  for (const agentType of Object.keys(types)) {
    if (!types[agentType]) {
      const fallbackChain = FALLBACK_HIERARCHY[agentType] || [];

      for (const fallbackAgent of fallbackChain) {
        // Check if fallback agent exists in available agents
        if (availableAgents[fallbackAgent]) {
          types[agentType] = fallbackAgent;
          console.warn(`⚠️  Using fallback: ${fallbackAgent} for type ${agentType}`);
          break;
        }

        // Check if fallback agent exists in roster (even if not mapped)
        for (const phaseGroup of agentRoster) {
          const agents = phaseGroup.agents || [];
          for (const agent of agents) {
            const agentName = typeof agent === 'string' ? agent : agent.name;
            if (agentName === fallbackAgent) {
              types[agentType] = fallbackAgent;
              console.warn(`⚠️  Using fallback from roster: ${fallbackAgent} for type ${agentType}`);
              break;
            }
          }
          if (types[agentType]) break;
        }

        if (types[agentType]) break;
      }

      // Final fallback - use L0 agent with warning
      if (!types[agentType] && fallbackChain.length > 0) {
        const l0Agent = fallbackChain[fallbackChain.length - 1];
        types[agentType] = l0Agent;
        console.warn(`🚨 L0 fallback used: ${l0Agent} for type ${agentType} - consider adding dedicated agent to roster`);
      }
    }
  }

  return types;
}

/**
 * Generate Phase Determination table with variant agents
 * @param variantOverrides - variant_overrides from YAML
 * @param variant - Variant name for context
 * @returns Markdown table string
 */
function generatePhaseDeterminationTable(variantOverrides: any, variant: string): string {
  const agentTypes = extractAgentTypes(variantOverrides?.agent_roster || [], variant);

  // Build table rows dynamically based on available agent types
  const rows: string[] = [];

  // Design type deliverables
  if (agentTypes.design) {
    rows.push(`| New file design / schema definition / ADR | Phase 1-2 | ${agentTypes.design} | High | Must precede implementation |`);
    rows.push(`| New directory structure / template layout | Phase 1-2 | ${agentTypes.design} | High | Must precede implementation |`);
    rows.push(`| Cross-platform convention / naming standard | Phase 1-2 | ${agentTypes.design} | High | Must precede implementation |`);
  }

  // Execution type deliverables
  if (agentTypes.execution) {
    rows.push(`| Script implementation (approved plan exists) | Phase 4 | ${agentTypes.execution} | Low | Plan from design agent required |`);
  }

  // Documentation type deliverables
  if (agentTypes.documentation) {
    rows.push(`| Documentation writing | Phase 4 | ${agentTypes.documentation} | Medium | |`);
  }

  // Security type deliverables
  if (agentTypes.security) {
    rows.push(`| Security configuration | Phase 6 | ${agentTypes.security} | Medium | |`);
  }

  // Infrastructure type deliverables
  if (agentTypes.infrastructure) {
    rows.push(`| Project scaffolding / environment setup | Phase 0 | ${agentTypes.infrastructure} | Low | |`);
  }

  // PM type deliverables
  if (agentTypes.pm) {
    rows.push(`| Project coordination / task management | Phase 0 | ${agentTypes.pm} | Medium | |`);
  }

  // QA type deliverables
  if (agentTypes.qa) {
    rows.push(`| Analysis / research / domain expertise | Phase 1-2 | ${agentTypes.qa} | Medium | |`);
  }

  // Delivery type deliverables
  if (agentTypes.delivery) {
    rows.push(`| Delivery management / workstream coordination | Phase 0 | ${agentTypes.delivery} | Medium | |`);
  }

  // Generate table
  const lines = [
    `| Deliverable Type | → Phase | → Required Agent | → Tier | Notes |`,
    `|------------------|---------|----------------|--------|-------|`,
    ...rows
  ];

  return lines.join('\n');
}

/**
 * Reconstruct PM layout for L2 variants by removing L0-only content
 * @param yaml - Parsed YAML frontmatter
 * @param baseContent - Base content to process
 * @param variantLevel - Variant level (L0, L1, L2)
 * @returns Reconstructed layout with variant-specific content only
 */
function reconstructPMLayout(yaml: any, baseContent: string, variantLevel: string): string {
  // 1. Extract variant-specific content from YAML frontmatter
  const variantOverrides = yaml.variant_overrides;
  const substitutionMap = buildSubstitutionMap(variantOverrides?.agent_roster || []);

  // 2. For L2 variants, return ONLY YAML frontmatter (no body content)
  if (variantLevel === 'L2') {
    return dump(yaml).trim();
  }

  // 3. For L0/L1, remove L0-specific content from baseContent
  let processedContent = removeL0OnlyContent(baseContent, variantLevel);

  // 4. Apply agent name substitution
  processedContent = substituteAgentNames(processedContent, substitutionMap);

  // 5. Construct final result with YAML frontmatter
  const result = `${dump(yaml).trim()}
----

${processedContent}`;

  // 6. Return reconstructed layout
  return result;
}

/**
 * Remove L0-only content from L2 variants
 * @param content - Content to process
 * @param variantLevel - Variant level (L0, L1, L2)
 * @returns Processed content
 *
 * L0 CONTENT DUPLICATION FIX - v1.8.2:
 * - Fixed determineVariantLevel to handle relative paths without leading /
 * - Fixed removeL0OnlyContent to remove CONSTITUTION.md lines completely
 * - Added L2-specific section removal in PM file handling
 */
function removeL0OnlyContent(content: string, variantLevel: string): string {
  if (variantLevel !== 'L2') {
    return content;
  }

  let processed = content;

  // Remove lines containing CONSTITUTION.md references
  processed = processed.replace(
    /^.*CONSTITUTION\.md.*$/gm,
    ''
  );

  // Remove Platform Note about Platform column
  processed = processed.replace(
    /\*\*Platform Note\*\*: The execution plan table format has been simplified to remove the `Platform` column\. PM will still internally manage the L0-only task classification\.\n*/g,
    ''
  );

  // Replace "Root Configuration Changes" with "Configuration Changes"
  processed = processed.replace(
    /Root Configuration Changes/g,
    'Configuration Changes'
  );

  // Clean up multiple consecutive blank lines
  processed = processed.replace(/\n{3,}/g, '\n\n');

  return processed;
}

/**
 * Merge remove_sections from L1 and L2 variants
 * Ensures L2 inherits and extends L1's remove_sections
 * @param l1RemoveSections - remove_sections from L1 variant
 * @param l2RemoveSections - remove_sections from L2 variant
 * @returns Merged remove_sections array
 */
function mergeRemoveSections(l1RemoveSections: string[], l2RemoveSections: string[]): string[] {
  const merged = [...(l1RemoveSections || [])];

  // Add L2 sections that aren't already in the list
  for (const section of (l2RemoveSections || [])) {
    if (!merged.includes(section)) {
      merged.push(section);
    }
  }

  return merged;
}

// Export functions for testing
export {
  validateYAMLSecurity,
  parseVariantSections,
  resolveExtendsRecursively,
  resolveExtendsWithRecovery,
  classifyError,
  extractSection,
  parseFrontmatter,
  removeSections,
  extractAgentTypes,
  generatePhaseDeterminationTable,
  removeL0OnlyContent,
  mergeRemoveSections
};

// CLI interface (only run when executed directly, not when imported)
if (process.argv[1] && process.argv[1].endsWith('merge-frontmatter.ts')) {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: merge-frontmatter.ts <file-path> [skeleton-path] [original-context-path] [variant-level]');
    console.error('  file-path: Path to the variant file with extends directive');
    console.error('  skeleton-path: Optional absolute path to skeleton file');
    console.error('  original-context-path: Optional path to the original context file for extends validation');
    console.error('  variant-level: Optional explicit variant level (L0, L1, L2)');
    process.exit(1);
  }

  const filePath = args[0];
  const explicitSkeletonPath = args[1] || undefined;
  const originalContextPath = args[2] || undefined;
  const explicitVariantLevel = args[3] || undefined;

  console.error(`[CLI DEBUG] filePath: ${filePath}`);
  console.error(`[CLI DEBUG] explicitSkeletonPath: ${explicitSkeletonPath}`);
  console.error(`[CLI DEBUG] originalContextPath: ${originalContextPath}`);
  console.error(`[CLI DEBUG] explicitVariantLevel: ${explicitVariantLevel}`);

  const result = processFile(filePath, explicitSkeletonPath, originalContextPath, explicitVariantLevel);
  writeFileSync(filePath, result, 'utf-8');
  console.log(`✅ Merged frontmatter for ${filePath}`);
}
