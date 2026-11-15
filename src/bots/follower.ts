// "Follower" players: they do exactly what the 2D/3D screen points at on each level, and
// nothing more. Used to check that obeying the screen is not a win button (tests/commander.test.ts).
//
// Junior: the task line names one open fault (selectors.mission: the one here first, else
//   the first listed) and, all day, the weakest gauge (weakGauge below). The follower goes
//   to that fault and picks the card whose preview raises the named gauge most (ties: the
//   first card). When the faults are done it does the maintenance job that raises the named
//   gauge if it can, else ends the sol. The screen never names a card or a job; the
//   follower maps the gauge to them, as a child reading the arrows would.
// Commander: the screen makes no suggestions. The line lists the open faults in order;
//   the follower takes them in that order, first valid card each, then ends the sol.
import type { Level } from '../content/config';
import type { Engine } from '../sim/engine';
import { mission, optionViews } from '../sim/selectors';
import type { Action, GameState, ResourceId } from '../sim/types';
import type { Policy } from './bots';

const GAUGES: ResourceId[] = ['power', 'life', 'shield'];

/** The weakest of Power / Life Support / Shield (ties: listed order). Junior's task line
 *  shows it all day; it never names a card or a job. */
export function weakGauge(s: GameState): { res: ResourceId; value: number } {
  let res = GAUGES[0]!;
  for (const r of GAUGES) if (s.res[r] < s.res[res]) res = r;
  return { res, value: s.res[res] };
}

/** A valid card for a fault as the panel lists it (Sol 1 hides defer): the first one, or
 *  with `gauge` the one whose preview raises that gauge most (ties: listed order). */
function card(engine: Engine, s: GameState, faultId: string, gauge?: ResourceId): Action | null {
  const valid = optionViews(engine, s, faultId).filter((o) => o.invalid === null && !(s.sol === 1 && o.kind === 'defer'));
  let v = valid[0];
  if (gauge) for (const o of valid) if ((o.preview?.[gauge] ?? 0) > (v!.preview?.[gauge] ?? 0)) v = o;
  return v ? { type: 'resolve', faultId, optionId: v.optionId } : null;
}

/** Maintenance job (any station) that raises this gauge, if it can be done now. */
function jobFor(engine: Engine, s: GameState, res: ResourceId): Action | null {
  for (const r of engine.content.routines) {
    const raises = r.effects.some((e) => e.kind === 'res' && e.res === res && typeof e.amount === 'number' && e.amount > 0);
    const a: Action = { type: 'routine', routineId: r.id };
    if (raises && !engine.check(s, a)) return a;
  }
  return null;
}

export const juniorFollower: Policy = (s, engine) => {
  const m = mission(engine, s);
  if (m.kind === 'fault') return (m.fixable && card(engine, s, m.faultId, weakGauge(s).res)) || { type: 'endSol' };
  if (m.kind === 'done' && m.canWork) return jobFor(engine, s, weakGauge(s).res) ?? { type: 'endSol' };
  return { type: 'endSol' };
};

export const commanderFollower: Policy = (s, engine) => {
  for (const f of s.faults) {
    const a = card(engine, s, f.faultId);
    if (a) return a;
  }
  return { type: 'endSol' };
};

export const followerFor = (level: Level): Policy => (level === 'commander' ? commanderFollower : juniorFollower);
