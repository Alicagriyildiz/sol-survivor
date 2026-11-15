import { describe, expect, it } from 'vitest';
import { BOTS, type BotName, type Policy } from '../src/bots/bots';
import { runBatch, seedRange, type BatchStats } from '../src/bots/stats';
import { DEFAULT_CONFIG, engine } from '../src/content';
import { findRescues } from '../src/blackbox';
import { SOLAR_EVENTS } from '../src/content/data';

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
const doNothing: Policy = BOTS.idle;
const rescueRate = (autopilot: Policy) =>
  lost.filter((r) => findRescues(engine, { seed: r.seed, config: DEFAULT_CONFIG, actions: r.actions }, autopilot, { firstOnly: true }).length > 0)
    .length / (lost.length || 1);
const rescueWithAutopilot = rescueRate(BOTS.careful);
const rescueStrict = rescueRate(doNothing);
console.log(
  `[balance] rescue: ${pct(rescueWithAutopilot)}% of ${lost.length} random-bot losses are saved by changing one decision (autopilot after the log ends); strict (after the log ends the astronaut does nothing): ${pct(rescueStrict)}%`,
);

// Sol 6 shelter vs. the real sol 12 event: careful bot with one sol 6 option forced,
// split by event class (X-class flares vs. the weaker ones).
const forcedSol6 = (optionId: string): Policy => (s, e, r) =>
  s.faults.some((f) => f.faultId === 's6_shelter') && !e.check(s, { type: 'resolve', faultId: 's6_shelter', optionId })
    ? { type: 'resolve', faultId: 's6_shelter', optionId }
    : BOTS.careful(s, e, r);
const isX = (st: { rolls: Record<string, number> }) => (SOLAR_EVENTS[st.rolls.speEvent ?? 0]?.classType ?? '').startsWith('X');
const sol6 = (optionId: string) => {
  const runs = runBatch(engine, forcedSol6(optionId), SEEDS, DEFAULT_CONFIG).runs;
  const rate = (rs: typeof runs) => rs.filter((r) => r.final.outcome!.won).length / (rs.length || 1);
  return { x: rate(runs.filter((r) => isX(r.final))), other: rate(runs.filter((r) => !isX(r.final))) };
};
const regolith = sol6('regolith');
const deferShelter = sol6('defer');
console.log(
  `[balance] sol 6 forced (careful): X-class regolith ${pct(regolith.x)}% defer ${pct(deferShelter.x)}% | other regolith ${pct(regolith.other)}% defer ${pct(deferShelter.other)}%`,
);

// Targets set by the game owner in session 4 (reasons in docs/DESIGN.md §6).
describe('balance (200 seeds)', () => {
  // Session 3: the target is measured strictly (after the log ends the astronaut does
  // nothing). The autopilot rate is printed above for comparison.
  it('at least 35% of random-bot losses can be rescued by one decision (strict)', () => {
    expect(rescueStrict).toBeGreaterThanOrEqual(0.35);
  });
  it('careful bot: Shield causes under 75% of its losses', () => {
    expect(lossShare(stats.careful).shield).toBeLessThan(0.75);
  });
  it('doing nothing never wins', () => {
    expect(stats.idle.winRate).toBe(0);
  });
  it('sol 6: reinforcing the shelter beats deferring by 10+ points on X-class events, within 10 otherwise', () => {
    expect(regolith.x - deferShelter.x).toBeGreaterThanOrEqual(0.1);
    expect(Math.abs(regolith.other - deferShelter.other)).toBeLessThanOrEqual(0.1);
  });
  it('random bot survives 5-25%', () => {
    expect(stats.random.winRate).toBeGreaterThanOrEqual(0.05);
    expect(stats.random.winRate).toBeLessThanOrEqual(0.25);
  });
  it('always-cheapest and always-robust mostly lose', () => {
    expect(stats.cheapest.winRate).toBeLessThan(0.5);
    expect(stats.robust.winRate).toBeLessThan(0.5);
  });
  it('careful bot wins 60-88%', () => {
    expect(stats.careful.winRate).toBeGreaterThanOrEqual(0.6);
    expect(stats.careful.winRate).toBeLessThanOrEqual(0.88);
  });
  it('no single cause exceeds 60% of all losses', () => {
    const total = { power: 0, life: 0, shield: 0 };
    let losses = 0;
    for (const st of Object.values(stats)) {
      losses += st.games - st.wins;
      for (const c of ['power', 'life', 'shield'] as const) total[c] += st.lossCauses[c];
    }
    for (const c of ['power', 'life', 'shield'] as const) expect(total[c] / losses, c).toBeLessThanOrEqual(0.6);
    // Radiation must stay a real threat: Shield 15-40% of all losses.
    expect(total.shield / losses).toBeGreaterThanOrEqual(0.15);
    expect(total.shield / losses).toBeLessThanOrEqual(0.4);
  });
  it('no bot ever loses on sol 1', () => {
    for (const st of Object.values(stats)) expect(st.lossSols[1] ?? 0).toBe(0);
  });
});
