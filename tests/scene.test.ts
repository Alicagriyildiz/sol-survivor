// Pure parts of the 3D scene: layout, waypoint paths, walk timing, camera projection, and the
// read-only "look" derived from the game state. The WebGL rendering itself is checked by hand.
import { describe, expect, it } from 'vitest';
import { OrthographicCamera, Vector3 } from 'three';
import { DEFAULT_CONFIG, engine } from '../src/content';
import type { GameState } from '../src/sim/types';
import { CAMERA_OFFSET, FRAME, fitZoom, modeFor, path, pathLength, places, pointAt, project, toWorld, walkSeconds, type Mode } from '../src/scene/layout';
import { sceneLook } from '../src/scene/look';

const ids = engine.content.stations.map((s) => s.id);

describe('scene layout', () => {
  it('places every station of the content, in both layouts', () => {
    for (const mode of ['wide', 'compact'] as Mode[]) for (const id of ids) expect(places(mode)[id], `${mode}/${id}`).toBeDefined();
  });

  it('puts the EVA stations clearly farther from the hub than the inside ones', () => {
    for (const mode of ['wide', 'compact'] as Mode[]) {
      const pl = places(mode);
      const d = (id: string) => Math.hypot(pl[id]!.at.u - pl.hub!.at.u, pl[id]!.at.v - pl.hub!.at.v);
      const inside = engine.content.stations.filter((s) => !s.eva && s.id !== 'hub').map((s) => d(s.id));
      const outside = engine.content.stations.filter((s) => s.eva).map((s) => d(s.id));
      expect(Math.min(...outside)).toBeGreaterThan(1.5 * Math.max(...inside));
    }
  });

  it('walks inside through the hub and outside through the airlock', () => {
    const pl = places('wide');
    expect(path('greenhouse', 'battery')).toEqual([pl.greenhouse!.stand, pl.hub!.stand, pl.battery!.stand]);
    const toSolar = path('hub', 'solar');
    expect(toSolar[1]).toEqual(pl.airlock!.stand);
    expect(toSolar.at(-1)).toEqual(pl.solar!.stand);
    expect(path('shelter', 'shelter')).toHaveLength(1);
    for (const a of ids) for (const b of ids) {
      const p = path(a, b, 'compact');
      expect(p[0]).toEqual(places('compact')[a]!.stand);
      expect(p.at(-1)).toEqual(places('compact')[b]!.stand);
    }
  });

  it('never takes longer than 1.5 s to walk, and 0 s to stay', () => {
    for (const a of ids) for (const b of ids) {
      const t = walkSeconds(path(a, b));
      expect(t).toBeLessThanOrEqual(1.5);
      if (a === b) expect(t).toBe(0);
      else expect(t).toBeGreaterThan(0.4);
    }
  });

  it('interpolates along the path by distance', () => {
    const p = path('greenhouse', 'battery');
    expect(pointAt(p, 0)).toEqual(p[0]);
    expect(pointAt(p, 1)).toEqual(p.at(-1));
    const mid = pointAt(p, 0.5);
    const first = pathLength([p[0]!, mid]);
    expect(first).toBeCloseTo(pathLength(p) / 2, 5);
  });

  it('uses the compact layout on narrow screens', () => {
    expect(modeFor(390)).toBe('compact');
    expect(modeFor(1000)).toBe('wide');
  });

  it('projects like a three.js orthographic camera (labels sit on their buildings)', () => {
    for (const [w, h] of [
      [950, 490],
      [356, 349],
    ] as const) {
      const mode = modeFor(w);
      const zoom = fitZoom(w, h, mode);
      const [cx, cz] = toWorld(FRAME[mode].center);
      const cam = new OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 1, 200);
      cam.position.set(cx + CAMERA_OFFSET[0], CAMERA_OFFSET[1], cz + CAMERA_OFFSET[2]);
      cam.lookAt(cx, 0, cz);
      cam.zoom = zoom;
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld();
      for (const id of ids) {
        const p = places(mode)[id]!;
        const [x, z] = toWorld(p.at);
        const v = new Vector3(x, p.labelY, z).project(cam);
        const [sx, sy] = project(p.at, p.labelY, zoom, w, h, mode);
        expect(sx).toBeCloseTo(((v.x + 1) / 2) * w, 3);
        expect(sy).toBeCloseTo(((1 - v.y) / 2) * h, 3);
        // Every label is on screen.
        expect(sx).toBeGreaterThan(0);
        expect(sx).toBeLessThan(w);
        expect(sy).toBeGreaterThan(0);
        expect(sy).toBeLessThan(h);
      }
    }
  });
});

/** Play the first non-defer option that fits (else end the sol) until `sol` starts. */
function playTo(seed: number, sol: number, pick?: (s: GameState, faultId: string) => string | null): GameState {
  let s = engine.init(seed, DEFAULT_CONFIG);
  for (let guard = 0; guard < 400 && s.sol < sol && !s.outcome; guard++) {
    const f = s.faults[0];
    if (!f) {
      s = engine.step(s, { type: 'endSol' });
      continue;
    }
    const chosen = pick?.(s, f.faultId);
    const opt =
      (chosen && !engine.check(s, { type: 'resolve', faultId: f.faultId, optionId: chosen }) ? chosen : null) ??
      engine.fault(f.faultId).options.find((o) => o.kind !== 'defer' && !engine.check(s, { type: 'resolve', faultId: f.faultId, optionId: o.id }))?.id;
    s = opt ? engine.step(s, { type: 'resolve', faultId: f.faultId, optionId: opt }) : engine.step(s, { type: 'endSol' });
  }
  return s;
}

describe('scene look (read-only view of the state)', () => {
  it('starts calm: lights on, no storm, no event, plain shelter', () => {
    expect(sceneLook(engine.init(8, DEFAULT_CONFIG))).toEqual({
      lights: 'on',
      storm: false,
      solarEvent: false,
      shelterBig: false,
      panelsDusty: false,
      night: false,
    });
  });

  it('dims and turns off the base lights as power falls', () => {
    const s = engine.init(8, DEFAULT_CONFIG);
    expect(sceneLook({ ...s, res: { ...s.res, power: 30 } }).lights).toBe('dim');
    expect(sceneLook({ ...s, res: { ...s.res, power: 10 } }).lights).toBe('off');
  });

  it('shows the dust storm on the storm sols and the solar event on sol 12', () => {
    const s9 = playTo(8, 9);
    expect(s9.sol).toBe(9);
    expect(sceneLook(s9).storm).toBe(true);
    const s12 = playTo(8, 12);
    expect(s12.sol).toBe(12);
    expect(sceneLook(s12)).toMatchObject({ storm: false, solarEvent: true });
    expect(sceneLook(playTo(8, 11)).solarEvent).toBe(false);
  });

  it('grows the shelter mound only when the wall was reinforced on sol 6', () => {
    const built = playTo(8, 7, (_s, f) => (f === 's6_shelter' ? 'regolith' : null));
    const skipped = playTo(8, 7, (_s, f) => (f === 's6_shelter' ? 'defer' : null));
    expect(sceneLook(built).shelterBig).toBe(true);
    expect(sceneLook(skipped).shelterBig).toBe(false);
  });

  it('shows dusty panels while the sol 4 dust is on them', () => {
    const s4 = playTo(8, 4);
    expect(s4.sol).toBe(4);
    expect(sceneLook(s4).panelsDusty).toBe(true);
    const cleaned = engine.step(s4, { type: 'resolve', faultId: 's4_dust', optionId: engine.fault('s4_dust').options[0]!.id });
    expect(sceneLook(cleaned).panelsDusty).toBe(false);
  });
});
