// Dev tools (no-ops unless env vars are set):
//   BOT=random SEED=3 npx vitest run tests/tools/trace.test.ts -t debug   -> per-sol trace of one bot game
//   TUNE='{"rules":{...}}' npx vitest run tests/tools/trace.test.ts -t tune -> bot win rates for config overrides
//   OPTS='{}' npx vitest run tests/tools/trace.test.ts -t options          -> effect of forcing each option on the careful bot
import { it } from 'vitest';
import { BOTS, playGame, type BotName } from '../../src/bots/bots';
import { DEFAULT_CONFIG, engine } from '../../src/content';

it('debug', () => {
  if (!process.env.BOT) return;
  const bot = (process.env.BOT ?? 'careful') as BotName;
  const seed = Number(process.env.SEED ?? 1);
  const run = playGame(engine, BOTS[bot], seed, DEFAULT_CONFIG);
  const lines: string[] = [];
  let sol = 1;
  let acts: string[] = [];
  let s = engine.init(seed, DEFAULT_CONFIG);
  for (const a of run.actions) {
    if (a.type === 'resolve') acts.push(`${a.faultId}:${a.optionId}`);
    if (a.type === 'routine') acts.push(`[${a.routineId}]`);
    s = engine.step(s, a);
    if (a.type === 'endSol' || s.outcome) {
      const auto = s.decisions.filter((d) => d.sol === sol && d.auto).map((d) => `${d.faultId}:auto`);
      const h = s.history.at(-1)!;
      lines.push(`sol ${String(sol).padStart(2)} P${h.res.power.toFixed(0).padStart(4)} L${h.res.life.toFixed(0).padStart(4)} S${h.res.shield.toFixed(0).padStart(4)} H${h.health.toFixed(0).padStart(4)} D${h.dose.toFixed(0).padStart(4)} | ${[...acts, ...auto].join(' ')}`);
      acts = [];
      sol = s.sol;
    }
  }
  process.stdout.write(`${bot} seed ${seed} rolls ${JSON.stringify(s.rolls)} outcome ${JSON.stringify(s.outcome)} dmg ${JSON.stringify(s.damage)}\n` + lines.join("\n") + "\n");
});

import { runBatch, seedRange } from '../../src/bots/stats';
import { SCENARIO } from '../../src/content';
import { createEngine } from '../../src/sim/engine';
it('tune', () => {
  if (!process.env.TUNE) return;
  const o = JSON.parse(process.env.TUNE);
  const cfg = { ...DEFAULT_CONFIG, ...(o.cfg ?? {}), rules: { ...DEFAULT_CONFIG.rules, ...(o.rules ?? {}) } };
  const out: string[] = [];
  const rs = o.routineScale ?? 1;
  const pack = { ...SCENARIO, routines: SCENARIO.routines.map((r) => ({ ...r, effects: r.effects.map((e: any) => (e.amount > 0 ? { ...e, amount: e.amount * rs } : e)) })) };
  const eng = createEngine(pack);
  const hybrid: any = (st: any, e: any, r: any) => (st.faults.length ? BOTS.random(st, e, r) : BOTS.careful(st, e, r));
  const hybrid2: any = (st: any, e: any, r: any) => (st.faults.length ? BOTS.careful(st, e, r) : BOTS.random(st, e, r));
  const all: any = { ...BOTS, randFault_smartRoutine: hybrid, smartFault_randRoutine: hybrid2 };
  for (const name of Object.keys(all) as BotName[]) {
    const st = runBatch(eng, all[name], seedRange(Number(process.env.N ?? 100)), cfg);
    const l = st.games - st.wins || 1;
    const hs = st.runs.map((r) => r.final.health + (r.final.outcome!.won ? 0 : -(15 - r.final.outcome!.sol) * 10)).sort((a, b) => a - b);
    const q = (p: number) => hs[Math.floor(p * (hs.length - 1))]!.toFixed(0);
    out.push(`${name.padEnd(8)} q10 ${q(0.1)} q25 ${q(0.25)} q50 ${q(0.5)} q75 ${q(0.75)} q90 ${q(0.9)} |`);
    out.push(`${name.padEnd(8)} ${(st.winRate * 100).toFixed(0).padStart(3)}% P${((100 * st.lossCauses.power) / l).toFixed(0)} L${((100 * st.lossCauses.life) / l).toFixed(0)} S${((100 * st.lossCauses.shield) / l).toFixed(0)} hp${st.avgHealthOnWin.toFixed(0)} ${JSON.stringify(st.lossSols)}`);
  }
  process.stdout.write(process.env.TUNE + '\n' + out.join('\n') + '\n');
});

it('options', () => {
  if (!process.env.OPTS) return;
  const o = JSON.parse(process.env.OPTS);
  const cfg = { ...DEFAULT_CONFIG, ...(o.cfg ?? {}), rules: { ...DEFAULT_CONFIG.rules, ...(o.rules ?? {}) } };
  const seeds = seedRange(Number(process.env.N ?? 60));
  const base = runBatch(engine, BOTS.careful, seeds, cfg);
  const baseHp = base.runs.reduce((a, r) => a + r.final.health, 0) / seeds.length;
  const out: string[] = [`baseline careful win ${(base.winRate * 100).toFixed(0)}% hp ${baseHp.toFixed(1)}`];
  for (const sol of SCENARIO.sols) for (const f of sol.faults) for (const op of f.options) {
    const forced: any = (st: any, e: any, r: any) => {
      if (st.faults.some((x: any) => x.faultId === f.id) && !e.check(st, { type: 'resolve', faultId: f.id, optionId: op.id })) return { type: 'resolve', faultId: f.id, optionId: op.id };
      return BOTS.careful(st, e, r);
    };
    const st = runBatch(engine, forced, seeds, cfg);
    const hp = st.runs.reduce((a, r) => a + r.final.health, 0) / seeds.length;
    out.push(`${(f.id + '/' + op.id).padEnd(32)} ${op.kind.padEnd(8)} win ${(st.winRate * 100).toFixed(0).padStart(3)}% hp ${(hp - baseHp).toFixed(1).padStart(6)}`);
  }
  process.stdout.write(out.join('\n') + '\n');
});
