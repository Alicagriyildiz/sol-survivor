// First-person world layout: where stations are, where the astronaut stands to work,
// and the fixed walking paths. Pure (no three.js), tested in tests/world.test.ts.
//
// Units are metres. x to the east, z to the south, y up (three.js axes).
// The habitat is one round room (radius HAB_R) at the origin. Work points sit on its wall;
// the airlock tunnel leaves to the east, the greenhouse dome is west, the buried shelter
// south-west. Solar field and landing pad are far outside (EVA).

export type V2 = [number, number];
export type V3 = [number, number, number];

export const HAB_R = 6;
export const WALL_H = 3;
export const EYE = 1.6;

/** Point on the hab wall at angle `deg` (0 = east, 90 = north), at height y, `inset` metres inside. */
export function wallPoint(deg: number, y: number, inset = 0): V3 {
  const a = (deg * Math.PI) / 180;
  const r = HAB_R - inset;
  return [Math.cos(a) * r, y, -Math.sin(a) * r];
}

export interface Spot {
  /** Where the astronaut stands (eye at EYE). */
  stand: V2;
  /** What the camera faces on arrival (the work point). */
  look: V3;
  /** Close-up camera for doing the job. */
  work: { pos: V3; look: V3 };
  /** Floating name label (world position). */
  label: V3;
  outside: boolean;
}

export const AIRLOCK_IN: V2 = [HAB_R - 0.3, 0];
export const AIRLOCK_OUT: V2 = [12.2, 0];

export const SOLAR_AT: V2 = [27, -15];
/** The panel the player works on (front-left of the field). */
export const WORK_PANEL: V3 = [22, 0.95, -12.8];
/** Solar field grid: rows along x, the front row (largest z) nearest the path. */
export const PANEL_ROWS = 3;
export const PANEL_COLS = 6;
export const PANEL_W = 1.8;
export const PANEL_H = 1.1;
/** Panel tilt towards the south (+z), radians from flat. */
export const PANEL_TILT = 0.45;
export function panelAt(row: number, col: number): V3 {
  return [SOLAR_AT[0] + (col - (PANEL_COLS - 1) / 2) * 2.0, 0.95, SOLAR_AT[1] + (row - (PANEL_ROWS - 1) / 2) * 2.2];
}
export const LANDING_AT: V2 = [30, 20];
export const GREENHOUSE_AT: V2 = [-12.5, 0];
export const GREENHOUSE_R = 4.4;
/** Buried shelter: a small round room out along the 235° ray from the hab, reached by a tunnel. */
export const SHELTER_DEG = 225;
export const SHELTER_DIST = 12;
export const SHELTER_R = 2.4;
export const SHELTER_H = 2.2;
const sDir: V2 = [Math.cos((SHELTER_DEG * Math.PI) / 180), -Math.sin((SHELTER_DEG * Math.PI) / 180)];
export const SHELTER_AT: V2 = [sDir[0] * SHELTER_DIST, sDir[1] * SHELTER_DIST];
/** Battery rack: on the hab wall at this angle. */
export const BATTERY_DEG = 40;

export const SPOTS: Record<string, Spot> = {
  hub: {
    stand: [0, -3.2],
    look: [0, 1.25, -5.6],
    work: { pos: [-0.15, 1.45, -4.2], look: [-0.15, 1.2, -5.7] },
    label: [0, 2.75, -5.4],
    outside: false,
  },
  battery: {
    stand: [2.6, -2.4],
    look: wallPoint(40, 1.2, 0.6),
    work: { pos: wallPoint(40, 1.5, 1.8), look: wallPoint(40, 1.0, 0.6) },
    label: wallPoint(40, 2.7, 0.6),
    outside: false,
  },
  shelter: {
    // Inside the shelter room, facing its far (outer) wall, where the thick wall is built.
    stand: [SHELTER_AT[0] - sDir[0] * 0.9, SHELTER_AT[1] - sDir[1] * 0.9],
    look: [SHELTER_AT[0] + sDir[0] * 2.0, 1.0, SHELTER_AT[1] + sDir[1] * 2.0],
    work: { pos: [SHELTER_AT[0] + sDir[0] * 0.5, 1.45, SHELTER_AT[1] + sDir[1] * 0.5], look: [SHELTER_AT[0] + sDir[0] * 2.2, 0.8, SHELTER_AT[1] + sDir[1] * 2.2] },
    label: [SHELTER_AT[0], SHELTER_H + 1.6, SHELTER_AT[1]],
    outside: false,
  },
  greenhouse: {
    stand: [-11.0, 0.4],
    look: [-14.2, 0.9, -0.6],
    work: { pos: [-12.7, 1.5, -0.3], look: [-14.2, 0.8, -0.6] },
    label: [-12.5, 3.2, 0],
    outside: false,
  },
  airlock: {
    stand: [8.6, 0],
    look: [11.9, 1.2, 0],
    work: { pos: [10.6, 1.45, 0], look: [12.0, 1.2, 0] },
    label: [10.5, 2.5, 0],
    outside: false,
  },
  solar: {
    stand: [21.2, -9.2],
    look: WORK_PANEL,
    // Face-on, 1.45 m along the panel normal (tilted towards +z).
    work: { pos: [22.0, 0.95 + 1.45 * Math.cos(0.45), -12.8 + 1.45 * Math.sin(0.45)], look: [22.0, 0.95, -12.8] },
    label: [27, 3.0, -15],
    outside: true,
  },
  landing: {
    stand: [25.6, 15.2],
    look: [30, 0.2, 20],
    work: { pos: [27.4, 1.7, 17.0], look: [29.4, 0.1, 19.4] },
    label: [30, 3.2, 20],
    outside: true,
  },
};

/** Faults whose job is the hand-wipe of the solar work panel. */
export const PANEL_WIPE_FAULTS = ['s4_dust', 's11_panels'];
/** Radiator next to the solar field (Sol 14 variant). */
export const RADIATOR: V3 = [18.6, 0, -11.6];
/** Close-up poses for jobs that are not at the station's main work object, keyed `station:faultId`. */
const HUB_PANEL = { pos: [0.15, 1.7, -3.95] as V3, look: [0.15, 1.5, -5.6] as V3 };
export const FAULT_WORK: Record<string, { pos: V3; look: V3 }> = {
  'solar:s14_radiator': { pos: [18.6, 1.75, -10.0], look: [18.6, 0.85, -11.6] },
  // Hub bay: fans, levers and screen (switch / console / plug jobs), pump at the bottom.
  'hub:s1_wakeup': HUB_PANEL,
  'hub:s4_dust': HUB_PANEL,
  'hub:s5_oxygen': HUB_PANEL,
  'hub:s7_message': HUB_PANEL,
  'hub:s15_beacon': { pos: [0.4, 1.35, -4.2], look: [0.45, 0.9, -5.6] },
  'hub:s2_pump': { pos: [-0.15, 1.3, -4.25], look: [-0.15, 0.55, -5.4] },
  // Shelter: seated on the bench during the solar event; heater close-up.
  'shelter:s12_spe': { pos: [-9.48, 1.15, 7.05], look: [-10.25, 1.35, 9.83] },
  'shelter:s9_shed': { pos: [-8.79, 1.5, 9.33], look: [-9.28, 1.55, 10.69] },
  'airlock:s13_leakA': { pos: [10.75, 1.4, -0.35], look: [11.85, 1.05, -1.0] },
  'airlock:s8_secure': { pos: [10.8, 1.35, 0.35], look: [11.85, 0.75, 0.95] },
  'airlock:s12_spe': { pos: [10.2, 1.4, 0.3], look: [11.3, 0.55, -0.78] },
  'greenhouse:s13_leakB': { pos: [-14.6, 1.55, -0.75], look: [-16.5, 1.3, -1.2] },
  'battery:s14_pump': { pos: [2.83, 1.5, -3.09], look: [3.8, 0.55, -4.1] },
  'battery:s14_radiator': { pos: [2.83, 1.5, -3.09], look: [3.8, 0.55, -4.1] },
};

/** Waypoint graph (a tree). Inside walks go through the hab centre; EVAs through the airlock. */
const NODES: Record<string, V2> = {
  centre: [0, 0],
  shHatch: [sDir[0] * (HAB_R - 0.6), sDir[1] * (HAB_R - 0.6)],
  ghDoor: [-HAB_R - 0.6, 0],
  alIn: AIRLOCK_IN,
  alOut: AIRLOCK_OUT,
  solarPath: [17.5, -5.0],
  landingPath: [18.5, 7.0],
};
const EDGES: [string, string][] = [
  ['centre', 'hub'],
  ['centre', 'battery'],
  ['centre', 'shHatch'],
  ['shHatch', 'shelter'],
  ['centre', 'ghDoor'],
  ['ghDoor', 'greenhouse'],
  ['centre', 'alIn'],
  ['alIn', 'airlock'],
  ['airlock', 'alOut'],
  ['alOut', 'solarPath'],
  ['solarPath', 'solar'],
  ['alOut', 'landingPath'],
  ['landingPath', 'landing'],
];

const nodePos = (id: string): V2 => SPOTS[id]?.stand ?? NODES[id] ?? NODES.centre!;

/** Waypoints from one station to another, both ends included. Unknown ids walk from/to the hub. */
export function path(from: string, to: string): V2[] {
  const a = SPOTS[from] ? from : 'hub';
  const b = SPOTS[to] ? to : 'hub';
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

export const dist2 = (a: V2, b: V2) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function pathLength(pts: V2[]): number {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += dist2(pts[i - 1]!, pts[i]!);
  return d;
}

/** Walk time in seconds: short and capped (the hours cost is in the panel, not in the wait). */
export function walkSeconds(pts: V2[]): number {
  const d = pathLength(pts);
  if (d === 0) return 0;
  return Math.min(3.2, 0.6 + d / 8);
}

/** Point at fraction t (0..1) of the path, by distance. */
export function pointAt(pts: V2[], t: number): V2 {
  if (pts.length === 1 || t <= 0) return pts[0]!;
  const total = pathLength(pts);
  let left = Math.min(1, t) * total;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const d = dist2(a, b);
    if (left <= d || i === pts.length - 1) {
      const k = d === 0 ? 1 : Math.min(1, left / d);
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    }
    left -= d;
  }
  return pts[pts.length - 1]!;
}

/** Camera yaw (rotation about y, three.js 'YXZ' order) that faces from `from` towards `to`. */
export const yawTo = (from: V2, to: V2) => Math.atan2(-(to[0] - from[0]), -(to[1] - from[1]));

/** Camera pitch that looks from eye height at `from` towards a point at height y. */
export const pitchTo = (from: V3, to: V3) => Math.atan2(to[1] - from[1], Math.hypot(to[0] - from[0], to[2] - from[2]));

/** Shortest signed angle from a to b. */
export function angleDelta(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Look limits: free yaw, limited pitch. */
export const PITCH_MIN = -1.05;
export const PITCH_MAX = 0.65;
export const clampPitch = (p: number) => Math.max(PITCH_MIN, Math.min(PITCH_MAX, p));

// ------------------------------------------------------------------ terrain

/** Deterministic value noise (no Math.random): the world looks the same every time. */
function hash(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function smoothNoise(x: number, z: number): number {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi);
  const b = hash(xi + 1, zi);
  const c = hash(xi, zi + 1);
  const d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Ground height. Flat where people walk and build, bumpy around, hills far away. */
export function groundHeight(x: number, z: number): number {
  const r = Math.hypot(x - 10, z);
  const bumps = (smoothNoise(x * 0.18, z * 0.18) - 0.5) * 0.9 + (smoothNoise(x * 0.6, z * 0.6) - 0.5) * 0.18;
  const flat = Math.min(1, Math.max(0, (r - 26) / 18));
  const near = 0.12 + 0.88 * flat;
  const hills = Math.max(0, r - 75) / 90;
  const big = smoothNoise(x * 0.02 + 7, z * 0.02 - 3) * 34 * Math.min(1, hills) + hills * hills * 10;
  return bumps * near + big;
}
