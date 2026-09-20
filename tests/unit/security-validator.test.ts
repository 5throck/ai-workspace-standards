#!/usr/bin/env bun
/**
 * Security Validator Test Suite
 * @version 1.0.2
 *
 * Comprehensive security tests for extends chain validation
 * Implements A-11 security requirements testing
 *
 * Test Categories:
 * - Path traversal attacks
 * - Invalid override sections
 * - Malicious content injection
 * - Boundary cases
 */

import { describe, test, expect } from 'bun:test';
import {
  SecurityValidator,
  validateExtendsSecurity,
  validateOverrideSecurity,
  SecurityViolationType,
  type SecurityValidationResult
} from '../../scripts/helpers/security-validator';

// ─────────────────────────────────────────────────────────────────────────────
// Test Configuration
// ─────────────────────────────────────────────────────────────────────────────

const workspaceRoot = process.cwd();
const testValidator = new SecurityValidator({
  workspace_root: workspaceRoot,
  strict_mode: true
});

const lenientValidator = new SecurityValidator({
  workspace_root: workspaceRoot,
  strict_mode: false
});

// ─────────────────────────────────────────────────────────────────────────────
// Path Traversal Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Path Traversal Security', () => {
  test('should reject absolute paths', () => {
    const result = testValidator.validateExtendsPath(
      '/etc/passwd',
      `${workspaceRoot}/templates/co-consult`
    );

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.violation_type).toBe(SecurityViolationType.ABSOLUTE_PATH);
      expect(result.message).toContain('Absolute paths are not allowed');
    }
  });

  test('should reject path traversal escaping workspace', () => {
    const result = testValidator.validateExtendsPath(
      '../../../../../../etc/passwd',
      `${workspaceRoot}/templates/co-consult`
    );

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.violation_type).toBe(SecurityViolationType.PATH_TRAVERSAL);
      expect(result.message).toContain('escape workspace boundaries');
    }
  });

  test('should reject attempts to access SSH keys', () => {
    const result = testValidator.validateExtendsPath(
      '~/.ssh/id_rsa',
      `${workspaceRoot}/templates/co-consult`
    );

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.violation_type).toBe(SecurityViolationType.PATH_TRAVERSAL);
    }
  });

  test('should allow relative paths within workspace', () => {
    const result = testValidator.validateExtendsPath(
      'agents/pm.md',
      `${workspaceRoot}`
    );

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.sanitized_path.replace(/\\/g, '/')).toContain('agents/pm.md');
    }
  });

  test('should allow safe relative traversal into allowed directories', () => {
    const result = testValidator.validateExtendsPath(
      '../agents/pm.md',
      `${workspaceRoot}/skills`
    );

    expect(result.valid).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Workspace Boundary Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Workspace Boundary Security', () => {
  test('should reject paths outside allowed directories in strict mode', () => {
    const result = testValidator.validateExtendsPath(
      '../../src/index.ts',
      `${workspaceRoot}/templates/co-consult/agents`
    );

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.violation_type).toBe(SecurityViolationType.PATH_TRAVERSAL);
    }
  });

  test('should allow paths within allowed root directories', () => {
    const result = testValidator.validateExtendsPath(
      'commands/sync.md',
      `${workspaceRoot}/.claude`
    );

    expect(result.valid).toBe(true);
  });

  test('should allow agents directory', () => {
    const result = testValidator.validateExtendsPath(
      'pm.md',
      `${workspaceRoot}/agents`
    );

    expect(result.valid).toBe(true);
  });

  test('should allow skills directory', () => {
    const result = testValidator.validateExtendsPath(
      '../meeting-facilitation/SKILL.md',
      `${workspaceRoot}/skills/meeting`
    );

    expect(result.valid).toBe(true);
  });

  test('should allow .claude directory', () => {
    const result = testValidator.validateExtendsPath(
      '../commands/sync.md',
      `${workspaceRoot}/.claude/commands`
    );

    expect(result.valid).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Override Section Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Override Section Security', () => {
  test('should allow whitelisted Role section', () => {
    const result = testValidator.validateOverrideContent(
      '## Role',
      'You are a project manager agent...'
    );

    expect(result.valid).toBe(true);
  });

  test('should allow whitelisted Agent Roster section', () => {
    const result = testValidator.validateOverrideContent(
      '## Agent Roster',
      '| Agent | Tier | Description |'
    );

    expect(result.valid).toBe(true);
  });

  test('should allow whitelisted Governance Workflow section', () => {
    const result = testValidator.validateOverrideContent(
      '## Governance Workflow',
      'Workflow steps go here...'
    );

    expect(result.valid).toBe(true);
  });

  test('should reject non-whitelisted section in strict mode', () => {
    const result = testValidator.validateOverrideContent(
      '## Secret Backdoor',
      'Malicious content here...'
    );

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.violation_type).toBe(SecurityViolationType.INVALID_OVERRIDE_SECTION);
    }
  });

  test('should reject section variants not in whitelist', () => {
    const result = testValidator.validateOverrideContent(
      '## Role Modified',
      'Modified role content...'
    );

    expect(result.valid).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Malicious Content Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Malicious Content Detection', () => {
  test('should detect eval() calls', () => {
    const result = testValidator.validateOverrideContent(
      '## Role',
      'Execute: eval(maliciousCode)'
    );

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.violation_type).toBe(SecurityViolationType.SHELL_COMMAND);
    }
  });

  test('should detect exec() calls', () => {
    const result = testValidator.validateOverrideContent(
      '## Role',
      'Run: exec(command)'
    );

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.violation_type).toBe(SecurityViolationType.SHELL_COMMAND);
    }
  });

  test('should detect child_process imports', () => {
    const result = testValidator.validateOverrideContent(
      '## Role',
      'Import: require("child_process")'
    );

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.violation_type).toBe(SecurityViolationType.SHELL_COMMAND);
    }
  });

  test('should detect template literal code injection', () => {
    const result = testValidator.validateOverrideContent(
      '## Role',
      'Execute: `${maliciousCode}`'
    );

    expect(result.valid).toBe(false);
  });

  test('should detect PHP tags', () => {
    const result = testValidator.validateOverrideContent(
      '## Role',
      'Code: <?php system($_GET["cmd"]); ?>'
    );

    expect(result.valid).toBe(false);
  });

  test('should detect ASP tags', () => {
    const result = testValidator.validateOverrideContent(
      '## Role',
      'Code: <% Response.Write("malicious") %>'
    );

    expect(result.valid).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// External URL Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('External URL Detection', () => {
  test('should allow HTTP URLs in prose (documentation links are legitimate)', () => {
    const result = testValidator.validateOverrideContent(
      '## Role',
      'Visit: http://malicious.com/script.js'
    );

    expect(result.valid).toBe(true);
  });

  test('should detect HTTP URLs inside fenced code blocks', () => {
    const result = testValidator.validateOverrideContent(
      '## Role',
      'Fetch:\n```\nhttp://evil.com/payload\n```'
    );

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.violation_type).toBe(SecurityViolationType.EXTERNAL_URL);
    }
  });

  test('should detect HTTPS URLs inside inline code', () => {
    const result = testValidator.validateOverrideContent(
      '## Role',
      'Fetch: `https://evil.com/payload`'
    );

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.violation_type).toBe(SecurityViolationType.EXTERNAL_URL);
    }
  });

  test('should detect FTP URLs inside code blocks', () => {
    const result = testValidator.validateOverrideContent(
      '## Role',
      'Download:\n```\nftp://attacker.com/exploit\n```'
    );

    expect(result.valid).toBe(false);
  });

  test('should detect file:// URLs inside code blocks', () => {
    const result = testValidator.validateOverrideContent(
      '## Role',
      'Read: `file:///etc/passwd`'
    );

    expect(result.valid).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Sensitive Data Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Sensitive Data Detection', () => {
  // Fixtures use colon form: the validator's [:=] pattern detects both, but the
  // equals form trips the pre-commit secret-regex gate as a false positive.
  test('should detect password patterns', () => {
    const result = testValidator.validateOverrideContent(
      '## Role',
      'Config: password: "secret123"'
    );

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.violation_type).toBe(SecurityViolationType.MALICIOUS_CONTENT);
    }
  });

  test('should detect API key patterns', () => {
    const result = testValidator.validateOverrideContent(
      '## Role',
      'Auth: api_key: "sk-1234567890"'
    );

    expect(result.valid).toBe(false);
  });

  test('should detect secret patterns', () => {
    const result = testValidator.validateOverrideContent(
      '## Role',
      'Token: secret: "my-secret-value"'
    );

    expect(result.valid).toBe(false);
  });

  test('should detect token patterns', () => {
    const result = testValidator.validateOverrideContent(
      '## Role',
      'Bearer: token = "eyJhbGciOiJIUzI1NiIs..."'
    );

    expect(result.valid).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Boundary Cases
// ─────────────────────────────────────────────────────────────────────────────

describe('Boundary Cases', () => {
  test('should handle empty content', () => {
    const result = testValidator.validateOverrideContent(
      '## Role',
      ''
    );

    expect(result.valid).toBe(true);
  });

  test('should handle very long paths', () => {
    const longPath = '../'.repeat(100) + 'file.md';
    const result = testValidator.validateExtendsPath(
      longPath,
      `${workspaceRoot}/templates/co-consult`
    );

    expect(result.valid).toBe(false);
  });

  test('should handle special characters in paths', () => {
    const result = testValidator.validateExtendsPath(
      '../file with spaces.md',
      `${workspaceRoot}/templates/co-consult`
    );

    // Should either be valid or fail with appropriate error
    expect(typeof result.valid).toBe('boolean');
  });

  test('should handle Unicode characters', () => {
    const result = testValidator.validateOverrideContent(
      '## Role',
      'Content with emoji: 🚀 and unicode: café'
    );

    expect(result.valid).toBe(true);
  });

  test('should handle null bytes', () => {
    const result = testValidator.validateOverrideContent(
      '## Role',
      'Content with \x00 null byte'
    );

    // Should handle gracefully without crashing
    expect(typeof result.valid).toBe('boolean');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Integration Tests', () => {
  test('should validate complete extends chain with security', () => {
    const result = validateExtendsSecurity(
      'agents/pm.md',
      `${workspaceRoot}`
    );

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.sanitized_path.replace(/\\/g, '/')).toContain('agents/pm.md');
    }
  });

  test('should reject malicious extends path', () => {
    const result = validateExtendsSecurity(
      '../../../etc/passwd',
      `${workspaceRoot}/agents`
    );

    expect(result.valid).toBe(false);
  });

  test('should work with custom validator options', () => {
    const customValidator = new SecurityValidator({
      workspace_root: workspaceRoot,
      allowed_root_dirs: ['agents'],
      strict_mode: false
    });

    const result = customValidator.validateExtendsPath(
      'pm.md',
      `${workspaceRoot}/agents`
    );

    expect(result.valid).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Performance Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Performance Tests', () => {
  test('should validate path quickly', () => {
    const start = performance.now();
    const result = testValidator.validateExtendsPath(
      'agents/pm.md',
      `${workspaceRoot}`
    );
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(100); // Should complete in <100ms
    expect(result.valid).toBe(true);
  });

  test('should validate content quickly', () => {
    const start = performance.now();
    const result = testValidator.validateOverrideContent(
      '## Role',
      'Safe content without malicious patterns'
    );
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(50); // Should complete in <50ms
    expect(result.valid).toBe(true);
  });

  test('should handle large content efficiently', () => {
    const largeContent = 'Safe content. '.repeat(10000);
    const start = performance.now();
    const result = testValidator.validateOverrideContent(
      '## Role',
      largeContent
    );
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(500); // Should complete in <500ms
    expect(result.valid).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Run Tests
// ─────────────────────────────────────────────────────────────────────────────

console.log('🧪 Running Security Validator Test Suite...');
console.log(`Workspace Root: ${workspaceRoot}`);
console.log('');

if (import.meta.main) {
  // Run tests when executed directly
  console.log('Use: bun test scripts/helpers/security-validator.test.ts');
}
