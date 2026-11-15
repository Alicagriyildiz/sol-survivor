// Commander level: same scenario and rules, harsher mission config (src/content/config.ts).
import { describe, expect, it } from 'vitest';
import { alternatives, counterfactual, replay, replayLenient, type MissionLog } from '../src/blackbox';
import { BOTS, playGame, type BotName } from '../src/bots/bots';
import { followerFor } from '../src/bots/follower';
import { runBatch, seedRange, type BatchStats } from '../src/bots/stats';
import { DEFAULT_CONFIG, engine } from '../src/content';
import { COMMANDER_CONFIG, configFor } from '../src/content/config';

const SEEDS = seedRange(200);
const stats = {} as Record<BotName, BatchStats>;
for (const name of Object.keys(BOTS) as BotName[]) stats[name] = runBatch(engine, BOTS[name], SEEDS, COMMANDER_CONFIG);

// The careful bot that always reinforces the sol 6 shelter: the strongest single pick.
const regolith = runBatch(
  engine,
  (s, e, r) =>
    s.faults.some((f) => f.faultId === 's6_shelter') && !e.check(s, { type: 'resolve', faultId: 's6_shelter', optionId: 'regolith' })
      ? { type: 'resolve', faultId: 's6_shelter', optionId: 'regolith' }
      : BOTS.careful(s, e, r),
  SEEDS,
  COMMANDER_CONFIG,
);

// Players who do exactly what the screen points at (src/bots/follower.ts). Commander shows
// no suggestions; Junior names the next fault's place and the weakest gauge.
const follower = runBatch(engine, followerFor('commander'), SEEDS, COMMANDER_CONFIG);
const juniorFollower = runBatch(engine, followerFor('junior'), SEEDS, DEFAULT_CONFIG);

const pct = (x: number) => Math.round(x * 1000) / 10;
console.log(`[commander] follower win ${pct(follower.winRate)}% | junior follower win ${pct(juniorFollower.winRate)}%`);
console.log(`[commander] careful + sol 6 regolith forced: win ${pct(regolith.winRate)}%`);
for (const [name, st] of Object.entries(stats)) {
  const l = st.games - st.wins || 1;
  console.log(
    `[commander] ${name.padEnd(8)} win ${pct(st.winRate)}% | losses by cause power ${pct(st.lossCauses.power / l)}% life ${pct(st.lossCauses.life / l)}% shield ${pct(st.lossCauses.shield / l)}% | loss sols ${JSON.stringify(st.lossSols)}`,
  );
}

describe('commander config', () => {
  it('junior is the default config; commander changes only mission-config numbers', () => {
    expect(configFor('junior')).toBe(DEFAULT_CONFIG);
    expect(configFor('commander')).toBe(COMMANDER_CONFIG);
    expect(COMMANDER_CONFIG.solCount).toBe(DEFAULT_CONFIG.solCount);
    // never easier than junior on any starting stock
    for (const k of ['power', 'life', 'shield', 'health'] as const) expect(COMMANDER_CONFIG.start[k]).toBeLessThanOrEqual(DEFAULT_CONFIG.start[k]);
  });
});

describe('commander balance (200 seeds)', () => {
  it('careful bot wins 35-55%', () => {
    expect(stats.careful.winRate).toBeGreaterThanOrEqual(0.35);
    expect(stats.careful.winRate).toBeLessThanOrEqual(0.55);
  });
  it('following the screen is no win button (follower <= 35%)', () => {
    expect(follower.winRate).toBeLessThanOrEqual(0.35);
  });
  it('random bot wins under 8%', () => {
    expect(stats.random.winRate).toBeLessThan(0.08);
  });
  it('doing nothing never wins', () => {
    expect(stats.idle.winRate).toBe(0);
  });
  it('no bot ever loses on sol 1', () => {
    for (const st of [...Object.values(stats), follower]) expect(st.lossSols[1] ?? 0).toBe(0);
  });
  it('reinforcing the sol 6 shelter helps but is no win button (careful + regolith <= 85%)', () => {
    expect(regolith.winRate).toBeGreaterThan(stats.careful.winRate);
    expect(regolith.winRate).toBeLessThanOrEqual(0.85);
  });
});

describe('junior screen follower (200 seeds)', () => {
  it('obeying the junior hints mostly wins, but not always (60-85%)', () => {
    expect(juniorFollower.winRate).toBeGreaterThanOrEqual(0.6);
    expect(juniorFollower.winRate).toBeLessThanOrEqual(0.85);
    expect(juniorFollower.lossSols[1] ?? 0).toBe(0);
  });
});

describe('black box with the commander config', () => {
  const seed = 11;
  const run = playGame(engine, BOTS.careful, seed, COMMANDER_CONFIG);
  const log: MissionLog = { seed, config: COMMANDER_CONFIG, actions: run.actions };

  it('replaying a careful-bot log reproduces the final state', () => {
    expect(JSON.stringify(replay(engine, seed, COMMANDER_CONFIG, run.actions))).toBe(JSON.stringify(run.final));
    const lenient = replayLenient(engine, seed, COMMANDER_CONFIG, run.actions);
    expect(lenient.skipped).toEqual([]);
    expect(JSON.stringify(lenient.final)).toBe(JSON.stringify(run.final));
  });

  it('a counterfactual runs and keeps the commander config', () => {
    const idx = run.final.decisions.findIndex((d) => d.faultId === 's6_shelter');
    expect(idx).toBeGreaterThanOrEqual(0);
    const alt = alternatives(engine, log, idx).find((a) => !a.invalid)!;
    const cf = counterfactual(engine, log, idx, alt.optionId);
    expect(cf.alt.final.outcome).not.toBeNull();
    expect(cf.alt.final.config).toEqual(COMMANDER_CONFIG);
    expect(cf.alt.final.decisions[idx]!.optionId).toBe(alt.optionId);
    expect(cf.explanation).toBeTruthy();
  });
});
