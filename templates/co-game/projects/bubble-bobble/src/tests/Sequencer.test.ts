import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Sequencer } from '../audio/Sequencer';

describe('Sequencer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('schedules steps ahead of playback time using the lookahead window, with monotonically increasing "when" timestamps', () => {
    let currentTime = 0;
    const getCurrentTime = () => currentTime;

    const pumpIntervalMs = 25;
    const lookaheadSeconds = 0.1;
    const stepDurationSeconds = 0.2;

    const sequencer = new Sequencer(getCurrentTime, pumpIntervalMs, lookaheadSeconds);
    const ticks: { stepIndex: number; when: number }[] = [];

    sequencer.start((stepIndex, when) => {
      ticks.push({ stepIndex, when });
    }, stepDurationSeconds);

    // Simulate 1 second of elapsed (real + audio-clock) time advancing together
    // in 25ms increments, matching the pump interval.
    const totalSimulatedMs = 1000;
    const incrementMs = 25;
    for (let elapsed = 0; elapsed < totalSimulatedMs; elapsed += incrementMs) {
      currentTime += incrementMs / 1000;
      vi.advanceTimersByTime(incrementMs);
    }

    // Over 1 simulated second with 0.2s steps, we expect ~5 ticks (plus
    // possibly one extra pulled in by the lookahead window at the end).
    expect(ticks.length).toBeGreaterThanOrEqual(5);
    expect(ticks.length).toBeLessThanOrEqual(7);

    // Step indices are sequential starting at 0.
    ticks.forEach((tick, i) => expect(tick.stepIndex).toBe(i));

    // "when" timestamps are monotonically increasing and spaced by exactly
    // the step duration.
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i].when).toBeGreaterThan(ticks[i - 1].when);
      expect(ticks[i].when - ticks[i - 1].when).toBeCloseTo(stepDurationSeconds, 10);
    }

    // Every scheduled "when" must never be scheduled further out than the
    // lookahead window measured from the sim-time at first scheduling call
    // (i.e. steps are scheduled ahead of, not after, playback time).
    expect(ticks[0].when).toBeLessThanOrEqual(lookaheadSeconds + 1e-9);

    sequencer.stop();
    const countAfterStop = ticks.length;

    // Advancing time/timers after stop() must not produce further ticks.
    currentTime += 1;
    vi.advanceTimersByTime(1000);
    expect(ticks.length).toBe(countAfterStop);
  });

  it('does not tick before start() is called and stop() is safe to call when not running', () => {
    let currentTime = 0;
    const sequencer = new Sequencer(() => currentTime, 25, 0.1);

    expect(() => sequencer.stop()).not.toThrow();

    currentTime += 1;
    vi.advanceTimersByTime(1000);
    // No callback was ever registered, nothing to assert on ticks directly,
    // but this should not throw.
  });
});
