// Hand tracking: MediaPipe setup, landmark -> screen mapping, per-zone smoothing / pinch, and strum detection.
import { FilesetResolver, HandLandmarker, type HandLandmarkerResult } from "@mediapipe/tasks-vision";

export type Point = { x: number; y: number };

export const HAND_CONNECTIONS = HandLandmarker.HAND_CONNECTIONS;

const WRIST = 0;
const THUMB_MCP = 2;
const THUMB_TIP = 4;
const INDEX_MCP = 5;
const INDEX_TIP = 8;
const MIDDLE_MCP = 9;
const PINKY_MCP = 17;
// [tip, middle joint] for index, middle, ring and pinky.
const FINGER_JOINTS = [
  [8, 6],
  [12, 10],
  [16, 14],
  [20, 18],
];

// Pinch is thumb–index distance relative to palm size, with hysteresis so it doesn't flicker.
const PINCH_ON = 0.3;
const PINCH_OFF = 0.45;
// A finger counts as raised when its tip is this much farther from the wrist than its middle joint.
const FINGER_EXTENDED = 1.1;
// The thumb counts as raised when its tip is this far (in palm sizes) from the index knuckle
// and farther from the pinky knuckle than the thumb's own base is.
const THUMB_EXTENDED = 0.6; // the chord signs that differ only by the thumb (see signs.ts) hinge on this
const SMOOTHING = 0.45; // 0..1, higher = snappier
const LOST_AFTER_MS = 180;
// A hand lost for less than this (a fast stroke blurs) that comes back across the strings still strums.
const STRUM_REGRAB_MS = 250;

export async function createHandLandmarker(): Promise<HandLandmarker> {
  const base = import.meta.env.BASE_URL;
  const fileset = await FilesetResolver.forVisionTasks(`${base}mediapipe/wasm`);
  const create = (delegate: "GPU" | "CPU") =>
    HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: `${base}models/hand_landmarker.task`, delegate },
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: 0.6,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
  try {
    return await create("GPU");
  } catch {
    return await create("CPU");
  }
}

export interface HandReading {
  points: Point[];
  center: Point; // middle knuckle, the steadiest point on the hand
  pinch: Point; // midpoint between thumb and index tips
  pinchRatio: number;
  raised: boolean[]; // thumb, index, middle, ring, pinky
}

/** Converts detected hands to screen-space readings. `toScreen` handles mirroring and cropping. */
export function readHands(result: HandLandmarkerResult, toScreen: (x: number, y: number) => Point): HandReading[] {
  return result.landmarks.map((landmarks) => {
    const points = landmarks.map((l) => toScreen(l.x, l.y));
    const thumb = points[THUMB_TIP];
    const index = points[INDEX_TIP];
    const wrist = points[WRIST];
    const palm = Math.max(dist(wrist, points[MIDDLE_MCP]), 1);
    const thumbRaised =
      dist(thumb, points[INDEX_MCP]) / palm > THUMB_EXTENDED &&
      dist(thumb, points[PINKY_MCP]) > dist(points[THUMB_MCP], points[PINKY_MCP]);
    return {
      points,
      center: points[MIDDLE_MCP],
      pinch: { x: (thumb.x + index.x) / 2, y: (thumb.y + index.y) / 2 },
      pinchRatio: dist(thumb, index) / palm,
      raised: [
        thumbRaised,
        ...FINGER_JOINTS.map(([tip, pip]) => dist(wrist, points[tip]) > dist(wrist, points[pip]) * FINGER_EXTENDED),
      ],
    };
  });
}

/** The smoothed state of whichever hand is in one zone of the screen. */
export class ZoneHand {
  present = false;
  pinched = false;
  x = 0; // pinch point
  y = 0;
  cx = 0; // hand center
  cy = 0;
  rawCx = 0; // hand center in the latest reading, unsmoothed
  rawCy = 0;
  seenAt = 0; // time of the latest reading
  points: Point[] = [];
  raised: boolean[] = [];
  fingers = 0; // how many fingers are raised

  update(reading: HandReading | undefined, now: number) {
    if (!reading) {
      if (now - this.seenAt > LOST_AFTER_MS) {
        this.present = false;
        this.pinched = false;
        this.fingers = 0;
      }
      return;
    }
    const a = this.present ? SMOOTHING : 1;
    this.x += (reading.pinch.x - this.x) * a;
    this.y += (reading.pinch.y - this.y) * a;
    this.cx += (reading.center.x - this.cx) * a;
    this.cy += (reading.center.y - this.cy) * a;
    this.rawCx = reading.center.x;
    this.rawCy = reading.center.y;
    this.points = reading.points;
    this.raised = reading.raised;
    this.fingers = reading.raised.filter(Boolean).length;
    this.present = true;
    this.seenAt = now;

    if (!this.pinched && reading.pinchRatio < PINCH_ON) this.pinched = true;
    else if (this.pinched && reading.pinchRatio > PINCH_OFF) this.pinched = false;
  }
}

/**
 * Splits the readings between the left (chords) and right zone. Two hands go left-most to the left even when
 * both are in one half; a lone hand goes to the nearer of the two zones' hands when both are in view, else by
 * the half it is in. `left` and `right` are where each zone's hand was last seen, null if it is gone.
 */
export function splitHands(
  readings: HandReading[],
  mid: number,
  left: Point | null,
  right: Point | null,
): [HandReading | undefined, HandReading | undefined] {
  if (readings.length > 1) {
    const byX = [...readings].sort((a, b) => a.center.x - b.center.x);
    return [byX[0], byX[byX.length - 1]];
  }
  const r = readings[0];
  if (!r) return [undefined, undefined];
  const toLeft = left && right ? dist(r.center, left) <= dist(r.center, right) : r.center.x < mid;
  return toLeft ? [r, undefined] : [undefined, r];
}

export type StrumDirection = "down" | "up";

/**
 * Strums from the raw hand center: one fires when the hand gets from beyond one edge of the strings' band to
 * beyond the other, however far it moved in a frame. Inside the band the side holds, so jitter can't retrigger.
 */
export class StrumTracker {
  side: "above" | "below" | null = null;
  private lastY = 0;
  private lastAt = -Infinity;

  /**
   * Feeds one reading: `y` from the strings' middle in px (positive = below), seen at `at`, `reach` the band's
   * half height. Returns the strum it makes, with the hand's speed in px per ms, or null.
   */
  update(y: number, at: number, reach: number): { direction: StrumDirection; speed: number } | null {
    const dt = at - this.lastAt;
    if (dt <= 0) return null; // nothing new since the last reading
    const fromY = this.lastY;
    this.lastY = y;
    this.lastAt = at;
    // A hand that shows up after a while only takes its side; it has to cross to strum.
    if (dt > STRUM_REGRAB_MS) this.side = null;
    const side = y < -reach ? "above" : y > reach ? "below" : null;
    if (!side || side === this.side) return null;
    const crossed = this.side !== null;
    this.side = side;
    return crossed ? { direction: side === "below" ? "down" : "up", speed: Math.abs(y - fromY) / dt } : null;
  }

  /** Forgets the side, so the next reading takes one without strumming. */
  reset() {
    this.side = null;
  }
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
