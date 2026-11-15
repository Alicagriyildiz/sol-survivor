import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, engine } from '../src/content';
import { hoursLog, mission, optionViews, previewParts, solReportRows, todayFaults } from '../src/sim/selectors';
import type { GameState } from '../src/sim/types';

const start = () => engine.init(7, DEFAULT_CONFIG);

describe('task line (mission)', () => {
  it('points at an open fault, prefers the one where the astronaut stands, then says done', () => {
    let s = start();
    let m = mission(engine, s);
    expect(m).toMatchObject({ kind: 'fault', faultId: 's1_wakeup', station: 'hub', here: true, fixable: true, open: 2 });
    s = engine.step(s, { type: 'resolve', faultId: 's1_wakeup', optionId: 'stepByStep' });
    m = mission(engine, s);
    expect(m).toMatchObject({ kind: 'fault', faultId: 's1_seal', station: 'airlock', here: false });
    s = engine.step(s, { type: 'resolve', faultId: 's1_seal', optionId: 'newSeal' });
    expect(mission(engine, s)).toEqual({ kind: 'done', canWork: true });
  });

  it('says when no fix fits in the hours left', () => {
    const s: GameState = { ...start(), hoursLeft: 0.25 };
    expect(mission(engine, s)).toMatchObject({ kind: 'fault', fixable: false });
  });
});

describe('today faults', () => {
  it('lists open, solved and deferred faults', () => {
    let s = start();
    s = engine.step(s, { type: 'resolve', faultId: 's1_wakeup', optionId: 'allAtOnce' });
    s = engine.step(s, { type: 'resolve', faultId: 's1_seal', optionId: 'defer' });
    expect(todayFaults(engine, s).map((f) => [f.faultId, f.status])).toEqual([
      ['s1_wakeup', 'solved'],
      ['s1_seal', 'deferred'],
    ]);
    s = engine.step(s, { type: 'endSol' });
    const t = todayFaults(engine, s);
    expect(t.find((f) => f.faultId === 's1_seal')).toMatchObject({ status: 'open', returning: true });
  });
});

describe('hours log', () => {
  it('splits walking, suit-up and work, and adds up to the hours used', () => {
    let s = start();
    s = engine.step(s, { type: 'routine', routineId: 'tend' });
    s = engine.step(s, { type: 'routine', routineId: 'tune' });
    const log = hoursLog(engine, s);
    expect(log.map((h) => [h.walk, h.eva, h.work])).toEqual([
      [0.5, 0, 2],
      [1, 0, 2],
    ]);
    expect(log.reduce((t, h) => t + h.total, 0)).toBeCloseTo(DEFAULT_CONFIG.hoursPerSol - s.hoursLeft);
  });
});

describe('previews', () => {
  it('never shows an emergency reserve as the option effect, and names it separately', () => {
    // Life just above the reserve threshold: an option that costs life triggers the reserve.
    const s0 = start();
    const s: GameState = { ...s0, res: { ...s0.res, life: 11 } };
    const v = optionViews(engine, s, 's1_wakeup').find((o) => o.optionId === 'defer')!;
    expect(v.reserves).toEqual(['life']);
    expect(v.preview?.life ?? 0).toBeLessThan(0);
    const after = engine.step(s, { type: 'resolve', faultId: 's1_wakeup', optionId: 'defer' });
    expect(after.res.life).toBeGreaterThan(s.res.life); // the raw state diff would have looked like a gain
  });

  it('reports health lost to hours spent at critical levels', () => {
    const s0 = start();
    const s: GameState = { ...s0, res: { ...s0.res, power: 20 } };
    const p = previewParts(engine, s, { type: 'resolve', faultId: 's1_wakeup', optionId: 'stepByStep' });
    expect(p.critHealth).toBeLessThan(0);
  });

  it('warns when an option would leave no hours to fix another open fault', () => {
    const s: GameState = { ...start(), hoursLeft: 3.25 };
    const v = optionViews(engine, s, 's1_wakeup').find((o) => o.optionId === 'stepByStep')!;
    expect(v.blocks).toEqual(['s1_seal']);
  });
});

describe('sol report rows', () => {
  it('groups by part of day, keeps decisions and links later effects to their decision', () => {
    let s = start();
    s = engine.step(s, { type: 'resolve', faultId: 's1_wakeup', optionId: 'stepByStep' });
    s = engine.step(s, { type: 'resolve', faultId: 's1_seal', optionId: 'wipe' });
    for (let i = 0; i < 3; i++) s = engine.step(s, { type: 'endSol' });
    const sol3 = solReportRows(s, 3);
    const wear = sol3.find((r) => r.source.kind === 'pending');
    expect(wear?.section).toBe('night');
    expect(wear?.causes).toEqual(['s1:s1_seal']);
    const sol1 = solReportRows(s, 1);
    expect(sol1.filter((r) => r.section === 'day').map((r) => r.key)).toEqual(['d:s1:s1_wakeup', 'd:s1:s1_seal']);
    expect(sol1.every((r) => r.source.kind === 'decision' || Object.keys(r.deltas).length > 0)).toBe(true);
  });
});

describe('not condition', () => {
  it('negates its inner condition', () => {
    const s = start();
    expect(engine.evalCond(s, { not: { item: 'tape', gte: 1 } })).toBe(false);
    expect(engine.evalCond({ ...s, items: { ...s.items, tape: 0 } }, { not: { item: 'tape', gte: 1 } })).toBe(true);
  });
});
