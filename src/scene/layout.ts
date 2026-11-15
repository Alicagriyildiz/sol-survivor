// Where things are in the 3D base, and the fixed walking paths between stations.
// Pure (no three.js): tested in tests/scene.test.ts.
//
// Coordinates are given in screen-like (u, v): u to the right, v away from the camera.
// The camera looks from the (+x, +y, +z) diagonal, so world x = (u - v)/√2, z = -(u + v)/√2.

export interface P2 {
  u: number;
  v: number;
}

export interface StationPlace {
  /** Center of the building. */
  at: P2;
  /** Where the astronaut stands to work there (a waypoint). */
  stand: P2;
  /** Height of the name label above the ground. */
  labelY: number;
}

/** Wide screens spread the outside stations left and right; narrow (phone) screens put
 *  them behind the base so the scene fits a portrait screen. The cluster is the same. */
export type Mode = 'wide' | 'compact';

/** The base cluster around the hub; solar field and landing pad far outside (EVA). */
export const PLACES: Record<string, StationPlace> = {
  hub: { at: { u: 0, v: 0.6 }, stand: { u: 0, v: -1.5 }, labelY: 3.1 },
  greenhouse: { at: { u: -4.4, v: 0.9 }, stand: { u: -3.5, v: -0.9 }, labelY: 2.6 },
  shelter: { at: { u: -2.6, v: -3.4 }, stand: { u: -1.2, v: -3.0 }, labelY: 1.9 },
  battery: { at: { u: 4.2, v: 0.2 }, stand: { u: 3.0, v: -1.5 }, labelY: 2.3 },
  airlock: { at: { u: 2.4, v: 4.6 }, stand: { u: 3.6, v: 3.6 }, labelY: 1.9 },
  solar: { at: { u: -9.6, v: 9.2 }, stand: { u: -7.6, v: 8.0 }, labelY: 2.0 },
  landing: { at: { u: 9.8, v: 9.2 }, stand: { u: 7.9, v: 8.2 }, labelY: 1.6 },
};

const COMPACT: Record<string, StationPlace> = {
  ...PLACES,
  solar: { at: { u: -3.6, v: 11.2 }, stand: { u: -2.0, v: 9.6 }, labelY: 2.0 },
  landing: { at: { u: 4.2, v: 11.4 }, stand: { u: 3.0, v: 9.6 }, labelY: 1.6 },
};

export const places = (mode: Mode = 'wide') => (mode === 'compact' ? COMPACT : PLACES);

/** Extra waypoint outside the airlock door. */
const DOOR: Record<Mode, P2> = { wide: { u: 4.2, v: 6.0 }, compact: { u: 3.4, v: 6.6 } };

/** Waypoint graph (a tree): every inside walk goes through the hub, every EVA through the airlock door. */
const EDGES: [string, string][] = [
  ['hub', 'greenhouse'],
  ['hub', 'shelter'],
  ['hub', 'battery'],
  ['hub', 'airlock'],
  ['airlock', 'door'],
  ['door', 'solar'],
  ['door', 'landing'],
];

/** Waypoints from one station to another (both ends included). Unknown ids walk from/to the hub. */
export function path(from: string, to: string, mode: Mode = 'wide'): P2[] {
  const pl = places(mode);
  const nodePos = (id: string): P2 => (id === 'door' ? DOOR[mode] : (pl[id]?.stand ?? pl.hub!.stand));
  const a = PLACES[from] ? from : 'hub';
  const b = PLACES[to] ? to : 'hub';
  if (a === b) return [nodePos(a)];
  const prev = new Map<string, string | null>([[a, null]]);
  const queue = [a];
  while (queue.length) {
    const n = queue.shift()!;
    if (n === b) break;
    for (const [x, y] of EDGES) {
      const next = x === n ? y : y === n ? x : null;
      if (next && !prev.has(next)) {
        prev.set(next, n);
        queue.push(next);
      }
    }
  }
  const ids: string[] = [];
  for (let n: string | null = b; n; n = prev.get(n) ?? null) ids.unshift(n);
  return ids.map(nodePos);
}

export const dist = (a: P2, b: P2) => Math.hypot(a.u - b.u, a.v - b.v);

export function pathLength(pts: P2[]): number {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += dist(pts[i - 1]!, pts[i]!);
  return d;
}

/** Walk time in seconds: proportional to distance, never longer than 1.5 s. */
export function walkSeconds(pts: P2[]): number {
  const d = pathLength(pts);
  if (d === 0) return 0;
  return Math.min(1.5, 0.45 + d * 0.05);
}

/** Point at fraction t (0..1) of the path, by distance. */
export function pointAt(pts: P2[], t: number): P2 {
  if (pts.length === 1 || t <= 0) return pts[0]!;
  const total = pathLength(pts);
  let left = Math.min(1, t) * total;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const d = dist(a, b);
    if (left <= d || i === pts.length - 1) {
      const k = d === 0 ? 1 : Math.min(1, left / d);
      return { u: a.u + (b.u - a.u) * k, v: a.v + (b.v - a.v) * k };
    }
    left -= d;
  }
  return pts[pts.length - 1]!;
}

/** (u, v) -> world (x, z). */
export function toWorld(p: P2): [number, number] {
  const s = Math.SQRT1_2;
  return [(p.u - p.v) * s, -(p.u + p.v) * s];
}

// ------------------------------------------------------------------ fixed camera

/** Camera position relative to the point it looks at (isometric-like, from the +x+z diagonal). */
export const CAMERA_OFFSET: [number, number, number] = [30, 31.5, 30];
/** The point the camera looks at, in (u, v), and the scene size to fit (world units across and up). */
export const FRAME: Record<Mode, { center: P2; fitW: number; fitH: number }> = {
  wide: { center: { u: 0, v: 3.6 }, fitW: 26.5, fitH: 13.2 },
  compact: { center: { u: 0, v: 4.4 }, fitW: 14, fitH: 12.6 },
};

/** Narrow screens use the compact layout. */
export const modeFor = (w: number): Mode => (w < 640 ? 'compact' : 'wide');

/** Orthographic zoom (pixels per world unit) that fits the whole base in w × h pixels. */
export function fitZoom(w: number, h: number, mode: Mode = modeFor(w)): number {
  const f = FRAME[mode];
  return Math.max(8, Math.min(w / f.fitW, h / f.fitH));
}

const norm = (v: [number, number, number]): [number, number, number] => {
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
};
const VIEW = norm(CAMERA_OFFSET);
const RIGHT: [number, number, number] = norm([VIEW[2], 0, -VIEW[0]]);
const UP = norm([-VIEW[1] * VIEW[0], 1 - VIEW[1] * VIEW[1], -VIEW[1] * VIEW[2]]);

/** Screen pixel position of a point (u, v) at height y, for the fixed orthographic camera. */
export function project(p: P2, y: number, zoom: number, w: number, h: number, mode: Mode = modeFor(w)): [number, number] {
  const [x, z] = toWorld(p);
  const [cx, cz] = toWorld(FRAME[mode].center);
  const d: [number, number, number] = [x - cx, y, z - cz];
  const sx = d[0] * RIGHT[0] + d[1] * RIGHT[1] + d[2] * RIGHT[2];
  const sy = d[0] * UP[0] + d[1] * UP[1] + d[2] * UP[2];
  return [w / 2 + sx * zoom, h / 2 - sy * zoom];
}
