// Commander level: same scenario and rules, harsher mission config (src/content/config.ts).
import { describe, expect, it } from 'vitest';
import { alternatives, counterfactual, replay, replayLenient, type MissionLog } from '../src/blackbox';
import { BOTS, playGame, type BotName } from '../src/bots/bots';
import { runBatch, seedRange, type BatchStats } from '../src/bots/stats';
import { DEFAULT_CONFIG, engine } from '../src/content';
import { COMMANDER_CONFIG, configFor } from '../src/content/config';

const SEEDS = seedRange(200);
const stats = {} as Record<BotName, BatchStats>;
for (const name of Object.keys(BOTS) as BotName[]) stats[name] = runBatch(engine, BOTS[name], SEEDS, COMMANDER_CONFIG);

const pct = (x: number) => Math.round(x * 1000) / 10;
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
  it('careful bot wins 40-60%', () => {
    expect(stats.careful.winRate).toBeGreaterThanOrEqual(0.4);
    expect(stats.careful.winRate).toBeLessThanOrEqual(0.6);
  });
  it('random bot wins under 8%', () => {
    expect(stats.random.winRate).toBeLessThan(0.08);
  });
  it('doing nothing never wins', () => {
    expect(stats.idle.winRate).toBe(0);
  });
  it('no bot ever loses on sol 1', () => {
    for (const st of Object.values(stats)) expect(st.lossSols[1] ?? 0).toBe(0);
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
