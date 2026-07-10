/**
 * Authentication & Password Hashing Library
 *
 * Secure password hashing using PBKDF2 with industry-standard parameters.
 * Uses Node.js crypto.pbkdf2 (async) for non-blocking operation.
 *
 * Security parameters based on OWASP recommendations:
 * - PBKDF2 with HMAC-SHA256
 * - 210,000 iterations (OWASP 2023 minimum for SHA-256)
 * - 16-byte (128-bit) random salt
 * - 32-byte (256-bit) key length
 *
 * @version 1.0.0
 * @security P1 — PBKDF2 hardening
 */

import * as crypto from 'node:crypto';

// ============================================================================
// CONSTANTS
// ============================================================================

/** OWASP 2023 recommended minimum iterations for PBKDF2-HMAC-SHA256 */
const PBKDF2_ITERATIONS = 210_000;

/** Salt length in bytes (128-bit) */
const SALT_LENGTH = 16;

/** Derived key length in bytes (256-bit) */
const KEY_LENGTH = 32;

/** Hash algorithm */
const HASH_ALGORITHM = 'sha256';

// ============================================================================
// TYPES
// ============================================================================

export interface HashResult {
  /** Hex-encoded salt */
  salt: string;
  /** Hex-encoded derived key */
  hash: string;
  /** Iteration count used */
  iterations: number;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Hash a password using PBKDF2-HMAC-SHA256 (async, non-blocking).
 *
 * @param password - Plain-text password to hash
 * @param iterations - Override iteration count (default: 210,000)
 * @returns HashResult containing salt, hash, and iteration count
 */
export async function hashPassword(
  password: string,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<HashResult> {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const hash = await asyncPbkdf2(password, salt, iterations);
  return {
    salt: salt.toString('hex'),
    hash: hash.toString('hex'),
    iterations,
  };
}

/**
 * Verify a password against a stored hash (async, non-blocking).
 *
 * @param password - Plain-text password to verify
 * @param hashResult - Stored HashResult containing salt, hash, and iterations
 * @returns true if password matches
 */
export async function verifyPassword(
  password: string,
  hashResult: HashResult,
): Promise<boolean> {
  const salt = Buffer.from(hashResult.salt, 'hex');
  const hash = await asyncPbkdf2(password, salt, hashResult.iterations);
  return crypto.timingSafeEqual(hash, Buffer.from(hashResult.hash, 'hex'));
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Async PBKDF2 wrapper around Node.js crypto.pbkdf2.
 * Non-blocking — suitable for server environments.
 */
function asyncPbkdf2(
  password: string,
  salt: Buffer,
  iterations: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, iterations, KEY_LENGTH, HASH_ALGORITHM, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}
