#!/usr/bin/env bun
/**
 * Extends Chain Validator - Circular Reference Prevention
 * @version 1.0.1
 *
 * Implements ADR-0033 circular reference prevention for pm.md extends pattern.
 * Provides safe fallback behavior when limits are exceeded.
 *
 * Security Limits (ADR-0033):
 * - MAX_EXTENDS_DEPTH = 3 (L2→L1→L0 maximum chain depth)
 * - MAX_FILE_SIZE = 100_000 (100KB maximum file size)
 * - MAX_PARSE_TIME = 5000 (5 seconds maximum parse time)
 *
 * Safe Fallback Behavior:
 * When limits are exceeded, the validator:
 * 1. Logs a warning with specific details
 * 2. Returns safe default (no crash)
 * 3. Provides clear error indication
 *
 * Usage:
 *   Direct validation: bun scripts/helpers/extends-validator.ts <file-path>
 *   Module import: import { safeValidateExtends } from './helpers/extends-validator.ts'
 */

import { readFileSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { validateExtendsSecurity, SecurityValidationResult } from './security-validator.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Constants (ADR-0033 Security Limits)
// ─────────────────────────────────────────────────────────────────────────────

const MAX_EXTENDS_DEPTH = 3;        // Maximum extends chain depth (L2→L1→L0)
const MAX_FILE_SIZE = 100_000;      // 100KB maximum file size
const MAX_PARSE_TIME = 5000;       // 5 seconds maximum parse time

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ExtendsValidationError {
  valid: false;
  error_type: 'circular_reference' | 'depth_exceeded' | 'file_size_exceeded' | 'parse_timeout' | 'file_not_found' | 'security_violation';
  message: string;
  current_value: number | string;
  limit: number | string;
  chain: string[];
  security_details?: SecurityValidationResult;
}

export interface ExtendsValidationSuccess {
  valid: true;
  chain: string[];
  depth: number;
}

export type ExtendsValidationResult = ExtendsValidationSuccess | ExtendsValidationError;

export interface Frontmatter {
  extends?: string;
  [key: string]: any;
}

// ─────────────────────────────────────────────────────────────────────────────
// Logging
// ─────────────────────────────────────────────────────────────────────────────

function logWarning(message: string): void {
  console.warn(`⚠️  Extends Validator: ${message}`);
}

function logError(message: string): void {
  console.error(`❌ Extends Validator: ${message}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// YAML Frontmatter Parser
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse YAML frontmatter from markdown content
 * Safe fallback: returns empty frontmatter if parsing fails
 */
function parseFrontmatter(content: string): { frontmatter: Frontmatter; content: string } {
  const match = content.match(/^---\n([\s\S]+?)\n---\n?([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, content: content.trim() };
  }

  try {
    // Simple YAML parser for extends field only (avoid full YAML dependency overhead)
    const yamlText = match[1];
    const frontmatter: Frontmatter = {};

    // Extract extends field using regex
    const extendsMatch = yamlText.match(/^extends:\s*["']?([^"'\n]+)["']?/m);
    if (extendsMatch) {
      frontmatter.extends = extendsMatch[1].trim();
    }

    return {
      frontmatter,
      content: match[2] ? match[2].trim() : ''
    };
  } catch (error) {
    logWarning(`Failed to parse YAML frontmatter: ${(error as Error).message}`);
    return { frontmatter: {}, content: content };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Security validation for extends path
 * Prevents path traversal, absolute paths, and workspace escapes
 * Integrated from security-validator.ts per A-11 requirements
 */
function validatePathSecurity(extendsPath: string, currentFilePath: string): { valid: boolean; error?: string } {
  const securityResult = validateExtendsSecurity(extendsPath, dirname(currentFilePath));

  if (!securityResult.valid) {
    return {
      valid: false,
      error: `Security violation: ${securityResult.message} | Input: ${securityResult.malicious_input} | Remediation: ${securityResult.remediation}`
    };
  }

  return { valid: true };
}

/**
 * Check if file size exceeds maximum allowed size
 * Safe fallback: returns false if stat fails (allows file to proceed)
 */
function checkFileSize(filePath: string): { valid: boolean; size: number } {
  try {
    const stats = statSync(filePath);
    const size = stats.size;

    if (size > MAX_FILE_SIZE) {
      return { valid: false, size };
    }

    return { valid: true, size };
  } catch (error) {
    logWarning(`Failed to stat file ${filePath}: ${(error as Error).message}`);
    return { valid: true, size: 0 }; // Safe fallback: allow file to proceed
  }
}

/**
 * Check if parse time exceeds maximum allowed time
 * Must be called with startTime before parsing operation
 */
function checkParseTime(startTime: number): { valid: boolean; elapsed: number } {
  const elapsed = Date.now() - startTime;

  if (elapsed > MAX_PARSE_TIME) {
    return { valid: false, elapsed };
  }

  return { valid: true, elapsed };
}

// ─────────────────────────────────────────────────────────────────────────────
// Circular Reference Detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate extends chain for circular references and depth limits
 * Implements ADR-0033 security constraints with safe fallback behavior
 *
 * @param filePath - Absolute path to the file to validate
 * @param visited - Set of visited file paths (for internal recursion)
 * @param currentDepth - Current depth in the extends chain (for internal recursion)
 * @param startTime - Start time for parse timeout check (for internal recursion)
 * @returns Validation result with detailed error information if validation fails
 */
export function validateExtendsChain(
  filePath: string,
  visited: Set<string> = new Set(),
  currentDepth: number = 0,
  startTime: number = Date.now()
): ExtendsValidationResult {
  const chain = Array.from(visited);

  // Normalize file path for consistent comparison
  const normalizedPath = resolve(filePath);

  // Check 1: Circular reference detection
  if (visited.has(normalizedPath)) {
    logError(`Circular reference detected: ${normalizedPath}`);
    logError(`Extends chain: ${chain.join(' → ')} → ${normalizedPath}`);

    return {
      valid: false,
      error_type: 'circular_reference',
      message: `Circular reference detected: ${normalizedPath} appears multiple times in extends chain`,
      current_value: normalizedPath,
      limit: 'unique file path',
      chain: [...chain, normalizedPath]
    };
  }

  // Check 2: Maximum depth enforcement
  if (currentDepth >= MAX_EXTENDS_DEPTH) {
    logError(`Maximum extends depth exceeded: ${currentDepth} >= ${MAX_EXTENDS_DEPTH}`);
    logError(`Extends chain: ${chain.join(' → ')}`);

    return {
      valid: false,
      error_type: 'depth_exceeded',
      message: `Maximum extends depth (${MAX_EXTENDS_DEPTH}) exceeded. Current depth: ${currentDepth}`,
      current_value: currentDepth,
      limit: MAX_EXTENDS_DEPTH,
      chain: [...chain, normalizedPath]
    };
  }

  // Check 3: File size enforcement
  const sizeCheck = checkFileSize(normalizedPath);
  if (!sizeCheck.valid) {
    logError(`File size exceeded: ${sizeCheck.size} bytes > ${MAX_FILE_SIZE} bytes`);

    return {
      valid: false,
      error_type: 'file_size_exceeded',
      message: `File size (${sizeCheck.size} bytes) exceeds maximum (${MAX_FILE_SIZE} bytes)`,
      current_value: sizeCheck.size,
      limit: MAX_FILE_SIZE,
      chain: [...chain, normalizedPath]
    };
  }

  // Check 4: Parse timeout enforcement
  const timeCheck = checkParseTime(startTime);
  if (!timeCheck.valid) {
    logError(`Parse timeout: ${timeCheck.elapsed}ms > ${MAX_PARSE_TIME}ms`);

    return {
      valid: false,
      error_type: 'parse_timeout',
      message: `Parse time (${timeCheck.elapsed}ms) exceeds maximum (${MAX_PARSE_TIME}ms)`,
      current_value: timeCheck.elapsed,
      limit: MAX_PARSE_TIME,
      chain: [...chain, normalizedPath]
    };
  }

  // Read and parse the file
  let content: string;
  try {
    content = readFileSync(normalizedPath, 'utf-8');
  } catch (error) {
    logError(`File not found: ${normalizedPath}`);

    return {
      valid: false,
      error_type: 'file_not_found',
      message: `Extended file not found: ${normalizedPath}`,
      current_value: normalizedPath,
      limit: 'existing file path',
      chain: [...chain, normalizedPath]
    };
  }

  // Parse frontmatter
  const { frontmatter } = parseFrontmatter(content);

  // If no extends field, chain terminates successfully
  if (!frontmatter.extends) {
    return {
      valid: true,
      chain: [...chain, normalizedPath],
      depth: currentDepth
    };
  }

  // Resolve the extends path relative to current file
  const extendsPath = resolve(dirname(normalizedPath), frontmatter.extends);

  // Check 5: Security validation (A-11 requirements)
  const securityCheck = validatePathSecurity(frontmatter.extends, normalizedPath);
  if (!securityCheck.valid) {
    logError(`Security violation detected: ${securityCheck.error}`);

    return {
      valid: false,
      error_type: 'security_violation',
      message: securityCheck.error || 'Security validation failed',
      current_value: frontmatter.extends,
      limit: 'safe extends path',
      chain: [...chain, normalizedPath]
    };
  }

  // Recursively validate the extends chain
  const newVisited = new Set(visited);
  newVisited.add(normalizedPath);

  return validateExtendsChain(extendsPath, newVisited, currentDepth + 1, startTime);
}

// ─────────────────────────────────────────────────────────────────────────────
// Safe Fallback Wrapper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Safe wrapper for validateExtendsChain with enhanced error handling
 * Provides graceful degradation when validation fails
 *
 * @param filePath - Path to the file to validate
 * @returns Validation result with warnings logged but no exceptions thrown
 */
export function safeValidateExtends(filePath: string): ExtendsValidationResult {
  try {
    return validateExtendsChain(filePath);
  } catch (error) {
    const errorMessage = (error as Error).message;
    logError(`Unexpected error during extends validation: ${errorMessage}`);

    return {
      valid: false,
      error_type: 'parse_timeout',
      message: `Unexpected error during validation: ${errorMessage}`,
      current_value: 'unknown',
      limit: 'successful validation',
      chain: [filePath]
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI Interface (for testing)
// ─────────────────────────────────────────────────────────────────────────────

if (import.meta.main) {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error('Usage: bun scripts/helpers/extends-validator.ts <file-path>');
    console.error('  file-path: Path to the file to validate');
    process.exit(1);
  }

  const filePath = args[0];
  console.log(`🔍 Validating extends chain for: ${filePath}`);

  const result = safeValidateExtends(filePath);

  if (result.valid) {
    console.log(`✅ Validation passed`);
    console.log(`   Chain depth: ${result.depth}`);
    console.log(`   Extends chain: ${result.chain.join(' → ')}`);
  } else {
    console.error(`❌ Validation failed`);
    console.error(`   Error type: ${result.error_type}`);
    console.error(`   Message: ${result.message}`);
    console.error(`   Current value: ${result.current_value}`);
    console.error(`   Limit: ${result.limit}`);
    console.error(`   Chain: ${result.chain.join(' → ')}`);
    process.exit(1);
  }
}
