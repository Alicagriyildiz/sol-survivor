// Pure, deterministic simulation engine. `step` never mutates its input.
import { createRng } from './rng';
import {
  RESOURCES,
  type Action,
  type Amount,
  type Cause,
  type Cond,
  type ContentPack,
  type DecisionKey,
  type Deltas,
  type Effect,
  type FaultDef,
  type GameState,
  type Invalid,
  type MissionConfig,
  type OptionDef,
  type ResourceId,
  type RoutineDef,
  type SolDef,
  type Source,
  type StationDef,
  type TraceEntry,
} from './types';

export interface OptionCost {
  walk: number;
  eva: number;
  work: number;
  total: number;
  /** True when the work triggers an EVA (suit-up, life support and dose cost). */
  evaTrip: boolean;
}

export interface Engine {
  content: ContentPack;
  init(seed: number, config: MissionConfig): GameState;
  check(state: GameState, action: Action): Invalid | null;
  step(state: GameState, action: Action): GameState;
  validActions(state: GameState): Action[];
  optionCost(state: GameState, faultId: string, optionId: string): OptionCost;
  routineCost(state: GameState, routineId: string): OptionCost;
  fault(id: string): FaultDef;
  option(faultId: string, optionId: string): OptionDef;
  routine(id: string): RoutineDef;
  station(id: string): StationDef;
  isLocked(state: GameState, stationId: string): boolean;
  evalCond(state: GameState, cond: Cond): boolean;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const round2 = (v: number) => Math.round(v * 100) / 100;

export function decisionKey(sol: number, faultId: string): DecisionKey {
  return `s${sol}:${faultId}`;
}

export function createEngine(content: ContentPack): Engine {
  const stations = new Map<string, StationDef>(content.stations.map((s) => [s.id, s]));
  const faults = new Map<string, FaultDef>();
  const sols = new Map<number, SolDef>();
  for (const sol of content.sols) {
    sols.set(sol.sol, sol);
    for (const f of sol.faults) {
      if (faults.has(f.id)) throw new Error(`duplicate fault id ${f.id}`);
      faults.set(f.id, f);
    }
  }
  const routines = new Map<string, RoutineDef>(content.routines.map((r) => [r.id, r]));

  const station = (id: string): StationDef => {
    const s = stations.get(id);
    if (!s) throw new Error(`unknown station ${id}`);
    return s;
  };
  const fault = (id: string): FaultDef => {
    const f = faults.get(id);
    if (!f) throw new Error(`unknown fault ${id}`);
    return f;
  };
  const option = (faultId: string, optionId: string): OptionDef => {
    const o = fault(faultId).options.find((x) => x.id === optionId);
    if (!o) throw new Error(`unknown option ${faultId}/${optionId}`);
    return o;
  };
  const routine = (id: string): RoutineDef => {
    const r = routines.get(id);
    if (!r) throw new Error(`unknown routine ${id}`);
    return r;
  };

  // ------------------------------------------------------------ conditions

  function evalCondC(s: GameState, c: Cond, causes: Set<DecisionKey>): boolean {
    if ('flag' in c) {
      const f = s.flags[c.flag];
      if (f?.value) f.origin.forEach((k) => causes.add(k));
      return !!f?.value;
    }
    if ('notFlag' in c) {
      const f = s.flags[c.notFlag];
      if (f) f.origin.forEach((k) => causes.add(k));
      return !f?.value;
    }
    if ('roll' in c) return s.rolls[c.roll] === c.eq;
    if ('res' in c) {
      const v = s.res[c.res];
      return (c.lt === undefined || v < c.lt) && (c.gte === undefined || v >= c.gte);
    }
    if ('item' in c) return (s.items[c.item] ?? 0) >= c.gte;
    if ('solLt' in c) return s.sol < c.solLt;
    if ('solGte' in c) return s.sol >= c.solGte;
    if ('not' in c) return !evalCondC(s, c.not, causes);
    if ('all' in c) {
      let ok = true;
      for (const x of c.all) ok = evalCondC(s, x, causes) && ok;
      return ok;
    }
    let ok = false;
    for (const x of c.any) ok = evalCondC(s, x, causes) || ok;
    return ok;
  }
  const evalCond = (s: GameState, c: Cond) => evalCondC(s, c, new Set());

  const amount = (s: GameState, a: Amount): number =>
    typeof a === 'number' ? a : (s.rolls[a.roll] ?? 0) * (a.mul ?? 1) + (a.add ?? 0);

  const isLocked = (s: GameState, stationId: string): boolean => {
    const st = station(stationId);
    return !!st.lockedWhen && evalCond(s, st.lockedWhen);
  };

  // ------------------------------------------------------------ mutation helpers (on a private copy)

  function cloneState(s: GameState): GameState {
    return {
      ...s,
      res: { ...s.res },
      items: { ...s.items },
      flags: { ...s.flags },
      faults: [...s.faults],
      routinesDone: [...s.routinesDone],
      reopenNext: [...s.reopenNext],
      pending: [...s.pending],
      modifiers: [...s.modifiers],
      decisions: [...s.decisions],
      trace: [...s.trace],
      history: [...s.history],
      damage: { ...s.damage },
    };
  }

  interface Ctx {
    at: TraceEntry['at'];
    key: string;
    source: Source;
    causes: Set<DecisionKey>;
    deltas: Deltas;
  }

  const newCtx = (at: Ctx['at'], key: string, source: Source, causes: Iterable<DecisionKey> = []): Ctx => ({
    at,
    key,
    source,
    causes: new Set(causes),
    deltas: {},
  });

  function addDelta(d: Deltas, k: 'power' | 'life' | 'shield' | 'health' | 'dose' | 'hours', v: number) {
    if (v === 0) return;
    d[k] = round2((d[k] ?? 0) + v);
  }

  function commit(s: GameState, ctx: Ctx) {
    const extra = pendingCommits;
    pendingCommits = [];
    commitOne(s, ctx);
    for (const c of extra) commitOne(s, c);
  }

  function commitOne(s: GameState, ctx: Ctx) {
    const hasDelta = Object.keys(ctx.deltas).length > 0;
    if (!hasDelta && ctx.source.kind !== 'decision') return;
    s.trace.push({
      sol: s.sol,
      at: ctx.at,
      key: ctx.key,
      source: ctx.source,
      deltas: ctx.deltas,
      causes: [...ctx.causes].sort(),
    });
  }

  function changeRes(s: GameState, ctx: Ctx, r: ResourceId, v: number) {
    const before = s.res[r];
    s.res[r] = round2(clamp(before + v, 0, 100));
    addDelta(ctx.deltas, r, s.res[r] - before);
    const rv = s.config.rules.reserve;
    if (rv.amount > 0 && s.res[r] < rv.threshold && !s.reservesUsed.includes(r)) {
      s.reservesUsed = [...s.reservesUsed, r];
      const rc = newCtx(ctx.at, `reserve:${r}`, { kind: 'reserve', res: r });
      const b = s.res[r];
      s.res[r] = round2(clamp(b + rv.amount, 0, 100));
      addDelta(rc.deltas, r, s.res[r] - b);
      pendingCommits.push(rc);
    }
  }
  // Reserve entries are committed after the entry that triggered them.
  let pendingCommits: Ctx[] = [];

  function hurt(s: GameState, ctx: Ctx, cause: Cause, v: number) {
    // v < 0 is damage, v > 0 is healing
    const before = s.health;
    s.health = round2(clamp(before + v, 0, 100));
    const d = s.health - before;
    addDelta(ctx.deltas, 'health', d);
    if (d < 0) s.damage[cause] = round2(s.damage[cause] + -d);
  }

  function radiation(s: GameState, ctx: Ctx, raw: number) {
    const r = s.config.rules;
    const received = round2(Math.max(0, raw * (1 - (r.shieldFactor * s.res.shield) / 100)));
    s.dose = round2(s.dose + received);
    addDelta(ctx.deltas, 'dose', received);
    if (r.radHealthPerDose > 0) hurt(s, ctx, 'shield', -received * r.radHealthPerDose);
  }

  function applyEffects(s: GameState, effects: Effect[], ctx: Ctx) {
    for (const e of effects) {
      switch (e.kind) {
        case 'res':
          changeRes(s, ctx, e.res, amount(s, e.amount));
          break;
        case 'health':
          hurt(s, ctx, e.cause, amount(s, e.amount));
          break;
        case 'dose': {
          const v = amount(s, e.amount);
          s.dose = round2(s.dose + v);
          addDelta(ctx.deltas, 'dose', v);
          break;
        }
        case 'radiation':
          radiation(s, ctx, amount(s, e.amount));
          break;
        case 'item': {
          const before = s.items[e.item] ?? 0;
          const after = Math.max(0, before + e.amount);
          s.items[e.item] = after;
          if (after !== before) ctx.deltas.items = { ...ctx.deltas.items, [e.item]: (ctx.deltas.items?.[e.item] ?? 0) + after - before };
          break;
        }
        case 'hours': {
          const before = s.hoursLeft;
          s.hoursLeft = round2(clamp(before + e.amount, 0, s.config.hoursPerSol));
          addDelta(ctx.deltas, 'hours', s.hoursLeft - before);
          break;
        }
        case 'flag':
          s.flags[e.flag] = { value: e.value ?? true, origin: [...ctx.causes].sort() };
          break;
        case 'if': {
          const ok = evalCondC(s, e.cond, ctx.causes);
          applyEffects(s, ok ? e.then : (e.else ?? []), ctx);
          break;
        }
        case 'later':
          s.pending.push({
            dueSol: s.sol + e.inSols,
            at: e.at,
            effects: e.effects,
            label: e.label,
            causes: [...ctx.causes].sort(),
          });
          break;
        case 'modifier':
          s.modifiers = s.modifiers.filter((m) => m.id !== e.id);
          s.modifiers.push({
            id: e.id,
            nightly: e.nightly,
            remaining: e.sols ?? null,
            untilResolved: e.untilResolved ?? null,
            label: e.label,
            causes: [...ctx.causes].sort(),
          });
          break;
        case 'removeModifier':
          s.modifiers = s.modifiers.filter((m) => m.id !== e.id);
          break;
        case 'reopen':
          if (!s.reopenNext.some((r) => r.faultId === e.faultId)) {
            const open = s.faults.find((f) => f.faultId === e.faultId);
            s.reopenNext.push({ faultId: e.faultId, firstSol: open?.firstSol ?? s.sol });
          }
          break;
      }
    }
  }

  /** Time passes: every resource below `critical` hurts health, hour by hour. */
  function passHours(s: GameState, hours: number, at: 'day' | 'night') {
    if (hours <= 0) return;
    const r = s.config.rules;
    for (const res of RESOURCES) {
      const v = s.res[res];
      if (v >= r.critical) continue;
      const perHour = (r.maxDamagePerHour * (r.critical - v)) / r.critical;
      const ctx = newCtx(at, `crit:${s.sol}:${at}:${res}`, { kind: 'critical', res });
      hurt(s, ctx, res, -perHour * hours);
      commit(s, ctx);
    }
  }

  function checkDeath(s: GameState): boolean {
    if (s.outcome) return true;
    if (s.health > 0) return false;
    let cause: Cause = 'power';
    for (const c of RESOURCES) if (s.damage[c] > s.damage[cause]) cause = c;
    s.outcome = { won: false, sol: s.sol, cause };
    snapshot(s);
    return true;
  }

  function snapshot(s: GameState) {
    s.history.push({ sol: s.sol, res: { ...s.res }, health: s.health, dose: s.dose });
  }

  // ------------------------------------------------------------ costs and checks

  function travel(s: GameState, stationId: string): { walk: number; eva: number; evaTrip: boolean } {
    if (stationId === s.location) return { walk: 0, eva: 0, evaTrip: false };
    const from = station(s.location);
    const to = station(stationId);
    const walk = from.walk + to.walk;
    const evaTrip = to.eva && !from.eva;
    return { walk, eva: evaTrip ? s.config.rules.eva.hours : 0, evaTrip };
  }

  function optionCost(s: GameState, faultId: string, optionId: string): OptionCost {
    const o = option(faultId, optionId);
    if (o.kind === 'defer') return { walk: 0, eva: 0, work: o.hours, total: o.hours, evaTrip: false };
    const t = travel(s, o.station ?? fault(faultId).station);
    return { ...t, work: o.hours, total: round2(t.walk + t.eva + o.hours) };
  }

  function routineCost(s: GameState, routineId: string): OptionCost {
    const r = routine(routineId);
    const t = travel(s, r.station);
    return { ...t, work: r.hours, total: round2(t.walk + t.eva + r.hours) };
  }

  function check(s: GameState, a: Action): Invalid | null {
    if (s.outcome) return 'ended';
    if (a.type === 'endSol') return null;
    if (a.type === 'routine') {
      if (!routines.has(a.routineId)) return 'noRoutine';
      const r = routine(a.routineId);
      if (s.routinesDone.includes(r.id)) return 'routineDone';
      if (isLocked(s, r.station)) return 'locked';
      if (routineCost(s, r.id).total > s.hoursLeft + 1e-9) return 'hours';
      return null;
    }
    if (!s.faults.some((f) => f.faultId === a.faultId)) return 'noFault';
    const o = fault(a.faultId).options.find((x) => x.id === a.optionId);
    if (!o) return 'noOption';
    if (o.kind !== 'defer' && isLocked(s, o.station ?? fault(a.faultId).station)) return 'locked';
    if (o.requires && !evalCond(s, o.requires)) return 'requires';
    for (const [item, n] of Object.entries(o.items ?? {})) if ((s.items[item] ?? 0) < n) return 'items';
    if (optionCost(s, a.faultId, a.optionId).total > s.hoursLeft + 1e-9) return 'hours';
    return null;
  }

  // ------------------------------------------------------------ actions

  function doWork(
    s: GameState,
    stationId: string | null,
    hours: number,
    items: Record<string, number> | undefined,
    effects: Effect[],
    ctx: Ctx,
  ) {
    let total = hours;
    if (stationId) {
      const t = travel(s, stationId);
      total += t.walk + t.eva;
      s.location = stationId;
      if (t.evaTrip) {
        const eva = s.config.rules.eva;
        changeRes(s, ctx, 'life', -eva.life);
        radiation(s, ctx, eva.radiation);
      }
    }
    s.hoursLeft = round2(Math.max(0, s.hoursLeft - total));
    addDelta(ctx.deltas, 'hours', -total);
    for (const [item, n] of Object.entries(items ?? {})) {
      applyEffects(s, [{ kind: 'item', item, amount: -n }], ctx);
    }
    applyEffects(s, effects, ctx);
    commit(s, ctx);
    passHours(s, total, 'day');
  }

  function resolve(s: GameState, faultId: string, optionId: string, auto: boolean) {
    const f = fault(faultId);
    const o = option(faultId, optionId);
    const key = decisionKey(s.sol, faultId);
    const ctx = newCtx('day', `d:${key}`, { kind: 'decision', key, optionId, auto }, [key]);
    s.faults = s.faults.filter((x) => x.faultId !== faultId);
    if (o.kind !== 'defer') s.modifiers = s.modifiers.filter((m) => m.untilResolved !== faultId);
    s.decisions.push({
      index: s.decisions.length,
      key,
      sol: s.sol,
      faultId,
      optionId,
      auto,
      actionIndex: auto ? null : s.actionCount,
    });
    doWork(s, o.kind === 'defer' ? null : (o.station ?? f.station), o.hours, o.items, o.effects, ctx);
  }

  function deferOption(f: FaultDef): OptionDef {
    const d = f.options.find((o) => o.kind === 'defer');
    if (!d) throw new Error(`fault ${f.id} has no defer option`);
    return d;
  }

  function runPending(s: GameState, at: 'morning' | 'night') {
    const due = s.pending.filter((p) => p.dueSol === s.sol && p.at === at);
    s.pending = s.pending.filter((p) => !(p.dueSol === s.sol && p.at === at));
    for (const p of due) {
      const ctx = newCtx(at, `p:${s.sol}:${at}:${p.label}`, { kind: 'pending', label: p.label }, p.causes);
      applyEffects(s, p.effects, ctx);
      commit(s, ctx);
    }
  }

  function night(s: GameState) {
    const r = s.config.rules;
    const sol = sols.get(s.sol);
    if (sol?.night) {
      const ctx = newCtx('night', `ev:${s.sol}:night`, { kind: 'event', id: `sol${s.sol}.night` });
      applyEffects(s, sol.night, ctx);
      commit(s, ctx);
    }
    runPending(s, 'night');
    const kept = [];
    for (const m of s.modifiers) {
      const ctx = newCtx('night', `m:${s.sol}:${m.id}`, { kind: 'modifier', id: m.id, label: m.label }, m.causes);
      for (const res of RESOURCES) {
        const v = m.nightly[res];
        if (v) changeRes(s, ctx, res, v);
      }
      commit(s, ctx);
      const remaining = m.remaining === null ? null : m.remaining - 1;
      if (remaining === null || remaining > 0) kept.push({ ...m, remaining });
    }
    s.modifiers = kept;
    const base = newCtx('night', `n:${s.sol}`, { kind: 'night' });
    const lowPower = s.res.power < r.lowPowerThreshold;
    for (const res of RESOURCES) changeRes(s, base, res, r.nightly[res]);
    if (lowPower) changeRes(s, base, 'life', -r.lowPowerLifePenalty);
    radiation(s, base, r.nightlyRadiation);
    commit(s, base);
    passHours(s, r.nightHours, 'night');
    if (RESOURCES.every((res) => s.res[res] >= r.comfortable) && s.health > 0) {
      const heal = newCtx('night', `heal:${s.sol}`, { kind: 'night' });
      hurt(s, heal, 'life', r.nightHeal);
      commit(s, heal);
    }
  }

  function morning(s: GameState) {
    s.hoursLeft = s.config.hoursPerSol;
    s.location = content.homeStation;
    s.routinesDone = [];
    const sol = sols.get(s.sol);
    if (sol?.morning) {
      const ctx = newCtx('morning', `ev:${s.sol}:morning`, { kind: 'event', id: `sol${s.sol}.morning` });
      applyEffects(s, sol.morning, ctx);
      commit(s, ctx);
    }
    runPending(s, 'morning');
    const open = s.reopenNext.map((r) => ({ faultId: r.faultId, firstSol: r.firstSol }));
    s.reopenNext = [];
    for (const f of sol?.faults ?? []) {
      if (open.some((o) => o.faultId === f.id)) continue;
      if (!f.when || evalCond(s, f.when)) open.push({ faultId: f.id, firstSol: s.sol });
    }
    s.faults = open;
  }

  function endSol(s: GameState) {
    for (const f of [...s.faults]) {
      resolve(s, f.faultId, deferOption(fault(f.faultId)).id, true);
      if (checkDeath(s)) return;
    }
    passHours(s, s.hoursLeft, 'day');
    s.hoursLeft = 0;
    if (checkDeath(s)) return;
    if (s.sol >= s.config.solCount) {
      s.outcome = { won: true, sol: s.sol, cause: null };
      snapshot(s);
      return;
    }
    night(s);
    if (checkDeath(s)) return;
    snapshot(s);
    s.sol += 1;
    morning(s);
    checkDeath(s);
  }

  // ------------------------------------------------------------ public API

  function init(seed: number, config: MissionConfig): GameState {
    const rng = createRng(seed);
    const rolls: Record<string, number> = {};
    for (const r of content.rolls) rolls[r.id] = rng.int(r.min, r.max);
    const s: GameState = {
      seed,
      config,
      rolls,
      sol: 1,
      hoursLeft: config.hoursPerSol,
      location: content.homeStation,
      res: { power: config.start.power, life: config.start.life, shield: config.start.shield },
      health: config.start.health,
      dose: 0,
      items: { ...config.inventory },
      flags: {},
      faults: [],
      routinesDone: [],
      reopenNext: [],
      pending: [],
      modifiers: [],
      decisions: [],
      actionCount: 0,
      trace: [],
      history: [],
      damage: { power: 0, life: 0, shield: 0 },
      reservesUsed: [],
      outcome: null,
    };
    snapshot(s);
    s.history[0] = { ...s.history[0]!, sol: 0 };
    morning(s);
    return s;
  }

  function step(state: GameState, a: Action): GameState {
    const err = check(state, a);
    if (err) throw new Error(`invalid action ${JSON.stringify(a)}: ${err}`);
    const s = cloneState(state);
    pendingCommits = [];
    if (a.type === 'resolve') {
      resolve(s, a.faultId, a.optionId, false);
      checkDeath(s);
    } else if (a.type === 'routine') {
      const r = routine(a.routineId);
      s.routinesDone.push(r.id);
      const ctx = newCtx('day', `r:${s.sol}:${r.id}`, { kind: 'routine', id: r.id });
      doWork(s, r.station, r.hours, undefined, r.effects, ctx);
      checkDeath(s);
    } else {
      endSol(s);
    }
    s.actionCount += 1;
    return s;
  }

  function validActions(s: GameState): Action[] {
    if (s.outcome) return [];
    const out: Action[] = [];
    for (const f of s.faults) {
      for (const o of fault(f.faultId).options) {
        const a: Action = { type: 'resolve', faultId: f.faultId, optionId: o.id };
        if (!check(s, a)) out.push(a);
      }
    }
    for (const r of content.routines) {
      const a: Action = { type: 'routine', routineId: r.id };
      if (!check(s, a)) out.push(a);
    }
    out.push({ type: 'endSol' });
    return out;
  }

  return {
    content,
    init,
    check,
    step,
    validActions,
    optionCost,
    routineCost,
    fault,
    option,
    routine,
    station,
    isLocked,
    evalCond,
  };
}
