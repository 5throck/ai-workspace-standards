#!/usr/bin/env bun
/**
 * clear-pm-approval.ts — PM Gateway Session Cleanup
 * @version 1.0.0
 *
 * Removes .pm-approved flag file at session start.
 * Called by SessionStart hook in .claude/settings.json and .gemini/settings.json.
 * Cross-platform: works on Windows, macOS, Linux via Bun runtime.
 */

import { unlinkSync, existsSync } from 'node:fs';

const flag = '.pm-approved';
if (existsSync(flag)) {
  try {
    unlinkSync(flag);
  } catch {
    // silently ignore if file is locked or already removed
  }
}
