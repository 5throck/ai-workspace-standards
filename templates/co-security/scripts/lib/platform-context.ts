/**
 * Platform Context Library
 *
 * Provides cross-platform detection and compatibility utilities for the
 * L2-to-variant pipeline.
 *
 * @version 1.0.0
 * @Risk #2: Cross-platform complete equivalence
 */

import * as os from 'os';
import { $ } from 'bun';

// ============================================================================
// TYPES
// ============================================================================

export interface PlatformContext {
  os: 'windows' | 'linux' | 'darwin';
  shell: 'bash' | 'powershell' | 'cmd';
  encoding: 'utf-8';
  pathSeparator: '\\' | '/';
  lineEnding: '\r\n' | '\n';
  executableExtension: string;
}

// ============================================================================
// PLATFORM DETECTION
// ============================================================================

/**
 * Detect current platform context
 * @version 1.0.0
 */
export function detectPlatform(): PlatformContext {
  const platform = os.platform();
  const detectedOS: PlatformContext['os'] =
    platform === 'win32' ? 'windows' :
    platform === 'darwin' ? 'darwin' :
    platform === 'linux' ? 'linux' : 'linux'; // Default fallback

  // Detect preferred shell
  let detectedShell: PlatformContext['shell'] = 'bash';
  try {
    if (detectedOS === 'windows') {
      // Try to detect if PowerShell is available
      try {
        await $`powershell -Command "echo test"`.quiet();
        detectedShell = 'powershell';
      } catch {
        // Fallback to cmd or Git Bash
        try {
          await $`bash --version`.quiet();
          detectedShell = 'bash';
        } catch {
          detectedShell = 'cmd';
        }
      }
    } else {
      // Unix-like systems default to bash
      detectedShell = 'bash';
    }
  } catch {
    // Default to bash for non-Windows, cmd for Windows
    detectedShell = detectedOS === 'windows' ? 'cmd' : 'bash';
  }

  return {
    os: detectedOS,
    shell: detectedShell,
    encoding: 'utf-8',
    pathSeparator: detectedOS === 'windows' ? '\\' : '/',
    lineEnding: detectedOS === 'windows' ? '\r\n' : '\n',
    executableExtension: detectedOS === 'windows' ? '.exe' : '',
  };
}

/**
 * Get platform-specific script wrapper for a TypeScript script
 * @version 1.0.0
 */
export function getScriptWrapper(context: PlatformContext, scriptPath: string): string {
  const baseScript = scriptPath.replace(/\.ts$/, '');

  switch (context.shell) {
    case 'powershell':
      return `.\scripts\\${baseScript}.ps1`;
    case 'bash':
      return `./scripts/${baseScript}.sh`;
    case 'cmd':
      return `scripts\\${baseScript}.bat`;
    default:
      return `./scripts/${baseScript}.sh`;
  }
}

/**
 * Check if platform supports all required features
 * @version 1.0.0
 */
export function validatePlatformSupport(context: PlatformContext): {
  supported: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // UTF-8 encoding support check
  if (context.encoding !== 'utf-8') {
    issues.push(`Encoding ${context.encoding} not supported, requires utf-8`);
  }

  // Shell compatibility check
  if (context.os === 'windows' && context.shell === 'bash') {
    // Verify Git Bash is available
    try {
      $`bash --version`.quiet();
    } catch {
      issues.push('Windows with bash shell requires Git Bash to be installed');
    }
  }

  return {
    supported: issues.length === 0,
    issues,
  };
}

/**
 * Get platform-specific file copy command
 * @version 1.0.0
 */
export function getFileCopyCommand(
  context: PlatformContext,
  source: string,
  destination: string
): string {
  switch (context.shell) {
    case 'powershell':
      return `Copy-Item -Path "${source}" -Destination "${destination}" -Force`;
    case 'bash':
      return `cp "${source}" "${destination}"`;
    case 'cmd':
      return `copy "${source}" "${destination}" /Y`;
    default:
      return `cp "${source}" "${destination}"`;
  }
}

/**
 * Get platform-specific directory creation command
 * @version 1.0.0
 */
export function getMkdirCommand(context: PlatformContext, dir: string): string {
  switch (context.shell) {
    case 'powershell':
      return `New-Item -ItemType Directory -Path "${dir}" -Force | Out-Null`;
    case 'bash':
      return `mkdir -p "${dir}"`;
    case 'cmd':
      return `if not exist "${dir}" mkdir "${dir}"`;
    default:
      return `mkdir -p "${dir}"`;
  };
}

/**
 * Detect platform synchronously (no async operations)
 * @version 1.0.0
 */
export function detectPlatformSync(): PlatformContext {
  const platform = os.platform();
  const detectedOS: PlatformContext['os'] =
    platform === 'win32' ? 'windows' :
    platform === 'darwin' ? 'darwin' :
    platform === 'linux' ? 'linux' : 'linux';

  // Default shell based on OS
  const detectedShell: PlatformContext['shell'] =
    detectedOS === 'windows' ? 'powershell' : 'bash';

  return {
    os: detectedOS,
    shell: detectedShell,
    encoding: 'utf-8',
    pathSeparator: detectedOS === 'windows' ? '\\' : '/',
    lineEnding: detectedOS === 'windows' ? '\r\n' : '\n',
    executableExtension: detectedOS === 'windows' ? '.exe' : '',
  };
}
