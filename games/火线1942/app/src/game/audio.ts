import type { Settings } from "./types";

export class GameAudio {
  private context: AudioContext | null = null;
  private gain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private settings: Settings;

  constructor(settings: Settings) {
    this.settings = settings;
  }

  unlock() {
    if (!this.context) {
      try {
        this.context = new AudioContext();
        this.gain = this.context.createGain();
        this.gain.connect(this.context.destination);
        this.update(this.settings);
        this.noise = this.context.createBuffer(
          1,
          this.context.sampleRate,
          this.context.sampleRate,
        );
        const data = this.noise.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      } catch {
        return;
      }
    }
    if (this.context.state === "suspended")
      void this.context.resume().catch(() => {});
  }

  update(settings: Settings) {
    this.settings = settings;
    if (this.gain)
      this.gain.gain.value = settings.sound
        ? (settings.volume / 100) * 0.36
        : 0;
  }

  tone(
    freq: number,
    duration: number,
    type: OscillatorType = "sine",
    volume = 0.4,
    endFreq?: number,
  ) {
    if (!this.context || !this.gain || !this.settings.sound) return;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    const now = this.context.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, now);
    if (endFreq)
      oscillator.frequency.exponentialRampToValueAtTime(
        endFreq,
        now + duration,
      );
    envelope.gain.setValueAtTime(volume, now);
    envelope.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(envelope);
    envelope.connect(this.gain);
    oscillator.start(now);
    oscillator.stop(now + duration);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
    };
  }

  burst(duration: number, volume: number, frequency: number) {
    if (!this.context || !this.gain || !this.noise || !this.settings.sound)
      return;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const envelope = this.context.createGain();
    const now = this.context.currentTime;
    source.buffer = this.noise;
    filter.type = "lowpass";
    filter.frequency.value = frequency;
    envelope.gain.setValueAtTime(volume, now);
    envelope.gain.exponentialRampToValueAtTime(0.001, now + duration);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(this.gain);
    source.start(now);
    source.stop(now + duration);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      envelope.disconnect();
    };
  }

  play(
    event:
      | "shot"
      | "heavy"
      | "hit"
      | "kill"
      | "reload"
      | "ability"
      | "shield"
      | "hurt"
      | "start"
      | "win"
      | "jump"
      | "step"
      | "grenade",
  ) {
    switch (event) {
      case "shot":
        this.burst(0.11, 0.75, 2600);
        this.tone(135, 0.09, "sawtooth", 0.28, 42);
        break;
      case "heavy":
        this.burst(0.22, 0.95, 1800);
        this.tone(90, 0.22, "triangle", 0.6, 25);
        break;
      case "hit":
        this.tone(970, 0.055, "sine", 0.28, 640);
        break;
      case "kill":
        this.tone(660, 0.15, "triangle", 0.5, 1320);
        this.tone(990, 0.23, "sine", 0.4);
        break;
      case "reload":
        this.burst(0.1, 0.22, 4500);
        this.tone(220, 0.09, "square", 0.08);
        break;
      case "ability":
        this.tone(180, 0.6, "sine", 0.5, 1500);
        this.burst(0.38, 0.22, 3000);
        break;
      case "shield":
        this.tone(440, 0.5, "sine", 0.3, 880);
        break;
      case "hurt":
        this.burst(0.1, 0.35, 700);
        break;
      case "start":
        this.tone(440, 0.2, "triangle", 0.4, 880);
        break;
      case "win":
        this.tone(523.25, 1.2, "triangle", 0.4);
        this.tone(659.25, 1.4, "triangle", 0.3);
        this.tone(783.99, 1.6, "triangle", 0.3);
        break;
      case "jump":
        this.burst(0.14, 0.13, 600);
        break;
      case "step":
        this.burst(0.08, 0.13, 500);
        break;
      case "grenade":
        this.burst(0.6, 0.8, 950);
        this.tone(80, 0.4, "sine", 0.5, 22);
        break;
    }
  }

  dispose() {
    if (this.context) void this.context.close().catch(() => {});
  }
}
