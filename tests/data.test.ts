import { describe, expect, it } from 'vitest';
import donki from '../src/data/donki-solar-events.json';
import osdr from '../src/data/osdr-studies.json';
import radlab from '../src/data/radlab-iss-dose.json';
import { counterfactual, replay } from '../src/blackbox';
import { BOTS, playGame } from '../src/bots/bots';
import { DEFAULT_CONFIG, engine } from '../src/content';
import * as data from '../src/content/data';
import type { GameState } from '../src/sim/types';

describe('data snapshots', () => {
  it('every snapshot names its source, request, query, download date and attribution', () => {
    for (const d of [donki, radlab, osdr] as Record<string, unknown>[]) {
      expect(d.source).toBeTruthy();
      expect(d.attribution).toBeTruthy();
      expect(d.query).toBeTruthy();
      expect(String(d.downloadedAt)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(d.request ?? d.requests ?? d.exampleRequest).toBeTruthy();
    }
  });
  it('no API key is stored in the snapshots', () => {
    expect(JSON.stringify([donki, radlab, osdr])).not.toMatch(/api_key=(?!DEMO_KEY)/);
  });
  it('4-6 real DONKI events, each linked to a particle event', () => {
    expect(data.SOLAR_EVENTS.length).toBeGreaterThanOrEqual(4);
    expect(data.SOLAR_EVENTS.length).toBeLessThanOrEqual(6);
    for (const e of data.SOLAR_EVENTS) {
      expect(e.classType).toMatch(/^[CMX]\d/);
      expect(e.linkedSepCount).toBeGreaterThan(0);
      expect(e.link).toMatch(/^https:\/\/ccmc\.gsfc\.nasa\.gov\/DONKI\//);
    }
  });
  it('published values all carry a URL and a quote', () => {
    for (const v of Object.values(data.PUBLISHED.values)) {
      expect(v.url).toMatch(/^https:\/\//);
      expect(v.quote.length).toBeGreaterThan(10);
    }
  });
});

describe('scale functions', () => {
  it('flare strength: C1 = 0, M1 = 1, X1 = 2', () => {
    expect(data.flareStrength(1e-6)).toBeCloseTo(0);
    expect(data.flareStrength(1e-5)).toBeCloseTo(1);
    expect(data.flareStrength(1e-4)).toBeCloseTo(2);
  });
  it('a stronger event always costs more Shield and more radiation', () => {
    const byFlux = [...data.SOLAR_EVENTS].sort((a, b) => a.peakFluxWm2 - b.peakFluxWm2);
    for (let i = 1; i < byFlux.length; i++) {
      expect(byFlux[i]!.radiation).toBeGreaterThan(byFlux[i - 1]!.radiation);
      expect(byFlux[i]!.shieldHit).toBeGreaterThanOrEqual(byFlux[i - 1]!.shieldHit);
    }
  });
  it('in the game, a stronger event hurts more (same state, same choice)', () => {
    // Play one careful mission to the morning of sol 12, then swap only the event roll.
    const run = playGame(engine, BOTS.careful, 3, DEFAULT_CONFIG);
    let s = engine.init(3, DEFAULT_CONFIG);
    for (const a of run.actions) {
      if (s.sol === 11 && a.type === 'endSol') break;
      s = engine.step(s, a);
    }
    const results = [...data.SOLAR_EVENTS]
      .sort((a, b) => a.peakFluxWm2 - b.peakFluxWm2)
      .map((e) => {
        const base: GameState = { ...s, rolls: { ...s.rolls, [data.SOLAR_EVENT_ROLL]: e.index } };
        const morning = engine.step(base, { type: 'endSol' });
        const after = engine.step(morning, { type: 'resolve', faultId: 's12_spe', optionId: 'defer' });
        return { shieldLost: base.res.shield - morning.res.shield, dose: after.dose - morning.dose };
      });
    for (let i = 1; i < results.length; i++) {
      expect(results[i]!.dose).toBeGreaterThan(results[i - 1]!.dose);
      expect(results[i]!.shieldLost).toBeGreaterThanOrEqual(results[i - 1]!.shieldLost);
    }
  });
  it('2018 storm: at tau 10.8 the panels give nothing, at the usual tau they work', () => {
    expect(data.panelEfficiency(data.STORM.tauPeak)).toBe(0);
    expect(data.panelEfficiency(data.STORM.tauNormal)).toBe(1);
    expect(data.STORM_NIGHT_POWER_LOSS).toBe(data.PANEL_OUTPUT_PER_SOL);
  });
  it('dose unit: one unshielded night of background equals one RAD Mars day', () => {
    expect(data.doseMGy(DEFAULT_CONFIG.rules.nightlyRadiation, DEFAULT_CONFIG.rules)).toBeCloseTo(data.MARS_SURFACE_MGY_PER_DAY);
  });
});

describe('real event in the mission', () => {
  it('same seed -> same event; the Black Box counterfactual gets the same event', () => {
    const run = playGame(engine, BOTS.random, 42, DEFAULT_CONFIG);
    const log = { seed: 42, config: DEFAULT_CONFIG, actions: run.actions };
    const orig = replay(engine, log.seed, log.config, log.actions);
    expect(data.solarEventOf(orig)).toEqual(data.solarEventOf(engine.init(42, DEFAULT_CONFIG)));
    const first = orig.decisions[0]!;
    const alt = engine.fault(first.faultId).options.find((o) => o.id !== first.optionId)!.id;
    const cf = counterfactual(engine, log, 0, alt);
    expect(cf.alt.final.rolls[data.SOLAR_EVENT_ROLL]).toBe(orig.rolls[data.SOLAR_EVENT_ROLL]);
  });
  it('every event can come up (seeds 1-200)', () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 200; seed++) seen.add(engine.init(seed, DEFAULT_CONFIG).rolls[data.SOLAR_EVENT_ROLL]!);
    expect(seen.size).toBe(data.SOLAR_EVENTS.length);
  });
  it('space weather warns before sol 12 and names the strength', () => {
    const s = engine.init(1, DEFAULT_CONFIG);
    expect(data.spaceWeather({ ...s, sol: 3 }).kind).toBe('calm');
    expect(data.spaceWeather({ ...s, sol: 6 }).kind).toBe('watch');
    expect(data.spaceWeather({ ...s, sol: 10 }).kind).toBe('warn');
    expect(data.spaceWeather({ ...s, sol: 12 }).kind).toBe('today');
    expect(data.spaceWeather({ ...s, sol: 13 }).kind).toBe('past');
  });
});

describe('emergency reserve rule (session 3)', () => {
  it('the reserve kicks in at the same line where Health starts to drain', () => {
    expect(DEFAULT_CONFIG.rules.reserve.threshold).toBe(DEFAULT_CONFIG.rules.critical);
  });
});
