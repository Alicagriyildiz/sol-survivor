// Read-only views of the state for presentation layers (2D UI now, 3D scene later).
// Pure and content-agnostic, like the rest of src/sim.
import type { Engine, OptionCost } from './engine';
import {
  RESOURCES,
  type Deltas,
  type GameState,
  type Invalid,
  type OptionTag,
  type ResourceId,
  type Rules,
  type TraceEntry,
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

export interface OptionView {
  faultId: string;
  optionId: string;
  kind: string;
  cost: OptionCost;
  invalid: Invalid | null;
  tags: OptionTag[];
  /** Immediate visible change if chosen now (null when not available). */
  preview: Deltas | null;
}

function diffState(a: GameState, b: GameState): Deltas {
  const d: Deltas = {};
  for (const r of RESOURCES) if (Math.abs(b.res[r] - a.res[r]) >= 0.05) d[r] = Math.round((b.res[r] - a.res[r]) * 10) / 10;
  if (Math.abs(b.health - a.health) >= 0.05) d.health = Math.round((b.health - a.health) * 10) / 10;
  if (Math.abs(b.dose - a.dose) >= 0.05) d.dose = Math.round((b.dose - a.dose) * 10) / 10;
  const items: Record<string, number> = {};
  for (const k of new Set([...Object.keys(a.items), ...Object.keys(b.items)])) {
    const v = (b.items[k] ?? 0) - (a.items[k] ?? 0);
    if (v) items[k] = v;
  }
  if (Object.keys(items).length) d.items = items;
  return d;
}

export function optionViews(engine: Engine, s: GameState, faultId: string): OptionView[] {
  return engine.fault(faultId).options.map((o) => {
    const action = { type: 'resolve' as const, faultId, optionId: o.id };
    const invalid = engine.check(s, action);
    return {
      faultId,
      optionId: o.id,
      kind: o.kind,
      cost: engine.optionCost(s, faultId, o.id),
      invalid,
      tags: o.tags ?? [],
      preview: invalid ? null : diffState(s, engine.step(s, action)),
    };
  });
}

export interface RoutineView {
  routineId: string;
  cost: OptionCost;
  invalid: Invalid | null;
  done: boolean;
  preview: Deltas | null;
}

export function routineView(engine: Engine, s: GameState, routineId: string): RoutineView {
  const action = { type: 'routine' as const, routineId };
  const invalid = engine.check(s, action);
  return {
    routineId,
    cost: engine.routineCost(s, routineId),
    invalid,
    done: s.routinesDone.includes(routineId),
    preview: invalid ? null : diffState(s, engine.step(s, action)),
  };
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

/** What happened between the end of `sol`'s day and the next morning (and its auto-defers). */
export function solReport(s: GameState, sol: number): TraceEntry[] {
  return s.trace.filter(
    (e) =>
      (e.sol === sol && (e.at === 'night' || (e.source.kind === 'decision' && e.source.auto) || (e.at === 'day' && e.source.kind === 'critical'))) ||
      (e.sol === sol + 1 && e.at === 'morning'),
  );
}

/** Simple mission score: survival, health, resources, low dose. */
export function score(s: GameState): number {
  const won = s.outcome?.won ? 1000 : 0;
  const res = RESOURCES.reduce((t, r) => t + s.res[r], 0);
  return Math.max(0, Math.round(won + s.health * 5 + res - s.dose * 2 + (s.outcome?.sol ?? s.sol) * 20));
}
