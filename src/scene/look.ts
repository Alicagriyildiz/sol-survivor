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
