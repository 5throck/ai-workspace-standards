/**
 * StateMachine Unit Tests
 *
 * Tests the generic StateMachine including:
 * - Valid and invalid transitions
 * - Enter/exit callback firing order
 * - Transition event metadata (from, to, trigger)
 * - Wildcard transitions ('*' matches any current state)
 * - Multiple callbacks on same state
 * - Reset behavior (no callbacks fired)
 */
import { describe, it, expect, vi } from 'vitest';
import { StateMachine, type TransitionEvent } from '../src/systems/StateMachine';

type TestState = 'IDLE' | 'RUNNING' | 'PAUSED' | 'STOPPED';

describe('StateMachine', () => {
  describe('basic transitions', () => {
    it('allows registered transitions', () => {
      const sm = new StateMachine<TestState>('IDLE');
      sm.addTransition('IDLE', 'RUNNING');
      sm.addTransition('RUNNING', 'PAUSED');
      sm.addTransition('PAUSED', 'RUNNING');

      expect(sm.transition('RUNNING')).toBe(true);
      expect(sm.state).toBe('RUNNING');
      expect(sm.transition('PAUSED')).toBe(true);
      expect(sm.state).toBe('PAUSED');
      expect(sm.transition('RUNNING')).toBe(true);
      expect(sm.state).toBe('RUNNING');
    });

    it('rejects unregistered transitions', () => {
      const sm = new StateMachine<TestState>('IDLE');
      sm.addTransition('IDLE', 'RUNNING');

      expect(sm.transition('PAUSED')).toBe(false);
      expect(sm.state).toBe('IDLE');
    });

    it('rejects transition from wrong state', () => {
      const sm = new StateMachine<TestState>('IDLE');
      sm.addTransition('IDLE', 'RUNNING');
      sm.addTransition('RUNNING', 'PAUSED');

      expect(sm.transition('RUNNING')).toBe(true);
      expect(sm.transition('STOPPED')).toBe(false);
    });
  });

  describe('callbacks', () => {
    it('fires exit callback on leaving a state', () => {
      const sm = new StateMachine<TestState>('IDLE');
      sm.addTransition('IDLE', 'RUNNING');

      const exitCb = vi.fn<(event: TransitionEvent<TestState>) => void>();
      sm.onStateExit('IDLE', exitCb);

      sm.transition('RUNNING');
      expect(exitCb).toHaveBeenCalledTimes(1);
      expect(exitCb).toHaveBeenCalledWith(
        expect.objectContaining({ from: 'IDLE', to: 'RUNNING' }),
      );
    });

    it('fires enter callback on entering a state', () => {
      const sm = new StateMachine<TestState>('IDLE');
      sm.addTransition('IDLE', 'RUNNING');

      const enterCb = vi.fn<(event: TransitionEvent<TestState>) => void>();
      sm.onStateEnter('RUNNING', enterCb);

      sm.transition('RUNNING');
      expect(enterCb).toHaveBeenCalledTimes(1);
      expect(enterCb).toHaveBeenCalledWith(
        expect.objectContaining({ from: 'IDLE', to: 'RUNNING' }),
      );
    });

    it('fires exit before enter in correct order', () => {
      const sm = new StateMachine<TestState>('IDLE');
      sm.addTransition('IDLE', 'RUNNING');

      const order: string[] = [];
      sm.onStateExit('IDLE', () => order.push('exit-IDLE'));
      sm.onStateEnter('RUNNING', () => order.push('enter-RUNNING'));

      sm.transition('RUNNING');
      expect(order).toEqual(['exit-IDLE', 'enter-RUNNING']);
    });

    it('supports multiple callbacks on same state', () => {
      const sm = new StateMachine<TestState>('IDLE');
      sm.addTransition('IDLE', 'RUNNING');

      const cb1 = vi.fn<(event: TransitionEvent<TestState>) => void>();
      const cb2 = vi.fn<(event: TransitionEvent<TestState>) => void>();
      sm.onStateEnter('RUNNING', cb1);
      sm.onStateEnter('RUNNING', cb2);

      sm.transition('RUNNING');
      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
    });
  });

  describe('transition event metadata', () => {
    it('passes correct from/to in event', () => {
      const sm = new StateMachine<TestState>('IDLE');
      sm.addTransition('IDLE', 'RUNNING');

      let capturedEvent: TransitionEvent<TestState> | undefined;
      sm.onStateEnter('RUNNING', (event) => { capturedEvent = event; });

      sm.transition('RUNNING');

      expect(capturedEvent).toBeDefined();
      expect(capturedEvent!.from).toBe('IDLE');
      expect(capturedEvent!.to).toBe('RUNNING');
    });

    it('passes trigger in event when provided', () => {
      const sm = new StateMachine<TestState>('RUNNING');
      sm.addTransition('RUNNING', 'PAUSED');

      let capturedTrigger: string | undefined;
      sm.onStateEnter('PAUSED', (event) => { capturedTrigger = event.trigger; });

      sm.transition('PAUSED', 'user-press-escape');

      expect(capturedTrigger).toBe('user-press-escape');
    });

    it('passes undefined trigger when not provided', () => {
      const sm = new StateMachine<TestState>('IDLE');
      sm.addTransition('IDLE', 'RUNNING');

      let capturedTrigger: string | undefined;
      sm.onStateEnter('RUNNING', (event) => { capturedTrigger = event.trigger; });

      sm.transition('RUNNING');

      expect(capturedTrigger).toBeUndefined();
    });

    it('both exit and enter callbacks receive the same event', () => {
      const sm = new StateMachine<TestState>('IDLE');
      sm.addTransition('IDLE', 'RUNNING');

      let exitEvent: TransitionEvent<TestState> | undefined;
      let enterEvent: TransitionEvent<TestState> | undefined;
      sm.onStateExit('IDLE', (event) => { exitEvent = event; });
      sm.onStateEnter('RUNNING', (event) => { enterEvent = event; });

      sm.transition('RUNNING', 'start-button');

      expect(exitEvent!.from).toBe('IDLE');
      expect(exitEvent!.to).toBe('RUNNING');
      expect(exitEvent!.trigger).toBe('start-button');
      expect(enterEvent).toEqual(exitEvent);
    });
  });

  describe('wildcard transitions', () => {
    it('allows wildcard transition from any state', () => {
      const sm = new StateMachine<TestState>('IDLE');
      sm.addTransition('*', 'STOPPED');

      expect(sm.transition('STOPPED')).toBe(true);
      expect(sm.state).toBe('STOPPED');
    });

    it('allows wildcard transition after specific state change', () => {
      const sm = new StateMachine<TestState>('IDLE');
      sm.addTransition('IDLE', 'RUNNING');
      sm.addTransition('*', 'STOPPED');

      sm.transition('RUNNING');
      expect(sm.state).toBe('RUNNING');

      sm.transition('STOPPED');
      expect(sm.state).toBe('STOPPED');
    });

    it('prefers specific transition over wildcard', () => {
      const sm = new StateMachine<TestState>('IDLE');
      sm.addTransition('IDLE', 'RUNNING');
      sm.addTransition('*', 'STOPPED');

      const enterCb = vi.fn();
      sm.onStateEnter('RUNNING', enterCb);
      sm.onStateEnter('STOPPED', vi.fn<(event: TransitionEvent<TestState>) => void>());

      sm.transition('RUNNING');
      expect(sm.state).toBe('RUNNING');
      expect(enterCb).toHaveBeenCalledTimes(1);
    });
  });

  describe('reset', () => {
    it('forces state without firing callbacks', () => {
      const sm = new StateMachine<TestState>('IDLE');
      sm.addTransition('IDLE', 'RUNNING');

      const exitCb = vi.fn<(event: TransitionEvent<TestState>) => void>();
      const enterCb = vi.fn<(event: TransitionEvent<TestState>) => void>();
      sm.onStateExit('IDLE', exitCb);
      sm.onStateEnter('RUNNING', enterCb);

      sm.reset('RUNNING');
      expect(sm.state).toBe('RUNNING');
      expect(exitCb).not.toHaveBeenCalled();
      expect(enterCb).not.toHaveBeenCalled();
    });
  });

  describe('state getter', () => {
    it('returns initial state', () => {
      const sm = new StateMachine<TestState>('IDLE');
      expect(sm.state).toBe('IDLE');
    });
  });
});
