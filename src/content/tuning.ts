// Balance knobs applied on top of the raw scenario numbers. Tuned with the bots
// (tests/balance.test.ts); change these or the raw numbers, never the targets.
import type { ContentPack, Effect, OptionKind } from '../sim/types';

export interface Tuning {
  /** Multiplier for the costs (negative effects) of each option kind. Radiation is a
   *  physical event, not an option cost, so it is never scaled. */
  cost: Record<OptionKind, number>;
  /** Multiplier for routine gains. */
  routineGain: number;
}

export const TUNING: Tuning = {
  cost: { defer: 0.3, quick: 0.8, robust: 1.8, creative: 1 },
  routineGain: 0.3,
};

const roundHalf = (v: number) => Math.round(v * 2) / 2;

function scaleCosts(effects: Effect[], f: number): Effect[] {
  if (f === 1) return effects;
  return effects.map((e): Effect => {
    switch (e.kind) {
      case 'res':
      case 'health':
        return typeof e.amount === 'number' && e.amount < 0 ? { ...e, amount: roundHalf(e.amount * f) } : e;
      case 'modifier':
        return {
          ...e,
          nightly: Object.fromEntries(Object.entries(e.nightly).map(([k, v]) => [k, v !== undefined && v < 0 ? roundHalf(v * f) : v])),
        };
      case 'if':
        return { ...e, then: scaleCosts(e.then, f), else: scaleCosts(e.else ?? [], f) };
      case 'later':
        return { ...e, effects: scaleCosts(e.effects, f) };
      default:
        return e;
    }
  });
}

export function applyTuning(raw: ContentPack, t: Tuning): ContentPack {
  return {
    ...raw,
    routines: raw.routines.map((r) => ({
      ...r,
      effects: r.effects.map((e) =>
        e.kind === 'res' && typeof e.amount === 'number' && e.amount > 0 ? { ...e, amount: roundHalf(e.amount * t.routineGain) } : e,
      ),
    })),
    sols: raw.sols.map((sol) => ({
      ...sol,
      faults: sol.faults.map((f) => ({
        ...f,
        options: f.options.map((o) => ({ ...o, effects: scaleCosts(o.effects, t.cost[o.kind]) })),
      })),
    })),
  };
}
