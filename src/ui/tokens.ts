// The single source of colors and visual tokens. The 2D UI turns these into CSS
// variables; the future 3D scene should import the same values (hex numbers below).
// Palette rules: no orange/amber. Navy/charcoal base, muted rose-brown and greys for
// Mars, cyan/teal accent, yellow warning, red-magenta danger, green-teal ok.

export const colors = {
  // Session 5: lighter navy so surfaces separate clearly (was #0e1424 / #161f35).
  bg: '#1d2745',
  bgDeep: '#151d36',
  surface: '#28345a',
  surface2: '#34426d',
  border: '#56679a',
  text: '#f3f5fa',
  textDim: '#bcc5da',
  marsRose: '#b08884',
  marsBrown: '#7d5f5c',
  marsDust: '#c9b3ae',
  marsGround: '#9a7a76',
  grey: '#8a93a8',
  accent: '#38d0d6',
  accentDim: '#1f7f86',
  ok: '#3ccf9e',
  warn: '#f0d64a',
  danger: '#e2457f',
  night: '#0b1228',
  sky: '#c7a9a6',
  skyEvent: '#b98ab8',
  plant: '#4fae84',
  original: '#bcc5da',
  alt: '#38d0d6',
  // First-person world (session 6). Pale pink-violet Mars sky, never orange.
  skyTop: '#a995b4',
  skyHorizon: '#d9bfb8',
  skyStormTop: '#a8918f',
  skyStormHorizon: '#bfa49e',
  skyEventTop: '#8f6fa4',
  skyEventHorizon: '#cfa2c4',
  skyNightTop: '#0b1228',
  skyNightHorizon: '#2b2745',
  hull: '#dfe2ea',
  hullDark: '#9aa1b3',
  metal: '#6c7488',
  panelCell: '#2f4f8f',
  suit: '#eef0f5',
  filterNew: '#f3f5fa',
  filterDirty: '#6e5a57',
  tape: '#b8c0cc',
} as const;

export type ColorName = keyof typeof colors;

/** Same colors as numbers for three.js (0xRRGGBB). */
export const colorHex: Record<ColorName, number> = Object.fromEntries(
  Object.entries(colors).map(([k, v]) => [k, parseInt(v.slice(1), 16)]),
) as Record<ColorName, number>;

export const statusColor = {
  ok: colors.ok,
  low: colors.warn,
  critical: colors.danger,
  empty: colors.danger,
} as const;

/** Status is never conveyed by color alone: each has an icon too. */
export const statusIcon = {
  ok: '✓',
  low: '▼',
  critical: '⚠',
  empty: '✕',
} as const;

export const resourceIcon = {
  power: '⚡',
  life: '💧',
  shield: '🛡',
  health: '♥',
  dose: '☢',
  hours: '⏱',
} as const;

/** Inventory icons (the name is always given too, as label/tooltip). */
export const itemIcon: Record<string, string> = {
  patchKit: '🧰',
  spareFilter: '🌀',
  tape: '🎞',
};

export const radius = 10;
export const font = 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", sans-serif';

export function cssVariables(): string {
  return Object.entries(colors)
    .map(([k, v]) => `--c-${k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}: ${v};`)
    .join('\n');
}
