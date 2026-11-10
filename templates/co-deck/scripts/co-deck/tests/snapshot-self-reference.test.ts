/**
 * snapshot.ts self-reference pin (T-20261110-006, design
 * docs/designs/2026-11-10-co-deck-root-tooling-design.md): snapshot.ts emits
 * restore/list/usage commands that invoke itself. Those emitted commands must
 * carry the co-deck-qualified path — `bun scripts/co-deck/snapshot.ts ...` —
 * because the script lives in scripts/co-deck/ (ADR-0033 variant placement).
 * A bare `bun scripts/snapshot.ts` string breaks every emitted --restore
 * command (the stale Projects/co-deck copy drifted exactly this way, which is
 * invisible to fleet-script-parity.ts — it only covers templates/common/scripts/).
 *
 * Equivalent greppable check: grep "bun scripts/" snapshot.ts | grep -v "scripts/co-deck/" → empty.
 *
 * @version 1.0.0
 */
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = readFileSync(join(import.meta.dir, '..', 'snapshot.ts'), 'utf8');

describe('snapshot.ts self-reference pin (T-20261110-006)', () => {
  test('every emitted "bun scripts/" reference targets scripts/co-deck/snapshot.ts', () => {
    const refs = SOURCE.match(/bun scripts\/\S+/g) ?? [];
    // Non-vacuous: the script must still carry the self-referential command class.
    expect(refs.length).toBeGreaterThan(0);
    const broken = refs.filter((ref) => !ref.startsWith('bun scripts/co-deck/snapshot.ts'));
    expect(broken).toEqual([]);
  });

  test('the template file itself contains zero broken-form "bun scripts/snapshot.ts" occurrences', () => {
    expect(SOURCE.includes('bun scripts/snapshot.ts')).toBe(false);
  });
});
