// Balance search tool (no-op unless env vars are set). Examples:
//   GRID='[{"fDefer":0.5,"rules":{"nightly":{"power":-5,"life":-7,"shield":-4}}}]' npx vitest run tests/tools/search.test.ts -t "^search"
//   RS=1 ITER=150 N=120 NARROW=1 RESCUE=1 npx vitest run tests/tools/search.test.ts -t "random search"
//   GRID='[{}]' RESCUE=1 FORCE='[["s6_shelter","regolith"]]' npx vitest run tests/tools/search.test.ts -t "^search"
//     ({} = current config; RESCUE prints autopilot/strict rescue, FORCE the careful bot's win rate with an option forced)
// Knobs map to content/tuning.ts (fDefer/fQuick/fRobust/fCreative/rs) and config rules.
import { it } from 'vitest';
import { BOTS, type BotName } from '../../src/bots/bots';
import { runBatch, seedRange } from '../../src/bots/stats';
import { DEFAULT_CONFIG, RAW_SCENARIO, TUNING, applyTuning } from '../../src/content';
import { createEngine } from '../../src/sim/engine';
import type { ContentPack, Effect } from '../../src/sim/types';

export function scaleEffects(effects: Effect[], f: number): Effect[] {
  return effects.map((e): Effect => {
    if (e.kind === 'res' && typeof e.amount === 'number' && e.amount < 0) return { ...e, amount: e.amount * f };
    if (e.kind === 'health' && typeof e.amount === 'number' && e.amount < 0) return { ...e, amount: e.amount * f };
    if (e.kind === 'radiation' && typeof e.amount === 'number') return { ...e, amount: e.amount * f };
    if (e.kind === 'modifier') return { ...e, nightly: Object.fromEntries(Object.entries(e.nightly).map(([k, v]) => [k, (v ?? 0) < 0 ? (v ?? 0) * f : v])) };
    if (e.kind === 'if') return { ...e, then: scaleEffects(e.then, f), else: scaleEffects(e.else ?? [], f) };
    if (e.kind === 'later') return { ...e, effects: scaleEffects(e.effects, f) };
    return e;
  });
}

export function transform(o: any): ContentPack {
  const t = {
    cost: { defer: o.fDefer ?? TUNING.cost.defer, quick: o.fQuick ?? TUNING.cost.quick, robust: o.fRobust ?? TUNING.cost.robust, creative: o.fCreative ?? TUNING.cost.creative },
    routineGain: o.rs ?? TUNING.routineGain,
  };
  const tuned = applyTuning(RAW_SCENARIO, t);
  const fa = o.fAll ?? 1;
  if (fa === 1) return tuned;
  const big = (effects: Effect[]): Effect[] => effects.map((e): Effect => {
    if ((e.kind === 'res' || e.kind === 'health') && typeof e.amount === 'number') return { ...e, amount: Math.round(e.amount * fa * 2) / 2 };
    if (e.kind === 'modifier') return { ...e, nightly: Object.fromEntries(Object.entries(e.nightly).map(([k, v]) => [k, Math.round((v ?? 0) * fa * 2) / 2])) };
    if (e.kind === 'if') return { ...e, then: big(e.then), else: big(e.else ?? []) };
    if (e.kind === 'later') return { ...e, effects: big(e.effects) };
    return e;
  });
  return { ...tuned, sols: tuned.sols.map((sol) => ({ ...sol, faults: sol.faults.map((f) => ({ ...f, options: f.options.map((op) => ({ ...op, effects: big(op.effects) })) })) })) };
}

it('search', () => {
  if (!process.env.GRID) return;
  const grid: any[] = JSON.parse(process.env.GRID);
  const n = Number(process.env.N ?? 80);
  const lines: string[] = [];
  for (const o of grid) {
    const eng = createEngine(transform(o));
    const cfg = { ...DEFAULT_CONFIG, rules: { ...DEFAULT_CONFIG.rules, ...(o.rules ?? {}) } };
    const r: Record<string, number> = {};
    const causes = { power: 0, life: 0, shield: 0 };
    let losses = 0;
    for (const name of Object.keys(BOTS) as BotName[]) {
      const st = runBatch(eng, BOTS[name], seedRange(n), cfg);
      r[name] = Math.round(st.winRate * 100);
      const l = st.games - st.wins || 1;
      r[name + 'C'] = `${Math.round(100*st.lossCauses.power/l)}/${Math.round(100*st.lossCauses.life/l)}/${Math.round(100*st.lossCauses.shield/l)}` as any;
      losses += st.games - st.wins;
      for (const c of ['power', 'life', 'shield'] as const) causes[c] += st.lossCauses[c];
    }
    const cs = (['power', 'life', 'shield'] as const).map((c) => Math.round((100 * causes[c]) / (losses || 1)));
    // FORCE='[["s6_shelter","regolith"],...]': careful-bot win rate with that option forced.
    let forcedTxt = '';
    if (process.env.FORCE) {
      for (const [fid, oid] of JSON.parse(process.env.FORCE) as [string, string][]) {
        const forced = ((st: any, e: any, rr: any) =>
          st.faults.some((x: any) => x.faultId === fid) && !e.check(st, { type: 'resolve', faultId: fid, optionId: oid })
            ? { type: 'resolve', faultId: fid, optionId: oid }
            : BOTS.careful(st, e, rr)) as any;
        forcedTxt += ` ${fid.split('_')[0]}${oid}=${Math.round(runBatch(eng, forced, seedRange(n), cfg).winRate * 100)}`;
      }
    }
    let resc = '';
    if (process.env.RESCUE) {
      // Both rescue measures over the random bot's losses: autopilot, strict (do nothing).
      const rb = runBatch(eng, BOTS.random, seedRange(n), cfg);
      const lostRuns = rb.runs.filter((x) => !x.final.outcome!.won);
      const rate = (auto: any) =>
        Math.round((100 * lostRuns.filter((x) => findRescues(eng, { seed: x.seed, config: cfg, actions: x.actions }, auto, { firstOnly: true }).length > 0).length) / (lostRuns.length || 1));
      resc = ` rescue ${rate(BOTS.careful)}/strict ${rate(() => ({ type: 'endSol' }))}`;
    }
    lines.push(`${resc}${forcedTxt} R${r.random}(${r.randomC}) C${r.cheapest}(${r.cheapestC}) B${r.robust}(${r.robustC}) K${r.careful}(${r.carefulC}) agg ${cs.join('/')} <- ${JSON.stringify(o)}`);
  }
  process.stdout.write(lines.join('\n') + '\n');
});

import { createRng } from '../../src/sim/rng';
import { findRescues } from '../../src/blackbox';
it('random search', () => {
  if (!process.env.RS) return;
  const rng = createRng(Number(process.env.RS));
  const n = Number(process.env.N ?? 100);
  const pick = <T,>(xs: T[]) => xs[rng.int(0, xs.length - 1)]!;
  const results: { score: number; line: string }[] = [];
  for (let i = 0; i < Number(process.env.ITER ?? 150); i++) {
    const o = process.env.NARROW ? {
      rs: pick([0.5]),
      fRobust: pick([1.2]),
      fDefer: pick([0.4, 0.5]),
      fQuick: pick([0.7]),
      rules: {
        maxDamagePerHour: pick([0.85, 1.0]),
        reserve: { threshold: 10, amount: pick([35]) },
        nightHeal: pick([4, 6, 8]),
        comfortable: pick([15, 20, 25]),
        nightly: { power: pick([-4.75, -5, -5.5]), life: pick([-6.75, -7, -7.5]), shield: pick([-4.25, -4.5, -5]) },
        radHealthPerDose: pick([0.6]),
      },
    } : {
      rs: pick([0.5, 0.75, 1]),
      fRobust: pick([1.2, 1.5, 1.8]),
      fDefer: pick([0.4, 0.6, 0.8]),
      fQuick: pick([0.6, 0.8, 1]),
      rules: {
        maxDamagePerHour: pick([0.6, 0.8, 1.0, 1.2]),
        reserve: { threshold: 10, amount: pick([15, 25, 35]) },
        nightHeal: pick([2, 3, 5, 7]),
        comfortable: pick([25, 30, 35]),
        nightly: { power: pick([-2, -3, -4, -5]), life: pick([-4, -5, -6, -7]), shield: pick([-3, -4, -5]) },
      },
    };
    const eng = createEngine(transform(o));
    const cfg = { ...DEFAULT_CONFIG, rules: { ...DEFAULT_CONFIG.rules, ...o.rules } };
    const r: Record<string, number> = {};
    const per: Record<string, number> = {};
    const causes = { power: 0, life: 0, shield: 0 };
    let losses = 0;
    for (const name of Object.keys(BOTS) as BotName[]) {
      const st = runBatch(eng, BOTS[name], seedRange(n), cfg);
      r[name] = st.winRate * 100;
      const l = st.games - st.wins || 1;
      per[name] = Math.max(st.lossCauses.power, st.lossCauses.life, st.lossCauses.shield) / l * 100;
      losses += st.games - st.wins;
      for (const c of ['power', 'life', 'shield'] as const) causes[c] += st.lossCauses[c];
    }
    const cs = (['power', 'life', 'shield'] as const).map((c) => (100 * causes[c]) / (losses || 1));
    let rescue = 0;
    if (process.env.RESCUE && Math.abs(r.random! - 12) <= 8 && Math.abs(r.careful! - 72) <= 13) {
      const rb = runBatch(eng, BOTS.random, seedRange(n), cfg);
      const lostRuns = rb.runs.filter((x) => !x.final.outcome!.won);
      rescue = (100 * lostRuns.filter((x) => findRescues(eng, { seed: x.seed, config: cfg, actions: x.actions }, BOTS.careful, { firstOnly: true }).length > 0).length) / (lostRuns.length || 1);
    }
    const score = (process.env.RESCUE ? Math.max(0, 55 - rescue) / 5 : 0) +
      Math.max(0, Math.abs(r.random! - 12) - 6) / 3 +
      Math.max(0, Math.abs(r.careful! - 72) - 10) / 5 +
      Math.max(0, r.robust! - 35) / 8 +
      Math.max(0, r.cheapest! - 35) / 8 +
      Math.max(0, Math.max(...cs) - 52) / 4 + Math.max(0, 15 - Math.min(...cs)) / 6 + Math.max(0, per.random! - 60) / 6 + Math.max(0, per.careful! - 60) / 6;
    results.push({ score, line: `${score.toFixed(2)} rescue ${rescue.toFixed(0)} R${r.random!.toFixed(0)} C${r.cheapest!.toFixed(0)} B${r.robust!.toFixed(0)} K${r.careful!.toFixed(0)} causes ${cs.map((x) => x.toFixed(0)).join('/')} perR ${per.random!.toFixed(0)} perK ${per.careful!.toFixed(0)} <- ${JSON.stringify(o)}` });
  }
  results.sort((a, b) => a.score - b.score);
  process.stdout.write(results.slice(0, 12).map((x) => x.line).join('\n') + '\n');
});
