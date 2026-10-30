// Sound engine: a mono lead, a chord section (pad / strum / arp / air guitar), a drum machine and a recorder.
import * as Tone from "tone";

type Lead = Tone.Synth | Tone.MonoSynth | Tone.FMSynth | Tone.AMSynth | Tone.DuoSynth;
type Chord = Tone.PolySynth<Tone.Synth | Tone.MonoSynth | Tone.FMSynth>;

interface LeadPreset {
  label: string;
  volume: number; // dB offset from the lead base level
  retrigger?: boolean; // percussive voices re-strike on every note instead of gliding
  create: () => Lead;
}

export const LEAD_PRESETS = {
  saw: {
    label: "Saw lead",
    volume: 0,
    create: () =>
      new Tone.MonoSynth({
        oscillator: { type: "sawtooth" },
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.4 },
        filterEnvelope: { attack: 0.01, decay: 0.3, sustain: 0.6, release: 0.4, baseFrequency: 400, octaves: 3 },
        portamento: 0.05,
      }),
  },
  soft: {
    label: "Soft flute",
    volume: 0,
    create: () =>
      new Tone.Synth({
        oscillator: { type: "triangle" },
        envelope: { attack: 0.06, decay: 0.1, sustain: 0.9, release: 0.8 },
        portamento: 0.08,
      }),
  },
  bell: {
    label: "FM bell",
    volume: 0,
    create: () =>
      new Tone.FMSynth({
        harmonicity: 3,
        modulationIndex: 10,
        envelope: { attack: 0.005, decay: 0.6, sustain: 0.25, release: 1.4 },
        modulationEnvelope: { attack: 0.005, decay: 0.4, sustain: 0.2, release: 0.8 },
        portamento: 0.03,
      }),
  },
  chip: {
    label: "Chiptune",
    volume: 0,
    create: () =>
      new Tone.Synth({
        oscillator: { type: "square" },
        envelope: { attack: 0.005, decay: 0.1, sustain: 0.7, release: 0.25 },
        portamento: 0.02,
      }),
  },
  epiano: {
    label: "Electric piano",
    volume: -1,
    retrigger: true,
    create: () =>
      new Tone.FMSynth({
        harmonicity: 1,
        modulationIndex: 3.5,
        envelope: { attack: 0.004, decay: 1.4, sustain: 0.35, release: 0.9 },
        modulationEnvelope: { attack: 0.002, decay: 0.35, sustain: 0.1, release: 0.6 },
      }),
  },
  organ: {
    label: "Organ",
    volume: -3,
    create: () =>
      new Tone.Synth({
        oscillator: { type: "custom", partials: [1, 0.7, 0.5, 0.45, 0, 0.25, 0, 0.2] },
        envelope: { attack: 0.01, decay: 0.05, sustain: 1, release: 0.15 },
        portamento: 0.02,
      }),
  },
  strings: {
    label: "Strings",
    volume: 0,
    create: () =>
      new Tone.Synth({
        oscillator: { type: "fatsawtooth", count: 3, spread: 22 },
        envelope: { attack: 0.35, decay: 0.3, sustain: 0.9, release: 1.2 },
        portamento: 0.12,
      }),
  },
  brass: {
    label: "Synth brass",
    volume: 0,
    create: () =>
      new Tone.MonoSynth({
        oscillator: { type: "sawtooth" },
        filter: { type: "lowpass", Q: 2, rolloff: -24 },
        envelope: { attack: 0.04, decay: 0.2, sustain: 0.8, release: 0.3 },
        filterEnvelope: { attack: 0.06, decay: 0.25, sustain: 0.5, release: 0.3, baseFrequency: 300, octaves: 3.5 },
        portamento: 0.04,
      }),
  },
  marimba: {
    label: "Marimba",
    volume: 2,
    retrigger: true,
    create: () =>
      new Tone.FMSynth({
        harmonicity: 4,
        modulationIndex: 2,
        envelope: { attack: 0.002, decay: 0.7, sustain: 0, release: 0.4 },
        modulationEnvelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.1 },
      }),
  },
  pluck: {
    label: "Synth pluck",
    volume: 1,
    retrigger: true,
    create: () =>
      new Tone.MonoSynth({
        oscillator: { type: "sawtooth" },
        envelope: { attack: 0.002, decay: 0.4, sustain: 0.15, release: 0.5 },
        filterEnvelope: { attack: 0.001, decay: 0.18, sustain: 0.05, release: 0.3, baseFrequency: 300, octaves: 4.5 },
      }),
  },
  wave: {
    label: "Synthwave",
    volume: -4,
    create: () =>
      new Tone.DuoSynth({
        harmonicity: 1.005, // slight detune between the two voices
        vibratoAmount: 0.4,
        vibratoRate: 5.5,
        voice0: {
          oscillator: { type: "sawtooth" },
          envelope: { attack: 0.02, decay: 0.3, sustain: 0.8, release: 0.6 },
          filterEnvelope: { attack: 0.02, decay: 0.4, sustain: 0.7, release: 0.6, baseFrequency: 600, octaves: 2.5 },
        },
        voice1: {
          oscillator: { type: "square" },
          envelope: { attack: 0.02, decay: 0.3, sustain: 0.8, release: 0.6 },
          filterEnvelope: { attack: 0.02, decay: 0.4, sustain: 0.7, release: 0.6, baseFrequency: 600, octaves: 2.5 },
        },
        portamento: 0.06,
      }),
  },
} satisfies Record<string, LeadPreset>;
export type LeadId = keyof typeof LEAD_PRESETS;

export const CHORD_STYLES = { pad: "Pad", strum: "Strum", arp: "Arpeggio" };
export type ChordStyle = keyof typeof CHORD_STYLES;

// Each chord sound has a sustained voice (pad style, arp bass) and a plucked one (strum, arp notes).
interface ChordSound {
  label: string;
  pad: () => Chord;
  pluck: () => Chord;
}

const ORGAN_PARTIALS = [1, 0.7, 0.5, 0.45, 0, 0.25, 0, 0.2];

export const CHORD_SOUNDS = {
  warm: {
    label: "Warm pad",
    pad: () =>
      new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "fatsawtooth", count: 3, spread: 24 },
        envelope: { attack: 0.35, decay: 0.4, sustain: 0.8, release: 1.6 },
        volume: -20,
      }),
    pluck: () =>
      new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle" },
        envelope: { attack: 0.005, decay: 0.25, sustain: 0.1, release: 0.4 },
        volume: -10,
      }),
  },
  epiano: {
    label: "Electric piano",
    pad: () =>
      new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 1,
        modulationIndex: 3,
        envelope: { attack: 0.005, decay: 1.8, sustain: 0.4, release: 1.2 },
        modulationEnvelope: { attack: 0.002, decay: 0.4, sustain: 0.1, release: 0.8 },
        volume: -24,
      }),
    pluck: () =>
      new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 1,
        modulationIndex: 3.5,
        envelope: { attack: 0.004, decay: 0.9, sustain: 0.1, release: 0.6 },
        modulationEnvelope: { attack: 0.002, decay: 0.25, sustain: 0.05, release: 0.4 },
        volume: -14,
      }),
  },
  organ: {
    label: "Organ",
    pad: () =>
      new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "custom", partials: ORGAN_PARTIALS },
        envelope: { attack: 0.02, decay: 0.05, sustain: 1, release: 0.25 },
        volume: -25,
      }),
    pluck: () =>
      new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "custom", partials: ORGAN_PARTIALS },
        envelope: { attack: 0.005, decay: 0.25, sustain: 0.3, release: 0.15 },
        volume: -13,
      }),
  },
  strings: {
    label: "Strings",
    pad: () =>
      new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "fatsawtooth", count: 3, spread: 40 },
        envelope: { attack: 0.6, decay: 0.5, sustain: 0.9, release: 2 },
        volume: -21,
      }),
    pluck: () =>
      // pizzicato
      new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "sawtooth" },
        envelope: { attack: 0.004, decay: 0.2, sustain: 0, release: 0.2 },
        volume: -13,
      }),
  },
  glass: {
    label: "Glassy bell",
    pad: () =>
      new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 2,
        modulationIndex: 1.5,
        envelope: { attack: 0.2, decay: 2, sustain: 0.5, release: 2.5 },
        modulationEnvelope: { attack: 0.3, decay: 1.5, sustain: 0.4, release: 2 },
        volume: -25,
      }),
    pluck: () =>
      new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3.5,
        modulationIndex: 6,
        envelope: { attack: 0.002, decay: 1.2, sustain: 0, release: 1.2 },
        modulationEnvelope: { attack: 0.002, decay: 0.5, sustain: 0, release: 0.8 },
        volume: -15,
      }),
  },
  guitar: {
    label: "Acoustic guitar",
    pad: () =>
      // let-ring chord
      new Tone.PolySynth(Tone.MonoSynth, {
        oscillator: { type: "sawtooth" },
        envelope: { attack: 0.003, decay: 3, sustain: 0, release: 1 },
        filterEnvelope: { attack: 0.001, decay: 1, sustain: 0.1, release: 1, baseFrequency: 200, octaves: 4 },
        volume: -17,
      }),
    pluck: () =>
      new Tone.PolySynth(Tone.MonoSynth, {
        oscillator: { type: "sawtooth" },
        envelope: { attack: 0.002, decay: 1.2, sustain: 0, release: 0.6 },
        filterEnvelope: { attack: 0.001, decay: 0.3, sustain: 0.1, release: 0.5, baseFrequency: 200, octaves: 4 },
        volume: -12,
      }),
  },
  lofi: {
    label: "Lo-fi keys",
    pad: () =>
      new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "fattriangle", count: 2, spread: 18 },
        envelope: { attack: 0.01, decay: 1.5, sustain: 0.45, release: 1.2 },
        volume: -19,
      }),
    pluck: () =>
      new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "fattriangle", count: 2, spread: 18 },
        envelope: { attack: 0.005, decay: 0.6, sustain: 0.1, release: 0.6 },
        volume: -6,
      }),
  },
  chip: {
    label: "8-bit",
    pad: () =>
      new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "square" },
        envelope: { attack: 0.005, decay: 0.1, sustain: 0.8, release: 0.1 },
        volume: -28,
      }),
    pluck: () =>
      new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "pulse", width: 0.25 },
        envelope: { attack: 0.002, decay: 0.12, sustain: 0, release: 0.08 },
        volume: -16,
      }),
  },
} satisfies Record<string, ChordSound>;
export type ChordSoundId = keyof typeof CHORD_SOUNDS;

// 16 steps per bar: kick / snare / hat, plus optional clap / open hat / rim and 16th swing (0..1).
interface DrumPattern {
  label: string;
  k: string;
  s: string;
  h: string;
  c?: string;
  o?: string;
  r?: string;
  swing?: number;
}

export const DRUM_PATTERNS = {
  off: { label: "No beat", k: "", s: "", h: "" },
  four: { label: "Four on the floor", k: "x...x...x...x...", s: "....x.......x...", h: "..x...x...x...x." },
  boombap: { label: "Boom bap", k: "x......x..x.....", s: "....x.......x...", h: "x.x.x.x.x.x.x.x." },
  halftime: { label: "Half-time", k: "x.........x.....", s: "........x.......", h: "x.x.x.x.x.x.x.xx" },
  lofi: {
    label: "Lo-fi swing",
    k: "x.......x.x.....",
    s: "....x.......x...",
    h: "x.x.x.x.x.x.x.x.",
    swing: 0.35,
  },
  trap: {
    label: "Trap",
    k: "x.....x...x.....",
    s: "........x.......",
    c: "........x.......",
    h: "x.x.xxx.x.x.xxxx",
  },
  dembow: {
    label: "Reggaeton",
    k: "x...x...x...x...",
    s: "...x..x....x..x.",
    h: "x.x.x.x.x.x.x.x.",
  },
  rock: { label: "Rock", k: "x.......x.x.....", s: "....x.......x...", h: "x.x.x.x.x.x.x.x." },
  disco: {
    label: "Disco",
    k: "x...x...x...x...",
    s: "....x.......x...",
    c: "....x.......x...",
    h: "x...x...x...x...",
    o: "..x...x...x...x.",
  },
  bossa: {
    label: "Bossa nova",
    k: "x..xx..xx..xx..x",
    s: "",
    h: "x.x.x.x.x.x.x.x.",
    r: "x..x..x...x..x..",
  },
  afro: {
    label: "Afrobeat",
    k: "x.....x...x.....",
    s: "",
    c: "....x.......x...",
    h: "x.xxx.xxx.xxx.xx",
    r: "...x..x....x..x.",
    swing: 0.12,
  },
} satisfies Record<string, DrumPattern>;
export type DrumPatternId = keyof typeof DRUM_PATTERNS;

export interface StylePreset {
  label: string;
  lead: LeadId;
  chordSound: ChordSoundId;
  chordStyle: ChordStyle;
  pattern: DrumPatternId;
  bpm: number;
  reverb: number;
  delay: number;
}

export const STYLES = {
  original: {
    label: "Original",
    lead: "saw",
    chordSound: "warm",
    chordStyle: "pad",
    pattern: "off",
    bpm: 96,
    reverb: 0.3,
    delay: 0.2,
  },
  lofi: {
    label: "Lo-fi chill",
    lead: "epiano",
    chordSound: "lofi",
    chordStyle: "pad",
    pattern: "lofi",
    bpm: 82,
    reverb: 0.35,
    delay: 0.25,
  },
  synthwave: {
    label: "Synthwave",
    lead: "wave",
    chordSound: "warm",
    chordStyle: "arp",
    pattern: "four",
    bpm: 100,
    reverb: 0.45,
    delay: 0.35,
  },
  arcade: {
    label: "8-bit arcade",
    lead: "chip",
    chordSound: "chip",
    chordStyle: "arp",
    pattern: "rock",
    bpm: 140,
    reverb: 0.1,
    delay: 0.15,
  },
  ambient: {
    label: "Ambient dream",
    lead: "bell",
    chordSound: "glass",
    chordStyle: "pad",
    pattern: "off",
    bpm: 70,
    reverb: 0.7,
    delay: 0.45,
  },
  campfire: {
    label: "Acoustic campfire",
    lead: "soft",
    chordSound: "guitar",
    chordStyle: "strum",
    pattern: "bossa",
    bpm: 110,
    reverb: 0.2,
    delay: 0.1,
  },
  trap: {
    label: "Trap",
    lead: "bell",
    chordSound: "strings",
    chordStyle: "pad",
    pattern: "trap",
    bpm: 140,
    reverb: 0.25,
    delay: 0.3,
  },
  reggaeton: {
    label: "Reggaeton",
    lead: "pluck",
    chordSound: "epiano",
    chordStyle: "strum",
    pattern: "dembow",
    bpm: 95,
    reverb: 0.2,
    delay: 0.15,
  },
  disco: {
    label: "Disco funk",
    lead: "brass",
    chordSound: "strings",
    chordStyle: "strum",
    pattern: "disco",
    bpm: 118,
    reverb: 0.25,
    delay: 0.15,
  },
  afro: {
    label: "Afro island",
    lead: "marimba",
    chordSound: "guitar",
    chordStyle: "arp",
    pattern: "afro",
    bpm: 104,
    reverb: 0.25,
    delay: 0.2,
  },
  church: {
    label: "Church organ",
    lead: "organ",
    chordSound: "organ",
    chordStyle: "pad",
    pattern: "off",
    bpm: 72,
    reverb: 0.65,
    delay: 0.05,
  },
} satisfies Record<string, StylePreset>;
export type StyleId = keyof typeof STYLES;

const note = (midi: number) => Tone.Frequency(midi, "midi").toNote();
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

const STRUM_RELEASE = 0.06; // s; re-striking or muting cuts the last strum this fast
const STRUM_RING_MS = 2000; // an air guitar strum rings this long unless struck again
// s, first string to last. PolySynth holds back attacks past its 0.1 s look-ahead, and releaseAll can't reach
// those, so every string of a strum must start inside it.
const MAX_STRUM_SPREAD = 0.08;

/** Seconds from a strum's first string to its last: 8–30 ms a string, tighter for a hard (fast) strum. */
export const strumSpread = (velocity: number, strings: number) =>
  Math.min(Math.max(strings - 1, 0) * (0.03 - 0.022 * clamp01((velocity - 0.35) / 0.65)), MAX_STRUM_SPREAD);

export class AudioEngine {
  private master = new Tone.Limiter(-1).toDestination();
  private reverb = new Tone.Reverb({ decay: 4, wet: 0.3 }).connect(this.master);
  private delay = new Tone.FeedbackDelay({ delayTime: "8n", feedback: 0.3, wet: 0.2 }).connect(this.reverb);

  private leadFilter = new Tone.Filter({ type: "lowpass", frequency: 2000, Q: 1 }).connect(this.delay);
  private lead: Lead;
  private leadRetrigger = false;
  private leadPlaying = false;

  private padFilter = new Tone.Filter({ type: "lowpass", frequency: 1500, Q: 0.7 }).connect(this.reverb);
  private pad: Chord;
  private pluck: Chord;
  // Air guitar strums get their own copy of the plucked voice with a short release, so muting is quick.
  private strummer: Chord;
  private strumEnd = 0; // when the last strum's top string sounds
  private ringTimer = 0;
  private deadAt = 0; // when the last dead strum started; a noise source can't restart at the same time
  private deadString = new Tone.NoiseSynth({
    noise: { type: "pink" },
    envelope: { attack: 0.001, decay: 0.03, sustain: 0 },
    volume: -20,
  }).connect(new Tone.Filter({ type: "bandpass", frequency: 2200, Q: 1.2 }).connect(this.padFilter));
  private chordStyle: ChordStyle = "pad";
  private heldChord: number[] = [];
  private arpNotes: number[] = [];
  private arpIndex = 0;

  private drumBus = new Tone.Volume(-6).connect(this.master);
  private kick = new Tone.MembraneSynth({
    pitchDecay: 0.04,
    octaves: 6,
    envelope: { attack: 0.001, decay: 0.4, sustain: 0 },
  }).connect(this.drumBus);
  private snare = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.18, sustain: 0 },
    volume: -8,
  }).connect(new Tone.Filter(1800, "highpass").connect(this.drumBus));
  private hat = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.04, sustain: 0 },
    volume: -14,
  }).connect(new Tone.Filter(8000, "highpass").connect(this.drumBus));
  private clap = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.14, sustain: 0, release: 0.1 },
    volume: -6,
  }).connect(new Tone.Filter({ type: "bandpass", frequency: 1200, Q: 0.8 }).connect(this.drumBus));
  private openHat = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.28, sustain: 0, release: 0.1 },
    volume: -17,
  }).connect(new Tone.Filter(7000, "highpass").connect(this.drumBus));
  private rim = new Tone.MembraneSynth({
    pitchDecay: 0.005,
    octaves: 2,
    envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05 },
    volume: -10,
  }).connect(this.drumBus);
  private pattern: DrumPatternId = "off";

  private recorder = Tone.Recorder.supported ? new Tone.Recorder() : null;
  recording = false;

  constructor(leadId: LeadId) {
    this.lead = this.makeLead(leadId);
    [this.pad, this.pluck, this.strummer] = this.makeChordVoices("warm");
    if (this.recorder) this.master.connect(this.recorder);

    const transport = Tone.getTransport();
    transport.bpm.value = 96;
    transport.swingSubdivision = "16n";

    new Tone.Sequence(
      (time, step: number) => {
        const p: DrumPattern = DRUM_PATTERNS[this.pattern];
        if (p.k[step] === "x") this.kick.triggerAttackRelease("C1", "8n", time);
        if (p.s[step] === "x") this.snare.triggerAttackRelease("16n", time);
        if (p.h[step] === "x") this.hat.triggerAttackRelease("32n", time);
        if (p.o?.[step] === "x") this.openHat.triggerAttackRelease("8n", time);
        if (p.r?.[step] === "x") this.rim.triggerAttackRelease("E5", "32n", time);
        // a clap is a few noise bursts in quick succession
        if (p.c?.[step] === "x") [0, 0.011, 0.022].forEach((d) => this.clap.triggerAttackRelease(0.01, time + d));
      },
      [...Array(16).keys()],
      "16n",
    ).start(0);

    new Tone.Loop((time) => {
      if (!this.arpNotes.length) return;
      const midi = this.arpNotes[this.arpIndex++ % this.arpNotes.length];
      this.pluck.triggerAttackRelease(note(midi), "16n", time, 0.8);
    }, "16n").start(0);

    transport.start();
  }

  // Live gestures use Tone.immediate() so they skip the scheduler's look-ahead latency.

  leadOn(midi: number) {
    this.lead.triggerAttack(note(midi), Tone.immediate());
    this.leadPlaying = true;
  }

  leadGlide(midi: number) {
    if (this.leadRetrigger) this.lead.triggerAttack(note(midi), Tone.immediate());
    else this.lead.setNote(note(midi), Tone.immediate());
  }

  leadOff() {
    if (!this.leadPlaying) return;
    this.lead.triggerRelease(Tone.immediate());
    this.leadPlaying = false;
  }

  setLead(id: LeadId) {
    this.leadOff();
    const old = this.lead;
    this.lead = this.makeLead(id);
    setTimeout(() => old.dispose(), 2000); // let its release tail ring out
  }

  /** 0 = dark, 1 = bright. */
  setLeadBrightness(amount: number) {
    this.leadFilter.frequency.rampTo(250 * Math.pow(32, amount), 0.05);
  }

  chordOn(notes: number[]) {
    this.chordOff();
    const now = Tone.immediate();
    if (this.chordStyle === "pad") {
      this.pad.triggerAttack(notes.map(note), now);
      this.heldChord = notes;
    } else if (this.chordStyle === "strum") {
      notes.forEach((m, i) => this.pluck.triggerAttackRelease(note(m), "2n", now + i * 0.035, 0.9));
    } else {
      const [bass, ...upper] = notes;
      this.pad.triggerAttack(note(bass), now);
      this.heldChord = [bass];
      this.arpNotes = [...upper, ...upper.map((m) => m + 12)];
      this.arpIndex = 0;
    }
  }

  chordOff() {
    if (this.heldChord.length) this.pad.triggerRelease(this.heldChord.map(note), Tone.immediate());
    this.heldChord = [];
    this.arpNotes = [];
  }

  /** Air guitar: strikes the chord's strings one by one, low to high on a down strum. velocity 0..1. */
  strum(notes: number[], direction: "down" | "up", velocity: number) {
    if (!this.running) return;
    const now = Tone.immediate();
    this.releaseStrum(now);
    const order = [...notes].sort((a, b) => a - b);
    if (direction === "up") order.reverse();
    const gap = order.length > 1 ? strumSpread(velocity, order.length) / (order.length - 1) : 0;
    order.forEach((m, i) => this.strummer.triggerAttack(note(m), now + i * gap, velocity));
    this.strumEnd = now + (order.length - 1) * gap;
    this.ringTimer = window.setTimeout(() => this.mute(), STRUM_RING_MS);
  }

  /** A strum with no chord held: a short scratch of muted strings. */
  deadStrum(velocity: number) {
    if (!this.running) return;
    this.deadAt = Math.max(Tone.immediate(), this.deadAt + 0.001);
    this.deadString.triggerAttackRelease(0.03, this.deadAt, velocity);
  }

  // A suspended context's clock stands still, so sources struck twice would start at the same time and throw.
  private get running() {
    return Tone.getContext().state === "running";
  }

  /** Stops the strummed strings ringing. */
  mute() {
    this.releaseStrum(Tone.immediate());
  }

  private releaseStrum(now: number) {
    clearTimeout(this.ringTimer);
    // not before the last strum's final string starts, or that note would hang on; strumSpread keeps every
    // string inside the look-ahead, so all of them are active voices by now
    this.strummer.releaseAll(Math.max(now, this.strumEnd + 0.005));
  }

  setChordStyle(style: ChordStyle) {
    this.chordOff();
    this.chordStyle = style;
  }

  setChordSound(id: ChordSoundId) {
    this.chordOff();
    this.mute();
    const old = [this.pad, this.pluck, this.strummer];
    [this.pad, this.pluck, this.strummer] = this.makeChordVoices(id);
    setTimeout(() => old.forEach((s) => s.dispose()), 4000); // let release tails and strums ring out
  }

  /** 0 = dark, 1 = bright. */
  setChordBrightness(amount: number) {
    this.padFilter.frequency.rampTo(300 * Math.pow(20, amount), 0.05);
  }

  setPattern(id: DrumPatternId) {
    this.pattern = id;
    const p: DrumPattern = DRUM_PATTERNS[id];
    Tone.getTransport().swing = p.swing ?? 0;
  }

  setBpm(bpm: number) {
    Tone.getTransport().bpm.rampTo(bpm, 0.2);
  }

  /** Wet amounts 0..1. */
  setSpace(reverbWet: number, delayWet: number) {
    this.reverb.wet.rampTo(clamp01(reverbWet), 0.3);
    this.delay.wet.rampTo(clamp01(delayWet), 0.3);
  }

  applyStyle(id: StyleId) {
    const s: StylePreset = STYLES[id];
    this.setLead(s.lead);
    this.setChordSound(s.chordSound);
    this.setChordStyle(s.chordStyle);
    this.setPattern(s.pattern);
    this.setBpm(s.bpm);
    this.setSpace(s.reverb, s.delay);
  }

  get canRecord() {
    return this.recorder !== null;
  }

  startRecording() {
    if (!this.recorder || this.recording) return;
    this.recorder.start();
    this.recording = true;
  }

  async stopRecording(): Promise<Blob | null> {
    if (!this.recorder || !this.recording) return null;
    this.recording = false;
    return this.recorder.stop();
  }

  private makeLead(id: LeadId): Lead {
    const preset: LeadPreset = LEAD_PRESETS[id];
    const lead = preset.create();
    lead.volume.value = -8 + preset.volume;
    this.leadRetrigger = preset.retrigger ?? false;
    return lead.connect(this.leadFilter);
  }

  private makeChordVoices(id: ChordSoundId): [Chord, Chord, Chord] {
    const sound: ChordSound = CHORD_SOUNDS[id];
    const strummer = sound.pluck().set({ envelope: { release: STRUM_RELEASE } });
    return [sound.pad(), sound.pluck(), strummer].map((s) => s.connect(this.padFilter)) as [Chord, Chord, Chord];
  }
}
