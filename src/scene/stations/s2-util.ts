// Small shared helpers for the shelter, airlock and landing stations (presentation only).
import * as THREE from 'three';
import type { WorkLook } from '../look';

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Deterministic 0..1 hash (no Math.random: the world looks the same every time). */
export function hash1(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** How often a maintenance job was done, if the work look carries routine counts (optional field). */
export function routineCount(w: WorkLook, id: string): number {
  const r = (w as WorkLook & { routines?: Record<string, number> }).routines;
  const n = r?.[id];
  return typeof n === 'number' && n > 0 ? n : 0;
}

/** Canvas texture drawn once. Returns null if a canvas cannot be made (the scene never throws). */
export function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat = false): THREE.CanvasTexture | null {
  try {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    if (!g) return null;
    draw(g);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  } catch {
    return null;
  }
}

/** Instance placement on a ring around the local origin, facing the centre. */
export interface Slot {
  phi: number;
  r: number;
  y: number;
  /** Small yaw / scale jitter so repeated parts do not look stamped. */
  yaw: number;
  s: number;
}

const tmpO = new THREE.Object3D();

/** Writes the matrix of `slot` into instance `i`; `drop` 0..1 lifts it up and inwards (it is being placed). */
export function setSlot(mesh: THREE.InstancedMesh, i: number, slot: Slot, drop = 0, lift = 0.6, inward = 0.35) {
  const r = slot.r - drop * inward;
  tmpO.position.set(Math.cos(slot.phi) * r, slot.y + drop * lift, Math.sin(slot.phi) * r);
  tmpO.rotation.set(drop * 0.5, -slot.phi - Math.PI / 2 + slot.yaw, 0);
  tmpO.scale.setScalar(slot.s);
  tmpO.updateMatrix();
  mesh.setMatrixAt(i, tmpO.matrix);
}

/** Shows `count` instances (fractional: the last one is being placed) and keeps the matrices right. */
export function showSlots(mesh: THREE.InstancedMesh | null, slots: Slot[], count: number, lift = 0.6, inward = 0.35) {
  if (!mesh) return;
  const c = Math.max(0, Math.min(slots.length, count));
  // Nothing moves: skip the upload.
  if (mesh.userData.shown === c && c === Math.floor(c)) return;
  mesh.userData.shown = c;
  const n = Math.floor(c);
  const f = c - n;
  const shown = f > 0.001 && n < slots.length ? n + 1 : n;
  // Restore a small window below the newest one (it may have been mid-drop last frame).
  for (let i = Math.max(0, n - 3); i < n; i++) setSlot(mesh, i, slots[i]!, 0, lift, inward);
  if (shown > n) {
    const e = f * f * (3 - 2 * f);
    setSlot(mesh, n, slots[n]!, 1 - e, lift, inward);
  }
  mesh.count = shown;
  mesh.instanceMatrix.needsUpdate = true;
}

/** Places all slots at rest (call once after mount). */
export function initSlots(mesh: THREE.InstancedMesh | null, slots: Slot[]) {
  if (!mesh) return;
  for (let i = 0; i < slots.length; i++) setSlot(mesh, i, slots[i]!, 0);
  mesh.instanceMatrix.needsUpdate = true;
}

/** Centre-out order for n items in a row (the work point fills first). */
export function centreOut(n: number): number[] {
  const out: number[] = [];
  const mid = (n - 1) / 2;
  const idx = Array.from({ length: n }, (_, i) => i);
  idx.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid) || a - b);
  for (const i of idx) out.push(i);
  return out;
}
