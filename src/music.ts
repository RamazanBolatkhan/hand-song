// Music theory helpers: keys, scales, and the notes/chords each hand zone offers.

export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];

interface ScaleDef {
  label: string;
  intervals: number[];
  // 7-note scale the chords are built from, and which of its degrees get a row.
  parent: number[];
  chordDegrees: number[];
}

export const SCALES = {
  major: { label: "Major", intervals: MAJOR, parent: MAJOR, chordDegrees: [0, 1, 2, 3, 4, 5] },
  minor: { label: "Minor", intervals: MINOR, parent: MINOR, chordDegrees: [0, 2, 3, 4, 5, 6] },
  pentaMajor: { label: "Pentatonic major", intervals: [0, 2, 4, 7, 9], parent: MAJOR, chordDegrees: [0, 1, 2, 3, 4, 5] },
  pentaMinor: { label: "Pentatonic minor", intervals: [0, 3, 5, 7, 10], parent: MINOR, chordDegrees: [0, 2, 3, 4, 5, 6] },
  blues: { label: "Blues", intervals: [0, 3, 5, 6, 7, 10], parent: MINOR, chordDegrees: [0, 2, 3, 4, 5, 6] },
  dorian: { label: "Dorian", intervals: DORIAN, parent: DORIAN, chordDegrees: [0, 1, 2, 3, 4, 6] },
} satisfies Record<string, ScaleDef>;

export type ScaleId = keyof typeof SCALES;

export interface MelodyNote {
  midi: number;
  label: string;
}

export interface Chord {
  label: string; // e.g. "IV  F"
  notes: number[]; // midi; first entry is the bass note
}

export const noteName = (midi: number) => NOTE_NAMES[midi % 12] + (Math.floor(midi / 12) - 1);

const melodyBase = (key: number) => 60 + key - (key >= 7 ? 12 : 0);

/** Two octaves of the scale plus the top root, lowest first. */
export function buildMelody(key: number, scale: ScaleId): MelodyNote[] {
  const base = melodyBase(key);
  const { intervals } = SCALES[scale];
  const notes: MelodyNote[] = [];
  for (let octave = 0; octave < 2; octave++) {
    for (const i of intervals) notes.push(toMelodyNote(base + octave * 12 + i));
  }
  notes.push(toMelodyNote(base + 24));
  return notes;
}

const toMelodyNote = (midi: number): MelodyNote => ({ midi, label: noteName(midi) });

/**
 * Notes for finger counting: one five-note set per octave (low, mid, high), lowest first.
 * Finger n plays the scale's nth note, the piano "five-finger position" for 7-note scales.
 */
export function buildFingerOctaves(key: number, scale: ScaleId): MelodyNote[][] {
  const base = melodyBase(key);
  const fingers = SCALES[scale].intervals.slice(0, 5);
  return [0, 1, 2].map((octave) => fingers.map((i) => toMelodyNote(base + octave * 12 + i)));
}

const NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII"];

/** Diatonic triads on the scale's chord degrees, lowest degree first. */
export function buildChords(key: number, scale: ScaleId): Chord[] {
  const { parent, chordDegrees } = SCALES[scale];
  const step = (degree: number) => parent[degree % 7] + 12 * Math.floor(degree / 7);

  return chordDegrees.map((degree) => {
    const third = step(degree + 2) - step(degree);
    const fifth = step(degree + 4) - step(degree);
    const quality = third === 4 ? "" : fifth === 6 ? "dim" : "m";

    const root = 43 + ((key + step(degree) + 5) % 12); // keep roots within G2–F#3
    const numeral = third === 4 ? NUMERALS[degree] : NUMERALS[degree].toLowerCase() + (fifth === 6 ? "°" : "");

    return {
      label: `${numeral}  ${NOTE_NAMES[root % 12]}${quality}`,
      notes: [root - 12, root, root + third, root + fifth],
    };
  });
}

// Chord tones above the root, in semitones, by suffix.
const QUALITIES: Record<string, number[]> = {
  "": [0, 4, 7],
  m: [0, 3, 7],
  "7": [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  "6": [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  "7sus4": [0, 5, 7, 10],
  add9: [0, 4, 7, 14],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  "5": [0, 7],
};

const ACCIDENTALS: Record<string, number> = { "": 0, "#": 1, b: -1 };

/** A chord from its name ("F#m", "Bb", "Cmaj7"), voiced like buildChords. */
export function parseChord(name: string): Chord {
  const match = /^([A-G])([#b]?)(.*)$/.exec(name);
  if (!match || !Object.hasOwn(QUALITIES, match[3])) throw new Error(`Unknown chord "${name}"`);
  const intervals = QUALITIES[match[3]];

  const pc = (NOTE_NAMES.indexOf(match[1]) + ACCIDENTALS[match[2]] + 12) % 12;
  const root = 43 + ((pc + 5) % 12); // keep roots within G2–F#3
  return { label: name, notes: [root - 12, ...intervals.map((i) => root + i)] };
}
