// Presentation shortcut ("Demo"): a fixed seed and a recorded action log, so the 3-minute
// demo path never depends on improvising. See docs/DEMO.md. It replays real game actions
// through the engine (no special rules); normal play is unaffected.
// Seed 148: Sol 2 clogged filter, Sol 4 heavy dust, Sol 12 = X8.2 flare of 10 Sep 2017.
// The log (task-line player who defers the Sol 6 shelter) loses on Sol 14 (Shield);
// the only single decision that rescues it is Sol 6 "regolith" (Black Box).
import { DEFAULT_CONFIG, engine } from '../content';
import type { Action, GameState } from '../sim/types';

export const DEMO_SEED = 148;

export const DEMO_LOG: Action[] = [{"type":"resolve","faultId":"s1_wakeup","optionId":"allAtOnce"},{"type":"resolve","faultId":"s1_seal","optionId":"wipe"},{"type":"routine","routineId":"bags"},{"type":"routine","routineId":"tune"},{"type":"endSol"},{"type":"resolve","faultId":"s2_filter","optionId":"replace"},{"type":"routine","routineId":"bags"},{"type":"routine","routineId":"tune"},{"type":"endSol"},{"type":"resolve","faultId":"s3_soil","optionId":"defer"},{"type":"routine","routineId":"bags"},{"type":"routine","routineId":"tune"},{"type":"routine","routineId":"tend"},{"type":"endSol"},{"type":"resolve","faultId":"s4_dust","optionId":"dim"},{"type":"routine","routineId":"bags"},{"type":"routine","routineId":"tend"},{"type":"routine","routineId":"tune"},{"type":"endSol"},{"type":"resolve","faultId":"s5_oxygen","optionId":"plants"},{"type":"routine","routineId":"tend"},{"type":"routine","routineId":"tune"},{"type":"endSol"},{"type":"resolve","faultId":"s6_shelter","optionId":"defer"},{"type":"routine","routineId":"bags"},{"type":"routine","routineId":"tend"},{"type":"routine","routineId":"tune"},{"type":"endSol"},{"type":"resolve","faultId":"s7_message","optionId":"report"},{"type":"routine","routineId":"tend"},{"type":"routine","routineId":"tune"},{"type":"endSol"},{"type":"resolve","faultId":"s8_charge","optionId":"full"},{"type":"resolve","faultId":"s8_secure","optionId":"defer"},{"type":"routine","routineId":"bags"},{"type":"endSol"},{"type":"resolve","faultId":"s9_shed","optionId":"shelterHeat"},{"type":"routine","routineId":"tune"},{"type":"routine","routineId":"bags"},{"type":"endSol"},{"type":"resolve","faultId":"s10_co2","optionId":"adapter"},{"type":"routine","routineId":"tune"},{"type":"endSol"},{"type":"resolve","faultId":"s11_panels","optionId":"halfClean"},{"type":"routine","routineId":"tune"},{"type":"endSol"},{"type":"resolve","faultId":"s12_spe","optionId":"hideShort"},{"type":"routine","routineId":"bags"},{"type":"routine","routineId":"tend"},{"type":"endSol"},{"type":"resolve","faultId":"s13_leakB","optionId":"sealOff"},{"type":"resolve","faultId":"s13_pad","optionId":"markPad"},{"type":"routine","routineId":"bags"},{"type":"endSol"},{"type":"resolve","faultId":"s14_pump","optionId":"borrowPump"},{"type":"routine","routineId":"bags"},{"type":"routine","routineId":"tend"},{"type":"endSol"}];

export type DemoStop = 4 | 6 | 12 | 'end';
export const DEMO_STOPS: DemoStop[] = [4, 6, 12, 'end'];

/** Replays the demo log up to the morning of `stop` (or to the end). */
export function demoState(stop: DemoStop): { state: GameState; actions: Action[] } {
  let state = engine.init(DEMO_SEED, DEFAULT_CONFIG);
  const actions: Action[] = [];
  for (const a of DEMO_LOG) {
    if (stop !== 'end' && state.sol >= stop) break;
    if (state.outcome) break;
    state = engine.step(state, a);
    actions.push(a);
  }
  return { state, actions };
}
