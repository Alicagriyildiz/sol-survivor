import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, ITEMS, SCENARIO, SOURCES, engine, tr } from '../src/content';
import type { Effect, FaultDef, GameState, MissionConfig, OptionDef } from '../src/sim/types';

const allFaults: { sol: number; f: FaultDef }[] = SCENARIO.sols.flatMap((s) => s.faults.map((f) => ({ sol: s.sol, f })));

function walk(effects: Effect[], fn: (e: Effect) => void) {
  for (const e of effects) {
    fn(e);
    if (e.kind === 'if') {
      walk(e.then, fn);
      walk(e.else ?? [], fn);
    }
    if (e.kind === 'later') walk(e.effects, fn);
  }
}

function hasDirectCost(o: OptionDef): boolean {
  if (o.hours > 0 || Object.keys(o.items ?? {}).length > 0) return true;
  let cost = false;
  walk(o.effects, (e) => {
    if (e.kind === 'res' && (typeof e.amount !== 'number' || e.amount < 0)) cost = true;
    if (e.kind === 'health' || e.kind === 'radiation' || e.kind === 'reopen') cost = true;
    if (e.kind === 'hours' && e.amount < 0) cost = true;
    if (e.kind === 'modifier' && Object.values(e.nightly).some((v) => (v ?? 0) < 0)) cost = true;
  });
  return cost;
}

describe('content', () => {
  it('has 15 sols with 1-3 faults each', () => {
    expect(SCENARIO.sols.map((s) => s.sol)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    expect(DEFAULT_CONFIG.solCount).toBe(15);
  });

  it('every fault has 2-4 options and exactly one defer', () => {
    for (const { f } of allFaults) {
      expect(f.options.length, f.id).toBeGreaterThanOrEqual(2);
      expect(f.options.length, f.id).toBeLessThanOrEqual(4);
      expect(f.options.filter((o) => o.kind === 'defer'), f.id).toHaveLength(1);
      expect(new Set(f.options.map((o) => o.id)).size).toBe(f.options.length);
    }
  });

  it('no option is free: direct cost, or (defer) a forgone investment / ongoing problem', () => {
    for (const { sol, f } of allFaults) {
      for (const o of f.options) {
        if (hasDirectCost(o)) continue;
        // A cost-free-looking defer is allowed only when it forgoes an investment or leaves
        // an ongoing modifier from the sol's morning event running.
        const forgoes = f.options.some((x) => x.tags?.includes('invest'));
        const morning = SCENARIO.sols.find((s) => s.sol === sol)?.morning ?? [];
        let ongoing = false;
        walk(morning, (e) => {
          if (e.kind === 'modifier' && e.untilResolved === f.id) ongoing = true;
        });
        expect(o.kind === 'defer' && (forgoes || ongoing), `${f.id}/${o.id} looks free`).toBe(true);
      }
    }
  });

  it('every station, item and text key referenced exists', () => {
    const stations = new Set(SCENARIO.stations.map((s) => s.id));
    for (const st of stations) expect(tr.stations[st]?.name, st).toBeTruthy();
    for (const r of SCENARIO.routines) {
      expect(stations.has(r.station)).toBe(true);
      expect(tr.routines[r.id]?.label, r.id).toBeTruthy();
    }
    for (const item of ITEMS) expect(tr.items[item]).toBeTruthy();
    for (const { f } of allFaults) {
      expect(stations.has(f.station), f.id).toBe(true);
      const t = tr.faults[f.id];
      expect(t?.title, f.id).toBeTruthy();
      expect(t?.desc, f.id).toBeTruthy();
      for (const o of f.options) {
        if (o.station) expect(stations.has(o.station)).toBe(true);
        for (const item of Object.keys(o.items ?? {})) expect((ITEMS as readonly string[]).includes(item)).toBe(true);
        expect(t?.options[o.id]?.label, `${f.id}/${o.id}`).toBeTruthy();
        expect(t?.options[o.id]?.why, `${f.id}/${o.id}`).toBeTruthy();
        walk(o.effects, (e) => {
          if (e.kind === 'later') expect(tr.effects[e.label], e.label).toBeTruthy();
          if (e.kind === 'modifier') expect(tr.effects[e.label], e.label).toBeTruthy();
        });
      }
    }
    for (const sol of SCENARIO.sols) {
      for (const n of sol.notes ?? []) expect(tr.chain[n.id], `sol ${sol.sol} note ${n.id}`).toBeTruthy();
      for (const f of sol.faults) for (const o of f.options) for (const n of o.notes ?? []) expect(tr.chain[n.id], `${f.id}/${o.id} note ${n.id}`).toBeTruthy();
      if (sol.morning) expect(tr.events[`sol${sol.sol}.morning`], `event sol${sol.sol}.morning`).toBeTruthy();
      if (sol.night) expect(tr.events[`sol${sol.sol}.night`], `event sol${sol.sol}.night`).toBeTruthy();
    }
    for (let sol = 1; sol <= 15; sol++) {
      expect(tr.sols[sol]?.title).toBeTruthy();
      expect(tr.sols[sol]?.weather).toBeTruthy();
      expect(tr.sols[sol]?.message).toBeTruthy();
      expect(tr.notes[sol], `note ${sol}`).toBeTruthy();
      const src = SOURCES.find((s) => s.sol === sol);
      expect(src?.source, `source ${sol}`).toBeTruthy();
      expect(src?.verified).toBe(false);
    }
  });

  it('every option of every sol is selectable in some reachable state', () => {
    // Immortal config so an all-defer run reaches every sol.
    const cfg: MissionConfig = { ...DEFAULT_CONFIG, rules: { ...DEFAULT_CONFIG.rules, maxDamagePerHour: 0, radHealthPerDose: 0 } };
    let s: GameState = engine.init(1, cfg);
    const atSol: GameState[] = [];
    for (let sol = 1; sol <= 15; sol++) {
      atSol[sol] = s;
      expect(s.outcome).toBeNull();
      s = engine.step(s, { type: 'endSol' });
    }
    for (const { sol, f } of allFaults) {
      const base = atSol[sol]!;
      const flags: GameState['flags'] = {};
      for (const name of ['recyclerServiced', 'soilClean', 'panelsTilted', 'shelterReinforced', 'beaconReserve', 'padClear']) {
        flags[name] = { value: true, origin: [] };
      }
      const st: GameState = {
        ...base,
        flags,
        items: { patchKit: 3, spareFilter: 3, tape: 3 },
        faults: [{ faultId: f.id, firstSol: sol }],
        hoursLeft: DEFAULT_CONFIG.hoursPerSol,
      };
      for (const o of f.options) {
        expect(engine.check(st, { type: 'resolve', faultId: f.id, optionId: o.id }), `${f.id}/${o.id}`).toBeNull();
        const next = engine.step(st, { type: 'resolve', faultId: f.id, optionId: o.id });
        expect(next.decisions.at(-1)?.optionId).toBe(o.id);
      }
    }
  });

  it('every fault spawns for some seed', () => {
    const seen = new Set<string>();
    const cfg: MissionConfig = { ...DEFAULT_CONFIG, rules: { ...DEFAULT_CONFIG.rules, maxDamagePerHour: 0, radHealthPerDose: 0 } };
    for (let seed = 1; seed <= 40; seed++) {
      let s = engine.init(seed, cfg);
      while (!s.outcome) {
        s.faults.forEach((f) => seen.add(f.faultId));
        s = engine.step(s, { type: 'endSol' });
      }
    }
    for (const { f } of allFaults) expect(seen.has(f.id), f.id).toBe(true);
  });

  it('every invest-tagged option sets a flag that something reads later', () => {
    const reads = new Set<string>();
    const collect = (effects: Effect[]) =>
      walk(effects, (e) => {
        if (e.kind === 'if') JSON.stringify(e.cond).replace(/"(?:flag|notFlag)":"(\w+)"/g, (_, n: string) => (reads.add(n), ''));
      });
    for (const sol of SCENARIO.sols) {
      collect(sol.morning ?? []);
      collect(sol.night ?? []);
      for (const f of sol.faults) for (const o of f.options) {
        collect(o.effects);
        if (o.requires) JSON.stringify(o.requires).replace(/"flag":"(\w+)"/g, (_, n: string) => (reads.add(n), ''));
      }
    }
    for (const { f } of allFaults) for (const o of f.options) {
      if (!o.tags?.includes('invest')) continue;
      const sets: string[] = [];
      walk(o.effects, (e) => e.kind === 'flag' && sets.push(e.flag));
      const hasModifier = o.effects.some((e) => e.kind === 'modifier' && Object.values(e.nightly).some((v) => (v ?? 0) > 0));
      expect(sets.some((n) => reads.has(n)) || hasModifier, `${f.id}/${o.id}`).toBe(true);
    }
  });
});

import { numSuffix } from '../src/content/lang/tr';
describe('turkish number suffixes', () => {
  it('follows vowel harmony and consonant hardening', () => {
    const loc = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((n) => `${n}${numSuffix(n, 'loc')}`);
    expect(loc).toEqual(["1'de", "2'de", "3'te", "4'te", "5'te", "6'da", "7'de", "8'de", "9'da", "10'da", "11'de", "12'de", "13'te", "14'te", "15'te"]);
    expect(`${6}${numSuffix(6, 'abl')}`).toBe("6'dan");
    expect(`${13}${numSuffix(13, 'abl')}`).toBe("13'ten");
  });
});
