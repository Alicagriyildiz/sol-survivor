// The single source of colors and visual tokens. The 2D UI turns these into CSS
// variables; the future 3D scene should import the same values (hex numbers below).
// Palette rules: no orange/amber. Navy/charcoal base, muted rose-brown and greys for
// Mars, cyan/teal accent, yellow warning, red-magenta danger, green-teal ok.

export const colors = {
  bg: '#0e1424',
  bgDeep: '#0a0f1c',
  surface: '#161f35',
  surface2: '#1e2944',
  border: '#2d3a5c',
  text: '#e7eaf2',
  textDim: '#9ba5bd',
  marsRose: '#b08884',
  marsBrown: '#7d5f5c',
  marsDust: '#c9b3ae',
  grey: '#6f7890',
  accent: '#38d0d6',
  accentDim: '#1f7f86',
  ok: '#3ccf9e',
  warn: '#f0d64a',
  danger: '#e2457f',
  original: '#9ba5bd',
  alt: '#38d0d6',
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

export const radius = 10;
export const font = 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", sans-serif';

export function cssVariables(): string {
  return Object.entries(colors)
    .map(([k, v]) => `--c-${k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}: ${v};`)
    .join('\n');
}
