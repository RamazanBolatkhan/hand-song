// Air guitar chord signs: one fixed left-hand shape per chord, and fitting songs onto those chords.

import { NOTE_NAMES } from "./music";
import type { Song, SongStep } from "./songs";

export interface ChordSign {
  pattern: string; // thumb, index, middle, ring, pinky; 1 = raised
  chord: string;
  label: string;
  emoji?: string;
}

// The commonest chords sit on thumb-free shapes, since the thumb is the finger tracking reads worst.
// E/Em, C/Dm, G/Bm and A/fist differ only by the thumb, so a misread thumb swaps them; THUMB_EXTENDED in
// hands.ts is the knob to tune.
export const SIGNS: ChordSign[] = [
  { pattern: "01000", chord: "C", label: "Index", emoji: "☝️" },
  { pattern: "01100", chord: "G", label: "Index + middle", emoji: "✌️" },
  { pattern: "01110", chord: "D", label: "Three fingers" },
  { pattern: "01111", chord: "Em", label: "Four fingers, thumb tucked" },
  { pattern: "01001", chord: "Am", label: "Index + pinky", emoji: "🤘" },
  { pattern: "10001", chord: "F", label: "Thumb + pinky", emoji: "🤙" },
  { pattern: "10000", chord: "A", label: "Thumb", emoji: "👍" },
  { pattern: "11111", chord: "E", label: "Open hand", emoji: "🖐" },
  { pattern: "11000", chord: "Dm", label: "L shape: thumb + index" },
  { pattern: "11100", chord: "Bm", label: "Thumb + index + middle" },
];

/** A fist stops the ringing strings. */
export const MUTE_SIGN: ChordSign = { pattern: "00000", chord: "mute", label: "Fist", emoji: "✊" };

const patternOf = (raised: boolean[]) => raised.map((r) => (r ? "1" : "0")).join("");

/** The chord a hand shape asks for, "mute" for a fist, null for shapes that aren't a sign. */
export function signChord(raised: boolean[]): string | null {
  const pattern = patternOf(raised);
  if (pattern === MUTE_SIGN.pattern) return MUTE_SIGN.chord;
  return SIGNS.find((s) => s.pattern === pattern)?.chord ?? null;
}

export const chordSign = (chord: string) => SIGNS.find((s) => s.chord === chord);

export interface SignState {
  sign: string | null; // the settled sign: a chord, "mute", or null for none
  candidate: string | null; // what the hand shows now
  candidateSince: number;
}

/**
 * Feeds one frame of the left hand: `shown` is signChord's reading, undefined when no hand is in view.
 * A new sign settles once the hand has shown it for `settleMs`. Shapes that aren't a sign (often a hand on its
 * way between two) leave the candidate and its timer alone, but can't settle it. Returns true if the sign changed.
 */
export function settleSign(s: SignState, shown: string | null | undefined, now: number, settleMs: number) {
  if (shown !== null && (shown ?? null) !== s.candidate) {
    s.candidate = shown ?? null;
    s.candidateSince = now;
  }
  if (s.candidate === s.sign) return false;
  if (shown !== undefined && (shown !== s.candidate || now - s.candidateSince < settleMs)) return false;
  s.sign = s.candidate;
  return true;
}

// Every chord is cut down to a triad: extensions drop to major or minor. dim plays as its minor triad
// and aug as its major one, so they only fit when that triad lands on a sign.
const TRIADS: Record<string, string> = {
  "": "",
  "7": "",
  maj7: "",
  "6": "",
  sus2: "",
  sus4: "",
  "7sus4": "",
  add9: "",
  "5": "",
  aug: "",
  m: "m",
  m7: "m",
  m6: "m",
  dim: "m",
};
const ACCIDENTALS: Record<string, number> = { "": 0, "#": 1, b: -1 };
const SIGN_CHORDS = new Set(SIGNS.map((s) => s.chord));
const SHIFTS = [0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5, 6]; // smallest move first, down before up

/** The chord as a triad, moved by `shift` semitones: ("A7sus4", -2) → "G". Null for names it can't read. */
function simplify(name: string, shift: number): string | null {
  const match = /^([A-G])([#b]?)([^/]*)(\/.*)?$/.exec(name); // a slash bass is dropped
  if (!match || !Object.hasOwn(TRIADS, match[3])) return null;
  const pc = (NOTE_NAMES.indexOf(match[1]) + ACCIDENTALS[match[2]] + shift + 24) % 12;
  return NOTE_NAMES[pc] + TRIADS[match[3]];
}

/**
 * The song with every chord simplified to a triad and moved by the smallest transposition that gives each
 * one a sign; null if none does. Steps that end up on the same chord merge, except across a section start.
 */
export function fitSongToSigns(song: Song): { song: Song; transpose: number } | null {
  for (const transpose of SHIFTS) {
    const chords = song.steps.map((s) => simplify(s.chord, transpose));
    if (chords.some((c) => c === null || !SIGN_CHORDS.has(c))) continue;

    const steps: SongStep[] = [];
    song.steps.forEach((step, i) => {
      const chord = chords[i]!;
      const prev = steps[steps.length - 1];
      if (prev?.chord !== chord || step.section) {
        steps.push({ ...step, chord });
        return;
      }
      prev.beats += step.beats;
      if (step.lyric) prev.lyric = prev.lyric ? `${prev.lyric} ${step.lyric}` : step.lyric;
    });
    const key = (song.key + transpose + 12) % 12;
    return { song: { ...song, key, palette: [...new Set(steps.map((s) => s.chord))], steps }, transpose };
  }
  return null;
}
