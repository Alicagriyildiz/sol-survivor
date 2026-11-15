// Real NASA data -> game numbers. The snapshot files in src/data/ are written once by
// `npm run fetch-data` (DONKI, RadLab, OSDR) or typed in by hand from official pages
// (published-values.json). The game never goes online. Every function here is pure and
// documented in docs/DATA.md; the core (src/sim) never sees these files, only the numbers
// that the scenario builds from them.
import donki from '../data/donki-solar-events.json';
import osdr from '../data/osdr-studies.json';
import published from '../data/published-values.json';
import radlab from '../data/radlab-iss-dose.json';
import type { GameState, Rules } from '../sim/types';
import { SOURCES } from './sources';

const roundHalf = (v: number) => Math.round(v * 2) / 2;
const round2 = (v: number) => Math.round(v * 100) / 100;

// ---------------------------------------------------------------- solar events (DONKI) -> sol 12

/** Flare strength from its GOES peak X-ray flux: log10(flux / 1e-6 W/m^2).
 *  C1 = 0, M1 = 1, X1 = 2, X10 = 3. One step = ten times more X-ray power. */
export function flareStrength(peakFluxWm2: number): number {
  return Math.log10(peakFluxWm2 / 1e-6);
}

/** Game scale (simplified, NOT physics): radiation reaching the base before shelter and
 *  shield, in game dose units. Grows linearly with strength, so a stronger event always
 *  hits harder. Range ~37 (C7.6) .. ~86 (X8.2). */
export function eventRadiation(strength: number): number {
  return roundHalf(16 + 24 * strength);
}

/** Game scale: Shield points lost when the event arrives (sensors and shelter electronics
 *  take a beating). Also grows with strength. */
export function eventShieldHit(strength: number): number {
  return roundHalf(3 * strength);
}

export type EventLevel = 'weak' | 'moderate' | 'strong' | 'extreme';
/** Kid-facing label, from the GOES class letter and strength. */
export function eventLevel(strength: number): EventLevel {
  if (strength < 1) return 'weak'; // C class
  if (strength < 2) return 'moderate'; // M class
  if (strength < 2.5) return 'strong'; // X1 .. ~X3
  return 'extreme';
}

export interface SolarEvent {
  index: number;
  flrID: string;
  classType: string;
  peakFluxWm2: number;
  /** UTC date of the flare peak, YYYY-MM-DD. */
  date: string;
  peakTime: string;
  sourceLocation: string;
  activeRegionNum: number | null;
  linkedSepCount: number;
  link: string;
  strength: number;
  level: EventLevel;
  radiation: number;
  shieldHit: number;
}

export const SOLAR_EVENTS: SolarEvent[] = donki.events.map((e, index) => {
  const strength = round2(flareStrength(e.peakFluxWm2));
  return {
    index,
    flrID: e.flrID,
    classType: e.classType,
    peakFluxWm2: e.peakFluxWm2,
    date: e.peakTime.slice(0, 10),
    peakTime: e.peakTime,
    sourceLocation: e.sourceLocation,
    activeRegionNum: e.activeRegionNum,
    linkedSepCount: e.linkedSEP.length,
    link: e.link,
    strength,
    level: eventLevel(strength),
    radiation: eventRadiation(strength),
    shieldHit: eventShieldHit(strength),
  };
});

/** Roll id that picks the sol 12 event (made at init from the seed, like every roll). */
export const SOLAR_EVENT_ROLL = 'speEvent';

export const DONKI_META = {
  source: donki.source,
  attribution: donki.attribution,
  query: donki.query,
  exampleRequest: donki.exampleRequest,
  downloadedAt: donki.downloadedAt,
  counts: donki.counts,
  selectionRule: donki.selectionRule,
};

// ---------------------------------------------------------------- radiation dose (RAD + RadLab)

const pv = published.values;

/** Curiosity RAD, Mars surface absorbed dose rate (published value, mGy per day). */
export const MARS_SURFACE_MGY_PER_DAY = pv.marsSurfaceAbsorbedDose.value / 1000;
/** RadLab ISS DosTel1 time-weighted mean (downloaded, mGy per day). */
export const ISS_MGY_PER_DAY = radlab.mGyPerDay;

/** Conversion for the dose meter: the game's nightly background radiation (before the
 *  Shield) equals one Mars surface day as measured by RAD. So 1 game dose unit =
 *  RAD rate / nightlyRadiation mGy. The Shield, EVA and solar event amounts stay game
 *  scale; only the unit is anchored to the measurement. */
export function mGyPerDoseUnit(nightlyRadiation: number): number {
  return MARS_SURFACE_MGY_PER_DAY / nightlyRadiation;
}

export const RADLAB_META = {
  source: radlab.source,
  attribution: radlab.attribution,
  request: radlab.request,
  query: radlab.query,
  downloadedAt: radlab.downloadedAt,
  readings: radlab.readings,
  method: radlab.method,
  meanUGyPerHour: radlab.timeWeightedMeanUGyPerHour,
};

// ---------------------------------------------------------------- 2018 dust storm -> sols 9-12 power

/** Panel output on a normal sol in game power points. GAME DESIGN, not a measurement. */
export const PANEL_OUTPUT_PER_SOL = 5;

export const STORM = {
  tauPeak: pv.stormTauPeak.value,
  tauNormal: pv.stormTauNormal.value,
  tauRecharge: pv.stormTauRecharge.value,
  opportunityLowestWh: pv.opportunityLowestEnergy.value,
};

/** Simplified panel efficiency from opacity: 1 at the usual tau, 0 at the tau where
 *  Opportunity could no longer recharge, linear in between. */
export function panelEfficiency(tau: number): number {
  const f = (STORM.tauRecharge - tau) / (STORM.tauRecharge - STORM.tauNormal);
  return Math.max(0, Math.min(1, f));
}

/** Extra power lost each storm night: the panel output that the storm takes away. */
export const STORM_NIGHT_POWER_LOSS = roundHalf(PANEL_OUTPUT_PER_SOL * (1 - panelEfficiency(STORM.tauPeak)));

// ---------------------------------------------------------------- OSDR studies -> sol notes

export interface StudyNote {
  sol: number;
  accession: string;
  title: string;
  url: string;
}

export const OSDR_STUDIES: StudyNote[] = osdr.studies.map((s) => ({ sol: s.sol, accession: s.accession, title: s.title, url: s.url }));
export const OSDR_META = { source: osdr.source, attribution: osdr.attribution, query: osdr.query, downloadedAt: osdr.downloadedAt };

export const PUBLISHED = published;

// ---------------------------------------------------------------- views for the UI (pure)


/** The sol the solar event arrives on (content fact, see scenario.ts sol12). */
export const SOLAR_EVENT_SOL = 12;

/** The real event this mission gets. Same seed -> same event, also in the Black Box. */
export function solarEventOf(s: Pick<GameState, 'rolls'>): SolarEvent {
  return SOLAR_EVENTS[s.rolls[SOLAR_EVENT_ROLL] ?? 0] ?? SOLAR_EVENTS[0]!;
}

export type SpaceWeatherKind = 'calm' | 'watch' | 'warn' | 'today' | 'past';
/** Briefing forecast: quiet, then an active region, then a warning with the strength. */
export function spaceWeather(s: Pick<GameState, 'rolls' | 'sol'>): { kind: SpaceWeatherKind; event: SolarEvent } {
  const event = solarEventOf(s);
  const d = SOLAR_EVENT_SOL - s.sol;
  const kind: SpaceWeatherKind = d > 6 ? 'calm' : d > 3 ? 'watch' : d > 0 ? 'warn' : d === 0 ? 'today' : 'past';
  return { kind, event };
}

/** Dose in mGy for display (see mGyPerDoseUnit). */
export function doseMGy(dose: number, rules: Pick<Rules, 'nightlyRadiation'>): number {
  return dose * mGyPerDoseUnit(rules.nightlyRadiation);
}

/** Storm sols get the 2018 storm line in the briefing and report. */
export const STORM_NOTE_SOLS = [8, 9, 10];

/** OSDR study note for a sol, if any. */
export function studyFor(sol: number): StudyNote | undefined {
  return OSDR_STUDIES.find((x) => x.sol === sol);
}

export const VERIFIED_NOTES = SOURCES.filter((x) => x.verified).length;
