/**
 * Encoding Utilities Library
 *
 * UTF-8 encoding helpers for cross-platform file operations.
 * Addresses Risk #3: UTF-8 Encoding.
 *
 * @version 1.0.0
 * @Risk #3: UTF-8 Encoding (P0 - Critical)
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// ============================================================================
// TYPES
// ============================================================================

export interface EncodingDetectionResult {
  encoding: string;
  bomPresent: boolean;
  lineEndings: 'crlf' | 'lf' | 'mixed';
  confident: boolean;
}

// ============================================================================
// UTF-8 HELPERS
// ============================================================================

/**
 * Strip UTF-8 BOM if present
 * @version 1.0.0
 */
export function stripBOM(content: string): string {
  if (content.charCodeAt(0) === 0xFEFF) {
    return content.slice(1);
  }
  return content;
}

/**
 * Normalize line endings to LF
 * @version 1.0.0
 */
export function normalizeLineEndings(content: string): string {
  return content.replace(/\r\n/g, '\n');
}

/**
 * Detect file encoding and line endings
 * @version 1.0.0
 */
export function detectEncoding(filePath: string): EncodingDetectionResult {
  const buffer = readFileSync(filePath);

  // Check for BOM
  let bomPresent = false;
  let encoding = 'utf-8';

  if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    bomPresent = true;
    encoding = 'utf-8';
  } else if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
    bomPresent = true;
    encoding = 'utf-16le';
  } else if (buffer.length >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF) {
    bomPresent = true;
    encoding = 'utf-16be';
  }

  // Detect line endings
  let crlfCount = 0;
  let lfCount = 0;

  const content = buffer.toString('utf-8');
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '\r') {
      if (i + 1 < content.length && content[i + 1] === '\n') {
        crlfCount++;
        i++; // Skip following \n
      }
    } else if (content[i] === '\n') {
      lfCount++;
    }
  }

  let lineEndings: 'crlf' | 'lf' | 'mixed';
  if (crlfCount > 0 && lfCount === 0) {
    lineEndings = 'crlf';
  } else if (lfCount > 0 && crlfCount === 0) {
    lineEndings = 'lf';
  } else {
    lineEndings = 'mixed';
  }

  return {
    encoding,
    bomPresent,
    lineEndings,
    confident: true,
  };
}

/**
 * Read file with UTF-8 handling
 * @version 1.0.0
 */
export function readUTF8File(filePath: string): string {
  const content = readFileSync(filePath, 'utf-8');
  return stripBOM(content);
}

/**
 * Write file with UTF-8 encoding (no BOM, LF endings)
 * @version 1.0.0
 */
export function writeUTF8File(filePath: string, content: string): void {
  const normalized = normalizeLineEndings(content);
  writeFileSync(filePath, normalized, { encoding: 'utf-8' });
}

/**
 * Validate UTF-8 encoding compliance
 * @version 1.0.0
 */
export function validateUTF8Compliance(filePath: string): {
  compliant: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  const detection = detectEncoding(filePath);

  // Check for unwanted BOM
  if (detection.bomPresent) {
    issues.push(`File has UTF-8 BOM, should be removed`);
  }

  // Check line endings
  if (detection.lineEndings === 'crlf') {
    issues.push(`File uses CRLF line endings, should be LF`);
  } else if (detection.lineEndings === 'mixed') {
    issues.push(`File uses mixed line endings, should be LF only`);
  }

  // Check encoding
  if (detection.encoding !== 'utf-8') {
    issues.push(`File encoding is ${detection.encoding}, should be UTF-8`);
  }

  return {
    compliant: issues.length === 0,
    issues,
  };
}

/**
 * Convert file to UTF-8 (no BOM, LF endings)
 * @version 1.0.0
 */
export function convertToUTF8(filePath: string): {
  converted: boolean;
  originalEncoding: string;
  issues: string[];
} {
  const detection = detectEncoding(filePath);
  const issues: string[] = [];

  // Already compliant
  if (!detection.bomPresent &&
      detection.lineEndings === 'lf' &&
      detection.encoding === 'utf-8') {
    return {
      converted: false,
      originalEncoding: detection.encoding,
      issues: ['File already UTF-8 compliant'],
    };
  }

  // Convert
  const content = readUTF8File(filePath);
  writeUTF8File(filePath, content);

  if (detection.bomPresent) {
    issues.push('Removed BOM');
  }
  if (detection.lineEndings !== 'lf') {
    issues.push(`Normalized line endings from ${detection.lineEndings} to LF`);
  }
  if (detection.encoding !== 'utf-8') {
    issues.push(`Converted encoding from ${detection.encoding} to UTF-8`);
  }

  return {
    converted: true,
    originalEncoding: detection.encoding,
    issues,
  };
}

/**
 * Batch convert files to UTF-8
 * @version 1.0.0
 */
export function batchConvertToUTF8(filePaths: string[]): {
  processed: number;
  converted: number;
  skipped: number;
  errors: Array<{ file: string; error: string }>;
} {
  let processed = 0;
  let converted = 0;
  let skipped = 0;
  const errors: Array<{ file: string; error: string }> = [];

  for (const filePath of filePaths) {
    try {
      processed++;
      const result = convertToUTF8(filePath);
      if (result.converted) {
        converted++;
      } else {
        skipped++;
      }
    } catch (error) {
      errors.push({
        file: filePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    processed,
    converted,
    skipped,
    errors,
  };
}
