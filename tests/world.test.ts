import { describe, expect, it } from 'vitest';
import { ACTION_KINDS, OPTION_ACTIONS, ROUTINE_ACTIONS, optionAction, routineAction } from '../src/content/actions';
import { SCENARIO } from '../src/content';
import { path, pathLength, pointAt, SPOTS, walkSeconds } from '../src/scene/world';
import { sceneLook, workLook } from '../src/scene/look';
import { engine, DEFAULT_CONFIG } from '../src/content';

const allFaults = SCENARIO.sols.flatMap((s) => s.faults);

describe('action kinds (presentation map)', () => {
  it('every option of every fault has an action kind', () => {
    for (const f of allFaults)
      for (const o of f.options) {
        const k = OPTION_ACTIONS[f.id]?.[o.id];
        expect(k, `${f.id}.${o.id}`).toBeDefined();
        expect(ACTION_KINDS).toContain(optionAction(f.id, o.id));
      }
  });
  it('every defer is a wait', () => {
    for (const f of allFaults) for (const o of f.options) if (o.kind === 'defer') expect(optionAction(f.id, o.id)).toBe('wait');
  });
  it('every maintenance job has an action kind', () => {
    for (const r of SCENARIO.routines) {
      expect(ROUTINE_ACTIONS[r.id], r.id).toBeDefined();
      expect(ACTION_KINDS).toContain(routineAction(r.id));
    }
  });
  it('no stale entries in the map', () => {
    for (const [fid, opts] of Object.entries(OPTION_ACTIONS)) {
      const f = allFaults.find((x) => x.id === fid);
      expect(f, fid).toBeDefined();
      for (const oid of Object.keys(opts)) expect(f!.options.some((o) => o.id === oid), `${fid}.${oid}`).toBe(true);
    }
  });
});

describe('first-person world', () => {
  it('every station has a spot and a path from every other', () => {
    const ids = SCENARIO.stations.map((s) => s.id);
    for (const a of ids) {
      expect(SPOTS[a], a).toBeDefined();
      for (const b of ids) {
        const p = path(a, b);
        expect(p[0]).toEqual(SPOTS[a]!.stand);
        expect(p[p.length - 1]).toEqual(SPOTS[b]!.stand);
      }
    }
  });
  it('outside stations are clearly far; walks are short and capped', () => {
    expect(pathLength(path('hub', 'solar'))).toBeGreaterThan(20);
    expect(pathLength(path('hub', 'landing'))).toBeGreaterThan(20);
    for (const id of Object.keys(SPOTS)) expect(walkSeconds(path('hub', id))).toBeLessThanOrEqual(3.2);
  });
  it('EVA paths go through the airlock', () => {
    const p = path('hub', 'solar');
    expect(p.some(([x]) => x > 11)).toBe(true);
  });
  it('pointAt runs from start to end', () => {
    const p = path('greenhouse', 'landing');
    expect(pointAt(p, 0)).toEqual(p[0]);
    expect(pointAt(p, 1)).toEqual(p[p.length - 1]);
  });
});

describe('scene looks come from the state', () => {
  it('fresh game: lights on, no storm, faults raise alarms at their stations', () => {
    const s = engine.init(5, DEFAULT_CONFIG);
    expect(sceneLook(s).lights).toBe('on');
    const w = workLook(s, (f) => engine.fault(f).station);
    for (const f of s.faults) expect(w.alarm[engine.fault(f.faultId).station]).toBe(true);
  });
  it('a choice is remembered (results stay)', () => {
    let s = engine.init(5, DEFAULT_CONFIG);
    const f = s.faults[0]!;
    const opt = engine.fault(f.faultId).options[0]!;
    s = engine.step(s, { type: 'resolve', faultId: f.faultId, optionId: opt.id });
    const w = workLook(s, (x) => engine.fault(x).station);
    expect(w.chosen[f.faultId]).toBe(opt.id);
    expect(w.open).not.toContain(f.faultId);
  });
});
