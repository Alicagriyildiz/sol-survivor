// "Follow the task line" players: they do what the UI's mission line (selectors.mission)
// says, i.e. go to the named station and fix the named fault, and end the sol when the
// mission says done (or nothing affordable is left). They never do maintenance work.
// Used to measure whether simply obeying the UI (and picking the first card) wins.
import { mixSeed } from '../sim/rng';
import { mission, optionViews, type OptionView } from '../sim/selectors';
import type { Policy } from './bots';

/** random: any valid card. first: the first card as listed. shuffled: the first card after
 *  a per-mission shuffle with defer kept last; shuffledAll: defer shuffled in too (proposed
 *  UI order). fewestHours: the first card if cards were
 *  sorted by total hours (another possible UI order). */
export type MissionPick = 'random' | 'first' | 'shuffled' | 'shuffledAll' | 'fewestHours';

const hashStr = (t: string) => [...t].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

/** Deterministic per-(seed, fault) card order (a UI proposal); optionally defer kept last. */
export function shuffledOrder(seed: number, faultId: string, views: OptionView[], deferLast = true): OptionView[] {
  const key = (v: OptionView) => mixSeed(seed, hashStr(`${faultId}:${v.optionId}`));
  const sorted = [...views].sort((a, b) => key(a) - key(b));
  if (!deferLast) return sorted;
  return [...sorted.filter((v) => v.kind !== 'defer'), ...sorted.filter((v) => v.kind === 'defer')];
}

/** Options as the 2D UI lists them: fault-definition order; Sol 1 (tutorial) hides defer. */
export const missionPolicy = (pick: MissionPick): Policy => (s, engine, rng) => {
  const m = mission(engine, s);
  if (m.kind !== 'fault') return { type: 'endSol' };
  let views = optionViews(engine, s, m.faultId);
  if (pick === 'shuffled' || pick === 'shuffledAll') views = shuffledOrder(s.seed, m.faultId, views, pick === 'shuffled');
  if (pick === 'fewestHours') views = [...views].sort((a, b) => a.cost.total - b.cost.total);
  const valid = views.filter((v) => v.invalid === null && !(s.sol === 1 && v.kind === 'defer'));
  if (valid.length === 0) return { type: 'endSol' };
  const v = pick === 'random' ? valid[rng.int(0, valid.length - 1)]! : valid[0]!;
  return { type: 'resolve', faultId: m.faultId, optionId: v.optionId };
};

export const missionRandomBot: Policy = missionPolicy('random');
export const missionFirstBot: Policy = missionPolicy('first');
