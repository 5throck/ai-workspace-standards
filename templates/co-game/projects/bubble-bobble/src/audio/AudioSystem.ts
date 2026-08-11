import { Sequencer } from './Sequencer';

// Classic Bubble Bobble Main Theme BGM (Sonic Boom / Main Theme).
// Original melody notes transcribed to frequencies (Hz).
// A-A-B-C structure: melody plays the iconic ascending/descending hop motif.
const A4 = 440.0;
const E4 = 329.63;
const D4 = 293.66;
const C4 = 261.63;
const B3 = 246.94;
const A3 = 220.0;
const G3 = 196.0;
const F3 = 174.61;
const C5 = 523.25;
const D5 = 587.33;
const E5 = 659.25;
const G5 = 783.99;
const A5 = 880.0;
const F5 = 698.46;
const REST = 0;

// Classic Bubble Bobble theme melody - main A phrase (the iconic 8-note motif)
const MELODY_A: number[] = [
  E5, D5, C5, D5, E5, G5, A5, REST,
];
// B phrase (descending response)
const MELODY_B: number[] = [
  G5, F5, E5, D5, C5, D5, E5, REST,
];
// C phrase (the bouncy resolution motif)
const MELODY_C: number[] = [
  A5, G5, F5, E5, D5, C5, D5, E5,
];
const MELODY_PATTERN: number[] = [
  ...MELODY_A, ...MELODY_A, ...MELODY_B, ...MELODY_A,
  ...MELODY_C, ...MELODY_B, ...MELODY_A, ...MELODY_A,
];

// Harmony (thirds below melody)
const HARMONY_A: number[] = [
  C5, B3, A4, B3, C5, E5, F5, REST,
];
const HARMONY_B: number[] = [
  E5, D5, C5, B3, A4, B3, C5, REST,
];
const HARMONY_C: number[] = [
  F5, E5, D5, C5, B3, A4, B3, C5,
];
const HARMONY_PATTERN: number[] = [
  ...HARMONY_A, ...HARMONY_A, ...HARMONY_B, ...HARMONY_A,
  ...HARMONY_C, ...HARMONY_B, ...HARMONY_A, ...HARMONY_A,
];

// Bass line (root notes of the chord progression - C-G-A-F walking bass)
const BASS_A: number[] = [C4, G3, A3, F3];
const BASS_B: number[] = [G3, D4, E4, C4];
const BASS_PATTERN: number[] = [
  ...BASS_A, ...BASS_A, ...BASS_B, ...BASS_A,
  ...BASS_A, ...BASS_B, ...BASS_A, ...BASS_A,
];

const STEP_DURATION_SECONDS = 0.113; // ~133 BPM (eighth notes at 133BPM = 0.113s)

interface ThemeTuning {
  tempoMultiplier: number;
  transposeSemitones: number;
}

// cave / ruins / sky — see StageMeta.ts themeIndex (0/1/2 cycling).
const THEME_TUNINGS: ThemeTuning[] = [
  { tempoMultiplier: 1.0, transposeSemitones: 0 }, // cave
  { tempoMultiplier: 1.05, transposeSemitones: 2 }, // ruins
  { tempoMultiplier: 0.95, transposeSemitones: -2 }, // sky
];

function transpose(frequency: number, semitones: number): number {
  if (frequency <= 0) return frequency;
  return frequency * Math.pow(2, semitones / 12);
}

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  private masterGain: GainNode | null = null;
  private bgmBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;

  private sequencer: Sequencer | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private isHurryUp: boolean = false;
  private currentThemeIndex: number = 0;

  constructor() {
    // Lazy initialized on first user interaction to comply with browser autoplay policies
  }

  private initCtx(): void {
    if (this.ctx) return;
    if (typeof window === 'undefined') return;
    const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
    if (!AudioContextClass) return;

    this.ctx = new AudioContextClass();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.isMuted ? 0 : 1;
    this.masterGain.connect(this.ctx.destination);

    this.bgmBus = this.ctx.createGain();
    this.bgmBus.gain.value = 1;
    this.bgmBus.connect(this.masterGain);

    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = 1;
    this.sfxBus.connect(this.masterGain);

    this.sequencer = new Sequencer(() => this.ctx!.currentTime);
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    this.initCtx();
    if (this.masterGain) {
      this.masterGain.gain.value = this.isMuted ? 0 : 1;
    }
    return this.isMuted;
  }

  public setBgmVolume(v: number): void {
    this.initCtx();
    if (this.bgmBus) {
      this.bgmBus.gain.value = Math.max(0, Math.min(1, v));
    }
  }

  public setSfxVolume(v: number): void {
    this.initCtx();
    if (this.sfxBus) {
      this.sfxBus.gain.value = Math.max(0, Math.min(1, v));
    }
  }

  private createSynthVoice(type: OscillatorType, frequency: number, bus: GainNode): { osc: OscillatorNode, gain: GainNode } | null {
    this.initCtx();
    if (!this.ctx) return null;

    // Resume context if suspended
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);

    osc.connect(gain);
    gain.connect(bus);

    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };

    return { osc, gain };
  }

  private getNoiseBuffer(): AudioBuffer | null {
    if (!this.ctx) return null;
    if (this.noiseBuffer) return this.noiseBuffer;

    const length = Math.floor(this.ctx.sampleRate * 0.5);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return this.noiseBuffer;
  }

  // Short white-noise burst shaped with a fast-decay envelope, used as an
  // impact layer under existing oscillator-based SFX (pops, landings, etc.).
  private playNoiseBurst(bus: GainNode, when: number, peakVolume: number, decaySeconds: number): void {
    if (!this.ctx) return;
    const buffer = this.getNoiseBuffer();
    if (!buffer) return;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(peakVolume, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + decaySeconds);

    source.connect(gain);
    gain.connect(bus);

    source.onended = () => {
      source.disconnect();
      gain.disconnect();
    };

    source.start(when);
    source.stop(when + decaySeconds);
  }

  public playShoot(): void {
    const voice = this.createSynthVoice('triangle', 300, this.sfxBus!);
    if (!voice || !this.ctx) return;

    const now = this.ctx.currentTime;
    voice.osc.frequency.exponentialRampToValueAtTime(1000, now + 0.12);

    voice.gain.gain.setValueAtTime(0.2, now);
    voice.gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    voice.osc.start(now);
    voice.osc.stop(now + 0.16);
  }

  public playJump(): void {
    const voice = this.createSynthVoice('sine', 200, this.sfxBus!);
    if (!voice || !this.ctx) return;

    const now = this.ctx.currentTime;
    voice.osc.frequency.exponentialRampToValueAtTime(450, now + 0.12);

    voice.gain.gain.setValueAtTime(0.25, now);
    voice.gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    voice.osc.start(now);
    voice.osc.stop(now + 0.16);
  }

  public playPop(comboCount: number = 0): void {
    const semitones = [0, 4, 7, 10, 12, 16, 19, 22, 24];
    const index = Math.min(comboCount, semitones.length - 1);
    const semitone = semitones[index];
    const pitch = 800 * Math.pow(1.05946, semitone);

    const voice = this.createSynthVoice('square', pitch, this.sfxBus!);
    if (!voice || !this.ctx) return;

    const now = this.ctx.currentTime;
    voice.osc.frequency.exponentialRampToValueAtTime(pitch / 5, now + 0.07);

    voice.gain.gain.setValueAtTime(0.15, now);
    voice.gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    voice.osc.start(now);
    voice.osc.stop(now + 0.09);

    this.playNoiseBurst(this.sfxBus!, now, 0.12, 0.06);
  }

  public playDeath(): void {
    const voice = this.createSynthVoice('sawtooth', 400, this.sfxBus!);
    if (!voice || !this.ctx) return;

    const now = this.ctx.currentTime;
    voice.osc.frequency.linearRampToValueAtTime(80, now + 0.5);

    voice.gain.gain.setValueAtTime(0.3, now);
    voice.gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

    voice.osc.start(now);
    voice.osc.stop(now + 0.61);
  }

  public playLand(): void {
    const voice = this.createSynthVoice('sine', 150, this.sfxBus!);
    if (!voice || !this.ctx) return;

    const now = this.ctx.currentTime;
    voice.osc.frequency.exponentialRampToValueAtTime(60, now + 0.08);

    voice.gain.gain.setValueAtTime(0.18, now);
    voice.gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    voice.osc.start(now);
    voice.osc.stop(now + 0.11);

    this.playNoiseBurst(this.sfxBus!, now, 0.15, 0.08);
  }

  public playCapture(): void {
    const voice = this.createSynthVoice('square', 500, this.sfxBus!);
    if (!voice || !this.ctx) return;

    const now = this.ctx.currentTime;
    voice.osc.frequency.setValueAtTime(500, now);
    voice.osc.frequency.exponentialRampToValueAtTime(900, now + 0.1);
    voice.osc.frequency.exponentialRampToValueAtTime(700, now + 0.2);

    voice.gain.gain.setValueAtTime(0.2, now);
    voice.gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);

    voice.osc.start(now);
    voice.osc.stop(now + 0.23);
  }

  // tier 0 = common (lower pitch blip), tier 1+ = rare (brighter, higher blip)
  public playPickup(tier: number = 0): void {
    const basePitch = tier >= 1 ? 1200 : 800;
    const voice = this.createSynthVoice('square', basePitch, this.sfxBus!);
    if (!voice || !this.ctx) return;

    const now = this.ctx.currentTime;
    voice.osc.frequency.exponentialRampToValueAtTime(basePitch * 1.5, now + 0.09);

    voice.gain.gain.setValueAtTime(tier >= 1 ? 0.22 : 0.16, now);
    voice.gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    voice.osc.start(now);
    voice.osc.stop(now + 0.13);
  }

  public playStageClear(): void {
    if (!this.ctx || !this.sfxBus) {
      this.initCtx();
    }
    if (!this.ctx || !this.sfxBus) return;

    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // ascending arpeggio C-E-G-C

    notes.forEach((freq, i) => {
      const when = now + i * 0.12;
      const voice = this.createSynthVoice('square', freq, this.sfxBus!);
      if (!voice) return;
      voice.gain.gain.setValueAtTime(0.2, when);
      voice.gain.gain.exponentialRampToValueAtTime(0.01, when + 0.15);
      voice.osc.start(when);
      voice.osc.stop(when + 0.16);
    });
  }

  public playGameOver(): void {
    if (!this.ctx || !this.sfxBus) {
      this.initCtx();
    }
    if (!this.ctx || !this.sfxBus) return;

    const now = this.ctx.currentTime;
    const notes = [523.25, 466.16, 392.0, 261.63]; // descending jingle

    notes.forEach((freq, i) => {
      const when = now + i * 0.18;
      const voice = this.createSynthVoice('sawtooth', freq, this.sfxBus!);
      if (!voice) return;
      voice.gain.gain.setValueAtTime(0.22, when);
      voice.gain.gain.exponentialRampToValueAtTime(0.01, when + 0.22);
      voice.osc.start(when);
      voice.osc.stop(when + 0.23);
    });
  }

  public playHurryUp(): void {
    if (!this.ctx || !this.sfxBus) {
      this.initCtx();
    }
    if (!this.ctx || !this.sfxBus) return;

    const now = this.ctx.currentTime;
    const pulses = [880, 660, 880, 660];

    pulses.forEach((freq, i) => {
      const when = now + i * 0.11;
      const voice = this.createSynthVoice('square', freq, this.sfxBus!);
      if (!voice) return;
      voice.gain.gain.setValueAtTime(0.2, when);
      voice.gain.gain.exponentialRampToValueAtTime(0.01, when + 0.1);
      voice.osc.start(when);
      voice.osc.stop(when + 0.1);
    });
  }

  public playMenuSelect(): void {
    const voice = this.createSynthVoice('square', 900, this.sfxBus!);
    if (!voice || !this.ctx) return;

    const now = this.ctx.currentTime;
    voice.gain.gain.setValueAtTime(0.15, now);
    voice.gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);

    voice.osc.start(now);
    voice.osc.stop(now + 0.07);
  }

  public playBGM(themeIndex: number = 0): void {
    this.stopBGM();
    this.initCtx();
    if (!this.ctx || !this.bgmBus || !this.sequencer) return;

    this.currentThemeIndex = themeIndex;
    this.isHurryUp = false;

    const tuning = THEME_TUNINGS[((themeIndex % THEME_TUNINGS.length) + THEME_TUNINGS.length) % THEME_TUNINGS.length];
    const stepDuration = STEP_DURATION_SECONDS / tuning.tempoMultiplier;

    this.sequencer.start((stepIndex, when) => {
      if (!this.ctx || !this.bgmBus) return;
      const step = stepIndex % MELODY_PATTERN.length;

      // Melody voice (square, low volume)
      const mFreq = transpose(MELODY_PATTERN[step], tuning.transposeSemitones);
      if (mFreq > 0) {
        const mVoice = this.createSynthVoice('square', mFreq, this.bgmBus);
        if (mVoice) {
          mVoice.gain.gain.setValueAtTime(0.03, when);
          mVoice.gain.gain.exponentialRampToValueAtTime(0.001, when + stepDuration * 0.9);
          mVoice.osc.start(when);
          mVoice.osc.stop(when + stepDuration);
        }
      }

      // Harmony / counter-melody voice (square, quieter than melody)
      const hFreq = transpose(HARMONY_PATTERN[step], tuning.transposeSemitones);
      if (hFreq > 0) {
        const hVoice = this.createSynthVoice('square', hFreq, this.bgmBus);
        if (hVoice) {
          hVoice.gain.gain.setValueAtTime(0.015, when);
          hVoice.gain.gain.exponentialRampToValueAtTime(0.001, when + stepDuration * 0.9);
          hVoice.osc.start(when);
          hVoice.osc.stop(when + stepDuration);
        }
      }

      // Bass voice (triangle) on every other step
      if (step % 2 === 0) {
        const bFreq = transpose(BASS_PATTERN[Math.floor(step / 2) % BASS_PATTERN.length], tuning.transposeSemitones);
        const bVoice = this.createSynthVoice('triangle', bFreq, this.bgmBus);
        if (bVoice) {
          bVoice.gain.gain.setValueAtTime(0.06, when);
          bVoice.gain.gain.exponentialRampToValueAtTime(0.001, when + stepDuration * 1.8);
          bVoice.osc.start(when);
          bVoice.osc.stop(when + stepDuration * 2);
        }
      }

      // Percussion: noise burst on strong beats
      if (step % 4 === 0) {
        this.playNoiseBurst(this.bgmBus, when, 0.08, 0.05);
      }
    }, stepDuration);
  }

  public stopBGM(): void {
    if (this.sequencer) {
      this.sequencer.stop();
    }
  }

  public setHurryUp(hurryUp: boolean): void {
    if (this.isHurryUp === hurryUp) return;
    this.isHurryUp = hurryUp;
    if (this.sequencer && this.sequencer.running) {
      const idx = ((this.currentThemeIndex % THEME_TUNINGS.length) + THEME_TUNINGS.length) % THEME_TUNINGS.length;
      const tuning = THEME_TUNINGS[idx];
      let tempoMultiplier = tuning.tempoMultiplier;
      if (this.isHurryUp) {
        tempoMultiplier *= 1.4;
      }
      const stepDuration = STEP_DURATION_SECONDS / tempoMultiplier;
      this.sequencer.setStepDuration(stepDuration);
    }
  }
}
export const audio = new AudioSystem();
