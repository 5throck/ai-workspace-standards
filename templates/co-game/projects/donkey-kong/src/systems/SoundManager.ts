/**
 * Procedural 8-bit SFX via Web Audio (workspace `sound-synth` rules):
 * short square/triangle blips, no external assets.
 */
export type SfxName = 'jump' | 'hammer' | 'smash' | 'death' | 'clear' | 'coin';

export class SoundManager {
  private ctx: AudioContext | null = null;
  enabled = true;

  private ensureCtx(): AudioContext | null {
    if (!this.enabled) return null;
    if (this.ctx === null) {
      const Ctor =
        (globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
          .AudioContext ??
        (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  play(name: SfxName): void {
    const ctx = this.ensureCtx();
    if (ctx === null) return;
    const t = ctx.currentTime;
    const [freq, dur, type] = (
      {
        jump: [440, 0.12, 'square'],
        hammer: [220, 0.15, 'sawtooth'],
        smash: [180, 0.1, 'square'],
        death: [300, 0.5, 'triangle'],
        clear: [660, 0.4, 'square'],
        coin: [988, 0.08, 'square'],
      } as const
    )[name] as [number, number, OscillatorType];

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (name === 'death') osc.frequency.exponentialRampToValueAtTime(60, t + dur);
    if (name === 'clear') osc.frequency.setValueAtTime(freq * 1.5, t + dur / 2);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur);
  }
}
