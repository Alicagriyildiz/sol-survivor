import { describe, expect, it } from 'vitest';
import { alternatives, counterfactual, findRescues, replay, replayLenient, type MissionLog } from '../src/blackbox';
import { explanationText } from '../src/blackbox/text';
import { BOTS, playGame } from '../src/bots/bots';
import { DEFAULT_CONFIG, engine } from '../src/content';
import type { Action } from '../src/sim/types';

const logOf = (bot: keyof typeof BOTS, seed: number): MissionLog => {
  const run = playGame(engine, BOTS[bot], seed, DEFAULT_CONFIG);
  return { seed, config: DEFAULT_CONFIG, actions: run.actions };
};

describe('determinism and replay', () => {
  it('same seed + same actions => identical state, bit for bit', () => {
    for (const seed of [1, 2, 3, 42]) {
      const run = playGame(engine, BOTS.random, seed, DEFAULT_CONFIG);
      const a = replay(engine, seed, DEFAULT_CONFIG, run.actions);
      const b = replay(engine, seed, DEFAULT_CONFIG, run.actions);
      expect(JSON.stringify(a)).toBe(JSON.stringify(run.final));
      expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    }
  });

  it('different seeds give different rolls', () => {
    const rolls = new Set([1, 2, 3, 4, 5, 6].map((s) => JSON.stringify(engine.init(s, DEFAULT_CONFIG).rolls)));
    expect(rolls.size).toBeGreaterThan(1);
  });

  it('lenient replay of a valid log equals strict replay', () => {
    const log = logOf('careful', 5);
    const strict = replay(engine, log.seed, log.config, log.actions);
    const lenient = replayLenient(engine, log.seed, log.config, log.actions);
    expect(lenient.skipped).toEqual([]);
    expect(lenient.autopilotFromSol).toBeNull();
    expect(JSON.stringify(lenient.final)).toBe(JSON.stringify(strict));
  });
});

describe('counterfactual', () => {
  it('changing one explicit decision equals replaying the edited log', () => {
    const log = logOf('careful', 7);
    const orig = replay(engine, log.seed, log.config, log.actions);
    const idx = orig.decisions.findIndex((d) => d.faultId === 's6_shelter');
    const d = orig.decisions[idx]!;
    const alt = alternatives(engine, log, idx).find((a) => !a.invalid)!;
    const cf = counterfactual(engine, log, idx, alt.optionId);
    const edited: Action[] = [...log.actions];
    edited[d.actionIndex!] = { type: 'resolve', faultId: d.faultId, optionId: alt.optionId };
    const manual = replayLenient(engine, log.seed, log.config, edited);
    expect(JSON.stringify(cf.alt.final)).toBe(JSON.stringify(manual.final));
    expect(cf.alt.final.decisions[idx]!.optionId).toBe(alt.optionId);
    // the original log is untouched
    expect(JSON.stringify(replay(engine, log.seed, log.config, log.actions))).toBe(JSON.stringify(orig));
  });

  it('rejects choosing the same option or an option that was not available', () => {
    const log = logOf('careful', 7);
    const orig = replay(engine, log.seed, log.config, log.actions);
    expect(() => counterfactual(engine, log, 0, orig.decisions[0]!.optionId)).toThrow();
    // find a decision whose alternative was unavailable (hours, items, requires, locked)
    let done = false;
    for (let seed = 1; seed <= 40 && !done; seed++) {
      const l = logOf('random', seed);
      const o = replay(engine, l.seed, l.config, l.actions);
      const i = o.decisions.findIndex((_, k) => alternatives(engine, l, k).some((a) => a.invalid));
      if (i < 0) continue;
      const bad = alternatives(engine, l, i).find((a) => a.invalid)!;
      expect(() => counterfactual(engine, l, i, bad.optionId)).toThrow();
      done = true;
    }
    expect(done).toBe(true);
  });

  it('can change an automatically deferred decision (inserts the action)', () => {
    const log = logOf('cheapest', 3); // cheapest defers a lot
    const orig = replay(engine, log.seed, log.config, log.actions);
    const allDecisions = orig.decisions;
    // force an auto-defer by dropping an explicit defer from the log: use an all-endSol log instead
    const lazy: MissionLog = { seed: 3, config: DEFAULT_CONFIG, actions: Array.from({ length: 15 }, () => ({ type: 'endSol' }) as Action) };
    const lazyFinal = replayLenient(engine, 3, DEFAULT_CONFIG, lazy.actions, null).final;
    expect(lazyFinal.decisions.every((d) => d.auto)).toBe(true);
    const idx = lazyFinal.decisions.findIndex((d) => d.faultId === 's1_wakeup');
    const lazyLog: MissionLog = { ...lazy, actions: lazy.actions.slice(0, lazyFinal.actionCount) };
    const cf = counterfactual(engine, lazyLog, idx, 'stepByStep');
    expect(cf.alt.final.decisions[idx]).toMatchObject({ faultId: 's1_wakeup', optionId: 'stepByStep', auto: false });
    expect(allDecisions.length).toBeGreaterThan(0);
  });

  it('skips later actions that become invalid (documented fallback rule)', () => {
    // Use tape on sol 10 (apollo) in an alt timeline where tape was already used? Build directly:
    // play careful, then change the sol-10 decision to "apollo" when the original used tape on sol 13.
    let found = false;
    for (let seed = 1; seed <= 60 && !found; seed++) {
      const log = logOf('careful', seed);
      const orig = replay(engine, log.seed, log.config, log.actions);
      const usedTape13 = orig.decisions.find((d) => d.faultId.startsWith('s13_leak') && d.optionId === 'teaLeaves');
      const co2 = orig.decisions.findIndex((d) => d.faultId === 's10_co2' && d.optionId !== 'apollo');
      if (!usedTape13 || co2 < 0) continue;
      const alt = alternatives(engine, log, co2).find((a) => a.optionId === 'apollo');
      if (!alt || alt.invalid) continue;
      const cf = counterfactual(engine, log, co2, 'apollo');
      expect(cf.alt.skipped.some((s) => s.action.type === 'resolve' && s.action.optionId === 'teaLeaves' && s.reason === 'items')).toBe(true);
      // the skipped leak was deferred automatically that sol
      const leak = cf.alt.final.decisions.find((d) => d.key === usedTape13.key);
      expect(leak?.auto).toBe(true);
      found = true;
    }
    expect(found).toBe(true);
  });

  it('explains the sol 6 -> sol 12 shelter chain', () => {
    let checked = 0;
    for (let seed = 1; seed <= 120 && checked < 3; seed++) {
      const log = logOf('careful', seed);
      const orig = replay(engine, log.seed, log.config, log.actions);
      const idx = orig.decisions.findIndex((d) => d.faultId === 's6_shelter');
      const spe = orig.decisions.find((d) => d.faultId === 's12_spe');
      if (idx < 0 || !spe || !['hideAll', 'hideShort'].includes(spe.optionId)) continue;
      const d = orig.decisions[idx]!;
      const to = d.optionId === 'regolith' ? 'defer' : 'regolith';
      const alt = alternatives(engine, log, idx).find((a) => a.optionId === to);
      if (!alt || alt.invalid) continue;
      const cf = counterfactual(engine, log, idx, to);
      const linked = cf.explanation.steps.filter((s) => s.type === 'linked');
      expect(linked.some((s) => s.type === 'linked' && s.sol === 12)).toBe(true);
      expect(cf.explanation.steps[0]).toMatchObject({ type: 'changed', sol: 6 });
      expect(cf.explanation.steps.at(-1)?.type).toBe('outcome');
      expect(cf.explanation.firstDivergenceSol).toBe(6);
      const text = explanationText(cf.explanation);
      expect(text.length).toBeGreaterThanOrEqual(3);
      expect(text.join(' ')).toContain('Sol 12');
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('every effect in the trace carries the cause of the decision that created it', () => {
    const log = logOf('random', 11);
    const s = replay(engine, log.seed, log.config, log.actions);
    for (const e of s.trace) {
      if (e.source.kind === 'decision') expect(e.causes).toContain(e.source.key);
      if (e.source.kind === 'pending' || e.source.kind === 'modifier') {
        // modifiers/pending created by events may have no decision cause; those from decisions must
        for (const c of e.causes) expect(s.decisions.some((d) => d.key === c)).toBe(true);
      }
    }
  });
});

describe('findRescues', () => {
  it('every reported rescue really flips the outcome', () => {
    let tested = 0;
    for (let seed = 1; seed <= 30 && tested < 3; seed++) {
      const log = logOf('random', seed);
      const orig = replay(engine, log.seed, log.config, log.actions);
      if (orig.outcome!.won) continue;
      const rescues = findRescues(engine, log);
      for (const r of rescues.slice(0, 3)) {
        const cf = counterfactual(engine, log, r.decisionIndex, r.optionId);
        expect(cf.alt.final.outcome!.won).toBe(true);
      }
      tested++;
    }
    expect(tested).toBeGreaterThan(0);
  });
});
