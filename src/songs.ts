// Song library: chord progressions to follow with the left hand, one finger per palette chord.

import { parseChord, type Chord, type ScaleId } from "./music";

export interface SongStep {
  chord: string;
  beats: number;
  section?: string; // set on the first step of a section
  lyric?: string; // words sung over this step (public-domain songs only)
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  key: number; // 0–11, C = 0; key of the melody hand
  scale: ScaleId;
  bpm: number;
  palette: string[]; // unique chords in order of first appearance; finger n plays palette[n - 1]
  steps: SongStep[];
}

/** Steps from "C G:2 Am" (beats default to 4); the section marks the first one. */
function prog(section: string, chords: string): SongStep[] {
  return chords.split(/\s+/).map((token, i) => {
    const [chord, beats] = token.split(":");
    return { chord, beats: beats ? Number(beats) : 4, ...(i === 0 && { section }) };
  });
}

/** Merges back-to-back steps on the same chord and derives the palette. */
function defineSong(def: Omit<Song, "palette">): Song {
  const steps: SongStep[] = [];
  for (const step of def.steps) {
    const prev = steps[steps.length - 1];
    // A new section always starts its own step, so its label shows up on time.
    if (prev?.chord !== step.chord || step.section) {
      steps.push({ ...step });
      continue;
    }
    prev.beats += step.beats;
    if (step.lyric) prev.lyric = prev.lyric ? `${prev.lyric} ${step.lyric}` : step.lyric;
  }
  const palette = [...new Set(steps.map((s) => s.chord))];
  if (palette.length > 5) throw new Error(`"${def.title}" uses ${palette.length} chords; one hand can only show 5`);
  return { ...def, palette, steps };
}

export const SONGS: Song[] = [
  defineSong({
    id: "let-it-be",
    title: "Let It Be",
    artist: "The Beatles",
    key: 0,
    scale: "major",
    bpm: 72,
    steps: [
      ...prog("Verse", "C:2 G:2 Am:2 F:2 C:2 G:2 F:2 C:2 C:2 G:2 Am:2 F:2 C:2 G:2 F:2 C:2"),
      ...prog("Chorus", "Am:2 G:2 F:2 C:2 C:2 G:2 F:2 C:2"),
    ],
  }),
  defineSong({
    id: "someone-like-you",
    title: "Someone Like You",
    artist: "Adele",
    key: 9,
    scale: "major",
    bpm: 68,
    steps: [
      ...prog("Verse", "A C#m F#m D A C#m F#m D"),
      ...prog("Pre-Chorus", "E F#m D:8 E F#m D E:8"),
      ...prog("Chorus", "A E F#m D A E F#m D"),
    ],
  }),
  defineSong({
    id: "perfect",
    title: "Perfect",
    artist: "Ed Sheeran",
    key: 7,
    scale: "major",
    bpm: 63,
    steps: [
      ...prog("Verse", "G Em C D G Em C D"),
      ...prog("Pre-Chorus", "Em C G D Em C G D"),
      ...prog("Chorus", "G Em C D G Em C D"),
    ],
  }),
  defineSong({
    id: "stand-by-me",
    title: "Stand By Me",
    artist: "Ben E. King",
    key: 9,
    scale: "major",
    bpm: 118,
    steps: [
      ...prog("Verse", "A:8 F#m:8 D E A:8 F#m:8 D E A:8"),
      ...prog("Chorus", "A:8 F#m:8 D E A:8 F#m:8 D E A:8"),
    ],
  }),
  defineSong({
    id: "knockin-on-heavens-door",
    title: "Knockin' on Heaven's Door",
    artist: "Bob Dylan",
    key: 7,
    scale: "major",
    bpm: 69,
    steps: [
      ...prog("Verse", "G:2 D:2 Am G:2 D:2 C G:2 D:2 Am G:2 D:2 C"),
      ...prog("Chorus", "G:2 D:2 Am G:2 D:2 C G:2 D:2 Am G:2 D:2 C"),
    ],
  }),
  defineSong({
    id: "wonderwall",
    title: "Wonderwall",
    artist: "Oasis",
    key: 4,
    scale: "minor",
    bpm: 87,
    steps: [
      ...prog("Verse", "Em7:2 G:2 Dsus4:2 A7sus4:2 Em7:2 G:2 Dsus4:2 A7sus4:2"),
      ...prog("Pre-Chorus", "Cadd9:2 Dsus4:2 Em7 Cadd9:2 Dsus4:2 Em7 Cadd9:2 Dsus4:2 A7sus4"),
      ...prog("Chorus", "Cadd9:2 Em7:2 G:2 Em7:2 Cadd9:2 Em7:2 G:2 Em7:2"),
    ],
  }),
  defineSong({
    id: "hallelujah",
    title: "Hallelujah",
    artist: "Leonard Cohen",
    key: 0,
    scale: "major",
    bpm: 56,
    steps: [
      ...prog("Verse", "C Am C Am F G C G C F G Am F G E Am"),
      ...prog("Chorus", "F Am F C G C G F Am F C G C"),
    ],
  }),
  defineSong({
    id: "zombie",
    title: "Zombie",
    artist: "The Cranberries",
    key: 4,
    scale: "minor",
    bpm: 84,
    steps: [...prog("Verse", "Em C G D Em C G D"), ...prog("Chorus", "Em C G D Em C G D")],
  }),
  defineSong({
    id: "despacito",
    title: "Despacito",
    artist: "Luis Fonsi ft. Daddy Yankee",
    key: 11,
    scale: "minor",
    bpm: 89,
    steps: [
      ...prog("Verse", "Bm G D A Bm G D A"),
      ...prog("Pre-Chorus", "Bm G D A"),
      ...prog("Chorus", "Bm G D A Bm G D A"),
    ],
  }),
  defineSong({
    id: "shape-of-you",
    title: "Shape of You",
    artist: "Ed Sheeran",
    key: 1,
    scale: "minor",
    bpm: 96,
    steps: [
      ...prog("Verse", "C#m F#m A B C#m F#m A B"),
      ...prog("Pre-Chorus", "C#m F#m A B"),
      ...prog("Chorus", "C#m F#m A B C#m F#m A B"),
    ],
  }),
  defineSong({
    id: "viva-la-vida",
    title: "Viva la Vida",
    artist: "Coldplay",
    key: 7,
    scale: "major",
    bpm: 138,
    steps: [
      ...prog("Verse", "C D G Em C D G Em C D G Em"),
      ...prog("Chorus", "C D G Em C D B Em C D G Em C D B Em"),
    ],
  }),
  defineSong({
    id: "house-of-the-rising-sun",
    title: "House of the Rising Sun",
    artist: "Traditional (The Animals arrangement)",
    key: 9,
    scale: "minor",
    bpm: 120,
    steps: [
      ...prog("Verse", "Am:3 C:3 D:3 F:3 Am:3 C:3 E:6 Am:3 C:3 D:3 F:3 Am:3 E:3 Am:3 E:3"),
      ...prog("Verse 2", "Am:3 C:3 D:3 F:3 Am:3 C:3 E:6 Am:3 C:3 D:3 F:3 Am:3 E:3 Am:6"),
    ],
  }),
  defineSong({
    id: "happy-birthday",
    title: "Happy Birthday to You",
    artist: "Traditional",
    key: 0,
    scale: "major",
    bpm: 100,
    steps: [
      { chord: "C", beats: 4, section: "Verse", lyric: "Happy birthday to" },
      { chord: "G7", beats: 6, lyric: "you, happy birthday to" },
      { chord: "C", beats: 3, lyric: "you, happy" },
      { chord: "C7", beats: 3, lyric: "birthday dear" },
      { chord: "F", beats: 3, lyric: "(name), happy" },
      { chord: "C", beats: 2, lyric: "birthday" },
      { chord: "G7", beats: 1, lyric: "to" },
      { chord: "C", beats: 3, lyric: "you!" },
    ],
  }),
  defineSong({
    id: "twinkle-twinkle",
    title: "Twinkle, Twinkle, Little Star",
    artist: "Traditional",
    key: 0,
    scale: "major",
    bpm: 100,
    steps: [
      { chord: "C", beats: 4, section: "Verse", lyric: "Twinkle, twinkle," },
      { chord: "F", beats: 2, lyric: "little" },
      { chord: "C", beats: 2, lyric: "star," },
      { chord: "F", beats: 2, lyric: "how I" },
      { chord: "C", beats: 2, lyric: "wonder" },
      { chord: "G", beats: 2, lyric: "what you" },
      { chord: "C", beats: 4, lyric: "are. Up a-" },
      { chord: "F", beats: 2, lyric: "bove the" },
      { chord: "C", beats: 2, lyric: "world so" },
      { chord: "G", beats: 2, lyric: "high," },
      { chord: "C", beats: 2, lyric: "like a" },
      { chord: "F", beats: 2, lyric: "diamond" },
      { chord: "C", beats: 2, lyric: "in the" },
      { chord: "G", beats: 2, lyric: "sky." },
      { chord: "C", beats: 4, lyric: "Twinkle, twinkle," },
      { chord: "F", beats: 2, lyric: "little" },
      { chord: "C", beats: 2, lyric: "star," },
      { chord: "F", beats: 2, lyric: "how I" },
      { chord: "C", beats: 2, lyric: "wonder" },
      { chord: "G", beats: 2, lyric: "what you" },
      { chord: "C", beats: 4, lyric: "are." },
    ],
  }),
  defineSong({
    id: "amazing-grace",
    title: "Amazing Grace",
    artist: "Traditional (John Newton, 1779)",
    key: 7,
    scale: "major",
    bpm: 80,
    steps: [
      { chord: "G", beats: 4, section: "Verse", lyric: "Amazing" },
      { chord: "G7", beats: 3, lyric: "grace, how" },
      { chord: "C", beats: 3, lyric: "sweet the" },
      { chord: "G", beats: 6, lyric: "sound, that saved a" },
      { chord: "Em", beats: 3, lyric: "wretch like" },
      { chord: "D", beats: 6, lyric: "me. I" },
      { chord: "G", beats: 3, lyric: "once was" },
      { chord: "G7", beats: 3, lyric: "lost, but" },
      { chord: "C", beats: 3, lyric: "now am" },
      { chord: "G", beats: 3, lyric: "found, was" },
      { chord: "Em", beats: 3, lyric: "blind, but" },
      { chord: "D", beats: 3, lyric: "now I" },
      { chord: "G", beats: 6, lyric: "see." },
    ],
  }),

  // Justin Bieber: chords only (copyrighted songs, no lyrics), in capo-style open-chord keys.
  defineSong({
    // original E, capo-style in C (capo 4)
    id: "love-yourself",
    title: "Love Yourself",
    artist: "Justin Bieber",
    key: 0,
    scale: "major",
    bpm: 100,
    steps: [
      ...prog("Verse", "C G Am Dm7 C G Am Dm7"),
      ...prog("Chorus", "Am F C:8 Am F C:8"),
    ],
  }),
  defineSong({
    // original Eb (Bb-centred), capo-style in C (capo 3)
    id: "sorry",
    title: "Sorry",
    artist: "Justin Bieber",
    key: 0,
    scale: "major",
    bpm: 100,
    steps: [
      ...prog("Verse", "F Am7 G:8 F Am7 G:8"),
      ...prog("Chorus", "F Am7 G:8 F Am7 G:8"),
    ],
  }),
  defineSong({
    // original Eb, capo-style in C (capo 3)
    id: "baby",
    title: "Baby",
    artist: "Justin Bieber ft. Ludacris",
    key: 0,
    scale: "major",
    bpm: 65,
    steps: [
      ...prog("Verse", "C Am F G C Am F G"),
      ...prog("Chorus", "C Am F G C Am F G"),
    ],
  }),
  defineSong({
    // original C, no transposition
    id: "peaches",
    title: "Peaches",
    artist: "Justin Bieber ft. Daniel Caesar & Giveon",
    key: 0,
    scale: "major",
    bpm: 90,
    steps: [
      ...prog("Verse", "Cmaj7 Fmaj7 Em7 Dm7 Cmaj7 Fmaj7 Em7 Dm7"),
      ...prog("Chorus", "Cmaj7 Fmaj7 Em7 Dm7 Cmaj7 Fmaj7 Em7 Dm7"),
    ],
  }),
  defineSong({
    // original Bbm, capo-style in Am (capo 1)
    id: "stay",
    title: "Stay",
    artist: "Justin Bieber & The Kid LAROI",
    key: 9,
    scale: "minor",
    bpm: 170,
    steps: [
      ...prog("Verse", "F G Am Em F G Am Em"),
      ...prog("Pre-Chorus", "F G Am Em"),
      ...prog("Chorus", "F G Am Em F G Am Em"),
    ],
  }),
  defineSong({
    // original D, no transposition
    id: "ghost",
    title: "Ghost",
    artist: "Justin Bieber",
    key: 2,
    scale: "major",
    bpm: 77,
    steps: [
      ...prog("Verse", "Bm G D A Bm G D A"),
      ...prog("Chorus", "Bm G D A Bm G D A"),
    ],
  }),
  defineSong({
    // original F#, capo-style in D (capo 4)
    id: "holy",
    title: "Holy",
    artist: "Justin Bieber ft. Chance the Rapper",
    key: 2,
    scale: "major",
    bpm: 86,
    steps: [
      ...prog("Verse", "D A Bm7 G D A Bm7 G"),
      ...prog("Chorus", "D A Bm7 G D A Bm7 G"),
    ],
  }),
  defineSong({
    // original Ab, capo-style in G (capo 1)
    id: "what-do-you-mean",
    title: "What Do You Mean?",
    artist: "Justin Bieber",
    key: 7,
    scale: "major",
    bpm: 125,
    steps: [
      ...prog("Verse", "Cadd9 G Em D Cadd9 G Em D"),
      ...prog("Chorus", "Cadd9 G Em D Cadd9 G Em D"),
    ],
  }),
  defineSong({
    // original Bm, capo-style in Am (capo 2)
    id: "lonely",
    title: "Lonely",
    artist: "Justin Bieber & benny blanco",
    key: 9,
    scale: "minor",
    bpm: 80,
    steps: [
      ...prog("Verse", "F Em Am:8 F Em Am:8"),
      ...prog("Chorus", "F G Em F F G Em F"),
    ],
  }),
  defineSong({
    // original A, capo-style in G (capo 2)
    id: "intentions",
    title: "Intentions",
    artist: "Justin Bieber ft. Quavo",
    key: 7,
    scale: "major",
    bpm: 148,
    steps: [
      ...prog("Verse", "Gmaj7:8 Em:8 C:8 Em C Gmaj7:8 Em:8 C:8 Em C"),
      ...prog("Chorus", "Gmaj7:8 Em7:8 C:8 Em7 C Gmaj7:8 Em7:8 C:8 Em7 C"),
    ],
  }),
];

/** The song's palette as playable chords; finger n plays entry n - 1. */
export const songChords = (song: Song): Chord[] => song.palette.map(parseChord);
