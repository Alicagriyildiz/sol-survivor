import { describe, expect, it } from 'vitest';
import { createEngine } from '../src/sim/engine';
import type { ContentPack, GameState, MissionConfig } from '../src/sim/types';

// A tiny scenario that exercises every core mechanic, independent of the real content.
const pack: ContentPack = {
  homeStation: 'hub',
  stations: [
    { id: 'hub', walk: 0, eva: false },
    { id: 'lab', walk: 0.5, eva: false },
    { id: 'out', walk: 1, eva: true, lockedWhen: { flag: 'storm' } },
  ],
  rolls: [{ id: 'coin', min: 0, max: 1 }, { id: 'big', min: 5, max: 9 }],
  routines: [{ id: 'fixLab', station: 'lab', hours: 2, effects: [{ kind: 'res', res: 'power', amount: 5 }] }],
  sols: [
    {
      sol: 1,
      faults: [
        {
          id: 'pump',
          station: 'lab',
          options: [
            { id: 'robust', kind: 'robust', hours: 3, effects: [{ kind: 'flag', flag: 'pumpOk' }] },
            { id: 'tape', kind: 'creative', hours: 1, items: { tape: 1 }, effects: [{ kind: 'res', res: 'life', amount: 2 }] },
            {
              id: 'defer',
              kind: 'defer',
              hours: 0,
              effects: [
                { kind: 'modifier', id: 'leak', nightly: { life: -5 }, untilResolved: 'pump', label: 'leak' },
                { kind: 'reopen', faultId: 'pump' },
              ],
            },
          ],
        },
      ],
    },
    {
      sol: 2,
      morning: [{ kind: 'flag', flag: 'storm' }],
      faults: [
        {
          id: 'panel',
          station: 'out',
          options: [
            { id: 'clean', kind: 'robust', hours: 2, effects: [{ kind: 'res', res: 'power', amount: 10 }] },
            { id: 'defer', kind: 'defer', hours: 0, effects: [{ kind: 'later', inSols: 1, at: 'night', label: 'dust', effects: [{ kind: 'res', res: 'power', amount: -7 }] }] },
          ],
        },
      ],
    },
    {
      sol: 3,
      morning: [{ kind: 'flag', flag: 'storm', value: false }],
      faults: [
        {
          id: 'flare',
          station: 'hub',
          options: [
            { id: 'hide', kind: 'robust', hours: 4, effects: [{ kind: 'radiation', amount: 2 }] },
            {
              id: 'defer',
              kind: 'defer',
              hours: 0,
              effects: [{ kind: 'if', cond: { flag: 'pumpOk' }, then: [{ kind: 'radiation', amount: 10 }], else: [{ kind: 'radiation', amount: { roll: 'big', mul: 4 } }] }],
            },
          ],
        },
      ],
    },
  ],
};

const config: MissionConfig = {
  solCount: 3,
  hoursPerSol: 10,
  start: { power: 60, life: 60, shield: 50, health: 100 },
  inventory: { tape: 1 },
  rules: {
    critical: 25,
    maxDamagePerHour: 2,
    nightHours: 14,
    nightly: { power: -2, life: -2, shield: -1 },
    lowPowerThreshold: 30,
    lowPowerLifePenalty: 3,
    nightHeal: 2,
    comfortable: 40,
    nightlyRadiation: 0,
    shieldFactor: 0.7,
    radHealthPerDose: 0.5,
    reserve: { threshold: 10, amount: 0 },
    eva: { hours: 1, life: 2, radiation: 1 },
  },
};

const engine = createEngine(pack);
const deep = (s: GameState) => JSON.parse(JSON.stringify(s));

describe('core engine', () => {
  it('initialises from config and opens sol-1 faults', () => {
    const s = engine.init(1, config);
    expect(s.sol).toBe(1);
    expect(s.hoursLeft).toBe(10);
    expect(s.res).toEqual({ power: 60, life: 60, shield: 50 });
    expect(s.faults.map((f) => f.faultId)).toEqual(['pump']);
    expect(s.rolls.big).toBeGreaterThanOrEqual(5);
    expect(s.rolls.big).toBeLessThanOrEqual(9);
  });

  it('never mutates the input state', () => {
    const s = engine.init(1, config);
    const before = deep(s);
    engine.step(s, { type: 'resolve', faultId: 'pump', optionId: 'robust' });
    engine.step(s, { type: 'endSol' });
    expect(deep(s)).toEqual(before);
  });

  it('charges walking + work hours and records the decision', () => {
    const s = engine.step(engine.init(1, config), { type: 'resolve', faultId: 'pump', optionId: 'robust' });
    expect(s.hoursLeft).toBe(10 - 0.5 - 3);
    expect(s.location).toBe('lab');
    expect(s.flags.pumpOk).toEqual({ value: true, origin: ['s1:pump'] });
    expect(s.decisions).toHaveLength(1);
    expect(s.decisions[0]).toMatchObject({ key: 's1:pump', optionId: 'robust', auto: false, actionIndex: 0 });
  });

  it('consumes items and rejects options without them', () => {
    let s = engine.init(1, config);
    s = engine.step(s, { type: 'resolve', faultId: 'pump', optionId: 'tape' });
    expect(s.items.tape).toBe(0);
    expect(engine.check({ ...s, faults: [{ faultId: 'pump', firstSol: 1 }] }, { type: 'resolve', faultId: 'pump', optionId: 'tape' })).toBe('items');
  });

  it('rejects actions that do not fit in the remaining hours', () => {
    const s = { ...engine.init(1, config), hoursLeft: 2 };
    expect(engine.check(s, { type: 'resolve', faultId: 'pump', optionId: 'robust' })).toBe('hours');
    expect(() => engine.step(s, { type: 'resolve', faultId: 'pump', optionId: 'robust' })).toThrow();
  });

  it('auto-defers open faults at end of sol, applies modifiers and reopens', () => {
    let s = engine.init(1, config);
    s = engine.step(s, { type: 'endSol' });
    expect(s.decisions[0]).toMatchObject({ faultId: 'pump', optionId: 'defer', auto: true, actionIndex: null });
    // nightly base -2 and leak -5
    expect(s.res.life).toBe(60 - 5 - 2);
    expect(s.sol).toBe(2);
    expect(s.faults.map((f) => f.faultId).sort()).toEqual(['panel', 'pump']);
    const leakEntry = s.trace.find((t) => t.key === 'm:1:leak');
    expect(leakEntry?.causes).toEqual(['s1:pump']);
    // resolving the reopened fault removes the modifier
    s = engine.step(s, { type: 'resolve', faultId: 'pump', optionId: 'robust' });
    expect(s.modifiers.find((m) => m.id === 'leak')).toBeUndefined();
  });

  it('locks EVA stations by condition', () => {
    let s = engine.init(1, config);
    s = engine.step(s, { type: 'endSol' });
    expect(engine.isLocked(s, 'out')).toBe(true);
    expect(engine.check(s, { type: 'resolve', faultId: 'panel', optionId: 'clean' })).toBe('locked');
  });

  it('runs delayed effects on the right night with their causes', () => {
    let s = engine.init(1, config);
    s = engine.step(s, { type: 'resolve', faultId: 'pump', optionId: 'robust' });
    s = engine.step(s, { type: 'endSol' });
    s = engine.step(s, { type: 'endSol' }); // panel deferred on sol 2
    s = engine.step(s, { type: 'endSol' }); // sol 3 night is final -> no night
    expect(s.outcome?.won).toBe(true);
    s = engine.init(1, { ...config, solCount: 4 });
    s = engine.step(s, { type: 'endSol' });
    s = engine.step(s, { type: 'endSol' });
    const p = s.pending.find((x) => x.label === 'dust');
    expect(p).toMatchObject({ dueSol: 3, at: 'night', causes: ['s2:panel'] });
    s = engine.step(s, { type: 'endSol' });
    const fired = s.trace.find((t) => t.key === 'p:3:night:dust');
    expect(fired?.deltas.power).toBe(-7);
    expect(fired?.causes).toEqual(['s2:panel']);
  });

  it('conditional effects carry the cause of the flag they read', () => {
    let s = engine.init(1, config);
    s = engine.step(s, { type: 'resolve', faultId: 'pump', optionId: 'robust' });
    s = engine.step(s, { type: 'endSol' });
    s = engine.step(s, { type: 'endSol' });
    s = engine.step(s, { type: 'endSol' });
    const flare = s.trace.find((t) => t.key === 'd:s3:flare');
    expect(flare?.causes).toEqual(['s1:pump', 's3:flare']);
    expect(flare?.deltas.dose).toBeGreaterThan(0);
  });

  it('critical resources hurt health hour by hour and death ends the mission', () => {
    let s = engine.init(1, { ...config, start: { power: 0, life: 60, shield: 50, health: 30 } });
    s = engine.step(s, { type: 'routine', routineId: 'fixLab' });
    // 2.5 hours at power 0 -> 2/h ... then power rises to 5
    expect(s.health).toBeLessThan(30);
    expect(s.damage.power).toBeGreaterThan(0);
    s = engine.step(s, { type: 'endSol' });
    expect(s.outcome).toMatchObject({ won: false, cause: 'power' });
    expect(engine.validActions(s)).toEqual([]);
    expect(engine.check(s, { type: 'endSol' })).toBe('ended');
  });

  it('routines are once per sol', () => {
    let s = engine.init(1, config);
    s = engine.step(s, { type: 'routine', routineId: 'fixLab' });
    expect(engine.check(s, { type: 'routine', routineId: 'fixLab' })).toBe('routineDone');
    s = engine.step(s, { type: 'endSol' });
    expect(engine.check(s, { type: 'routine', routineId: 'fixLab' })).toBeNull();
  });

  it('EVA trips cost life support, dose and suit-up time', () => {
    let s = engine.init(1, config);
    s = engine.step(s, { type: 'resolve', faultId: 'pump', optionId: 'robust' });
    s = engine.step(s, { type: 'endSol' });
    s = { ...s, flags: { ...s.flags, storm: { value: false, origin: [] } } };
    const cost = engine.optionCost(s, 'panel', 'clean');
    expect(cost).toMatchObject({ walk: 1, eva: 1, work: 2, total: 4, evaTrip: true });
    const lifeBefore = s.res.life;
    s = engine.step(s, { type: 'resolve', faultId: 'panel', optionId: 'clean' });
    expect(s.res.life).toBe(lifeBefore - 2);
    expect(s.dose).toBeGreaterThan(0);
  });

  it('is deterministic for the same seed and actions', () => {
    const run = (seed: number) => {
      let s = engine.init(seed, config);
      s = engine.step(s, { type: 'endSol' });
      s = engine.step(s, { type: 'endSol' });
      s = engine.step(s, { type: 'endSol' });
      return JSON.stringify(s);
    };
    expect(run(42)).toBe(run(42));
  });
});
