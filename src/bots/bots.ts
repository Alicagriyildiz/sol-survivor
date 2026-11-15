// Balance bots. Each policy picks the next action from the state; bots never peek at
// hidden data (rolls, pending effects) except the careful bot's one-night lookahead,
// which mirrors what a player sees in the option texts.
import type { Engine } from '../sim/engine';
import { createRng, mixSeed, type Rng } from '../sim/rng';
import { RESOURCES, type Action, type GameState, type MissionConfig, type OptionDef, type ResourceId } from '../sim/types';

export type Policy = (s: GameState, engine: Engine, rng: Rng) => Action;
export type BotName = 'random' | 'cheapest' | 'robust' | 'careful' | 'idle';

export interface GameRun {
  seed: number;
  actions: Action[];
  final: GameState;
}

export function playGame(engine: Engine, policy: Policy, seed: number, config: MissionConfig, salt = 1): GameRun {
  const rng = createRng(mixSeed(seed, salt));
  let s = engine.init(seed, config);
  const actions: Action[] = [];
  let guard = 0;
  while (!s.outcome) {
    const a = policy(s, engine, rng);
    s = engine.step(s, a);
    actions.push(a);
    if (++guard > 2000) throw new Error('bot did not finish');
  }
  return { seed, actions, final: s };
}

/** Continue an existing state with a policy (used by the Black Box autopilot). */
export function continueGame(engine: Engine, policy: Policy, s: GameState, rng: Rng): { actions: Action[]; final: GameState } {
  const actions: Action[] = [];
  let guard = 0;
  while (!s.outcome) {
    const a = policy(s, engine, rng);
    s = engine.step(s, a);
    actions.push(a);
    if (++guard > 2000) throw new Error('autopilot did not finish');
  }
  return { actions, final: s };
}

const resolveActions = (s: GameState, engine: Engine) =>
  engine.validActions(s).filter((a): a is Extract<Action, { type: 'resolve' }> => a.type === 'resolve');

/** Which resource (or health) a routine raises, read from its effects. */
function routineTarget(engine: Engine, id: string): ResourceId | 'health' | null {
  for (const e of engine.routine(id).effects) {
    if (e.kind === 'res' && typeof e.amount === 'number' && e.amount > 0) return e.res;
    if (e.kind === 'health' && typeof e.amount === 'number' && e.amount > 0) return 'health';
  }
  return null;
}

/** Shared "use spare hours" behaviour: boost the weakest gauge, else end the sol. */
function spareHours(s: GameState, engine: Engine, prefer: 'weakest' | 'none'): Action {
  if (prefer === 'none') return { type: 'endSol' };
  const routines = engine.validActions(s).filter((a): a is Extract<Action, { type: 'routine' }> => a.type === 'routine');
  if (routines.length === 0) return { type: 'endSol' };
  const need = (t: ResourceId | 'health' | null): number => {
    if (t === null) return -1;
    if (t === 'health') return s.health < 70 ? 100 - s.health : -1;
    return 100 - s.res[t];
  };
  let best: Action | null = null;
  let bestNeed = 5;
  for (const r of routines) {
    const t = routineTarget(engine, r.routineId);
    // avoid EVA routines unless power is the clear need
    const cost = engine.routineCost(s, r.routineId);
    const n = need(t) - (cost.evaTrip ? 15 : 0);
    if (n > bestNeed) {
      bestNeed = n;
      best = r;
    }
  }
  return best ?? { type: 'endSol' };
}

// ---------------------------------------------------------------- random

/** Chance per spare-hours step that the random bot simply ends the sol. */
export const RANDOM_END_EARLY = 0.15;

export const randomBot: Policy = (s, engine, rng) => {
  const fault = s.faults[0];
  if (fault) {
    const opts = resolveActions(s, engine).filter((a) => a.faultId === fault.faultId);
    if (opts.length > 0) return opts[rng.int(0, opts.length - 1)]!;
  }
  // Faults it cannot afford stay open and get auto-deferred. Spare hours go to random
  // routines; like a child clicking around, it sometimes ends the sol early.
  const routines = engine.validActions(s).filter((a) => a.type === 'routine');
  if (routines.length === 0 || rng.next() < RANDOM_END_EARLY) return { type: 'endSol' };
  return routines[rng.int(0, routines.length - 1)]!;
};

// ---------------------------------------------------------------- cheapest

function immediateCost(s: GameState, engine: Engine, a: Extract<Action, { type: 'resolve' }>): number {
  const n = engine.step(s, a);
  let c = s.hoursLeft - n.hoursLeft;
  for (const r of RESOURCES) c += Math.max(0, s.res[r] - n.res[r]);
  c += 2 * Math.max(0, s.health - n.health);
  for (const [, k] of Object.entries(engine.option(a.faultId, a.optionId).items ?? {})) c += 5 * k;
  return c;
}

export const cheapestBot: Policy = (s, engine) => {
  const fault = s.faults[0];
  if (fault) {
    const opts = resolveActions(s, engine).filter((a) => a.faultId === fault.faultId);
    let best = opts[0];
    let bestCost = Infinity;
    for (const a of opts) {
      const c = immediateCost(s, engine, a);
      if (c < bestCost) {
        bestCost = c;
        best = a;
      }
    }
    if (best) return best;
  }
  return spareHours(s, engine, 'weakest');
};

// ---------------------------------------------------------------- robust

const KIND_ORDER: OptionDef['kind'][] = ['robust', 'creative', 'quick', 'defer'];

export const robustBot: Policy = (s, engine) => {
  for (const f of s.faults) {
    const opts = resolveActions(s, engine).filter((a) => a.faultId === f.faultId);
    for (const kind of KIND_ORDER) {
      const a = opts.find((o) => engine.option(o.faultId, o.optionId).kind === kind);
      if (a) return a;
    }
  }
  return spareHours(s, engine, 'weakest');
};

// ---------------------------------------------------------------- careful

/** Value of a state for the careful bot: health plus concave resource utility. */
export function stateValue(s: GameState): number {
  if (s.outcome && !s.outcome.won) return -1000;
  let v = s.health * 1.2 - s.dose * 0.3;
  for (const r of RESOURCES) {
    const x = s.res[r];
    v += Math.min(x, 60) + (x < 35 ? (x - 35) * 1.5 : 0);
  }
  return v;
}

/** What the player can see before choosing: the option's immediate effect on the gauges
 *  and the hours it costs. Delayed effects are only known through the hint tags.
 *  Like the UI preview (selectors.previewParts), an emergency reserve that the option
 *  would trigger is NOT counted as a gain: the card shows it as a separate warning
 *  ("this reserve is used only once"), so a careful player avoids burning it. */
function lookahead(s: GameState, engine: Engine, a: Action): number {
  const after = engine.step(s, a);
  let v = stateValue(after) + after.hoursLeft * HOUR_VALUE;
  const rv = s.config.rules.reserve;
  for (const r of after.reservesUsed) {
    if (s.reservesUsed.includes(r)) continue;
    const without = Math.max(0, after.res[r] - rv.amount);
    v -= Math.min(after.res[r], 60) - Math.min(without, 60) + RESERVE_SPENT;
  }
  return v;
}
/** How much a careful player dislikes spending a one-time reserve. */
const RESERVE_SPENT = 5;
const HOUR_VALUE = 1.5;

export const carefulBot: Policy = (s, engine) => {
  for (const f of s.faults) {
    const opts = resolveActions(s, engine).filter((a) => a.faultId === f.faultId);
    if (opts.length === 0) continue;
    let best = opts[0]!;
    let bestV = -Infinity;
    for (const a of opts) {
      const tags = engine.option(a.faultId, a.optionId).tags ?? [];
      let v = lookahead(s, engine, a);
      if (tags.includes('invest')) v += 8;
      if (tags.includes('laterCost')) v -= 6;
      if (v > bestV) {
        bestV = v;
        best = a;
      }
    }
    return best;
  }
  return spareHours(s, engine, 'weakest');
};

// ---------------------------------------------------------------- idle

/** Does nothing: ends every sol at once, so every fault is deferred. Must never win:
 *  there is no free, safe choice. */
export const idleBot: Policy = () => ({ type: 'endSol' });

export const BOTS: Record<BotName, Policy> = {
  random: randomBot,
  cheapest: cheapestBot,
  robust: robustBot,
  careful: carefulBot,
  idle: idleBot,
};
