// Read-only views of the state for presentation layers (2D UI now, 3D scene later).
// Pure and content-agnostic, like the rest of src/sim.
import type { Engine, OptionCost } from './engine';
import {
  RESOURCES,
  type Action,
  type ChainNote,
  type DecisionKey,
  type Deltas,
  type GameState,
  type Invalid,
  type OptionTag,
  type ResourceId,
  type Rules,
  type Source,
} from './types';

export type Status = 'ok' | 'low' | 'critical' | 'empty';

export function resourceStatus(value: number, rules: Rules): Status {
  if (value <= 0) return 'empty';
  if (value < rules.critical) return 'critical';
  if (value < rules.critical + 20) return 'low';
  return 'ok';
}

export function healthStatus(health: number): Status {
  if (health <= 0) return 'empty';
  if (health < 25) return 'critical';
  if (health < 50) return 'low';
  return 'ok';
}

/** Resources currently hurting health. */
export function criticalResources(s: GameState): ResourceId[] {
  return RESOURCES.filter((r) => s.res[r] < s.config.rules.critical);
}

/** What an action would do right now, split so the UI can explain each part. */
export interface PreviewParts {
  /** The action's own effect (work, walking, EVA). Emergency reserves are NOT included. */
  preview: Deltas | null;
  /** Health lost because the hours pass while a resource is critical (<= 0). */
  critHealth: number;
  /** Resources whose one-time emergency reserve this action would trigger. */
  reserves: ResourceId[];
  /** Other open faults that could no longer be fixed today (only their defer would fit). */
  blocks: string[];
}

export interface OptionView extends PreviewParts {
  faultId: string;
  optionId: string;
  kind: string;
  cost: OptionCost;
  invalid: Invalid | null;
  tags: OptionTag[];
  /** Chain-note ids that hold now (how earlier decisions shape this option). */
  notes: string[];
}


const KEYS = ['power', 'life', 'shield', 'health', 'dose'] as const;

function addDeltas(into: Deltas, d: Deltas) {
  for (const k of KEYS) if (d[k]) into[k] = Math.round(((into[k] ?? 0) + d[k]!) * 100) / 100;
  if (d.hours) into.hours = Math.round(((into.hours ?? 0) + d.hours) * 100) / 100;
  for (const [item, n] of Object.entries(d.items ?? {})) into.items = { ...into.items, [item]: (into.items?.[item] ?? 0) + n };
}

/** Can this fault still be fixed today with something other than deferring? */
export function fixable(engine: Engine, s: GameState, faultId: string): boolean {
  return engine.fault(faultId).options.some((o) => o.kind !== 'defer' && !engine.check(s, { type: 'resolve', faultId, optionId: o.id }));
}

/** Split the result of `action` into its own effect, critical-hours damage and reserves. */
export function previewParts(engine: Engine, s: GameState, action: Action): PreviewParts {
  if (engine.check(s, action)) return { preview: null, critHealth: 0, reserves: [], blocks: [] };
  const after = engine.step(s, action);
  const fresh = after.trace.slice(s.trace.length);
  const own: Deltas = {};
  let critHealth = 0;
  const reserves: ResourceId[] = [];
  for (const e of fresh) {
    if (e.source.kind === 'reserve') reserves.push(e.source.res);
    else if (e.source.kind === 'critical') critHealth += e.deltas.health ?? 0;
    else addDeltas(own, { ...e.deltas, hours: undefined });
  }
  for (const k of KEYS) if (own[k] !== undefined && Math.abs(own[k]!) < 0.05) delete own[k];
  const self = action.type === 'resolve' ? action.faultId : null;
  const blocks = s.faults
    .map((f) => f.faultId)
    .filter((id) => id !== self && fixable(engine, s, id) && !fixable(engine, after, id));
  return { preview: own, critHealth: Math.round(critHealth * 10) / 10, reserves, blocks };
}

/** Chain-note ids whose condition holds in `s`. */
export function activeNotes(engine: Engine, s: GameState, notes: ChainNote[] | undefined): string[] {
  return (notes ?? []).filter((n) => engine.evalCond(s, n.when)).map((n) => n.id);
}

export function optionViews(engine: Engine, s: GameState, faultId: string): OptionView[] {
  return engine.fault(faultId).options.map((o) => {
    const action = { type: 'resolve' as const, faultId, optionId: o.id };
    return {
      faultId,
      optionId: o.id,
      kind: o.kind,
      cost: engine.optionCost(s, faultId, o.id),
      invalid: engine.check(s, action),
      tags: o.tags ?? [],
      notes: activeNotes(engine, s, o.notes),
      ...previewParts(engine, s, action),
    };
  });
}

export interface RoutineView extends PreviewParts {
  routineId: string;
  cost: OptionCost;
  invalid: Invalid | null;
  done: boolean;
}

export function routineView(engine: Engine, s: GameState, routineId: string): RoutineView {
  const action = { type: 'routine' as const, routineId };
  return {
    routineId,
    cost: engine.routineCost(s, routineId),
    invalid: engine.check(s, action),
    done: s.routinesDone.includes(routineId),
    ...previewParts(engine, s, action),
  };
}

// ---------------------------------------------------------------- what to do now

export type Mission =
  /** Go to `station` and deal with `faultId`. `fixable` false: only deferring fits today. */
  | { kind: 'fault'; faultId: string; station: string; here: boolean; fixable: boolean; open: number }
  /** No open faults left. `canWork`: some maintenance job still fits in the hours left. */
  | { kind: 'done'; canWork: boolean }
  | { kind: 'ended' };

/** The single next thing the player should do, for an always-visible task line. */
export function mission(engine: Engine, s: GameState): Mission {
  if (s.outcome) return { kind: 'ended' };
  if (s.faults.length === 0) {
    const canWork = engine.content.routines.some((r) => !engine.check(s, { type: 'routine', routineId: r.id }));
    return { kind: 'done', canWork };
  }
  const ids = s.faults.map((f) => f.faultId);
  const ok = ids.filter((id) => fixable(engine, s, id));
  const pool = ok.length ? ok : ids;
  const pick = pool.find((id) => engine.fault(id).station === s.location) ?? pool[0]!;
  const station = engine.fault(pick).station;
  return { kind: 'fault', faultId: pick, station, here: station === s.location, fixable: ok.length > 0, open: ids.length };
}

export type FaultState = 'open' | 'solved' | 'deferred';

export interface TodayFault {
  faultId: string;
  station: string;
  status: FaultState;
  /** Chosen option (solved/deferred). */
  optionId: string | null;
  /** The fault was deferred on an earlier sol and came back. */
  returning: boolean;
}

/** Today's faults with their status: open, solved, or deferred by the player. */
export function todayFaults(engine: Engine, s: GameState): TodayFault[] {
  const earlier = (faultId: string) => s.decisions.some((d) => d.faultId === faultId && d.sol < s.sol);
  const decided: TodayFault[] = s.decisions
    .filter((d) => d.sol === s.sol && !d.auto)
    .map((d) => ({
      faultId: d.faultId,
      station: engine.fault(d.faultId).station,
      status: engine.option(d.faultId, d.optionId).kind === 'defer' ? 'deferred' : 'solved',
      optionId: d.optionId,
      returning: earlier(d.faultId),
    }));
  const open: TodayFault[] = s.faults.map((f) => ({
    faultId: f.faultId,
    station: engine.fault(f.faultId).station,
    status: 'open',
    optionId: null,
    returning: f.firstSol < s.sol,
  }));
  return [...decided, ...open];
}

export interface HoursItem {
  /** decision: a fault option; routine: a maintenance job; event: hours lost to a morning event. */
  kind: 'decision' | 'routine' | 'event';
  source: Source;
  walk: number;
  eva: number;
  work: number;
  total: number;
}

/** Where today's hours went, in order (walking and suit-up split out). */
export function hoursLog(engine: Engine, s: GameState): HoursItem[] {
  const out: HoursItem[] = [];
  let at = engine.content.homeStation;
  const r2 = (v: number) => Math.round(v * 100) / 100;
  for (const e of s.trace) {
    if (e.sol !== s.sol) continue;
    const used = -(e.deltas.hours ?? 0);
    if (e.at === 'morning' && used > 0) {
      out.push({ kind: 'event', source: e.source, walk: 0, eva: 0, work: used, total: used });
      continue;
    }
    if (e.at !== 'day' || (e.source.kind !== 'decision' && e.source.kind !== 'routine')) continue;
    if (e.source.kind === 'decision' && e.source.auto) continue;
    let station: string | null;
    if (e.source.kind === 'routine') {
      station = engine.routine(e.source.id).station;
    } else {
      const faultId = e.source.key.split(':')[1]!;
      const o = engine.option(faultId, e.source.optionId);
      station = o.kind === 'defer' ? null : (o.station ?? engine.fault(faultId).station);
    }
    let walk = 0;
    let eva = 0;
    if (station && station !== at) {
      const from = engine.station(at);
      const to = engine.station(station);
      walk = from.walk + to.walk;
      if (to.eva && !from.eva) eva = s.config.rules.eva.hours;
      at = station;
    }
    if (used <= 0) continue;
    out.push({ kind: e.source.kind, source: e.source, walk: r2(walk), eva: r2(eva), work: r2(used - walk - eva), total: r2(used) });
  }
  return out;
}

/** Emergency reserves used so far, in order. */
export function reservesUsed(s: GameState): { res: ResourceId; sol: number }[] {
  return s.trace.filter((e) => e.source.kind === 'reserve').map((e) => ({ res: (e.source as { res: ResourceId }).res, sol: e.sol }));
}

export type ReportSection = 'day' | 'night' | 'morning';

export interface ReportRow {
  section: ReportSection;
  key: string;
  source: Source;
  deltas: Deltas;
  /** Earlier decisions that caused this row (excluding the row's own decision). */
  causes: DecisionKey[];
}

/** A sol's report grouped by part of the day, merged by trace key, zero rows dropped
 *  (decisions are kept: a deferral without immediate effect is still worth showing). */
export function solReportRows(s: GameState, sol: number): ReportRow[] {
  const rows = new Map<string, ReportRow>();
  for (const e of s.trace) {
    let section: ReportSection | null = null;
    if (e.sol === sol && e.at === 'day') section = 'day';
    else if (e.sol === sol && e.at === 'night') section = 'night';
    else if (e.sol === sol + 1 && e.at === 'morning') section = 'morning';
    if (!section) continue;
    const id = `${section}|${e.key}`;
    const own = e.source.kind === 'decision' ? e.source.key : null;
    const row = rows.get(id) ?? { section, key: e.key, source: e.source, deltas: {}, causes: [] };
    addDeltas(row.deltas, { ...e.deltas, hours: undefined });
    for (const c of e.causes) if (c !== own && !row.causes.includes(c)) row.causes.push(c);
    rows.set(id, row);
  }
  const order: ReportSection[] = ['day', 'night', 'morning'];
  return [...rows.values()]
    .filter((r) => r.source.kind === 'decision' || KEYS.some((k) => Math.abs(r.deltas[k] ?? 0) >= 0.05) || Object.keys(r.deltas.items ?? {}).length > 0)
    .sort((a, b) => order.indexOf(a.section) - order.indexOf(b.section));
}

export interface StationView {
  id: string;
  walk: number;
  eva: boolean;
  locked: boolean;
  here: boolean;
  faults: string[];
  routines: string[];
}

export function stationViews(engine: Engine, s: GameState): StationView[] {
  return engine.content.stations.map((st) => ({
    id: st.id,
    walk: st.walk,
    eva: st.eva,
    locked: engine.isLocked(s, st.id),
    here: s.location === st.id,
    faults: s.faults.filter((f) => engine.fault(f.faultId).station === st.id).map((f) => f.faultId),
    routines: engine.content.routines.filter((r) => r.station === st.id).map((r) => r.id),
  }));
}

/** Simple mission score: survival, health, resources, low dose. */
export function score(s: GameState): number {
  const won = s.outcome?.won ? 1000 : 0;
  const res = RESOURCES.reduce((t, r) => t + s.res[r], 0);
  return Math.max(0, Math.round(won + s.health * 5 + res - s.dose * 2 + (s.outcome?.sol ?? s.sol) * 20));
}
