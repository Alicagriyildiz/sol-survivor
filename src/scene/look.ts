// What the 3D scene shows about the state. Pure and read-only: derived from GameState
// through the selectors; the scene keeps no game state of its own. No three.js here,
// so the simple view can import it without loading the 3D chunk.
import type { GameState } from '../sim/types';
import { resourceStatus } from '../sim/selectors';

export interface SceneLook {
  /** Base lights: on, dimmed (power low) or off (power critical/empty). */
  lights: 'on' | 'dim' | 'off';
  /** Dust storm: fog and dust, outside stations unreachable. */
  storm: boolean;
  /** Solar particle event day: the sky changes color. */
  solarEvent: boolean;
  /** Shelter wall reinforced (bigger mound). */
  shelterBig: boolean;
  /** Dust on the solar panels (matte panels). */
  panelsDusty: boolean;
  /** "End sol" was pressed: short night transition. */
  night: boolean;
}

// Content ids the scene reacts to (presentation only; the core does not know them).
const STORM_FLAG = 'storm';
const SHELTER_FLAGS = ['shelterReinforced', 'shelterWater'];
const DUST_MODIFIERS = /dust/i;
const SPE_FAULT = 's12_spe';
const SPE_SOL = 12;

export function sceneLook(s: GameState, night = false): SceneLook {
  const p = resourceStatus(s.res.power, s.config.rules);
  return {
    lights: p === 'ok' ? 'on' : p === 'low' ? 'dim' : 'off',
    storm: !!s.flags[STORM_FLAG]?.value,
    solarEvent: s.sol === SPE_SOL && !s.outcome && (s.faults.some((f) => f.faultId === SPE_FAULT) || s.decisions.some((d) => d.faultId === SPE_FAULT && d.sol === SPE_SOL)),
    shelterBig: SHELTER_FLAGS.some((f) => !!s.flags[f]?.value),
    panelsDusty: s.modifiers.some((m) => DUST_MODIFIERS.test(m.id) && (m.nightly.power ?? 0) < 0),
    night,
  };
}

// ------------------------------------------------------------------ work points

/** How each station's work object looks, from the state (so results stay in later sols).
 *  Presentation only: derived through the state, never stored by the scene. */
export interface WorkLook {
  /** Dust on the solar panels: 0 clean, 0.5 half, 1 dusty. */
  solarDust: number;
  /** Life-support filter in the hub rack. */
  filter: 'ok' | 'clogged' | 'new' | 'taped';
  /** Open fault at a station: its warning light is red and blinking. */
  alarm: Record<string, boolean>;
  /** Latest option chosen for each fault (any sol; 'defer' included). */
  chosen: Record<string, string>;
  /** Faults open right now. */
  open: string[];
  /** Sols an open fault has been waiting (0 = new today): deferred problems look worse. */
  age: Record<string, number>;
  /** Flags that are set (true). */
  flags: Record<string, boolean>;
  /** Modifiers active tonight (ids). */
  mods: string[];
  /** Base power: lights and screens. */
  power: 'on' | 'dim' | 'off';
  /** Battery charge 0..1 (Power resource / 100). */
  charge: number;
  sol: number;
  storm: boolean;
}

const HALF_DUST = /half/i;
const FILTER_FAULTS = ['s2_filter', 's10_co2'];

export function workLook(s: GameState, stationOf: (faultId: string) => string): WorkLook {
  let solarDust = 0;
  for (const m of s.modifiers) {
    if (DUST_MODIFIERS.test(m.id) && (m.nightly.power ?? 0) < 0) solarDust = Math.max(solarDust, HALF_DUST.test(m.id) ? 0.5 : 1);
  }
  const chosen: Record<string, string> = {};
  for (const d of s.decisions) chosen[d.faultId] = d.optionId;
  let filter: WorkLook['filter'] = 'ok';
  for (const d of s.decisions) {
    if (d.faultId === 's2_filter' && d.optionId === 'replace') filter = 'new';
    if (d.faultId === 's10_co2' && d.optionId === 'adapter') filter = 'new';
    if (d.faultId === 's10_co2' && d.optionId === 'apollo') filter = 'taped';
  }
  if (s.faults.some((f) => FILTER_FAULTS.includes(f.faultId))) filter = 'clogged';
  const alarm: Record<string, boolean> = {};
  const age: Record<string, number> = {};
  for (const f of s.faults) {
    alarm[stationOf(f.faultId)] = true;
    age[f.faultId] = Math.max(0, s.sol - f.firstSol);
  }
  const flags: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(s.flags)) if (v?.value) flags[k] = true;
  const p = resourceStatus(s.res.power, s.config.rules);
  return {
    solarDust,
    filter,
    alarm,
    chosen,
    open: s.faults.map((f) => f.faultId),
    age,
    flags,
    mods: s.modifiers.map((m) => m.id),
    power: p === 'ok' ? 'on' : p === 'low' ? 'dim' : 'off',
    charge: Math.max(0, Math.min(1, s.res.power / 100)),
    sol: s.sol,
    storm: !!s.flags[STORM_FLAG]?.value,
  };
}
