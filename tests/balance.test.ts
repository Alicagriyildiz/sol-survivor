import { describe, expect, it } from 'vitest';
import { BOTS, type BotName, type Policy } from '../src/bots/bots';
import { runBatch, seedRange, type BatchStats } from '../src/bots/stats';
import { DEFAULT_CONFIG, engine } from '../src/content';
import { findRescues } from '../src/blackbox';

const SEEDS = seedRange(200);
const stats = {} as Record<BotName, BatchStats>;
for (const name of Object.keys(BOTS) as BotName[]) stats[name] = runBatch(engine, BOTS[name], SEEDS, DEFAULT_CONFIG);

const pct = (x: number) => Math.round(x * 1000) / 10;
const lossShare = (st: BatchStats) => {
  const losses = st.games - st.wins;
  return {
    power: losses ? st.lossCauses.power / losses : 0,
    life: losses ? st.lossCauses.life / losses : 0,
    shield: losses ? st.lossCauses.shield / losses : 0,
  };
};

// Printed so balance numbers can be copied into docs/PROGRESS.md.
for (const [name, st] of Object.entries(stats)) {
  const sh = lossShare(st);
  console.log(
    `[balance] ${name.padEnd(8)} win ${pct(st.winRate)}% | losses by cause power ${pct(sh.power)}% life ${pct(sh.life)}% shield ${pct(sh.shield)}% | loss sols ${JSON.stringify(st.lossSols)} | avg health on win ${st.avgHealthOnWin.toFixed(1)}`,
  );
}

{
  const total = { power: 0, life: 0, shield: 0 };
  let losses = 0;
  for (const st of Object.values(stats)) {
    losses += st.games - st.wins;
    for (const c of ['power', 'life', 'shield'] as const) total[c] += st.lossCauses[c];
  }
  console.log(
    `[balance] all bots: ${losses} losses, by cause power ${pct(total.power / losses)}% life ${pct(total.life / losses)}% shield ${pct(total.shield / losses)}%`,
  );
}

// Single-decision rescue rate over the random bot's lost missions.
const lost = stats.random.runs.filter((r) => !r.final.outcome!.won);
const doNothing: Policy = () => ({ type: 'endSol' });
const rescueRate = (autopilot: Policy) =>
  lost.filter((r) => findRescues(engine, { seed: r.seed, config: DEFAULT_CONFIG, actions: r.actions }, autopilot, { firstOnly: true }).length > 0)
    .length / (lost.length || 1);
const rescueWithAutopilot = rescueRate(BOTS.careful);
const rescueStrict = rescueRate(doNothing);
console.log(
  `[balance] rescue: ${pct(rescueWithAutopilot)}% of ${lost.length} random-bot losses are saved by changing one decision (autopilot after the log ends); strict (after the log ends the astronaut does nothing): ${pct(rescueStrict)}%`,
);

describe('balance (200 seeds)', () => {
  // Session 3: the target is measured strictly (after the log ends the astronaut does
  // nothing). The autopilot rate is printed above for comparison.
  it('at least 40% of random-bot losses can be rescued by one decision (strict)', () => {
    expect(rescueStrict).toBeGreaterThanOrEqual(0.4);
  });
  it('careful bot: Shield causes under 70% of its losses', () => {
    expect(lossShare(stats.careful).shield).toBeLessThan(0.7);
  });
  it('random bot survives 5-20%', () => {
    expect(stats.random.winRate).toBeGreaterThanOrEqual(0.05);
    expect(stats.random.winRate).toBeLessThanOrEqual(0.2);
  });
  it('always-cheapest and always-robust mostly lose', () => {
    expect(stats.cheapest.winRate).toBeLessThan(0.5);
    expect(stats.robust.winRate).toBeLessThan(0.5);
  });
  it('careful bot wins 60-85%', () => {
    expect(stats.careful.winRate).toBeGreaterThanOrEqual(0.6);
    expect(stats.careful.winRate).toBeLessThanOrEqual(0.85);
  });
  it('no single cause exceeds 60% of all losses', () => {
    const total = { power: 0, life: 0, shield: 0 };
    let losses = 0;
    for (const st of Object.values(stats)) {
      losses += st.games - st.wins;
      for (const c of ['power', 'life', 'shield'] as const) total[c] += st.lossCauses[c];
    }
    for (const c of ['power', 'life', 'shield'] as const) expect(total[c] / losses, c).toBeLessThanOrEqual(0.6);
  });
  it('no bot ever loses on sol 1', () => {
    for (const st of Object.values(stats)) expect(st.lossSols[1] ?? 0).toBe(0);
  });
});
