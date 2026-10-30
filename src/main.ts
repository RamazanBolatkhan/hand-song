import "./style.css";
import type { HandLandmarker } from "@mediapipe/tasks-vision";
import * as Tone from "tone";
import {
  AudioEngine,
  CHORD_SOUNDS,
  CHORD_STYLES,
  DRUM_PATTERNS,
  LEAD_PRESETS,
  STYLES,
  type ChordSoundId,
  type ChordStyle,
  type DrumPatternId,
  type LeadId,
  type StyleId,
  type StylePreset,
  strumSpread,
} from "./audio";
import {
  HAND_CONNECTIONS,
  StrumTracker,
  ZoneHand,
  createHandLandmarker,
  readHands,
  splitHands,
  type HandReading,
  type Point,
  type StrumDirection,
} from "./hands";
import { NOTE_NAMES, SCALES, buildChords, buildFingerOctaves, buildMelody, parseChord, type ScaleId } from "./music";
import { MUTE_SIGN, SIGNS, chordSign, fitSongToSigns, settleSign, signChord } from "./signs";
import { SONGS, songChords, type Song, type SongStep } from "./songs";

const MELODY_COLOR = "#3ee0d0";
const CHORD_COLOR = "#ffb347";
const ROW_STICKINESS = 0.2; // how far (in rows) a hand must cross a boundary before the row changes
const MIN_PLAY_HEIGHT = 220; // px of rows to keep no matter how much the toolbar and song panel take
const FINGER_SETTLE_MS = 70; // a finger count must hold this long, so shapes passed on the way don't sound
const FINGERTIPS = [4, 8, 12, 16, 20];
const SIGN_SETTLE_MS = 100; // a chord sign must hold this long before it becomes the chord
const STRING_COUNT = 6;
const STRING_GAP = 12; // px between the air guitar strings
const STRUM_REACH = 0.04; // of screen height: how far past the strings' middle the hand must get to strum
const FULL_STRUM_SPEED = 2.5; // screen heights per second for a full-strength strum
const SVG_NS = "http://www.w3.org/2000/svg";

const MODES = { air: "Air guitar", fingers: "Count fingers", pinch: "Pinch & slide" };
type Mode = keyof typeof MODES;

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const video = el<HTMLVideoElement>("cam");
const canvas = el<HTMLCanvasElement>("stage");
const ctx = canvas.getContext("2d")!;
const intro = el<HTMLElement>("intro");
const toolbar = el<HTMLElement>("toolbar");
const statusEl = el<HTMLParagraphElement>("status");
const startBtn = el<HTMLButtonElement>("start");
const moreBtn = el<HTMLButtonElement>("more");
const songSelect = el<HTMLSelectElement>("song");
const styleSelect = el<HTMLSelectElement>("style");
const modeSelect = el<HTMLSelectElement>("mode");
const keySelect = el<HTMLSelectElement>("key");
const scaleSelect = el<HTMLSelectElement>("scale");
const leadSelect = el<HTMLSelectElement>("lead");
const chordSoundSelect = el<HTMLSelectElement>("chordSound");
const chordStyleSelect = el<HTMLSelectElement>("chordStyle");
const patternSelect = el<HTMLSelectElement>("pattern");
const bpmInput = el<HTMLInputElement>("bpm");
const bpmOut = el<HTMLOutputElement>("bpmOut");
const recordBtn = el<HTMLButtonElement>("record");
const downloadLink = el<HTMLAnchorElement>("download");
const songPanel = el<HTMLElement>("songPanel");
const songTitle = el<HTMLElement>("songTitle");
const songArtist = el<HTMLElement>("songArtist");
const songSection = el<HTMLElement>("songSection");
const songNow = el<HTMLElement>("songNow");
const songFinger = el<HTMLElement>("songFinger");
const songChord = el<HTMLElement>("songChord");
const songHint = el<HTMLElement>("songHint");
const songNext = el<HTMLOListElement>("songNext");
const songBar = el<HTMLElement>("songBar");
const songLyric = el<HTMLElement>("songLyric");
const songLyricNext = el<HTMLElement>("songLyricNext");
const songNote = el<HTMLElement>("songNote");
const songShiftNote = el<HTMLElement>("songShift");
const songRestartBtn = el<HTMLButtonElement>("songRestart");
const songSkipBtn = el<HTMLButtonElement>("songSkip");

// ---------- Settings & toolbar ----------

const settings = {
  style: "original" as StyleId,
  mode: "air" as Mode,
  key: 9, // A
  scale: "pentaMinor" as ScaleId,
  lead: "saw" as LeadId,
  chordSound: "warm" as ChordSoundId,
  chordStyle: "pad" as ChordStyle,
  pattern: "off" as DrumPatternId,
  lastBeat: "boombap" as DrumPatternId,
};

function fillSelect(select: HTMLSelectElement, options: [string, string][], value: string) {
  select.replaceChildren(...options.map(([v, label]) => new Option(label, v, false, v === value)));
}
const songOptions = SONGS.map((s): [string, string] => [s.id, `${s.title} – ${s.artist}`]);
fillSelect(songSelect, [["", "Free play"], ...songOptions], "");
fillSelect(styleSelect, Object.entries(STYLES).map(([id, s]) => [id, s.label]), settings.style);
fillSelect(modeSelect, Object.entries(MODES), settings.mode);
fillSelect(keySelect, NOTE_NAMES.map((n, i) => [String(i), n]), String(settings.key));
fillSelect(scaleSelect, Object.entries(SCALES).map(([id, s]) => [id, s.label]), settings.scale);
fillSelect(leadSelect, Object.entries(LEAD_PRESETS).map(([id, p]) => [id, p.label]), settings.lead);
fillSelect(chordSoundSelect, Object.entries(CHORD_SOUNDS).map(([id, s]) => [id, s.label]), settings.chordSound);
fillSelect(chordStyleSelect, Object.entries(CHORD_STYLES), settings.chordStyle);
fillSelect(patternSelect, Object.entries(DRUM_PATTERNS).map(([id, p]) => [id, p.label]), settings.pattern);

moreBtn.onclick = () => {
  moreBtn.blur();
  const open = toolbar.classList.toggle("expanded");
  moreBtn.setAttribute("aria-expanded", String(open));
  moreBtn.textContent = open ? "Less ▴" : "More ▾";
};
songSelect.onchange = () => selectSong(SONGS.find((s) => s.id === songSelect.value) ?? null);
styleSelect.onchange = () => applyStyle(styleSelect.value as StyleId);
modeSelect.onchange = () => {
  settings.mode = modeSelect.value as Mode;
  updateModeControls();
  useSongForm(songBeat()); // keeps the place in the song, within the step too
};
keySelect.onchange = () => {
  settings.key = Number(keySelect.value);
  rebuildScale();
};
scaleSelect.onchange = () => {
  settings.scale = scaleSelect.value as ScaleId;
  rebuildScale();
};
leadSelect.onchange = () => {
  settings.lead = leadSelect.value as LeadId;
  melodyZone.playing = null;
  engine?.setLead(settings.lead);
};
chordSoundSelect.onchange = () => {
  settings.chordSound = chordSoundSelect.value as ChordSoundId;
  chordZone.playing = null;
  engine?.setChordSound(settings.chordSound);
};
chordStyleSelect.onchange = () => {
  settings.chordStyle = chordStyleSelect.value as ChordStyle;
  chordZone.playing = null;
  engine?.setChordStyle(settings.chordStyle);
};
patternSelect.onchange = () => setPattern(patternSelect.value as DrumPatternId);
bpmInput.oninput = () => setBpm(Number(bpmInput.value));
recordBtn.onclick = () => {
  recordBtn.blur();
  void toggleRecording();
};

/**
 * Air mode strums instead of using a chord style or a lead, takes its chords from signs instead of a key and
 * scale, and can't play songs with chords no sign reaches.
 */
function updateModeControls() {
  const air = settings.mode === "air";
  const unused: [HTMLSelectElement, string][] = [
    [keySelect, "the chords come from your left hand's signs, so the key isn't used"],
    [scaleSelect, "the chords come from your left hand's signs, so the scale isn't used"],
    [leadSelect, "your right hand strums instead of playing a melody, so the lead isn't used"],
    [chordStyleSelect, "your right hand strums the chords, so the chord style isn't used"],
  ];
  for (const [select, why] of unused) {
    select.disabled = air;
    select.parentElement!.title = air ? `Air guitar: ${why}. Pick another Mode to change it.` : "";
  }
  for (const option of songSelect.options) {
    const s = SONGS.find((x) => x.id === option.value);
    option.disabled = !!s && air && !fitted(s);
  }
}

function setPattern(id: DrumPatternId) {
  settings.pattern = id;
  if (id !== "off") settings.lastBeat = id;
  patternSelect.value = id;
  engine?.setPattern(id);
}

function setBpm(bpm: number) {
  bpmInput.value = String(bpm);
  bpmOut.value = bpmInput.value;
  engine?.setBpm(bpm);
}

/** A style sets several controls at once; mirror them in the toolbar. */
function applyStyle(id: StyleId) {
  const s: StylePreset = STYLES[id];
  settings.style = id;
  settings.lead = s.lead;
  settings.chordSound = s.chordSound;
  settings.chordStyle = s.chordStyle;
  styleSelect.value = id;
  leadSelect.value = s.lead;
  chordSoundSelect.value = s.chordSound;
  chordStyleSelect.value = s.chordStyle;
  melodyZone.playing = null;
  chordZone.playing = null;
  engine?.applyStyle(id);
  setPattern(s.pattern);
  setBpm(song ? song.bpm : s.bpm); // a song keeps its own tempo, since its chord timings depend on it
}

let downloadUrl: string | null = null;
async function toggleRecording() {
  if (!engine) return;
  if (!engine.recording) {
    engine.startRecording();
    recordBtn.classList.add("on");
    recordBtn.textContent = "■ Stop";
    downloadLink.hidden = true;
    return;
  }
  recordBtn.classList.remove("on");
  recordBtn.textContent = "● Record";
  const blob = await engine.stopRecording();
  if (!blob) return;
  if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  downloadUrl = URL.createObjectURL(blob);
  const ext = blob.type.includes("ogg") ? "ogg" : blob.type.includes("mp4") ? "m4a" : "webm";
  downloadLink.href = downloadUrl;
  downloadLink.download = `hand-song-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.${ext}`;
  downloadLink.hidden = false;
}

window.addEventListener("keydown", (e) => {
  const t = e.target;
  const focused = t instanceof HTMLSelectElement || t instanceof HTMLInputElement || t instanceof HTMLButtonElement;
  if (!engine || focused || t instanceof HTMLAnchorElement || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
  if (e.code === "Space") {
    e.preventDefault();
    setPattern(settings.pattern === "off" ? settings.lastBeat : "off");
  } else if (e.code === "KeyR") {
    void toggleRecording();
  }
});

// ---------- Zones: left half plays chords, right half plays melody ----------

/** Something a hand can play: a single note or a chord. */
interface Item {
  label: string;
  notes: number[]; // midi
}

/**
 * Each zone is a stack of rows chosen by hand height; each row holds the items the gesture picks from.
 * Pinch mode: one item per row, pinch to play it. Finger mode: finger count n plays the row's nth item.
 */
interface Zone {
  side: "left" | "right";
  color: string;
  hand: ZoneHand;
  rows(): Item[][]; // lowest first
  row: number | null; // row under the hand, 0 = top
  playing: string | null; // label of the item sounding
  candidate: string | null; // what the gesture currently asks for
  candidateSince: number;
  pinchSettleMs: number; // in pinch mode, how long a held pinch must rest on a new row before switching
  start(item: Item): void;
  change(item: Item): void;
  stop(): void;
  brightness(amount: number): void;
}

let engine: AudioEngine | null = null;
let melodyItems: Item[] = [];
let fingerOctaves: Item[][] = [];
let chordItems: Item[] = [];

const melodyZone: Zone = {
  side: "right",
  color: MELODY_COLOR,
  hand: new ZoneHand(),
  rows: () => (settings.mode === "pinch" ? melodyItems.map((i) => [i]) : fingerOctaves),
  row: null,
  playing: null,
  candidate: null,
  candidateSince: 0,
  pinchSettleMs: 0, // glide through every note
  start: (item) => engine?.leadOn(item.notes[0]),
  change: (item) => engine?.leadGlide(item.notes[0]),
  stop: () => engine?.leadOff(),
  brightness: (a) => engine?.setLeadBrightness(a),
};

const chordZone: Zone = {
  side: "left",
  color: CHORD_COLOR,
  hand: new ZoneHand(),
  rows: () => (settings.mode === "pinch" ? chordItems.map((i) => [i]) : [chordItems.slice(0, 5)]),
  row: null,
  playing: null,
  candidate: null,
  candidateSince: 0,
  pinchSettleMs: 90, // don't retrigger every chord the hand sweeps past
  start: (item) => engine?.chordOn(item.notes),
  change: (item) => engine?.chordOn(item.notes),
  stop: () => engine?.chordOff(),
  brightness: (a) => engine?.setChordBrightness(a),
};

const zones = [chordZone, melodyZone];

function resetZones() {
  for (const z of zones) {
    if (z.playing !== null) z.stop();
    z.playing = null;
    z.candidate = null;
    z.row = null;
  }
  resetGuitar();
}

function rebuildScale() {
  resetZones();
  const note = (n: { midi: number; label: string }): Item => ({ label: n.label, notes: [n.midi] });
  melodyItems = buildMelody(settings.key, settings.scale).map(note);
  fingerOctaves = buildFingerOctaves(settings.key, settings.scale).map((octave) => octave.map(note));
  // A song's chords are absolute: changing key or scale only moves the melody hand.
  chordItems = (song ? songChords(song) : buildChords(settings.key, settings.scale)).map((c) => ({
    label: c.label,
    notes: c.notes,
  }));
}

/** The point that steers a zone: the pinch in pinch mode, the middle of the hand when counting fingers. */
const focus = (h: ZoneHand): Point => (settings.mode === "pinch" ? { x: h.x, y: h.y } : { x: h.cx, y: h.cy });

function updateZone(z: Zone, now: number) {
  const h = z.hand;
  const rows = z.rows();
  let target: Item | null = null;

  if (h.present) {
    const p = focus(h);
    const pos = clamp((p.y - layout.top) / (layout.bottom - layout.top), 0, 0.9999) * rows.length;
    if (z.row === null || pos < z.row - ROW_STICKINESS || pos > z.row + 1 + ROW_STICKINESS) z.row = Math.floor(pos);

    const mid = layout.width / 2;
    z.brightness(clamp(z.side === "left" ? (mid - p.x) / mid : (p.x - mid) / mid, 0, 1));

    const items = rows[rows.length - 1 - z.row];
    if (settings.mode === "pinch") target = h.pinched ? items[0] : null;
    else target = h.fingers > 0 ? items[Math.min(h.fingers, items.length) - 1] : null;
  } else {
    z.row = null;
  }

  const wanted = target?.label ?? null;
  if (wanted !== z.candidate) {
    z.candidate = wanted;
    z.candidateSince = now;
  }
  if (wanted === z.playing) return;

  const settle = !h.present
    ? 0
    : settings.mode === "fingers"
      ? FINGER_SETTLE_MS
      : z.playing !== null && target
        ? z.pinchSettleMs
        : 0;
  if (now - z.candidateSince < settle) return;

  if (!target) {
    z.stop();
  } else if (z.playing === null) {
    z.start(target);
    addRipple(focus(h), z.color, 1);
  } else {
    z.change(target);
    addRipple(focus(h), z.color, 0.6);
  }
  z.playing = wanted;
}

function assignHands(readings: HandReading[], now: number) {
  const seen = (h: ZoneHand) => (h.present ? { x: h.rawCx, y: h.rawCy } : null);
  const [left, right] = splitHands(readings, layout.width / 2, seen(chordZone.hand), seen(melodyZone.hand));
  chordZone.hand.update(left, now);
  melodyZone.hand.update(right, now);
}

// ---------- Air guitar: the left hand holds a chord sign, the right hand strums ----------

const guitar = {
  sign: null as string | null, // the settled sign: a chord, "mute", or null for none
  candidate: null as string | null, // what the left hand shows now
  candidateSince: 0,
  lastChord: null as string | null, // so switching to another chord stops the old one ringing
  lastStrum: null as { at: number; direction: StrumDirection; velocity: number } | null,
  strummed: false, // strummed since the sign formed; songs wait for it
};
const strumTracker = new StrumTracker(); // which side of the strings the right hand is on

interface GuitarString {
  hitAt: number;
  amp: number; // px
  decay: number; // ms
}
const strings: GuitarString[] = Array.from({ length: STRING_COUNT }, () => ({ hitAt: -Infinity, amp: 0, decay: 1 }));

const guitarChord = () => (guitar.sign === MUTE_SIGN.chord ? null : guitar.sign);
/** How far past the strings' middle the hand must get on either side; jitter inside this can't strum. */
const strumReach = () => Math.max(STRUM_REACH * layout.height, (STRING_GAP * (STRING_COUNT - 1)) / 2 + 8);
/**
 * The middle of the strings: halfway down the play area, unless the song panel would cover the band the hand
 * crosses; then halfway down the part below the panel, as far as the play area allows.
 */
function stringsY() {
  const mid = (layout.top + layout.bottom) / 2;
  const reach = strumReach();
  if (mid - reach >= layout.clear) return mid;
  return Math.max(mid, Math.min((layout.clear + layout.bottom) / 2, layout.bottom - reach));
}

function resetGuitar() {
  guitar.sign = guitar.candidate = guitar.lastChord = guitar.lastStrum = null;
  guitar.strummed = false;
  strumTracker.reset();
  engine?.mute();
}

/** Reads the left hand's sign; a new one counts once it has held for SIGN_SETTLE_MS. */
function updateSign(now: number) {
  const h = chordZone.hand;
  if (h.present) chordZone.brightness(clamp((layout.width / 2 - h.cx) / (layout.width / 2), 0, 1));
  const changed = settleSign(guitar, h.present ? signChord(h.raised) : undefined, now, SIGN_SETTLE_MS);
  // kept in step every frame, since sound and style changes clear it
  chordZone.playing = guitarChord();
  if (!changed) return;

  const wanted = guitar.sign;
  guitar.strummed = false;
  if (wanted === MUTE_SIGN.chord) {
    engine?.mute();
    guitar.lastChord = null;
    addRipple({ x: h.cx, y: h.cy }, CHORD_COLOR, 0.4);
  } else if (wanted) {
    // A strum made while this sign was forming still sounded the old one: strike the new chord in its place.
    const last = guitar.lastStrum;
    if (last && last.at >= guitar.candidateSince) strum(last.direction, last.velocity, now);
    else if (guitar.lastChord !== null && wanted !== guitar.lastChord) engine?.mute();
    guitar.lastChord = wanted;
    addRipple({ x: h.cx, y: h.cy }, CHORD_COLOR, 0.6);
  }
}

/** A strum fires when the right hand's raw center gets from one side of the strings to the other. */
function updateStrum(now: number) {
  const h = melodyZone.hand;
  // A lost hand isn't fed; the tracker keeps its side for a moment, so a blurred stroke that reappears strums.
  if (!h.present) return;
  const hit = strumTracker.update(h.rawCy - stringsY(), h.seenAt, strumReach());
  if (!hit) return;
  const speed = (hit.speed * 1000) / layout.height; // screen heights per second
  strum(hit.direction, clamp(speed / FULL_STRUM_SPEED, 0.35, 1), now);
}

function strum(direction: StrumDirection, velocity: number, now: number) {
  guitar.lastStrum = { at: now, direction, velocity };
  const chord = guitarChord();
  const notes = chord ? parseChord(chord).notes : [];
  // the drawn strings take as long as the sounding ones, first to last
  const gap = (strumSpread(velocity, notes.length || STRING_COUNT) * 1000) / (STRING_COUNT - 1);
  // The top string is the low one, so a down strum shakes the strings top to bottom.
  strings.forEach((s, i) => {
    s.hitAt = now + (direction === "down" ? i : STRING_COUNT - 1 - i) * gap;
    s.amp = chord ? 2 + 5 * velocity : 1.5;
    s.decay = chord ? 450 : 80;
  });
  if (!chord) {
    engine?.deadStrum(velocity);
    return;
  }
  engine?.strum(notes, direction, velocity);
  guitar.strummed = true;
  addRipple({ x: melodyZone.hand.rawCx, y: melodyZone.hand.rawCy }, CHORD_COLOR, 0.4 + 0.6 * velocity);
}

// ---------- Songs: follow a chord progression with the left hand ----------

let picked: Song | null = null; // the song chosen in the toolbar
let song: Song | null = null; // the version being played; in air mode, fitted to the chord signs
let songShift = 0; // semitones the air mode version moved
let songStep = 0; // index into song.steps; steps.length = finished
let songHeldMs = 0; // how long the current step's chord has been held

const fitCache = new Map<string, ReturnType<typeof fitSongToSigns>>();
/** The song moved onto the chord signs (cached), or null if it can't be. */
function fitted(s: Song) {
  if (!fitCache.has(s.id)) fitCache.set(s.id, fitSongToSigns(s));
  return fitCache.get(s.id) ?? null;
}

const beatsBefore = (s: Song, step: number) => s.steps.slice(0, step).reduce((sum, st) => sum + st.beats, 0);
/** How far into the song the player is, in beats, counting what the current step has been held for. */
const songBeat = () => (song ? beatsBefore(song, songStep) + (songHeldMs * Number(bpmInput.value)) / 60000 : 0);
/** The step playing at a beat; steps.length past the end. */
function stepAtBeat(s: Song, beat: number) {
  let end = 0;
  const i = s.steps.findIndex((st) => (end += st.beats) > beat);
  return i < 0 ? s.steps.length : i;
}

const stepMs = (step: SongStep) => (step.beats * 60000) / Number(bpmInput.value);
const currentStep = () => song?.steps[songStep] ?? null;
/** The chord the song wants next, for the canvas hints. */
const expectedChord = () => currentStep()?.chord ?? null;

function selectSong(s: Song | null) {
  picked = s;
  songSelect.value = s?.id ?? "";
  if (s) setBpm(s.bpm);
  useSongForm(0);
}

/**
 * Plays the picked song from `beat` on, in the version the mode uses: air mode plays it fitted to the chord
 * signs, the other modes play it as written. Its key and scale go to the melody hand.
 */
function useSongForm(beat: number) {
  const fit = picked && settings.mode === "air" ? fitted(picked) : null;
  song = picked && settings.mode === "air" ? (fit?.song ?? null) : picked;
  songShift = fit?.transpose ?? 0;
  if (song) {
    settings.key = song.key;
    settings.scale = song.scale;
    keySelect.value = String(song.key);
    scaleSelect.value = song.scale;
  }
  rebuildScale();
  songStep = song ? stepAtBeat(song, beat) : 0;
  // the beats of this step already played count as held
  const into = song && songStep < song.steps.length ? beat - beatsBefore(song, songStep) : 0;
  songHeldMs = (Math.max(into, 0) * 60000) / Number(bpmInput.value);
  renderSong();
}

function restartSong() {
  songStep = 0;
  songHeldMs = 0;
  guitar.strummed = false;
  renderSong();
}

function advanceSong() {
  if (!song || songStep >= song.steps.length) return;
  songStep++;
  songHeldMs = 0;
  guitar.strummed = false; // each step wants its own strum
  renderSong();
}

/**
 * Called every frame: holding the right chord fills the step; anything else pauses it.
 * In air mode the sign only counts once it has been strummed.
 */
function updateSong(dt: number) {
  const step = currentStep();
  if (!step) return;
  if (chordZone.playing === step.chord && (settings.mode !== "air" || guitar.strummed)) {
    songHeldMs += dt;
    if (songHeldMs >= stepMs(step)) advanceSong();
  }
  updateSongMeter();
}

/** The per-frame parts of the panel: progress bar and right / wrong chord state. */
function updateSongMeter() {
  const step = currentStep();
  const playing = chordZone.playing;
  const state =
    !step || playing === null
      ? ""
      : playing !== step.chord
        ? "wrong"
        : settings.mode === "air" && !guitar.strummed
          ? "ready" // right sign, waiting for a strum
          : "correct";
  if (songNow.dataset.state !== state) songNow.dataset.state = state;
  songBar.style.transform = `scaleX(${step ? Math.min(songHeldMs / stepMs(step), 1) : 0})`;
}

function renderSong() {
  songPanel.hidden = !picked;
  if (!picked) return;
  songTitle.textContent = picked.title;
  songArtist.textContent = picked.artist;
  songPanel.classList.toggle("blocked", !song);
  songRestartBtn.disabled = !song;
  if (!song) {
    // air mode, and a chord of the song has no sign even after transposing
    songPanel.classList.remove("done");
    songSection.textContent = "";
    songSkipBtn.disabled = true;
    songFinger.hidden = true;
    songChord.textContent = "No chord signs for this song";
    songHint.textContent = "Some of its chords have no sign. Switch Mode to Count fingers to play it.";
    songNext.replaceChildren();
    updateSongMeter();
    return;
  }
  const { steps, palette } = song;
  const done = songStep >= steps.length;
  songPanel.classList.toggle("done", done);
  // the section carries forward from the last step that named one
  songSection.textContent = steps.slice(0, songStep + 1).reverse().find((s) => s.section)?.section ?? "";
  songSkipBtn.disabled = done;
  updateSongMeter();

  const hasLyrics = steps.some((s) => s.lyric);
  songLyric.hidden = songLyricNext.hidden = !hasLyrics;
  songNote.hidden = hasLyrics;
  songShiftNote.hidden = songShift === 0;
  const semitones = `${Math.abs(songShift)} semitone${Math.abs(songShift) > 1 ? "s" : ""}`;
  songShiftNote.textContent = `Moved ${songShift < 0 ? "down" : "up"} ${semitones} so every chord has a sign`;

  if (done) {
    songFinger.hidden = true;
    songChord.textContent = "Song complete 🎉";
    songHint.textContent = "Press Restart to play it again.";
    songNext.replaceChildren();
    return;
  }

  const step = steps[songStep];
  const air = settings.mode === "air";
  const fingers = settings.mode === "fingers";
  const finger = palette.indexOf(step.chord) + 1;
  songFinger.hidden = false;
  songChord.replaceChildren(step.chord);
  if (air) {
    const sign = chordSign(step.chord);
    songFinger.replaceChildren(signGlyph(step.chord));
    songFinger.title = sign?.label ?? "";
    if (sign?.emoji) {
      const emoji = document.createElement("span");
      emoji.className = "song-emoji";
      emoji.textContent = sign.emoji;
      songChord.append(emoji);
    }
    songHint.textContent = "Make the sign, then strum";
  } else {
    songFinger.textContent = fingers ? String(finger) : "🤏";
    songFinger.title = "";
    songHint.textContent = fingers ? `Hold up ${finger} finger${finger > 1 ? "s" : ""}` : `Pinch the ${step.chord} row`;
  }

  songNext.replaceChildren(
    ...steps.slice(songStep + 1, songStep + 5).map((s) => {
      const li = document.createElement("li");
      const n = document.createElement("b");
      n.textContent = String(palette.indexOf(s.chord) + 1);
      li.append(...(air ? [signGlyph(s.chord), s.chord] : fingers ? [n, s.chord] : [s.chord]));
      return li;
    }),
  );

  songLyric.textContent = step.lyric ?? "";
  songLyricNext.textContent = steps[songStep + 1]?.lyric ?? "";
}

// The thumb's bar stands a little apart from the four fingers'. In glyph units: bars are 5 wide, 30 tall.
const glyphBarX = (finger: number) => finger * 7 + (finger ? 3 : 0);
const glyphBarH = (raised: boolean) => (raised ? 30 : 12);

/** A chord's sign as five bars, thumb to pinky: raised fingers tall, lowered ones short. */
function signGlyph(chord: string) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 36 30");
  svg.setAttribute("class", "glyph");
  svg.setAttribute("aria-hidden", "true");
  [...(chordSign(chord)?.pattern ?? MUTE_SIGN.pattern)].forEach((bit, i) => {
    const h = glyphBarH(bit === "1");
    const bar = document.createElementNS(SVG_NS, "rect");
    const attrs = { x: glyphBarX(i), y: 30 - h, width: 5, height: h, rx: 2.5, class: bit === "1" ? "up" : "down" };
    for (const [k, v] of Object.entries(attrs)) bar.setAttribute(k, String(v));
    svg.append(bar);
  });
  return svg;
}

songRestartBtn.onclick = () => {
  songRestartBtn.blur();
  restartSong();
};
songSkipBtn.onclick = () => {
  songSkipBtn.blur();
  advanceSong();
};

rebuildScale();
updateModeControls();

// ---------- Layout & drawing ----------

const layout = { width: 0, height: 0, top: 0, bottom: 0, clear: 0 }; // clear: the first y below the song panel

function resize() {
  const [oldStrings, oldReach] = [stringsY(), strumReach()];
  const dpr = window.devicePixelRatio || 1;
  layout.width = window.innerWidth;
  layout.height = window.innerHeight;
  layout.top = toolbar.hidden ? 16 : toolbar.getBoundingClientRect().bottom + 12;
  // Where the song panel would cover the row labels at the screen edges, the zones start below it.
  const panel = songPanel.getBoundingClientRect();
  if (!songPanel.hidden && panel.left < 160) layout.top = panel.bottom + 12;
  layout.bottom = layout.height - 44;
  // On short screens keep a usable play area; the panel then overlaps the top rows instead.
  layout.top = Math.max(16, Math.min(layout.top, layout.bottom - MIN_PLAY_HEIGHT));
  layout.clear = songPanel.hidden ? layout.top : Math.max(layout.top, panel.bottom + 8);
  canvas.width = Math.round(layout.width * dpr);
  canvas.height = Math.round(layout.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // Strings that moved can put the hand on their other side: it takes its side afresh instead of strumming.
  if (stringsY() !== oldStrings || strumReach() !== oldReach) strumTracker.reset();
}
window.addEventListener("resize", resize);
const observer = new ResizeObserver(resize);
observer.observe(toolbar);
observer.observe(songPanel);
resize();

/** Where the mirrored, cover-cropped video sits on screen. */
function videoRect() {
  const scale = Math.max(layout.width / video.videoWidth, layout.height / video.videoHeight);
  const w = video.videoWidth * scale;
  const h = video.videoHeight * scale;
  return { x: (layout.width - w) / 2, y: (layout.height - h) / 2, w, h };
}

interface Ripple {
  x: number;
  y: number;
  color: string;
  strength: number;
  born: number;
}
const ripples: Ripple[] = [];
const addRipple = (p: Point, color: string, strength: number) =>
  ripples.push({ x: p.x, y: p.y, color, strength, born: performance.now() });

function draw(now: number) {
  const { width: W, height: H } = layout;
  ctx.fillStyle = "#0b0d12";
  ctx.fillRect(0, 0, W, H);

  if (video.readyState >= 2) {
    const r = videoRect();
    ctx.save();
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, r.x, r.y, r.w, r.h);
    ctx.restore();
    ctx.fillStyle = "rgba(8, 10, 15, 0.6)";
    ctx.fillRect(0, 0, W, H);
  }

  for (const z of zones) drawZone(z, now);

  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.setLineDash([4, 8]);
  ctx.beginPath();
  ctx.moveTo(W / 2, layout.top);
  ctx.lineTo(W / 2, H);
  ctx.stroke();
  ctx.setLineDash([]);

  for (const z of zones) if (z.hand.present) drawHand(z);
  drawRipples(now);

  if (!zones.some((z) => z.hand.present)) {
    ctx.fillStyle = "rgba(238,241,246,0.7)";
    ctx.font = "500 18px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Show your hands to the camera", W / 2, (layout.top + layout.bottom) / 2);
  }
}

/** 0..1, for the outline that marks what a song expects next. */
const hintPulse = (now: number) => 0.55 + 0.45 * Math.sin(now / 160);

function drawZone(z: Zone, now: number) {
  const { width: W, top, bottom } = layout;
  const x0 = z.side === "left" ? 0 : W / 2;
  const zoneW = W / 2;
  const rows = z.rows();
  const count = rows.length;
  const rowH = (bottom - top) / count;
  const fontSize = clamp(rowH * 0.42, 10, 16);
  const expected = z === chordZone ? expectedChord() : null;
  const air = settings.mode === "air";

  // A single row needs no bands (chords in finger mode), and air mode has no rows.
  for (let row = 0; !air && count > 1 && row < count; row++) {
    const y = top + row * rowH;
    const items = rows[count - 1 - row];
    const playing = items.some((i) => i.label === z.playing);
    const hovered = z.row === row;

    if (playing || hovered) {
      ctx.fillStyle = hexAlpha(z.color, playing ? 0.3 : 0.1);
      ctx.fillRect(x0, y, zoneW, rowH);
    }
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(x0, y, zoneW, 1);
    if (items.some((i) => i.label === expected)) {
      ctx.strokeStyle = hexAlpha(z.color, hintPulse(now));
      ctx.lineWidth = 2;
      ctx.strokeRect(x0 + 3, y + 3, zoneW - 6, rowH - 6);
    }

    const label = items.length === 1 ? items[0].label : `${items[0].label} – ${items[items.length - 1].label}`;
    ctx.font = `${playing ? 700 : 500} ${fontSize}px system-ui, sans-serif`;
    ctx.fillStyle = playing ? z.color : hovered ? "rgba(238,241,246,0.9)" : "rgba(238,241,246,0.45)";
    ctx.textBaseline = "middle";
    ctx.textAlign = z.side === "left" ? "left" : "right";
    ctx.fillText(label, z.side === "left" ? 16 : W - 16, y + rowH / 2);
  }

  if (settings.mode === "fingers") drawFingerLegend(z, x0, zoneW, rows, expected, now);
  else if (air && z === chordZone) drawSignChart(x0, zoneW, expected, now);
  else if (air) drawStrings(x0, zoneW, now);

  const stripY = layout.height - 22;
  ctx.font = "600 11px system-ui, sans-serif";
  ctx.fillStyle = hexAlpha(z.color, 0.85);
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  if (air && z === melodyZone) {
    const label = zoneW < 300 ? "STRUM ↕ across the strings" : "STRUM · down or up across the strings";
    ctx.fillText(label, x0 + zoneW / 2, stripY - 6);
    return;
  }
  ctx.fillText(z.side === "left" ? "CHORDS · brighter ←" : "MELODY · brighter →", x0 + zoneW / 2, stripY - 6);

  // Brightness strip along the bottom: brighter toward the outer edge.
  const grad = ctx.createLinearGradient(W / 2, 0, z.side === "left" ? 0 : W, 0);
  grad.addColorStop(0, hexAlpha(z.color, 0.08));
  grad.addColorStop(1, hexAlpha(z.color, 0.7));
  ctx.fillStyle = grad;
  ctx.fillRect(x0 + 16, stripY, zoneW - 32, 3);
  if (z.hand.present) {
    ctx.fillStyle = z.color;
    ctx.beginPath();
    ctx.arc(clamp(focus(z.hand).x, x0 + 16, x0 + zoneW - 16), stripY + 1.5, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Air mode's chart of chord signs: the held sign lit, the one a song wants next pulsing. */
function drawSignChart(x0: number, zoneW: number, expected: string | null, now: number) {
  const cells = [...SIGNS, MUTE_SIGN];
  const held = chordZone.hand.present ? guitar.sign : null;
  const gap = 5;
  const pad = zoneW < 260 ? 10 : 16;
  // Wrap onto more lines (up to three on phones) rather than shrink the cells past reading.
  const fits = (perLine: number) => (zoneW - 2 * pad - gap * (perLine - 1)) / perLine;
  let lines = 1;
  while (lines < 3 && fits(Math.ceil(cells.length / lines)) < 40) lines++;
  const perLine = Math.ceil(cells.length / lines);
  const cellW = Math.min(64, fits(perLine));
  // Shorter cells, down to 40 px, where the song panel would cover the chart's top line.
  const cellH = clamp((layout.bottom - 12 - layout.clear - (lines - 1) * gap) / lines, 40, 46);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${cellW < 44 ? 11 : 12}px system-ui, sans-serif`;
  for (const [i, cell] of cells.entries()) {
    const line = Math.floor(i / perLine);
    const inLine = Math.min(perLine, cells.length - line * perLine);
    const x = x0 + (zoneW - (cellW * inLine + gap * (inLine - 1))) / 2 + (i % perLine) * (cellW + gap);
    const y = layout.bottom - 12 - (lines - line) * cellH - (lines - line - 1) * gap;
    const active = cell.chord === held;
    ctx.fillStyle = active ? CHORD_COLOR : "rgba(16, 19, 27, 0.75)";
    ctx.strokeStyle = active ? CHORD_COLOR : hexAlpha(CHORD_COLOR, 0.35);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, cellW, cellH, 8);
    ctx.fill();
    ctx.stroke();
    if (cell.chord === expected) {
      ctx.strokeStyle = hexAlpha(CHORD_COLOR, hintPulse(now));
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(x - 4, y - 4, cellW + 8, cellH + 8, 11);
      ctx.stroke();
    }
    const ink = active ? "#0b0d12" : CHORD_COLOR;
    const lowered = active ? "rgba(11,13,18,0.35)" : "rgba(238,241,246,0.25)";
    drawGlyph(cell.pattern, x + cellW / 2, y + 6, cellH - 26, ink, lowered);
    ctx.fillStyle = active ? "#0b0d12" : "rgba(238,241,246,0.9)";
    ctx.fillText(cell.chord, x + cellW / 2, y + cellH - 10);
  }
}

/** signGlyph's five bars on the canvas, `h` tall, centered on x. */
function drawGlyph(pattern: string, x: number, top: number, h: number, raised: string, lowered: string) {
  const u = h / 30; // glyph units
  [...pattern].forEach((bit, i) => {
    const barH = glyphBarH(bit === "1") * u;
    ctx.fillStyle = bit === "1" ? raised : lowered;
    ctx.beginPath();
    ctx.roundRect(x + (glyphBarX(i) - 18) * u, top + h - barH, 5 * u, barH, 2.5 * u);
    ctx.fill();
  });
}

/** Six strings across the right zone, each wobbling in a fading standing wave after a strum. */
function drawStrings(x0: number, zoneW: number, now: number) {
  const mid = stringsY();
  const reach = strumReach();
  const left = x0 + 16;
  const len = zoneW - 32;
  const color = guitarChord() ? CHORD_COLOR : MELODY_COLOR;
  ctx.fillStyle = "rgba(255,255,255,0.035)"; // the band the hand must cross
  ctx.fillRect(x0, mid - reach, zoneW, reach * 2);

  for (const [i, s] of strings.entries()) {
    const y = mid + (i - (STRING_COUNT - 1) / 2) * STRING_GAP;
    const t = now - s.hitAt;
    const a = t >= 0 ? s.amp * Math.exp(-t / s.decay) : 0;
    const wobble = a > 0.05 ? a * Math.sin(t / (7 + i * 1.5)) : 0; // low strings swing slower
    ctx.strokeStyle = hexAlpha(color, 0.5 + Math.min(a / 8, 0.5));
    ctx.lineWidth = 2.4 - i * 0.3; // the top string is the low, thick one
    ctx.beginPath();
    for (let k = 0; k <= 32; k++) {
      const u = k / 32;
      ctx.lineTo(left + u * len, y + wobble * Math.sin(Math.PI * u));
    }
    ctx.stroke();
  }
}

/** A row of chips showing what each finger count plays in the hand's current row. */
function drawFingerLegend(z: Zone, x0: number, zoneW: number, rows: Item[][], expected: string | null, now: number) {
  const items = rows[rows.length - 1 - (z.row ?? rows.length - 1)];
  const chips = [{ label: "✊  rest", active: z.hand.present && z.playing === null, expected: false }].concat(
    items.map((item, i) => ({
      label: `${i + 1}  ${item.label}`,
      active: item.label === z.playing,
      expected: item.label === expected,
    })),
  );
  const gap = 6;
  const chipH = 30;
  // Narrow zones (phones) wrap the chips onto two lines instead of squeezing the labels together.
  const fits = (perLine: number) => (zoneW - 32 - gap * (perLine - 1)) / perLine;
  const perLine = fits(chips.length) < 56 ? Math.ceil(chips.length / 2) : chips.length;
  const chipW = Math.min(96, fits(perLine));
  const lines = Math.ceil(chips.length / perLine);

  ctx.font = `600 ${chipW < 70 ? 11 : 13}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const [i, chip] of chips.entries()) {
    const line = Math.floor(i / perLine);
    const inLine = Math.min(perLine, chips.length - line * perLine);
    const x = x0 + (zoneW - (chipW * inLine + gap * (inLine - 1))) / 2 + (i % perLine) * (chipW + gap);
    const y = layout.bottom - 12 - (lines - line) * chipH - (lines - line - 1) * gap;
    ctx.fillStyle = chip.active ? z.color : "rgba(16, 19, 27, 0.75)";
    ctx.strokeStyle = chip.active ? z.color : hexAlpha(z.color, 0.35);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, chipW, chipH, 8);
    ctx.fill();
    ctx.stroke();
    if (chip.expected) {
      // the chip the song wants next: a pulsing outline around it
      ctx.strokeStyle = hexAlpha(z.color, hintPulse(now));
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(x - 4, y - 4, chipW + 8, chipH + 8, 11);
      ctx.stroke();
    }
    ctx.fillStyle = chip.active ? "#0b0d12" : "rgba(238,241,246,0.85)";
    ctx.fillText(chip.label, x + chipW / 2, y + chipH / 2 + 1);
  }
}

function drawHand(z: Zone) {
  const { points, pinched, x, y, raised } = z.hand;
  ctx.strokeStyle = hexAlpha(z.color, 0.6);
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const { start, end } of HAND_CONNECTIONS) {
    ctx.moveTo(points[start].x, points[start].y);
    ctx.lineTo(points[end].x, points[end].y);
  }
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.85)";
  for (const p of points) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  if (settings.mode === "air" && z === melodyZone) {
    // the strumming point: the middle of the hand, unsmoothed like the strum itself
    ctx.fillStyle = z.color;
    ctx.beginPath();
    ctx.arc(z.hand.rawCx, z.hand.rawCy, 9, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (settings.mode !== "pinch") {
    // Light up raised fingertips and show what the hand is playing above it.
    ctx.fillStyle = z.color;
    FINGERTIPS.forEach((tip, i) => {
      if (!raised[i]) return;
      ctx.beginPath();
      ctx.arc(points[tip].x, points[tip].y, 8, 0, Math.PI * 2);
      ctx.fill();
    });
    const topY = Math.min(...points.map((p) => p.y));
    const air = settings.mode === "air";
    ctx.font = `700 ${air ? 32 : 24}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = z.playing ? z.color : "rgba(238,241,246,0.6)";
    // in air mode a hand with no sign yet shows "?", a fist "✊" (muted)
    ctx.fillText(z.playing ?? (air && guitar.sign !== MUTE_SIGN.chord ? "?" : "✊"), z.hand.cx, topY - 14);
    return;
  }

  ctx.strokeStyle = z.color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(points[4].x, points[4].y);
  ctx.lineTo(points[8].x, points[8].y);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, y, pinched ? 13 : 10, 0, Math.PI * 2);
  if (pinched) {
    ctx.fillStyle = z.color;
    ctx.fill();
  } else {
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
}

function drawRipples(now: number) {
  const LIFE = 650;
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i];
    const t = (now - r.born) / LIFE;
    if (t >= 1) {
      ripples.splice(i, 1);
      continue;
    }
    ctx.strokeStyle = hexAlpha(r.color, (1 - t) * 0.8 * r.strength);
    ctx.lineWidth = 3 * (1 - t) + 1;
    ctx.beginPath();
    ctx.arc(r.x, r.y, 14 + t * 70 * r.strength, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// ---------- Main loop ----------

let landmarker: HandLandmarker | null = null;
let lastVideoTime = -1;
let lastFrame = 0;

function frame() {
  requestAnimationFrame(frame);
  const now = performance.now();
  const dt = lastFrame ? Math.min(now - lastFrame, 100) : 0; // capped so a hidden tab doesn't jump ahead
  lastFrame = now;

  // Each part runs on its own, so a failure in one (tracking, sound) can't take the rest of the frame with it.
  safely(() => {
    if (!landmarker || video.readyState < 2 || video.currentTime === lastVideoTime) return;
    lastVideoTime = video.currentTime;
    const r = videoRect();
    const result = landmarker.detectForVideo(video, now);
    // Landmarks are in raw camera space; mirror them so the screen acts like a mirror.
    assignHands(
      readHands(result, (x, y) => ({ x: r.x + (1 - x) * r.w, y: r.y + y * r.h })),
      now,
    );
  });
  safely(() => {
    if (settings.mode === "air") {
      updateSign(now);
      updateStrum(now);
    } else {
      for (const z of zones) updateZone(z, now);
    }
  });
  safely(() => updateSong(dt));
  safely(() => draw(now));
}

const reported = new Set<string>();
/** Runs one part of a frame; an error is logged the first time, not every frame. */
function safely(part: () => void) {
  try {
    part();
  } catch (err) {
    const key = String(err);
    if (reported.has(key)) return;
    reported.add(key);
    console.error(err);
  }
}

startBtn.onclick = async () => {
  startBtn.disabled = true;
  statusEl.classList.remove("error");
  try {
    setStatus("Starting audio…");
    await Tone.start();

    setStatus("Waiting for camera permission…");
    video.srcObject = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
      audio: false,
    });
    await video.play();

    setStatus("Loading hand tracking model…");
    landmarker = await createHandLandmarker();

    engine = new AudioEngine(settings.lead);
    const style: StylePreset = STYLES[settings.style];
    engine.setChordSound(settings.chordSound);
    engine.setChordStyle(settings.chordStyle);
    engine.setPattern(settings.pattern);
    engine.setBpm(Number(bpmInput.value));
    engine.setSpace(style.reverb, style.delay);
    if (!engine.canRecord) recordBtn.hidden = true;

    intro.hidden = true;
    toolbar.hidden = false;
    resize();
    requestAnimationFrame(frame);
  } catch (err) {
    console.error(err);
    statusEl.classList.add("error");
    setStatus(describeError(err));
    startBtn.disabled = false;
  }
};

function describeError(err: unknown) {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError") return "Camera access was blocked. Allow the camera for this site, then try again.";
  if (name === "NotFoundError") return "No camera was found. Connect a webcam, then try again.";
  if (name === "NotReadableError") return "The camera is being used by another app. Close that app, then try again.";
  return `Something went wrong: ${err instanceof Error ? err.message : String(err)}`;
}

const setStatus = (text: string) => (statusEl.textContent = text);

// ---------- Utils ----------

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function hexAlpha(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
