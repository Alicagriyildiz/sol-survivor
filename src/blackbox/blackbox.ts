// Black Box: replay, counterfactual ("what if I had chosen differently?"), causal
// explanation and rescue search. Pure functions on top of the engine.
import { carefulBot, continueGame, type Policy } from '../bots/bots';
import type { Engine } from '../sim/engine';
import { createRng, mixSeed } from '../sim/rng';
import {
  RESOURCES,
  type Action,
  type DecisionKey,
  type DecisionRec,
  type GameState,
  type Invalid,
  type MissionConfig,
  type Outcome,
  type ResourceId,
  type Source,
  type TraceEntry,
} from '../sim/types';

export interface MissionLog {
  seed: number;
  config: MissionConfig;
  actions: Action[];
}

/** Strict replay: every action must be valid. Same log => bit-identical state. */
export function replay(engine: Engine, seed: number, config: MissionConfig, actions: Action[]): GameState {
  let s = engine.init(seed, config);
  for (const a of actions) s = engine.step(s, a);
  return s;
}

export interface SkippedAction {
  actionIndex: number;
  action: Action;
  reason: Invalid;
  sol: number;
}

export interface LenientResult {
  final: GameState;
  /** Actions that became invalid in this timeline and were skipped. */
  skipped: SkippedAction[];
  /** Sol from which the autopilot played (the log ran out before the mission ended). */
  autopilotFromSol: number | null;
}

/**
 * Fallback rule (documented in docs/DESIGN.md):
 *  1. Actions are replayed in order.
 *  2. An action that is invalid in the new timeline (fault not open, not enough hours,
 *     missing item, station locked, ...) is SKIPPED. Its fault then stays open and is
 *     deferred automatically at the end of that sol, exactly as if the player did nothing.
 *  3. If the mission ends earlier, the remaining actions are dropped.
 *  4. If the log runs out before the mission ends (the original mission ended earlier),
 *     the careful bot plays the remaining sols as an autopilot.
 */
export function replayLenient(
  engine: Engine,
  seed: number,
  config: MissionConfig,
  actions: Action[],
  autopilot: Policy | null = carefulBot,
): LenientResult {
  let s = engine.init(seed, config);
  const skipped: SkippedAction[] = [];
  for (let i = 0; i < actions.length && !s.outcome; i++) {
    const a = actions[i]!;
    const err = engine.check(s, a);
    if (err) {
      skipped.push({ actionIndex: i, action: a, reason: err, sol: s.sol });
      continue;
    }
    s = engine.step(s, a);
  }
  let autopilotFromSol: number | null = null;
  if (!s.outcome && autopilot) {
    autopilotFromSol = s.sol;
    s = continueGame(engine, autopilot, s, createRng(mixSeed(seed, 0xb1ac))).final;
  }
  return { final: s, skipped, autopilotFromSol };
}

export interface Alternative {
  optionId: string;
  /** null when the option was available at that moment of the original mission. */
  invalid: Invalid | null;
}

/** States just before every action of the original run (index i = before action i). */
function statesBefore(engine: Engine, log: MissionLog): GameState[] {
  const out: GameState[] = [];
  let s = engine.init(log.seed, log.config);
  for (const a of log.actions) {
    out.push(s);
    s = engine.step(s, a);
  }
  out.push(s);
  return out;
}

/** Where in the action list a decision happens (for auto decisions: the sol's endSol). */
function decisionSlot(log: MissionLog, before: GameState[], d: DecisionRec): { index: number; insert: boolean } {
  if (!d.auto && d.actionIndex !== null) return { index: d.actionIndex, insert: false };
  for (let i = 0; i < log.actions.length; i++) {
    if (log.actions[i]!.type === 'endSol' && before[i]!.sol === d.sol) return { index: i, insert: true };
  }
  throw new Error(`no endSol found for auto decision ${d.key}`);
}

/** Options the player could have picked instead, with availability at that moment. */
export function alternatives(engine: Engine, log: MissionLog, decisionIndex: number): Alternative[] {
  const before = statesBefore(engine, log);
  const final = before[before.length - 1]!;
  const d = final.decisions[decisionIndex];
  if (!d) throw new Error(`no decision ${decisionIndex}`);
  const slot = decisionSlot(log, before, d);
  const s = before[slot.index]!;
  return engine
    .fault(d.faultId)
    .options.filter((o) => o.id !== d.optionId)
    .map((o) => ({ optionId: o.id, invalid: engine.check(s, { type: 'resolve', faultId: d.faultId, optionId: o.id }) }));
}

export interface Counterfactual {
  decision: DecisionRec;
  from: string;
  to: string;
  original: GameState;
  alt: LenientResult;
  explanation: Explanation;
}

export function counterfactual(
  engine: Engine,
  log: MissionLog,
  decisionIndex: number,
  alternative: string,
  autopilot: Policy | null = carefulBot,
): Counterfactual {
  const before = statesBefore(engine, log);
  const original = before[before.length - 1]!;
  const d = original.decisions[decisionIndex];
  if (!d) throw new Error(`no decision ${decisionIndex}`);
  if (alternative === d.optionId) throw new Error('alternative equals the original choice');
  const slot = decisionSlot(log, before, d);
  const changed: Action = { type: 'resolve', faultId: d.faultId, optionId: alternative };
  const err = engine.check(before[slot.index]!, changed);
  if (err) throw new Error(`alternative ${alternative} was not available: ${err}`);
  const actions = [...log.actions];
  if (slot.insert) actions.splice(slot.index, 0, changed);
  else actions[slot.index] = changed;
  const alt = replayLenient(engine, log.seed, log.config, actions, autopilot);
  return { decision: d, from: d.optionId, to: alternative, original, alt, explanation: explain(original, alt.final, d) };
}

export interface Rescue {
  decisionIndex: number;
  decision: DecisionRec;
  optionId: string;
  outcome: Outcome;
}

/** All single-decision changes that flip the mission outcome (loss -> win, or win -> loss). */
export function findRescues(
  engine: Engine,
  log: MissionLog,
  autopilot: Policy | null = carefulBot,
  opts: { firstOnly?: boolean } = {},
): Rescue[] {
  const original = replay(engine, log.seed, log.config, log.actions);
  if (!original.outcome) return [];
  const out: Rescue[] = [];
  for (let i = 0; i < original.decisions.length; i++) {
    const d = original.decisions[i]!;
    for (const alt of alternatives(engine, log, i)) {
      if (alt.invalid) continue;
      const cf = counterfactual(engine, log, i, alt.optionId, autopilot);
      const o = cf.alt.final.outcome;
      // Without an autopilot an unfinished timeline counts as "not rescued".
      if (o && o.won !== original.outcome.won) {
        out.push({ decisionIndex: i, decision: d, optionId: alt.optionId, outcome: o });
        if (opts.firstOnly) return out;
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------- explanation

export type Diff = Partial<Record<ResourceId | 'health' | 'dose', number>>;

export type ExplainStep =
  | { type: 'changed'; sol: number; faultId: string; from: string; to: string }
  | { type: 'immediate'; diff: Diff }
  | { type: 'linked'; sol: number; source: Source; diff: Diff }
  | { type: 'critical'; res: ResourceId; healthDiff: number }
  | { type: 'outcome'; original: { outcome: Outcome; health: number }; alt: { outcome: Outcome; health: number } }
  | { type: 'noDiff' };

export interface Explanation {
  steps: ExplainStep[];
  /** First sol (snapshot) where the two timelines differ. */
  firstDivergenceSol: number | null;
  /** Per-sol curves of both timelines for charts. */
  curves: { original: GameState['history']; alt: GameState['history'] };
}

const KEYS = ['power', 'life', 'shield', 'health', 'dose'] as const;

function sumDeltas(entries: TraceEntry[]): Diff {
  const d: Diff = {};
  for (const e of entries) for (const k of KEYS) if (e.deltas[k]) d[k] = (d[k] ?? 0) + e.deltas[k]!;
  return d;
}

function diffOf(a: Diff, b: Diff): Diff {
  const d: Diff = {};
  for (const k of KEYS) {
    const v = Math.round(((b[k] ?? 0) - (a[k] ?? 0)) * 10) / 10;
    if (Math.abs(v) >= 0.5) d[k] = v;
  }
  return d;
}

const weight = (d: Diff) =>
  Math.abs(d.health ?? 0) * 2 + Math.abs(d.power ?? 0) + Math.abs(d.life ?? 0) + Math.abs(d.shield ?? 0) + Math.abs(d.dose ?? 0) * 0.5;

/**
 * Compare the two timelines and build a short causal chain:
 * changed decision -> its immediate difference -> later effects that carry the decision's
 * key in their causes (delayed effects, modifiers, flag-dependent events) -> the hours
 * spent at critical levels -> the outcome.
 */
export function explain(original: GameState, alt: GameState, d: DecisionRec): Explanation {
  const steps: ExplainStep[] = [];
  const key: DecisionKey = d.key;
  const altDecision = alt.decisions.find((x) => x.key === key);
  steps.push({ type: 'changed', sol: d.sol, faultId: d.faultId, from: d.optionId, to: altDecision?.optionId ?? d.optionId });

  const own = (s: GameState) => s.trace.filter((e) => e.key === `d:${key}`);
  const immediate = diffOf(sumDeltas(own(original)), sumDeltas(own(alt)));
  if (Object.keys(immediate).length) steps.push({ type: 'immediate', diff: immediate });

  // Linked later effects: group by pairing key, keep the ones caused by the decision.
  const later = (s: GameState) => s.trace.filter((e) => e.sol >= d.sol && e.key !== `d:${key}`);
  const groups = new Map<string, { o: TraceEntry[]; a: TraceEntry[]; causal: boolean }>();
  const add = (e: TraceEntry, side: 'o' | 'a') => {
    const g = groups.get(e.key) ?? { o: [], a: [], causal: false };
    g[side].push(e);
    if (e.causes.includes(key)) g.causal = true;
    groups.set(e.key, g);
  };
  later(original).forEach((e) => add(e, 'o'));
  later(alt).forEach((e) => add(e, 'a'));
  const linked: { sol: number; source: Source; diff: Diff; w: number }[] = [];
  for (const g of groups.values()) {
    if (!g.causal) continue;
    const any = g.o[0] ?? g.a[0]!;
    if (any.source.kind === 'critical' || any.source.kind === 'night') continue;
    const diff = diffOf(sumDeltas(g.o), sumDeltas(g.a));
    const w = weight(diff);
    if (w >= 2) linked.push({ sol: any.sol, source: any.source, diff, w });
  }
  linked
    .sort((x, y) => y.w - x.w)
    .slice(0, 3)
    .sort((x, y) => x.sol - y.sol)
    .forEach((l) => steps.push({ type: 'linked', sol: l.sol, source: l.source, diff: l.diff }));

  // Time spent at critical levels.
  const crit = (s: GameState, r: ResourceId) =>
    s.trace.filter((e) => e.sol >= d.sol && e.source.kind === 'critical' && e.source.res === r).reduce((t, e) => t + (e.deltas.health ?? 0), 0);
  const crits = RESOURCES.map((r) => ({ res: r, healthDiff: Math.round((crit(alt, r) - crit(original, r)) * 10) / 10 }))
    .filter((c) => Math.abs(c.healthDiff) >= 3)
    .sort((x, y) => Math.abs(y.healthDiff) - Math.abs(x.healthDiff))
    .slice(0, 2);
  crits.forEach((c) => steps.push({ type: 'critical', res: c.res, healthDiff: c.healthDiff }));

  if (original.outcome && alt.outcome) {
    steps.push({
      type: 'outcome',
      original: { outcome: original.outcome, health: original.health },
      alt: { outcome: alt.outcome, health: alt.health },
    });
  }
  if (Object.keys(immediate).length === 0 && linked.length === 0 && crits.length === 0) steps.splice(1, 0, { type: 'noDiff' });

  let firstDivergenceSol: number | null = null;
  const n = Math.max(original.history.length, alt.history.length);
  for (let i = 0; i < n; i++) {
    const a = original.history[i];
    const b = alt.history[i];
    if (!a || !b) {
      firstDivergenceSol = (a ?? b)!.sol;
      break;
    }
    const differs = Math.abs(a.health - b.health) > 0.5 || RESOURCES.some((r) => Math.abs(a.res[r] - b.res[r]) > 0.5);
    if (differs) {
      firstDivergenceSol = a.sol;
      break;
    }
  }
  return { steps, firstDivergenceSol, curves: { original: original.history, alt: alt.history } };
}
