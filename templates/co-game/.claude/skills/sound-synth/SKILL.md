---
name: sound-synth
description: >
  Procedural 8-bit retro sound effect and audio synthesis rules using Web Audio API
  and jsfxr parameter specifications for games and interactive web apps.
version: 1.0.0
last_reviewed: 2026-08-06
status: active
scope: co-game
l2_propagate: true
owner: sound-designer
prerequisites: Web Audio API standard support (browser context or node/bun audio polyfill)
metadata:
  type: audio-synthesis
  triggers:
    - sound-synth
    - /sound-synth
    - procedural sound generation
    - 8-bit retro sound effects
    - jsfxr sound synth
---

# Skill: sound-synth

## Context

Modern web and retro arcade games benefit from lightweight, zero-asset audio synthesis. Loading bulky WAV/MP3 files adds network latency and asset management overhead.

`sound-synth` provides the standard specification and implementation patterns for generating **procedural 8-bit retro sound effects** using the **Web Audio API** and **`jsfxr` parameter sets**.

## When to Use

- Generating retro 8-bit sound effects (laser, explosion, jump, powerup, blip) for browser games.
- Creating procedural audio feedback for UI interactions (button clicks, menu navigation, score increments).
- Replacing static `.wav`/`.mp3` audio assets with zero-asset synthesized sound in lightweight games.
- Adding audio layer to HTML5 Canvas or WebGL games without external audio file dependencies.

## Execution Steps

1. **Initialize `RetroSoundSynth`**: Instantiate the synthesizer — `AudioContext` is lazily created on first user interaction.
2. **Configure Sound Parameters**: Select a preset or define custom `jsfxr` parameter values (wave type, frequency, envelope).
3. **Trigger Sound on Game Event**: Call the appropriate method (`playLaser()`, `playExplosion()`, `playJump()`, etc.) in response to game events.
4. **Master Gain Management**: Ensure all sound nodes route through the master `GainNode` to prevent clipping.
5. **Autoplay Policy Compliance**: Only resume `AudioContext` inside user-initiated event handlers.

## Core Principles

1. **Zero External Audio Assets**: All sound effects are generated dynamically in code without external `.wav` or `.mp3` files.
2. **Deterministic Parameterization**: Sound effects are configured using explicit `jsfxr` parameter schemas (wave type, envelope, pitch slides, vibrato, filters).
3. **Lazy AudioContext Initialization**: Always initialize or resume `AudioContext` inside a user interaction handler (click, keypress, touch) to comply with browser autoplay policies.
4. **Non-blocking Synthesis**: Synthesize audio buffers asynchronously or render short clips on demand to prevent main loop frame drops.
5. **Volume Safety & Master Gain**: Route all procedural sound nodes through a master `GainNode` with volume limiting to prevent acoustic distortion or clipping.

## jsfxr Sound Parameter Schema

| Parameter | Type | Range | Description |
|-----------|------|-------|-------------|
| `waveType` | Enum | 0, 1, 2, 3 | `0`: Square, `1`: Sawtooth, `2`: Sine, `3`: Noise |
| `attackTime` | float | 0.0 – 1.0 | Envelope attack duration in seconds |
| `sustainTime` | float | 0.0 – 1.0 | Envelope sustain phase duration |
| `decayTime` | float | 0.0 – 1.0 | Envelope release/decay duration |
| `punch` | float | 0.0 – 1.0 | Initial volume boost during sustain phase |
| `startFrequency` | float | 20 – 2000 | Initial oscillator frequency (Hz) |
| `minFrequency` | float | 20 – 2000 | Pitch slide floor cut-off frequency |
| `slide` | float | -1.0 – 1.0 | Frequency change per second |
| `deltaSlide` | float | -1.0 – 1.0 | Acceleration/deceleration of pitch slide |
| `vibratoDepth` | float | 0.0 – 1.0 | Frequency modulation depth |
| `vibratoSpeed` | float | 0.0 – 1.0 | Frequency modulation rate |
| `dutyCycle` | float | 0.0 – 0.5 | Square wave duty cycle ratio (0.5 = 50% square) |
| `lowPassCutoff` | float | 0.0 – 1.0 | Low pass filter cutoff frequency multiplier |
| `highPassCutoff` | float | 0.0 – 1.0 | High pass filter cutoff frequency multiplier |

## Standard Sound Preset Rules

### 1. Laser / Shoot
- **Wave**: Square (`waveType: 0`)
- **Pitch**: Start frequency ~800 Hz, steep downward slide (`slide: -0.4`).
- **Envelope**: Instant attack (`0.0s`), short decay (`0.15s`).

### 2. Explosion / Impact
- **Wave**: White Noise (`waveType: 3`)
- **Filter**: Low-pass filter sweeping downward from 1000 Hz to 100 Hz.
- **Envelope**: Fast attack (`0.01s`), punch (`0.4`), medium decay (`0.4s`).

### 3. Powerup / Pickup
- **Wave**: Sawtooth or Square (`waveType: 1`)
- **Arpeggio**: Pitch steps up rapidly (+4 semi-tones, then +7 semi-tones).
- **Envelope**: Quick attack (`0.02s`), sustain (`0.1s`), decay (`0.2s`).

### 4. Jump
- **Wave**: Square (`waveType: 0`)
- **Pitch**: Upward sweep from 150 Hz to 600 Hz (`slide: 0.5`).
- **Envelope**: Attack (`0.01s`), decay (`0.12s`).

### 5. Blip / UI Select
- **Wave**: Sine (`waveType: 2`)
- **Pitch**: High pitch (880 Hz or 1046 Hz), constant frequency.
- **Envelope**: Attack (`0.005s`), decay (`0.04s`).

## Canonical Web Audio API Implementation Pattern

```typescript
/**
 * Procedural Sound Synthesizer engine using Web Audio API.
 */
export class RetroSoundSynth {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  constructor() {
    // AudioContext created on demand
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.3; // Prevent clipping
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public playLaser(): void {
    const ctx = this.ensureContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "square";
    const now = ctx.currentTime;

    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.15);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playExplosion(): void {
    const ctx = this.ensureContext();
    const bufferSize = ctx.sampleRate * 0.3;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    const now = ctx.currentTime;

    filter.frequency.setValueAtTime(1000, now);
    filter.frequency.linearRampToValueAtTime(100, now + 0.3);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);

    whiteNoise.start(now);
  }

  public playBlip(): void {
    const ctx = this.ensureContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    osc.type = "sine";
    osc.frequency.setValueAtTime(987.77, now); // B5 note

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(now);
    osc.stop(now + 0.05);
  }
}
```

## Output Format

Audio rendered directly to the Web Audio API output graph. No file artifacts are produced. The synthesizer exposes typed methods:

```typescript
const synth = new RetroSoundSynth();
synth.playLaser();     // Triggers laser/shoot sound
synth.playExplosion(); // Triggers explosion/impact sound
synth.playBlip();      // Triggers UI select/blip sound
```

## Related Skills

- `ecs-core`: Entity Component System engine core — connects game events to audio triggers.
- `canvas-renderer`: HTML5 Canvas rendering pipeline — coordinates visual and audio feedback.
- `game-loop`: Main game loop orchestration — integrates sound synthesis into the tick cycle.
- `level-design`: Level and environment design — specifies sound event mappings per level.
