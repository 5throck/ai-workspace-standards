/**
 * Pac-Man - Sound Manager
 *
 * Procedural audio using Web Audio API oscillators.
 * All sounds are generated at runtime (no audio files).
 * See asset-spec.md Section 5 for frequency and duration specifications.
 *
 * Lifecycle:
 * - `init()` creates the AudioContext and master gain node
 * - `dispose()` closes the AudioContext and disconnects all nodes
 * - All oscillators are disconnected after completion to prevent resource leaks
 * - ADSR envelopes applied to all transient sounds to prevent clicks/pops
 */
export class SoundManager {
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sirenOsc: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;
  private sirenTimeout: ReturnType<typeof setTimeout> | null = null;
  private dotCounter: number = 0;

  /** Initialize the AudioContext (must be called after user interaction). */
  init(): void {
    if (this.audioCtx) return;
    try {
      this.audioCtx = new AudioContext();
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.connect(this.audioCtx.destination);
    } catch {
      this.audioCtx = null;
    }
  }

  /** Ensure AudioContext is resumed (needed after browser autoplay policy). */
  private ensureContext(): AudioContext | null {
    if (!this.audioCtx) return null;
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  /** Get the master gain node for external volume control. */
  getMasterGain(): GainNode | null {
    return this.masterGain;
  }

  /** Set master volume (0.0 – 1.0). */
  setVolume(volume: number): void {
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), this.audioCtx?.currentTime ?? 0);
    }
  }

  /**
   * Play the waka sound (alternating between two tones).
   * Odd dots: 262 Hz, Even dots: 330 Hz, Square wave, 100ms.
   */
  playWaka(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const freq = this.dotCounter % 2 === 0 ? 262 : 330;
    this.dotCounter++;
    this.playTone(freq, 0.1, 'square', 0.15);
  }

  /** Play power pellet sound: sine sweep 200->800 Hz, 300ms. */
  playPower(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.3);
    this.applyADSR(gain, ctx.currentTime, 0.01, 0.05, 0.15, 0.05, 0.3);
    osc.connect(gain).connect(this.masterGain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
    osc.onended = () => gain.disconnect();
  }

  /** Play ghost eat sound: sine sweep 800->1200 Hz, 400ms. */
  playGhostEat(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(1200, ctx.currentTime + 0.4);
    this.applyADSR(gain, ctx.currentTime, 0.01, 0.05, 0.15, 0.1, 0.4);
    osc.connect(gain).connect(this.masterGain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
    osc.onended = () => gain.disconnect();
  }

  /** Play death sound: square sweep 500->100 Hz, 1500ms. */
  playDeath(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    this.stopSiren();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(500, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 1.5);
    this.applyADSR(gain, ctx.currentTime, 0.01, 0.1, 0.15, 0.2, 1.5);
    osc.connect(gain).connect(this.masterGain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 1.5);
    osc.onended = () => gain.disconnect();
  }

  /** Play level up sound: square arpeggio C-E-G-C, 800ms. */
  playLevelUp(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const master = this.masterGain;

    this.stopSiren();

    const notes = [262, 330, 392, 523]; // C4, E4, G4, C5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.2);
      const start = ctx.currentTime + i * 0.2;
      this.applyADSR(gain, start, 0.005, 0.02, 0.15, 0.05, 0.15);
      osc.connect(gain).connect(master);
      osc.start(start);
      osc.stop(start + 0.2);
      osc.onended = () => gain.disconnect();
    });
  }

  /** Play game over sound: square notes G-E-C, 2000ms. */
  playGameOver(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const master = this.masterGain;

    this.stopSiren();

    const notes = [392, 330, 262]; // G4, E4, C4
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      const start = ctx.currentTime + i * 0.5;
      osc.frequency.setValueAtTime(freq, start);
      this.applyADSR(gain, start, 0.01, 0.03, 0.15, 0.05, 0.45);
      osc.connect(gain).connect(master);
      osc.start(start);
      osc.stop(start + 0.5);
      osc.onended = () => gain.disconnect();
    });
  }

  /** Play intro sound: square arpeggio C-E-G-B-C, 1000ms. */
  playIntro(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const master = this.masterGain;

    const notes = [262, 330, 392, 494, 523]; // C4, E4, G4, B4, C5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      const start = ctx.currentTime + i * 0.15;
      osc.frequency.setValueAtTime(freq, start);
      this.applyADSR(gain, start, 0.005, 0.02, 0.15, 0.05, 0.12);
      osc.connect(gain).connect(master);
      osc.start(start);
      osc.stop(start + 0.15);
      osc.onended = () => gain.disconnect();
    });
  }

  /**
   * Start the background siren loop: sawtooth wave, 80-120 Hz oscillation.
   * The siren gently oscillates in frequency to create an eerie effect.
   * Continuously reschedules to prevent the oscillation from flatlining.
   */
  startSiren(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    if (this.sirenOsc) return; // Already playing

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime); // Low volume background

    osc.connect(gain).connect(this.masterGain);
    osc.start(ctx.currentTime);

    this.sirenOsc = osc;
    this.sirenGain = gain;

    // Schedule continuous oscillation with automatic reschedule
    this.scheduleSirenOscillation();
  }

  /** Stop the background siren and clean up rescheduling. */
  stopSiren(): void {
    if (this.sirenTimeout !== null) {
      clearTimeout(this.sirenTimeout);
      this.sirenTimeout = null;
    }
    if (this.sirenGain) {
      try { this.sirenGain.disconnect(); } catch { /* already disconnected */ }
      this.sirenGain = null;
    }
    if (this.sirenOsc) {
      try { this.sirenOsc.stop(); } catch { /* already stopped */ }
      this.sirenOsc = null;
    }
  }

  /**
   * Dispose of all audio resources. Call this when the game is torn down.
   * Closes the AudioContext and disconnects all remaining nodes.
   */
  dispose(): void {
    this.stopSiren();
    if (this.masterGain) {
      try { this.masterGain.disconnect(); } catch { /* already disconnected */ }
      this.masterGain = null;
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try { this.audioCtx.close(); } catch { /* already closed */ }
    }
    this.audioCtx = null;
  }

  /** Reset dot counter (for waka alternation). */
  resetDotCounter(): void {
    this.dotCounter = 0;
  }

  // -- Private Helpers --------------------------------------------------------

  /** Play a simple tone with the given frequency, duration, waveform, and volume. */
  private playTone(freq: number, duration: number, type: OscillatorType, volume: number): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    this.applyADSR(gain, ctx.currentTime, 0.005, 0.02, volume, 0.02, duration);
    osc.connect(gain).connect(this.masterGain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
    osc.onended = () => gain.disconnect();
  }

  /**
   * Apply an ADSR envelope to a gain node.
   * Provides smooth attack/decay to prevent clicks and pops.
   */
  private applyADSR(
    gain: GainNode,
    startTime: number,
    attack: number = 0.01,
    decay: number = 0.05,
    sustain: number = 0.3,
    release: number = 0.05,
    duration: number = 0.5,
  ): void {
    const endTime = startTime + duration;
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(sustain, startTime + attack);
    if (decay > 0) {
      gain.gain.linearRampToValueAtTime(sustain * 0.8, startTime + attack + decay);
    }
    gain.gain.setValueAtTime(sustain * 0.8, endTime - release);
    gain.gain.linearRampToValueAtTime(0, endTime);
  }

  /**
   * Schedule continuous siren frequency oscillation.
   * Schedules 10 cycles ahead (~10 seconds) and sets a timeout
   * to reschedule before the last cycle expires.
   */
  private scheduleSirenOscillation(): void {
    if (!this.sirenOsc || !this.audioCtx) return;

    const now = this.audioCtx.currentTime;
    for (let i = 0; i < 10; i++) {
      const t = now + i;
      this.sirenOsc.frequency.linearRampToValueAtTime(120, t + 0.5);
      this.sirenOsc.frequency.linearRampToValueAtTime(80, t + 1.0);
    }

    // Reschedule 1 second before the last cycle expires
    this.sirenTimeout = setTimeout(() => {
      this.scheduleSirenOscillation();
    }, 9000);
  }
}
