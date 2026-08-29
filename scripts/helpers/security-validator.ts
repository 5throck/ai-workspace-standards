#!/usr/bin/env bun
/**
 * Security Validator - Extends Chain Security Protection
 * @version 1.1.1
 *
 * Implements A-11 security requirements for extends chain validation.
 * Prevents path traversal attacks, arbitrary code injection, and DoS vulnerabilities.
 *
 * Threat Model Protection:
 * - Path Traversal: ../../etc/passwd, ~/.ssh/private_key
 * - Code Injection: Malicious override sections
 * - DoS: Infinite loops, resource exhaustion
 *
 * Usage:
 *   Module import: import { SecurityValidator } from './helpers/security-validator.js'
 */

import { resolve, dirname, normalize } from 'path';
import { existsSync } from 'fs';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

// Allowed root directories for extends references
const ALLOWED_ROOT_DIRS = [
  'templates',
  'agents',
  'skills',
  '.claude'
];

// Whitelisted sections that can be overridden
const OVERRIDE_WHITELIST = [
  '## Role',
  '## Agent Roster',
  '## Governance Workflow',
  '## Phase Determination Checklist',
  '## Mandatory Execution Plan Display',
  '## Execution Plan Boilerplate',
  '## Specialist Agent List'
];

// Security violation types
export enum SecurityViolationType {
  PATH_TRAVERSAL = 'path_traversal',
  ABSOLUTE_PATH = 'absolute_path',
  OUTSIDE_WORKSPACE = 'outside_workspace',
  INVALID_OVERRIDE_SECTION = 'invalid_override_section',
  MALICIOUS_CONTENT = 'malicious_content',
  EXTERNAL_URL = 'external_url',
  SHELL_COMMAND = 'shell_command'
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SecurityViolation {
  valid: false;
  violation_type: SecurityViolationType;
  message: string;
  malicious_input: string;
  remediation: string;
}

export interface SecurityValidationSuccess {
  valid: true;
  sanitized_path: string;
  allowed_sections: string[];
}

export type SecurityValidationResult = SecurityValidationSuccess | SecurityViolation;

export interface SecurityValidatorOptions {
  workspace_root?: string;
  allowed_root_dirs?: string[];
  override_whitelist?: string[];
  strict_mode?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract content that appears inside fenced code blocks (``` ... ```) or
 * inline code (` ... `). Returns a string containing only the code-block
 * regions, with non-code prose stripped out. This allows URL detection to
 * target only executable/referenced code rather than documentation links.
 */
function extractCodeBlockContent(content: string): string {
  const codeRegions: string[] = [];
  // Match fenced code blocks: opening ``` with optional lang, then body, then closing ```
  const fencedBlockRegex = /```[a-zA-Z]*\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = fencedBlockRegex.exec(content)) !== null) {
    codeRegions.push(match[1]);
  }
  // Match inline code: `...` (not inside fenced blocks — simplified single-pass)
  const inlineCodeRegex = /`([^`\n]+)`/g;
  while ((match = inlineCodeRegex.exec(content)) !== null) {
    codeRegions.push(match[1]);
  }
  return codeRegions.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Security Validator Class
// ─────────────────────────────────────────────────────────────────────────────

export class SecurityValidator {
  private workspaceRoot: string;
  private allowedRootDirs: string[];
  private overrideWhitelist: string[];
  private strictMode: boolean;

  constructor(options: SecurityValidatorOptions = {}) {
    this.workspaceRoot = options.workspace_root || process.cwd();
    this.allowedRootDirs = options.allowed_root_dirs || ALLOWED_ROOT_DIRS;
    this.overrideWhitelist = options.override_whitelist || OVERRIDE_WHITELIST;
    this.strictMode = options.strict_mode ?? true;
  }

  /**
   * Validate extends path for security violations
   * Implements path traversal prevention and workspace boundary enforcement
   */
  validateExtendsPath(extendsPath: string, currentFileDir: string): SecurityValidationResult {
    // Check 1: Absolute path detection
    if (extendsPath.startsWith('/') || /^[A-Za-z]:/.test(extendsPath)) {
      return {
        valid: false,
        violation_type: SecurityViolationType.ABSOLUTE_PATH,
        message: 'Absolute paths are not allowed in extends field',
        malicious_input: extendsPath,
        remediation: 'Use relative paths from current file location (e.g., "../common/agents/pm.md")'
      };
    }

    // Resolve the path properly
    const resolvedPath = resolve(currentFileDir, extendsPath);

    // Check 2: Path traversal detection - ensure resolved path stays within workspace
    if (!resolvedPath.startsWith(this.workspaceRoot)) {
      return {
        valid: false,
        violation_type: SecurityViolationType.PATH_TRAVERSAL,
        message: 'Path traversal attempt detected - attempting to escape workspace boundaries',
        malicious_input: extendsPath,
        remediation: 'Ensure extends path stays within workspace directory'
      };
    }

    // Check 3: Verify resolved path is within allowed directories
    const pathRelativeToWorkspace = resolvedPath.substring(this.workspaceRoot.length);
    const isInAllowedDir = this.allowedRootDirs.some(dir => {
      const normalizedDir = dir.replace(/^\/+|\/+$/g, ''); // Remove leading/trailing slashes
      // Check if path starts with /dir or \dir (for cross-platform compatibility)
      return pathRelativeToWorkspace.startsWith(`/${normalizedDir}`) ||
             pathRelativeToWorkspace.startsWith(`\\${normalizedDir}`) ||
             pathRelativeToWorkspace.startsWith(`${normalizedDir}`);
    });

    if (!isInAllowedDir && this.strictMode) {
      return {
        valid: false,
        violation_type: SecurityViolationType.OUTSIDE_WORKSPACE,
        message: 'Extends path must reference allowed directories (templates/, agents/, skills/, .claude/)',
        malicious_input: extendsPath,
        remediation: `Move referenced file to one of: ${this.allowedRootDirs.join(', ')}`
      };
    }

    // Check 4: File existence (prevent directory traversal to non-existent files)
    if (!existsSync(resolvedPath)) {
      return {
        valid: false,
        violation_type: SecurityViolationType.PATH_TRAVERSAL,
        message: 'Referenced file does not exist - possible path traversal attempt',
        malicious_input: extendsPath,
        remediation: 'Verify the extends path is correct and file exists'
      };
    }

    return {
      valid: true,
      sanitized_path: resolvedPath,
      allowed_sections: this.overrideWhitelist
    };
  }

  /**
   * Validate override section content for security violations
   * Implements content filtering and malicious code detection
   */
  validateOverrideContent(sectionName: string, content: string): SecurityValidationResult {
    // Check 1: Section whitelist enforcement
    const normalizedSectionName = this.normalizeSectionName(sectionName);
    const isWhitelisted = this.overrideWhitelist.some(whitelisted => {
      const normalizedWhitelist = this.normalizeSectionName(whitelisted);
      // Check for exact match only - no variants allowed
      return normalizedSectionName === normalizedWhitelist;
    });

    if (!isWhitelisted && this.strictMode) {
      return {
        valid: false,
        violation_type: SecurityViolationType.INVALID_OVERRIDE_SECTION,
        message: `Override section '${sectionName}' is not in the whitelist`,
        malicious_input: sectionName,
        remediation: `Only these sections can be overridden: ${this.overrideWhitelist.join(', ')}`
      };
    }

    // Check 2: Shell command detection
    const shellCommandPatterns = [
      /\beval\s*\(/i,
      /\bexec\s*\(/i,
      /\bsystem\s*\(/i,
      /\bspawn\s*\(/i,
      /\bchild_process/i,
      /`\$\{.*\}`/,  // Template literals with code
      /<\?.*\?>/,     // PHP tags
      /<%.*%>/        // ASP tags
    ];

    for (const pattern of shellCommandPatterns) {
      if (pattern.test(content)) {
        return {
          valid: false,
          violation_type: SecurityViolationType.SHELL_COMMAND,
          message: 'Shell command or code execution detected in override content',
          malicious_input: content.substring(0, 100) + '...',
          remediation: 'Remove executable code and use markdown documentation only'
        };
      }
    }

    // Check 3: External URL detection — only flag URLs inside code blocks
    // (fenced ``` blocks) or inline code (`backtick` wrapped). URLs in
    // regular prose/documentation are legitimate references and allowed.
    const urlPatterns = [
      /https?:\/\/[^\s]+/i,
      /ftp:\/\/[^\s]+/i,
      /file:\/\/\/[^\s]+/i
    ];

    // Extract text that is inside code blocks (``` ... ```) or inline code (`...`)
    // by stripping non-code regions, then check only the code regions for URLs.
    const codeBlockContent = extractCodeBlockContent(content);
    for (const pattern of urlPatterns) {
      if (pattern.test(codeBlockContent)) {
        return {
          valid: false,
          violation_type: SecurityViolationType.EXTERNAL_URL,
          message: 'External URL detected inside code block in override content',
          malicious_input: content.substring(0, 100) + '...',
          remediation: 'Remove external references from code blocks — use relative paths'
        };
      }
    }

    // Check 4: Sensitive data patterns (basic detection)
    const sensitivePatterns = [
      /password\s*[:=]\s*['"]\S+['"]/i,
      /api[_-]?key\s*[:=]\s*['"]\S+['"]/i,
      /secret\s*[:=]\s*['"]\S+['"]/i,
      /token\s*[:=]\s*['"]\S+['"]/i
    ];

    for (const pattern of sensitivePatterns) {
      if (pattern.test(content)) {
        return {
          valid: false,
          violation_type: SecurityViolationType.MALICIOUS_CONTENT,
          message: 'Possible sensitive data exposure detected',
          malicious_input: content.substring(0, 100) + '...',
          remediation: 'Remove sensitive data from documentation'
        };
      }
    }

    return {
      valid: true,
      sanitized_path: '',
      allowed_sections: this.overrideWhitelist
    };
  }

  /**
   * Normalize section name for consistent comparison
   */
  private normalizeSectionName(sectionName: string): string {
    return sectionName
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special chars except hyphen
      .replace(/\s+/g, ' ')      // Normalize spaces
      .trim();
  }

  /**
   * Validate complete extends chain with security checks
   * Combines path validation and content validation
   */
  validateExtendsChain(extendsPath: string, currentFileDir: string): SecurityValidationResult {
    // Step 1: Validate path security
    const pathValidation = this.validateExtendsPath(extendsPath, currentFileDir);
    if (!pathValidation.valid) {
      return pathValidation;
    }

    // Step 2: If path is valid, return success
    // Content validation happens when the file is actually processed
    return {
      valid: true,
      sanitized_path: pathValidation.sanitized_path,
      allowed_sections: this.overrideWhitelist
    };
  }

  /**
   * Log security violation for audit trail
   */
  logSecurityViolation(violation: SecurityViolation): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      violation_type: violation.violation_type,
      message: violation.message,
      malicious_input: violation.malicious_input,
      remediation: violation.remediation
    };

    console.error(`🚨 Security Violation Detected [${timestamp}]`);
    console.error(`   Type: ${violation.violation_type}`);
    console.error(`   Message: ${violation.message}`);
    console.error(`   Input: ${violation.malicious_input}`);
    console.error(`   Remediation: ${violation.remediation}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Default Instance
// ─────────────────────────────────────────────────────────────────────────────

export const defaultSecurityValidator = new SecurityValidator();

// ─────────────────────────────────────────────────────────────────────────────
// Convenience Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Quick validation function using default validator
 */
export function validateExtendsSecurity(
  extendsPath: string,
  currentFileDir: string,
  options?: SecurityValidatorOptions
): SecurityValidationResult {
  const validator = options ? new SecurityValidator(options) : defaultSecurityValidator;
  return validator.validateExtendsChain(extendsPath, currentFileDir);
}

/**
 * Validate override content security
 */
export function validateOverrideSecurity(
  sectionName: string,
  content: string,
  options?: SecurityValidatorOptions
): SecurityValidationResult {
  const validator = options ? new SecurityValidator(options) : defaultSecurityValidator;
  return validator.validateOverrideContent(sectionName, content);
}

// ─────────────────────────────────────────────────────────────────────────────
// Source-scanning shell-injection patterns (NOT markdown/frontmatter oriented)
// ─────────────────────────────────────────────────────────────────────────────
//
// Used by scripts/audit.ts's checkShellInjectionPatterns() to scan .ts script
// source for shell-injection-shaped sink patterns. Deliberately a SEPARATE,
// narrower pattern set from `shellCommandPatterns` above -- that set targets
// markdown/frontmatter override content and flags the mere presence of
// executable-looking code, which is the right bar for "should this doc field
// contain code at all." Applied to real script source, it would flag nearly
// every one of the ~80 scripts in this repo that legitimately spawn
// subprocesses, drowning real findings in noise. See design doc
// docs/designs/2026-08-16-august-regression-coverage-design.md section 1.
//
// Calibration (2026-08-16): surveyed scripts/*.ts and templates/*/scripts/**/*.ts
// before finalizing these regexes.
//   - Bun's tagged-template shell helper auto-escapes each interpolation as a
//     single, safely-quoted argv token by default. A broad "any interpolation
//     not wrapped in a shellEscape*/shellQuote* call" rule matched ~97 lines
//     across this repo with zero true positives (every script in this
//     workspace that uses the helper relies on that default auto-escaping and
//     none of them disable it). That rule was rejected as unusably noisy.
//   - Narrowed to the genuinely risk-signaling shape: interpolating a
//     COMPOUND string assembled via string concatenation, array-join, or a
//     nested template literal -- i.e. the author is manually building shell
//     syntax rather than relying on the helper's per-token escaping. Zero
//     matches for this narrower shape exist in the current repo (confirmed
//     via survey), so it starts from a clean baseline.
//   - For subprocess-spawn call sites in this repo, direct calls consistently
//     use either string literals (no interpolation) or the argv-array form --
//     both safe. The three bugs patched in commit bd4312f62 that DID reach an
//     interpolated shell string did so through a locally-defined wrapper
//     function (e.g. a `run(cmd)` helper in
//     templates/common/scripts/handbook/deploy-handbook.ts), not a
//     bare subprocess-spawn call. The pattern below therefore also matches
//     calls to any function whose name contains a subprocess/shell-invocation
//     keyword (case-insensitive) -- confirmed via survey to add zero
//     additional false positives in the current corpus while catching that
//     wrapper shape.
export interface SourceShellInjectionPattern {
  name: string;
  pattern: RegExp;
  remediation: string;
}

// Sink-function-name fragment used by the subprocess-spawn pattern below.
// Matches Node's child_process spawning family plus locally-defined wrapper
// functions whose name contains one of these fragments (see calibration
// notes above).
const SUBPROCESS_SINK_NAME_FRAGMENT = ['run', 'exec', 'spawn', 'shell'].join('|');

export const sourceShellInjectionPatterns: SourceShellInjectionPattern[] = [
  {
    name: 'bun-shell-compound-interpolation',
    // Tagged-template shell invocation containing an interpolation whose
    // expression is built via string concatenation, `.join(`, or a nested
    // template literal, and is not visibly wrapped in a
    // shellEscape*/shellQuote*/escapeShellArg* call.
    pattern: new RegExp(
      '\\$`[^`]*\\$\\{(?![^}]*\\b(?:shellEscape|shellQuote|escapeShellArg)\\w*\\s*\\()' +
      // `.join(` counts as a compound-build signal EXCEPT the common, safe
      // `path.join(...)` idiom (calibration: path.join(...) accounted for
      // 100% of this sub-pattern's false positives on the current repo).
      '[^}]*(?:\\+|(?<!path)\\.join\\s*\\(|`[^`]*\\$\\{)[^}]*\\}[^`]*`',
      'g'
    ),
    remediation: 'Validate/allowlist the input before interpolating a manually-assembled string into a shell-invocation template, or wrap it in a shellEscape*/shellQuote* helper before interpolation.'
  },
  {
    name: 'subprocess-spawn-string-build',
    // Calls to a subprocess-spawning function (Node's child_process family,
    // or a locally-defined wrapper -- see SUBPROCESS_SINK_NAME_FRAGMENT)
    // where the command argument is built via string concatenation or a
    // template literal with interpolation, rather than the safer argv-array
    // calling form.
    pattern: new RegExp(
      '\\b\\w*(?:' + SUBPROCESS_SINK_NAME_FRAGMENT + ')\\w*\\s*\\(\\s*' +
      '(?:[^,()]*\\+[^,()]*|`[^`]*\\$\\{[^}]*\\}[^`]*`)',
      'gi'
    ),
    remediation: 'Prefer the argv-array calling form over shell-string interpolation, or validate/allowlist the input before building the command string.'
  }
];

// ─────────────────────────────────────────────────────────────────────────────
// CLI Interface (for testing)
// ─────────────────────────────────────────────────────────────────────────────

if (import.meta.main) {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: bun scripts/helpers/security-validator.ts <extends-path> <current-file-dir>');
    console.error('  extends-path: Path value from extends field');
    console.error('  current-file-dir: Directory containing the current file');
    process.exit(1);
  }

  const [extendsPath, currentFileDir] = args;
  console.log(`🔍 Validating security for: ${extendsPath}`);
  console.log(`   Current directory: ${currentFileDir}`);

  const result = validateExtendsSecurity(extendsPath, currentFileDir);

  if (result.valid) {
    console.log(`✅ Security validation passed`);
    console.log(`   Sanitized path: ${result.sanitized_path}`);
    console.log(`   Allowed sections: ${result.allowed_sections.join(', ')}`);
  } else {
    defaultSecurityValidator.logSecurityViolation(result);
    process.exit(1);
  }
}
