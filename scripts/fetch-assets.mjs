// Copies the MediaPipe wasm runtime into public/ and downloads the hand model,
// so the app can run without hitting a CDN at runtime.
import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const MODEL_PATH = "public/models/hand_landmarker.task";

cpSync("node_modules/@mediapipe/tasks-vision/wasm", "public/mediapipe/wasm", { recursive: true });

if (!existsSync(MODEL_PATH)) {
  mkdirSync("public/models", { recursive: true });
  const res = await fetch(MODEL_URL);
  if (!res.ok) throw new Error(`Model download failed: ${res.status}`);
  writeFileSync(MODEL_PATH, Buffer.from(await res.arrayBuffer()));
}
console.log("MediaPipe assets ready.");
